#!/usr/bin/env node
// Catalog and fulfillment commands for the customer portal API and the hub ledger.

import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

let chainLocate;

export function loadChainLocate() {
  if (chainLocate !== undefined) return chainLocate;
  const require = createRequire(import.meta.url);
  const override = process.env.SKINTWIN_HUB_ROOT;
  if (override) {
    const script = join(override, "domain", "locate.cjs");
    if (existsSync(script) && existsSync(join(override, "domain", "org-ecosystem.json"))) {
      chainLocate = require(script);
      return chainLocate;
    }
  }
  let dir = dirname(fileURLToPath(import.meta.url));
  while (dir !== dirname(dir)) {
    if (existsSync(join(dir, ".git"))) {
      let names = [];
      try {
        names = readdirSync(dirname(dir));
      } catch {
        chainLocate = null;
        return null;
      }
      for (const name of names) {
        const script = join(dirname(dir), name, "domain", "locate.cjs");
        if (existsSync(script) && existsSync(join(dirname(dir), name, "domain", "org-ecosystem.json"))) {
          chainLocate = require(script);
          return chainLocate;
        }
      }
      break;
    }
    dir = dirname(dir);
  }
  chainLocate = null;
  return null;
}

export function useSharedLedger() {
  const locate = loadChainLocate();
  if (!locate) return false;
  return Boolean(locate.bindLedger());
}

function text(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label} is required`);
  }
  return value.trim();
}

function positive(value, label) {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive integer`);
  }
  return value;
}

export function catalogSku(args) {
  return {
    sku_id: text(args.sku_id, "sku_id"),
    formula_id: text(args.formula_id, "formula_id"),
    name: text(args.name, "sku name"),
  };
}

export function fulfill(args) {
  const kind = text(args.kind, "kind");
  if (kind !== "retail" && kind !== "treatment") {
    throw new Error(`unknown fulfillment kind ${kind}`);
  }
  return {
    fulfillment_id: text(args.fulfillment_id, "fulfillment_id"),
    sku_id: text(args.sku_id, "sku_id"),
    location: text(args.location, "location"),
    milligrams: positive(args.milligrams, "milligrams"),
    kind,
    practitioner_id: kind === "treatment" ? text(args.practitioner_id, "practitioner_id") : null,
  };
}

export function fulfillmentCommands(orderNumber, items, therapistId) {
  const orderId = text(orderNumber, "order number");
  if (!Array.isArray(items)) throw new Error("order items are required");
  const commands = [];
  items.forEach((item, index) => {
    const type = item?.type || "product";
    if (type === "service" || !item?.sku) return;
    if (type !== "product" && type !== "treatment") {
      throw new Error(`unknown item type ${type}`);
    }
    if (typeof item.location !== "string" || !Number.isInteger(item.milligrams)) {
      throw new Error(`sku ${item.sku} requires location and milligrams`);
    }
    const kind = type === "treatment" ? "treatment" : "retail";
    const practitioner =
      item.practitionerId || (therapistId == null ? undefined : String(therapistId));
    const args = {
      fulfillment_id: `${orderId}:${index}:${item.sku}`,
      sku_id: item.sku,
      location: item.location,
      milligrams: item.milligrams,
      kind,
      practitioner_id: kind === "treatment" ? practitioner : null,
    };
    fulfill(args);
    commands.push({ command: "fulfill", args });
  });
  return commands;
}

export function handleStage(request) {
  const command = request?.command;
  const args = request?.args || {};
  try {
    if (command === "catalog_sku") return commitStage(request, { ok: true, artifact: catalogSku(args) });
    if (command === "fulfill") return commitStage(request, { ok: true, artifact: fulfill(args) });
    return { ok: false, error: `unknown command ${command}` };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

function commitStage(request, result) {
  if (!result.ok || process.env.SKINTWIN_CHAIN_SKIP_DISPATCH === "1") return result;
  const ledger = process.env.SKINTWIN_CHAIN_LEDGER;
  if (!ledger) return result;
  const locate = loadChainLocate();
  const hub = locate && locate.hubRoot();
  if (!hub) return { ok: false, error: "supply-chain hub is not present" };
  const child = spawnSync("python3", ["-m", "domain.ledger"], {
    cwd: hub,
    input: JSON.stringify(request),
    encoding: "utf8",
  });
  if (child.status !== 0) {
    let message = child.stderr;
    try {
      message = JSON.parse(child.stdout || "{}").error || message;
    } catch {
      message = message || "ledger rejected the command";
    }
    return { ok: false, error: message || "ledger rejected the command" };
  }
  return result;
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  const result = handleStage(JSON.parse(readFileSync(0, "utf8")));
  process.stdout.write(JSON.stringify(result));
  if (!result.ok) process.exit(1);
}
