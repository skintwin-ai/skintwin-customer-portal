// Map a consultation skin analysis onto the skintwin outcome command.

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

function text(value) {
  return typeof value === "string" ? value.trim() : value;
}

export function outcomeCommand(analysis) {
  if (!analysis || typeof analysis !== "object" || Array.isArray(analysis)) return null;
  const measured = ["score", "concern", "fulfillmentId", "fulfillment_id", "outcomeId", "outcome_id"]
    .some((key) => analysis[key] !== undefined);
  if (!measured) return null;
  return {
    command: "record_outcome",
    args: {
      outcome_id: text(analysis.outcomeId ?? analysis.outcome_id),
      fulfillment_id: text(analysis.fulfillmentId ?? analysis.fulfillment_id),
      concern: text(analysis.concern),
      score: analysis.score,
    },
  };
}

function useSharedLedger() {
  const hub = process.env.SKINTWIN_HUB_ROOT
    || ["/agent/repos/skintwin-ecosystem-design", "/workspace/repos/skintwin-ecosystem-design"]
      .find((candidate) => existsSync(`${candidate}/domain/ledger.py`));
  if (!hub) return;
  process.env.SKINTWIN_HUB_ROOT ||= hub;
  process.env.SKINTWIN_CHAIN_LEDGER ||= `${hub}/var/supply-chain.jsonl`;
}

export function recordSkinOutcome(analysis) {
  const command = outcomeCommand(analysis);
  if (!command) return { ok: true, recorded: false };
  const stage = [
    process.env.SKINTWIN_OUTCOME_STAGE,
    "/agent/repos/skintwin/chain_stage.py",
    "/workspace/repos/skintwin/chain_stage.py",
  ].find((candidate) => candidate && existsSync(candidate));
  if (!stage) return { ok: false, error: "skintwin outcome stage is not present" };
  useSharedLedger();
  const child = spawnSync("python3", [stage], {
    input: JSON.stringify(command),
    encoding: "utf8",
  });
  let payload = {};
  try {
    payload = JSON.parse(child.stdout || "{}");
  } catch {
    payload = {};
  }
  if (child.status !== 0 || !payload.ok) {
    return { ok: false, error: payload.error || child.stderr || "outcome rejected" };
  }
  return { ok: true, recorded: true };
}
