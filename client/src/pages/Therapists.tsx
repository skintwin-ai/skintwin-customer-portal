import { AppDashboardLayout } from "@/components/AppDashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/_core/hooks/useAuth";
import { Users, Plus, Mail, Phone, MapPin, DollarSign, Star, Calendar } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: <Users className="h-4 w-4" /> },
  { label: "Therapists", href: "/therapists", icon: <Users className="h-4 w-4" /> },
];

const mockTherapists = [
  { id: 1, name: "Sarah Johnson", email: "sarah@skintwin.com", phone: "+27 82 123 4567", location: "Downtown Spa", customers: 45, rating: 4.9, commissionRate: 15, totalEarnings: 12500 },
  { id: 2, name: "John Smith", email: "john@skintwin.com", phone: "+27 82 987 6543", location: "Waterfront Branch", customers: 38, rating: 4.8, commissionRate: 15, totalEarnings: 10200 },
  { id: 3, name: "Emily Davis", email: "emily@skintwin.com", phone: "+27 82 456 7890", location: "Downtown Spa", customers: 52, rating: 4.95, commissionRate: 18, totalEarnings: 15800 },
];

export default function Therapists() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  return (
    <AppDashboardLayout title="Therapists" navItems={navItems} currentPath="/therapists">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Therapist Management</h1>
            <p className="text-muted-foreground">Manage your therapist team and assignments</p>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Add Therapist</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Therapist</DialogTitle>
                <DialogDescription>Add a new therapist to your team</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2"><Label>Full Name</Label><Input placeholder="Enter full name" /></div>
                <div className="grid gap-2"><Label>Email</Label><Input type="email" placeholder="therapist@example.com" /></div>
                <div className="grid gap-2"><Label>Phone</Label><Input placeholder="+27 82 000 0000" /></div>
                <div className="grid gap-2"><Label>Commission Rate (%)</Label><Input type="number" placeholder="15" /></div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                <Button onClick={() => { toast.success("Therapist added"); setIsAddDialogOpen(false); }}>Add Therapist</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Therapists</CardDescription>
              <CardTitle className="text-3xl">{mockTherapists.length}</CardTitle>
            </CardHeader>
            <CardContent><p className="text-xs text-muted-foreground">Active staff members</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Customers Served</CardDescription>
              <CardTitle className="text-3xl">{mockTherapists.reduce((sum, t) => sum + t.customers, 0)}</CardTitle>
            </CardHeader>
            <CardContent><p className="text-xs text-muted-foreground">Across all therapists</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Average Rating</CardDescription>
              <CardTitle className="text-3xl flex items-center gap-1">
                {(mockTherapists.reduce((sum, t) => sum + t.rating, 0) / mockTherapists.length).toFixed(1)}
                <Star className="h-6 w-6 text-yellow-500 fill-yellow-500" />
              </CardTitle>
            </CardHeader>
            <CardContent><p className="text-xs text-muted-foreground">Customer satisfaction</p></CardContent>
          </Card>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {mockTherapists.map((therapist) => (
            <Card key={therapist.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-rose-100 text-rose-700">
                      {therapist.name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-lg">{therapist.name}</CardTitle>
                    <CardDescription className="flex items-center gap-1">
                      <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                      {therapist.rating} rating
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="h-4 w-4" /><span>{therapist.email}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="h-4 w-4" /><span>{therapist.phone}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" /><span>{therapist.location}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                  <div className="text-center p-2 bg-muted rounded">
                    <p className="text-lg font-bold">{therapist.customers}</p>
                    <p className="text-xs text-muted-foreground">Customers</p>
                  </div>
                  <div className="text-center p-2 bg-muted rounded">
                    <p className="text-lg font-bold">${(therapist.totalEarnings / 1000).toFixed(1)}k</p>
                    <p className="text-xs text-muted-foreground">Earnings</p>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2">
                  <span className="text-sm text-muted-foreground">Commission Rate</span>
                  <span className="font-semibold text-green-600">{therapist.commissionRate}%</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppDashboardLayout>
  );
}
