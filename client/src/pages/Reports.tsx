import { AppDashboardLayout } from "@/components/AppDashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";
import { BarChart3, Download, FileText, Calendar, DollarSign, Users, TrendingUp, Clock } from "lucide-react";
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: <BarChart3 className="h-4 w-4" /> },
  { label: "Reports", href: "/reports", icon: <FileText className="h-4 w-4" /> },
];

const reportTypes = [
  { id: 'commission', name: 'Commission Report', description: 'Monthly therapist commission summary', icon: <DollarSign className="h-6 w-6" />, color: 'text-green-600 bg-green-100' },
  { id: 'sales', name: 'Sales Summary', description: 'Product and service sales analytics', icon: <TrendingUp className="h-6 w-6" />, color: 'text-blue-600 bg-blue-100' },
  { id: 'procurement', name: 'Procurement Analytics', description: 'Supplier orders and inventory', icon: <BarChart3 className="h-6 w-6" />, color: 'text-purple-600 bg-purple-100' },
  { id: 'customer', name: 'Customer Report', description: 'Customer activity and retention', icon: <Users className="h-6 w-6" />, color: 'text-amber-600 bg-amber-100' },
];

const recentReports = [
  { id: 1, name: 'Commission Report - January 2026', type: 'commission', date: '2026-01-15', size: '245 KB', status: 'ready' },
  { id: 2, name: 'Sales Summary - Q4 2025', type: 'sales', date: '2026-01-01', size: '1.2 MB', status: 'ready' },
  { id: 3, name: 'Procurement Analytics - December 2025', type: 'procurement', date: '2025-12-31', size: '890 KB', status: 'ready' },
];

export default function Reports() {
  const [selectedPeriod, setSelectedPeriod] = useState('month');
  const [generatingReport, setGeneratingReport] = useState<string | null>(null);

  const handleGenerateReport = async (reportId: string) => {
    setGeneratingReport(reportId);
    await new Promise(resolve => setTimeout(resolve, 2000));
    setGeneratingReport(null);
    toast.success("Report generated and saved to cloud storage");
  };

  const handleDownload = (reportId: number) => {
    toast.success("Report download started");
  };

  return (
    <AppDashboardLayout title="Reports" navItems={navItems} currentPath="/reports">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Reports & Analytics</h1>
            <p className="text-muted-foreground">Generate and download business reports</p>
          </div>
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="quarter">This Quarter</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {reportTypes.map((report) => (
            <Card key={report.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-2">
                <div className={`w-12 h-12 rounded-lg ${report.color} flex items-center justify-center mb-2`}>
                  {report.icon}
                </div>
                <CardTitle className="text-lg">{report.name}</CardTitle>
                <CardDescription>{report.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  className="w-full" 
                  onClick={() => handleGenerateReport(report.id)}
                  disabled={generatingReport === report.id}
                >
                  {generatingReport === report.id ? (
                    <><Clock className="h-4 w-4 mr-2 animate-spin" />Generating...</>
                  ) : (
                    <><FileText className="h-4 w-4 mr-2" />Generate Report</>
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recent Reports</CardTitle>
            <CardDescription>Previously generated reports available for download</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentReports.map((report) => (
                <div key={report.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">{report.name}</p>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{report.date}</span>
                        <span>{report.size}</span>
                      </div>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => handleDownload(report.id)}>
                    <Download className="h-4 w-4 mr-2" />Download PDF
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Quick Stats</CardTitle>
              <CardDescription>Key metrics for {selectedPeriod === 'month' ? 'this month' : selectedPeriod === 'week' ? 'this week' : selectedPeriod === 'quarter' ? 'this quarter' : 'this year'}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <span>Total Revenue</span>
                  <span className="font-bold text-green-600">$24,580</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <span>Commissions Paid</span>
                  <span className="font-bold text-blue-600">$3,687</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <span>New Customers</span>
                  <span className="font-bold text-purple-600">47</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <span>Bookings Completed</span>
                  <span className="font-bold text-amber-600">189</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Scheduled Reports</CardTitle>
              <CardDescription>Automated report generation</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">Monthly Commission Report</p>
                    <p className="text-sm text-muted-foreground">1st of every month</p>
                  </div>
                  <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full">Active</span>
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">Weekly Sales Summary</p>
                    <p className="text-sm text-muted-foreground">Every Monday</p>
                  </div>
                  <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full">Active</span>
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">Quarterly Analytics</p>
                    <p className="text-sm text-muted-foreground">End of quarter</p>
                  </div>
                  <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded-full">Paused</span>
                </div>
              </div>
              <Button variant="outline" className="w-full mt-4">Configure Schedules</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppDashboardLayout>
  );
}
