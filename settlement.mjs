// Map a succeeded portal payment onto the integrations settlement command.

import { spawnSync } from "node:child_process";
import { loadChainLocate } from "./chain_stage.mjs";

function text(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label} is required`);
  }
  return value.trim();
}

function amountCents(payment) {
  const direct = payment.amountCents ?? payment.amount_cents;
  if (Number.isInteger(direct)) {
    if (direct < 1) throw new Error("amount_cents must be a positive integer");
    return direct;
  }
  const amount = typeof payment.amount === "string" ? Number(payment.amount) : payment.amount;
  if (typeof amount !== "number" || !Number.isFinite(amount)) {
    throw new Error("amount_cents is required");
  }
  const cents = Math.round(amount * 100);
  if (cents < 1) throw new Error("amount_cents must be a positive integer");
  return cents;
}

function named(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function metadataObject(value) {
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return {};
    }
  }
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function minorUnits(value) {
  if (typeof value === "string" && /^\d+$/.test(value.trim())) value = Number(value.trim());
  if (typeof value === "number" && Number.isFinite(value)) {
    const cents = Number.isInteger(value) ? value : Math.round(value);
    if (cents >= 1) return cents;
  }
  return null;
}

function intentCents(intent) {
  const received = intent?.amount_received;
  if (Number.isInteger(received) && received >= 1) return received;
  const amount = intent?.amount;
  if (typeof amount === "string" && /^\d+$/.test(amount.trim())) return Number(amount.trim());
  if (Number.isInteger(amount) && amount >= 1) return amount;
  throw new Error("amount must be a positive integer");
}

export function paymentIntentMetadata(input = {}) {
  const metadata = {};
  if (input.userId != null && String(input.userId).trim() !== "") metadata.userId = String(input.userId);
  if (input.orderId != null && String(input.orderId).trim() !== "") metadata.orderId = String(input.orderId);
  const fulfillmentId = named(input.fulfillmentId ?? input.fulfillment_id);
  if (fulfillmentId) metadata.fulfillment_id = fulfillmentId;
  const settlementId = named(input.settlementId ?? input.settlement_id);
  if (settlementId) metadata.settlement_id = settlementId;
  return metadata;
}

export function succeededPaymentIntentSettlement(intent) {
  if (!intent || typeof intent !== "object") throw new Error("payment intent is required");
  const metadata = metadataObject(intent.metadata);
  const fulfillmentId = named(metadata.fulfillment_id) || named(metadata.fulfillmentId);
  if (!fulfillmentId) return null;
  const currency = String(intent.currency || "USD").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("currency must be a 3-letter code");
  const intentId = named(intent.id) || fulfillmentId;
  const settlementId =
    named(metadata.settlement_id) || named(metadata.settlementId) || `pay-${intentId}`;
  return {
    settlementId,
    fulfillmentId,
    amountCents: intentCents(intent),
    currency,
  };
}

export function recordPaymentIntentSettlement(intent) {
  let settlement;
  try {
    settlement = succeededPaymentIntentSettlement(intent);
  } catch (error) {
    return { ok: false, error: error.message };
  }
  if (!settlement) return { ok: true, recorded: false };
  return recordSettlement(settlement);
}

export function completedCheckoutSettlement(session) {
  if (!session || typeof session !== "object") throw new Error("checkout session is required");
  const metadata = metadataObject(session.metadata);
  const fulfillmentId = named(metadata.fulfillment_id) || named(metadata.fulfillmentId);
  if (!fulfillmentId) return null;
  const currency = String(session.currency || "USD").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("currency must be a 3-letter code");
  const sessionId = named(session.id) || fulfillmentId;
  const settlementId =
    named(metadata.settlement_id) || named(metadata.settlementId) || `pay-${sessionId}`;
  const cents = minorUnits(session.amount_total ?? session.amount_cents);
  if (cents == null) throw new Error("amount must be a positive integer");
  return { settlementId, fulfillmentId, amountCents: cents, currency };
}

export function recordCheckoutSettlement(session) {
  let settlement;
  try {
    settlement = completedCheckoutSettlement(session);
  } catch (error) {
    return { ok: false, error: error.message };
  }
  if (!settlement) return { ok: true, recorded: false };
  return recordSettlement(settlement);
}

function invoiceCurrency(invoice) {
  const currency = String(invoice.currency || "USD").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("currency must be a 3-letter code");
  return currency;
}

function invoiceLines(invoice) {
  const lines = invoice.lines;
  if (lines && typeof lines === "object" && Array.isArray(lines.data)) return lines.data;
  if (Array.isArray(lines)) return lines;
  return [];
}

function objectMetadataId(record, key) {
  if (!record || typeof record !== "object" || Array.isArray(record)) return "";
  return named(metadataObject(record.metadata)[key]);
}

function lineFulfillmentId(line) {
  if (!line || typeof line !== "object") return "";
  const metadata = metadataObject(line.metadata);
  return (
    named(line.fulfillment_id) ||
    named(line.fulfillmentId) ||
    named(metadata.fulfillment_id) ||
    named(metadata.fulfillmentId) ||
    objectMetadataId(line.price, "fulfillment_id") ||
    objectMetadataId(line.price, "fulfillmentId") ||
    objectMetadataId(line.plan, "fulfillment_id") ||
    objectMetadataId(line.plan, "fulfillmentId")
  );
}

export function paidInvoiceSettlement(invoice) {
  if (!invoice || typeof invoice !== "object") throw new Error("invoice is required");
  const metadata = metadataObject(invoice.metadata);
  const fulfillmentId = named(metadata.fulfillment_id) || named(metadata.fulfillmentId);
  if (!fulfillmentId) return null;
  const currency = invoiceCurrency(invoice);
  const invoiceId = named(invoice.id) || fulfillmentId;
  const settlementId =
    named(metadata.settlement_id) || named(metadata.settlementId) || `pay-${invoiceId}`;
  const cents = minorUnits(invoice.amount_paid);
  if (cents == null) throw new Error("amount must be a positive integer");
  return { settlementId, fulfillmentId, amountCents: cents, currency };
}

export function paidInvoiceLineSettlements(invoice) {
  if (!invoice || typeof invoice !== "object") throw new Error("invoice is required");
  const metadata = metadataObject(invoice.metadata);
  if (named(metadata.fulfillment_id) || named(metadata.fulfillmentId)) return [];
  const groups = new Map();
  for (const line of invoiceLines(invoice)) {
    const fulfillmentId = lineFulfillmentId(line);
    if (!fulfillmentId) continue;
    const cents = minorUnits(line.amount ?? line.amount_cents);
    if (cents == null) throw new Error("amount must be a positive integer");
    groups.set(fulfillmentId, (groups.get(fulfillmentId) || 0) + cents);
  }
  if (groups.size === 0) return [];
  const currency = invoiceCurrency(invoice);
  const invoiceId = named(invoice.id) || "invoice";
  const explicit = named(metadata.settlement_id) || named(metadata.settlementId);
  return [...groups.entries()].map(([fulfillmentId, amountCents], index) => ({
    settlementId:
      groups.size === 1 && explicit
        ? explicit
        : groups.size === 1
          ? `pay-${invoiceId}`
          : `pay-${invoiceId}:${index}:${fulfillmentId}`,
    fulfillmentId,
    amountCents,
    currency,
  }));
}

function recordSettlements(payments) {
  const commands = payments.map((payment) => settlementCommand(payment)).filter(Boolean);
  if (commands.length !== payments.length) return { ok: false, error: "fulfillment_id is required" };
  const locate = loadChainLocate();
  if (!locate) return { ok: false, error: "supply-chain hub is not present" };
  const stage = process.env.SKINTWIN_ACCOUNT_STAGE || locate.stageEntry("account");
  if (!stage) return { ok: false, error: "settlement stage is not present" };
  locate.bindLedger();
  const child = spawnSync("python3", [stage], {
    input: JSON.stringify({ commands }),
    encoding: "utf8",
  });
  let payload = {};
  try {
    payload = JSON.parse(child.stdout || "{}");
  } catch {
    payload = {};
  }
  if (child.status !== 0 || !payload.ok) {
    return { ok: false, error: payload.error || child.stderr || "settlement rejected" };
  }
  return { ok: true, recorded: true, count: commands.length };
}

export function recordInvoiceSettlement(invoice) {
  let settlement;
  try {
    settlement = paidInvoiceSettlement(invoice);
  } catch (error) {
    return { ok: false, error: error.message };
  }
  if (settlement) return recordSettlement(settlement);
  let lines;
  try {
    lines = paidInvoiceLineSettlements(invoice);
  } catch (error) {
    return { ok: false, error: error.message };
  }
  if (lines.length === 0) return { ok: true, recorded: false };
  if (lines.length === 1) return recordSettlement(lines[0]);
  return recordSettlements(lines);
}

export function paystackInitializeMetadata(input = {}) {
  const metadata = {};
  if (input.userId != null) metadata.userId = input.userId;
  if (input.orderId != null) metadata.orderId = input.orderId;
  const fulfillmentId = named(input.fulfillmentId ?? input.fulfillment_id);
  if (fulfillmentId) metadata.fulfillment_id = fulfillmentId;
  const settlementId = named(input.settlementId ?? input.settlement_id);
  if (settlementId) metadata.settlement_id = settlementId;
  return metadata;
}

export function verifiedPaystackSettlement(transaction, overrides = {}) {
  if (!transaction || typeof transaction !== "object") return null;
  const data = transaction.data && typeof transaction.data === "object" ? transaction.data : transaction;
  if (data.status !== "success") return null;
  const metadata = metadataObject(data.metadata);
  const fulfillmentId =
    named(overrides.fulfillmentId ?? overrides.fulfillment_id) ||
    named(metadata.fulfillment_id) ||
    named(metadata.fulfillmentId);
  if (!fulfillmentId) return null;
  const reference = named(data.reference) || (data.id == null ? fulfillmentId : String(data.id));
  const settlementId =
    named(overrides.settlementId ?? overrides.settlement_id) ||
    named(metadata.settlement_id) ||
    named(metadata.settlementId) ||
    `pay-${reference}`;
  const currency = overrides.currency || data.currency || "NGN";
  if (overrides.amount != null) {
    return { settlementId, fulfillmentId, amount: overrides.amount, currency };
  }
  const cents = minorUnits(data.amount);
  if (cents == null) return null;
  return { settlementId, fulfillmentId, amountCents: cents, currency };
}

export function settlementCommand(payment) {
  if (!payment || typeof payment !== "object" || Array.isArray(payment)) return null;
  const fulfillmentId = payment.fulfillmentId ?? payment.fulfillment_id;
  if (typeof fulfillmentId !== "string" || fulfillmentId.trim() === "") return null;
  return {
    command: "settle",
    args: {
      settlement_id: text(payment.settlementId ?? payment.settlement_id, "settlement_id"),
      fulfillment_id: text(fulfillmentId, "fulfillment_id"),
      amount_cents: amountCents(payment),
      currency: text(payment.currency || "USD", "currency"),
    },
  };
}

export function recordSettlement(payment) {
  let command;
  try {
    command = settlementCommand(payment);
  } catch (error) {
    return { ok: false, error: error.message };
  }
  if (!command) return { ok: true, recorded: false };
  const locate = loadChainLocate();
  if (!locate) return { ok: false, error: "supply-chain hub is not present" };
  const stage = process.env.SKINTWIN_ACCOUNT_STAGE || locate.stageEntry("account");
  if (!stage) return { ok: false, error: "settlement stage is not present" };
  locate.bindLedger();
  const child = spawnSync("python3", [stage], {
    input: JSON.stringify(command),
    encoding: "utf8",
  });
  let payload = {};
  try {
    payload = JSON.parse(child.stdout || "{}");
  } catch {
    payload = {};
  }
  if (child.status !== 0 || !payload.ok) {
    return { ok: false, error: payload.error || child.stderr || "settlement rejected" };
  }
  return { ok: true, recorded: true };
}
