import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, boolean, json } from "drizzle-orm/mysql-core";

// ============================================================================
// USER & AUTHENTICATION
// ============================================================================

export const userRoleEnum = mysqlEnum("role", ["retail_customer", "therapist", "salon_owner", "admin"]);

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  workosUserId: varchar("workosUserId", { length: 128 }),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 32 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: userRoleEnum.default("retail_customer").notNull(),
  organizationId: int("organizationId"),
  avatarUrl: text("avatarUrl"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ============================================================================
// ORGANIZATIONS (Multi-tenant)
// ============================================================================

export const organizations = mysqlTable("organizations", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  type: mysqlEnum("type", ["salon", "retail", "distributor"]).notNull(),
  ownerId: int("ownerId").notNull(),
  shopifyStoreUrl: varchar("shopifyStoreUrl", { length: 512 }),
  shopifyAccessToken: text("shopifyAccessToken"),
  wixSiteId: varchar("wixSiteId", { length: 128 }),
  wixAccessToken: text("wixAccessToken"),
  stripeAccountId: varchar("stripeAccountId", { length: 128 }),
  paystackSubaccountCode: varchar("paystackSubaccountCode", { length: 128 }),
  quickbooksRealmId: varchar("quickbooksRealmId", { length: 64 }),
  xeroTenantId: varchar("xeroTenantId", { length: 64 }),
  erpnextUrl: varchar("erpnextUrl", { length: 512 }),
  erpnextApiKey: text("erpnextApiKey"),
  settings: json("settings"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = typeof organizations.$inferInsert;

// ============================================================================
// LOCATIONS (B2B Multi-location support)
// ============================================================================

export const locations = mysqlTable("locations", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  address: text("address"),
  city: varchar("city", { length: 128 }),
  state: varchar("state", { length: 128 }),
  country: varchar("country", { length: 64 }),
  postalCode: varchar("postalCode", { length: 32 }),
  latitude: decimal("latitude", { precision: 10, scale: 8 }),
  longitude: decimal("longitude", { precision: 11, scale: 8 }),
  serviceRadius: int("serviceRadius"), // in kilometers
  phone: varchar("phone", { length: 32 }),
  email: varchar("email", { length: 320 }),
  posType: mysqlEnum("posType", ["shopify", "opencart", "none"]).default("none"),
  posStoreId: varchar("posStoreId", { length: 128 }),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Location = typeof locations.$inferSelect;
export type InsertLocation = typeof locations.$inferInsert;

// ============================================================================
// THERAPISTS
// ============================================================================

export const therapists = mysqlTable("therapists", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  organizationId: int("organizationId").notNull(),
  locationId: int("locationId"),
  specializations: json("specializations"), // Array of specialization strings
  certifications: json("certifications"),
  commissionRate: decimal("commissionRate", { precision: 5, scale: 2 }).default("10.00").notNull(),
  salesCommissionRate: decimal("salesCommissionRate", { precision: 5, scale: 2 }).default("5.00").notNull(),
  bio: text("bio"),
  isAvailable: boolean("isAvailable").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Therapist = typeof therapists.$inferSelect;
export type InsertTherapist = typeof therapists.$inferInsert;

// ============================================================================
// CUSTOMER-THERAPIST RELATIONSHIPS
// ============================================================================

export const customerTherapistAssignments = mysqlTable("customer_therapist_assignments", {
  id: int("id").autoincrement().primaryKey(),
  customerId: int("customerId").notNull(),
  therapistId: int("therapistId").notNull(),
  organizationId: int("organizationId").notNull(),
  assignedAt: timestamp("assignedAt").defaultNow().notNull(),
  assignedBy: int("assignedBy"),
  isPrimary: boolean("isPrimary").default(true).notNull(),
  notes: text("notes"),
  isActive: boolean("isActive").default(true).notNull(),
});

export type CustomerTherapistAssignment = typeof customerTherapistAssignments.$inferSelect;
export type InsertCustomerTherapistAssignment = typeof customerTherapistAssignments.$inferInsert;

// ============================================================================
// CONSULTATIONS
// ============================================================================

export const consultations = mysqlTable("consultations", {
  id: int("id").autoincrement().primaryKey(),
  customerId: int("customerId").notNull(),
  therapistId: int("therapistId").notNull(),
  organizationId: int("organizationId").notNull(),
  locationId: int("locationId"),
  type: mysqlEnum("type", ["initial", "follow_up", "treatment", "review"]).notNull(),
  status: mysqlEnum("status", ["scheduled", "in_progress", "completed", "cancelled", "no_show"]).default("scheduled").notNull(),
  scheduledAt: timestamp("scheduledAt"),
  completedAt: timestamp("completedAt"),
  duration: int("duration"), // in minutes
  skinAnalysis: json("skinAnalysis"),
  recommendations: json("recommendations"),
  notes: text("notes"),
  attachments: json("attachments"), // Array of S3 URLs
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Consultation = typeof consultations.$inferSelect;
export type InsertConsultation = typeof consultations.$inferInsert;

// ============================================================================
// TREATMENTS
// ============================================================================

export const treatments = mysqlTable("treatments", {
  id: int("id").autoincrement().primaryKey(),
  consultationId: int("consultationId"),
  customerId: int("customerId").notNull(),
  therapistId: int("therapistId").notNull(),
  organizationId: int("organizationId").notNull(),
  locationId: int("locationId"),
  serviceName: varchar("serviceName", { length: 255 }).notNull(),
  serviceCode: varchar("serviceCode", { length: 64 }),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  duration: int("duration"), // in minutes
  status: mysqlEnum("status", ["scheduled", "in_progress", "completed", "cancelled"]).default("scheduled").notNull(),
  scheduledAt: timestamp("scheduledAt"),
  completedAt: timestamp("completedAt"),
  notes: text("notes"),
  productsUsed: json("productsUsed"), // Array of product IDs and quantities
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Treatment = typeof treatments.$inferSelect;
export type InsertTreatment = typeof treatments.$inferInsert;

// ============================================================================
// PRODUCTS (Synced from Shopify)
// ============================================================================

export const products = mysqlTable("products", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  shopifyProductId: varchar("shopifyProductId", { length: 64 }),
  opencartProductId: varchar("opencartProductId", { length: 64 }),
  erpnextItemCode: varchar("erpnextItemCode", { length: 64 }),
  sku: varchar("sku", { length: 128 }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  costPrice: decimal("costPrice", { precision: 10, scale: 2 }),
  category: varchar("category", { length: 128 }),
  imageUrl: text("imageUrl"),
  inventory: int("inventory").default(0),
  isActive: boolean("isActive").default(true).notNull(),
  syncedAt: timestamp("syncedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Product = typeof products.$inferSelect;
export type InsertProduct = typeof products.$inferInsert;

// ============================================================================
// ORDERS
// ============================================================================

export const orders = mysqlTable("orders", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  customerId: int("customerId").notNull(),
  therapistId: int("therapistId"),
  locationId: int("locationId"),
  shopifyOrderId: varchar("shopifyOrderId", { length: 64 }),
  opencartOrderId: varchar("opencartOrderId", { length: 64 }),
  orderNumber: varchar("orderNumber", { length: 64 }).notNull(),
  status: mysqlEnum("status", ["pending", "processing", "shipped", "delivered", "cancelled", "refunded"]).default("pending").notNull(),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  tax: decimal("tax", { precision: 10, scale: 2 }).default("0.00"),
  discount: decimal("discount", { precision: 10, scale: 2 }).default("0.00"),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("USD").notNull(),
  paymentMethod: mysqlEnum("paymentMethod", ["stripe", "paystack", "cash", "card", "other"]),
  paymentStatus: mysqlEnum("paymentStatus", ["pending", "paid", "failed", "refunded"]).default("pending").notNull(),
  shippingAddress: json("shippingAddress"),
  billingAddress: json("billingAddress"),
  notes: text("notes"),
  source: mysqlEnum("source", ["web", "pos_shopify", "pos_opencart", "manual"]).default("web").notNull(),
  syncedToAccounting: boolean("syncedToAccounting").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Order = typeof orders.$inferSelect;
export type InsertOrder = typeof orders.$inferInsert;

// ============================================================================
// ORDER ITEMS
// ============================================================================

export const orderItems = mysqlTable("order_items", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull(),
  productId: int("productId"),
  treatmentId: int("treatmentId"),
  name: varchar("name", { length: 255 }).notNull(),
  sku: varchar("sku", { length: 128 }),
  quantity: int("quantity").notNull(),
  unitPrice: decimal("unitPrice", { precision: 10, scale: 2 }).notNull(),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  type: mysqlEnum("type", ["product", "treatment", "service"]).default("product").notNull(),
});

export type OrderItem = typeof orderItems.$inferSelect;
export type InsertOrderItem = typeof orderItems.$inferInsert;

// ============================================================================
// PAYMENTS
// ============================================================================

export const payments = mysqlTable("payments", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  orderId: int("orderId"),
  customerId: int("customerId").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("USD").notNull(),
  processor: mysqlEnum("processor", ["stripe", "paystack"]).notNull(),
  processorPaymentId: varchar("processorPaymentId", { length: 128 }),
  processorChargeId: varchar("processorChargeId", { length: 128 }),
  status: mysqlEnum("status", ["pending", "succeeded", "failed", "refunded", "partially_refunded"]).default("pending").notNull(),
  refundedAmount: decimal("refundedAmount", { precision: 10, scale: 2 }).default("0.00"),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Payment = typeof payments.$inferSelect;
export type InsertPayment = typeof payments.$inferInsert;

// ============================================================================
// COMMISSIONS
// ============================================================================

export const commissions = mysqlTable("commissions", {
  id: int("id").autoincrement().primaryKey(),
  therapistId: int("therapistId").notNull(),
  organizationId: int("organizationId").notNull(),
  orderId: int("orderId"),
  treatmentId: int("treatmentId"),
  type: mysqlEnum("type", ["treatment", "product_sale", "referral"]).notNull(),
  baseAmount: decimal("baseAmount", { precision: 10, scale: 2 }).notNull(),
  commissionRate: decimal("commissionRate", { precision: 5, scale: 2 }).notNull(),
  commissionAmount: decimal("commissionAmount", { precision: 10, scale: 2 }).notNull(),
  status: mysqlEnum("status", ["pending", "approved", "paid", "cancelled"]).default("pending").notNull(),
  paidAt: timestamp("paidAt"),
  paymentReference: varchar("paymentReference", { length: 128 }),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Commission = typeof commissions.$inferSelect;
export type InsertCommission = typeof commissions.$inferInsert;

// ============================================================================
// BOOKINGS (Wix Integration)
// ============================================================================

export const bookings = mysqlTable("bookings", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  locationId: int("locationId"),
  customerId: int("customerId").notNull(),
  therapistId: int("therapistId"),
  wixBookingId: varchar("wixBookingId", { length: 128 }),
  serviceType: varchar("serviceType", { length: 128 }).notNull(),
  serviceName: varchar("serviceName", { length: 255 }).notNull(),
  status: mysqlEnum("status", ["pending", "confirmed", "cancelled", "completed", "no_show"]).default("pending").notNull(),
  scheduledAt: timestamp("scheduledAt").notNull(),
  duration: int("duration").notNull(), // in minutes
  price: decimal("price", { precision: 10, scale: 2 }),
  notes: text("notes"),
  customerNotes: text("customerNotes"),
  confirmationSent: boolean("confirmationSent").default(false),
  reminderSent: boolean("reminderSent").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Booking = typeof bookings.$inferSelect;
export type InsertBooking = typeof bookings.$inferInsert;

// ============================================================================
// ACCOUNTING SYNC LOG
// ============================================================================

export const accountingSyncLog = mysqlTable("accounting_sync_log", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  system: mysqlEnum("system", ["quickbooks", "xero", "gnucash"]).notNull(),
  entityType: varchar("entityType", { length: 64 }).notNull(), // invoice, payment, customer, etc.
  entityId: int("entityId").notNull(),
  externalId: varchar("externalId", { length: 128 }),
  action: mysqlEnum("action", ["create", "update", "delete"]).notNull(),
  status: mysqlEnum("status", ["pending", "success", "failed"]).default("pending").notNull(),
  errorMessage: text("errorMessage"),
  syncedAt: timestamp("syncedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AccountingSyncLog = typeof accountingSyncLog.$inferSelect;
export type InsertAccountingSyncLog = typeof accountingSyncLog.$inferInsert;

// ============================================================================
// PROCUREMENT (ERPNext Integration)
// ============================================================================

export const purchaseOrders = mysqlTable("purchase_orders", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  erpnextPOId: varchar("erpnextPOId", { length: 64 }),
  poNumber: varchar("poNumber", { length: 64 }).notNull(),
  supplierId: int("supplierId"),
  supplierName: varchar("supplierName", { length: 255 }),
  status: mysqlEnum("status", ["draft", "submitted", "approved", "received", "cancelled"]).default("draft").notNull(),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  tax: decimal("tax", { precision: 10, scale: 2 }).default("0.00"),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("USD").notNull(),
  expectedDelivery: timestamp("expectedDelivery"),
  receivedAt: timestamp("receivedAt"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PurchaseOrder = typeof purchaseOrders.$inferSelect;
export type InsertPurchaseOrder = typeof purchaseOrders.$inferInsert;

export const purchaseOrderItems = mysqlTable("purchase_order_items", {
  id: int("id").autoincrement().primaryKey(),
  purchaseOrderId: int("purchaseOrderId").notNull(),
  productId: int("productId"),
  erpnextItemCode: varchar("erpnextItemCode", { length: 64 }),
  name: varchar("name", { length: 255 }).notNull(),
  quantity: int("quantity").notNull(),
  unitPrice: decimal("unitPrice", { precision: 10, scale: 2 }).notNull(),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  receivedQuantity: int("receivedQuantity").default(0),
});

export type PurchaseOrderItem = typeof purchaseOrderItems.$inferSelect;
export type InsertPurchaseOrderItem = typeof purchaseOrderItems.$inferInsert;

export const suppliers = mysqlTable("suppliers", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  erpnextSupplierId: varchar("erpnextSupplierId", { length: 64 }),
  name: varchar("name", { length: 255 }).notNull(),
  contactName: varchar("contactName", { length: 255 }),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 32 }),
  address: text("address"),
  paymentTerms: varchar("paymentTerms", { length: 64 }),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Supplier = typeof suppliers.$inferSelect;
export type InsertSupplier = typeof suppliers.$inferInsert;

// ============================================================================
// NOTIFICATIONS
// ============================================================================

export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  organizationId: int("organizationId"),
  type: mysqlEnum("type", ["commission_earned", "booking_confirmed", "payment_received", "order_update", "system"]).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  data: json("data"),
  isRead: boolean("isRead").default(false).notNull(),
  emailSent: boolean("emailSent").default(false),
  emailSentAt: timestamp("emailSentAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

// ============================================================================
// REPORTS
// ============================================================================

export const reports = mysqlTable("reports", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  type: mysqlEnum("type", ["commission", "sales", "procurement", "inventory", "customer_analytics"]).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  period: varchar("period", { length: 32 }), // e.g., "2026-01" for monthly
  generatedBy: int("generatedBy"),
  fileUrl: text("fileUrl"),
  fileKey: varchar("fileKey", { length: 255 }),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Report = typeof reports.$inferSelect;
export type InsertReport = typeof reports.$inferInsert;

// ============================================================================
// INTEGRATION CREDENTIALS (Encrypted storage)
// ============================================================================

export const integrationCredentials = mysqlTable("integration_credentials", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  integration: mysqlEnum("integration", ["shopify", "wix", "stripe", "paystack", "quickbooks", "xero", "erpnext", "workos"]).notNull(),
  credentials: text("credentials").notNull(), // JSON encrypted
  expiresAt: timestamp("expiresAt"),
  refreshToken: text("refreshToken"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type IntegrationCredential = typeof integrationCredentials.$inferSelect;
export type InsertIntegrationCredential = typeof integrationCredentials.$inferInsert;

// ============================================================================
// AUDIT LOG
// ============================================================================

export const auditLog = mysqlTable("audit_log", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  organizationId: int("organizationId"),
  action: varchar("action", { length: 64 }).notNull(),
  entityType: varchar("entityType", { length: 64 }).notNull(),
  entityId: int("entityId"),
  oldValues: json("oldValues"),
  newValues: json("newValues"),
  ipAddress: varchar("ipAddress", { length: 45 }),
  userAgent: text("userAgent"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AuditLog = typeof auditLog.$inferSelect;
export type InsertAuditLog = typeof auditLog.$inferInsert;
