import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fulfillmentCommands, handleStage } from "./chain_stage.mjs";

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
