import { eq, and, desc, sql, gte, lte, like, or, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, users,
  organizations, InsertOrganization,
  locations, InsertLocation,
  therapists, InsertTherapist,
  customerTherapistAssignments, InsertCustomerTherapistAssignment,
  consultations, InsertConsultation,
  treatments, InsertTreatment,
  products, InsertProduct,
  orders, InsertOrder,
  orderItems, InsertOrderItem,
  payments, InsertPayment,
  commissions, InsertCommission,
  bookings, InsertBooking,
  accountingSyncLog, InsertAccountingSyncLog,
  purchaseOrders, InsertPurchaseOrder,
  purchaseOrderItems, InsertPurchaseOrderItem,
  suppliers, InsertSupplier,
  notifications, InsertNotification,
  reports, InsertReport,
  integrationCredentials, InsertIntegrationCredential,
  auditLog, InsertAuditLog,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ============================================================================
// USER OPERATIONS
// ============================================================================

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod", "phone", "avatarUrl", "workosUserId"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }
    if (user.organizationId !== undefined) {
      values.organizationId = user.organizationId;
      updateSet.organizationId = user.organizationId;
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUsersByOrganization(organizationId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).where(eq(users.organizationId, organizationId));
}

export async function updateUserRole(userId: number, role: "retail_customer" | "therapist" | "salon_owner" | "admin") {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ role }).where(eq(users.id, userId));
}

// ============================================================================
// ORGANIZATION OPERATIONS
// ============================================================================

export async function createOrganization(org: InsertOrganization) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(organizations).values(org);
  return result[0].insertId;
}

export async function getOrganizationById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(organizations).where(eq(organizations.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getOrganizationsByOwner(ownerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(organizations).where(eq(organizations.ownerId, ownerId));
}

export async function updateOrganization(id: number, data: Partial<InsertOrganization>) {
  const db = await getDb();
  if (!db) return;
  await db.update(organizations).set(data).where(eq(organizations.id, id));
}

// ============================================================================
// LOCATION OPERATIONS
// ============================================================================

export async function createLocation(location: InsertLocation) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(locations).values(location);
  return result[0].insertId;
}

export async function getLocationsByOrganization(organizationId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(locations).where(eq(locations.organizationId, organizationId));
}

export async function getLocationById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(locations).where(eq(locations.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateLocation(id: number, data: Partial<InsertLocation>) {
  const db = await getDb();
  if (!db) return;
  await db.update(locations).set(data).where(eq(locations.id, id));
}

// ============================================================================
// THERAPIST OPERATIONS
// ============================================================================

export async function createTherapist(therapist: InsertTherapist) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(therapists).values(therapist);
  return result[0].insertId;
}

export async function getTherapistByUserId(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(therapists).where(eq(therapists.userId, userId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getTherapistsByOrganization(organizationId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    therapist: therapists,
    user: users,
  })
    .from(therapists)
    .innerJoin(users, eq(therapists.userId, users.id))
    .where(eq(therapists.organizationId, organizationId));
}

export async function updateTherapist(id: number, data: Partial<InsertTherapist>) {
  const db = await getDb();
  if (!db) return;
  await db.update(therapists).set(data).where(eq(therapists.id, id));
}

// ============================================================================
// CUSTOMER-THERAPIST ASSIGNMENT OPERATIONS
// ============================================================================

export async function assignCustomerToTherapist(assignment: InsertCustomerTherapistAssignment) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(customerTherapistAssignments).values(assignment);
  return result[0].insertId;
}

export async function getCustomersByTherapist(therapistId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    assignment: customerTherapistAssignments,
    customer: users,
  })
    .from(customerTherapistAssignments)
    .innerJoin(users, eq(customerTherapistAssignments.customerId, users.id))
    .where(and(
      eq(customerTherapistAssignments.therapistId, therapistId),
      eq(customerTherapistAssignments.isActive, true)
    ));
}

export async function getTherapistForCustomer(customerId: number, organizationId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select({
    assignment: customerTherapistAssignments,
    therapist: therapists,
    user: users,
  })
    .from(customerTherapistAssignments)
    .innerJoin(therapists, eq(customerTherapistAssignments.therapistId, therapists.id))
    .innerJoin(users, eq(therapists.userId, users.id))
    .where(and(
      eq(customerTherapistAssignments.customerId, customerId),
      eq(customerTherapistAssignments.organizationId, organizationId),
      eq(customerTherapistAssignments.isPrimary, true),
      eq(customerTherapistAssignments.isActive, true)
    ))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ============================================================================
// CONSULTATION OPERATIONS
// ============================================================================

export async function createConsultation(consultation: InsertConsultation) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(consultations).values(consultation);
  return result[0].insertId;
}

export async function getConsultationsByCustomer(customerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(consultations)
    .where(eq(consultations.customerId, customerId))
    .orderBy(desc(consultations.createdAt));
}

export async function getConsultationsByTherapist(therapistId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(consultations)
    .where(eq(consultations.therapistId, therapistId))
    .orderBy(desc(consultations.scheduledAt))
    .limit(limit);
}

export async function updateConsultation(id: number, data: Partial<InsertConsultation>) {
  const db = await getDb();
  if (!db) return;
  await db.update(consultations).set(data).where(eq(consultations.id, id));
}

// ============================================================================
// TREATMENT OPERATIONS
// ============================================================================

export async function createTreatment(treatment: InsertTreatment) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(treatments).values(treatment);
  return result[0].insertId;
}

export async function getTreatmentsByCustomer(customerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(treatments)
    .where(eq(treatments.customerId, customerId))
    .orderBy(desc(treatments.createdAt));
}

export async function getTreatmentsByTherapist(therapistId: number, startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) return [];
  
  let query = db.select().from(treatments).where(eq(treatments.therapistId, therapistId));
  
  if (startDate && endDate) {
    query = db.select().from(treatments).where(and(
      eq(treatments.therapistId, therapistId),
      gte(treatments.createdAt, startDate),
      lte(treatments.createdAt, endDate)
    ));
  }
  
  return query.orderBy(desc(treatments.createdAt));
}

export async function updateTreatment(id: number, data: Partial<InsertTreatment>) {
  const db = await getDb();
  if (!db) return;
  await db.update(treatments).set(data).where(eq(treatments.id, id));
}

// ============================================================================
// PRODUCT OPERATIONS
// ============================================================================

export async function createProduct(product: InsertProduct) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(products).values(product);
  return result[0].insertId;
}

export async function getProductsByOrganization(organizationId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(products)
    .where(and(eq(products.organizationId, organizationId), eq(products.isActive, true)));
}

export async function getProductByShopifyId(shopifyProductId: string, organizationId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(products)
    .where(and(
      eq(products.shopifyProductId, shopifyProductId),
      eq(products.organizationId, organizationId)
    ))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function upsertProduct(product: InsertProduct) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(products).values(product).onDuplicateKeyUpdate({
    set: {
      name: product.name,
      description: product.description,
      price: product.price,
      costPrice: product.costPrice,
      category: product.category,
      imageUrl: product.imageUrl,
      inventory: product.inventory,
      syncedAt: new Date(),
    },
  });
}

// ============================================================================
// ORDER OPERATIONS
// ============================================================================

export async function createOrder(order: InsertOrder) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(orders).values(order);
  return result[0].insertId;
}

export async function getOrderById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getOrdersByCustomer(customerId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(orders)
    .where(eq(orders.customerId, customerId))
    .orderBy(desc(orders.createdAt))
    .limit(limit);
}

export async function getOrdersByOrganization(organizationId: number, limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(orders)
    .where(eq(orders.organizationId, organizationId))
    .orderBy(desc(orders.createdAt))
    .limit(limit);
}

export async function updateOrder(id: number, data: Partial<InsertOrder>) {
  const db = await getDb();
  if (!db) return;
  await db.update(orders).set(data).where(eq(orders.id, id));
}

export async function createOrderItems(items: InsertOrderItem[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(orderItems).values(items);
}

export async function getOrderItems(orderId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
}

// ============================================================================
// PAYMENT OPERATIONS
// ============================================================================

export async function createPayment(payment: InsertPayment) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(payments).values(payment);
  return result[0].insertId;
}

export async function getPaymentByProcessorId(processorPaymentId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(payments)
    .where(eq(payments.processorPaymentId, processorPaymentId))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updatePayment(id: number, data: Partial<InsertPayment>) {
  const db = await getDb();
  if (!db) return;
  await db.update(payments).set(data).where(eq(payments.id, id));
}

export async function getPaymentsByOrganization(organizationId: number, startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) return [];
  
  if (startDate && endDate) {
    return db.select().from(payments).where(and(
      eq(payments.organizationId, organizationId),
      gte(payments.createdAt, startDate),
      lte(payments.createdAt, endDate)
    )).orderBy(desc(payments.createdAt));
  }
  
  return db.select().from(payments)
    .where(eq(payments.organizationId, organizationId))
    .orderBy(desc(payments.createdAt));
}

// ============================================================================
// COMMISSION OPERATIONS
// ============================================================================

export async function createCommission(commission: InsertCommission) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(commissions).values(commission);
  return result[0].insertId;
}

export async function getCommissionsByTherapist(therapistId: number, status?: string) {
  const db = await getDb();
  if (!db) return [];
  
  if (status) {
    return db.select().from(commissions).where(and(
      eq(commissions.therapistId, therapistId),
      eq(commissions.status, status as any)
    )).orderBy(desc(commissions.createdAt));
  }
  
  return db.select().from(commissions)
    .where(eq(commissions.therapistId, therapistId))
    .orderBy(desc(commissions.createdAt));
}

export async function getCommissionsByOrganization(organizationId: number, startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) return [];
  
  if (startDate && endDate) {
    return db.select().from(commissions).where(and(
      eq(commissions.organizationId, organizationId),
      gte(commissions.createdAt, startDate),
      lte(commissions.createdAt, endDate)
    )).orderBy(desc(commissions.createdAt));
  }
  
  return db.select().from(commissions)
    .where(eq(commissions.organizationId, organizationId))
    .orderBy(desc(commissions.createdAt));
}

export async function updateCommission(id: number, data: Partial<InsertCommission>) {
  const db = await getDb();
  if (!db) return;
  await db.update(commissions).set(data).where(eq(commissions.id, id));
}

export async function getCommissionSummaryByTherapist(therapistId: number, startDate: Date, endDate: Date) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select({
    totalCommission: sql<string>`SUM(${commissions.commissionAmount})`,
    totalBase: sql<string>`SUM(${commissions.baseAmount})`,
    count: sql<number>`COUNT(*)`,
  })
    .from(commissions)
    .where(and(
      eq(commissions.therapistId, therapistId),
      gte(commissions.createdAt, startDate),
      lte(commissions.createdAt, endDate)
    ));
  
  return result[0];
}

// ============================================================================
// BOOKING OPERATIONS
// ============================================================================

export async function createBooking(booking: InsertBooking) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(bookings).values(booking);
  return result[0].insertId;
}

export async function getBookingById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(bookings).where(eq(bookings.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getBookingsByOrganization(organizationId: number, startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) return [];
  
  if (startDate && endDate) {
    return db.select().from(bookings).where(and(
      eq(bookings.organizationId, organizationId),
      gte(bookings.scheduledAt, startDate),
      lte(bookings.scheduledAt, endDate)
    )).orderBy(desc(bookings.scheduledAt));
  }
  
  return db.select().from(bookings)
    .where(eq(bookings.organizationId, organizationId))
    .orderBy(desc(bookings.scheduledAt));
}

export async function getBookingsByTherapist(therapistId: number, startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) return [];
  
  if (startDate && endDate) {
    return db.select().from(bookings).where(and(
      eq(bookings.therapistId, therapistId),
      gte(bookings.scheduledAt, startDate),
      lte(bookings.scheduledAt, endDate)
    )).orderBy(bookings.scheduledAt);
  }
  
  return db.select().from(bookings)
    .where(eq(bookings.therapistId, therapistId))
    .orderBy(bookings.scheduledAt);
}

export async function updateBooking(id: number, data: Partial<InsertBooking>) {
  const db = await getDb();
  if (!db) return;
  await db.update(bookings).set(data).where(eq(bookings.id, id));
}

// ============================================================================
// ACCOUNTING SYNC OPERATIONS
// ============================================================================

export async function createAccountingSyncLog(log: InsertAccountingSyncLog) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(accountingSyncLog).values(log);
  return result[0].insertId;
}

export async function updateAccountingSyncLog(id: number, data: Partial<InsertAccountingSyncLog>) {
  const db = await getDb();
  if (!db) return;
  await db.update(accountingSyncLog).set(data).where(eq(accountingSyncLog.id, id));
}

// ============================================================================
// PURCHASE ORDER OPERATIONS
// ============================================================================

export async function createPurchaseOrder(po: InsertPurchaseOrder) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(purchaseOrders).values(po);
  return result[0].insertId;
}

export async function getPurchaseOrdersByOrganization(organizationId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(purchaseOrders)
    .where(eq(purchaseOrders.organizationId, organizationId))
    .orderBy(desc(purchaseOrders.createdAt));
}

export async function updatePurchaseOrder(id: number, data: Partial<InsertPurchaseOrder>) {
  const db = await getDb();
  if (!db) return;
  await db.update(purchaseOrders).set(data).where(eq(purchaseOrders.id, id));
}

export async function createPurchaseOrderItems(items: InsertPurchaseOrderItem[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(purchaseOrderItems).values(items);
}

// ============================================================================
// SUPPLIER OPERATIONS
// ============================================================================

export async function createSupplier(supplier: InsertSupplier) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(suppliers).values(supplier);
  return result[0].insertId;
}

export async function getSuppliersByOrganization(organizationId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(suppliers)
    .where(and(eq(suppliers.organizationId, organizationId), eq(suppliers.isActive, true)));
}

// ============================================================================
// NOTIFICATION OPERATIONS
// ============================================================================

export async function createNotification(notification: InsertNotification) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(notifications).values(notification);
  return result[0].insertId;
}

export async function getNotificationsByUser(userId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

export async function markNotificationRead(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(notifications).set({ isRead: true }).where(eq(notifications.id, id));
}

export async function markNotificationEmailSent(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(notifications).set({ emailSent: true, emailSentAt: new Date() }).where(eq(notifications.id, id));
}

// ============================================================================
// REPORT OPERATIONS
// ============================================================================

export async function createReport(report: InsertReport) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(reports).values(report);
  return result[0].insertId;
}

export async function getReportsByOrganization(organizationId: number, type?: string) {
  const db = await getDb();
  if (!db) return [];
  
  if (type) {
    return db.select().from(reports).where(and(
      eq(reports.organizationId, organizationId),
      eq(reports.type, type as any)
    )).orderBy(desc(reports.createdAt));
  }
  
  return db.select().from(reports)
    .where(eq(reports.organizationId, organizationId))
    .orderBy(desc(reports.createdAt));
}

// ============================================================================
// INTEGRATION CREDENTIALS OPERATIONS
// ============================================================================

export async function saveIntegrationCredentials(creds: InsertIntegrationCredential) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(integrationCredentials).values(creds).onDuplicateKeyUpdate({
    set: {
      credentials: creds.credentials,
      expiresAt: creds.expiresAt,
      refreshToken: creds.refreshToken,
      isActive: true,
      updatedAt: new Date(),
    },
  });
}

export async function getIntegrationCredentials(organizationId: number, integration: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(integrationCredentials)
    .where(and(
      eq(integrationCredentials.organizationId, organizationId),
      eq(integrationCredentials.integration, integration as any),
      eq(integrationCredentials.isActive, true)
    ))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ============================================================================
// AUDIT LOG OPERATIONS
// ============================================================================

export async function createAuditLog(log: InsertAuditLog) {
  const db = await getDb();
  if (!db) return;
  await db.insert(auditLog).values(log);
}

// ============================================================================
// ANALYTICS QUERIES
// ============================================================================

export async function getOrganizationStats(organizationId: number, startDate: Date, endDate: Date) {
  const db = await getDb();
  if (!db) return null;
  
  const [orderStats] = await db.select({
    totalOrders: sql<number>`COUNT(*)`,
    totalRevenue: sql<string>`SUM(${orders.total})`,
    avgOrderValue: sql<string>`AVG(${orders.total})`,
  })
    .from(orders)
    .where(and(
      eq(orders.organizationId, organizationId),
      gte(orders.createdAt, startDate),
      lte(orders.createdAt, endDate)
    ));
  
  const [bookingStats] = await db.select({
    totalBookings: sql<number>`COUNT(*)`,
    completedBookings: sql<number>`SUM(CASE WHEN ${bookings.status} = 'completed' THEN 1 ELSE 0 END)`,
  })
    .from(bookings)
    .where(and(
      eq(bookings.organizationId, organizationId),
      gte(bookings.scheduledAt, startDate),
      lte(bookings.scheduledAt, endDate)
    ));
  
  const [commissionStats] = await db.select({
    totalCommissions: sql<string>`SUM(${commissions.commissionAmount})`,
    pendingCommissions: sql<string>`SUM(CASE WHEN ${commissions.status} = 'pending' THEN ${commissions.commissionAmount} ELSE 0 END)`,
  })
    .from(commissions)
    .where(and(
      eq(commissions.organizationId, organizationId),
      gte(commissions.createdAt, startDate),
      lte(commissions.createdAt, endDate)
    ));
  
  return {
    orders: orderStats,
    bookings: bookingStats,
    commissions: commissionStats,
  };
}

export async function getCustomerDistributionByLocation(organizationId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select({
    locationId: locations.id,
    locationName: locations.name,
    latitude: locations.latitude,
    longitude: locations.longitude,
    customerCount: sql<number>`COUNT(DISTINCT ${customerTherapistAssignments.customerId})`,
  })
    .from(locations)
    .leftJoin(therapists, eq(therapists.locationId, locations.id))
    .leftJoin(customerTherapistAssignments, eq(customerTherapistAssignments.therapistId, therapists.id))
    .where(eq(locations.organizationId, organizationId))
    .groupBy(locations.id, locations.name, locations.latitude, locations.longitude);
}
