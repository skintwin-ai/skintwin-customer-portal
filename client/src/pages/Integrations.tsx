import { AppDashboardLayout } from "@/components/AppDashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/_core/hooks/useAuth";
import { 
  Link2, ShoppingBag, CreditCard, Calendar, Calculator,
  Truck, Shield, CheckCircle2, XCircle, Settings, RefreshCw
} from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { toast } from "sonner";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: <Settings className="h-4 w-4" /> },
  { label: "Integrations", href: "/integrations", icon: <Link2 className="h-4 w-4" /> },
];

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  category: 'ecommerce' | 'payments' | 'bookings' | 'accounting' | 'procurement' | 'auth';
  status: 'connected' | 'disconnected' | 'error';
  fields: { key: string; label: string; type: string; placeholder: string }[];
}

const integrations: Integration[] = [
  {
    id: 'shopify',
    name: 'Shopify',
    description: 'E-commerce platform for products and orders',
    icon: <ShoppingBag className="h-6 w-6" />,
    category: 'ecommerce',
    status: 'disconnected',
    fields: [
      { key: 'shopUrl', label: 'Shop URL', type: 'text', placeholder: 'your-store.myshopify.com' },
      { key: 'accessToken', label: 'Access Token', type: 'password', placeholder: 'shpat_...' },
    ],
  },
  {
    id: 'stripe',
    name: 'Stripe',
    description: 'International payment processing',
    icon: <CreditCard className="h-6 w-6" />,
    category: 'payments',
    status: 'disconnected',
    fields: [
      { key: 'secretKey', label: 'Secret Key', type: 'password', placeholder: 'sk_live_...' },
      { key: 'webhookSecret', label: 'Webhook Secret', type: 'password', placeholder: 'whsec_...' },
    ],
  },
  {
    id: 'paystack',
    name: 'PayStack',
    description: 'African market payment processing',
    icon: <CreditCard className="h-6 w-6" />,
    category: 'payments',
    status: 'disconnected',
    fields: [
      { key: 'secretKey', label: 'Secret Key', type: 'password', placeholder: 'sk_live_...' },
      { key: 'publicKey', label: 'Public Key', type: 'text', placeholder: 'pk_live_...' },
    ],
  },
  {
    id: 'wix',
    name: 'Wix Bookings',
    description: 'B2B salon appointment management',
    icon: <Calendar className="h-6 w-6" />,
    category: 'bookings',
    status: 'disconnected',
    fields: [
      { key: 'apiKey', label: 'API Key', type: 'password', placeholder: 'Your Wix API key' },
      { key: 'siteId', label: 'Site ID', type: 'text', placeholder: 'Your Wix site ID' },
    ],
  },
  {
    id: 'quickbooks',
    name: 'QuickBooks',
    description: 'Accounting and financial management',
    icon: <Calculator className="h-6 w-6" />,
    category: 'accounting',
    status: 'disconnected',
    fields: [
      { key: 'clientId', label: 'Client ID', type: 'text', placeholder: 'OAuth Client ID' },
      { key: 'clientSecret', label: 'Client Secret', type: 'password', placeholder: 'OAuth Client Secret' },
      { key: 'realmId', label: 'Realm ID', type: 'text', placeholder: 'Company ID' },
    ],
  },
  {
    id: 'xero',
    name: 'Xero',
    description: 'Cloud accounting platform',
    icon: <Calculator className="h-6 w-6" />,
    category: 'accounting',
    status: 'disconnected',
    fields: [
      { key: 'clientId', label: 'Client ID', type: 'text', placeholder: 'OAuth Client ID' },
      { key: 'clientSecret', label: 'Client Secret', type: 'password', placeholder: 'OAuth Client Secret' },
    ],
  },
  {
    id: 'gnucash',
    name: 'GnuCash',
    description: 'Open-source accounting via XML export',
    icon: <Calculator className="h-6 w-6" />,
    category: 'accounting',
    status: 'disconnected',
    fields: [
      { key: 'exportPath', label: 'Export Path', type: 'text', placeholder: '/path/to/gnucash/exports' },
    ],
  },
  {
    id: 'erpnext',
    name: 'ERPNext',
    description: 'Procurement and supply chain management',
    icon: <Truck className="h-6 w-6" />,
    category: 'procurement',
    status: 'disconnected',
    fields: [
      { key: 'baseUrl', label: 'ERPNext URL', type: 'text', placeholder: 'https://your-instance.erpnext.com' },
      { key: 'apiKey', label: 'API Key', type: 'password', placeholder: 'Your API key' },
      { key: 'apiSecret', label: 'API Secret', type: 'password', placeholder: 'Your API secret' },
    ],
  },
  {
    id: 'workos',
    name: 'WorkOS',
    description: 'Enterprise SSO and directory sync',
    icon: <Shield className="h-6 w-6" />,
    category: 'auth',
    status: 'disconnected',
    fields: [
      { key: 'apiKey', label: 'API Key', type: 'password', placeholder: 'sk_...' },
      { key: 'clientId', label: 'Client ID', type: 'text', placeholder: 'client_...' },
    ],
  },
];

export default function Integrations() {
  const { user } = useAuth();
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});

  const handleConnect = (integration: Integration) => {
    setSelectedIntegration(integration);
    setFormData({});
  };

  const handleSave = () => {
    toast.success(`${selectedIntegration?.name} connected successfully`);
    setSelectedIntegration(null);
  };

  const getStatusBadge = (status: Integration['status']) => {
    switch (status) {
      case 'connected':
        return (
          <span className="flex items-center gap-1 text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full">
            <CheckCircle2 className="h-3 w-3" /> Connected
          </span>
        );
      case 'error':
        return (
          <span className="flex items-center gap-1 text-xs px-2 py-1 bg-red-100 text-red-700 rounded-full">
            <XCircle className="h-3 w-3" /> Error
          </span>
        );
      default:
        return (
          <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded-full">
            Not Connected
          </span>
        );
    }
  };

  const categories = [
    { id: 'all', label: 'All' },
    { id: 'ecommerce', label: 'E-Commerce' },
    { id: 'payments', label: 'Payments' },
    { id: 'bookings', label: 'Bookings' },
    { id: 'accounting', label: 'Accounting' },
    { id: 'procurement', label: 'Procurement' },
    { id: 'auth', label: 'Authentication' },
  ];

  return (
    <AppDashboardLayout
      title="Integrations"
      navItems={navItems}
      currentPath="/integrations"
    >
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Integrations</h1>
          <p className="text-muted-foreground">Connect your external services and platforms</p>
        </div>

        <Tabs defaultValue="all">
          <TabsList className="mb-4">
            {categories.map((cat) => (
              <TabsTrigger key={cat.id} value={cat.id}>
                {cat.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {categories.map((cat) => (
            <TabsContent key={cat.id} value={cat.id}>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {integrations
                  .filter((i) => cat.id === 'all' || i.category === cat.id)
                  .map((integration) => (
                    <Card key={integration.id} className="hover:shadow-lg transition-shadow">
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${
                              integration.status === 'connected' 
                                ? 'bg-green-100 text-green-600'
                                : 'bg-muted text-muted-foreground'
                            }`}>
                              {integration.icon}
                            </div>
                            <div>
                              <CardTitle className="text-lg">{integration.name}</CardTitle>
                              <CardDescription className="text-xs">
                                {integration.description}
                              </CardDescription>
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between">
                          {getStatusBadge(integration.status)}
                          {integration.status === 'connected' ? (
                            <div className="flex gap-2">
                              <Button variant="ghost" size="sm">
                                <RefreshCw className="h-4 w-4 mr-1" />
                                Sync
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => handleConnect(integration)}>
                                <Settings className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <Button size="sm" onClick={() => handleConnect(integration)}>
                              Connect
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            </TabsContent>
          ))}
        </Tabs>

        <Dialog open={!!selectedIntegration} onOpenChange={() => setSelectedIntegration(null)}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {selectedIntegration?.icon}
                Connect {selectedIntegration?.name}
              </DialogTitle>
              <DialogDescription>
                Enter your {selectedIntegration?.name} credentials to connect
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {selectedIntegration?.fields.map((field) => (
                <div key={field.key} className="grid gap-2">
                  <Label htmlFor={field.key}>{field.label}</Label>
                  <Input
                    id={field.key}
                    type={field.type}
                    placeholder={field.placeholder}
                    value={formData[field.key] || ''}
                    onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                  />
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedIntegration(null)}>
                Cancel
              </Button>
              <Button onClick={handleSave}>
                Connect
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Card>
          <CardHeader>
            <CardTitle>Integration Summary</CardTitle>
            <CardDescription>Overview of all connected services</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-3xl font-bold text-green-600">
                  {integrations.filter((i) => i.status === 'connected').length}
                </p>
                <p className="text-sm text-muted-foreground">Connected</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-3xl font-bold text-gray-600">
                  {integrations.filter((i) => i.status === 'disconnected').length}
                </p>
                <p className="text-sm text-muted-foreground">Not Connected</p>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <p className="text-3xl font-bold text-red-600">
                  {integrations.filter((i) => i.status === 'error').length}
                </p>
                <p className="text-sm text-muted-foreground">Errors</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppDashboardLayout>
  );
}
