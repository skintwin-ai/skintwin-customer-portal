import { AppDashboardLayout } from "@/components/AppDashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";
import { 
  DollarSign, TrendingUp, Clock, CheckCircle2, 
  Calendar, Users, Download
} from "lucide-react";
import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: <Users className="h-4 w-4" /> },
  { label: "Commissions", href: "/commissions", icon: <DollarSign className="h-4 w-4" /> },
];

interface Commission {
  id: number;
  therapistName: string;
  customerName: string;
  type: 'treatment' | 'product_sale' | 'referral';
  amount: number;
  rate: number;
  baseAmount: number;
  status: 'pending' | 'approved' | 'paid';
  date: string;
}

const mockCommissions: Commission[] = [
  { id: 1, therapistName: "Sarah Johnson", customerName: "Emily Davis", type: "treatment", amount: 45.00, rate: 15, baseAmount: 300.00, status: "pending", date: "2026-01-15" },
  { id: 2, therapistName: "Sarah Johnson", customerName: "Michael Brown", type: "product_sale", amount: 12.50, rate: 10, baseAmount: 125.00, status: "approved", date: "2026-01-14" },
  { id: 3, therapistName: "John Smith", customerName: "Lisa Wilson", type: "treatment", amount: 60.00, rate: 15, baseAmount: 400.00, status: "paid", date: "2026-01-10" },
  { id: 4, therapistName: "John Smith", customerName: "Robert Taylor", type: "referral", amount: 25.00, rate: 5, baseAmount: 500.00, status: "pending", date: "2026-01-12" },
];

export default function Commissions() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const filteredCommissions = mockCommissions.filter((c) => {
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    if (typeFilter !== 'all' && c.type !== typeFilter) return false;
    return true;
  });

  const totalPending = mockCommissions.filter((c) => c.status === 'pending').reduce((sum, c) => sum + c.amount, 0);
  const totalApproved = mockCommissions.filter((c) => c.status === 'approved').reduce((sum, c) => sum + c.amount, 0);
  const totalPaid = mockCommissions.filter((c) => c.status === 'paid').reduce((sum, c) => sum + c.amount, 0);

  const getStatusBadge = (status: Commission['status']) => {
    switch (status) {
      case 'paid': return <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full">Paid</span>;
      case 'approved': return <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full">Approved</span>;
      default: return <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full">Pending</span>;
    }
  };

  const getTypeBadge = (type: Commission['type']) => {
    switch (type) {
      case 'treatment': return <span className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded-full">Treatment</span>;
      case 'product_sale': return <span className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded-full">Product Sale</span>;
      case 'referral': return <span className="text-xs px-2 py-1 bg-teal-100 text-teal-700 rounded-full">Referral</span>;
    }
  };

  return (
    <AppDashboardLayout title="Commissions" navItems={navItems} currentPath="/commissions">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Commission Tracking</h1>
            <p className="text-muted-foreground">Track and manage therapist commissions</p>
          </div>
          <Button onClick={() => toast.success("Commission report exported")}>
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>

        <div className="grid md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Pending</CardDescription>
              <CardTitle className="text-3xl text-yellow-600">${totalPending.toFixed(2)}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> Awaiting approval</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Approved</CardDescription>
              <CardTitle className="text-3xl text-blue-600">${totalApproved.toFixed(2)}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Ready for payment</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Paid (This Month)</CardDescription>
              <CardTitle className="text-3xl text-green-600">${totalPaid.toFixed(2)}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-green-600 flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Completed payouts</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Average Commission Rate</CardDescription>
              <CardTitle className="text-3xl">12.5%</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground flex items-center gap-1"><DollarSign className="h-3 w-3" /> Across all types</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Commission Records</CardTitle>
                <CardDescription>View and manage individual commission entries</CardDescription>
              </div>
              <div className="flex gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-32"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-36"><SelectValue placeholder="Type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="treatment">Treatment</SelectItem>
                    <SelectItem value="product_sale">Product Sale</SelectItem>
                    <SelectItem value="referral">Referral</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Therapist</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Base Amount</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">Commission</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCommissions.map((commission) => (
                  <TableRow key={commission.id}>
                    <TableCell>{commission.date}</TableCell>
                    <TableCell className="font-medium">{commission.therapistName}</TableCell>
                    <TableCell>{commission.customerName}</TableCell>
                    <TableCell>{getTypeBadge(commission.type)}</TableCell>
                    <TableCell className="text-right">${commission.baseAmount.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{commission.rate}%</TableCell>
                    <TableCell className="text-right font-semibold">${commission.amount.toFixed(2)}</TableCell>
                    <TableCell>{getStatusBadge(commission.status)}</TableCell>
                    <TableCell>
                      {commission.status === 'pending' && (
                        <Button size="sm" variant="outline" onClick={() => toast.success("Commission approved")}>Approve</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Commission Rate Structure</CardTitle>
            <CardDescription>Current commission rates by type</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">Treatments</span>
                  <span className="text-2xl font-bold text-purple-600">15%</span>
                </div>
                <p className="text-sm text-muted-foreground">Commission on all treatment services provided</p>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">Product Sales</span>
                  <span className="text-2xl font-bold text-amber-600">10%</span>
                </div>
                <p className="text-sm text-muted-foreground">Commission on product recommendations and sales</p>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">Referrals</span>
                  <span className="text-2xl font-bold text-teal-600">5%</span>
                </div>
                <p className="text-sm text-muted-foreground">Commission on new customer referrals (first purchase)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppDashboardLayout>
  );
}
