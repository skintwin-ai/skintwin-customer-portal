import { AppDashboardLayout } from "@/components/AppDashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { 
  Shield, Building2, Users, Calendar, DollarSign, ShoppingBag, 
  MapPin, BarChart3, Settings, TrendingUp, Package,
  FileText, Link2, Truck, Database
} from "lucide-react";
import { useLocation } from "wouter";

const navItems = [
  { label: "Overview", href: "/dashboard", icon: <Shield className="h-4 w-4" /> },
  { label: "Organizations", href: "/customers", icon: <Building2 className="h-4 w-4" /> },
  { label: "Locations", href: "/locations", icon: <MapPin className="h-4 w-4" /> },
  { label: "Therapists", href: "/therapists", icon: <Users className="h-4 w-4" /> },
  { label: "Customers", href: "/customers", icon: <Users className="h-4 w-4" /> },
  { label: "Bookings", href: "/bookings", icon: <Calendar className="h-4 w-4" /> },
  { label: "Orders", href: "/orders", icon: <ShoppingBag className="h-4 w-4" /> },
  { label: "Products", href: "/products", icon: <Package className="h-4 w-4" /> },
  { label: "Commissions", href: "/commissions", icon: <DollarSign className="h-4 w-4" /> },
  { label: "Procurement", href: "/procurement", icon: <Truck className="h-4 w-4" /> },
  { label: "Reports", href: "/reports", icon: <BarChart3 className="h-4 w-4" /> },
  { label: "Integrations", href: "/integrations", icon: <Link2 className="h-4 w-4" /> },
  { label: "Settings", href: "/settings", icon: <Settings className="h-4 w-4" /> },
];

export default function AdminDashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  return (
    <AppDashboardLayout
      title="Admin Dashboard"
      navItems={navItems}
      currentPath="/dashboard"
    >
      <div className="space-y-6">
        {/* Welcome Section */}
        <div className="bg-gradient-to-r from-slate-100 to-zinc-100 rounded-xl p-6">
          <h1 className="text-2xl font-bold mb-2">Welcome, {user?.name || 'Administrator'}!</h1>
          <p className="text-muted-foreground">
            Full system access. Manage organizations, integrations, and platform operations.
          </p>
        </div>

        {/* System Stats */}
        <div className="grid md:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Organizations</CardDescription>
              <CardTitle className="text-3xl">0</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Building2 className="h-3 w-3" /> Active businesses
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Users</CardDescription>
              <CardTitle className="text-3xl">0</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Users className="h-3 w-3" /> All roles
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Revenue</CardDescription>
              <CardTitle className="text-3xl">$0.00</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-green-600 flex items-center gap-1">
                <TrendingUp className="h-3 w-3" /> Platform-wide
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Active Integrations</CardDescription>
              <CardTitle className="text-3xl">0</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Link2 className="h-3 w-3" /> Connected services
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Pending Actions</CardDescription>
              <CardTitle className="text-3xl">0</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-amber-600 flex items-center gap-1">
                <FileText className="h-3 w-3" /> Requires attention
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Admin Quick Actions */}
        <div className="grid md:grid-cols-4 gap-4">
          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setLocation('/integrations')}>
            <CardHeader className="pb-2">
              <Link2 className="h-8 w-8 text-blue-500 mb-2" />
              <CardTitle className="text-lg">Manage Integrations</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>Configure Shopify, Stripe, QuickBooks, ERPNext</CardDescription>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setLocation('/procurement')}>
            <CardHeader className="pb-2">
              <Truck className="h-8 w-8 text-emerald-500 mb-2" />
              <CardTitle className="text-lg">Procurement</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>Manage suppliers and purchase orders</CardDescription>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setLocation('/reports')}>
            <CardHeader className="pb-2">
              <BarChart3 className="h-8 w-8 text-purple-500 mb-2" />
              <CardTitle className="text-lg">Generate Reports</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>Commission, sales, and analytics reports</CardDescription>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setLocation('/settings')}>
            <CardHeader className="pb-2">
              <Settings className="h-8 w-8 text-slate-500 mb-2" />
              <CardTitle className="text-lg">System Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>Platform configuration and preferences</CardDescription>
            </CardContent>
          </Card>
        </div>

        {/* Integration Status */}
        <Card>
          <CardHeader>
            <CardTitle>Integration Status</CardTitle>
            <CardDescription>Connected external services</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-4 gap-4">
              {['Shopify', 'Stripe', 'PayStack', 'Wix', 'QuickBooks', 'Xero', 'ERPNext', 'WorkOS'].map((integration) => (
                <div key={integration} className="flex items-center justify-between p-3 border rounded-lg">
                  <span className="font-medium">{integration}</span>
                  <span className="text-xs px-2 py-1 bg-muted rounded-full text-muted-foreground">
                    Not Connected
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Recent Audit Log</CardTitle>
              <CardDescription>System activity and changes</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No recent activity</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>System Health</CardTitle>
              <CardDescription>Platform status and metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span>Database</span>
                  <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full">Healthy</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>API Services</span>
                  <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full">Operational</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Payment Processing</span>
                  <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full">Pending Setup</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Email Notifications</span>
                  <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full">Active</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppDashboardLayout>
  );
}
