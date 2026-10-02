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
