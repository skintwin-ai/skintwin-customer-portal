import assert from "node:assert/strict";
import test from "node:test";
import { handleStage } from "./chain_stage.mjs";

test("catalog command accepts a finished sku", () => {
  const result = handleStage({
    command: "catalog_sku",
    args: { sku_id: "sku-serum-c", formula_id: "serum-c", name: "Vitamin C serum" },
  });
  assert.equal(result.ok, true);
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
