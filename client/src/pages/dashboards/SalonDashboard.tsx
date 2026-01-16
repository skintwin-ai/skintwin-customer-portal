import { AppDashboardLayout } from "@/components/AppDashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { 
  Building2, Users, Calendar, DollarSign, ShoppingBag, 
  MapPin, BarChart3, Settings, TrendingUp, Package,
  FileText, Link2
} from "lucide-react";
import { useLocation } from "wouter";

const navItems = [
  { label: "Overview", href: "/dashboard", icon: <Building2 className="h-4 w-4" /> },
  { label: "Locations", href: "/locations", icon: <MapPin className="h-4 w-4" /> },
  { label: "Therapists", href: "/therapists", icon: <Users className="h-4 w-4" /> },
  { label: "Customers", href: "/customers", icon: <Users className="h-4 w-4" /> },
  { label: "Bookings", href: "/bookings", icon: <Calendar className="h-4 w-4" /> },
  { label: "Orders", href: "/orders", icon: <ShoppingBag className="h-4 w-4" /> },
  { label: "Commissions", href: "/commissions", icon: <DollarSign className="h-4 w-4" /> },
  { label: "Products", href: "/products", icon: <Package className="h-4 w-4" /> },
  { label: "Reports", href: "/reports", icon: <BarChart3 className="h-4 w-4" /> },
  { label: "Integrations", href: "/integrations", icon: <Link2 className="h-4 w-4" /> },
  { label: "Settings", href: "/settings", icon: <Settings className="h-4 w-4" /> },
];

export default function SalonDashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  return (
    <AppDashboardLayout
      title="Salon Dashboard"
      navItems={navItems}
      currentPath="/dashboard"
    >
      <div className="space-y-6">
        {/* Welcome Section */}
        <div className="bg-gradient-to-r from-purple-100 to-pink-100 rounded-xl p-6">
          <h1 className="text-2xl font-bold mb-2">Welcome, {user?.name || 'Salon Owner'}!</h1>
          <p className="text-muted-foreground">
            Manage your salon operations, staff, and customer relationships.
          </p>
        </div>

        {/* Stats Overview */}
        <div className="grid md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Locations</CardDescription>
              <CardTitle className="text-3xl">0</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3" /> Active salons
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Therapists</CardDescription>
              <CardTitle className="text-3xl">0</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Users className="h-3 w-3" /> Staff members
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Today's Revenue</CardDescription>
              <CardTitle className="text-3xl">$0.00</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-green-600 flex items-center gap-1">
                <TrendingUp className="h-3 w-3" /> +0% from yesterday
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Pending Commissions</CardDescription>
              <CardTitle className="text-3xl">$0.00</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <DollarSign className="h-3 w-3" /> To be paid
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-4 gap-4">
          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setLocation('/locations')}>
            <CardHeader className="pb-2">
              <MapPin className="h-8 w-8 text-purple-500 mb-2" />
              <CardTitle className="text-lg">Manage Locations</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>View and manage your salon locations</CardDescription>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setLocation('/therapists')}>
            <CardHeader className="pb-2">
              <Users className="h-8 w-8 text-pink-500 mb-2" />
              <CardTitle className="text-lg">Manage Staff</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>Assign therapists and manage commissions</CardDescription>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setLocation('/reports')}>
            <CardHeader className="pb-2">
              <BarChart3 className="h-8 w-8 text-blue-500 mb-2" />
              <CardTitle className="text-lg">View Reports</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>Sales, commissions, and analytics</CardDescription>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setLocation('/integrations')}>
            <CardHeader className="pb-2">
              <Link2 className="h-8 w-8 text-amber-500 mb-2" />
              <CardTitle className="text-lg">Integrations</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>Connect Shopify, Wix, QuickBooks</CardDescription>
            </CardContent>
          </Card>
        </div>

        {/* Location Map Placeholder */}
        <Card>
          <CardHeader>
            <CardTitle>Your Locations</CardTitle>
            <CardDescription>Interactive map showing all your salon locations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 bg-muted rounded-lg flex items-center justify-center">
              <div className="text-center">
                <MapPin className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">No locations added yet</p>
                <Button variant="outline" className="mt-4" onClick={() => setLocation('/locations')}>
                  Add Your First Location
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Recent Bookings</CardTitle>
              <CardDescription>Latest customer appointments</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No recent bookings</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Orders</CardTitle>
              <CardDescription>Latest product sales</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <ShoppingBag className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No recent orders</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppDashboardLayout>
  );
}
