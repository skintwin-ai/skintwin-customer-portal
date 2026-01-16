import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import { useAuth } from "@/_core/hooks/useAuth";

// Lazy load dashboard pages
import CustomerDashboard from "./pages/dashboards/CustomerDashboard";
import TherapistDashboard from "./pages/dashboards/TherapistDashboard";
import SalonDashboard from "./pages/dashboards/SalonDashboard";
import AdminDashboard from "./pages/dashboards/AdminDashboard";

// Feature pages
import Bookings from "./pages/Bookings";
import Orders from "./pages/Orders";
import Products from "./pages/Products";
import Customers from "./pages/Customers";
import Therapists from "./pages/Therapists";
import Consultations from "./pages/Consultations";
import Treatments from "./pages/Treatments";
import Commissions from "./pages/Commissions";
import Integrations from "./pages/Integrations";
import Procurement from "./pages/Procurement";
import Reports from "./pages/Reports";
import Locations from "./pages/Locations";
import Settings from "./pages/Settings";

function Router() {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }
  
  return (
    <Switch>
      {/* Public routes */}
      <Route path="/" component={Home} />
      
      {/* Dashboard routes based on role */}
      <Route path="/dashboard">
        {user?.role === 'admin' && <AdminDashboard />}
        {user?.role === 'salon_owner' && <SalonDashboard />}
        {user?.role === 'therapist' && <TherapistDashboard />}
        {user?.role === 'retail_customer' && <CustomerDashboard />}
        {!user && <Home />}
      </Route>
      
      {/* Feature routes */}
      <Route path="/bookings" component={Bookings} />
      <Route path="/orders" component={Orders} />
      <Route path="/products" component={Products} />
      <Route path="/customers" component={Customers} />
      <Route path="/therapists" component={Therapists} />
      <Route path="/consultations" component={Consultations} />
      <Route path="/treatments" component={Treatments} />
      <Route path="/commissions" component={Commissions} />
      <Route path="/integrations" component={Integrations} />
      <Route path="/procurement" component={Procurement} />
      <Route path="/reports" component={Reports} />
      <Route path="/locations" component={Locations} />
      <Route path="/settings" component={Settings} />
      
      {/* 404 */}
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
