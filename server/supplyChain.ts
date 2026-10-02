import { acceptBookingDelivery, acceptOrderFulfillments, acceptPaymentReturn, acceptPurchaseReceipt, acceptSaleReturn, acceptShopifyCatalog, acceptSupplierQualification, acceptTreatmentProducts, catalogProduct, handleStage, useSharedLedger } from "../chain_stage.mjs";
import { recordSkinOutcome } from "../outcome.mjs";
import { paystackInitializeMetadata, recordSettlement, verifiedPaystackSettlement } from "../settlement.mjs";

export { acceptBookingDelivery, acceptOrderFulfillments, acceptPaymentReturn, acceptPurchaseReceipt, acceptSaleReturn, acceptShopifyCatalog, acceptSupplierQualification, acceptTreatmentProducts, catalogProduct, paystackInitializeMetadata, recordSettlement, recordSkinOutcome, verifiedPaystackSettlement };

export function acceptSupplyChainCommand(body: {
  command?: string;
  args?: Record<string, unknown>;
}) {
  useSharedLedger();
  return handleStage(body);
}
