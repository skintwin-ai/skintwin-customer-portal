import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { purchaseReceiptCommands } from "./chain_stage.mjs";
import { KILOGRAM_TEXT, MILLIGRAM_TEXT } from "./server/ledger-input.mjs";

test("order, booking, and receipt routes accept the quantities the ledger records", () => {
  assert.equal(MILLIGRAM_TEXT.test("2000"), true);
  assert.equal(MILLIGRAM_TEXT.test(" 4 "), true);
  assert.equal(MILLIGRAM_TEXT.test("lots"), false);
  assert.equal(MILLIGRAM_TEXT.test("0.02"), false);
  assert.equal(KILOGRAM_TEXT.test("0.02"), true);
  assert.equal(KILOGRAM_TEXT.test(" 0.02 "), true);
  assert.equal(KILOGRAM_TEXT.test("0.02kg"), false);

  const source = readFileSync(new URL("./server/routers.ts", import.meta.url), "utf8");
  assert.equal((source.match(/z\.string\(\)\.regex\(MILLIGRAM_TEXT\)/g) || []).length, 4);
  assert.equal((source.match(/z\.string\(\)\.regex\(KILOGRAM_TEXT\)/g) || []).length, 2);

  const received = purchaseReceiptCommands("PO-text", [
    {
      ingredient_id: "glycerin",
      qualification_id: "qual-glycerin",
      lot_id: "lot-kg",
      quantity_kg: "0.02",
    },
  ]);
  assert.equal(received[0].args.milligrams, 20000);
});
