import { AppDashboardLayout } from "@/components/AppDashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { 
  Users, Calendar, DollarSign, FileText, Clock, 
  TrendingUp, UserCheck, Clipboard
} from "lucide-react";
import { useLocation } from "wouter";

const navItems = [
  { label: "Overview", href: "/dashboard", icon: <UserCheck className="h-4 w-4" /> },
  { label: "My Customers", href: "/customers", icon: <Users className="h-4 w-4" /> },
  { label: "Bookings", href: "/bookings", icon: <Calendar className="h-4 w-4" /> },
  { label: "Consultations", href: "/consultations", icon: <FileText className="h-4 w-4" /> },
  { label: "Treatments", href: "/treatments", icon: <Clock className="h-4 w-4" /> },
  { label: "Commissions", href: "/commissions", icon: <DollarSign className="h-4 w-4" /> },
];

export default function TherapistDashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  return (
    <AppDashboardLayout
      title="Therapist Dashboard"
      navItems={navItems}
      currentPath="/dashboard"
    >
      <div className="space-y-6">
        {/* Welcome Section */}
        <div className="bg-gradient-to-r from-emerald-100 to-teal-100 rounded-xl p-6">
          <h1 className="text-2xl font-bold mb-2">Welcome, {user?.name || 'Therapist'}!</h1>
          <p className="text-muted-foreground">
            Manage your clients, track commissions, and provide excellent care.
          </p>
        </div>

        {/* Stats Overview */}
        <div className="grid md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Customers</CardDescription>
              <CardTitle className="text-3xl">0</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Users className="h-3 w-3" /> Assigned to you
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Today's Bookings</CardDescription>
              <CardTitle className="text-3xl">0</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Scheduled appointments
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
                <DollarSign className="h-3 w-3" /> Awaiting approval
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>This Month</CardDescription>
              <CardTitle className="text-3xl">$0.00</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-green-600 flex items-center gap-1">
                <TrendingUp className="h-3 w-3" /> Total earnings
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-3 gap-4">
          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setLocation('/consultations')}>
            <CardHeader className="pb-2">
              <Clipboard className="h-8 w-8 text-emerald-500 mb-2" />
              <CardTitle className="text-lg">New Consultation</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>Start a new customer consultation</CardDescription>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setLocation('/treatments')}>
            <CardHeader className="pb-2">
              <Clock className="h-8 w-8 text-teal-500 mb-2" />
              <CardTitle className="text-lg">Record Treatment</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>Log a completed treatment session</CardDescription>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setLocation('/commissions')}>
            <CardHeader className="pb-2">
              <DollarSign className="h-8 w-8 text-amber-500 mb-2" />
              <CardTitle className="text-lg">View Commissions</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>Track your earnings and payouts</CardDescription>
            </CardContent>
          </Card>
        </div>

        {/* Today's Schedule */}
        <Card>
          <CardHeader>
            <CardTitle>Today's Schedule</CardTitle>
            <CardDescription>Your appointments for today</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No appointments scheduled for today</p>
              <Button variant="outline" className="mt-4" onClick={() => setLocation('/bookings')}>
                View All Bookings
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Recent Customers */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Customers</CardTitle>
            <CardDescription>Customers you've recently worked with</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No recent customer activity</p>
              <Button variant="outline" className="mt-4" onClick={() => setLocation('/customers')}>
                View All Customers
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppDashboardLayout>
  );
}
