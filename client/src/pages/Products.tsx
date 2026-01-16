import { AppDashboardLayout } from "@/components/AppDashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";
import { LayoutDashboard, Plus } from "lucide-react";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
];

export default function Products() {
  return (
    <AppDashboardLayout
      title="Products"
      navItems={navItems}
      currentPath="/products"
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Products</h1>
            <p className="text-muted-foreground">Manage products</p>
          </div>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add New
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Products</CardTitle>
            <CardDescription>View and manage products</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12 text-muted-foreground">
              <LayoutDashboard className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg mb-2">No data yet</p>
              <p className="text-sm">Get started by adding your first item</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppDashboardLayout>
  );
}
