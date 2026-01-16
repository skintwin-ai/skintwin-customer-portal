import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getLoginUrl } from "@/const";
import { 
  Sparkles, 
  Users, 
  Calendar, 
  ShoppingBag, 
  BarChart3, 
  Building2,
  ArrowRight,
  CheckCircle2
} from "lucide-react";
import { useLocation } from "wouter";

export default function Home() {
  const { user, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  const features = [
    {
      icon: Users,
      title: "Customer Management",
      description: "Assign therapists to customers, track consultations, and manage ongoing care relationships."
    },
    {
      icon: Calendar,
      title: "Booking Integration",
      description: "Seamless Wix Bookings integration for B2B salon appointments and scheduling."
    },
    {
      icon: ShoppingBag,
      title: "E-Commerce & POS",
      description: "Unified Shopify and OpenCart integration for online and in-store sales."
    },
    {
      icon: BarChart3,
      title: "Commission Tracking",
      description: "Automated commission calculations for therapists based on treatments and product sales."
    },
    {
      icon: Building2,
      title: "Multi-Location Support",
      description: "Manage multiple salon locations with interactive maps and service area visualization."
    },
    {
      icon: Sparkles,
      title: "Accounting Integration",
      description: "Sync with QuickBooks, Xero, and GnuCash for seamless financial management."
    }
  ];

  const userRoles = [
    { role: "Retail Customers", description: "Book appointments, track orders, and manage your beauty journey" },
    { role: "Therapists", description: "Manage clients, track commissions, and provide consultations" },
    { role: "Salon Owners", description: "Oversee operations, manage staff, and analyze business performance" },
    { role: "Administrators", description: "Full system access with integration management and reporting" }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-amber-50">
      {/* Navigation */}
      <nav className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-rose-500" />
            <span className="font-semibold text-xl">SkinTwin</span>
          </div>
          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <>
                <span className="text-sm text-muted-foreground">Welcome, {user?.name}</span>
                <Button onClick={() => setLocation('/dashboard')}>
                  Go to Dashboard
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </>
            ) : (
              <Button asChild>
                <a href={getLoginUrl()}>Sign In</a>
              </Button>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="py-20 px-4">
        <div className="container text-center max-w-4xl">
          <h1 className="text-5xl font-bold tracking-tight mb-6 bg-gradient-to-r from-rose-600 to-amber-600 bg-clip-text text-transparent">
            Beauty Business Management Platform
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Unify your beauty business operations with integrated e-commerce, bookings, payments, 
            and therapist management in one powerful platform.
          </p>
          <div className="flex gap-4 justify-center">
            {isAuthenticated ? (
              <Button size="lg" onClick={() => setLocation('/dashboard')}>
                Open Dashboard
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            ) : (
              <>
                <Button size="lg" asChild>
                  <a href={getLoginUrl()}>Get Started</a>
                </Button>
                <Button size="lg" variant="outline">
                  Learn More
                </Button>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-16 px-4 bg-white/50">
        <div className="container">
          <h2 className="text-3xl font-bold text-center mb-12">Everything You Need</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <Card key={index} className="border-none shadow-lg hover:shadow-xl transition-shadow">
                <CardHeader>
                  <div className="w-12 h-12 rounded-lg bg-rose-100 flex items-center justify-center mb-4">
                    <feature.icon className="h-6 w-6 text-rose-600" />
                  </div>
                  <CardTitle>{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base">{feature.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* User Roles Section */}
      <section className="py-16 px-4">
        <div className="container max-w-4xl">
          <h2 className="text-3xl font-bold text-center mb-12">Built for Everyone</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {userRoles.map((item, index) => (
              <div key={index} className="flex gap-4 p-6 rounded-xl bg-white shadow-md">
                <CheckCircle2 className="h-6 w-6 text-green-500 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold text-lg mb-1">{item.role}</h3>
                  <p className="text-muted-foreground">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Integrations Section */}
      <section className="py-16 px-4 bg-gradient-to-r from-rose-100 to-amber-100">
        <div className="container text-center">
          <h2 className="text-3xl font-bold mb-4">Powerful Integrations</h2>
          <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
            Connect with the tools you already use. Shopify, Stripe, PayStack, Wix, QuickBooks, Xero, and ERPNext.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            {['Shopify', 'Stripe', 'PayStack', 'Wix', 'QuickBooks', 'Xero', 'ERPNext', 'WorkOS'].map((integration) => (
              <div key={integration} className="px-6 py-3 bg-white rounded-full shadow-sm font-medium">
                {integration}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t bg-white">
        <div className="container flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-rose-500" />
            <span className="font-semibold">SkinTwin Customer Portal</span>
          </div>
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} SkinTwin. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
