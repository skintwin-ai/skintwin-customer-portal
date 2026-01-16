import axios, { AxiosInstance } from 'axios';

interface XeroConfig {
  tenantId: string;
  accessToken: string;
}

interface XeroContact {
  ContactID?: string;
  Name: string;
  FirstName?: string;
  LastName?: string;
  EmailAddress?: string;
  Phones?: XeroPhone[];
  Addresses?: XeroAddress[];
  IsCustomer?: boolean;
  IsSupplier?: boolean;
  ContactStatus?: 'ACTIVE' | 'ARCHIVED';
}

interface XeroPhone {
  PhoneType: 'DEFAULT' | 'DDI' | 'MOBILE' | 'FAX';
  PhoneNumber?: string;
  PhoneAreaCode?: string;
  PhoneCountryCode?: string;
}

interface XeroAddress {
  AddressType: 'POBOX' | 'STREET' | 'DELIVERY';
  AddressLine1?: string;
  AddressLine2?: string;
  City?: string;
  Region?: string;
  PostalCode?: string;
  Country?: string;
}

interface XeroInvoice {
  InvoiceID?: string;
  InvoiceNumber?: string;
  Type: 'ACCREC' | 'ACCPAY';
  Contact: { ContactID: string };
  Date?: string;
  DueDate?: string;
  LineItems: XeroLineItem[];
  Status?: 'DRAFT' | 'SUBMITTED' | 'AUTHORISED' | 'PAID' | 'VOIDED';
  CurrencyCode?: string;
  Total?: number;
  AmountDue?: number;
  AmountPaid?: number;
  Reference?: string;
}

interface XeroLineItem {
  LineItemID?: string;
  Description?: string;
  Quantity?: number;
  UnitAmount?: number;
  AccountCode?: string;
  TaxType?: string;
  LineAmount?: number;
  ItemCode?: string;
}

interface XeroPayment {
  PaymentID?: string;
  Invoice?: { InvoiceID: string };
  Account?: { AccountID: string };
  Date?: string;
  Amount: number;
  Reference?: string;
  Status?: 'AUTHORISED' | 'DELETED';
}

interface XeroItem {
  ItemID?: string;
  Code: string;
  Name?: string;
  Description?: string;
  PurchaseDescription?: string;
  PurchaseDetails?: {
    UnitPrice?: number;
    AccountCode?: string;
    TaxType?: string;
  };
  SalesDetails?: {
    UnitPrice?: number;
    AccountCode?: string;
    TaxType?: string;
  };
  IsTrackedAsInventory?: boolean;
  QuantityOnHand?: number;
}

interface XeroBill {
  InvoiceID?: string;
  InvoiceNumber?: string;
  Type: 'ACCPAY';
  Contact: { ContactID: string };
  Date?: string;
  DueDate?: string;
  LineItems: XeroLineItem[];
  Status?: 'DRAFT' | 'SUBMITTED' | 'AUTHORISED' | 'PAID' | 'VOIDED';
  Total?: number;
}

export class XeroService {
  private client: AxiosInstance;
  private tenantId: string;

  constructor(config: XeroConfig) {
    this.tenantId = config.tenantId;
    this.client = axios.create({
      baseURL: 'https://api.xero.com/api.xro/2.0',
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        'xero-tenant-id': config.tenantId,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });
  }

  // ============================================================================
  // CONTACTS (Customers & Suppliers)
  // ============================================================================

  async createContact(contact: XeroContact): Promise<XeroContact> {
    const response = await this.client.post('/Contacts', { Contacts: [contact] });
    return response.data.Contacts[0];
  }

  async getContact(contactId: string): Promise<XeroContact> {
    const response = await this.client.get(`/Contacts/${contactId}`);
    return response.data.Contacts[0];
  }

  async updateContact(contact: XeroContact): Promise<XeroContact> {
    const response = await this.client.post(`/Contacts/${contact.ContactID}`, { Contacts: [contact] });
    return response.data.Contacts[0];
  }

  async getContacts(params: {
    where?: string;
    order?: string;
    page?: number;
  } = {}): Promise<XeroContact[]> {
    const response = await this.client.get('/Contacts', { params });
    return response.data.Contacts || [];
  }

  async findContactByEmail(email: string): Promise<XeroContact | null> {
    const contacts = await this.getContacts({ where: `EmailAddress="${email}"` });
    return contacts.length > 0 ? contacts[0] : null;
  }

  // ============================================================================
  // INVOICES (Sales)
  // ============================================================================

  async createInvoice(invoice: XeroInvoice): Promise<XeroInvoice> {
    const response = await this.client.post('/Invoices', { Invoices: [invoice] });
    return response.data.Invoices[0];
  }

  async getInvoice(invoiceId: string): Promise<XeroInvoice> {
    const response = await this.client.get(`/Invoices/${invoiceId}`);
    return response.data.Invoices[0];
  }

  async updateInvoice(invoice: XeroInvoice): Promise<XeroInvoice> {
    const response = await this.client.post(`/Invoices/${invoice.InvoiceID}`, { Invoices: [invoice] });
    return response.data.Invoices[0];
  }

  async getInvoices(params: {
    where?: string;
    order?: string;
    page?: number;
    Statuses?: string;
  } = {}): Promise<XeroInvoice[]> {
    const response = await this.client.get('/Invoices', { params });
    return response.data.Invoices || [];
  }

  async emailInvoice(invoiceId: string): Promise<void> {
    await this.client.post(`/Invoices/${invoiceId}/Email`);
  }

  async voidInvoice(invoiceId: string): Promise<XeroInvoice> {
    const response = await this.client.post(`/Invoices/${invoiceId}`, {
      Invoices: [{ InvoiceID: invoiceId, Status: 'VOIDED' }],
    });
    return response.data.Invoices[0];
  }

  // ============================================================================
  // BILLS (Purchases)
  // ============================================================================

  async createBill(bill: XeroBill): Promise<XeroBill> {
    const response = await this.client.post('/Invoices', { Invoices: [{ ...bill, Type: 'ACCPAY' }] });
    return response.data.Invoices[0];
  }

  async getBills(params: {
    where?: string;
    order?: string;
    page?: number;
  } = {}): Promise<XeroBill[]> {
    const response = await this.client.get('/Invoices', {
      params: { ...params, where: params.where ? `${params.where} AND Type=="ACCPAY"` : 'Type=="ACCPAY"' },
    });
    return response.data.Invoices || [];
  }

  // ============================================================================
  // PAYMENTS
  // ============================================================================

  async createPayment(payment: XeroPayment): Promise<XeroPayment> {
    const response = await this.client.post('/Payments', { Payments: [payment] });
    return response.data.Payments[0];
  }

  async getPayment(paymentId: string): Promise<XeroPayment> {
    const response = await this.client.get(`/Payments/${paymentId}`);
    return response.data.Payments[0];
  }

  async getPayments(params: {
    where?: string;
    order?: string;
    page?: number;
  } = {}): Promise<XeroPayment[]> {
    const response = await this.client.get('/Payments', { params });
    return response.data.Payments || [];
  }

  // ============================================================================
  // ITEMS (Products)
  // ============================================================================

  async createItem(item: XeroItem): Promise<XeroItem> {
    const response = await this.client.post('/Items', { Items: [item] });
    return response.data.Items[0];
  }

  async getItem(itemId: string): Promise<XeroItem> {
    const response = await this.client.get(`/Items/${itemId}`);
    return response.data.Items[0];
  }

  async updateItem(item: XeroItem): Promise<XeroItem> {
    const response = await this.client.post(`/Items/${item.ItemID}`, { Items: [item] });
    return response.data.Items[0];
  }

  async getItems(params: {
    where?: string;
    order?: string;
  } = {}): Promise<XeroItem[]> {
    const response = await this.client.get('/Items', { params });
    return response.data.Items || [];
  }

  // ============================================================================
  // ACCOUNTS
  // ============================================================================

  async getAccounts(params: {
    where?: string;
    order?: string;
  } = {}): Promise<any[]> {
    const response = await this.client.get('/Accounts', { params });
    return response.data.Accounts || [];
  }

  async getAccount(accountId: string): Promise<any> {
    const response = await this.client.get(`/Accounts/${accountId}`);
    return response.data.Accounts[0];
  }

  // ============================================================================
  // BANK TRANSACTIONS
  // ============================================================================

  async createBankTransaction(transaction: any): Promise<any> {
    const response = await this.client.post('/BankTransactions', { BankTransactions: [transaction] });
    return response.data.BankTransactions[0];
  }

  async getBankTransactions(params: {
    where?: string;
    order?: string;
    page?: number;
  } = {}): Promise<any[]> {
    const response = await this.client.get('/BankTransactions', { params });
    return response.data.BankTransactions || [];
  }

  // ============================================================================
  // REPORTS
  // ============================================================================

  async getProfitAndLossReport(params: {
    fromDate?: string;
    toDate?: string;
  } = {}): Promise<any> {
    const response = await this.client.get('/Reports/ProfitAndLoss', { params });
    return response.data.Reports[0];
  }

  async getBalanceSheetReport(params: {
    date?: string;
  } = {}): Promise<any> {
    const response = await this.client.get('/Reports/BalanceSheet', { params });
    return response.data.Reports[0];
  }

  async getTrialBalanceReport(params: {
    date?: string;
  } = {}): Promise<any> {
    const response = await this.client.get('/Reports/TrialBalance', { params });
    return response.data.Reports[0];
  }

  async getAgedReceivablesReport(params: {
    date?: string;
    contactId?: string;
  } = {}): Promise<any> {
    const response = await this.client.get('/Reports/AgedReceivablesByContact', { params });
    return response.data.Reports[0];
  }

  async getAgedPayablesReport(params: {
    date?: string;
    contactId?: string;
  } = {}): Promise<any> {
    const response = await this.client.get('/Reports/AgedPayablesByContact', { params });
    return response.data.Reports[0];
  }

  // ============================================================================
  // ORGANISATION
  // ============================================================================

  async getOrganisation(): Promise<any> {
    const response = await this.client.get('/Organisation');
    return response.data.Organisations[0];
  }

  // ============================================================================
  // TAX RATES
  // ============================================================================

  async getTaxRates(): Promise<any[]> {
    const response = await this.client.get('/TaxRates');
    return response.data.TaxRates || [];
  }

  // ============================================================================
  // CURRENCIES
  // ============================================================================

  async getCurrencies(): Promise<any[]> {
    const response = await this.client.get('/Currencies');
    return response.data.Currencies || [];
  }
}

// Factory function
export function createXeroService(tenantId: string, accessToken: string): XeroService {
  return new XeroService({ tenantId, accessToken });
}
