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

export function returnSale(args) {
  return {
    return_id: text(args.return_id, "return_id"),
    fulfillment_id: text(args.fulfillment_id, "fulfillment_id"),
  };
}

export function saleReturnCommands(returnId, fulfillmentId) {
  if (fulfillmentId == null || fulfillmentId === "") return [];
  return [
    {
      command: "return_sale",
      args: returnSale({ return_id: returnId, fulfillment_id: fulfillmentId }),
    },
  ];
}

export function acceptSaleReturn(returnId, fulfillmentId) {
  let commands;
  try {
    commands = saleReturnCommands(returnId, fulfillmentId);
  } catch (error) {
    return { ok: false, error: error.message };
  }
  if (commands.length === 0) return { ok: true, count: 0 };
  if (!useSharedLedger()) return { ok: false, error: "supply-chain hub is not present" };
  return commitAll(commands);
}

export function paymentReturnCommands(payment) {
  if (!payment || typeof payment !== "object" || payment.status !== "refunded") return [];
  const fulfillmentId = payment.fulfillmentId ?? payment.fulfillment_id;
  if (fulfillmentId == null || fulfillmentId === "") return [];
  const paymentId = payment.id ?? payment.paymentId ?? "payment";
  const returnId = payment.returnId || payment.return_id || `return:${paymentId}:${fulfillmentId}`;
  return saleReturnCommands(returnId, fulfillmentId);
}

export function acceptPaymentReturn(payment) {
  let commands;
  try {
    commands = paymentReturnCommands(payment);
  } catch (error) {
    return { ok: false, error: error.message };
  }
  if (commands.length === 0) return { ok: true, count: 0 };
  if (!useSharedLedger()) return { ok: false, error: "supply-chain hub is not present" };
  return commitAll(commands);
}

function chargeMetadata(charge, key) {
  const metadata = charge?.metadata;
  if (!metadata || typeof metadata !== "object") return "";
  const value = metadata[key];
  return typeof value === "string" ? value.trim() : "";
}

export function chargeReturnCommands(charge) {
  if (!charge || typeof charge !== "object" || charge.refunded !== true) return [];
  const fulfillmentId = chargeMetadata(charge, "fulfillment_id") || chargeMetadata(charge, "fulfillmentId");
  if (!fulfillmentId) return [];
  const chargeId = text(String(charge.id ?? ""), "charge");
  const returnId =
    chargeMetadata(charge, "return_id") || chargeMetadata(charge, "returnId") || `return:${chargeId}:${fulfillmentId}`;
  return saleReturnCommands(returnId, fulfillmentId);
}

export function acceptChargeReturn(charge) {
  let commands;
  try {
    commands = chargeReturnCommands(charge);
  } catch (error) {
    return { ok: false, error: error.message };
  }
  if (commands.length === 0) return { ok: true, count: 0 };
  if (!useSharedLedger()) return { ok: false, error: "supply-chain hub is not present" };
  return commitAll(commands);
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

function namedSku(item) {
  if (typeof item?.sku === "string" && item.sku.trim() !== "") return item.sku.trim();
  if (typeof item?.sku_id === "string" && item.sku_id.trim() !== "") return item.sku_id.trim();
  if (typeof item?.skuId === "string" && item.skuId.trim() !== "") return item.skuId.trim();
  return "";
}

function namedPractitioner(item, therapistId) {
  if (typeof item?.practitionerId === "string" && item.practitionerId.trim() !== "") return item.practitionerId.trim();
  if (typeof item?.practitioner_id === "string" && item.practitioner_id.trim() !== "") return item.practitioner_id.trim();
  if (therapistId == null) return undefined;
  return String(therapistId);
}

export function fulfillmentCommands(orderNumber, items, therapistId) {
  const orderId = text(orderNumber, "order number");
  if (!Array.isArray(items)) throw new Error("order items are required");
  const commands = [];
  items.forEach((item, index) => {
    const type = item?.type || "product";
    const sku = namedSku(item);
    if (type === "service" || !sku) return;
    if (type !== "product" && type !== "treatment") {
      throw new Error(`unknown item type ${type}`);
    }
    if (typeof item.location !== "string" || !Number.isInteger(item.milligrams)) {
      throw new Error(`sku ${sku} requires location and milligrams`);
    }
    const kind = type === "treatment" ? "treatment" : "retail";
    const practitioner = namedPractitioner(item, therapistId);
    const args = {
      fulfillment_id: `${orderId}:${index}:${sku}`,
      sku_id: sku,
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

function catalogSkus(product, name) {
  const variants = Array.isArray(product.variants) ? product.variants : [];
  const skus = [];
  const seen = new Set();
  for (const variant of variants) {
    const sku = typeof variant?.sku === "string" ? variant.sku.trim() : "";
    if (!sku || seen.has(sku)) continue;
    seen.add(sku);
    skus.push(sku);
  }
  if (skus.length) return skus;
  return [text(product.sku || name, "sku")];
}

function variantFormulaSkus(product) {
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  const named = [];
  const seen = new Set();
  for (const variant of variants) {
    const sku = typeof variant?.sku === "string" ? variant.sku.trim() : "";
    if (!sku || seen.has(sku)) continue;
    const formulaId = formulaIdFromShopify(variant);
    if (!formulaId) continue;
    seen.add(sku);
    named.push({ sku, formulaId });
  }
  return named;
}

export function shopifyCatalogCommands(products) {
  if (!Array.isArray(products)) throw new Error("products are required");
  const commands = [];
  for (const product of products) {
    if (!product || typeof product !== "object") continue;
    const formulaId = formulaIdFromShopify(product);
    if (formulaId) {
      const name = text(product.title || product.name, "name");
      for (const sku of catalogSkus(product, name)) {
        const args = { sku_id: sku, formula_id: formulaId, name };
        catalogSku(args);
        commands.push({ command: "catalog_sku", args });
      }
      continue;
    }
    const named = variantFormulaSkus(product);
    if (!named.length) continue;
    const name = text(product.title || product.name, "name");
    for (const variant of named) {
      const args = { sku_id: variant.sku, formula_id: variant.formulaId, name };
      catalogSku(args);
      commands.push({ command: "catalog_sku", args });
    }
  }
  return commands;
}

function catalogIdentity(command) {
  if (command?.command !== "catalog_sku") return null;
  return `catalog_sku\0${command.args?.sku_id ?? ""}`;
}

function unrecordedCatalog(commands) {
  const raw = process.env.SKINTWIN_CHAIN_LEDGER;
  if (!raw || !existsSync(raw)) return commands;
  const found = new Map();
  for (const line of readFileSync(raw, "utf8").split("\n")) {
    if (!line.trim()) continue;
    const record = JSON.parse(line);
    const identity = catalogIdentity(record);
    if (!identity) continue;
    found.set(identity, record.args || {});
  }
  const fresh = [];
  for (const command of commands) {
    const identity = catalogIdentity(command);
    if (!identity) {
      fresh.push(command);
      continue;
    }
    const prior = found.get(identity);
    if (!prior) {
      fresh.push(command);
      continue;
    }
    const next = command.args || {};
    if (prior.sku_id !== next.sku_id || prior.formula_id !== next.formula_id || prior.name !== next.name) {
      return null;
    }
  }
  return fresh;
}

export function acceptShopifyCatalog(products) {
  let commands;
  try {
    commands = shopifyCatalogCommands(products);
  } catch (error) {
    return { ok: false, error: error.message };
  }
  if (commands.length === 0) return { ok: true, count: 0 };
  const fresh = unrecordedCatalog(commands);
  if (fresh === null) return { ok: false, error: "id already exists" };
  if (fresh.length === 0) return { ok: true, count: 0 };
  if (!useSharedLedger()) return { ok: false, error: "supply-chain hub is not present" };
  return commitAll(fresh);
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
  const chainItems = productsUsed.filter((item) => namedSku(item));
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

function named(item, snake, camel) {
  const value = item?.[snake] ?? item?.[camel];
  return typeof value === "string" ? value.trim() : "";
}

function kilogramsToMilligrams(value) {
  const milligrams = Math.round(Number(value) * 1_000_000);
  if (!Number.isInteger(milligrams) || milligrams < 1) {
    throw new Error("milligrams must be a positive integer");
  }
  return milligrams;
}

export function purchaseReceiptCommands(poNumber, receipts) {
  const poId = text(poNumber, "purchase order");
  if (!Array.isArray(receipts)) throw new Error("receipts are required");
  const commands = [];
  receipts.forEach((item, index) => {
    if (!item || typeof item !== "object") throw new Error("receipt line is required");
    const ingredientId = named(item, "ingredient_id", "ingredientId");
    const componentId = named(item, "component_id", "componentId");
    if (!ingredientId && !componentId) return;
    if (ingredientId && componentId) {
      throw new Error(`receipt ${index} names both an ingredient and a package`);
    }
    const lotId = named(item, "lot_id", "lotId") || `${poId}:${index}:${ingredientId || componentId}`;
    if (componentId) {
      const pieces = item.pieces;
      if (typeof pieces !== "number" || !Number.isInteger(pieces) || pieces < 1) {
        throw new Error("pieces must be a positive integer");
      }
      commands.push({
        command: "receive_package",
        args: {
          component_id: componentId,
          name: text(item.name || componentId, "package name"),
          lot_id: text(lotId, "lot_id"),
          supplier_name: text(named(item, "supplier_name", "supplierName"), "supplier_name"),
          pieces,
        },
      });
      return;
    }
    let milligrams = item.milligrams;
    if (milligrams == null) {
      const kilograms = item.quantity_kg ?? item.quantityKg;
      if (kilograms == null) throw new Error("milligrams must be a positive integer");
      milligrams = kilogramsToMilligrams(kilograms);
    } else if (typeof milligrams !== "number" || !Number.isInteger(milligrams) || milligrams < 1) {
      throw new Error("milligrams must be a positive integer");
    }
    commands.push({
      command: "receive_lot",
      args: {
        lot_id: text(lotId, "lot_id"),
        ingredient_id: ingredientId,
        qualification_id: text(named(item, "qualification_id", "qualificationId"), "qualification_id"),
        milligrams,
      },
    });
  });
  return commands;
}

export function supplierQualificationCommands(supplier) {
  if (!supplier || typeof supplier !== "object" || Array.isArray(supplier)) {
    throw new Error("supplier is required");
  }
  const ingredientId = named(supplier, "ingredient_id", "ingredientId");
  if (!ingredientId) return [];
  const supplierName = text(supplier.name, "supplier_name");
  const qualificationId =
    named(supplier, "qualification_id", "qualificationId") || `qual:${ingredientId}:${supplierName}`;
  return [
    {
      command: "qualify_supplier",
      args: {
        qualification_id: text(qualificationId, "qualification_id"),
        supplier_name: supplierName,
        ingredient_id: ingredientId,
      },
    },
  ];
}

export function acceptSupplierQualification(supplier) {
  let commands;
  try {
    commands = supplierQualificationCommands(supplier);
  } catch (error) {
    return { ok: false, error: error.message };
  }
  if (commands.length === 0) return { ok: true, count: 0 };
  if (!useSharedLedger()) return { ok: false, error: "supply-chain hub is not present" };
  return commitAll(commands);
}

export function acceptPurchaseReceipt(poNumber, receipts) {
  let commands;
  try {
    commands = purchaseReceiptCommands(poNumber, receipts);
  } catch (error) {
    return { ok: false, error: error.message };
  }
  if (commands.length === 0) return { ok: true, count: 0 };
  if (!useSharedLedger()) return { ok: false, error: "supply-chain hub is not present" };
  return commitAll(commands);
}

export function bookingDeliveryCommands(bookingId, delivery) {
  if (delivery == null) return [];
  if (!delivery || typeof delivery !== "object" || Array.isArray(delivery)) {
    throw new Error("delivery is required");
  }
  const id = text(String(bookingId), "booking id");
  const source = text(delivery.source, "source");
  const destination = text(delivery.destination, "destination");
  if (source === destination) throw new Error("transfer source and destination must differ");
  return [
    {
      command: "transfer",
      args: {
        transfer_id: `booking:${id}`,
        sku_id: text(delivery.skuId ?? delivery.sku_id, "sku_id"),
        batch_id: text(delivery.batchId ?? delivery.batch_id, "batch_id"),
        source,
        destination,
        milligrams: positive(delivery.milligrams, "milligrams"),
      },
    },
  ];
}

export function acceptBookingDelivery(bookingId, delivery) {
  let commands;
  try {
    commands = bookingDeliveryCommands(bookingId, delivery);
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
    if (command === "return_sale") return commitStage(request, { ok: true, artifact: returnSale(args) });
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
