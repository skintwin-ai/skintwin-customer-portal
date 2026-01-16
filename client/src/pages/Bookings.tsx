import { AppDashboardLayout } from "@/components/AppDashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";
import { Calendar, Plus, Clock, User } from "lucide-react";
import { useLocation } from "wouter";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: <User className="h-4 w-4" /> },
  { label: "Bookings", href: "/bookings", icon: <Calendar className="h-4 w-4" /> },
];

export default function Bookings() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  return (
    <AppDashboardLayout
      title="Bookings"
      navItems={navItems}
      currentPath="/bookings"
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Bookings</h1>
            <p className="text-muted-foreground">Manage appointments and schedules</p>
          </div>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Booking
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Upcoming Appointments</CardTitle>
            <CardDescription>Your scheduled bookings</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12 text-muted-foreground">
              <Calendar className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg mb-2">No bookings yet</p>
              <p className="text-sm">Create your first booking to get started</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppDashboardLayout>
  );
}
