#!/usr/bin/env node
// Catalog and fulfillment commands for the customer portal API and the hub ledger.

import { createRequire } from "node:module";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

let chainLocate;

function recordedHub(directory, fileName) {
  const domain = join(directory, "domain");
  const script = join(domain, fileName);
  const registryPath = join(domain, "org-ecosystem.json");
  if (!existsSync(registryPath) || !existsSync(join(domain, "supply-chain.json")) || !existsSync(script)) {
    return null;
  }
  try {
    const data = JSON.parse(readFileSync(registryPath, "utf8"));
    if (data?.hub?.name !== basename(directory)) return null;
  } catch {
    return null;
  }
  return script;
}

export function loadChainLocate() {
  if (chainLocate !== undefined) return chainLocate;
  const require = createRequire(import.meta.url);
  let script = null;
  if (process.env.SKINTWIN_HUB_ROOT) {
    script = recordedHub(process.env.SKINTWIN_HUB_ROOT, "locate.cjs");
  }
  let dir = dirname(fileURLToPath(import.meta.url));
  while (script === null && dir !== dirname(dir)) {
    if (existsSync(join(dir, ".git"))) {
      try {
        for (const name of readdirSync(dirname(dir))) {
          script = recordedHub(join(dirname(dir), name), "locate.cjs");
          if (script) break;
        }
      } catch {
        script = null;
      }
      break;
    }
    dir = dirname(dir);
  }
  chainLocate = script ? require(script) : null;
  return chainLocate;
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

export function catalogProduct(input) {
  if (!input?.formulaId) return { ok: true, recorded: false };
  if (!useSharedLedger()) return { ok: false, error: "supply-chain hub is not present" };
  return handleStage({
    command: "catalog_sku",
    args: {
      sku_id: input.sku || input.name,
      formula_id: input.formulaId,
      name: input.name,
    },
  });
}

export function acceptOrderFulfillments(orderNumber, items, therapistId) {
  let commands;
  try {
    commands = fulfillmentCommands(orderNumber, items, therapistId);
  } catch (error) {
    return { ok: false, error: error.message };
  }
  if (commands.length === 0) return { ok: true, count: 0 };
  if (!useSharedLedger()) return { ok: false, error: "supply-chain hub is not present" };
  return commitAll(commands);
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

function commitAll(commands) {
  const locate = loadChainLocate();
  if (!locate) return { ok: false, error: "supply-chain hub is not present" };
  const committed = locate.commitCommands(commands);
  return committed.ok ? { ok: true, count: commands.length } : committed;
}

function commitStage(request, result) {
  if (!result.ok || process.env.SKINTWIN_CHAIN_SKIP_DISPATCH === "1") return result;
  const ledger = process.env.SKINTWIN_CHAIN_LEDGER;
  if (!ledger) return result;
  const locate = loadChainLocate();
  if (!locate) return { ok: false, error: "supply-chain hub is not present" };
  const committed = locate.commitCommand(request);
  return committed.ok ? result : committed;
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  const result = handleStage(JSON.parse(readFileSync(0, "utf8")));
  process.stdout.write(JSON.stringify(result));
  if (!result.ok) process.exit(1);
}
