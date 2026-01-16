import Stripe from 'stripe';

let stripeClient: Stripe | null = null;

function getStripeClient(): Stripe {
  if (!stripeClient) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }
    stripeClient = new Stripe(secretKey);
  }
  return stripeClient;
}

// ============================================================================
// PAYMENT INTENTS
// ============================================================================

export interface CreatePaymentIntentParams {
  amount: number; // in cents
  currency: string;
  customerId?: string;
  metadata?: Record<string, string>;
  description?: string;
  receiptEmail?: string;
  statementDescriptor?: string;
}

export async function createPaymentIntent(params: CreatePaymentIntentParams): Promise<Stripe.PaymentIntent> {
  const stripe = getStripeClient();
  
  return stripe.paymentIntents.create({
    amount: params.amount,
    currency: params.currency.toLowerCase(),
    customer: params.customerId,
    metadata: params.metadata,
    description: params.description,
    receipt_email: params.receiptEmail,
    statement_descriptor: params.statementDescriptor?.substring(0, 22),
    automatic_payment_methods: {
      enabled: true,
    },
  });
}

export async function retrievePaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
  const stripe = getStripeClient();
  return stripe.paymentIntents.retrieve(paymentIntentId);
}

export async function confirmPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
  const stripe = getStripeClient();
  return stripe.paymentIntents.confirm(paymentIntentId);
}

export async function cancelPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
  const stripe = getStripeClient();
  return stripe.paymentIntents.cancel(paymentIntentId);
}

// ============================================================================
// CUSTOMERS
// ============================================================================

export interface CreateCustomerParams {
  email: string;
  name?: string;
  phone?: string;
  metadata?: Record<string, string>;
}

export async function createStripeCustomer(params: CreateCustomerParams): Promise<Stripe.Customer> {
  const stripe = getStripeClient();
  
  return stripe.customers.create({
    email: params.email,
    name: params.name,
    phone: params.phone,
    metadata: params.metadata,
  });
}

export async function retrieveStripeCustomer(customerId: string): Promise<Stripe.Customer> {
  const stripe = getStripeClient();
  return stripe.customers.retrieve(customerId) as Promise<Stripe.Customer>;
}

export async function updateStripeCustomer(customerId: string, params: Partial<CreateCustomerParams>): Promise<Stripe.Customer> {
  const stripe = getStripeClient();
  return stripe.customers.update(customerId, params);
}

export async function searchStripeCustomers(email: string): Promise<Stripe.Customer[]> {
  const stripe = getStripeClient();
  const result = await stripe.customers.search({
    query: `email:'${email}'`,
  });
  return result.data;
}

// ============================================================================
// REFUNDS
// ============================================================================

export interface CreateRefundParams {
  paymentIntentId: string;
  amount?: number; // in cents, optional for partial refund
  reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer';
  metadata?: Record<string, string>;
}

export async function createRefund(params: CreateRefundParams): Promise<Stripe.Refund> {
  const stripe = getStripeClient();
  
  return stripe.refunds.create({
    payment_intent: params.paymentIntentId,
    amount: params.amount,
    reason: params.reason,
    metadata: params.metadata,
  });
}

export async function retrieveRefund(refundId: string): Promise<Stripe.Refund> {
  const stripe = getStripeClient();
  return stripe.refunds.retrieve(refundId);
}

// ============================================================================
// SUBSCRIPTIONS
// ============================================================================

export interface CreateSubscriptionParams {
  customerId: string;
  priceId: string;
  metadata?: Record<string, string>;
  trialPeriodDays?: number;
}

export async function createSubscription(params: CreateSubscriptionParams): Promise<Stripe.Subscription> {
  const stripe = getStripeClient();
  
  return stripe.subscriptions.create({
    customer: params.customerId,
    items: [{ price: params.priceId }],
    metadata: params.metadata,
    trial_period_days: params.trialPeriodDays,
  });
}

export async function cancelSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
  const stripe = getStripeClient();
  return stripe.subscriptions.cancel(subscriptionId);
}

// ============================================================================
// PRODUCTS & PRICES
// ============================================================================

export async function createStripeProduct(name: string, description?: string): Promise<Stripe.Product> {
  const stripe = getStripeClient();
  return stripe.products.create({
    name,
    description,
  });
}

export async function createStripePrice(productId: string, unitAmount: number, currency: string, recurring?: { interval: 'day' | 'week' | 'month' | 'year' }): Promise<Stripe.Price> {
  const stripe = getStripeClient();
  return stripe.prices.create({
    product: productId,
    unit_amount: unitAmount,
    currency: currency.toLowerCase(),
    recurring,
  });
}

// ============================================================================
// CHECKOUT SESSIONS
// ============================================================================

export interface CreateCheckoutSessionParams {
  lineItems: { price: string; quantity: number }[];
  successUrl: string;
  cancelUrl: string;
  customerId?: string;
  customerEmail?: string;
  metadata?: Record<string, string>;
  mode?: 'payment' | 'subscription' | 'setup';
}

export async function createCheckoutSession(params: CreateCheckoutSessionParams): Promise<Stripe.Checkout.Session> {
  const stripe = getStripeClient();
  
  return stripe.checkout.sessions.create({
    line_items: params.lineItems,
    mode: params.mode || 'payment',
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    customer: params.customerId,
    customer_email: params.customerEmail,
    metadata: params.metadata,
  });
}

// ============================================================================
// WEBHOOKS
// ============================================================================

export function constructWebhookEvent(payload: string | Buffer, signature: string, webhookSecret: string): Stripe.Event {
  const stripe = getStripeClient();
  return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
}

// ============================================================================
// CONNECT (for marketplace/platform payments)
// ============================================================================

export async function createConnectedAccount(email: string, country: string): Promise<Stripe.Account> {
  const stripe = getStripeClient();
  return stripe.accounts.create({
    type: 'express',
    email,
    country,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
  });
}

export async function createAccountLink(accountId: string, refreshUrl: string, returnUrl: string): Promise<Stripe.AccountLink> {
  const stripe = getStripeClient();
  return stripe.accountLinks.create({
    account: accountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: 'account_onboarding',
  });
}

export async function createTransfer(amount: number, currency: string, destinationAccountId: string, metadata?: Record<string, string>): Promise<Stripe.Transfer> {
  const stripe = getStripeClient();
  return stripe.transfers.create({
    amount,
    currency: currency.toLowerCase(),
    destination: destinationAccountId,
    metadata,
  });
}

// ============================================================================
// BALANCE & PAYOUTS
// ============================================================================

export async function getBalance(): Promise<Stripe.Balance> {
  const stripe = getStripeClient();
  return stripe.balance.retrieve();
}

export async function listPayouts(limit = 10): Promise<Stripe.Payout[]> {
  const stripe = getStripeClient();
  const result = await stripe.payouts.list({ limit });
  return result.data;
}
