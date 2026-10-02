#!/usr/bin/env node
// Catalog and fulfillment commands for the customer portal API and the hub ledger.

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

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
  const hub = process.env.SKINTWIN_HUB_ROOT
    || ["/agent/repos/skintwin-ecosystem-design", "/workspace/repos/skintwin-ecosystem-design"]
      .find((candidate) => existsSync(`${candidate}/domain/ledger.py`));
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
