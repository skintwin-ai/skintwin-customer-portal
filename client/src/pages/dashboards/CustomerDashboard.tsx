import { AppDashboardLayout } from "@/components/AppDashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Calendar, ShoppingBag, User, FileText, Clock, Package } from "lucide-react";
import { useLocation } from "wouter";

const navItems = [
  { label: "Overview", href: "/dashboard", icon: <User className="h-4 w-4" /> },
  { label: "My Bookings", href: "/bookings", icon: <Calendar className="h-4 w-4" /> },
  { label: "My Orders", href: "/orders", icon: <ShoppingBag className="h-4 w-4" /> },
  { label: "Consultations", href: "/consultations", icon: <FileText className="h-4 w-4" /> },
  { label: "Treatments", href: "/treatments", icon: <Clock className="h-4 w-4" /> },
  { label: "Products", href: "/products", icon: <Package className="h-4 w-4" /> },
];

export default function CustomerDashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  return (
    <AppDashboardLayout
      title="My Dashboard"
      navItems={navItems}
      currentPath="/dashboard"
    >
      <div className="space-y-6">
        {/* Welcome Section */}
        <div className="bg-gradient-to-r from-rose-100 to-amber-100 rounded-xl p-6">
          <h1 className="text-2xl font-bold mb-2">Welcome back, {user?.name || 'Customer'}!</h1>
          <p className="text-muted-foreground">
            Manage your appointments, track orders, and stay connected with your therapist.
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-3 gap-4">
          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setLocation('/bookings')}>
            <CardHeader className="pb-2">
              <Calendar className="h-8 w-8 text-rose-500 mb-2" />
              <CardTitle className="text-lg">Book Appointment</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>Schedule your next treatment or consultation</CardDescription>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setLocation('/orders')}>
            <CardHeader className="pb-2">
              <ShoppingBag className="h-8 w-8 text-amber-500 mb-2" />
              <CardTitle className="text-lg">Shop Products</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>Browse and order recommended skincare products</CardDescription>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setLocation('/consultations')}>
            <CardHeader className="pb-2">
              <FileText className="h-8 w-8 text-blue-500 mb-2" />
              <CardTitle className="text-lg">View History</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>Review your consultation notes and treatment history</CardDescription>
            </CardContent>
          </Card>
        </div>

        {/* Assigned Therapist */}
        <Card>
          <CardHeader>
            <CardTitle>Your Therapist</CardTitle>
            <CardDescription>Your assigned skincare specialist</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-rose-100 flex items-center justify-center">
                <User className="h-8 w-8 text-rose-600" />
              </div>
              <div>
                <p className="font-semibold">Contact your salon to get assigned a therapist</p>
                <p className="text-sm text-muted-foreground">Your therapist will provide personalized care and recommendations</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Your latest appointments and orders</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No recent activity</p>
              <Button variant="outline" className="mt-4" onClick={() => setLocation('/bookings')}>
                Book Your First Appointment
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppDashboardLayout>
  );
}
