import { acceptBookingDelivery, acceptChargeReturn, acceptChargeStoredReturns, acceptOrderFulfillments, acceptOrderSaleReturns, acceptPaymentReturn, acceptPurchaseReceipt, acceptSaleReturn, acceptShopifyCatalog, acceptSupplierQualification, acceptTreatmentProducts, catalogProduct, handleStage, namedSale, storedOrderLine, useSharedLedger } from "../chain_stage.mjs";
import { recordSkinOutcome } from "../outcome.mjs";
import { paymentForSettlement, paymentIntentMetadata, paystackInitializeMetadata, recordCheckoutSettlement, recordInvoiceSettlement, recordPaymentIntentSettlement, recordSettlement, verifiedPaystackSettlement } from "../settlement.mjs";

export { acceptBookingDelivery, acceptChargeReturn, acceptChargeStoredReturns, acceptOrderFulfillments, acceptOrderSaleReturns, acceptPaymentReturn, acceptPurchaseReceipt, acceptSaleReturn, acceptShopifyCatalog, acceptSupplierQualification, acceptTreatmentProducts, catalogProduct, paymentForSettlement, paymentIntentMetadata, paystackInitializeMetadata, recordCheckoutSettlement, recordInvoiceSettlement, recordPaymentIntentSettlement, recordSettlement, recordSkinOutcome, namedSale, storedOrderLine, verifiedPaystackSettlement };

export function acceptSupplyChainCommand(body: {
  command?: string;
  args?: Record<string, unknown>;
}) {
  useSharedLedger();
  return handleStage(body);
}
