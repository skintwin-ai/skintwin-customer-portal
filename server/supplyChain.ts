import { acceptBookingDelivery, acceptChargeReturn, acceptOrderFulfillments, acceptPaymentReturn, acceptPurchaseReceipt, acceptSaleReturn, acceptShopifyCatalog, acceptSupplierQualification, acceptTreatmentProducts, catalogProduct, handleStage, useSharedLedger } from "../chain_stage.mjs";
import { recordSkinOutcome } from "../outcome.mjs";
import { paymentIntentMetadata, paystackInitializeMetadata, recordInvoiceSettlement, recordPaymentIntentSettlement, recordSettlement, verifiedPaystackSettlement } from "../settlement.mjs";

export { acceptBookingDelivery, acceptChargeReturn, acceptOrderFulfillments, acceptPaymentReturn, acceptPurchaseReceipt, acceptSaleReturn, acceptShopifyCatalog, acceptSupplierQualification, acceptTreatmentProducts, catalogProduct, paymentIntentMetadata, paystackInitializeMetadata, recordInvoiceSettlement, recordPaymentIntentSettlement, recordSettlement, recordSkinOutcome, verifiedPaystackSettlement };

export function acceptSupplyChainCommand(body: {
  command?: string;
  args?: Record<string, unknown>;
}) {
  useSharedLedger();
  return handleStage(body);
}
