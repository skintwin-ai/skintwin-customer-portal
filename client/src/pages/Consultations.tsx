import { AppDashboardLayout } from "@/components/AppDashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";
import { FileText, Plus, User, Calendar, Clock, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: <User className="h-4 w-4" /> },
  { label: "Consultations", href: "/consultations", icon: <FileText className="h-4 w-4" /> },
];

const mockConsultations = [
  { id: 1, customerName: "Emily Davis", therapistName: "Sarah Johnson", date: "2026-01-15", type: "Initial Assessment", status: "completed", skinType: "Combination", concerns: ["Acne", "Hyperpigmentation"] },
  { id: 2, customerName: "Michael Brown", therapistName: "Sarah Johnson", date: "2026-01-14", type: "Follow-up", status: "completed", skinType: "Oily", concerns: ["Large pores", "Blackheads"] },
  { id: 3, customerName: "Lisa Wilson", therapistName: "John Smith", date: "2026-01-16", type: "Initial Assessment", status: "scheduled", skinType: "Dry", concerns: ["Fine lines", "Dehydration"] },
];

export default function Consultations() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed': return <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />Completed</span>;
      case 'scheduled': return <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full flex items-center gap-1"><Clock className="h-3 w-3" />Scheduled</span>;
      default: return <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded-full">{status}</span>;
    }
  };

  return (
    <AppDashboardLayout title="Consultations" navItems={navItems} currentPath="/consultations">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Consultation Records</h1>
            <p className="text-muted-foreground">Track customer consultations and skin assessments</p>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />New Consultation</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>New Consultation</DialogTitle>
                <DialogDescription>Record a new customer consultation</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2"><Label>Customer</Label><Input placeholder="Select customer" /></div>
                  <div className="grid gap-2"><Label>Consultation Type</Label><Input placeholder="Initial Assessment" /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2"><Label>Skin Type</Label><Input placeholder="e.g., Combination, Oily, Dry" /></div>
                  <div className="grid gap-2"><Label>Date</Label><Input type="date" /></div>
                </div>
                <div className="grid gap-2"><Label>Skin Concerns</Label><Input placeholder="e.g., Acne, Hyperpigmentation, Fine lines" /></div>
                <div className="grid gap-2"><Label>Notes</Label><Textarea placeholder="Detailed consultation notes..." rows={4} /></div>
                <div className="grid gap-2"><Label>Recommendations</Label><Textarea placeholder="Product and treatment recommendations..." rows={3} /></div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                <Button onClick={() => { toast.success("Consultation recorded"); setIsAddDialogOpen(false); }}>Save Consultation</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Consultations</CardDescription>
              <CardTitle className="text-3xl">{mockConsultations.length}</CardTitle>
            </CardHeader>
            <CardContent><p className="text-xs text-muted-foreground">All time records</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Completed This Month</CardDescription>
              <CardTitle className="text-3xl">{mockConsultations.filter(c => c.status === 'completed').length}</CardTitle>
            </CardHeader>
            <CardContent><p className="text-xs text-green-600">Successfully completed</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Upcoming</CardDescription>
              <CardTitle className="text-3xl">{mockConsultations.filter(c => c.status === 'scheduled').length}</CardTitle>
            </CardHeader>
            <CardContent><p className="text-xs text-blue-600">Scheduled consultations</p></CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {mockConsultations.map((consultation) => (
            <Card key={consultation.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center">
                      <User className="h-6 w-6 text-rose-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{consultation.customerName}</h3>
                      <p className="text-sm text-muted-foreground">with {consultation.therapistName}</p>
                      <div className="flex items-center gap-4 mt-2">
                        <span className="text-sm flex items-center gap-1"><Calendar className="h-4 w-4" />{consultation.date}</span>
                        <span className="text-sm text-muted-foreground">{consultation.type}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {getStatusBadge(consultation.status)}
                    <Button variant="outline" size="sm">View Details</Button>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium mb-1">Skin Type</p>
                      <p className="text-sm text-muted-foreground">{consultation.skinType}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium mb-1">Concerns</p>
                      <div className="flex flex-wrap gap-1">
                        {consultation.concerns.map((concern, i) => (
                          <span key={i} className="text-xs px-2 py-1 bg-muted rounded-full">{concern}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppDashboardLayout>
  );
}
