import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { acceptOrderFulfillments, acceptShopifyCatalog, acceptTreatmentProducts, formulaIdFromShopify, fulfillmentCommands, handleStage, loadChainLocate, shopifyCatalogCommands, treatmentProductCommands } from "./chain_stage.mjs";

test("catalog command accepts a finished sku", () => {
  const result = handleStage({
    command: "catalog_sku",
    args: { sku_id: "sku-serum-c", formula_id: "serum-c", name: "Vitamin C serum" },
  });
  assert.equal(result.ok, true);
});

test("a product order draws stock and a service line does not", () => {
  const commands = fulfillmentCommands("order-9", [
    { type: "service", name: "Facial", sku: "svc-facial" },
    { type: "product", sku: "sku-serum-c", location: "cape-town", milligrams: 5000 },
  ]);
  assert.equal(commands.length, 1);
  assert.equal(commands[0].args.fulfillment_id, "order-9:1:sku-serum-c");
  assert.equal(commands[0].args.kind, "retail");
});

test("a sku without a location is not an order", () => {
  assert.throws(
    () => fulfillmentCommands("order-9", [{ type: "product", sku: "sku-serum-c", quantity: 1 }]),
    /location and milligrams/,
  );
});

test("a sku sale against an empty ledger is rejected", () => {
  const dir = mkdtempSync(join(tmpdir(), "portal-chain-"));
  const ledger = join(dir, "supply-chain.jsonl");
  const previousLedger = process.env.SKINTWIN_CHAIN_LEDGER;
  process.env.SKINTWIN_CHAIN_LEDGER = ledger;
  try {
    const result = handleStage({
      command: "fulfill",
      args: {
        fulfillment_id: "order-empty",
        sku_id: "sku-serum-c",
        location: "cape-town",
        milligrams: 100,
        kind: "retail",
      },
    });
    assert.equal(result.ok, false);
  } finally {
    if (previousLedger === undefined) delete process.env.SKINTWIN_CHAIN_LEDGER;
    else process.env.SKINTWIN_CHAIN_LEDGER = previousLedger;
  }
});

test("an order that overdraws does not keep the earlier line", () => {
  const dir = mkdtempSync(join(tmpdir(), "portal-order-"));
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
          { command: "transfer", args: { transfer_id: "xfer-cape-town:0", sku_id: "sku-cleanser", batch_id: "batch-cleanser", source: "plant", destination: "cape-town", milligrams: 5000 } },
        ],
      }),
      encoding: "utf8",
    });
    assert.equal(seeded.status, 0, seeded.stdout + seeded.stderr);
    const before = readFileSync(ledger, "utf8");
    const result = acceptOrderFulfillments("order-over", [
      { sku: "sku-cleanser", location: "cape-town", milligrams: 3000 },
      { sku: "sku-cleanser", location: "cape-town", milligrams: 3000 },
    ]);
    assert.equal(result.ok, false);
    assert.equal(readFileSync(ledger, "utf8"), before);
  } finally {
    if (previousLedger === undefined) delete process.env.SKINTWIN_CHAIN_LEDGER;
    else process.env.SKINTWIN_CHAIN_LEDGER = previousLedger;
    if (previousHub === undefined) delete process.env.SKINTWIN_HUB_ROOT;
    else process.env.SKINTWIN_HUB_ROOT = previousHub;
  }
});

test("treatment fulfillment requires a practitioner", () => {
  const result = handleStage({
    command: "fulfill",
    args: {
      fulfillment_id: "order-1",
      sku_id: "sku-serum-c",
      location: "cape-town",
      milligrams: 100,
      kind: "treatment",
    },
  });
  assert.equal(result.ok, false);
});

test("a treatment product list without a sku does not draw stock", () => {
  const commands = treatmentProductCommands("tx-1", [{ productId: 4, quantity: 1 }]);
  assert.equal(commands.length, 0);
  const skipped = acceptTreatmentProducts(undefined, [{ productId: 4, quantity: 1 }]);
  assert.equal(skipped.ok, true);
  assert.equal(skipped.count, 0);
});

test("a treatment product with a sku is a treatment fulfillment", () => {
  const commands = treatmentProductCommands(
    "tx-aya",
    [{ sku: "sku-serum-c", location: "cape-town", milligrams: 2000 }],
    "aya",
  );
  assert.equal(commands.length, 1);
  assert.equal(commands[0].args.kind, "treatment");
  assert.equal(commands[0].args.practitioner_id, "aya");
  assert.equal(commands[0].args.fulfillment_id, "tx-aya:0:sku-serum-c");
  const missing = acceptTreatmentProducts(undefined, [{ sku: "sku-serum-c", location: "cape-town", milligrams: 2000 }], "aya");
  assert.equal(missing.ok, false);
  assert.match(missing.error, /treatment reference/);
});

test("treatment products against an empty ledger are rejected", () => {
  const dir = mkdtempSync(join(tmpdir(), "portal-treatment-"));
  const ledger = join(dir, "supply-chain.jsonl");
  const previousLedger = process.env.SKINTWIN_CHAIN_LEDGER;
  process.env.SKINTWIN_CHAIN_LEDGER = ledger;
  try {
    const result = acceptTreatmentProducts(
      "tx-empty",
      [{ sku: "sku-serum-c", location: "cape-town", milligrams: 2000 }],
      "aya",
    );
    assert.equal(result.ok, false);
    assert.equal(existsSync(ledger) && readFileSync(ledger, "utf8").includes("tx-empty"), false);
  } finally {
    if (previousLedger === undefined) delete process.env.SKINTWIN_CHAIN_LEDGER;
    else process.env.SKINTWIN_CHAIN_LEDGER = previousLedger;
  }
});

test("a shopify product without a formula tag is not a catalog sku", () => {
  assert.equal(formulaIdFromShopify({ title: "Cleanser", tags: "retail, cleanser" }), null);
  const commands = shopifyCatalogCommands([
    { title: "Cleanser", tags: "retail", variants: [{ sku: "sku-cleanser" }] },
  ]);
  assert.equal(commands.length, 0);
  const skipped = acceptShopifyCatalog([{ title: "Cleanser", tags: "retail" }]);
  assert.equal(skipped.ok, true);
  assert.equal(skipped.count, 0);
});

test("a shopify formula tag becomes a catalog sku", () => {
  const commands = shopifyCatalogCommands([
    {
      title: "Vitamin C serum",
      tags: "retail, Formula:serum-c",
      variants: [{ sku: "sku-serum-c" }],
    },
  ]);
  assert.equal(commands.length, 1);
  assert.equal(commands[0].args.formula_id, "serum-c");
  assert.equal(commands[0].args.sku_id, "sku-serum-c");
  assert.equal(commands[0].args.name, "Vitamin C serum");
});

test("a shopify catalog batch leaves nothing when a formula is unknown", () => {
  const dir = mkdtempSync(join(tmpdir(), "portal-shopify-"));
  const ledger = join(dir, "supply-chain.jsonl");
  const locate = loadChainLocate();
  assert.ok(locate);
  const hub = locate.hubRoot();
  const previousLedger = process.env.SKINTWIN_CHAIN_LEDGER;
  const previousHub = process.env.SKINTWIN_HUB_ROOT;
  process.env.SKINTWIN_CHAIN_LEDGER = ledger;
  process.env.SKINTWIN_HUB_ROOT = hub;
  const seeded = spawnSync("python3", ["-m", "domain.ledger"], {
    cwd: hub,
    input: JSON.stringify({
      commands: [
        { command: "specify_ingredient", args: { ingredient_id: "glycerin", inci: "Glycerin", cas: "56-81-5" } },
        { command: "define_formula", args: { formula_id: "cleanser", name: "Gentle cleanser", lines: [["glycerin", 8000]] } },
      ],
    }),
    encoding: "utf8",
  });
  assert.equal(seeded.status, 0, seeded.stderr || seeded.stdout);
  const before = readFileSync(ledger, "utf8");
  try {
    const result = acceptShopifyCatalog([
      { title: "Gentle cleanser", tags: "formula:cleanser", variants: [{ sku: "sku-cleanser" }] },
      { title: "Unknown", tags: "formula:missing", variants: [{ sku: "sku-missing" }] },
    ]);
    assert.equal(result.ok, false);
    assert.equal(readFileSync(ledger, "utf8"), before);
  } finally {
    if (previousLedger === undefined) delete process.env.SKINTWIN_CHAIN_LEDGER;
    else process.env.SKINTWIN_CHAIN_LEDGER = previousLedger;
    if (previousHub === undefined) delete process.env.SKINTWIN_HUB_ROOT;
    else process.env.SKINTWIN_HUB_ROOT = previousHub;
  }
});
