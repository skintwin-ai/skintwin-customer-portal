// Map a consultation skin analysis onto the skintwin outcome command.

import { spawnSync } from "node:child_process";
import { loadChainLocate } from "./chain_stage.mjs";

function text(value) {
  return typeof value === "string" ? value.trim() : value;
}

function namedId(record, camel, snake) {
  const first = record?.[camel];
  if (typeof first === "string" && first.trim() !== "") return first.trim();
  const second = record?.[snake];
  if (typeof second === "string" && second.trim() !== "") return second.trim();
  return "";
}

export function outcomeCommand(analysis) {
  if (!analysis || typeof analysis !== "object" || Array.isArray(analysis)) return null;
  const fulfillmentId = namedId(analysis, "fulfillmentId", "fulfillment_id");
  if (!fulfillmentId) return null;
  const outcomeId = namedId(analysis, "outcomeId", "outcome_id") || `outcome:${fulfillmentId}`;
  return {
    command: "record_outcome",
    args: {
      outcome_id: outcomeId,
      fulfillment_id: fulfillmentId,
      concern: text(analysis.concern),
      score: analysis.score,
    },
  };
}

export function recordSkinOutcome(analysis) {
  const command = outcomeCommand(analysis);
  if (!command) return { ok: true, recorded: false };
  const locate = loadChainLocate();
  if (!locate) return { ok: false, error: "supply-chain hub is not present" };
  const stage = process.env.SKINTWIN_OUTCOME_STAGE || locate.stageEntry("outcome");
  if (!stage) return { ok: false, error: "skintwin outcome stage is not present" };
  locate.bindLedger();
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
