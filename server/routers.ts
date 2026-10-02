import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { TRPCError } from "@trpc/server";
import { acceptBookingDelivery, acceptOrderFulfillments, acceptOrderSaleReturns, acceptPaymentReturn, acceptPurchaseReceipt, acceptSaleReturn, acceptShopifyCatalog, acceptSupplierQualification, acceptSupplyChainCommand, acceptTreatmentProducts, catalogProduct, namedSale, paymentForSettlement, paymentIntentMetadata, paystackInitializeMetadata, recordSettlement, recordSkinOutcome, storedOrderLine, verifiedPaystackSettlement } from "./supplyChain";

// Admin-only procedure
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
  }
  return next({ ctx });
});

// Therapist-only procedure
const therapistProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const therapist = await db.getTherapistByUserId(ctx.user.id);
  if (!therapist) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Therapist access required' });
  }
  return next({ ctx: { ...ctx, therapist } });
});

// Salon owner procedure
const salonOwnerProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (!ctx.user.organizationId) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Organization access required' });
  }
  const org = await db.getOrganizationById(ctx.user.organizationId);
  if (!org || org.ownerId !== ctx.user.id) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Salon owner access required' });
  }
  return next({ ctx: { ...ctx, organization: org } });
});

// ============================================================================
// AUTH ROUTER
// ============================================================================
const authRouter = router({
  me: publicProcedure.query(opts => opts.ctx.user),
  logout: publicProcedure.mutation(({ ctx }) => {
    const cookieOptions = getSessionCookieOptions(ctx.req);
    ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    return { success: true } as const;
  }),
  getProfile: protectedProcedure.query(async ({ ctx }) => {
    return ctx.user;
  }),
});

// ============================================================================
// USER ROUTER
// ============================================================================
const userRouter = router({
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const user = await db.getUserById(input.id);
      if (!user) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
      }
      return user;
    }),
  
  getByOrganization: protectedProcedure
    .input(z.object({ organizationId: z.number() }))
    .query(async ({ input }) => {
      return db.getUsersByOrganization(input.organizationId);
    }),
  
  updateRole: adminProcedure
    .input(z.object({
      userId: z.number(),
      role: z.enum(['retail_customer', 'therapist', 'salon_owner', 'admin']),
    }))
    .mutation(async ({ input }) => {
      await db.updateUserRole(input.userId, input.role);
      return { success: true };
    }),
});

// ============================================================================
// ORGANIZATION ROUTER
// ============================================================================
const organizationRouter = router({
  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const org = await db.getOrganizationById(input.id);
      if (!org) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Organization not found' });
      }
      return org;
    }),
  
  getByOwner: protectedProcedure.query(async ({ ctx }) => {
    return db.getOrganizationsByOwner(ctx.user.id);
  }),
  
  create: adminProcedure
    .input(z.object({
      name: z.string(),
      ownerId: z.number(),
      type: z.enum(['salon', 'retail', 'distributor']),
    }))
    .mutation(async ({ input }) => {
      const id = await db.createOrganization(input);
      return { id };
    }),
  
  update: salonOwnerProcedure
    .input(z.object({
      name: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await db.updateOrganization(ctx.organization.id, input);
      return { success: true };
    }),
  
  getLocations: protectedProcedure
    .input(z.object({ organizationId: z.number() }))
    .query(async ({ input }) => {
      return db.getLocationsByOrganization(input.organizationId);
    }),
  
  addLocation: salonOwnerProcedure
    .input(z.object({
      name: z.string(),
      address: z.string().optional(),
      city: z.string().optional(),
      country: z.string().optional(),
      postalCode: z.string().optional(),
      latitude: z.string().optional(),
      longitude: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().email().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const id = await db.createLocation({ ...input, organizationId: ctx.organization.id });
      return { id };
    }),
  
  getStats: salonOwnerProcedure
    .input(z.object({
      startDate: z.date(),
      endDate: z.date(),
    }))
    .query(async ({ ctx, input }) => {
      return db.getOrganizationStats(ctx.organization.id, input.startDate, input.endDate);
    }),
  
  getCustomerDistribution: salonOwnerProcedure.query(async ({ ctx }) => {
    return db.getCustomerDistributionByLocation(ctx.organization.id);
  }),
});

// ============================================================================
// THERAPIST ROUTER
// ============================================================================
const therapistRouter = router({
  getByOrganization: protectedProcedure
    .input(z.object({ organizationId: z.number() }))
    .query(async ({ input }) => {
      return db.getTherapistsByOrganization(input.organizationId);
    }),
  
  getByUserId: protectedProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ input }) => {
      const therapist = await db.getTherapistByUserId(input.userId);
      if (!therapist) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Therapist not found' });
      }
      return therapist;
    }),
  
  create: adminProcedure
    .input(z.object({
      userId: z.number(),
      organizationId: z.number(),
      locationId: z.number().optional(),
      specializations: z.any().optional(),
      commissionRate: z.string().default("10.00"),
    }))
    .mutation(async ({ input }) => {
      const id = await db.createTherapist(input);
      return { id };
    }),
  
  update: adminProcedure
    .input(z.object({
      id: z.number(),
      specializations: z.any().optional(),
      commissionRate: z.string().optional(),
      isAvailable: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      await db.updateTherapist(id, data);
      return { success: true };
    }),
  
  getMyProfile: therapistProcedure.query(async ({ ctx }) => {
    return ctx.therapist;
  }),
  
  getMyCustomers: therapistProcedure.query(async ({ ctx }) => {
    return db.getCustomersByTherapist(ctx.therapist.id);
  }),
  
  getMyCommissions: therapistProcedure
    .input(z.object({
      status: z.enum(['pending', 'approved', 'paid', 'cancelled']).optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      return db.getCommissionsByTherapist(ctx.therapist.id, input?.status);
    }),
  
  getMyConsultations: therapistProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(50) }))
    .query(async ({ ctx, input }) => {
      return db.getConsultationsByTherapist(ctx.therapist.id, input.limit);
    }),
  
  getMyBookings: therapistProcedure
    .input(z.object({
      startDate: z.date().optional(),
      endDate: z.date().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      return db.getBookingsByTherapist(ctx.therapist.id, input?.startDate, input?.endDate);
    }),
  
  getMyTreatments: therapistProcedure
    .input(z.object({
      startDate: z.date().optional(),
      endDate: z.date().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      return db.getTreatmentsByTherapist(ctx.therapist.id, input?.startDate, input?.endDate);
    }),
});

// ============================================================================
// CUSTOMER-THERAPIST ASSIGNMENT ROUTER
// ============================================================================
const assignmentRouter = router({
  assign: protectedProcedure
    .input(z.object({
      customerId: z.number(),
      therapistId: z.number(),
      organizationId: z.number(),
      isPrimary: z.boolean().default(true),
    }))
    .mutation(async ({ input }) => {
      const id = await db.assignCustomerToTherapist(input);
      return { id };
    }),
  
  getTherapistForCustomer: protectedProcedure
    .input(z.object({
      customerId: z.number(),
      organizationId: z.number(),
    }))
    .query(async ({ input }) => {
      return db.getTherapistForCustomer(input.customerId, input.organizationId);
    }),
});

// ============================================================================
// CONSULTATION ROUTER
// ============================================================================
const consultationRouter = router({
  getByCustomer: protectedProcedure
    .input(z.object({ customerId: z.number() }))
    .query(async ({ input }) => {
      return db.getConsultationsByCustomer(input.customerId);
    }),
  
  create: therapistProcedure
    .input(z.object({
      customerId: z.number(),
      organizationId: z.number(),
      type: z.enum(['initial', 'follow_up', 'treatment', 'review']),
      skinAnalysis: z.any().optional(),
      recommendations: z.any().optional(),
      notes: z.string().optional(),
      scheduledAt: z.date().optional(),
      duration: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const recorded = recordSkinOutcome(input.skinAnalysis);
      if (!recorded.ok) {
        throw new TRPCError({ code: "BAD_REQUEST", message: recorded.error });
      }
      const id = await db.createConsultation({
        ...input,
        therapistId: ctx.therapist.id,
      });
      return { id };
    }),
  
  update: therapistProcedure
    .input(z.object({
      id: z.number(),
      skinAnalysis: z.any().optional(),
      recommendations: z.any().optional(),
      notes: z.string().optional(),
      status: z.enum(['scheduled', 'in_progress', 'completed', 'cancelled', 'no_show']).optional(),
    }))
    .mutation(async ({ input }) => {
      const recorded = recordSkinOutcome(input.skinAnalysis);
      if (!recorded.ok) {
        throw new TRPCError({ code: "BAD_REQUEST", message: recorded.error });
      }
      const { id, ...data } = input;
      await db.updateConsultation(id, data);
      return { success: true };
    }),
});

// ============================================================================
// TREATMENT ROUTER
// ============================================================================
const treatmentRouter = router({
  getByCustomer: protectedProcedure
    .input(z.object({ customerId: z.number() }))
    .query(async ({ input }) => {
      return db.getTreatmentsByCustomer(input.customerId);
    }),
  
  create: therapistProcedure
    .input(z.object({
      customerId: z.number(),
      organizationId: z.number(),
      consultationId: z.number().optional(),
      serviceName: z.string(),
      description: z.string().optional(),
      productsUsed: z.any().optional(),
      notes: z.string().optional(),
      price: z.string(),
      duration: z.number().optional(),
      reference: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { reference, ...treatment } = input;
      const drawn = acceptTreatmentProducts(reference, treatment.productsUsed, String(ctx.therapist.id));
      if (!drawn.ok) {
        throw new TRPCError({ code: "BAD_REQUEST", message: drawn.error });
      }
      const id = await db.createTreatment({
        ...treatment,
        therapistId: ctx.therapist.id,
      });
      return { id };
    }),
  
  update: therapistProcedure
    .input(z.object({
      id: z.number(),
      serviceName: z.string().optional(),
      description: z.string().optional(),
      productsUsed: z.any().optional(),
      notes: z.string().optional(),
      price: z.string().optional(),
      reference: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, reference, ...data } = input;
      if (data.productsUsed !== undefined) {
        const drawn = acceptTreatmentProducts(reference, data.productsUsed, String(ctx.therapist.id));
        if (!drawn.ok) {
          throw new TRPCError({ code: "BAD_REQUEST", message: drawn.error });
        }
      }
      await db.updateTreatment(id, data);
      return { success: true };
    }),
});

// ============================================================================
// PRODUCT ROUTER
// ============================================================================
const productRouter = router({
  getByOrganization: protectedProcedure
    .input(z.object({ organizationId: z.number() }))
    .query(async ({ input }) => {
      return db.getProductsByOrganization(input.organizationId);
    }),
  
  create: adminProcedure
    .input(z.object({
      organizationId: z.number(),
      name: z.string(),
      description: z.string().optional(),
      sku: z.string().optional(),
      sku_id: z.string().optional(),
      skuId: z.string().optional(),
      formulaId: z.string().optional(),
      formula_id: z.string().optional(),
      price: z.string(),
      costPrice: z.string().optional(),
      category: z.string().optional(),
      imageUrl: z.string().optional(),
      inventory: z.number().default(0),
    }))
    .mutation(async ({ input }) => {
      const formulaId = input.formulaId?.trim() || input.formula_id?.trim();
      const postedSku = [input.sku, input.sku_id, input.skuId].find(
        (value) => typeof value === "string" && value.trim() !== "",
      )?.trim();
      if (formulaId) {
        const accepted = catalogProduct({
          ...input,
          formulaId,
        });
        if (!accepted.ok) {
          throw new TRPCError({ code: "BAD_REQUEST", message: accepted.error });
        }
      }
      const { formulaId: _formulaId, formula_id: _formulaSnake, sku_id: _skuSnake, skuId: _skuCamel, ...product } = input;
      if (formulaId) product.sku = postedSku || input.name;
      const id = await db.createProduct(product);
      return { id };
    }),
  
  syncFromShopify: adminProcedure
    .input(z.object({ organizationId: z.number() }))
    .mutation(async ({ input }) => {
      const creds = await db.getIntegrationCredentials(input.organizationId, 'shopify');
      if (!creds) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Shopify integration not configured' });
      }
      
      const { createShopifyService } = await import('./integrations/shopify');
      const credentials = JSON.parse(creds.credentials);
      const shopify = createShopifyService(
        credentials.storeUrl,
        credentials.accessToken
      );
      
      const products = await shopify.getAllProducts();
      const recorded = acceptShopifyCatalog(products);
      if (!recorded.ok) {
        throw new TRPCError({ code: "BAD_REQUEST", message: recorded.error });
      }
      let synced = 0;
      
      for (const product of products) {
        await db.upsertProduct({
          organizationId: input.organizationId,
          shopifyProductId: product.id.toString(),
          name: product.title,
          description: product.body_html,
          sku: product.variants[0]?.sku,
          price: product.variants[0]?.price || '0',
          category: product.product_type,
          imageUrl: product.images[0]?.src,
          isActive: product.status === 'active',
        });
        synced++;
      }
      
      return { synced };
    }),
});

// ============================================================================
// ORDER ROUTER
// ============================================================================
const orderRouter = router({
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const order = await db.getOrderById(input.id);
      if (!order) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Order not found' });
      }
      return order;
    }),
  
  getByCustomer: protectedProcedure
    .input(z.object({
      customerId: z.number(),
      limit: z.number().min(1).max(100).default(50),
    }))
    .query(async ({ input }) => {
      return db.getOrdersByCustomer(input.customerId, input.limit);
    }),
  
  getByOrganization: protectedProcedure
    .input(z.object({
      organizationId: z.number(),
      limit: z.number().min(1).max(100).default(100),
    }))
    .query(async ({ input }) => {
      return db.getOrdersByOrganization(input.organizationId, input.limit);
    }),
  
  create: protectedProcedure
    .input(z.object({
      customerId: z.number(),
      organizationId: z.number(),
      orderNumber: z.string(),
      therapistId: z.number().optional(),
      subtotal: z.string(),
      tax: z.string().default('0.00'),
      discount: z.string().default('0.00'),
      total: z.string(),
      shippingAddress: z.any().optional(),
      billingAddress: z.any().optional(),
      items: z.array(z.object({
        productId: z.number().optional(),
        name: z.string(),
        sku: z.string().optional(),
        sku_id: z.string().optional(),
        skuId: z.string().optional(),
        quantity: z.number(),
        unitPrice: z.string(),
        total: z.string(),
        type: z.enum(['product', 'treatment', 'service']).default('product'),
        location: z.string().optional(),
        milligrams: z.number().int().positive().optional(),
        practitionerId: z.string().optional(),
        practitioner_id: z.string().optional(),
      })),
    }))
    .mutation(async ({ input }) => {
      const { items, ...orderData } = input;
      const drawn = acceptOrderFulfillments(input.orderNumber, items, input.therapistId);
      if (!drawn.ok) {
        throw new TRPCError({ code: "BAD_REQUEST", message: drawn.error });
      }
      const orderId = await db.createOrder(orderData);
      
      const orderItems = items.map(item => ({
        orderId,
        ...storedOrderLine(item),
      }));
      await db.createOrderItems(orderItems);
      
      return { id: orderId };
    }),
  
  updateStatus: protectedProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded']),
      fulfillmentId: z.string().optional(),
      fulfillment_id: z.string().optional(),
      returnId: z.string().optional(),
      return_id: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const sale = namedSale(input);
      if (input.status === "refunded" || input.status === "cancelled") {
        const returned = sale.fulfillmentId
          ? acceptSaleReturn(
            sale.returnId || `return:${input.id}:${sale.fulfillmentId}`,
            sale.fulfillmentId,
          )
          : acceptOrderSaleReturns(
            (await db.getOrderById(input.id))?.orderNumber,
            await db.getOrderItems(input.id),
            input.id,
          );
        if (!returned.ok) {
          throw new TRPCError({ code: "BAD_REQUEST", message: returned.error });
        }
      }
      const {
        fulfillmentId: _fulfillmentId,
        fulfillment_id: _fulfillmentSnake,
        returnId: _returnId,
        return_id: _returnSnake,
        ...status
      } = input;
      await db.updateOrder(status.id, { status: status.status });
      return { success: true };
    }),
  
  getItems: protectedProcedure
    .input(z.object({ orderId: z.number() }))
    .query(async ({ input }) => {
      return db.getOrderItems(input.orderId);
    }),
});

// ============================================================================
// PAYMENT ROUTER
// ============================================================================
const paymentRouter = router({
  getByProcessorId: protectedProcedure
    .input(z.object({ processorPaymentId: z.string() }))
    .query(async ({ input }) => {
      const payment = await db.getPaymentByProcessorId(input.processorPaymentId);
      if (!payment) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Payment not found' });
      }
      return payment;
    }),
  
  getByOrganization: protectedProcedure
    .input(z.object({
      organizationId: z.number(),
      startDate: z.date().optional(),
      endDate: z.date().optional(),
    }))
    .query(async ({ input }) => {
      return db.getPaymentsByOrganization(input.organizationId, input.startDate, input.endDate);
    }),
  
  initializeStripe: protectedProcedure
    .input(z.object({
      orderId: z.number().optional(),
      organizationId: z.number(),
      customerId: z.number(),
      amount: z.number(),
      currency: z.string().default('USD'),
      fulfillmentId: z.string().optional(),
      fulfillment_id: z.string().optional(),
      settlementId: z.string().optional(),
      settlement_id: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { createPaymentIntent } = await import('./integrations/stripe');
      const sale = namedSale(input);
      
      const paymentIntent = await createPaymentIntent({
        amount: Math.round(input.amount * 100),
        currency: input.currency,
        metadata: paymentIntentMetadata({
          userId: ctx.user.id.toString(),
          orderId: input.orderId?.toString() || '',
          fulfillmentId: sale.fulfillmentId,
          settlementId: sale.settlementId,
        }),
      });
      
      const paymentId = await db.createPayment({
        orderId: input.orderId,
        organizationId: input.organizationId,
        customerId: input.customerId,
        processor: 'stripe',
        processorPaymentId: paymentIntent.id,
        amount: input.amount.toFixed(2),
        currency: input.currency,
        status: 'pending',
      });
      
      return {
        paymentId,
        clientSecret: paymentIntent.client_secret,
      };
    }),
  
  initializePaystack: protectedProcedure
    .input(z.object({
      orderId: z.number().optional(),
      organizationId: z.number(),
      customerId: z.number(),
      amount: z.number(),
      currency: z.string().default('NGN'),
      email: z.string().email(),
      callbackUrl: z.string(),
      fulfillmentId: z.string().optional(),
      fulfillment_id: z.string().optional(),
      settlementId: z.string().optional(),
      settlement_id: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { createPaystackService } = await import('./integrations/paystack');
      const paystack = createPaystackService();
      const sale = namedSale(input);
      
      const result = await paystack.initializeTransaction({
        email: input.email,
        amount: Math.round(input.amount * 100),
        currency: input.currency,
        callback_url: input.callbackUrl,
        metadata: paystackInitializeMetadata({
          userId: ctx.user.id,
          orderId: input.orderId,
          fulfillmentId: sale.fulfillmentId,
          settlementId: sale.settlementId,
        }),
      });
      
      const paymentId = await db.createPayment({
        orderId: input.orderId,
        organizationId: input.organizationId,
        customerId: input.customerId,
        processor: 'paystack',
        processorPaymentId: result.reference,
        amount: input.amount.toFixed(2),
        currency: input.currency,
        status: 'pending',
      });
      
      return {
        paymentId,
        authorizationUrl: result.authorization_url,
        reference: result.reference,
      };
    }),
  
  verifyPaystack: protectedProcedure
    .input(z.object({
      reference: z.string(),
      settlementId: z.string().optional(),
      settlement_id: z.string().optional(),
      fulfillmentId: z.string().optional(),
      fulfillment_id: z.string().optional(),
      amount: z.number().optional(),
      currency: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const { createPaystackService } = await import('./integrations/paystack');
      const paystack = createPaystackService();
      const sale = namedSale(input);
      
      const transaction = await paystack.verifyTransaction(input.reference);
      
      const payment = await db.getPaymentByProcessorId(input.reference);
      const settlement = verifiedPaystackSettlement(transaction, {
        fulfillmentId: sale.fulfillmentId,
        settlementId: sale.settlementId,
        amount: input.amount != null ? input.amount : sale.fulfillmentId ? Number(payment?.amount) : undefined,
        currency: input.currency || payment?.currency,
      });
      if (settlement) {
        const recorded = recordSettlement(settlement);
        if (!recorded.ok) {
          throw new TRPCError({ code: "BAD_REQUEST", message: recorded.error });
        }
      }
      if (payment) {
        await db.updatePayment(payment.id, {
          status: transaction.status === 'success' ? 'succeeded' : 'failed',
        });
      }
      
      return transaction;
    }),
  
  update: adminProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(['pending', 'succeeded', 'failed', 'refunded', 'partially_refunded']).optional(),
      settlementId: z.string().optional(),
      settlement_id: z.string().optional(),
      fulfillmentId: z.string().optional(),
      fulfillment_id: z.string().optional(),
      returnId: z.string().optional(),
      return_id: z.string().optional(),
      amount: z.number().optional(),
      currency: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const sale = namedSale(input);
      if (input.status === "succeeded" && sale.fulfillmentId) {
        const stored = await db.getPayment(input.id);
        const recorded = recordSettlement(paymentForSettlement(input, stored));
        if (!recorded.ok) {
          throw new TRPCError({ code: "BAD_REQUEST", message: recorded.error });
        }
      }
      if (input.status === "refunded") {
        let returned;
        if (sale.fulfillmentId) {
          returned = acceptPaymentReturn(input);
        } else {
          const stored = await db.getPayment(input.id);
          const order = stored?.orderId ? await db.getOrderById(stored.orderId) : undefined;
          returned = acceptOrderSaleReturns(
            order?.orderNumber,
            order ? await db.getOrderItems(order.id) : [],
            input.id,
          );
        }
        if (!returned.ok) {
          throw new TRPCError({ code: "BAD_REQUEST", message: returned.error });
        }
      }
      const {
        id,
        settlementId: _settlementId,
        settlement_id: _settlementSnake,
        fulfillmentId: _fulfillmentId,
        fulfillment_id: _fulfillmentSnake,
        returnId: _returnId,
        return_id: _returnSnake,
        amount: _amount,
        currency: _currency,
        ...data
      } = input;
      await db.updatePayment(id, data);
      return { success: true };
    }),
});

// ============================================================================
// COMMISSION ROUTER
// ============================================================================
const commissionRouter = router({
  getByOrganization: adminProcedure
    .input(z.object({
      organizationId: z.number(),
      startDate: z.date().optional(),
      endDate: z.date().optional(),
    }))
    .query(async ({ input }) => {
      return db.getCommissionsByOrganization(input.organizationId, input.startDate, input.endDate);
    }),
  
  create: protectedProcedure
    .input(z.object({
      therapistId: z.number(),
      organizationId: z.number(),
      orderId: z.number().optional(),
      treatmentId: z.number().optional(),
      type: z.enum(['treatment', 'product_sale', 'referral']),
      baseAmount: z.string(),
      commissionRate: z.string(),
      commissionAmount: z.string(),
    }))
    .mutation(async ({ input }) => {
      const id = await db.createCommission(input);
      return { id };
    }),
  
  approve: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.updateCommission(input.id, { status: 'approved' });
      return { success: true };
    }),
  
  markPaid: adminProcedure
    .input(z.object({
      id: z.number(),
      paidAt: z.date().optional(),
    }))
    .mutation(async ({ input }) => {
      await db.updateCommission(input.id, {
        status: 'paid',
        paidAt: input.paidAt || new Date(),
      });
      return { success: true };
    }),
  
  cancel: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.updateCommission(input.id, { status: 'cancelled' });
      return { success: true };
    }),
  
  getSummary: therapistProcedure
    .input(z.object({
      startDate: z.date(),
      endDate: z.date(),
    }))
    .query(async ({ ctx, input }) => {
      return db.getCommissionSummaryByTherapist(ctx.therapist.id, input.startDate, input.endDate);
    }),
});

// ============================================================================
// BOOKING ROUTER
// ============================================================================
const bookingRouter = router({
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const booking = await db.getBookingById(input.id);
      if (!booking) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Booking not found' });
      }
      return booking;
    }),
  
  getByOrganization: protectedProcedure
    .input(z.object({
      organizationId: z.number(),
      startDate: z.date().optional(),
      endDate: z.date().optional(),
    }))
    .query(async ({ input }) => {
      return db.getBookingsByOrganization(input.organizationId, input.startDate, input.endDate);
    }),
  
  create: protectedProcedure
    .input(z.object({
      organizationId: z.number(),
      locationId: z.number().optional(),
      customerId: z.number(),
      therapistId: z.number().optional(),
      serviceType: z.string(),
      serviceName: z.string(),
      scheduledAt: z.date(),
      duration: z.number(),
      price: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const id = await db.createBooking(input);
      return { id };
    }),
  
  confirm: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.updateBooking(input.id, { status: 'confirmed' });
      return { success: true };
    }),
  
  complete: protectedProcedure
    .input(z.object({
      id: z.number(),
      delivery: z.object({
        sku: z.string().optional(),
        skuId: z.string().optional(),
        sku_id: z.string().optional(),
        batchId: z.string().optional(),
        batch_id: z.string().optional(),
        source: z.string(),
        destination: z.string(),
        milligrams: z.number().int().positive(),
      }).optional(),
    }))
    .mutation(async ({ input }) => {
      if (input.delivery) {
        const moved = acceptBookingDelivery(String(input.id), input.delivery);
        if (!moved.ok) {
          throw new TRPCError({ code: "BAD_REQUEST", message: moved.error });
        }
      }
      await db.updateBooking(input.id, { status: 'completed' });
      return { success: true };
    }),
  
  cancel: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.updateBooking(input.id, { status: 'cancelled' });
      return { success: true };
    }),
});

// ============================================================================
// INTEGRATION CREDENTIALS ROUTER
// ============================================================================
const integrationRouter = router({
  get: adminProcedure
    .input(z.object({
      organizationId: z.number(),
      integration: z.enum(['shopify', 'stripe', 'paystack', 'wix', 'quickbooks', 'xero', 'erpnext', 'workos']),
    }))
    .query(async ({ input }) => {
      return db.getIntegrationCredentials(input.organizationId, input.integration);
    }),
  
  save: adminProcedure
    .input(z.object({
      organizationId: z.number(),
      integration: z.enum(['shopify', 'stripe', 'paystack', 'wix', 'quickbooks', 'xero', 'erpnext', 'workos']),
      credentials: z.string(), // JSON string
      expiresAt: z.date().optional(),
      refreshToken: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      await db.saveIntegrationCredentials(input);
      return { success: true };
    }),
  
  testConnection: adminProcedure
    .input(z.object({
      platform: z.enum(['shopify', 'stripe', 'paystack', 'wix', 'quickbooks', 'xero', 'erpnext']),
      credentials: z.string(), // JSON string
    }))
    .mutation(async ({ input }) => {
      try {
        const creds = JSON.parse(input.credentials);
        switch (input.platform) {
          case 'shopify': {
            const { createShopifyService } = await import('./integrations/shopify');
            const shopify = createShopifyService(creds.storeUrl, creds.accessToken);
            await shopify.getLocations();
            return { success: true, message: 'Shopify connection successful' };
          }
          case 'quickbooks': {
            const { createQuickBooksService } = await import('./integrations/quickbooks');
            const qb = createQuickBooksService(
              creds.realmId,
              creds.accessToken,
              creds.environment || 'sandbox'
            );
            await qb.getCompanyInfo();
            return { success: true, message: 'QuickBooks connection successful' };
          }
          default:
            return { success: true, message: 'Connection test not implemented for this platform' };
        }
      } catch (error: any) {
        return { success: false, message: error.message };
      }
    }),
});

// ============================================================================
// SUPPLIER ROUTER
// ============================================================================
const supplierRouter = router({
  getByOrganization: protectedProcedure
    .input(z.object({ organizationId: z.number() }))
    .query(async ({ input }) => {
      return db.getSuppliersByOrganization(input.organizationId);
    }),
  
  create: adminProcedure
    .input(z.object({
      organizationId: z.number(),
      name: z.string(),
      contactName: z.string().optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      address: z.string().optional(),
      erpnextSupplierId: z.string().optional(),
      ingredientId: z.string().optional(),
      ingredient_id: z.string().optional(),
      qualificationId: z.string().optional(),
      qualification_id: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const accepted = acceptSupplierQualification(input);
      if (!accepted.ok) {
        throw new TRPCError({ code: "BAD_REQUEST", message: accepted.error });
      }
      const {
        ingredientId: _ingredientId,
        ingredient_id: _ingredientSnake,
        qualificationId: _qualificationId,
        qualification_id: _qualificationSnake,
        ...supplier
      } = input;
      const id = await db.createSupplier(supplier);
      return { id };
    }),
});

// ============================================================================
// PURCHASE ORDER ROUTER
// ============================================================================
const purchaseOrderRouter = router({
  getByOrganization: protectedProcedure
    .input(z.object({ organizationId: z.number() }))
    .query(async ({ input }) => {
      return db.getPurchaseOrdersByOrganization(input.organizationId);
    }),
  
  create: adminProcedure
    .input(z.object({
      organizationId: z.number(),
      supplierId: z.number().optional(),
      poNumber: z.string(),
      subtotal: z.string(),
      tax: z.string().default('0.00'),
      total: z.string(),
      currency: z.string().default('USD'),
      expectedDelivery: z.date().optional(),
      notes: z.string().optional(),
      items: z.array(z.object({
        productId: z.number().optional(),
        name: z.string(),
        quantity: z.number(),
        unitPrice: z.string(),
        total: z.string(),
      })),
    }))
    .mutation(async ({ input }) => {
      const { items, ...poData } = input;
      const poId = await db.createPurchaseOrder(poData);
      
      const poItems = items.map(item => ({
        purchaseOrderId: poId,
        ...item,
      }));
      await db.createPurchaseOrderItems(poItems);
      
      return { id: poId };
    }),
  
  updateStatus: adminProcedure
    .input(z.object({
      id: z.number(),
      poNumber: z.string().optional(),
      status: z.enum(['draft', 'submitted', 'approved', 'received', 'cancelled']),
      receipts: z.array(z.object({
        ingredientId: z.string().optional(),
        ingredient_id: z.string().optional(),
        qualificationId: z.string().optional(),
        qualification_id: z.string().optional(),
        lotId: z.string().optional(),
        lot_id: z.string().optional(),
        milligrams: z.number().int().positive().optional(),
        quantityKg: z.number().positive().optional(),
        quantity_kg: z.number().positive().optional(),
        componentId: z.string().optional(),
        component_id: z.string().optional(),
        name: z.string().optional(),
        supplierName: z.string().optional(),
        supplier_name: z.string().optional(),
        pieces: z.number().int().positive().optional(),
      })).optional(),
    }))
    .mutation(async ({ input }) => {
      if (input.status === "received" && input.receipts) {
        const accepted = acceptPurchaseReceipt(input.poNumber || String(input.id), input.receipts);
        if (!accepted.ok) {
          throw new TRPCError({ code: "BAD_REQUEST", message: accepted.error });
        }
      }
      await db.updatePurchaseOrder(input.id, { status: input.status });
      return { success: true };
    }),
});

// ============================================================================
// NOTIFICATION ROUTER
// ============================================================================
const notificationRouter = router({
  getByUser: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(50) }))
    .query(async ({ ctx, input }) => {
      return db.getNotificationsByUser(ctx.user.id, input.limit);
    }),
  
  markRead: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.markNotificationRead(input.id);
      return { success: true };
    }),
  
  create: protectedProcedure
    .input(z.object({
      userId: z.number(),
      organizationId: z.number().optional(),
      type: z.enum(['commission_earned', 'booking_confirmed', 'payment_received', 'order_update', 'system']),
      title: z.string(),
      message: z.string(),
      data: z.any().optional(),
    }))
    .mutation(async ({ input }) => {
      const id = await db.createNotification(input);
      return { id };
    }),
});

// ============================================================================
// REPORT ROUTER
// ============================================================================
const reportRouter = router({
  getByOrganization: protectedProcedure
    .input(z.object({
      organizationId: z.number(),
      type: z.enum(['commission', 'sales', 'procurement', 'inventory', 'customer_analytics']).optional(),
    }))
    .query(async ({ input }) => {
      return db.getReportsByOrganization(input.organizationId, input.type);
    }),
  
  create: adminProcedure
    .input(z.object({
      organizationId: z.number(),
      type: z.enum(['commission', 'sales', 'procurement', 'inventory', 'customer_analytics']),
      title: z.string(),
      period: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const id = await db.createReport(input);
      return { id };
    }),
});

// ============================================================================
// AUDIT LOG ROUTER
// ============================================================================
const auditRouter = router({
  log: protectedProcedure
    .input(z.object({
      organizationId: z.number().optional(),
      action: z.string(),
      entityType: z.string(),
      entityId: z.number().optional(),
      oldValues: z.any().optional(),
      newValues: z.any().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await db.createAuditLog({
        userId: ctx.user.id,
        ...input,
      });
      return { success: true };
    }),
});

// ============================================================================
// MAIN APP ROUTER
// ============================================================================
export const appRouter = router({
  system: systemRouter,
  auth: authRouter,
  user: userRouter,
  organization: organizationRouter,
  therapist: therapistRouter,
  assignment: assignmentRouter,
  consultation: consultationRouter,
  treatment: treatmentRouter,
  product: productRouter,
  order: orderRouter,
  payment: paymentRouter,
  commission: commissionRouter,
  booking: bookingRouter,
  integration: integrationRouter,
  supplier: supplierRouter,
  purchaseOrder: purchaseOrderRouter,
  notification: notificationRouter,
  report: reportRouter,
  audit: auditRouter,
  supplyChain: router({
    command: publicProcedure
      .input(z.object({
        command: z.string(),
        args: z.record(z.any()).optional(),
      }))
      .mutation(({ input }) => {
        const accepted = acceptSupplyChainCommand(input);
        if (!accepted.ok) {
          throw new TRPCError({ code: "BAD_REQUEST", message: accepted.error });
        }
        return accepted.artifact;
      }),
  }),
});

export type AppRouter = typeof appRouter;
