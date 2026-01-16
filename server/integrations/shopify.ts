import axios, { AxiosInstance } from 'axios';

interface ShopifyConfig {
  storeUrl: string;
  accessToken: string;
}

interface ShopifyProduct {
  id: number;
  title: string;
  body_html: string;
  vendor: string;
  product_type: string;
  handle: string;
  status: string;
  variants: ShopifyVariant[];
  images: ShopifyImage[];
}

interface ShopifyVariant {
  id: number;
  product_id: number;
  title: string;
  price: string;
  sku: string;
  inventory_quantity: number;
}

interface ShopifyImage {
  id: number;
  src: string;
  alt: string;
}

interface ShopifyOrder {
  id: number;
  order_number: number;
  email: string;
  total_price: string;
  subtotal_price: string;
  total_tax: string;
  currency: string;
  financial_status: string;
  fulfillment_status: string;
  customer: ShopifyCustomer;
  line_items: ShopifyLineItem[];
  shipping_address: ShopifyAddress;
  billing_address: ShopifyAddress;
  created_at: string;
}

interface ShopifyCustomer {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
}

interface ShopifyLineItem {
  id: number;
  product_id: number;
  variant_id: number;
  title: string;
  quantity: number;
  price: string;
  sku: string;
}

interface ShopifyAddress {
  first_name: string;
  last_name: string;
  address1: string;
  address2: string;
  city: string;
  province: string;
  country: string;
  zip: string;
  phone: string;
}

export class ShopifyService {
  private client: AxiosInstance;
  private storeUrl: string;

  constructor(config: ShopifyConfig) {
    this.storeUrl = config.storeUrl.replace(/\/$/, '');
    this.client = axios.create({
      baseURL: `${this.storeUrl}/admin/api/2024-01`,
      headers: {
        'X-Shopify-Access-Token': config.accessToken,
        'Content-Type': 'application/json',
      },
    });
  }

  // ============================================================================
  // PRODUCTS
  // ============================================================================

  async getProducts(limit = 250, sinceId?: number): Promise<ShopifyProduct[]> {
    const params: Record<string, any> = { limit };
    if (sinceId) params.since_id = sinceId;
    
    const response = await this.client.get('/products.json', { params });
    return response.data.products;
  }

  async getProduct(productId: number): Promise<ShopifyProduct> {
    const response = await this.client.get(`/products/${productId}.json`);
    return response.data.product;
  }

  async getAllProducts(): Promise<ShopifyProduct[]> {
    const allProducts: ShopifyProduct[] = [];
    let sinceId: number | undefined;
    
    while (true) {
      const products = await this.getProducts(250, sinceId);
      if (products.length === 0) break;
      
      allProducts.push(...products);
      sinceId = products[products.length - 1].id;
      
      if (products.length < 250) break;
    }
    
    return allProducts;
  }

  async updateProductInventory(inventoryItemId: number, locationId: number, quantity: number): Promise<void> {
    await this.client.post('/inventory_levels/set.json', {
      inventory_item_id: inventoryItemId,
      location_id: locationId,
      available: quantity,
    });
  }

  // ============================================================================
  // ORDERS
  // ============================================================================

  async getOrders(params: {
    status?: string;
    limit?: number;
    since_id?: number;
    created_at_min?: string;
    created_at_max?: string;
  } = {}): Promise<ShopifyOrder[]> {
    const response = await this.client.get('/orders.json', { params: { limit: 250, ...params } });
    return response.data.orders;
  }

  async getOrder(orderId: number): Promise<ShopifyOrder> {
    const response = await this.client.get(`/orders/${orderId}.json`);
    return response.data.order;
  }

  async createOrder(orderData: Partial<ShopifyOrder>): Promise<ShopifyOrder> {
    const response = await this.client.post('/orders.json', { order: orderData });
    return response.data.order;
  }

  async updateOrder(orderId: number, updates: Partial<ShopifyOrder>): Promise<ShopifyOrder> {
    const response = await this.client.put(`/orders/${orderId}.json`, { order: updates });
    return response.data.order;
  }

  async cancelOrder(orderId: number, reason?: string): Promise<ShopifyOrder> {
    const response = await this.client.post(`/orders/${orderId}/cancel.json`, { reason });
    return response.data.order;
  }

  // ============================================================================
  // CUSTOMERS
  // ============================================================================

  async getCustomers(limit = 250, sinceId?: number): Promise<ShopifyCustomer[]> {
    const params: Record<string, any> = { limit };
    if (sinceId) params.since_id = sinceId;
    
    const response = await this.client.get('/customers.json', { params });
    return response.data.customers;
  }

  async getCustomer(customerId: number): Promise<ShopifyCustomer> {
    const response = await this.client.get(`/customers/${customerId}.json`);
    return response.data.customer;
  }

  async searchCustomers(query: string): Promise<ShopifyCustomer[]> {
    const response = await this.client.get('/customers/search.json', { params: { query } });
    return response.data.customers;
  }

  async createCustomer(customerData: Partial<ShopifyCustomer>): Promise<ShopifyCustomer> {
    const response = await this.client.post('/customers.json', { customer: customerData });
    return response.data.customer;
  }

  // ============================================================================
  // LOCATIONS (for POS)
  // ============================================================================

  async getLocations(): Promise<any[]> {
    const response = await this.client.get('/locations.json');
    return response.data.locations;
  }

  // ============================================================================
  // WEBHOOKS
  // ============================================================================

  async createWebhook(topic: string, address: string): Promise<any> {
    const response = await this.client.post('/webhooks.json', {
      webhook: {
        topic,
        address,
        format: 'json',
      },
    });
    return response.data.webhook;
  }

  async getWebhooks(): Promise<any[]> {
    const response = await this.client.get('/webhooks.json');
    return response.data.webhooks;
  }

  async deleteWebhook(webhookId: number): Promise<void> {
    await this.client.delete(`/webhooks/${webhookId}.json`);
  }

  // ============================================================================
  // FULFILLMENT
  // ============================================================================

  async createFulfillment(orderId: number, fulfillmentData: {
    location_id: number;
    tracking_number?: string;
    tracking_company?: string;
    line_items?: { id: number; quantity: number }[];
  }): Promise<any> {
    const response = await this.client.post(`/orders/${orderId}/fulfillments.json`, {
      fulfillment: fulfillmentData,
    });
    return response.data.fulfillment;
  }
}

// Factory function to create Shopify service from credentials
export function createShopifyService(storeUrl: string, accessToken: string): ShopifyService {
  return new ShopifyService({ storeUrl, accessToken });
}
