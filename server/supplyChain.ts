import { acceptBookingDelivery, acceptChargeReturn, acceptOrderFulfillments, acceptPaymentReturn, acceptPurchaseReceipt, acceptSaleReturn, acceptShopifyCatalog, acceptSupplierQualification, acceptTreatmentProducts, catalogProduct, handleStage, storedOrderLine, useSharedLedger } from "../chain_stage.mjs";
import { recordSkinOutcome } from "../outcome.mjs";
import { paymentIntentMetadata, paystackInitializeMetadata, recordCheckoutSettlement, recordInvoiceSettlement, recordPaymentIntentSettlement, recordSettlement, verifiedPaystackSettlement } from "../settlement.mjs";

export { acceptBookingDelivery, acceptChargeReturn, acceptOrderFulfillments, acceptPaymentReturn, acceptPurchaseReceipt, acceptSaleReturn, acceptShopifyCatalog, acceptSupplierQualification, acceptTreatmentProducts, catalogProduct, paymentIntentMetadata, paystackInitializeMetadata, recordCheckoutSettlement, recordInvoiceSettlement, recordPaymentIntentSettlement, recordSettlement, recordSkinOutcome, storedOrderLine, verifiedPaystackSettlement };

export function acceptSupplyChainCommand(body: {
  command?: string;
  args?: Record<string, unknown>;
}) {
  useSharedLedger();
  return handleStage(body);
}
