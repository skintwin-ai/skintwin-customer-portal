import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { loadChainLocate } from "./chain_stage.mjs";
import { outcomeCommand, recordSkinOutcome } from "./outcome.mjs";

test("a scheduled consultation without a measurement is not an outcome", () => {
  assert.equal(outcomeCommand({ notes: "return in six weeks" }), null);
  assert.equal(outcomeCommand(undefined), null);
  assert.equal(outcomeCommand({ score: 81, concern: "dryness" }), null);
});

test("a consultation named by fulfillment_id records that sale", () => {
  const preferred = outcomeCommand({
    fulfillmentId: "order-camel",
    fulfillment_id: "order-snake",
    outcomeId: "outcome-camel",
    outcome_id: "outcome-snake",
    concern: "pigmentation",
    score: 81,
  });
  assert.equal(preferred.args.fulfillment_id, "order-camel");
  assert.equal(preferred.args.outcome_id, "outcome-camel");
  const fallen = outcomeCommand({
    fulfillmentId: "  ",
    fulfillment_id: " order-9 ",
    outcomeId: "  ",
    concern: "dryness",
    score: 64,
  });
  assert.equal(fallen.args.fulfillment_id, "order-9");
  assert.equal(fallen.args.outcome_id, "outcome:order-9");
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
    assert.equal(existsSync(ledger), false);
  } finally {
    if (previousLedger === undefined) delete process.env.SKINTWIN_CHAIN_LEDGER;
    else process.env.SKINTWIN_CHAIN_LEDGER = previousLedger;
  }
});

test("a consultation without a sale stays off the ledger", () => {
  const dir = mkdtempSync(join(tmpdir(), "outcome-unnamed-"));
  const ledger = join(dir, "supply-chain.jsonl");
  const previousLedger = process.env.SKINTWIN_CHAIN_LEDGER;
  process.env.SKINTWIN_CHAIN_LEDGER = ledger;
  try {
    const skipped = recordSkinOutcome({ score: 81, concern: "dryness" });
    assert.equal(skipped.ok, true);
    assert.equal(skipped.recorded, false);
    assert.equal(existsSync(ledger), false);
  } finally {
    if (previousLedger === undefined) delete process.env.SKINTWIN_CHAIN_LEDGER;
    else process.env.SKINTWIN_CHAIN_LEDGER = previousLedger;
  }
});

test("a consultation named by a blank fulfillmentId records that sale once", () => {
  const dir = mkdtempSync(join(tmpdir(), "outcome-fallthrough-"));
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
        { command: "qualify_supplier", args: { qualification_id: "qual-glycerin", supplier_name: "Inland Humectants", ingredient_id: "glycerin" } },
        { command: "receive_lot", args: { lot_id: "lot-glycerin", ingredient_id: "glycerin", qualification_id: "qual-glycerin", milligrams: 5000 } },
        { command: "define_formula", args: { formula_id: "cleanser", name: "Gentle cleanser", lines: [["glycerin", 5000]] } },
        { command: "catalog_sku", args: { sku_id: "sku-cleanser", formula_id: "cleanser", name: "Gentle cleanser" } },
        { command: "manufacture", args: { batch_id: "batch-cleanser", sku_id: "sku-cleanser", units: 1, allocations: [["glycerin", "lot-glycerin", 5000]] } },
        { command: "transfer", args: { transfer_id: "xfer-cape-town", sku_id: "sku-cleanser", batch_id: "batch-cleanser", source: "plant", destination: "cape-town", milligrams: 2000 } },
        { command: "fulfill", args: { fulfillment_id: "order-9", sku_id: "sku-cleanser", location: "cape-town", milligrams: 2000, kind: "retail" } },
      ],
    }),
    encoding: "utf8",
  });
  assert.equal(seeded.status, 0, seeded.stderr || seeded.stdout);
  try {
    const result = recordSkinOutcome({
      fulfillmentId: "  ",
      fulfillment_id: "order-9",
      outcomeId: "  ",
      concern: "dryness",
      score: 64,
    });
    assert.equal(result.ok, true);
    assert.equal(result.recorded, true);
    const recorded = readFileSync(ledger, "utf8");
    assert.match(recorded, /outcome:order-9/);
    const again = recordSkinOutcome({
      fulfillmentId: "  ",
      fulfillment_id: "order-9",
      outcomeId: "outcome-again",
      concern: "dryness",
      score: 70,
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
