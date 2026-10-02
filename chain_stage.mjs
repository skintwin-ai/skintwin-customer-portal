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
  value = wholeCount(value);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive integer`);
  }
  return value;
}

function namedField(record, ...keys) {
  for (const key of keys) {
    const value = record?.[key];
    if (typeof value === "string" && value.trim() !== "") return value.trim();
  }
  return "";
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

function paymentProcessorId(payment) {
  if (!payment || typeof payment !== "object") return "";
  for (const key of ["processorPaymentId", "processor_payment_id"]) {
    const value = payment[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return paymentIntentId(payment);
}

export function paymentReturnCommands(payment) {
  if (!payment || typeof payment !== "object" || payment.status !== "refunded") return [];
  const sale = namedSale(payment);
  let fulfillmentId = sale.fulfillmentId;
  if (!fulfillmentId && sale.settlementId) {
    fulfillmentId = settledFulfillment(sale.settlementId);
    if (!fulfillmentId) return [];
  }
  if (!fulfillmentId) {
    const processorId = paymentProcessorId(payment);
    fulfillmentId = processorId ? settledFulfillment(`pay-${processorId}`) : "";
  }
  if (!fulfillmentId) return [];
  const paymentId = payment.id ?? payment.paymentId ?? "payment";
  const returnId = sale.returnId || `return:${paymentId}:${fulfillmentId}`;
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

function linesInDrawOrder(items) {
  if (items.every((item) => item && Number.isInteger(item.id))) {
    return [...items].sort((left, right) => left.id - right.id);
  }
  return items;
}

export function orderSaleReturns(orderNumber, items, returnKey) {
  const orderId = typeof orderNumber === "string" ? orderNumber.trim() : "";
  if (!orderId || !Array.isArray(items)) return [];
  const key = returnKey == null || String(returnKey).trim() === "" ? orderId : String(returnKey).trim();
  const commands = [];
  linesInDrawOrder(items).forEach((item, index) => {
    const type = item?.type || "product";
    const sku = namedSku(item);
    if (type === "service" || !sku) return;
    if (type !== "product" && type !== "treatment") return;
    const fulfillmentId = `${orderId}:${index}:${sku}`;
    commands.push({
      command: "return_sale",
      args: returnSale({
        return_id: `return:${key}:${fulfillmentId}`,
        fulfillment_id: fulfillmentId,
      }),
    });
  });
  return commands;
}

export function acceptOrderSaleReturns(orderNumber, items, returnKey) {
  let commands;
  try {
    commands = orderSaleReturns(orderNumber, items, returnKey);
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

function paymentIntentId(charge) {
  const intent = charge?.payment_intent;
  if (typeof intent === "string") return intent.trim();
  if (!intent || typeof intent !== "object" || Array.isArray(intent)) return "";
  return typeof intent.id === "string" ? intent.id.trim() : "";
}

function settledFulfillment(settlementId) {
  if (!settlementId) return "";
  const raw = process.env.SKINTWIN_CHAIN_LEDGER;
  if (!raw || !existsSync(raw)) return "";
  let found = "";
  for (const line of readFileSync(raw, "utf8").split("\n")) {
    if (!line.trim()) continue;
    const record = JSON.parse(line);
    if (record.command !== "settle") continue;
    const args = record.args || {};
    if (args.settlement_id !== settlementId) continue;
    const fulfillmentId = args.fulfillment_id;
    if (typeof fulfillmentId !== "string" || !fulfillmentId) continue;
    if (found && found !== fulfillmentId) return "";
    found = fulfillmentId;
  }
  return found;
}

function chargeSettlementId(charge) {
  const stated = chargeMetadata(charge, "settlement_id") || chargeMetadata(charge, "settlementId");
  if (stated) return stated;
  const intent = charge?.payment_intent;
  if (intent && typeof intent === "object" && !Array.isArray(intent)) {
    return chargeMetadata(intent, "settlement_id") || chargeMetadata(intent, "settlementId");
  }
  return "";
}

function chargeFulfillmentId(charge) {
  const stated = chargeMetadata(charge, "fulfillment_id") || chargeMetadata(charge, "fulfillmentId");
  if (stated) return stated;
  const intent = charge?.payment_intent;
  if (intent && typeof intent === "object" && !Array.isArray(intent)) {
    const named = chargeMetadata(intent, "fulfillment_id") || chargeMetadata(intent, "fulfillmentId");
    if (named) return named;
  }
  const settlementId = chargeSettlementId(charge);
  if (settlementId) return settledFulfillment(settlementId);
  const intentId = paymentIntentId(charge);
  if (!intentId) return "";
  return settledFulfillment(`pay-${intentId}`);
}

export function chargeReturnCommands(charge) {
  if (!charge || typeof charge !== "object" || charge.refunded !== true) return [];
  const fulfillmentId = chargeFulfillmentId(charge);
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

export function chargeStoredSaleReturns(charge, orderNumber, items) {
  if (!charge || typeof charge !== "object" || charge.refunded !== true) return [];
  const fulfillmentId = chargeMetadata(charge, "fulfillment_id") || chargeMetadata(charge, "fulfillmentId");
  if (fulfillmentId || chargeSettlementId(charge)) return [];
  const chargeId = charge.id == null || String(charge.id).trim() === "" ? "" : String(charge.id).trim();
  return orderSaleReturns(orderNumber, items, chargeId);
}

export function acceptChargeStoredReturns(charge, orderNumber, items) {
  let commands;
  try {
    commands = chargeStoredSaleReturns(charge, orderNumber, items);
  } catch (error) {
    return { ok: false, error: error.message };
  }
  if (commands.length === 0) return { ok: true, count: 0 };
  if (!useSharedLedger()) return { ok: false, error: "supply-chain hub is not present" };
  return commitAll(commands);
}

function invoiceLines(invoice) {
  const lines = invoice?.lines;
  if (lines && typeof lines === "object" && Array.isArray(lines.data)) return lines.data;
  if (Array.isArray(lines)) return lines;
  return [];
}

function invoiceMetadata(invoice, key) {
  const metadata = invoice?.metadata;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return "";
  const value = metadata[key];
  return typeof value === "string" ? value.trim() : "";
}

function nestedInvoiceMetadata(record, key) {
  if (!record || typeof record !== "object" || Array.isArray(record)) return "";
  const metadata = record.metadata;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return "";
  const value = metadata[key];
  return typeof value === "string" ? value.trim() : "";
}

function invoiceLineFulfillmentId(line) {
  if (!line || typeof line !== "object") return "";
  const direct = typeof line.fulfillment_id === "string" ? line.fulfillment_id.trim() : "";
  if (direct) return direct;
  const camel = typeof line.fulfillmentId === "string" ? line.fulfillmentId.trim() : "";
  if (camel) return camel;
  return (
    nestedInvoiceMetadata(line, "fulfillment_id") ||
    nestedInvoiceMetadata(line, "fulfillmentId") ||
    nestedInvoiceMetadata(line.price, "fulfillment_id") ||
    nestedInvoiceMetadata(line.price, "fulfillmentId") ||
    nestedInvoiceMetadata(line.plan, "fulfillment_id") ||
    nestedInvoiceMetadata(line.plan, "fulfillmentId")
  );
}

function voidedInvoiceFulfillments(invoice) {
  const stated = invoiceMetadata(invoice, "fulfillment_id") || invoiceMetadata(invoice, "fulfillmentId");
  if (stated) return [stated];
  const found = [];
  for (const line of invoiceLines(invoice)) {
    const fulfillmentId = invoiceLineFulfillmentId(line);
    if (fulfillmentId && !found.includes(fulfillmentId)) found.push(fulfillmentId);
  }
  return found;
}

function recordedInvoiceFulfillments(invoiceId) {
  const exact = `pay-${invoiceId}`;
  const prefix = `${exact}:`;
  const raw = process.env.SKINTWIN_CHAIN_LEDGER;
  if (!raw || !existsSync(raw)) return [];
  const bySettlement = new Map();
  for (const line of readFileSync(raw, "utf8").split("\n")) {
    if (!line.trim()) continue;
    const record = JSON.parse(line);
    if (record.command !== "settle") continue;
    const args = record.args || {};
    const settlementId = args.settlement_id;
    if (typeof settlementId !== "string" || (settlementId !== exact && !settlementId.startsWith(prefix))) continue;
    const fulfillmentId = args.fulfillment_id;
    if (typeof fulfillmentId !== "string" || !fulfillmentId) continue;
    if (!bySettlement.has(settlementId)) bySettlement.set(settlementId, fulfillmentId);
    else if (bySettlement.get(settlementId) !== fulfillmentId) bySettlement.set(settlementId, "");
  }
  const fulfillments = [];
  for (const fulfillmentId of bySettlement.values()) {
    if (fulfillmentId && !fulfillments.includes(fulfillmentId)) fulfillments.push(fulfillmentId);
  }
  return fulfillments;
}

function invoiceKey(invoice) {
  const value = invoice?.id;
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

export function voidedInvoiceReturnCommands(invoice) {
  if (!invoice || typeof invoice !== "object" || invoice.status !== "void") return [];
  let fulfillments = voidedInvoiceFulfillments(invoice);
  if (fulfillments.length === 0) {
    const settlementId = invoiceMetadata(invoice, "settlement_id") || invoiceMetadata(invoice, "settlementId");
    if (settlementId) {
      const found = settledFulfillment(settlementId);
      if (!found) return [];
      fulfillments = [found];
    } else {
      const invoiceId = invoiceKey(invoice);
      if (!invoiceId) return [];
      fulfillments = recordedInvoiceFulfillments(invoiceId);
    }
  }
  if (fulfillments.length === 0) return [];
  const key = text(invoiceKey(invoice), "invoice");
  return fulfillments.flatMap((fulfillmentId) => saleReturnCommands(`return:${key}:${fulfillmentId}`, fulfillmentId));
}

export function acceptVoidedInvoiceReturn(invoice) {
  let commands;
  try {
    commands = voidedInvoiceReturnCommands(invoice);
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

export function namedLedgerId(record, camel, snake) {
  const first = record?.[camel];
  if (typeof first === "string" && first.trim() !== "") return first.trim();
  const second = record?.[snake];
  if (typeof second === "string" && second.trim() !== "") return second.trim();
  return "";
}

export function namedSale(record) {
  return {
    fulfillmentId: namedLedgerId(record, "fulfillmentId", "fulfillment_id"),
    returnId: namedLedgerId(record, "returnId", "return_id"),
    settlementId: namedLedgerId(record, "settlementId", "settlement_id"),
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

export function storedOrderLine(item) {
  const sku = namedSku(item);
  const {
    location: _location,
    milligrams: _milligrams,
    practitionerId: _practitionerId,
    practitioner_id: _practitionerSnake,
    sku_id: _skuSnake,
    skuId: _skuCamel,
    ...stored
  } = item || {};
  if (sku) stored.sku = sku;
  return stored;
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
    const milligrams = wholeCount(item.milligrams);
    if (typeof item.location !== "string" || !Number.isInteger(milligrams)) {
      throw new Error(`sku ${sku} requires location and milligrams`);
    }
    const kind = type === "treatment" ? "treatment" : "retail";
    const practitioner = namedPractitioner(item, therapistId);
    const args = {
      fulfillment_id: `${orderId}:${index}:${sku}`,
      sku_id: sku,
      location: item.location,
      milligrams,
      kind,
      practitioner_id: kind === "treatment" ? practitioner : null,
    };
    fulfill(args);
    commands.push({ command: "fulfill", args });
  });
  return commands;
}

function namedFormula(input) {
  if (typeof input?.formulaId === "string" && input.formulaId.trim() !== "") return input.formulaId.trim();
  if (typeof input?.formula_id === "string" && input.formula_id.trim() !== "") return input.formula_id.trim();
  return "";
}

export function catalogProduct(input) {
  const formulaId = namedFormula(input);
  if (!formulaId) return { ok: true, recorded: false };
  if (!useSharedLedger()) return { ok: false, error: "supply-chain hub is not present" };
  return handleStage({
    command: "catalog_sku",
    args: {
      sku_id: namedCatalogSku(input) || input.name,
      formula_id: formulaId,
      name: input.name,
    },
  });
}

export function formulaIdFromShopify(product) {
  if (!product || typeof product !== "object") return null;
  const direct = namedFormula(product);
  if (direct) return direct;
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

function catalogName(product) {
  return text(namedField(product, "title", "name"), "name");
}

function namedCatalogSku(record) {
  for (const key of ["sku", "sku_id", "skuId"]) {
    const value = record?.[key];
    if (typeof value === "string" && value.trim() !== "") return value.trim();
  }
  return "";
}

function catalogSkus(product, name) {
  const variants = Array.isArray(product.variants) ? product.variants : [];
  const skus = [];
  const seen = new Set();
  for (const variant of variants) {
    const sku = namedCatalogSku(variant);
    if (!sku || seen.has(sku)) continue;
    seen.add(sku);
    skus.push(sku);
  }
  if (skus.length) return skus;
  return [text(namedCatalogSku(product) || name, "sku")];
}

function variantFormulaSkus(product) {
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  const named = [];
  const seen = new Set();
  for (const variant of variants) {
    const sku = namedCatalogSku(variant);
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
      const name = catalogName(product);
      for (const sku of catalogSkus(product, name)) {
        const args = { sku_id: sku, formula_id: formulaId, name };
        catalogSku(args);
        commands.push({ command: "catalog_sku", args });
      }
      continue;
    }
    const named = variantFormulaSkus(product);
    if (!named.length) continue;
    const name = catalogName(product);
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
  for (const key of [snake, camel]) {
    const value = item?.[key];
    if (typeof value === "string" && value.trim() !== "") return value.trim();
  }
  return "";
}

function wholeCount(value) {
  if (typeof value === "string" && /^\d+$/.test(value.trim())) return Number(value.trim());
  return value;
}

function statedMilligrams(item) {
  const value = item?.milligrams;
  if (typeof value === "string" && value.trim() === "") return null;
  return value == null ? null : wholeCount(value);
}

function statedName(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function namedKilograms(item) {
  for (const key of ["quantity_kg", "quantityKg"]) {
    const value = item?.[key];
    if (typeof value === "string") {
      if (value.trim() === "") continue;
      return value.trim();
    }
    if (typeof value === "number" && !Number.isNaN(value)) return value;
  }
  return null;
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
      const pieces = wholeCount(item.pieces);
      if (typeof pieces !== "number" || !Number.isInteger(pieces) || pieces < 1) {
        throw new Error("pieces must be a positive integer");
      }
      commands.push({
        command: "receive_package",
        args: {
          component_id: componentId,
          name: text(statedName(item.name) || componentId, "package name"),
          lot_id: text(lotId, "lot_id"),
          supplier_name: text(named(item, "supplier_name", "supplierName"), "supplier_name"),
          pieces,
        },
      });
      return;
    }
    let milligrams = statedMilligrams(item);
    if (milligrams == null) {
      const kilograms = namedKilograms(item);
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
        sku_id: text(namedField(delivery, "sku", "skuId", "sku_id"), "sku_id"),
        batch_id: text(namedField(delivery, "batchId", "batch_id"), "batch_id"),
        source,
        destination,
        milligrams: positive(wholeCount(delivery.milligrams), "milligrams"),
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

function recordedTransfer(transferId) {
  const raw = process.env.SKINTWIN_CHAIN_LEDGER;
  if (!raw || !existsSync(raw)) return null;
  let found = null;
  for (const line of readFileSync(raw, "utf8").split("\n")) {
    if (!line.trim()) continue;
    const record = JSON.parse(line);
    if (record.command === "transfer" && record.args?.transfer_id === transferId) found = record.args;
  }
  return found;
}

function sameTransfer(prior, args) {
  return ["sku_id", "batch_id", "source", "destination", "milligrams"].every((key) => prior[key] === args[key]);
}

export function bookingCancellationCommands(bookingId) {
  const id = text(String(bookingId), "booking id");
  const prior = recordedTransfer(`booking:${id}`);
  if (!prior) return [];
  const reverse = {
    transfer_id: `return:booking:${id}`,
    sku_id: prior.sku_id,
    batch_id: prior.batch_id,
    source: prior.destination,
    destination: prior.source,
    milligrams: prior.milligrams,
  };
  const existing = recordedTransfer(reverse.transfer_id);
  if (!existing) return [{ command: "transfer", args: reverse }];
  if (!sameTransfer(existing, reverse)) throw new Error("id already exists");
  return [];
}

export function acceptBookingCancellation(bookingId) {
  let commands;
  try {
    commands = bookingCancellationCommands(bookingId);
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
  const committed = locate.commitCommand({ command: request.command, args: result.artifact });
  return committed.ok ? result : committed;
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  const result = handleStage(JSON.parse(readFileSync(0, "utf8")));
  process.stdout.write(JSON.stringify(result));
  if (!result.ok) process.exit(1);
}
