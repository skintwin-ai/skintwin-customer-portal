import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { recordSettlement, settlementCommand } from "./settlement.mjs";

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
