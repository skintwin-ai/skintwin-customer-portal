import axios, { AxiosInstance } from 'axios';

interface ERPNextConfig {
  baseUrl: string;
  apiKey: string;
  apiSecret: string;
}

interface ERPNextItem {
  name?: string;
  item_code: string;
  item_name: string;
  item_group?: string;
  description?: string;
  stock_uom?: string;
  is_stock_item?: number;
  standard_rate?: number;
  valuation_rate?: number;
  opening_stock?: number;
  image?: string;
  disabled?: number;
}

interface ERPNextSupplier {
  name?: string;
  supplier_name: string;
  supplier_group?: string;
  supplier_type?: string;
  country?: string;
  default_currency?: string;
  supplier_primary_contact?: string;
  supplier_primary_address?: string;
  disabled?: number;
}

interface ERPNextPurchaseOrder {
  name?: string;
  supplier: string;
  transaction_date?: string;
  schedule_date?: string;
  items: ERPNextPOItem[];
  status?: string;
  per_received?: number;
  per_billed?: number;
  grand_total?: number;
  currency?: string;
  docstatus?: number;
}

interface ERPNextPOItem {
  item_code: string;
  item_name?: string;
  qty: number;
  rate?: number;
  amount?: number;
  schedule_date?: string;
  warehouse?: string;
  received_qty?: number;
}

interface ERPNextPurchaseReceipt {
  name?: string;
  supplier: string;
  posting_date?: string;
  items: ERPNextPRItem[];
  status?: string;
  grand_total?: number;
}

interface ERPNextPRItem {
  item_code: string;
  item_name?: string;
  qty: number;
  rate?: number;
  amount?: number;
  warehouse?: string;
  purchase_order?: string;
  purchase_order_item?: string;
}

interface ERPNextStockEntry {
  name?: string;
  stock_entry_type: 'Material Issue' | 'Material Receipt' | 'Material Transfer' | 'Manufacture' | 'Repack';
  posting_date?: string;
  items: ERPNextStockItem[];
}

interface ERPNextStockItem {
  item_code: string;
  qty: number;
  s_warehouse?: string;
  t_warehouse?: string;
  basic_rate?: number;
}

interface ERPNextBin {
  item_code: string;
  warehouse: string;
  actual_qty: number;
  projected_qty: number;
  reserved_qty: number;
  ordered_qty: number;
  planned_qty: number;
}

export class ERPNextService {
  private client: AxiosInstance;

  constructor(config: ERPNextConfig) {
    const baseUrl = config.baseUrl.replace(/\/$/, '');
    this.client = axios.create({
      baseURL: `${baseUrl}/api`,
      headers: {
        Authorization: `token ${config.apiKey}:${config.apiSecret}`,
        'Content-Type': 'application/json',
      },
    });
  }

  // ============================================================================
  // GENERIC CRUD OPERATIONS
  // ============================================================================

  private async getResource(doctype: string, name: string): Promise<any> {
    const response = await this.client.get(`/resource/${doctype}/${name}`);
    return response.data.data;
  }

  private async listResource(doctype: string, params: {
    fields?: string[];
    filters?: any[];
    limit_page_length?: number;
    limit_start?: number;
    order_by?: string;
  } = {}): Promise<any[]> {
    const queryParams: any = {};
    if (params.fields) queryParams.fields = JSON.stringify(params.fields);
    if (params.filters) queryParams.filters = JSON.stringify(params.filters);
    if (params.limit_page_length) queryParams.limit_page_length = params.limit_page_length;
    if (params.limit_start) queryParams.limit_start = params.limit_start;
    if (params.order_by) queryParams.order_by = params.order_by;

    const response = await this.client.get(`/resource/${doctype}`, { params: queryParams });
    return response.data.data || [];
  }

  private async createResource(doctype: string, data: any): Promise<any> {
    const response = await this.client.post(`/resource/${doctype}`, data);
    return response.data.data;
  }

  private async updateResource(doctype: string, name: string, data: any): Promise<any> {
    const response = await this.client.put(`/resource/${doctype}/${name}`, data);
    return response.data.data;
  }

  private async deleteResource(doctype: string, name: string): Promise<void> {
    await this.client.delete(`/resource/${doctype}/${name}`);
  }

  // ============================================================================
  // ITEMS
  // ============================================================================

  async createItem(item: ERPNextItem): Promise<ERPNextItem> {
    return this.createResource('Item', item);
  }

  async getItem(itemCode: string): Promise<ERPNextItem> {
    return this.getResource('Item', itemCode);
  }

  async updateItem(itemCode: string, item: Partial<ERPNextItem>): Promise<ERPNextItem> {
    return this.updateResource('Item', itemCode, item);
  }

  async listItems(params: {
    filters?: any[];
    limit?: number;
    offset?: number;
  } = {}): Promise<ERPNextItem[]> {
    return this.listResource('Item', {
      fields: ['name', 'item_code', 'item_name', 'item_group', 'description', 'standard_rate', 'stock_uom', 'image', 'disabled'],
      filters: params.filters,
      limit_page_length: params.limit || 100,
      limit_start: params.offset || 0,
    });
  }

  async searchItems(query: string): Promise<ERPNextItem[]> {
    return this.listItems({
      filters: [['item_name', 'like', `%${query}%`]],
    });
  }

  // ============================================================================
  // SUPPLIERS
  // ============================================================================

  async createSupplier(supplier: ERPNextSupplier): Promise<ERPNextSupplier> {
    return this.createResource('Supplier', supplier);
  }

  async getSupplier(supplierName: string): Promise<ERPNextSupplier> {
    return this.getResource('Supplier', supplierName);
  }

  async updateSupplier(supplierName: string, supplier: Partial<ERPNextSupplier>): Promise<ERPNextSupplier> {
    return this.updateResource('Supplier', supplierName, supplier);
  }

  async listSuppliers(params: {
    filters?: any[];
    limit?: number;
    offset?: number;
  } = {}): Promise<ERPNextSupplier[]> {
    return this.listResource('Supplier', {
      fields: ['name', 'supplier_name', 'supplier_group', 'supplier_type', 'country', 'default_currency', 'disabled'],
      filters: params.filters,
      limit_page_length: params.limit || 100,
      limit_start: params.offset || 0,
    });
  }

  // ============================================================================
  // PURCHASE ORDERS
  // ============================================================================

  async createPurchaseOrder(po: ERPNextPurchaseOrder): Promise<ERPNextPurchaseOrder> {
    return this.createResource('Purchase Order', po);
  }

  async getPurchaseOrder(poName: string): Promise<ERPNextPurchaseOrder> {
    return this.getResource('Purchase Order', poName);
  }

  async updatePurchaseOrder(poName: string, po: Partial<ERPNextPurchaseOrder>): Promise<ERPNextPurchaseOrder> {
    return this.updateResource('Purchase Order', poName, po);
  }

  async listPurchaseOrders(params: {
    filters?: any[];
    limit?: number;
    offset?: number;
    status?: string;
  } = {}): Promise<ERPNextPurchaseOrder[]> {
    const filters = params.filters || [];
    if (params.status) {
      filters.push(['status', '=', params.status]);
    }

    return this.listResource('Purchase Order', {
      fields: ['name', 'supplier', 'transaction_date', 'schedule_date', 'status', 'per_received', 'per_billed', 'grand_total', 'currency'],
      filters,
      limit_page_length: params.limit || 100,
      limit_start: params.offset || 0,
      order_by: 'creation desc',
    });
  }

  async submitPurchaseOrder(poName: string): Promise<ERPNextPurchaseOrder> {
    const response = await this.client.post(`/method/frappe.client.submit`, {
      doc: { doctype: 'Purchase Order', name: poName },
    });
    return response.data.message;
  }

  async cancelPurchaseOrder(poName: string): Promise<ERPNextPurchaseOrder> {
    const response = await this.client.post(`/method/frappe.client.cancel`, {
      doctype: 'Purchase Order',
      name: poName,
    });
    return response.data.message;
  }

  // ============================================================================
  // PURCHASE RECEIPTS
  // ============================================================================

  async createPurchaseReceipt(pr: ERPNextPurchaseReceipt): Promise<ERPNextPurchaseReceipt> {
    return this.createResource('Purchase Receipt', pr);
  }

  async getPurchaseReceipt(prName: string): Promise<ERPNextPurchaseReceipt> {
    return this.getResource('Purchase Receipt', prName);
  }

  async listPurchaseReceipts(params: {
    filters?: any[];
    limit?: number;
    offset?: number;
  } = {}): Promise<ERPNextPurchaseReceipt[]> {
    return this.listResource('Purchase Receipt', {
      fields: ['name', 'supplier', 'posting_date', 'status', 'grand_total'],
      filters: params.filters,
      limit_page_length: params.limit || 100,
      limit_start: params.offset || 0,
      order_by: 'creation desc',
    });
  }

  async createPurchaseReceiptFromPO(poName: string): Promise<ERPNextPurchaseReceipt> {
    const response = await this.client.post('/method/erpnext.buying.doctype.purchase_order.purchase_order.make_purchase_receipt', {
      source_name: poName,
    });
    return response.data.message;
  }

  // ============================================================================
  // STOCK
  // ============================================================================

  async createStockEntry(entry: ERPNextStockEntry): Promise<ERPNextStockEntry> {
    return this.createResource('Stock Entry', entry);
  }

  async getStockEntry(entryName: string): Promise<ERPNextStockEntry> {
    return this.getResource('Stock Entry', entryName);
  }

  async getStockBalance(itemCode: string, warehouse?: string): Promise<ERPNextBin[]> {
    const filters: any[] = [['item_code', '=', itemCode]];
    if (warehouse) {
      filters.push(['warehouse', '=', warehouse]);
    }

    return this.listResource('Bin', {
      fields: ['item_code', 'warehouse', 'actual_qty', 'projected_qty', 'reserved_qty', 'ordered_qty', 'planned_qty'],
      filters,
    });
  }

  async getWarehouseStock(warehouse: string): Promise<ERPNextBin[]> {
    return this.listResource('Bin', {
      fields: ['item_code', 'warehouse', 'actual_qty', 'projected_qty', 'reserved_qty', 'ordered_qty', 'planned_qty'],
      filters: [['warehouse', '=', warehouse]],
      limit_page_length: 1000,
    });
  }

  async listWarehouses(): Promise<any[]> {
    return this.listResource('Warehouse', {
      fields: ['name', 'warehouse_name', 'warehouse_type', 'is_group', 'disabled'],
      filters: [['disabled', '=', 0]],
    });
  }

  // ============================================================================
  // STOCK LEDGER
  // ============================================================================

  async getStockLedger(params: {
    item_code?: string;
    warehouse?: string;
    from_date?: string;
    to_date?: string;
    limit?: number;
  } = {}): Promise<any[]> {
    const filters: any[] = [];
    if (params.item_code) filters.push(['item_code', '=', params.item_code]);
    if (params.warehouse) filters.push(['warehouse', '=', params.warehouse]);
    if (params.from_date) filters.push(['posting_date', '>=', params.from_date]);
    if (params.to_date) filters.push(['posting_date', '<=', params.to_date]);

    return this.listResource('Stock Ledger Entry', {
      fields: ['name', 'item_code', 'warehouse', 'posting_date', 'posting_time', 'actual_qty', 'qty_after_transaction', 'valuation_rate', 'voucher_type', 'voucher_no'],
      filters,
      limit_page_length: params.limit || 100,
      order_by: 'posting_date desc, posting_time desc',
    });
  }

  // ============================================================================
  // ITEM GROUPS
  // ============================================================================

  async listItemGroups(): Promise<any[]> {
    return this.listResource('Item Group', {
      fields: ['name', 'item_group_name', 'parent_item_group', 'is_group'],
    });
  }

  // ============================================================================
  // SUPPLIER GROUPS
  // ============================================================================

  async listSupplierGroups(): Promise<any[]> {
    return this.listResource('Supplier Group', {
      fields: ['name', 'supplier_group_name', 'parent_supplier_group'],
    });
  }

  // ============================================================================
  // REPORTS
  // ============================================================================

  async getStockBalanceReport(params: {
    from_date?: string;
    to_date?: string;
    item_group?: string;
    warehouse?: string;
  } = {}): Promise<any> {
    const response = await this.client.post('/method/erpnext.stock.report.stock_balance.stock_balance.execute', {
      filters: params,
    });
    return response.data.message;
  }

  async getPurchaseAnalyticsReport(params: {
    from_date?: string;
    to_date?: string;
    tree_type?: string;
    doc_type?: string;
  } = {}): Promise<any> {
    const response = await this.client.post('/method/erpnext.buying.report.purchase_analytics.purchase_analytics.execute', {
      filters: params,
    });
    return response.data.message;
  }

  // ============================================================================
  // REMOTE METHOD CALLS
  // ============================================================================

  async callMethod(method: string, args: Record<string, any> = {}): Promise<any> {
    const response = await this.client.post(`/method/${method}`, args);
    return response.data.message;
  }
}

// Factory function
export function createERPNextService(baseUrl: string, apiKey: string, apiSecret: string): ERPNextService {
  return new ERPNextService({ baseUrl, apiKey, apiSecret });
}
