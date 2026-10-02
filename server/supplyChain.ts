import { acceptOrderFulfillments, acceptPurchaseReceipt, acceptShopifyCatalog, acceptTreatmentProducts, catalogProduct, handleStage, useSharedLedger } from "../chain_stage.mjs";
import { recordSkinOutcome } from "../outcome.mjs";
import { recordSettlement } from "../settlement.mjs";

export { acceptOrderFulfillments, acceptPurchaseReceipt, acceptShopifyCatalog, acceptTreatmentProducts, catalogProduct, recordSettlement, recordSkinOutcome };

export function acceptSupplyChainCommand(body: {
  command?: string;
  args?: Record<string, unknown>;
}) {
  useSharedLedger();
  return handleStage(body);
}
