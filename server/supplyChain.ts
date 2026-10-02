import { acceptOrderFulfillments, catalogProduct, handleStage, useSharedLedger } from "../chain_stage.mjs";
import { recordSkinOutcome } from "../outcome.mjs";

export { acceptOrderFulfillments, catalogProduct, recordSkinOutcome };

export function acceptSupplyChainCommand(body: {
  command?: string;
  args?: Record<string, unknown>;
}) {
  useSharedLedger();
  return handleStage(body);
}
