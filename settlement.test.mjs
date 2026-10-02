import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { paymentIntentMetadata, paystackInitializeMetadata, recordPaymentIntentSettlement, recordSettlement, settlementCommand, succeededPaymentIntentSettlement, verifiedPaystackSettlement } from "./settlement.mjs";

test("a payment without a fulfillment is not a settlement", () => {
  assert.equal(settlementCommand({ amount: 185, currency: "ZAR" }), null);
  assert.equal(settlementCommand(undefined), null);
  const skipped = recordSettlement({ amount: 185, currency: "ZAR", status: "succeeded" });
  assert.equal(skipped.ok, true);
  assert.equal(skipped.recorded, false);
});

test("a succeeded payment becomes a settlement in cents", () => {
  const command = settlementCommand({
    settlementId: "pay-portal",
    fulfillmentId: "order-retail:0:sku-serum-c",
    amount: "185.00",
    currency: "zar",
  });
  assert.equal(command.command, "settle");
  assert.equal(command.args.amount_cents, 18500);
  assert.equal(command.args.fulfillment_id, "order-retail:0:sku-serum-c");
  assert.equal(command.args.currency, "zar");
});

test("a settlement against an empty ledger is rejected", () => {
  const dir = mkdtempSync(join(tmpdir(), "portal-settlement-"));
  const ledger = join(dir, "supply-chain.jsonl");
  const previousLedger = process.env.SKINTWIN_CHAIN_LEDGER;
  process.env.SKINTWIN_CHAIN_LEDGER = ledger;
  try {
    const result = recordSettlement({
      settlementId: "pay-portal",
      fulfillmentId: "missing-order",
      amount: 185,
      currency: "ZAR",
    });
    assert.equal(result.ok, false);
    assert.equal(existsSync(ledger) && readFileSync(ledger, "utf8").includes("pay-portal"), false);
  } finally {
    if (previousLedger === undefined) delete process.env.SKINTWIN_CHAIN_LEDGER;
    else process.env.SKINTWIN_CHAIN_LEDGER = previousLedger;
  }
});

test("a succeeded payment intent settles the fulfillment named in its metadata", () => {
  const metadata = paymentIntentMetadata({
    userId: 4,
    orderId: 9,
    fulfillmentId: "order-9:0:sku-cleanser",
    settlementId: "pay-intent",
  });
  assert.equal(metadata.fulfillment_id, "order-9:0:sku-cleanser");
  assert.equal(metadata.settlement_id, "pay-intent");
  assert.equal(metadata.userId, "4");
  assert.equal(succeededPaymentIntentSettlement({ id: "pi_1", amount: 18500, currency: "usd" }), null);
  const payment = succeededPaymentIntentSettlement({
    id: "pi_1",
    amount: "18500",
    amount_received: 18500,
    currency: "usd",
    metadata,
  });
  const command = settlementCommand(payment);
  assert.equal(command.args.settlement_id, "pay-intent");
  assert.equal(command.args.fulfillment_id, "order-9:0:sku-cleanser");
  assert.equal(command.args.amount_cents, 18500);
  assert.equal(command.args.currency, "USD");
  const skipped = recordPaymentIntentSettlement({ id: "pi_plain", amount: 18500, currency: "usd" });
  assert.equal(skipped.ok, true);
  assert.equal(skipped.recorded, false);
  const dir = mkdtempSync(join(tmpdir(), "portal-intent-"));
  const ledger = join(dir, "supply-chain.jsonl");
  const previousLedger = process.env.SKINTWIN_CHAIN_LEDGER;
  process.env.SKINTWIN_CHAIN_LEDGER = ledger;
  try {
    const rejected = recordPaymentIntentSettlement({
      id: "pi_missing",
      amount: 18500,
      currency: "usd",
      metadata: { fulfillment_id: "missing-order" },
    });
    assert.equal(rejected.ok, false);
    assert.equal(existsSync(ledger) && readFileSync(ledger, "utf8").includes("pi_missing"), false);
  } finally {
    if (previousLedger === undefined) delete process.env.SKINTWIN_CHAIN_LEDGER;
    else process.env.SKINTWIN_CHAIN_LEDGER = previousLedger;
  }
});

test("a verified Paystack charge settles the fulfillment named in its metadata", () => {
  const metadata = paystackInitializeMetadata({
    userId: 4,
    orderId: 9,
    fulfillmentId: "order-9:0:sku-cleanser",
  });
  assert.equal(metadata.fulfillment_id, "order-9:0:sku-cleanser");
  assert.equal(metadata.userId, 4);
  assert.equal(verifiedPaystackSettlement({ status: "failed", metadata, amount: 18500 }), null);
  assert.equal(
    verifiedPaystackSettlement({ status: "success", amount: 18500, currency: "ngn", reference: "ref-1" }),
    null,
  );
  const payment = verifiedPaystackSettlement({
    status: "success",
    amount: "18500",
    currency: "ngn",
    reference: "ref-1",
    metadata: JSON.stringify(metadata),
  });
  const command = settlementCommand(payment);
  assert.equal(command.args.settlement_id, "pay-ref-1");
  assert.equal(command.args.fulfillment_id, "order-9:0:sku-cleanser");
  assert.equal(command.args.amount_cents, 18500);
  assert.equal(command.args.currency, "ngn");
  const explicit = verifiedPaystackSettlement(
    { status: "success", amount: 18500, currency: "NGN", reference: "ref-1", metadata },
    { fulfillmentId: "order-explicit", amount: 185 },
  );
  assert.equal(settlementCommand(explicit).args.fulfillment_id, "order-explicit");
  assert.equal(settlementCommand(explicit).args.amount_cents, 18500);
});
