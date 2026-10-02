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

export function formulaIdFromShopify(product) {
  if (!product || typeof product !== "object") return null;
  const direct = product.formulaId ?? product.formula_id;
  if (typeof direct === "string" && direct.trim() !== "") return direct.trim();
  const metafields = Array.isArray(product.metafields) ? product.metafields : [];
  for (const field of metafields) {
    if (!field || (field.key !== "formula_id" && field.key !== "formulaId")) continue;
    if (typeof field.value === "string" && field.value.trim() !== "") return field.value.trim();
  }
  const tags = Array.isArray(product.tags)
    ? product.tags
    : typeof product.tags === "string"
      ? product.tags.split(",")
      : [];
  for (const tag of tags) {
    const value = String(tag).trim();
    const marker = "formula:";
    if (value.toLowerCase().startsWith(marker)) {
      const formula = value.slice(marker.length).trim();
      if (formula) return formula;
    }
  }
  return null;
}

export function shopifyCatalogCommands(products) {
  if (!Array.isArray(products)) throw new Error("products are required");
  const commands = [];
  for (const product of products) {
    const formulaId = formulaIdFromShopify(product);
    if (!formulaId) continue;
    const name = text(product.title || product.name, "name");
    const sku = text(product.variants?.[0]?.sku || product.sku || name, "sku");
    const args = { sku_id: sku, formula_id: formulaId, name };
    catalogSku(args);
    commands.push({ command: "catalog_sku", args });
  }
  return commands;
}

export function acceptShopifyCatalog(products) {
  let commands;
  try {
    commands = shopifyCatalogCommands(products);
  } catch (error) {
    return { ok: false, error: error.message };
  }
  if (commands.length === 0) return { ok: true, count: 0 };
  if (!useSharedLedger()) return { ok: false, error: "supply-chain hub is not present" };
  return commitAll(commands);
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

export function treatmentProductCommands(reference, productsUsed, practitionerId) {
  if (productsUsed == null) return [];
  if (!Array.isArray(productsUsed)) throw new Error("productsUsed must be a list");
  const chainItems = productsUsed.filter((item) => item && item.sku);
  if (chainItems.length === 0) return [];
  text(reference, "treatment reference");
  return fulfillmentCommands(
    reference,
    chainItems.map((item) => ({ ...item, type: "treatment" })),
    practitionerId,
  );
}

export function acceptTreatmentProducts(reference, productsUsed, practitionerId) {
  let commands;
  try {
    commands = treatmentProductCommands(reference, productsUsed, practitionerId);
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
