import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { acceptBookingDelivery, acceptChargeReturn, acceptOrderFulfillments, acceptPaymentReturn, acceptPurchaseReceipt, acceptSaleReturn, acceptShopifyCatalog, acceptSupplierQualification, acceptTreatmentProducts, bookingDeliveryCommands, catalogProduct, chargeReturnCommands, formulaIdFromShopify, fulfillmentCommands, handleStage, loadChainLocate, paymentReturnCommands, purchaseReceiptCommands, saleReturnCommands, shopifyCatalogCommands, supplierQualificationCommands, treatmentProductCommands } from "./chain_stage.mjs";

test("catalog command accepts a finished sku", () => {
  const result = handleStage({
    command: "catalog_sku",
    args: { sku_id: "sku-serum-c", formula_id: "serum-c", name: "Vitamin C serum" },
  });
  assert.equal(result.ok, true);
});

test("a product named by formula_id is catalogued once", () => {
  const skipped = catalogProduct({ name: "Gentle cleanser", sku: "sku-cleanser", formula_id: " " });
  assert.equal(skipped.ok, true);
  assert.equal(skipped.recorded, false);
  const dir = mkdtempSync(join(tmpdir(), "portal-formula-id-"));
  const ledger = join(dir, "supply-chain.jsonl");
  const locate = loadChainLocate();
  assert.ok(locate);
  const hub = locate.hubRoot();
  const previousLedger = process.env.SKINTWIN_CHAIN_LEDGER;
  const previousHub = process.env.SKINTWIN_HUB_ROOT;
  process.env.SKINTWIN_CHAIN_LEDGER = ledger;
  process.env.SKINTWIN_HUB_ROOT = hub;
  try {
    const unnamed = catalogProduct({ name: "Shelf", sku: "sku-shelf" });
    assert.equal(unnamed.ok, true);
    assert.equal(unnamed.recorded, false);
    assert.equal(existsSync(ledger), false);
    const seeded = spawnSync("python3", ["-m", "domain.ledger"], {
      cwd: hub,
      input: JSON.stringify({
        commands: [
          { command: "specify_ingredient", args: { ingredient_id: "glycerin", inci: "Glycerin", cas: "56-81-5" } },
          { command: "define_formula", args: { formula_id: "cleanser", name: "Gentle cleanser", lines: [["glycerin", 5000]] } },
          { command: "define_formula", args: { formula_id: "serum-c", name: "Vitamin C serum", lines: [["glycerin", 2000]] } },
        ],
      }),
      encoding: "utf8",
    });
    assert.equal(seeded.status, 0, seeded.stderr || seeded.stdout);
    const recorded = catalogProduct({ name: "Gentle cleanser", sku: "sku-cleanser", formula_id: " cleanser " });
    assert.equal(recorded.ok, true);
    const preferred = catalogProduct({
      name: "Vitamin C serum",
      sku: "sku-serum",
      formulaId: "serum-c",
      formula_id: "cleanser",
    });
    assert.equal(preferred.ok, true);
    const text = readFileSync(ledger, "utf8");
    const catalogs = text.trim().split("\n").map((line) => JSON.parse(line)).filter((row) => row.command === "catalog_sku");
    assert.deepEqual(catalogs.map((row) => [row.args.sku_id, row.args.formula_id]), [
      ["sku-cleanser", "cleanser"],
      ["sku-serum", "serum-c"],
    ]);
    const again = catalogProduct({ name: "Gentle cleanser", sku: "sku-cleanser", formula_id: "cleanser" });
    assert.equal(again.ok, false);
    assert.equal(readFileSync(ledger, "utf8"), text);
    const missing = catalogProduct({ name: "Missing", sku: "sku-missing", formula_id: "missing" });
    assert.equal(missing.ok, false);
    assert.equal(readFileSync(ledger, "utf8"), text);
  } finally {
    if (previousLedger === undefined) delete process.env.SKINTWIN_CHAIN_LEDGER;
    else process.env.SKINTWIN_CHAIN_LEDGER = previousLedger;
    if (previousHub === undefined) delete process.env.SKINTWIN_HUB_ROOT;
    else process.env.SKINTWIN_HUB_ROOT = previousHub;
  }
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

test("a treatment named by sku_id draws that product once", () => {
  const named = treatmentProductCommands("tx-1", [
    { sku_id: "sku-cleanser", location: "cape-town", milligrams: 2000, practitioner_id: "aya" },
    { sku: "sku-serum-c", sku_id: "sku-other", location: "cape-town", milligrams: 1000, practitionerId: "nia" },
    { productId: 4, quantity: 1 },
  ]);
  assert.equal(named.length, 2);
  assert.equal(named[0].args.fulfillment_id, "tx-1:0:sku-cleanser");
  assert.equal(named[0].args.sku_id, "sku-cleanser");
  assert.equal(named[0].args.practitioner_id, "aya");
  assert.equal(named[0].args.kind, "treatment");
  assert.equal(named[1].args.sku_id, "sku-serum-c");
  assert.equal(named[1].args.practitioner_id, "nia");
  const retail = fulfillmentCommands("order-9", [
    { type: "service", sku_id: "svc-facial", location: "cape-town", milligrams: 1000 },
    { skuId: "sku-cleanser", location: "cape-town", milligrams: 2000 },
  ]);
  assert.equal(retail.length, 1);
  assert.equal(retail[0].args.fulfillment_id, "order-9:1:sku-cleanser");
  assert.equal(retail[0].args.kind, "retail");
  assert.throws(
    () => treatmentProductCommands("tx-1", [{ sku_id: "sku-cleanser" }]),
    /location and milligrams/,
  );
  const dir = mkdtempSync(join(tmpdir(), "portal-sku-id-"));
  const ledger = join(dir, "supply-chain.jsonl");
  const locate = loadChainLocate();
  assert.ok(locate);
  const hub = locate.hubRoot();
  const previousLedger = process.env.SKINTWIN_CHAIN_LEDGER;
  const previousHub = process.env.SKINTWIN_HUB_ROOT;
  process.env.SKINTWIN_CHAIN_LEDGER = ledger;
  process.env.SKINTWIN_HUB_ROOT = hub;
  try {
    const unnamed = acceptTreatmentProducts("tx-1", [{ productId: 4 }]);
    assert.equal(unnamed.ok, true);
    assert.equal(unnamed.count, 0);
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
          { command: "transfer", args: { transfer_id: "xfer-cape-town", sku_id: "sku-cleanser", batch_id: "batch-cleanser", source: "plant", destination: "cape-town", milligrams: 2000 } },
          { command: "certify_practitioner", args: { certificate_id: "cert-aya", practitioner_id: "aya", course: "Facial protocol" } },
        ],
      }),
      encoding: "utf8",
    });
    assert.equal(seeded.status, 0, seeded.stderr || seeded.stdout);
    const drawn = acceptTreatmentProducts("tx-1", [
      { sku_id: "sku-cleanser", location: "cape-town", milligrams: 2000, practitioner_id: "aya" },
    ]);
    assert.equal(drawn.ok, true);
    assert.equal(drawn.count, 1);
    const text = readFileSync(ledger, "utf8");
    assert.equal(text.includes('"fulfillment_id": "tx-1:0:sku-cleanser"'), true);
    const again = acceptTreatmentProducts("tx-1", [
      { sku_id: "sku-cleanser", location: "cape-town", milligrams: 2000, practitioner_id: "aya" },
    ]);
    assert.equal(again.ok, false);
    assert.equal(readFileSync(ledger, "utf8"), text);
  } finally {
    if (previousLedger === undefined) delete process.env.SKINTWIN_CHAIN_LEDGER;
    else process.env.SKINTWIN_CHAIN_LEDGER = previousLedger;
    if (previousHub === undefined) delete process.env.SKINTWIN_HUB_ROOT;
    else process.env.SKINTWIN_HUB_ROOT = previousHub;
  }
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

test("each shopify variant sku of a formula is catalogued once", () => {
  const commands = shopifyCatalogCommands([
    {
      title: "Gentle cleanser",
      tags: "formula:cleanser",
      variants: [{ sku: "sku-cleanser-30" }, { sku: " " }, { sku: "sku-cleanser-30" }, { sku: "sku-cleanser-50" }],
    },
  ]);
  assert.deepEqual(commands.map((command) => command.args.sku_id), ["sku-cleanser-30", "sku-cleanser-50"]);
  const fallback = shopifyCatalogCommands([
    { title: "Gentle cleanser", tags: "formula:cleanser", variants: [{ sku: " " }] },
  ]);
  assert.equal(fallback[0].args.sku_id, "Gentle cleanser");
  const dir = mkdtempSync(join(tmpdir(), "portal-catalog-variants-"));
  const ledger = join(dir, "supply-chain.jsonl");
  const locate = loadChainLocate();
  assert.ok(locate);
  const hub = locate.hubRoot();
  const previousLedger = process.env.SKINTWIN_CHAIN_LEDGER;
  const previousHub = process.env.SKINTWIN_HUB_ROOT;
  process.env.SKINTWIN_CHAIN_LEDGER = ledger;
  process.env.SKINTWIN_HUB_ROOT = hub;
  const product = {
    title: "Gentle cleanser",
    tags: "formula:cleanser",
    variants: [{ sku: "sku-cleanser-30" }, { sku: "sku-cleanser-50" }],
  };
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
  try {
    const unnamed = acceptShopifyCatalog([{ title: "Cleanser", tags: "retail", variants: [{ sku: "sku-a" }, { sku: "sku-b" }] }]);
    assert.equal(unnamed.ok, true);
    assert.equal(unnamed.count, 0);
    const first = acceptShopifyCatalog([product]);
    assert.equal(first.ok, true);
    assert.equal(first.count, 2);
    const recorded = readFileSync(ledger, "utf8");
    assert.equal(recorded.split("sku-cleanser-30").length - 1, 1);
    assert.equal(recorded.split("sku-cleanser-50").length - 1, 1);
    const again = acceptShopifyCatalog([product]);
    assert.equal(again.ok, true);
    assert.equal(again.count, 0);
    assert.equal(readFileSync(ledger, "utf8"), recorded);
  } finally {
    if (previousLedger === undefined) delete process.env.SKINTWIN_CHAIN_LEDGER;
    else process.env.SKINTWIN_CHAIN_LEDGER = previousLedger;
    if (previousHub === undefined) delete process.env.SKINTWIN_HUB_ROOT;
    else process.env.SKINTWIN_HUB_ROOT = previousHub;
  }
});

test("a variant formula metafield catalogs that sku once", () => {
  const owned = shopifyCatalogCommands([
    {
      title: "Vitamin C serum",
      formula_id: "serum-c",
      variants: [{ sku: "sku-serum-c", metafields: [{ key: "formula_id", value: "cleanser" }] }],
    },
  ]);
  assert.equal(owned[0].args.formula_id, "serum-c");
  const product = {
    title: "Shelf",
    tags: "retail",
    variants: [
      { sku: "sku-cleanser", metafields: [{ key: "gift", value: "thanks" }, { key: "formula_id", value: " cleanser " }] },
      { sku: "sku-plain" },
      { sku: "sku-serum", formula_id: "serum-c", metafields: [{ key: "formula_id", value: "other" }] },
      { sku: "sku-cleanser", metafields: [{ key: "formula_id", value: "other" }] },
    ],
  };
  const commands = shopifyCatalogCommands([product]);
  assert.deepEqual(
    commands.map((command) => [command.args.sku_id, command.args.formula_id]),
    [["sku-cleanser", "cleanser"], ["sku-serum", "serum-c"]],
  );
  assert.equal(shopifyCatalogCommands([{ title: "Shelf", tags: "retail", variants: [{ sku: "sku-plain" }] }]).length, 0);
  const dir = mkdtempSync(join(tmpdir(), "portal-variant-formula-"));
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
        { command: "define_formula", args: { formula_id: "serum-c", name: "Vitamin C serum", lines: [["glycerin", 2000]] } },
      ],
    }),
    encoding: "utf8",
  });
  assert.equal(seeded.status, 0, seeded.stderr || seeded.stdout);
  try {
    const unnamed = acceptShopifyCatalog([{ title: "Shelf", tags: "retail", variants: [{ sku: "sku-plain" }] }]);
    assert.equal(unnamed.ok, true);
    assert.equal(unnamed.count, 0);
    const first = acceptShopifyCatalog([product]);
    assert.equal(first.ok, true);
    assert.equal(first.count, 2);
    const recorded = readFileSync(ledger, "utf8");
    assert.equal(recorded.includes("sku-plain"), false);
    const again = acceptShopifyCatalog([product]);
    assert.equal(again.ok, true);
    assert.equal(again.count, 0);
    assert.equal(readFileSync(ledger, "utf8"), recorded);
  } finally {
    if (previousLedger === undefined) delete process.env.SKINTWIN_CHAIN_LEDGER;
    else process.env.SKINTWIN_CHAIN_LEDGER = previousLedger;
    if (previousHub === undefined) delete process.env.SKINTWIN_HUB_ROOT;
    else process.env.SKINTWIN_HUB_ROOT = previousHub;
  }
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

test("a repeated shopify formula tag catalogs the sku once", () => {
  const dir = mkdtempSync(join(tmpdir(), "portal-catalog-repeat-"));
  const ledger = join(dir, "supply-chain.jsonl");
  const locate = loadChainLocate();
  assert.ok(locate);
  const hub = locate.hubRoot();
  const previousLedger = process.env.SKINTWIN_CHAIN_LEDGER;
  const previousHub = process.env.SKINTWIN_HUB_ROOT;
  process.env.SKINTWIN_CHAIN_LEDGER = ledger;
  process.env.SKINTWIN_HUB_ROOT = hub;
  const product = { title: "Gentle cleanser", tags: "formula:cleanser", variants: [{ sku: "sku-cleanser" }] };
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
  try {
    const first = acceptShopifyCatalog([product, { title: "Cleanser", tags: "retail" }]);
    assert.equal(first.ok, true);
    assert.equal(first.count, 1);
    const recorded = readFileSync(ledger, "utf8");
    assert.equal(recorded.split("sku-cleanser").length - 1, 1);
    const again = acceptShopifyCatalog([product]);
    assert.equal(again.ok, true);
    assert.equal(again.count, 0);
    assert.equal(readFileSync(ledger, "utf8"), recorded);
    const renamed = acceptShopifyCatalog([{ ...product, title: "Renamed cleanser" }]);
    assert.equal(renamed.ok, false);
    assert.equal(readFileSync(ledger, "utf8"), recorded);
  } finally {
    if (previousLedger === undefined) delete process.env.SKINTWIN_CHAIN_LEDGER;
    else process.env.SKINTWIN_CHAIN_LEDGER = previousLedger;
    if (previousHub === undefined) delete process.env.SKINTWIN_HUB_ROOT;
    else process.env.SKINTWIN_HUB_ROOT = previousHub;
  }
});

test("a received purchase order records materials and packaging", () => {
  const commands = purchaseReceiptCommands("PO-14", [
    { name: "Retail serum", productId: 3, quantity: 2 },
    { ingredientId: "glycerin", qualificationId: "qual-glycerin", quantityKg: 0.02 },
    { componentId: "tube-cleanser", name: "Cleanser tube", supplierName: "Joburg Tubes", pieces: 3 },
  ]);
  assert.equal(commands.length, 2);
  assert.equal(commands[0].command, "receive_lot");
  assert.equal(commands[0].args.lot_id, "PO-14:1:glycerin");
  assert.equal(commands[0].args.milligrams, 20000);
  assert.equal(commands[1].command, "receive_package");
  assert.equal(commands[1].args.lot_id, "PO-14:2:tube-cleanser");
  assert.equal(commands[1].args.pieces, 3);
  assert.equal(commands[1].args.supplier_name, "Joburg Tubes");
});

test("an ingredient receipt without a quantity is rejected", () => {
  assert.throws(
    () => purchaseReceiptCommands("PO-14", [{ ingredientId: "glycerin", qualificationId: "qual-glycerin" }]),
    /milligrams/,
  );
});

test("a qualified ingredient receipt is appended once", () => {
  const dir = mkdtempSync(join(tmpdir(), "portal-receipt-ok-"));
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
        ],
      }),
      encoding: "utf8",
    });
    assert.equal(seeded.status, 0, seeded.stdout + seeded.stderr);
    const result = acceptPurchaseReceipt("PO-14", [
      { ingredientId: "glycerin", qualificationId: "qual-glycerin", milligrams: 20000 },
      { ingredientId: "glycerin" },
    ]);
    assert.equal(result.ok, false);
    assert.equal(readFileSync(ledger, "utf8").includes("PO-14"), false);
    const received = acceptPurchaseReceipt("PO-14", [
      { ingredientId: "glycerin", qualificationId: "qual-glycerin", milligrams: 20000 },
    ]);
    assert.equal(received.ok, true);
    assert.equal(received.count, 1);
    assert.match(readFileSync(ledger, "utf8"), /PO-14:0:glycerin/);
  } finally {
    if (previousLedger === undefined) delete process.env.SKINTWIN_CHAIN_LEDGER;
    else process.env.SKINTWIN_CHAIN_LEDGER = previousLedger;
    if (previousHub === undefined) delete process.env.SKINTWIN_HUB_ROOT;
    else process.env.SKINTWIN_HUB_ROOT = previousHub;
  }
});

test("a received purchase order against an empty ledger writes nothing", () => {
  const dir = mkdtempSync(join(tmpdir(), "portal-receipt-"));
  const ledger = join(dir, "supply-chain.jsonl");
  const previousLedger = process.env.SKINTWIN_CHAIN_LEDGER;
  process.env.SKINTWIN_CHAIN_LEDGER = ledger;
  try {
    const finished = acceptPurchaseReceipt("PO-14", [{ name: "Retail serum" }]);
    assert.equal(finished.ok, true);
    assert.equal(finished.count, 0);
    assert.equal(existsSync(ledger), false);
    const result = acceptPurchaseReceipt("PO-14", [
      { ingredientId: "glycerin", qualificationId: "qual-glycerin", milligrams: 20000 },
    ]);
    assert.equal(result.ok, false);
    assert.equal(existsSync(ledger), false);
  } finally {
    if (previousLedger === undefined) delete process.env.SKINTWIN_CHAIN_LEDGER;
    else process.env.SKINTWIN_CHAIN_LEDGER = previousLedger;
  }
});

test("a supplier named for an ingredient is qualified once", () => {
  assert.equal(supplierQualificationCommands({ name: "Inland Humectants" }).length, 0);
  const commands = supplierQualificationCommands({
    name: "Inland Humectants",
    ingredientId: "glycerin",
  });
  assert.equal(commands[0].args.qualification_id, "qual:glycerin:Inland Humectants");
  assert.equal(commands[0].args.ingredient_id, "glycerin");
  const dir = mkdtempSync(join(tmpdir(), "portal-supplier-"));
  const ledger = join(dir, "supply-chain.jsonl");
  const locate = loadChainLocate();
  assert.ok(locate);
  const hub = locate.hubRoot();
  const previousLedger = process.env.SKINTWIN_CHAIN_LEDGER;
  const previousHub = process.env.SKINTWIN_HUB_ROOT;
  process.env.SKINTWIN_CHAIN_LEDGER = ledger;
  process.env.SKINTWIN_HUB_ROOT = hub;
  try {
    const missing = acceptSupplierQualification({ name: "Inland Humectants", ingredientId: "glycerin" });
    assert.equal(missing.ok, false);
    assert.equal(existsSync(ledger), false);
    const seeded = spawnSync("python3", ["-m", "domain.ledger"], {
      cwd: hub,
      input: JSON.stringify({
        commands: [
          { command: "specify_ingredient", args: { ingredient_id: "glycerin", inci: "Glycerin", cas: "56-81-5" } },
        ],
      }),
      encoding: "utf8",
    });
    assert.equal(seeded.status, 0, seeded.stderr || seeded.stdout);
    const qualified = acceptSupplierQualification({ name: "Inland Humectants", ingredientId: "glycerin" });
    assert.equal(qualified.ok, true);
    assert.equal(qualified.count, 1);
    const recorded = readFileSync(ledger, "utf8");
    assert.match(recorded, /qual:glycerin:Inland Humectants/);
    const again = acceptSupplierQualification({ name: "Inland Humectants", ingredientId: "glycerin" });
    assert.equal(again.ok, false);
    assert.equal(readFileSync(ledger, "utf8"), recorded);
  } finally {
    if (previousLedger === undefined) delete process.env.SKINTWIN_CHAIN_LEDGER;
    else process.env.SKINTWIN_CHAIN_LEDGER = previousLedger;
    if (previousHub === undefined) delete process.env.SKINTWIN_HUB_ROOT;
    else process.env.SKINTWIN_HUB_ROOT = previousHub;
  }
});

test("a completed booking without a delivery does not move stock", () => {
  assert.equal(bookingDeliveryCommands(4, null).length, 0);
  const skipped = acceptBookingDelivery(4, null);
  assert.equal(skipped.ok, true);
  assert.equal(skipped.count, 0);
  assert.throws(
    () => bookingDeliveryCommands(4, {
      skuId: "sku-cleanser",
      batchId: "batch-cleanser",
      source: "plant",
      destination: "plant",
      milligrams: 2000,
    }),
    /must differ/,
  );
});

test("a completed booking moves the named delivery once", () => {
  const commands = bookingDeliveryCommands(4, {
    skuId: "sku-cleanser",
    batchId: "batch-cleanser",
    source: "plant",
    destination: "cape-town",
    milligrams: 2000,
  });
  assert.equal(commands.length, 1);
  assert.equal(commands[0].args.transfer_id, "booking:4");
  const dir = mkdtempSync(join(tmpdir(), "portal-booking-"));
  const ledger = join(dir, "supply-chain.jsonl");
  const locate = loadChainLocate();
  assert.ok(locate);
  const hub = locate.hubRoot();
  const previousLedger = process.env.SKINTWIN_CHAIN_LEDGER;
  const previousHub = process.env.SKINTWIN_HUB_ROOT;
  process.env.SKINTWIN_CHAIN_LEDGER = ledger;
  process.env.SKINTWIN_HUB_ROOT = hub;
  try {
    const empty = acceptBookingDelivery("9", {
      skuId: "sku-cleanser",
      batchId: "batch-cleanser",
      source: "plant",
      destination: "cape-town",
      milligrams: 2000,
    });
    assert.equal(empty.ok, false);
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
        ],
      }),
      encoding: "utf8",
    });
    assert.equal(seeded.status, 0, seeded.stderr || seeded.stdout);
    const moved = acceptBookingDelivery("9", {
      skuId: "sku-cleanser",
      batchId: "batch-cleanser",
      source: "plant",
      destination: "cape-town",
      milligrams: 2000,
    });
    assert.equal(moved.ok, true);
    assert.equal(moved.count, 1);
    const recorded = readFileSync(ledger, "utf8");
    assert.match(recorded, /booking:9/);
    const again = acceptBookingDelivery("9", {
      skuId: "sku-cleanser",
      batchId: "batch-cleanser",
      source: "plant",
      destination: "cape-town",
      milligrams: 4000,
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

test("a refunded sale puts the product back once", () => {
  assert.equal(saleReturnCommands("return-1", "").length, 0);
  const skipped = acceptSaleReturn("return-1", "");
  assert.equal(skipped.ok, true);
  assert.equal(skipped.count, 0);
  const dir = mkdtempSync(join(tmpdir(), "portal-return-"));
  const ledger = join(dir, "supply-chain.jsonl");
  const locate = loadChainLocate();
  assert.ok(locate);
  const hub = locate.hubRoot();
  const previousLedger = process.env.SKINTWIN_CHAIN_LEDGER;
  const previousHub = process.env.SKINTWIN_HUB_ROOT;
  process.env.SKINTWIN_CHAIN_LEDGER = ledger;
  process.env.SKINTWIN_HUB_ROOT = hub;
  try {
    const missing = acceptSaleReturn("return-1", "order-9:0:sku-cleanser");
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
    const returned = acceptSaleReturn("return-1", "order-9:0:sku-cleanser");
    assert.equal(returned.ok, true);
    assert.equal(returned.count, 1);
    const recorded = readFileSync(ledger, "utf8");
    assert.match(recorded, /return-1/);
    const again = acceptSaleReturn("return-1", "order-9:0:sku-cleanser");
    assert.equal(again.ok, false);
    assert.equal(readFileSync(ledger, "utf8"), recorded);
  } finally {
    if (previousLedger === undefined) delete process.env.SKINTWIN_CHAIN_LEDGER;
    else process.env.SKINTWIN_CHAIN_LEDGER = previousLedger;
    if (previousHub === undefined) delete process.env.SKINTWIN_HUB_ROOT;
    else process.env.SKINTWIN_HUB_ROOT = previousHub;
  }
});

test("a refunded payment returns the sale it names", () => {
  const fulfillmentId = "order-9:0:sku-cleanser";
  assert.deepEqual(paymentReturnCommands({ status: "succeeded", id: 3, fulfillmentId }), []);
  assert.deepEqual(paymentReturnCommands({ status: "partially_refunded", id: 3, fulfillmentId }), []);
  assert.deepEqual(paymentReturnCommands({ status: "refunded", id: 3 }), []);
  assert.deepEqual(paymentReturnCommands({ status: "refunded", id: 3, fulfillmentId }), [
    {
      command: "return_sale",
      args: { return_id: `return:3:${fulfillmentId}`, fulfillment_id: fulfillmentId },
    },
  ]);
  const skipped = acceptPaymentReturn({ status: "refunded", id: 3 });
  assert.equal(skipped.ok, true);
  assert.equal(skipped.count, 0);
  const dir = mkdtempSync(join(tmpdir(), "portal-payment-return-"));
  const ledger = join(dir, "supply-chain.jsonl");
  const locate = loadChainLocate();
  assert.ok(locate);
  const hub = locate.hubRoot();
  const previousLedger = process.env.SKINTWIN_CHAIN_LEDGER;
  const previousHub = process.env.SKINTWIN_HUB_ROOT;
  process.env.SKINTWIN_CHAIN_LEDGER = ledger;
  process.env.SKINTWIN_HUB_ROOT = hub;
  try {
    const missing = acceptPaymentReturn({ status: "refunded", id: 3, fulfillmentId });
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
          { command: "fulfill", args: { fulfillment_id: fulfillmentId, sku_id: "sku-cleanser", location: "cape-town", milligrams: 2000, kind: "retail" } },
        ],
      }),
      encoding: "utf8",
    });
    assert.equal(seeded.status, 0, seeded.stderr || seeded.stdout);
    const returned = acceptPaymentReturn({ status: "refunded", id: 3, fulfillmentId });
    assert.equal(returned.ok, true);
    assert.equal(returned.count, 1);
    const recorded = readFileSync(ledger, "utf8");
    assert.match(recorded, /return:3:order-9:0:sku-cleanser/);
    const again = acceptPaymentReturn({ status: "refunded", id: 3, fulfillmentId });
    assert.equal(again.ok, false);
    assert.equal(readFileSync(ledger, "utf8"), recorded);
  } finally {
    if (previousLedger === undefined) delete process.env.SKINTWIN_CHAIN_LEDGER;
    else process.env.SKINTWIN_CHAIN_LEDGER = previousLedger;
    if (previousHub === undefined) delete process.env.SKINTWIN_HUB_ROOT;
    else process.env.SKINTWIN_HUB_ROOT = previousHub;
  }
});

test("a fully refunded charge returns the sale named in its metadata", () => {
  const fulfillmentId = "order-charge:0:sku-cleanser";
  const metadata = { fulfillment_id: fulfillmentId };
  assert.deepEqual(chargeReturnCommands({ refunded: false, id: "ch_1", amount_refunded: 1000, metadata }), []);
  assert.deepEqual(chargeReturnCommands({ refunded: true, id: "ch_1" }), []);
  assert.deepEqual(chargeReturnCommands({ refunded: true, id: "ch_1", metadata }), [
    {
      command: "return_sale",
      args: { return_id: `return:ch_1:${fulfillmentId}`, fulfillment_id: fulfillmentId },
    },
  ]);
  const skipped = acceptChargeReturn({ refunded: true, id: "ch_plain" });
  assert.equal(skipped.ok, true);
  assert.equal(skipped.count, 0);
  const dir = mkdtempSync(join(tmpdir(), "portal-charge-return-"));
  const ledger = join(dir, "supply-chain.jsonl");
  const locate = loadChainLocate();
  assert.ok(locate);
  const hub = locate.hubRoot();
  const previousLedger = process.env.SKINTWIN_CHAIN_LEDGER;
  const previousHub = process.env.SKINTWIN_HUB_ROOT;
  process.env.SKINTWIN_CHAIN_LEDGER = ledger;
  process.env.SKINTWIN_HUB_ROOT = hub;
  try {
    const missing = acceptChargeReturn({ refunded: true, id: "ch_1", metadata });
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
          { command: "fulfill", args: { fulfillment_id: fulfillmentId, sku_id: "sku-cleanser", location: "cape-town", milligrams: 2000, kind: "retail" } },
        ],
      }),
      encoding: "utf8",
    });
    assert.equal(seeded.status, 0, seeded.stderr || seeded.stdout);
    const returned = acceptChargeReturn({ refunded: true, id: "ch_1", metadata });
    assert.equal(returned.ok, true);
    assert.equal(returned.count, 1);
    const recorded = readFileSync(ledger, "utf8");
    assert.match(recorded, /return:ch_1:order-charge:0:sku-cleanser/);
    const again = acceptChargeReturn({ refunded: true, id: "ch_1", metadata });
    assert.equal(again.ok, false);
    assert.equal(readFileSync(ledger, "utf8"), recorded);
  } finally {
    if (previousLedger === undefined) delete process.env.SKINTWIN_CHAIN_LEDGER;
    else process.env.SKINTWIN_CHAIN_LEDGER = previousLedger;
    if (previousHub === undefined) delete process.env.SKINTWIN_HUB_ROOT;
    else process.env.SKINTWIN_HUB_ROOT = previousHub;
  }
});
