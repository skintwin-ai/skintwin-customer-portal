import { fulfillmentCommands, handleStage, useSharedLedger } from "../chain_stage.mjs";
import { recordSkinOutcome } from "../outcome.mjs";

export { recordSkinOutcome };

export function acceptSupplyChainCommand(body: {
  command?: string;
  args?: Record<string, unknown>;
}) {
  useSharedLedger();
  return handleStage(body);
}

export function acceptOrderFulfillments(
  orderNumber: string,
  items: unknown[],
  therapistId?: number | string | null,
) {
  let commands;
  try {
    commands = fulfillmentCommands(orderNumber, items, therapistId);
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "order rejected" };
  }
  for (const command of commands) {
    const accepted = acceptSupplyChainCommand(command);
    if (!accepted.ok) return accepted;
  }
  return { ok: true as const, count: commands.length };
}
