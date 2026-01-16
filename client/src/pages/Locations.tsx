import { AppDashboardLayout } from "@/components/AppDashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/_core/hooks/useAuth";
import { 
  MapPin, Plus, Building2, Phone, Mail, 
  Globe, Edit, Trash2, Users, Calendar
} from "lucide-react";
import { useLocation } from "wouter";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: <Building2 className="h-4 w-4" /> },
  { label: "Locations", href: "/locations", icon: <MapPin className="h-4 w-4" /> },
  { label: "Therapists", href: "/therapists", icon: <Users className="h-4 w-4" /> },
  { label: "Bookings", href: "/bookings", icon: <Calendar className="h-4 w-4" /> },
];

interface LocationFormData {
  name: string;
  address: string;
  city: string;
  country: string;
  postalCode: string;
  phone: string;
  email: string;
  posType: 'shopify' | 'opencart' | 'none';
}

export default function Locations() {
  const { user } = useAuth();
  const [, setLocationPath] = useLocation();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [formData, setFormData] = useState<LocationFormData>({
    name: '',
    address: '',
    city: '',
    country: '',
    postalCode: '',
    phone: '',
    email: '',
    posType: 'none',
  });

  // Mock locations data - in production this would come from trpc
  const locations = [
    {
      id: 1,
      name: "Downtown Spa",
      address: "123 Main Street",
      city: "Cape Town",
      country: "South Africa",
      phone: "+27 21 123 4567",
      email: "downtown@skintwin.com",
      posType: "shopify",
      therapistCount: 5,
      latitude: -33.9249,
      longitude: 18.4241,
    },
    {
      id: 2,
      name: "Waterfront Branch",
      address: "456 Beach Road",
      city: "Cape Town",
      country: "South Africa",
      phone: "+27 21 987 6543",
      email: "waterfront@skintwin.com",
      posType: "opencart",
      therapistCount: 3,
      latitude: -33.9033,
      longitude: 18.4197,
    },
  ];

  const handleInputChange = (field: keyof LocationFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAddLocation = () => {
    toast.success("Location added successfully");
    setIsAddDialogOpen(false);
    setFormData({
      name: '',
      address: '',
      city: '',
      country: '',
      postalCode: '',
      phone: '',
      email: '',
      posType: 'none',
    });
  };

  return (
    <AppDashboardLayout
      title="Locations"
      navItems={navItems}
      currentPath="/locations"
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Salon Locations</h1>
            <p className="text-muted-foreground">Manage your B2B salon locations and service areas</p>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Location
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Add New Location</DialogTitle>
                <DialogDescription>
                  Add a new salon location to your network
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Location Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="e.g., Downtown Spa"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="address">Street Address</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => handleInputChange('address', e.target.value)}
                    placeholder="123 Main Street"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={formData.city}
                      onChange={(e) => handleInputChange('city', e.target.value)}
                      placeholder="Cape Town"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="country">Country</Label>
                    <Input
                      id="country"
                      value={formData.country}
                      onChange={(e) => handleInputChange('country', e.target.value)}
                      placeholder="South Africa"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                      placeholder="+27 21 123 4567"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      placeholder="location@example.com"
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="posType">POS System</Label>
                  <Select
                    value={formData.posType}
                    onValueChange={(value) => handleInputChange('posType', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select POS type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No POS</SelectItem>
                      <SelectItem value="shopify">Shopify POS</SelectItem>
                      <SelectItem value="opencart">OpenCart</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddLocation}>Add Location</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Map Section */}
        <Card>
          <CardHeader>
            <CardTitle>Location Map</CardTitle>
            <CardDescription>Interactive map showing all your salon locations and service areas</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80 bg-gradient-to-br from-blue-50 to-green-50 rounded-lg relative overflow-hidden">
              {/* Placeholder map visualization */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <Globe className="h-16 w-16 mx-auto mb-4 text-blue-400 opacity-50" />
                  <p className="text-muted-foreground mb-2">Interactive Map</p>
                  <p className="text-sm text-muted-foreground">
                    {locations.length} locations configured
                  </p>
                </div>
              </div>
              {/* Location markers */}
              {locations.map((loc, index) => (
                <div
                  key={loc.id}
                  className="absolute"
                  style={{
                    left: `${30 + index * 20}%`,
                    top: `${40 + index * 10}%`,
                  }}
                >
                  <div className="relative group">
                    <div className="w-8 h-8 bg-rose-500 rounded-full flex items-center justify-center shadow-lg cursor-pointer hover:scale-110 transition-transform">
                      <MapPin className="h-5 w-5 text-white" />
                    </div>
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-white rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                      <p className="font-medium text-sm">{loc.name}</p>
                      <p className="text-xs text-muted-foreground">{loc.city}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Location Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {locations.map((location) => (
            <Card key={location.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{location.name}</CardTitle>
                    <CardDescription>{location.city}, {location.country}</CardDescription>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  <span>{location.address}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="h-4 w-4" />
                  <span>{location.phone}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  <span>{location.email}</span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{location.therapistCount} therapists</span>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    location.posType === 'shopify' 
                      ? 'bg-green-100 text-green-700' 
                      : location.posType === 'opencart'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}>
                    {location.posType === 'none' ? 'No POS' : location.posType.charAt(0).toUpperCase() + location.posType.slice(1)}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Add Location Card */}
          <Card 
            className="border-dashed cursor-pointer hover:border-primary hover:bg-muted/50 transition-colors"
            onClick={() => setIsAddDialogOpen(true)}
          >
            <CardContent className="flex flex-col items-center justify-center h-full min-h-[200px]">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                <Plus className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="font-medium">Add New Location</p>
              <p className="text-sm text-muted-foreground">Expand your salon network</p>
            </CardContent>
          </Card>
        </div>

        {/* Customer Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Customer Distribution</CardTitle>
            <CardDescription>Customer count by location</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {locations.map((location) => (
                <div key={location.id} className="flex items-center gap-4">
                  <div className="w-32 font-medium truncate">{location.name}</div>
                  <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-rose-500 rounded-full"
                      style={{ width: `${Math.random() * 80 + 20}%` }}
                    />
                  </div>
                  <div className="w-16 text-right text-sm text-muted-foreground">
                    {Math.floor(Math.random() * 200 + 50)} customers
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppDashboardLayout>
  );
}
