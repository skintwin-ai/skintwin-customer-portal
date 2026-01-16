import axios, { AxiosInstance } from 'axios';

interface QuickBooksConfig {
  realmId: string;
  accessToken: string;
  refreshToken?: string;
  environment?: 'sandbox' | 'production';
}

interface QBCustomer {
  Id?: string;
  DisplayName: string;
  PrimaryEmailAddr?: { Address: string };
  PrimaryPhone?: { FreeFormNumber: string };
  BillAddr?: QBAddress;
  ShipAddr?: QBAddress;
  Active?: boolean;
  Balance?: number;
  SyncToken?: string;
}

interface QBAddress {
  Line1?: string;
  Line2?: string;
  City?: string;
  CountrySubDivisionCode?: string;
  PostalCode?: string;
  Country?: string;
}

interface QBInvoice {
  Id?: string;
  DocNumber?: string;
  TxnDate?: string;
  DueDate?: string;
  CustomerRef: { value: string; name?: string };
  Line: QBInvoiceLine[];
  TotalAmt?: number;
  Balance?: number;
  EmailStatus?: string;
  SyncToken?: string;
}

interface QBInvoiceLine {
  Id?: string;
  LineNum?: number;
  Description?: string;
  Amount: number;
  DetailType: 'SalesItemLineDetail' | 'SubTotalLineDetail' | 'DiscountLineDetail';
  SalesItemLineDetail?: {
    ItemRef: { value: string; name?: string };
    Qty?: number;
    UnitPrice?: number;
  };
}

interface QBPayment {
  Id?: string;
  TxnDate?: string;
  CustomerRef: { value: string; name?: string };
  TotalAmt: number;
  Line?: { Amount: number; LinkedTxn: { TxnId: string; TxnType: string }[] }[];
  PaymentMethodRef?: { value: string };
  DepositToAccountRef?: { value: string };
  SyncToken?: string;
}

interface QBItem {
  Id?: string;
  Name: string;
  Description?: string;
  Type: 'Inventory' | 'Service' | 'NonInventory';
  UnitPrice?: number;
  PurchaseCost?: number;
  IncomeAccountRef?: { value: string };
  ExpenseAccountRef?: { value: string };
  AssetAccountRef?: { value: string };
  TrackQtyOnHand?: boolean;
  QtyOnHand?: number;
  Active?: boolean;
  SyncToken?: string;
}

interface QBVendor {
  Id?: string;
  DisplayName: string;
  PrimaryEmailAddr?: { Address: string };
  PrimaryPhone?: { FreeFormNumber: string };
  BillAddr?: QBAddress;
  Active?: boolean;
  Balance?: number;
  SyncToken?: string;
}

interface QBBill {
  Id?: string;
  DocNumber?: string;
  TxnDate?: string;
  DueDate?: string;
  VendorRef: { value: string; name?: string };
  Line: QBBillLine[];
  TotalAmt?: number;
  Balance?: number;
  SyncToken?: string;
}

interface QBBillLine {
  Id?: string;
  LineNum?: number;
  Description?: string;
  Amount: number;
  DetailType: 'AccountBasedExpenseLineDetail' | 'ItemBasedExpenseLineDetail';
  AccountBasedExpenseLineDetail?: {
    AccountRef: { value: string; name?: string };
  };
  ItemBasedExpenseLineDetail?: {
    ItemRef: { value: string; name?: string };
    Qty?: number;
    UnitPrice?: number;
  };
}

export class QuickBooksService {
  private client: AxiosInstance;
  private realmId: string;
  private baseUrl: string;

  constructor(config: QuickBooksConfig) {
    this.realmId = config.realmId;
    this.baseUrl = config.environment === 'production'
      ? 'https://quickbooks.api.intuit.com'
      : 'https://sandbox-quickbooks.api.intuit.com';

    this.client = axios.create({
      baseURL: `${this.baseUrl}/v3/company/${this.realmId}`,
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });
  }

  // ============================================================================
  // CUSTOMERS
  // ============================================================================

  async createCustomer(customer: QBCustomer): Promise<QBCustomer> {
    const response = await this.client.post('/customer', customer);
    return response.data.Customer;
  }

  async getCustomer(customerId: string): Promise<QBCustomer> {
    const response = await this.client.get(`/customer/${customerId}`);
    return response.data.Customer;
  }

  async updateCustomer(customer: QBCustomer): Promise<QBCustomer> {
    const response = await this.client.post('/customer', customer);
    return response.data.Customer;
  }

  async queryCustomers(query: string): Promise<QBCustomer[]> {
    const response = await this.client.get('/query', {
      params: { query: `SELECT * FROM Customer WHERE ${query}` },
    });
    return response.data.QueryResponse?.Customer || [];
  }

  async findCustomerByEmail(email: string): Promise<QBCustomer | null> {
    const customers = await this.queryCustomers(`PrimaryEmailAddr = '${email}'`);
    return customers.length > 0 ? customers[0] : null;
  }

  // ============================================================================
  // INVOICES
  // ============================================================================

  async createInvoice(invoice: QBInvoice): Promise<QBInvoice> {
    const response = await this.client.post('/invoice', invoice);
    return response.data.Invoice;
  }

  async getInvoice(invoiceId: string): Promise<QBInvoice> {
    const response = await this.client.get(`/invoice/${invoiceId}`);
    return response.data.Invoice;
  }

  async updateInvoice(invoice: QBInvoice): Promise<QBInvoice> {
    const response = await this.client.post('/invoice', invoice);
    return response.data.Invoice;
  }

  async queryInvoices(query: string): Promise<QBInvoice[]> {
    const response = await this.client.get('/query', {
      params: { query: `SELECT * FROM Invoice WHERE ${query}` },
    });
    return response.data.QueryResponse?.Invoice || [];
  }

  async sendInvoice(invoiceId: string, email?: string): Promise<void> {
    const params = email ? { sendTo: email } : {};
    await this.client.post(`/invoice/${invoiceId}/send`, null, { params });
  }

  async voidInvoice(invoice: QBInvoice): Promise<QBInvoice> {
    const response = await this.client.post(`/invoice?operation=void`, invoice);
    return response.data.Invoice;
  }

  // ============================================================================
  // PAYMENTS
  // ============================================================================

  async createPayment(payment: QBPayment): Promise<QBPayment> {
    const response = await this.client.post('/payment', payment);
    return response.data.Payment;
  }

  async getPayment(paymentId: string): Promise<QBPayment> {
    const response = await this.client.get(`/payment/${paymentId}`);
    return response.data.Payment;
  }

  async queryPayments(query: string): Promise<QBPayment[]> {
    const response = await this.client.get('/query', {
      params: { query: `SELECT * FROM Payment WHERE ${query}` },
    });
    return response.data.QueryResponse?.Payment || [];
  }

  // ============================================================================
  // ITEMS (Products/Services)
  // ============================================================================

  async createItem(item: QBItem): Promise<QBItem> {
    const response = await this.client.post('/item', item);
    return response.data.Item;
  }

  async getItem(itemId: string): Promise<QBItem> {
    const response = await this.client.get(`/item/${itemId}`);
    return response.data.Item;
  }

  async updateItem(item: QBItem): Promise<QBItem> {
    const response = await this.client.post('/item', item);
    return response.data.Item;
  }

  async queryItems(query: string): Promise<QBItem[]> {
    const response = await this.client.get('/query', {
      params: { query: `SELECT * FROM Item WHERE ${query}` },
    });
    return response.data.QueryResponse?.Item || [];
  }

  async getAllItems(): Promise<QBItem[]> {
    return this.queryItems('Active = true');
  }

  // ============================================================================
  // VENDORS
  // ============================================================================

  async createVendor(vendor: QBVendor): Promise<QBVendor> {
    const response = await this.client.post('/vendor', vendor);
    return response.data.Vendor;
  }

  async getVendor(vendorId: string): Promise<QBVendor> {
    const response = await this.client.get(`/vendor/${vendorId}`);
    return response.data.Vendor;
  }

  async queryVendors(query: string): Promise<QBVendor[]> {
    const response = await this.client.get('/query', {
      params: { query: `SELECT * FROM Vendor WHERE ${query}` },
    });
    return response.data.QueryResponse?.Vendor || [];
  }

  // ============================================================================
  // BILLS
  // ============================================================================

  async createBill(bill: QBBill): Promise<QBBill> {
    const response = await this.client.post('/bill', bill);
    return response.data.Bill;
  }

  async getBill(billId: string): Promise<QBBill> {
    const response = await this.client.get(`/bill/${billId}`);
    return response.data.Bill;
  }

  async queryBills(query: string): Promise<QBBill[]> {
    const response = await this.client.get('/query', {
      params: { query: `SELECT * FROM Bill WHERE ${query}` },
    });
    return response.data.QueryResponse?.Bill || [];
  }

  // ============================================================================
  // ACCOUNTS
  // ============================================================================

  async queryAccounts(query: string): Promise<any[]> {
    const response = await this.client.get('/query', {
      params: { query: `SELECT * FROM Account WHERE ${query}` },
    });
    return response.data.QueryResponse?.Account || [];
  }

  async getAllAccounts(): Promise<any[]> {
    return this.queryAccounts('Active = true');
  }

  // ============================================================================
  // REPORTS
  // ============================================================================

  async getProfitAndLossReport(params: {
    start_date?: string;
    end_date?: string;
  } = {}): Promise<any> {
    const response = await this.client.get('/reports/ProfitAndLoss', { params });
    return response.data;
  }

  async getBalanceSheetReport(params: {
    start_date?: string;
    end_date?: string;
  } = {}): Promise<any> {
    const response = await this.client.get('/reports/BalanceSheet', { params });
    return response.data;
  }

  async getCustomerBalanceReport(): Promise<any> {
    const response = await this.client.get('/reports/CustomerBalance');
    return response.data;
  }

  async getVendorBalanceReport(): Promise<any> {
    const response = await this.client.get('/reports/VendorBalance');
    return response.data;
  }

  // ============================================================================
  // COMPANY INFO
  // ============================================================================

  async getCompanyInfo(): Promise<any> {
    const response = await this.client.get(`/companyinfo/${this.realmId}`);
    return response.data.CompanyInfo;
  }
}

// Factory function
export function createQuickBooksService(realmId: string, accessToken: string, environment: 'sandbox' | 'production' = 'sandbox'): QuickBooksService {
  return new QuickBooksService({ realmId, accessToken, environment });
}
