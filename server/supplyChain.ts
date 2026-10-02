import { existsSync } from "node:fs";
import { handleStage } from "../chain_stage.mjs";

function useSharedLedger() {
  const hub = process.env.SKINTWIN_HUB_ROOT
    || ["/agent/repos/skintwin-ecosystem-design", "/workspace/repos/skintwin-ecosystem-design"]
      .find((candidate) => existsSync(`${candidate}/domain/ledger.py`));
  if (!hub) return;
  process.env.SKINTWIN_HUB_ROOT ||= hub;
  process.env.SKINTWIN_CHAIN_LEDGER ||= `${hub}/var/supply-chain.jsonl`;
}

export function acceptSupplyChainCommand(body: {
  command?: string;
  args?: Record<string, unknown>;
}) {
  useSharedLedger();
  return handleStage(body);
}
