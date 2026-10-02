import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { acceptOrderFulfillments, fulfillmentCommands, handleStage, loadChainLocate } from "./chain_stage.mjs";

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
