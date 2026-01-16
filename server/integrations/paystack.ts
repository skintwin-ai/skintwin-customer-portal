import axios, { AxiosInstance } from 'axios';

interface PaystackConfig {
  secretKey: string;
}

interface PaystackTransaction {
  id: number;
  reference: string;
  amount: number;
  currency: string;
  status: string;
  customer: PaystackCustomer;
  metadata: Record<string, any>;
  created_at: string;
  paid_at: string;
}

interface PaystackCustomer {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  customer_code: string;
}

interface PaystackSubaccount {
  id: number;
  subaccount_code: string;
  business_name: string;
  settlement_bank: string;
  account_number: string;
  percentage_charge: number;
}

export class PaystackService {
  private client: AxiosInstance;

  constructor(config: PaystackConfig) {
    this.client = axios.create({
      baseURL: 'https://api.paystack.co',
      headers: {
        Authorization: `Bearer ${config.secretKey}`,
        'Content-Type': 'application/json',
      },
    });
  }

  // ============================================================================
  // TRANSACTIONS
  // ============================================================================

  async initializeTransaction(params: {
    email: string;
    amount: number; // in kobo (smallest currency unit)
    currency?: string;
    reference?: string;
    callback_url?: string;
    metadata?: Record<string, any>;
    subaccount?: string;
    split_code?: string;
  }): Promise<{ authorization_url: string; access_code: string; reference: string }> {
    const response = await this.client.post('/transaction/initialize', params);
    return response.data.data;
  }

  async verifyTransaction(reference: string): Promise<PaystackTransaction> {
    const response = await this.client.get(`/transaction/verify/${reference}`);
    return response.data.data;
  }

  async listTransactions(params: {
    perPage?: number;
    page?: number;
    from?: string;
    to?: string;
    status?: 'success' | 'failed' | 'abandoned';
  } = {}): Promise<PaystackTransaction[]> {
    const response = await this.client.get('/transaction', { params });
    return response.data.data;
  }

  async getTransaction(id: number): Promise<PaystackTransaction> {
    const response = await this.client.get(`/transaction/${id}`);
    return response.data.data;
  }

  async chargeAuthorization(params: {
    email: string;
    amount: number;
    authorization_code: string;
    reference?: string;
    metadata?: Record<string, any>;
  }): Promise<PaystackTransaction> {
    const response = await this.client.post('/transaction/charge_authorization', params);
    return response.data.data;
  }

  // ============================================================================
  // CUSTOMERS
  // ============================================================================

  async createCustomer(params: {
    email: string;
    first_name?: string;
    last_name?: string;
    phone?: string;
    metadata?: Record<string, any>;
  }): Promise<PaystackCustomer> {
    const response = await this.client.post('/customer', params);
    return response.data.data;
  }

  async getCustomer(emailOrCode: string): Promise<PaystackCustomer> {
    const response = await this.client.get(`/customer/${emailOrCode}`);
    return response.data.data;
  }

  async updateCustomer(code: string, params: {
    first_name?: string;
    last_name?: string;
    phone?: string;
    metadata?: Record<string, any>;
  }): Promise<PaystackCustomer> {
    const response = await this.client.put(`/customer/${code}`, params);
    return response.data.data;
  }

  async listCustomers(params: { perPage?: number; page?: number } = {}): Promise<PaystackCustomer[]> {
    const response = await this.client.get('/customer', { params });
    return response.data.data;
  }

  // ============================================================================
  // REFUNDS
  // ============================================================================

  async createRefund(params: {
    transaction: string; // transaction reference or id
    amount?: number;
    currency?: string;
    customer_note?: string;
    merchant_note?: string;
  }): Promise<any> {
    const response = await this.client.post('/refund', params);
    return response.data.data;
  }

  async getRefund(reference: string): Promise<any> {
    const response = await this.client.get(`/refund/${reference}`);
    return response.data.data;
  }

  async listRefunds(params: {
    reference?: string;
    currency?: string;
    perPage?: number;
    page?: number;
  } = {}): Promise<any[]> {
    const response = await this.client.get('/refund', { params });
    return response.data.data;
  }

  // ============================================================================
  // SUBACCOUNTS (for split payments / marketplace)
  // ============================================================================

  async createSubaccount(params: {
    business_name: string;
    settlement_bank: string;
    account_number: string;
    percentage_charge: number;
    description?: string;
    primary_contact_email?: string;
    primary_contact_name?: string;
    primary_contact_phone?: string;
    metadata?: Record<string, any>;
  }): Promise<PaystackSubaccount> {
    const response = await this.client.post('/subaccount', params);
    return response.data.data;
  }

  async getSubaccount(idOrCode: string): Promise<PaystackSubaccount> {
    const response = await this.client.get(`/subaccount/${idOrCode}`);
    return response.data.data;
  }

  async updateSubaccount(idOrCode: string, params: Partial<{
    business_name: string;
    settlement_bank: string;
    account_number: string;
    percentage_charge: number;
    description: string;
    primary_contact_email: string;
    primary_contact_name: string;
    primary_contact_phone: string;
  }>): Promise<PaystackSubaccount> {
    const response = await this.client.put(`/subaccount/${idOrCode}`, params);
    return response.data.data;
  }

  async listSubaccounts(params: { perPage?: number; page?: number } = {}): Promise<PaystackSubaccount[]> {
    const response = await this.client.get('/subaccount', { params });
    return response.data.data;
  }

  // ============================================================================
  // TRANSFERS
  // ============================================================================

  async createTransferRecipient(params: {
    type: 'nuban' | 'mobile_money' | 'basa';
    name: string;
    account_number: string;
    bank_code: string;
    currency?: string;
    metadata?: Record<string, any>;
  }): Promise<any> {
    const response = await this.client.post('/transferrecipient', params);
    return response.data.data;
  }

  async initiateTransfer(params: {
    source: string;
    amount: number;
    recipient: string;
    reason?: string;
    currency?: string;
    reference?: string;
  }): Promise<any> {
    const response = await this.client.post('/transfer', params);
    return response.data.data;
  }

  async verifyTransfer(reference: string): Promise<any> {
    const response = await this.client.get(`/transfer/verify/${reference}`);
    return response.data.data;
  }

  // ============================================================================
  // BANKS
  // ============================================================================

  async listBanks(country = 'nigeria'): Promise<any[]> {
    const response = await this.client.get('/bank', { params: { country } });
    return response.data.data;
  }

  async resolveAccountNumber(accountNumber: string, bankCode: string): Promise<{ account_number: string; account_name: string }> {
    const response = await this.client.get('/bank/resolve', {
      params: { account_number: accountNumber, bank_code: bankCode },
    });
    return response.data.data;
  }

  // ============================================================================
  // SUBSCRIPTIONS
  // ============================================================================

  async createPlan(params: {
    name: string;
    amount: number;
    interval: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'biannually' | 'annually';
    description?: string;
    currency?: string;
  }): Promise<any> {
    const response = await this.client.post('/plan', params);
    return response.data.data;
  }

  async createSubscription(params: {
    customer: string;
    plan: string;
    authorization?: string;
    start_date?: string;
  }): Promise<any> {
    const response = await this.client.post('/subscription', params);
    return response.data.data;
  }

  async disableSubscription(params: { code: string; token: string }): Promise<any> {
    const response = await this.client.post('/subscription/disable', params);
    return response.data.data;
  }

  // ============================================================================
  // WEBHOOKS
  // ============================================================================

  verifyWebhookSignature(payload: string, signature: string, secretKey: string): boolean {
    const crypto = require('crypto');
    const hash = crypto.createHmac('sha512', secretKey).update(payload).digest('hex');
    return hash === signature;
  }
}

// Factory function
export function createPaystackService(secretKey?: string): PaystackService {
  const key = secretKey || process.env.PAYSTACK_API_KEY;
  if (!key) {
    throw new Error('PAYSTACK_API_KEY is not configured');
  }
  return new PaystackService({ secretKey: key });
}
