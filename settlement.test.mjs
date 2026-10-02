import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { loadChainLocate } from "./chain_stage.mjs";
import { completedCheckoutSettlement, paidInvoiceLineSettlements, paidInvoiceSettlement, paymentIntentMetadata, paystackInitializeMetadata, recordCheckoutSettlement, recordInvoiceSettlement, recordPaymentIntentSettlement, recordSettlement, settlementCommand, succeededPaymentIntentSettlement, verifiedPaystackSettlement } from "./settlement.mjs";

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
