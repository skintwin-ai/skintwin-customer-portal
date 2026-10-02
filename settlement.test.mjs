import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { acceptChargeReturn, acceptVoidedInvoiceReturn, loadChainLocate, voidedInvoiceReturnCommands } from "./chain_stage.mjs";
import { completedCheckoutSettlement, orderSaleSettlements, paidInvoiceLineSettlements, paidInvoiceSettlement, paymentForSettlement, paymentIntentMetadata, paystackInitializeMetadata, recordCheckoutSettlement, recordInvoiceSettlement, recordOrderSaleSettlements, recordPaymentIntentSettlement, recordSettlement, settlementCommand, succeededPaymentIntentSettlement, verifiedPaystackSettlement } from "./settlement.mjs";

test("a payment without a fulfillment is not a settlement", () => {
  assert.equal(settlementCommand({ amount: 185, currency: "ZAR" }), null);
  assert.equal(settlementCommand(undefined), null);
  const skipped = recordSettlement({ amount: 185, currency: "ZAR", status: "succeeded" });
  assert.equal(skipped.ok, true);
  assert.equal(skipped.recorded, false);
});

test("a settlement named by fulfillment_id records that sale", () => {
  assert.equal(settlementCommand({ amount: 185, currency: "ZAR", fulfillment_id: " " }), null);
  const command = settlementCommand({
    settlement_id: "pay-snake",
    fulfillmentId: " ",
    fulfillment_id: " order-9:0:sku-cleanser ",
    amount: "185.00",
    currency: "zar",
  });
  assert.equal(command.args.settlement_id, "pay-snake");
  assert.equal(command.args.fulfillment_id, "order-9:0:sku-cleanser");
  assert.equal(command.args.amount_cents, 18500);
  const metadata = paymentIntentMetadata({ fulfillment_id: "order-9:0:sku-cleanser", settlement_id: "pay-snake" });
  assert.equal(metadata.fulfillment_id, "order-9:0:sku-cleanser");
  assert.equal(metadata.settlement_id, "pay-snake");
  const preferred = paymentIntentMetadata({
    fulfillmentId: "order-camel",
    fulfillment_id: "order-snake",
  });
  assert.equal(preferred.fulfillment_id, "order-camel");
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

test("a completed checkout settles the fulfillment named in its metadata", () => {
  assert.equal(completedCheckoutSettlement({ id: "cs_plain", amount_total: 18500, currency: "zar" }), null);
  const payment = completedCheckoutSettlement({
    id: "cs_1",
    amount_total: 18500,
    currency: "zar",
    metadata: { fulfillment_id: "order-9:0:sku-cleanser", settlement_id: "pay-cs_named" },
  });
  const command = settlementCommand(payment);
  assert.equal(command.args.settlement_id, "pay-cs_named");
  assert.equal(command.args.fulfillment_id, "order-9:0:sku-cleanser");
  assert.equal(command.args.amount_cents, 18500);
  assert.equal(command.args.currency, "ZAR");
  const fromIntent = completedCheckoutSettlement({
    id: "cs_1",
    amount_total: 18500,
    currency: "zar",
    payment_intent: "pi_cs",
    metadata: { fulfillment_id: "order-9:0:sku-cleanser" },
  });
  assert.equal(settlementCommand(fromIntent).args.settlement_id, "pay-pi_cs");
  const namedIntent = completedCheckoutSettlement({
    id: "cs_1",
    amount_total: 18500,
    currency: "zar",
    payment_intent: { id: "pi_cs" },
    metadata: { fulfillment_id: "order-9:0:sku-cleanser", settlement_id: "pay-cs_named" },
  });
  assert.equal(settlementCommand(namedIntent).args.settlement_id, "pay-cs_named");
  const dir = mkdtempSync(join(tmpdir(), "portal-checkout-"));
  const ledger = join(dir, "supply-chain.jsonl");
  const locate = loadChainLocate();
  assert.ok(locate);
  const hub = locate.hubRoot();
  const previousLedger = process.env.SKINTWIN_CHAIN_LEDGER;
  const previousHub = process.env.SKINTWIN_HUB_ROOT;
  process.env.SKINTWIN_CHAIN_LEDGER = ledger;
  process.env.SKINTWIN_HUB_ROOT = hub;
  try {
    const skipped = recordCheckoutSettlement({ id: "cs_plain", amount_total: 18500, currency: "zar", metadata: { planName: "Premium" } });
    assert.equal(skipped.ok, true);
    assert.equal(skipped.recorded, false);
    assert.equal(existsSync(ledger), false);
    const missing = recordCheckoutSettlement({
      id: "cs_missing",
      amount_total: 18500,
      currency: "zar",
      metadata: { fulfillment_id: "missing-order" },
    });
    assert.equal(missing.ok, false);
    assert.equal(existsSync(ledger), false);
    const seeded = spawnSync("python3", ["-m", "domain.ledger"], {
      cwd: hub,
      input: JSON.stringify({
        commands: [
          { command: "specify_ingredient", args: { ingredient_id: "glycerin", inci: "Glycerin", cas: "56-81-5" } },
          { command: "qualify_supplier", args: { qualification_id: "qual-glycerin", supplier_name: "Inland Humectants", ingredient_id: "glycerin" } },
          { command: "receive_lot", args: { lot_id: "lot-glycerin", ingredient_id: "glycerin", qualification_id: "qual-glycerin", milligrams: 5000 } },
          { command: "define_formula", args: { formula_id: "cleanser", name: "Gentle cleanser", lines: [["glycerin", 5000]] } },
          { command: "catalog_sku", args: { sku_id: "sku-cleanser", formula_id: "cleanser", name: "Gentle cleanser" } },
          { command: "manufacture", args: { batch_id: "batch-cleanser", sku_id: "sku-cleanser", units: 1, allocations: [["glycerin", "lot-glycerin", 5000]] } },
          { command: "transfer", args: { transfer_id: "to-cape-town", sku_id: "sku-cleanser", batch_id: "batch-cleanser", source: "plant", destination: "cape-town", milligrams: 5000 } },
          { command: "fulfill", args: { fulfillment_id: "order-9:0:sku-cleanser", sku_id: "sku-cleanser", location: "cape-town", milligrams: 2000, kind: "retail" } },
          { command: "fulfill", args: { fulfillment_id: "order-cs:0:sku-cleanser", sku_id: "sku-cleanser", location: "cape-town", milligrams: 2000, kind: "retail" } },
        ],
      }),
      encoding: "utf8",
    });
    assert.equal(seeded.status, 0, seeded.stderr || seeded.stdout);
    const paid = recordCheckoutSettlement({
      id: "cs_1",
      amount_total: 18500,
      currency: "zar",
      metadata: { fulfillment_id: "order-9:0:sku-cleanser" },
    });
    assert.equal(paid.ok, true);
    assert.equal(paid.recorded, true);
    const recorded = readFileSync(ledger, "utf8");
    assert.match(recorded, /pay-cs_1/);
    const again = recordCheckoutSettlement({
      id: "cs_1",
      amount_total: 18500,
      currency: "zar",
      metadata: { fulfillment_id: "order-9:0:sku-cleanser" },
    });
    assert.equal(again.ok, false);
    assert.equal(readFileSync(ledger, "utf8"), recorded);
    const intentPaid = recordCheckoutSettlement({
      id: "cs_intent",
      amount_total: 18500,
      currency: "zar",
      payment_intent: { id: "pi_cs" },
      metadata: { fulfillment_id: "order-cs:0:sku-cleanser" },
    });
    assert.equal(intentPaid.ok, true, intentPaid.error);
    assert.equal(intentPaid.recorded, true);
    const intentRecorded = readFileSync(ledger, "utf8");
    assert.match(intentRecorded, /pay-pi_cs/);
    assert.equal(intentRecorded.includes("pay-cs_intent"), false);
    const partial = acceptChargeReturn({ refunded: false, id: "ch_cs", payment_intent: "pi_cs" });
    assert.equal(partial.ok, true);
    assert.equal(partial.count, 0);
    assert.equal(readFileSync(ledger, "utf8"), intentRecorded);
    const missingInvoice = acceptChargeReturn({
      refunded: true,
      id: "ch_invoice",
      invoice: "in_missing",
      payment_intent: "pi_cs",
    });
    assert.equal(missingInvoice.ok, true);
    assert.equal(missingInvoice.count, 0);
    assert.equal(readFileSync(ledger, "utf8"), intentRecorded);
    const missingFulfillment = acceptChargeReturn({
      refunded: true,
      id: "ch_missing",
      payment_intent: "pi_cs",
      metadata: { fulfillment_id: "missing-order" },
    });
    assert.equal(missingFulfillment.ok, false);
    assert.equal(readFileSync(ledger, "utf8"), intentRecorded);
    const returned = acceptChargeReturn({ refunded: true, id: "ch_cs", payment_intent: "pi_cs" });
    assert.equal(returned.ok, true, returned.error);
    assert.equal(returned.count, 1);
    const voided = readFileSync(ledger, "utf8");
    assert.match(voided, /return:ch_cs:order-cs:0:sku-cleanser/);
    assert.equal(voided.includes("return:to-cape-town"), false);
    const returnedAgain = acceptChargeReturn({ refunded: true, id: "ch_cs", payment_intent: { id: "pi_cs" } });
    assert.equal(returnedAgain.ok, false);
    assert.equal(readFileSync(ledger, "utf8"), voided);
  } finally {
    if (previousLedger === undefined) delete process.env.SKINTWIN_CHAIN_LEDGER;
    else process.env.SKINTWIN_CHAIN_LEDGER = previousLedger;
    if (previousHub === undefined) delete process.env.SKINTWIN_HUB_ROOT;
    else process.env.SKINTWIN_HUB_ROOT = previousHub;
  }
});

test("a paid invoice settles the fulfillment named in its metadata", () => {
  assert.equal(paidInvoiceSettlement({ id: "in_plain", amount_paid: 18500, currency: "zar" }), null);
  const payment = paidInvoiceSettlement({
    id: "in_1",
    amount_paid: 18500,
    currency: "zar",
    metadata: { fulfillment_id: "order-9:0:sku-cleanser", settlement_id: "pay-in_named" },
  });
  const command = settlementCommand(payment);
  assert.equal(command.args.settlement_id, "pay-in_named");
  assert.equal(command.args.fulfillment_id, "order-9:0:sku-cleanser");
  assert.equal(command.args.amount_cents, 18500);
  assert.equal(command.args.currency, "ZAR");
  assert.deepEqual(voidedInvoiceReturnCommands({ id: "in_1", status: "paid", metadata: { fulfillment_id: "order-9:0:sku-cleanser" } }), []);
  assert.deepEqual(
    voidedInvoiceReturnCommands({
      id: "in_1",
      status: "void",
      payment_intent: { id: "pi_1" },
      metadata: { fulfillment_id: "order-9:0:sku-cleanser", settlement_id: "pay-snake" },
    }),
    [
      {
        command: "return_sale",
        args: { return_id: "return:in_1:order-9:0:sku-cleanser", fulfillment_id: "order-9:0:sku-cleanser" },
      },
    ],
  );
  assert.deepEqual(
    voidedInvoiceReturnCommands({
      id: "in_pi",
      status: "paid",
      payment_intent: { id: "pi_meta", metadata: { fulfillment_id: "order-pi" } },
    }),
    [],
  );
  assert.deepEqual(
    voidedInvoiceReturnCommands({
      id: "in_pi",
      status: "void",
      lines: { data: [{ metadata: { fulfillment_id: "order-line" } }] },
      payment_intent: { id: "pi_meta", metadata: { fulfillment_id: "order-pi" } },
    }),
    [
      {
        command: "return_sale",
        args: { return_id: "return:in_pi:order-line", fulfillment_id: "order-line" },
      },
    ],
  );
  assert.deepEqual(
    voidedInvoiceReturnCommands({
      id: "in_pi",
      status: "void",
      metadata: { settlement_id: "pay-absent" },
      payment_intent: { id: "pi_meta", metadata: { fulfillment_id: "order-pi" } },
    }),
    [],
  );
  assert.deepEqual(
    voidedInvoiceReturnCommands({
      id: "in_pi",
      status: "void",
      payment_intent: { id: "pi_meta", metadata: { fulfillment_id: "order-pi" } },
    }),
    [
      {
        command: "return_sale",
        args: { return_id: "return:in_pi:order-pi", fulfillment_id: "order-pi" },
      },
    ],
  );
  assert.deepEqual(
    voidedInvoiceReturnCommands({
      id: "in_pi",
      status: "void",
      payment_intent: { id: "pi_meta", metadata: { fulfillmentId: "order-pi" } },
    }),
    [
      {
        command: "return_sale",
        args: { return_id: "return:in_pi:order-pi", fulfillment_id: "order-pi" },
      },
    ],
  );
  assert.deepEqual(
    voidedInvoiceReturnCommands({
      id: "in_pi",
      status: "void",
      payment_intent: { id: "pi_meta", metadata: { settlement_id: "pay-absent" } },
    }),
    [],
  );
  const dir = mkdtempSync(join(tmpdir(), "portal-invoice-"));
  const ledger = join(dir, "supply-chain.jsonl");
  const locate = loadChainLocate();
  assert.ok(locate);
  const hub = locate.hubRoot();
  const previousLedger = process.env.SKINTWIN_CHAIN_LEDGER;
  const previousHub = process.env.SKINTWIN_HUB_ROOT;
  process.env.SKINTWIN_CHAIN_LEDGER = ledger;
  process.env.SKINTWIN_HUB_ROOT = hub;
  try {
    assert.deepEqual(voidedInvoiceReturnCommands({ id: "in_intent", status: "void", payment_intent: "pi_1" }), []);
    assert.deepEqual(voidedInvoiceReturnCommands({ id: "in_intent", status: "void", payment_intent: { id: "pi_1" } }), []);
    const skipped = recordInvoiceSettlement({ id: "in_plain", amount_paid: 18500, currency: "zar" });
    assert.equal(skipped.ok, true);
    assert.equal(skipped.recorded, false);
    assert.equal(existsSync(ledger), false);
    const missing = recordInvoiceSettlement({
      id: "in_missing",
      amount_paid: 18500,
      currency: "zar",
      metadata: { fulfillment_id: "missing-order" },
    });
    assert.equal(missing.ok, false);
    assert.equal(existsSync(ledger), false);
    const seeded = spawnSync("python3", ["-m", "domain.ledger"], {
      cwd: hub,
      input: JSON.stringify({
        commands: [
          { command: "specify_ingredient", args: { ingredient_id: "glycerin", inci: "Glycerin", cas: "56-81-5" } },
          { command: "qualify_supplier", args: { qualification_id: "qual-glycerin", supplier_name: "Inland Humectants", ingredient_id: "glycerin" } },
          { command: "receive_lot", args: { lot_id: "lot-glycerin", ingredient_id: "glycerin", qualification_id: "qual-glycerin", milligrams: 12000 } },
          { command: "define_formula", args: { formula_id: "cleanser", name: "Gentle cleanser", lines: [["glycerin", 12000]] } },
          { command: "catalog_sku", args: { sku_id: "sku-cleanser", formula_id: "cleanser", name: "Gentle cleanser" } },
          { command: "manufacture", args: { batch_id: "batch-cleanser", sku_id: "sku-cleanser", units: 1, allocations: [["glycerin", "lot-glycerin", 12000]] } },
          { command: "transfer", args: { transfer_id: "to-cape-town", sku_id: "sku-cleanser", batch_id: "batch-cleanser", source: "plant", destination: "cape-town", milligrams: 12000 } },
          { command: "fulfill", args: { fulfillment_id: "order-9:0:sku-cleanser", sku_id: "sku-cleanser", location: "cape-town", milligrams: 2000, kind: "retail" } },
          { command: "fulfill", args: { fulfillment_id: "order-intent:0:sku-cleanser", sku_id: "sku-cleanser", location: "cape-town", milligrams: 2000, kind: "retail" } },
          { command: "settle", args: { settlement_id: "pay-pi_1", fulfillment_id: "order-intent:0:sku-cleanser", amount_cents: 18500, currency: "ZAR" } },
          { command: "fulfill", args: { fulfillment_id: "order-pi-sale:0:sku-cleanser", sku_id: "sku-cleanser", location: "cape-town", milligrams: 2000, kind: "retail" } },
          { command: "settle", args: { settlement_id: "pay-explicit-pi", fulfillment_id: "order-pi-sale:0:sku-cleanser", amount_cents: 18500, currency: "ZAR" } },
          { command: "fulfill", args: { fulfillment_id: "order-pi-settle:0:sku-cleanser", sku_id: "sku-cleanser", location: "cape-town", milligrams: 2000, kind: "retail" } },
          { command: "settle", args: { settlement_id: "pay-snake-pi", fulfillment_id: "order-pi-settle:0:sku-cleanser", amount_cents: 18500, currency: "ZAR" } },
          { command: "fulfill", args: { fulfillment_id: "order-bait:0:sku-cleanser", sku_id: "sku-cleanser", location: "cape-town", milligrams: 2000, kind: "retail" } },
          { command: "settle", args: { settlement_id: "pay-pi_bait", fulfillment_id: "order-bait:0:sku-cleanser", amount_cents: 18500, currency: "ZAR" } },
          { command: "fulfill", args: { fulfillment_id: "order-kept:0:sku-cleanser", sku_id: "sku-cleanser", location: "cape-town", milligrams: 2000, kind: "retail" } },
          { command: "settle", args: { settlement_id: "pay-in_kept", fulfillment_id: "order-kept:0:sku-cleanser", amount_cents: 18500, currency: "ZAR" } },
        ],
      }),
      encoding: "utf8",
    });
    assert.equal(seeded.status, 0, seeded.stderr || seeded.stdout);
    const paid = recordInvoiceSettlement({
      id: "in_1",
      amount_paid: 18500,
      currency: "zar",
      metadata: { fulfillment_id: "order-9:0:sku-cleanser" },
    });
    assert.equal(paid.ok, true);
    assert.equal(paid.recorded, true);
    const recorded = readFileSync(ledger, "utf8");
    assert.match(recorded, /pay-in_1/);
    const again = recordInvoiceSettlement({
      id: "in_1",
      amount_paid: 18500,
      currency: "zar",
      metadata: { fulfillment_id: "order-9:0:sku-cleanser" },
    });
    assert.equal(again.ok, false);
    assert.equal(readFileSync(ledger, "utf8"), recorded);
    const open = acceptVoidedInvoiceReturn({ id: "in_1", status: "paid" });
    assert.equal(open.ok, true);
    assert.equal(open.count, 0);
    const missingReturn = acceptVoidedInvoiceReturn({
      id: "in_missing",
      status: "void",
      payment_intent: "pi_1",
      metadata: { fulfillment_id: "missing-order" },
    });
    assert.equal(missingReturn.ok, false);
    assert.equal(readFileSync(ledger, "utf8"), recorded);
    const absent = acceptVoidedInvoiceReturn({
      id: "in_1",
      status: "void",
      payment_intent: { id: "pi_1" },
      metadata: { settlement_id: "pay-absent" },
    });
    assert.equal(absent.ok, true);
    assert.equal(absent.count, 0);
    assert.equal(readFileSync(ledger, "utf8"), recorded);
    const returned = acceptVoidedInvoiceReturn({ id: "in_1", status: "void", payment_intent: "pi_1" });
    assert.equal(returned.ok, true, returned.error);
    assert.equal(returned.count, 1);
    const voided = readFileSync(ledger, "utf8");
    assert.match(voided, /return:in_1:order-9:0:sku-cleanser/);
    assert.equal(voided.includes("return:in_1:order-intent"), false);
    assert.equal(voided.includes("return:to-cape-town"), false);
    const voidAgain = acceptVoidedInvoiceReturn({ id: "in_1", status: "void", payment_intent: "pi_1" });
    assert.equal(voidAgain.ok, false);
    assert.equal(readFileSync(ledger, "utf8"), voided);
    const missingIntent = acceptVoidedInvoiceReturn({ id: "in_absent", status: "void", payment_intent: "pi_missing" });
    assert.equal(missingIntent.ok, true);
    assert.equal(missingIntent.count, 0);
    assert.equal(readFileSync(ledger, "utf8"), voided);
    const fromIntent = acceptVoidedInvoiceReturn({ id: "in_intent", status: "void", payment_intent: "pi_1" });
    assert.equal(fromIntent.ok, true, fromIntent.error);
    assert.equal(fromIntent.count, 1);
    const intentVoided = readFileSync(ledger, "utf8");
    assert.match(intentVoided, /return:in_intent:order-intent:0:sku-cleanser/);
    assert.equal(intentVoided.includes("return:in_intent:order-9"), false);
    assert.equal(intentVoided.includes("return:to-cape-town"), false);
    const intentAgain = acceptVoidedInvoiceReturn({ id: "in_intent", status: "void", payment_intent: { id: "pi_1" } });
    assert.equal(intentAgain.ok, false);
    assert.equal(readFileSync(ledger, "utf8"), intentVoided);
    const stopped = acceptVoidedInvoiceReturn({
      id: "in_pi",
      status: "void",
      metadata: { settlementId: "pay-absent" },
      payment_intent: { id: "pi_bait", metadata: { fulfillment_id: "order-pi-sale:0:sku-cleanser" } },
    });
    assert.equal(stopped.ok, true);
    assert.equal(stopped.count, 0);
    assert.equal(readFileSync(ledger, "utf8"), intentVoided);
    const missingNamed = acceptVoidedInvoiceReturn({
      id: "in_pi",
      status: "void",
      payment_intent: { id: "pi_bait", metadata: { fulfillment_id: "missing-order" } },
    });
    assert.equal(missingNamed.ok, false);
    assert.equal(readFileSync(ledger, "utf8"), intentVoided);
    const fromIntentSale = acceptVoidedInvoiceReturn({
      id: "in_kept",
      status: "void",
      payment_intent: {
        id: "pi_1",
        metadata: { fulfillment_id: "order-pi-sale:0:sku-cleanser", settlement_id: "pay-snake-pi" },
      },
    });
    assert.equal(fromIntentSale.ok, true, fromIntentSale.error);
    assert.equal(fromIntentSale.count, 1);
    const intentSaleVoided = readFileSync(ledger, "utf8");
    assert.match(intentSaleVoided, /return:in_kept:order-pi-sale:0:sku-cleanser/);
    assert.equal(intentSaleVoided.includes("return:in_kept:order-kept"), false);
    assert.equal(intentSaleVoided.includes("return:in_kept:order-pi-settle"), false);
    assert.equal(intentSaleVoided.includes("return:in_kept:order-bait"), false);
    assert.equal(intentSaleVoided.includes("return:to-cape-town"), false);
    const intentSaleAgain = acceptVoidedInvoiceReturn({
      id: "in_kept",
      status: "void",
      payment_intent: { id: "pi_1", metadata: { fulfillmentId: "order-pi-sale:0:sku-cleanser" } },
    });
    assert.equal(intentSaleAgain.ok, false);
    assert.equal(readFileSync(ledger, "utf8"), intentSaleVoided);
    const absentIntent = acceptVoidedInvoiceReturn({
      id: "in_other",
      status: "void",
      payment_intent: { id: "pi_bait", metadata: { settlement_id: "pay-absent" } },
    });
    assert.equal(absentIntent.ok, true);
    assert.equal(absentIntent.count, 0);
    assert.equal(readFileSync(ledger, "utf8"), intentSaleVoided);
    const fromIntentSettlement = acceptVoidedInvoiceReturn({
      id: "in_other",
      status: "void",
      payment_intent: { id: "pi_bait", metadata: { settlementId: "pay-snake-pi" } },
    });
    assert.equal(fromIntentSettlement.ok, true, fromIntentSettlement.error);
    assert.equal(fromIntentSettlement.count, 1);
    const intentSettlementVoided = readFileSync(ledger, "utf8");
    assert.match(intentSettlementVoided, /return:in_other:order-pi-settle:0:sku-cleanser/);
    assert.equal(intentSettlementVoided.includes("return:in_other:order-bait"), false);
    assert.equal(intentSettlementVoided.includes("return:in_other:order-pi-sale"), false);
    assert.equal(intentSettlementVoided.includes("return:in_other:order-kept"), false);
    assert.equal(intentSettlementVoided.includes("return:to-cape-town"), false);
    const intentSettlementAgain = acceptVoidedInvoiceReturn({
      id: "in_other",
      status: "void",
      payment_intent: { id: "pi_bait", metadata: { settlementId: "pay-snake-pi" } },
    });
    assert.equal(intentSettlementAgain.ok, false);
    assert.equal(readFileSync(ledger, "utf8"), intentSettlementVoided);
    const fromIntentId = acceptVoidedInvoiceReturn({
      id: "in_bait",
      status: "void",
      payment_intent: { id: "pi_bait" },
    });
    assert.equal(fromIntentId.ok, true, fromIntentId.error);
    assert.equal(fromIntentId.count, 1);
    const baitVoided = readFileSync(ledger, "utf8");
    assert.match(baitVoided, /return:in_bait:order-bait:0:sku-cleanser/);
    assert.equal(baitVoided.includes("return:in_bait:order-kept"), false);
    assert.equal(baitVoided.includes("return:to-cape-town"), false);
    const baitAgain = acceptVoidedInvoiceReturn({ id: "in_bait", status: "void", payment_intent: "pi_bait" });
    assert.equal(baitAgain.ok, false);
    assert.equal(readFileSync(ledger, "utf8"), baitVoided);
  } finally {
    if (previousLedger === undefined) delete process.env.SKINTWIN_CHAIN_LEDGER;
    else process.env.SKINTWIN_CHAIN_LEDGER = previousLedger;
    if (previousHub === undefined) delete process.env.SKINTWIN_HUB_ROOT;
    else process.env.SKINTWIN_HUB_ROOT = previousHub;
  }
});

test("a paid invoice settles each line that names a fulfillment", () => {
  const plain = {
    id: "in_lines",
    currency: "zar",
    lines: { data: [{ amount: 18500, metadata: { gift: "thanks" } }] },
  };
  assert.equal(paidInvoiceSettlement(plain), null);
  assert.deepEqual(paidInvoiceLineSettlements(plain), []);
  const named = {
    id: "in_lines",
    currency: "zar",
    metadata: { settlement_id: "pay-line" },
    lines: { data: [{ amount: 18500, metadata: { fulfillment_id: "order-9:0:sku-cleanser" } }] },
  };
  const one = paidInvoiceLineSettlements(named);
  assert.equal(one[0].settlementId, "pay-line");
  assert.equal(one[0].fulfillmentId, "order-9:0:sku-cleanser");
  assert.equal(one[0].amountCents, 18500);
  assert.equal(one[0].currency, "ZAR");
  const owned = {
    id: "in_lines",
    amount_paid: 9000,
    currency: "zar",
    metadata: { fulfillment_id: "order-9:0:sku-cleanser" },
    lines: { data: [{ amount: 18500, metadata: { fulfillment_id: "order-9:1:sku-cleanser" } }] },
  };
  assert.equal(paidInvoiceSettlement(owned).amountCents, 9000);
  assert.deepEqual(paidInvoiceLineSettlements(owned), []);
  const two = paidInvoiceLineSettlements({
    id: "in_two",
    currency: "zar",
    lines: {
      data: [
        { amount: 10000, metadata: { fulfillment_id: "order-9:0:sku-cleanser" } },
        { amount: 5000, metadata: { gift: "no" } },
        { amount: 8000, metadata: { fulfillment_id: "order-9:1:sku-cleanser" } },
        { amount: 2000, metadata: { fulfillment_id: "order-9:0:sku-cleanser" } },
      ],
    },
  });
  assert.deepEqual(
    two.map((payment) => [payment.fulfillmentId, payment.amountCents, payment.settlementId]),
    [
      ["order-9:0:sku-cleanser", 12000, "pay-in_two:0:order-9:0:sku-cleanser"],
      ["order-9:1:sku-cleanser", 8000, "pay-in_two:1:order-9:1:sku-cleanser"],
    ],
  );
  const dir = mkdtempSync(join(tmpdir(), "portal-invoice-lines-"));
  const ledger = join(dir, "supply-chain.jsonl");
  const locate = loadChainLocate();
  assert.ok(locate);
  const hub = locate.hubRoot();
  const previousLedger = process.env.SKINTWIN_CHAIN_LEDGER;
  const previousHub = process.env.SKINTWIN_HUB_ROOT;
  process.env.SKINTWIN_CHAIN_LEDGER = ledger;
  process.env.SKINTWIN_HUB_ROOT = hub;
  try {
    const skipped = recordInvoiceSettlement(plain);
    assert.equal(skipped.ok, true);
    assert.equal(skipped.recorded, false);
    assert.equal(existsSync(ledger), false);
    const broken = recordInvoiceSettlement({
      id: "in_bad",
      currency: "zar",
      lines: { data: [{ amount: 0, metadata: { fulfillment_id: "order-9:0:sku-cleanser" } }] },
    });
    assert.equal(broken.ok, false);
    assert.equal(existsSync(ledger), false);
    const seeded = spawnSync("python3", ["-m", "domain.ledger"], {
      cwd: hub,
      input: JSON.stringify({
        commands: [
          { command: "specify_ingredient", args: { ingredient_id: "glycerin", inci: "Glycerin", cas: "56-81-5" } },
          { command: "qualify_supplier", args: { qualification_id: "qual-glycerin", supplier_name: "Inland Humectants", ingredient_id: "glycerin" } },
          { command: "receive_lot", args: { lot_id: "lot-glycerin", ingredient_id: "glycerin", qualification_id: "qual-glycerin", milligrams: 5000 } },
          { command: "define_formula", args: { formula_id: "cleanser", name: "Gentle cleanser", lines: [["glycerin", 5000]] } },
          { command: "catalog_sku", args: { sku_id: "sku-cleanser", formula_id: "cleanser", name: "Gentle cleanser" } },
          { command: "manufacture", args: { batch_id: "batch-cleanser", sku_id: "sku-cleanser", units: 1, allocations: [["glycerin", "lot-glycerin", 5000]] } },
          { command: "transfer", args: { transfer_id: "to-cape-town", sku_id: "sku-cleanser", batch_id: "batch-cleanser", source: "plant", destination: "cape-town", milligrams: 5000 } },
          { command: "fulfill", args: { fulfillment_id: "order-9:0:sku-cleanser", sku_id: "sku-cleanser", location: "cape-town", milligrams: 2000, kind: "retail" } },
          { command: "fulfill", args: { fulfillment_id: "order-9:1:sku-cleanser", sku_id: "sku-cleanser", location: "cape-town", milligrams: 2000, kind: "retail" } },
        ],
      }),
      encoding: "utf8",
    });
    assert.equal(seeded.status, 0, seeded.stderr || seeded.stdout);
    const missing = recordInvoiceSettlement({
      id: "in_missing",
      currency: "zar",
      lines: {
        data: [
          { amount: 1000, metadata: { fulfillment_id: "order-9:0:sku-cleanser" } },
          { amount: 1000, metadata: { fulfillment_id: "missing-order" } },
        ],
      },
    });
    assert.equal(missing.ok, false);
    const before = readFileSync(ledger, "utf8");
    assert.equal(before.includes("pay-in_missing"), false);
    const paid = recordInvoiceSettlement({
      id: "in_two",
      currency: "zar",
      lines: {
        data: [
          { amount: 10000, metadata: { fulfillment_id: "order-9:0:sku-cleanser" } },
          { amount: 8000, metadata: { fulfillment_id: "order-9:1:sku-cleanser" } },
        ],
      },
    });
    assert.equal(paid.ok, true);
    assert.equal(paid.count, 2);
    const recorded = readFileSync(ledger, "utf8");
    assert.match(recorded, /pay-in_two:0:order-9:0:sku-cleanser/);
    assert.match(recorded, /pay-in_two:1:order-9:1:sku-cleanser/);
    const again = recordInvoiceSettlement({
      id: "in_two",
      currency: "zar",
      lines: {
        data: [
          { amount: 10000, metadata: { fulfillment_id: "order-9:0:sku-cleanser" } },
          { amount: 8000, metadata: { fulfillment_id: "order-9:1:sku-cleanser" } },
        ],
      },
    });
    assert.equal(again.ok, false);
    assert.equal(readFileSync(ledger, "utf8"), recorded);
    const returned = acceptVoidedInvoiceReturn({ id: "in_two", status: "void" });
    assert.equal(returned.ok, true, returned.error);
    assert.equal(returned.count, 2);
    const voided = readFileSync(ledger, "utf8");
    assert.match(voided, /return:in_two:order-9:0:sku-cleanser/);
    assert.match(voided, /return:in_two:order-9:1:sku-cleanser/);
    assert.equal(voided.includes("return:to-cape-town"), false);
    const voidAgain = acceptVoidedInvoiceReturn({ id: "in_two", status: "void" });
    assert.equal(voidAgain.ok, false);
    assert.equal(readFileSync(ledger, "utf8"), voided);
  } finally {
    if (previousLedger === undefined) delete process.env.SKINTWIN_CHAIN_LEDGER;
    else process.env.SKINTWIN_CHAIN_LEDGER = previousLedger;
    if (previousHub === undefined) delete process.env.SKINTWIN_HUB_ROOT;
    else process.env.SKINTWIN_HUB_ROOT = previousHub;
  }
});

test("a paid invoice settles the sale named on the line price", () => {
  const gift = {
    id: "in_price",
    currency: "zar",
    lines: { data: [{ amount: 18500, price: { id: "price_gift", metadata: { gift: "thanks" } } }] },
  };
  assert.deepEqual(paidInvoiceLineSettlements(gift), []);
  const unexpanded = {
    id: "in_price",
    currency: "zar",
    lines: { data: [{ amount: 18500, price: "price_123" }] },
  };
  assert.deepEqual(paidInvoiceLineSettlements(unexpanded), []);
  const owned = paidInvoiceLineSettlements({
    id: "in_price",
    currency: "zar",
    lines: {
      data: [
        {
          amount: 18500,
          metadata: { fulfillment_id: "order-9:0:sku-cleanser" },
          price: { metadata: { fulfillment_id: "order-9:1:sku-cleanser" } },
        },
      ],
    },
  });
  assert.equal(owned[0].fulfillmentId, "order-9:0:sku-cleanser");
  const priced = paidInvoiceLineSettlements({
    id: "in_price",
    currency: "usd",
    lines: {
      data: [
        { amount: 10000, price: { metadata: { fulfillmentId: " order-9:0:sku-cleanser " } } },
        { amount: 2000, plan: { metadata: { fulfillment_id: "order-9:0:sku-cleanser" } } },
        { amount: 8000, price: "price_plain", plan: { metadata: { fulfillment_id: "order-9:1:sku-cleanser" } } },
      ],
    },
  });
  assert.deepEqual(
    priced.map((payment) => [payment.fulfillmentId, payment.amountCents, payment.currency]),
    [
      ["order-9:0:sku-cleanser", 12000, "USD"],
      ["order-9:1:sku-cleanser", 8000, "USD"],
    ],
  );
  const dir = mkdtempSync(join(tmpdir(), "portal-invoice-price-"));
  const ledger = join(dir, "supply-chain.jsonl");
  const locate = loadChainLocate();
  assert.ok(locate);
  const hub = locate.hubRoot();
  const previousLedger = process.env.SKINTWIN_CHAIN_LEDGER;
  const previousHub = process.env.SKINTWIN_HUB_ROOT;
  process.env.SKINTWIN_CHAIN_LEDGER = ledger;
  process.env.SKINTWIN_HUB_ROOT = hub;
  try {
    const skipped = recordInvoiceSettlement(gift);
    assert.equal(skipped.ok, true);
    assert.equal(skipped.recorded, false);
    assert.equal(existsSync(ledger), false);
    const seeded = spawnSync("python3", ["-m", "domain.ledger"], {
      cwd: hub,
      input: JSON.stringify({
        commands: [
          { command: "specify_ingredient", args: { ingredient_id: "glycerin", inci: "Glycerin", cas: "56-81-5" } },
          { command: "qualify_supplier", args: { qualification_id: "qual-glycerin", supplier_name: "Inland Humectants", ingredient_id: "glycerin" } },
          { command: "receive_lot", args: { lot_id: "lot-glycerin", ingredient_id: "glycerin", qualification_id: "qual-glycerin", milligrams: 5000 } },
          { command: "define_formula", args: { formula_id: "cleanser", name: "Gentle cleanser", lines: [["glycerin", 5000]] } },
          { command: "catalog_sku", args: { sku_id: "sku-cleanser", formula_id: "cleanser", name: "Gentle cleanser" } },
          { command: "manufacture", args: { batch_id: "batch-cleanser", sku_id: "sku-cleanser", units: 1, allocations: [["glycerin", "lot-glycerin", 5000]] } },
          { command: "transfer", args: { transfer_id: "to-cape-town", sku_id: "sku-cleanser", batch_id: "batch-cleanser", source: "plant", destination: "cape-town", milligrams: 5000 } },
          { command: "fulfill", args: { fulfillment_id: "order-9:0:sku-cleanser", sku_id: "sku-cleanser", location: "cape-town", milligrams: 2000, kind: "retail" } },
        ],
      }),
      encoding: "utf8",
    });
    assert.equal(seeded.status, 0, seeded.stderr || seeded.stdout);
    const missing = recordInvoiceSettlement({
      id: "in_missing",
      currency: "zar",
      lines: { data: [{ amount: 1000, price: { metadata: { fulfillment_id: "missing-order" } } }] },
    });
    assert.equal(missing.ok, false);
    assert.equal(readFileSync(ledger, "utf8").includes("pay-in_missing"), false);
    const paid = recordInvoiceSettlement({
      id: "in_price",
      currency: "zar",
      lines: { data: [{ amount: 18500, price: { metadata: { fulfillment_id: "order-9:0:sku-cleanser" } } }] },
    });
    assert.equal(paid.ok, true);
    assert.equal(paid.recorded, true);
    const recorded = readFileSync(ledger, "utf8");
    assert.match(recorded, /pay-in_price/);
    const again = recordInvoiceSettlement({
      id: "in_price",
      currency: "zar",
      lines: { data: [{ amount: 18500, price: { metadata: { fulfillment_id: "order-9:0:sku-cleanser" } } }] },
    });
    assert.equal(again.ok, false);
    assert.equal(readFileSync(ledger, "utf8"), recorded);
  } finally {
    if (previousLedger === undefined) delete process.env.SKINTWIN_CHAIN_LEDGER;
    else process.env.SKINTWIN_CHAIN_LEDGER = previousLedger;
    if (previousHub === undefined) delete process.env.SKINTWIN_HUB_ROOT;
    else process.env.SKINTWIN_HUB_ROOT = previousHub;
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

test("a verified Paystack charge named by a blank reference records the charge id once", () => {
  const preferred = verifiedPaystackSettlement({
    status: "success",
    amount: 18500,
    currency: "NGN",
    reference: "ref-1",
    id: 99,
    metadata: { fulfillment_id: "order-9:0:sku-cleanser" },
  });
  assert.equal(preferred.settlementId, "pay-ref-1");
  const fallen = verifiedPaystackSettlement({
    status: "success",
    amount: 18500,
    currency: "NGN",
    reference: "  ",
    id: 99,
    metadata: { fulfillment_id: "order-9:0:sku-cleanser" },
  });
  assert.equal(fallen.settlementId, "pay-99");
  assert.equal(fallen.fulfillmentId, "order-9:0:sku-cleanser");
  const labeled = verifiedPaystackSettlement({
    status: "success",
    amount: 18500,
    currency: "NGN",
    reference: "  ",
    id: "  ",
    metadata: { fulfillment_id: "order-9:0:sku-cleanser" },
  });
  assert.equal(labeled.settlementId, "pay-order-9:0:sku-cleanser");
  assert.equal(
    verifiedPaystackSettlement({ status: "success", amount: 18500, reference: "  ", id: 99 }),
    null,
  );
  const dir = mkdtempSync(join(tmpdir(), "portal-paystack-id-"));
  const ledger = join(dir, "supply-chain.jsonl");
  const locate = loadChainLocate();
  assert.ok(locate);
  const hub = locate.hubRoot();
  const previousLedger = process.env.SKINTWIN_CHAIN_LEDGER;
  const previousHub = process.env.SKINTWIN_HUB_ROOT;
  process.env.SKINTWIN_CHAIN_LEDGER = ledger;
  process.env.SKINTWIN_HUB_ROOT = hub;
  try {
    assert.equal(existsSync(ledger), false);
    const seeded = spawnSync("python3", ["-m", "domain.ledger"], {
      cwd: hub,
      input: JSON.stringify({
        commands: [
          { command: "specify_ingredient", args: { ingredient_id: "glycerin", inci: "Glycerin", cas: "56-81-5" } },
          { command: "qualify_supplier", args: { qualification_id: "qual-glycerin", supplier_name: "Inland Humectants", ingredient_id: "glycerin" } },
          { command: "receive_lot", args: { lot_id: "lot-glycerin", ingredient_id: "glycerin", qualification_id: "qual-glycerin", milligrams: 5000 } },
          { command: "define_formula", args: { formula_id: "cleanser", name: "Gentle cleanser", lines: [["glycerin", 5000]] } },
          { command: "catalog_sku", args: { sku_id: "sku-cleanser", formula_id: "cleanser", name: "Gentle cleanser" } },
          { command: "manufacture", args: { batch_id: "batch-cleanser", sku_id: "sku-cleanser", units: 1, allocations: [["glycerin", "lot-glycerin", 5000]] } },
          { command: "transfer", args: { transfer_id: "to-cape-town", sku_id: "sku-cleanser", batch_id: "batch-cleanser", source: "plant", destination: "cape-town", milligrams: 5000 } },
          { command: "fulfill", args: { fulfillment_id: "order-9:0:sku-cleanser", sku_id: "sku-cleanser", location: "cape-town", milligrams: 2000, kind: "retail" } },
        ],
      }),
      encoding: "utf8",
    });
    assert.equal(seeded.status, 0, seeded.stderr || seeded.stdout);
    const paid = recordSettlement(fallen);
    assert.equal(paid.ok, true);
    assert.equal(paid.recorded, true);
    const recorded = readFileSync(ledger, "utf8");
    assert.match(recorded, /pay-99/);
    const again = recordSettlement(fallen);
    assert.equal(again.ok, false);
    assert.equal(readFileSync(ledger, "utf8"), recorded);
  } finally {
    if (previousLedger === undefined) delete process.env.SKINTWIN_CHAIN_LEDGER;
    else process.env.SKINTWIN_CHAIN_LEDGER = previousLedger;
    if (previousHub === undefined) delete process.env.SKINTWIN_HUB_ROOT;
    else process.env.SKINTWIN_HUB_ROOT = previousHub;
  }
});

test("a named sale with a blank currency records the next currency once", () => {
  const preferred = verifiedPaystackSettlement(
    {
      status: "success",
      amount: 18500,
      currency: "  ",
      reference: "ref-1",
      metadata: { fulfillment_id: "order-9:0:sku-cleanser", currency: "NGN" },
    },
    { currency: "ZAR" },
  );
  assert.equal(preferred.currency, "ZAR");
  const fallen = verifiedPaystackSettlement({
    status: "success",
    amount: 18500,
    currency: "  ",
    reference: "ref-zar",
    metadata: { fulfillment_id: "order-9:0:sku-cleanser", currency: " zar " },
  });
  assert.equal(fallen.currency, "zar");
  assert.equal(fallen.fulfillmentId, "order-9:0:sku-cleanser");
  const defaulted = verifiedPaystackSettlement({
    status: "success",
    amount: 18500,
    currency: "  ",
    reference: "ref-ngn",
    metadata: { fulfillment_id: "order-9:0:sku-cleanser", currency: "  " },
  });
  assert.equal(defaulted.currency, "NGN");
  assert.equal(
    verifiedPaystackSettlement({ status: "success", amount: 18500, currency: "  ", reference: "ref-1" }),
    null,
  );
  const intent = succeededPaymentIntentSettlement({
    id: "pi_blank",
    amount: 18500,
    currency: "  ",
    metadata: { fulfillment_id: "order-9:0:sku-cleanser" },
  });
  assert.equal(intent.currency, "USD");
  assert.equal(intent.fulfillmentId, "order-9:0:sku-cleanser");
  assert.equal(
    succeededPaymentIntentSettlement({ id: "pi_plain", amount: 18500, currency: "  " }),
    null,
  );
  assert.throws(
    () =>
      succeededPaymentIntentSettlement({
        id: "pi_bad",
        amount: 18500,
        currency: "US",
        metadata: { fulfillment_id: "order-9:0:sku-cleanser" },
      }),
    /currency must be a 3-letter code/,
  );
  const checkout = completedCheckoutSettlement({
    id: "cs_blank",
    amount_total: 18500,
    currency: "  ",
    metadata: { fulfillment_id: "order-9:0:sku-cleanser" },
  });
  assert.equal(checkout.currency, "USD");
  const invoice = paidInvoiceSettlement({
    id: "in_blank",
    amount_paid: 18500,
    currency: "  ",
    metadata: { fulfillment_id: "order-9:0:sku-cleanser" },
  });
  assert.equal(invoice.currency, "USD");
  assert.equal(
    settlementCommand({
      settlementId: "pay-blank",
      fulfillmentId: "order-9:0:sku-cleanser",
      amountCents: 18500,
      currency: "  ",
    }).args.currency,
    "USD",
  );
  assert.equal(
    settlementCommand({
      settlementId: "pay-zar",
      fulfillmentId: "order-9:0:sku-cleanser",
      amountCents: 18500,
      currency: " zar ",
    }).args.currency,
    "zar",
  );
  const dir = mkdtempSync(join(tmpdir(), "portal-currency-"));
  const ledger = join(dir, "supply-chain.jsonl");
  const locate = loadChainLocate();
  assert.ok(locate);
  const hub = locate.hubRoot();
  const previousLedger = process.env.SKINTWIN_CHAIN_LEDGER;
  const previousHub = process.env.SKINTWIN_HUB_ROOT;
  process.env.SKINTWIN_CHAIN_LEDGER = ledger;
  process.env.SKINTWIN_HUB_ROOT = hub;
  try {
    const unnamed = recordSettlement(
      verifiedPaystackSettlement({ status: "success", amount: 18500, currency: "  ", reference: "ref-1" }),
    );
    assert.equal(unnamed.ok, true);
    assert.equal(unnamed.recorded, false);
    assert.equal(existsSync(ledger), false);
    const rejected = recordPaymentIntentSettlement({
      id: "pi_bad",
      amount: 18500,
      currency: "US",
      metadata: { fulfillment_id: "order-9:0:sku-cleanser" },
    });
    assert.equal(rejected.ok, false);
    assert.equal(existsSync(ledger), false);
    const seeded = spawnSync("python3", ["-m", "domain.ledger"], {
      cwd: hub,
      input: JSON.stringify({
        commands: [
          { command: "specify_ingredient", args: { ingredient_id: "glycerin", inci: "Glycerin", cas: "56-81-5" } },
          { command: "qualify_supplier", args: { qualification_id: "qual-glycerin", supplier_name: "Inland Humectants", ingredient_id: "glycerin" } },
          { command: "receive_lot", args: { lot_id: "lot-glycerin", ingredient_id: "glycerin", qualification_id: "qual-glycerin", milligrams: 5000 } },
          { command: "define_formula", args: { formula_id: "cleanser", name: "Gentle cleanser", lines: [["glycerin", 5000]] } },
          { command: "catalog_sku", args: { sku_id: "sku-cleanser", formula_id: "cleanser", name: "Gentle cleanser" } },
          { command: "manufacture", args: { batch_id: "batch-cleanser", sku_id: "sku-cleanser", units: 1, allocations: [["glycerin", "lot-glycerin", 5000]] } },
          { command: "transfer", args: { transfer_id: "to-cape-town", sku_id: "sku-cleanser", batch_id: "batch-cleanser", source: "plant", destination: "cape-town", milligrams: 5000 } },
          { command: "fulfill", args: { fulfillment_id: "order-9:0:sku-cleanser", sku_id: "sku-cleanser", location: "cape-town", milligrams: 2000, kind: "retail" } },
        ],
      }),
      encoding: "utf8",
    });
    assert.equal(seeded.status, 0, seeded.stderr || seeded.stdout);
    const paid = recordSettlement(fallen);
    assert.equal(paid.ok, true);
    assert.equal(paid.recorded, true);
    const recorded = readFileSync(ledger, "utf8");
    assert.match(recorded, /pay-ref-zar/);
    assert.match(recorded, /"currency": "ZAR"/);
    const again = recordSettlement(fallen);
    assert.equal(again.ok, false);
    assert.equal(readFileSync(ledger, "utf8"), recorded);
  } finally {
    if (previousLedger === undefined) delete process.env.SKINTWIN_CHAIN_LEDGER;
    else process.env.SKINTWIN_CHAIN_LEDGER = previousLedger;
    if (previousHub === undefined) delete process.env.SKINTWIN_HUB_ROOT;
    else process.env.SKINTWIN_HUB_ROOT = previousHub;
  }
});

test("a payment intent named by a numeric captured amount settles that sale once", () => {
  const metadata = { fulfillment_id: "order-9:0:sku-cleanser", settlement_id: "pay-captured" };
  const captured = succeededPaymentIntentSettlement({
    id: "pi_text",
    amount: 100,
    amount_received: " 18500 ",
    currency: "usd",
    metadata,
  });
  assert.equal(settlementCommand(captured).args.amount_cents, 18500);
  const fallen = succeededPaymentIntentSettlement({
    id: "pi_word",
    amount: "18500",
    amount_received: "lots",
    currency: "usd",
    metadata,
  });
  assert.equal(settlementCommand(fallen).args.amount_cents, 18500);
  assert.equal(succeededPaymentIntentSettlement({ id: "pi_plain", amount_received: "18500", currency: "usd" }), null);
  assert.throws(
    () => succeededPaymentIntentSettlement({
      id: "pi_bad",
      amount: "lots",
      amount_received: "none",
      currency: "usd",
      metadata,
    }),
    /amount must be a positive integer/,
  );
  const dir = mkdtempSync(join(tmpdir(), "portal-intent-count-"));
  const ledger = join(dir, "supply-chain.jsonl");
  const locate = loadChainLocate();
  assert.ok(locate);
  const hub = locate.hubRoot();
  const previousLedger = process.env.SKINTWIN_CHAIN_LEDGER;
  const previousHub = process.env.SKINTWIN_HUB_ROOT;
  process.env.SKINTWIN_CHAIN_LEDGER = ledger;
  process.env.SKINTWIN_HUB_ROOT = hub;
  try {
    const unnamed = recordPaymentIntentSettlement({ id: "pi_plain", amount_received: "18500", currency: "usd" });
    assert.equal(unnamed.ok, true);
    assert.equal(unnamed.recorded, false);
    assert.equal(existsSync(ledger), false);
    const seeded = spawnSync("python3", ["-m", "domain.ledger"], {
      cwd: hub,
      input: JSON.stringify({
        commands: [
          { command: "specify_ingredient", args: { ingredient_id: "glycerin", inci: "Glycerin", cas: "56-81-5" } },
          { command: "qualify_supplier", args: { qualification_id: "qual-glycerin", supplier_name: "Inland Humectants", ingredient_id: "glycerin" } },
          { command: "receive_lot", args: { lot_id: "lot-glycerin", ingredient_id: "glycerin", qualification_id: "qual-glycerin", milligrams: 5000 } },
          { command: "define_formula", args: { formula_id: "cleanser", name: "Gentle cleanser", lines: [["glycerin", 5000]] } },
          { command: "catalog_sku", args: { sku_id: "sku-cleanser", formula_id: "cleanser", name: "Gentle cleanser" } },
          { command: "manufacture", args: { batch_id: "batch-cleanser", sku_id: "sku-cleanser", units: 1, allocations: [["glycerin", "lot-glycerin", 5000]] } },
          { command: "transfer", args: { transfer_id: "to-cape-town", sku_id: "sku-cleanser", batch_id: "batch-cleanser", source: "plant", destination: "cape-town", milligrams: 5000 } },
          { command: "fulfill", args: { fulfillment_id: "order-9:0:sku-cleanser", sku_id: "sku-cleanser", location: "cape-town", milligrams: 2000, kind: "retail" } },
        ],
      }),
      encoding: "utf8",
    });
    assert.equal(seeded.status, 0, seeded.stderr || seeded.stdout);
    const seededText = readFileSync(ledger, "utf8");
    const word = recordPaymentIntentSettlement({
      id: "pi_bad",
      amount: "lots",
      amount_received: "none",
      currency: "usd",
      metadata,
    });
    assert.equal(word.ok, false);
    assert.equal(readFileSync(ledger, "utf8"), seededText);
    const paid = recordPaymentIntentSettlement({
      id: "pi_text",
      amount: 100,
      amount_received: "18500",
      currency: "usd",
      metadata,
    });
    assert.equal(paid.ok, true, paid.error);
    assert.equal(paid.recorded, true);
    const recorded = readFileSync(ledger, "utf8");
    assert.match(recorded, /"amount_cents": 18500/);
    assert.match(recorded, /pay-captured/);
    const again = recordPaymentIntentSettlement({
      id: "pi_again",
      amount_received: "18500",
      currency: "usd",
      metadata,
    });
    assert.equal(again.ok, false);
    assert.equal(readFileSync(ledger, "utf8"), recorded);
  } finally {
    if (previousLedger === undefined) delete process.env.SKINTWIN_CHAIN_LEDGER;
    else process.env.SKINTWIN_CHAIN_LEDGER = previousLedger;
    if (previousHub === undefined) delete process.env.SKINTWIN_HUB_ROOT;
    else process.env.SKINTWIN_HUB_ROOT = previousHub;
  }
});

test("a succeeded payment settles the amount stored on that payment once", () => {
  const stored = { amount: " 185.00 ", currency: "zar" };
  const update = { id: 42, status: "succeeded", fulfillmentId: "order-9:0:sku-cleanser" };
  const named = settlementCommand(paymentForSettlement(update, stored));
  assert.equal(named.args.settlement_id, "pay-42");
  assert.equal(named.args.amount_cents, 18500);
  assert.equal(named.args.currency, "zar");
  const preferred = settlementCommand(paymentForSettlement({ ...update, amount: 10, settlementId: "pay-stated" }, stored));
  assert.equal(preferred.args.settlement_id, "pay-stated");
  assert.equal(preferred.args.amount_cents, 1000);
  assert.equal(recordSettlement({ id: 42, status: "succeeded", amount: "185.00" }).recorded, false);
  assert.throws(
    () => settlementCommand(paymentForSettlement(update, { amount: "lots", currency: "ZAR" })),
    /amount_cents is required/,
  );
  const dir = mkdtempSync(join(tmpdir(), "portal-stored-amount-"));
  const ledger = join(dir, "supply-chain.jsonl");
  const locate = loadChainLocate();
  assert.ok(locate);
  const hub = locate.hubRoot();
  const previousLedger = process.env.SKINTWIN_CHAIN_LEDGER;
  const previousHub = process.env.SKINTWIN_HUB_ROOT;
  process.env.SKINTWIN_CHAIN_LEDGER = ledger;
  process.env.SKINTWIN_HUB_ROOT = hub;
  try {
    const unnamed = recordSettlement(paymentForSettlement({ id: 42, status: "succeeded" }, stored));
    assert.equal(unnamed.ok, true);
    assert.equal(unnamed.recorded, false);
    assert.equal(existsSync(ledger), false);
    const seeded = spawnSync("python3", ["-m", "domain.ledger"], {
      cwd: hub,
      input: JSON.stringify({
        commands: [
          { command: "specify_ingredient", args: { ingredient_id: "glycerin", inci: "Glycerin", cas: "56-81-5" } },
          { command: "qualify_supplier", args: { qualification_id: "qual-glycerin", supplier_name: "Inland Humectants", ingredient_id: "glycerin" } },
          { command: "receive_lot", args: { lot_id: "lot-glycerin", ingredient_id: "glycerin", qualification_id: "qual-glycerin", milligrams: 5000 } },
          { command: "define_formula", args: { formula_id: "cleanser", name: "Gentle cleanser", lines: [["glycerin", 5000]] } },
          { command: "catalog_sku", args: { sku_id: "sku-cleanser", formula_id: "cleanser", name: "Gentle cleanser" } },
          { command: "manufacture", args: { batch_id: "batch-cleanser", sku_id: "sku-cleanser", units: 1, allocations: [["glycerin", "lot-glycerin", 5000]] } },
          { command: "transfer", args: { transfer_id: "to-cape-town", sku_id: "sku-cleanser", batch_id: "batch-cleanser", source: "plant", destination: "cape-town", milligrams: 5000 } },
          { command: "fulfill", args: { fulfillment_id: "order-9:0:sku-cleanser", sku_id: "sku-cleanser", location: "cape-town", milligrams: 2000, kind: "retail" } },
        ],
      }),
      encoding: "utf8",
    });
    assert.equal(seeded.status, 0, seeded.stderr || seeded.stdout);
    const seededText = readFileSync(ledger, "utf8");
    const word = recordSettlement(paymentForSettlement(update, { amount: "lots", currency: "ZAR" }));
    assert.equal(word.ok, false);
    assert.equal(readFileSync(ledger, "utf8"), seededText);
    const paid = recordSettlement(paymentForSettlement(update, stored));
    assert.equal(paid.ok, true, paid.error);
    assert.equal(paid.recorded, true);
    const recorded = readFileSync(ledger, "utf8");
    assert.match(recorded, /"amount_cents": 18500/);
    assert.match(recorded, /pay-42/);
    const again = recordSettlement(paymentForSettlement(update, stored));
    assert.equal(again.ok, false);
    assert.equal(readFileSync(ledger, "utf8"), recorded);
  } finally {
    if (previousLedger === undefined) delete process.env.SKINTWIN_CHAIN_LEDGER;
    else process.env.SKINTWIN_CHAIN_LEDGER = previousLedger;
    if (previousHub === undefined) delete process.env.SKINTWIN_HUB_ROOT;
    else process.env.SKINTWIN_HUB_ROOT = previousHub;
  }
});

test("a succeeded payment settles the sale stored on its order once", () => {
  const lines = [
    { id: 2, type: "product", sku: "sku-cleanser", total: " 185.00 " },
    { id: 1, type: "service", sku: "sku-facial", total: "50.00" },
  ];
  const payment = paymentForSettlement({ id: 42, status: "succeeded" }, { amount: "10.00", currency: "zar" });
  assert.deepEqual(orderSaleSettlements("order-9", lines, payment), [
    {
      id: 42,
      settlementId: "pay-42",
      fulfillmentId: "order-9:1:sku-cleanser",
      amount: " 185.00 ",
      currency: "zar",
    },
  ]);
  assert.deepEqual(orderSaleSettlements("order-9", [
    { id: 1, type: "product", sku: "sku-serum", total: "10.00" },
    { id: 2, type: "product", sku: "sku-cleanser", total: "185.00" },
  ], payment).map((sale) => sale.settlementId), [
    "pay-42:0:order-9:0:sku-serum",
    "pay-42:1:order-9:1:sku-cleanser",
  ]);
  assert.deepEqual(orderSaleSettlements("  ", lines, payment), []);
  assert.deepEqual(orderSaleSettlements("order-9", [{ type: "service", name: "Facial", total: "50.00" }], payment), []);
  assert.deepEqual(orderSaleSettlements("order-9", [{ type: "product", name: "Cleanser", total: "185.00" }], payment), []);
  assert.throws(
    () => orderSaleSettlements("order-9", [{ type: "product", sku: "sku-cleanser", total: "lots" }], payment),
    /amount_cents is required/,
  );
  const dir = mkdtempSync(join(tmpdir(), "portal-order-settle-"));
  const ledger = join(dir, "supply-chain.jsonl");
  const locate = loadChainLocate();
  assert.ok(locate);
  const hub = locate.hubRoot();
  const previousLedger = process.env.SKINTWIN_CHAIN_LEDGER;
  const previousHub = process.env.SKINTWIN_HUB_ROOT;
  process.env.SKINTWIN_CHAIN_LEDGER = ledger;
  process.env.SKINTWIN_HUB_ROOT = hub;
  try {
    const seeded = spawnSync("python3", ["-m", "domain.ledger"], {
      cwd: hub,
      input: JSON.stringify({
        commands: [
          { command: "specify_ingredient", args: { ingredient_id: "glycerin", inci: "Glycerin", cas: "56-81-5" } },
          { command: "qualify_supplier", args: { qualification_id: "qual-glycerin", supplier_name: "Inland Humectants", ingredient_id: "glycerin" } },
          { command: "receive_lot", args: { lot_id: "lot-glycerin", ingredient_id: "glycerin", qualification_id: "qual-glycerin", milligrams: 5000 } },
          { command: "define_formula", args: { formula_id: "cleanser", name: "Gentle cleanser", lines: [["glycerin", 5000]] } },
          { command: "catalog_sku", args: { sku_id: "sku-cleanser", formula_id: "cleanser", name: "Gentle cleanser" } },
          { command: "manufacture", args: { batch_id: "batch-cleanser", sku_id: "sku-cleanser", units: 1, allocations: [["glycerin", "lot-glycerin", 5000]] } },
          { command: "transfer", args: { transfer_id: "to-cape-town", sku_id: "sku-cleanser", batch_id: "batch-cleanser", source: "plant", destination: "cape-town", milligrams: 5000 } },
          { command: "fulfill", args: { fulfillment_id: "order-9:1:sku-cleanser", sku_id: "sku-cleanser", location: "cape-town", milligrams: 2000, kind: "retail" } },
        ],
      }),
      encoding: "utf8",
    });
    assert.equal(seeded.status, 0, seeded.stderr || seeded.stdout);
    const seededText = readFileSync(ledger, "utf8");
    const service = recordOrderSaleSettlements("order-9", [{ type: "service", name: "Facial", total: "50.00" }], payment);
    assert.equal(service.ok, true);
    assert.equal(service.recorded, false);
    const word = recordOrderSaleSettlements("order-9", [{ type: "product", sku: "sku-cleanser", total: "lots" }], payment);
    assert.equal(word.ok, false);
    assert.equal(readFileSync(ledger, "utf8"), seededText);
    const missing = recordOrderSaleSettlements("order-missing", [{ type: "product", sku: "sku-cleanser", total: "185.00" }], payment);
    assert.equal(missing.ok, false);
    assert.equal(readFileSync(ledger, "utf8"), seededText);
    const paid = recordOrderSaleSettlements("order-9", lines, payment);
    assert.equal(paid.ok, true, paid.error);
    assert.equal(paid.recorded, true);
    const recorded = readFileSync(ledger, "utf8");
    assert.match(recorded, /"fulfillment_id": "order-9:1:sku-cleanser"/);
    assert.match(recorded, /"amount_cents": 18500/);
    assert.match(recorded, /pay-42/);
    assert.match(recorded, /"currency": "ZAR"/);
    const again = recordOrderSaleSettlements("order-9", lines, payment);
    assert.equal(again.ok, false);
    assert.equal(readFileSync(ledger, "utf8"), recorded);
  } finally {
    if (previousLedger === undefined) delete process.env.SKINTWIN_CHAIN_LEDGER;
    else process.env.SKINTWIN_CHAIN_LEDGER = previousLedger;
    if (previousHub === undefined) delete process.env.SKINTWIN_HUB_ROOT;
    else process.env.SKINTWIN_HUB_ROOT = previousHub;
  }
});
