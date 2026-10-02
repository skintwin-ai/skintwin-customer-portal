import { handleStage } from "../chain_stage.mjs";

export function acceptSupplyChainCommand(body: {
  command?: string;
  args?: Record<string, unknown>;
}) {
  return handleStage(body);
}
