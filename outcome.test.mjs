import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { outcomeCommand, recordSkinOutcome } from "./outcome.mjs";

test("a scheduled consultation without a measurement is not an outcome", () => {
  assert.equal(outcomeCommand({ notes: "return in six weeks" }), null);
  assert.equal(outcomeCommand(undefined), null);
});

test("a measured analysis becomes an outcome command", () => {
  const command = outcomeCommand({
    outcomeId: "outcome-treatment",
    fulfillmentId: "order-treatment",
    concern: "pigmentation",
    score: 81,
  });
  assert.equal(command.command, "record_outcome");
  assert.equal(command.args.fulfillment_id, "order-treatment");
  assert.equal(command.args.score, 81);
});

test("a measured outcome against an empty ledger is rejected", async () => {
  const dir = mkdtempSync(join(tmpdir(), "outcome-chain-"));
  const ledger = join(dir, "supply-chain.jsonl");
  const previousLedger = process.env.SKINTWIN_CHAIN_LEDGER;
  process.env.SKINTWIN_CHAIN_LEDGER = ledger;
  try {
    const result = recordSkinOutcome({
      outcomeId: "outcome-1",
      fulfillmentId: "missing-order",
      concern: "dryness",
      score: 40,
    });
    assert.equal(result.ok, false);
  } finally {
    if (previousLedger === undefined) delete process.env.SKINTWIN_CHAIN_LEDGER;
    else process.env.SKINTWIN_CHAIN_LEDGER = previousLedger;
  }
});
