import { describe, expect, it, vi } from "vitest";

// Test commission calculation logic - core business logic
describe("Commission Calculation", () => {
  it("should calculate treatment commission correctly at 15%", () => {
    const baseAmount = 300;
    const commissionRate = 0.15;
    const expectedCommission = 45;

    const commission = baseAmount * commissionRate;
    expect(commission).toBe(expectedCommission);
  });

  it("should calculate product sale commission correctly at 10%", () => {
    const baseAmount = 125;
    const commissionRate = 0.10;
    const expectedCommission = 12.5;

    const commission = baseAmount * commissionRate;
    expect(commission).toBe(expectedCommission);
  });

  it("should calculate referral commission correctly at 5%", () => {
    const baseAmount = 500;
    const commissionRate = 0.05;
    const expectedCommission = 25;

    const commission = baseAmount * commissionRate;
    expect(commission).toBe(expectedCommission);
  });

  it("should handle zero base amount", () => {
    const baseAmount = 0;
    const commissionRate = 0.15;
    const expectedCommission = 0;

    const commission = baseAmount * commissionRate;
    expect(commission).toBe(expectedCommission);
  });

  it("should handle large amounts correctly", () => {
    const baseAmount = 10000;
    const commissionRate = 0.15;
    const expectedCommission = 1500;

    const commission = baseAmount * commissionRate;
    expect(commission).toBe(expectedCommission);
  });
});

// Test role-based access control logic
describe("Role-Based Access Control", () => {
  const validRoles = ["admin", "salon_owner", "therapist", "retail_customer"] as const;
  type UserRole = typeof validRoles[number];

  const hasPermission = (role: UserRole, requiredRole: UserRole | UserRole[]): boolean => {
    const roleHierarchy: Record<UserRole, number> = {
      admin: 4,
      salon_owner: 3,
      therapist: 2,
      retail_customer: 1,
    };

    if (Array.isArray(requiredRole)) {
      return requiredRole.includes(role);
    }
    return roleHierarchy[role] >= roleHierarchy[requiredRole];
  };

  it("should grant admin access to all resources", () => {
    expect(hasPermission("admin", "admin")).toBe(true);
    expect(hasPermission("admin", "salon_owner")).toBe(true);
    expect(hasPermission("admin", "therapist")).toBe(true);
    expect(hasPermission("admin", "retail_customer")).toBe(true);
  });

  it("should restrict retail_customer to their own resources", () => {
    expect(hasPermission("retail_customer", "admin")).toBe(false);
    expect(hasPermission("retail_customer", "salon_owner")).toBe(false);
    expect(hasPermission("retail_customer", "therapist")).toBe(false);
    expect(hasPermission("retail_customer", "retail_customer")).toBe(true);
  });

  it("should allow therapist access to customer resources", () => {
    expect(hasPermission("therapist", "retail_customer")).toBe(true);
    expect(hasPermission("therapist", "therapist")).toBe(true);
    expect(hasPermission("therapist", "salon_owner")).toBe(false);
  });

  it("should allow salon_owner access to therapist and customer resources", () => {
    expect(hasPermission("salon_owner", "retail_customer")).toBe(true);
    expect(hasPermission("salon_owner", "therapist")).toBe(true);
    expect(hasPermission("salon_owner", "salon_owner")).toBe(true);
    expect(hasPermission("salon_owner", "admin")).toBe(false);
  });
});

// Test payment processor selection logic
describe("Payment Processor Selection", () => {
  const selectPaymentProcessor = (currency: string, country: string): 'stripe' | 'paystack' => {
    const paystackCountries = ['NG', 'GH', 'ZA', 'KE'];
    const paystackCurrencies = ['NGN', 'GHS', 'ZAR', 'KES'];

    if (paystackCountries.includes(country) || paystackCurrencies.includes(currency)) {
      return 'paystack';
    }
    return 'stripe';
  };

  it("should select PayStack for Nigerian transactions", () => {
    expect(selectPaymentProcessor("NGN", "NG")).toBe("paystack");
  });

  it("should select PayStack for South African transactions", () => {
    expect(selectPaymentProcessor("ZAR", "ZA")).toBe("paystack");
  });

  it("should select PayStack for Ghanaian transactions", () => {
    expect(selectPaymentProcessor("GHS", "GH")).toBe("paystack");
  });

  it("should select PayStack for Kenyan transactions", () => {
    expect(selectPaymentProcessor("KES", "KE")).toBe("paystack");
  });

  it("should select Stripe for USD transactions", () => {
    expect(selectPaymentProcessor("USD", "US")).toBe("stripe");
  });

  it("should select Stripe for EUR transactions", () => {
    expect(selectPaymentProcessor("EUR", "DE")).toBe("stripe");
  });

  it("should select Stripe for GBP transactions", () => {
    expect(selectPaymentProcessor("GBP", "GB")).toBe("stripe");
  });
});

// Test booking slot validation logic
describe("Booking Slot Validation", () => {
  const isSlotAvailable = (
    requestedStart: Date,
    requestedEnd: Date,
    existingBookings: { start: Date; end: Date }[]
  ): boolean => {
    for (const booking of existingBookings) {
      // Check for overlap
      if (requestedStart < booking.end && requestedEnd > booking.start) {
        return false;
      }
    }
    return true;
  };

  it("should allow booking when no conflicts exist", () => {
    const requestedStart = new Date("2026-01-16T10:00:00");
    const requestedEnd = new Date("2026-01-16T11:00:00");
    const existingBookings = [
      { start: new Date("2026-01-16T08:00:00"), end: new Date("2026-01-16T09:00:00") },
      { start: new Date("2026-01-16T12:00:00"), end: new Date("2026-01-16T13:00:00") },
    ];

    expect(isSlotAvailable(requestedStart, requestedEnd, existingBookings)).toBe(true);
  });

  it("should reject booking when overlapping with existing", () => {
    const requestedStart = new Date("2026-01-16T08:30:00");
    const requestedEnd = new Date("2026-01-16T09:30:00");
    const existingBookings = [
      { start: new Date("2026-01-16T08:00:00"), end: new Date("2026-01-16T09:00:00") },
    ];

    expect(isSlotAvailable(requestedStart, requestedEnd, existingBookings)).toBe(false);
  });

  it("should reject booking that completely contains existing booking", () => {
    const requestedStart = new Date("2026-01-16T07:00:00");
    const requestedEnd = new Date("2026-01-16T10:00:00");
    const existingBookings = [
      { start: new Date("2026-01-16T08:00:00"), end: new Date("2026-01-16T09:00:00") },
    ];

    expect(isSlotAvailable(requestedStart, requestedEnd, existingBookings)).toBe(false);
  });

  it("should allow booking immediately after existing booking", () => {
    const requestedStart = new Date("2026-01-16T09:00:00");
    const requestedEnd = new Date("2026-01-16T10:00:00");
    const existingBookings = [
      { start: new Date("2026-01-16T08:00:00"), end: new Date("2026-01-16T09:00:00") },
    ];

    expect(isSlotAvailable(requestedStart, requestedEnd, existingBookings)).toBe(true);
  });
});

// Test therapist-customer assignment logic
describe("Therapist-Customer Assignment", () => {
  interface Therapist {
    id: number;
    name: string;
    specializations: string[];
    currentCustomerCount: number;
    maxCustomers: number;
  }

  const findBestTherapist = (
    therapists: Therapist[],
    requiredSpecialization: string
  ): Therapist | null => {
    const eligible = therapists.filter(
      (t) =>
        t.specializations.includes(requiredSpecialization) &&
        t.currentCustomerCount < t.maxCustomers
    );

    if (eligible.length === 0) return null;

    // Return therapist with lowest current customer count (load balancing)
    return eligible.reduce((best, current) =>
      current.currentCustomerCount < best.currentCustomerCount ? current : best
    );
  };

  it("should assign customer to therapist with matching specialization", () => {
    const therapists: Therapist[] = [
      { id: 1, name: "Sarah", specializations: ["acne", "anti-aging"], currentCustomerCount: 10, maxCustomers: 20 },
      { id: 2, name: "John", specializations: ["massage", "body"], currentCustomerCount: 15, maxCustomers: 20 },
    ];

    const result = findBestTherapist(therapists, "acne");
    expect(result?.id).toBe(1);
  });

  it("should return null when no therapist has required specialization", () => {
    const therapists: Therapist[] = [
      { id: 1, name: "Sarah", specializations: ["acne"], currentCustomerCount: 10, maxCustomers: 20 },
    ];

    const result = findBestTherapist(therapists, "massage");
    expect(result).toBeNull();
  });

  it("should prefer therapist with lower customer count for load balancing", () => {
    const therapists: Therapist[] = [
      { id: 1, name: "Sarah", specializations: ["acne"], currentCustomerCount: 15, maxCustomers: 20 },
      { id: 2, name: "Emily", specializations: ["acne"], currentCustomerCount: 8, maxCustomers: 20 },
    ];

    const result = findBestTherapist(therapists, "acne");
    expect(result?.id).toBe(2);
  });

  it("should not assign to therapist at max capacity", () => {
    const therapists: Therapist[] = [
      { id: 1, name: "Sarah", specializations: ["acne"], currentCustomerCount: 20, maxCustomers: 20 },
      { id: 2, name: "Emily", specializations: ["acne"], currentCustomerCount: 10, maxCustomers: 20 },
    ];

    const result = findBestTherapist(therapists, "acne");
    expect(result?.id).toBe(2);
  });
});

// Test multi-location service area calculation
describe("Multi-Location Service Area", () => {
  const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number => {
    // Haversine formula for distance calculation
    const R = 6371; // Earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const isWithinServiceArea = (
    customerLat: number,
    customerLon: number,
    locationLat: number,
    locationLon: number,
    serviceRadiusKm: number
  ): boolean => {
    const distance = calculateDistance(customerLat, customerLon, locationLat, locationLon);
    return distance <= serviceRadiusKm;
  };

  it("should identify customer within service area", () => {
    // Cape Town city center
    const locationLat = -33.9249;
    const locationLon = 18.4241;
    // Customer 5km away
    const customerLat = -33.9;
    const customerLon = 18.45;
    const serviceRadius = 10; // 10km

    expect(isWithinServiceArea(customerLat, customerLon, locationLat, locationLon, serviceRadius)).toBe(true);
  });

  it("should identify customer outside service area", () => {
    // Cape Town city center
    const locationLat = -33.9249;
    const locationLon = 18.4241;
    // Customer 50km away (Stellenbosch area)
    const customerLat = -33.9321;
    const customerLon = 18.8602;
    const serviceRadius = 10; // 10km

    expect(isWithinServiceArea(customerLat, customerLon, locationLat, locationLon, serviceRadius)).toBe(false);
  });
});

// Test report date range calculation
describe("Report Date Range Calculation", () => {
  const getDateRange = (period: 'week' | 'month' | 'quarter' | 'year'): { start: Date; end: Date } => {
    const now = new Date();
    const end = new Date(now);
    let start = new Date(now);

    switch (period) {
      case 'week':
        start.setDate(now.getDate() - 7);
        break;
      case 'month':
        start.setMonth(now.getMonth() - 1);
        break;
      case 'quarter':
        start.setMonth(now.getMonth() - 3);
        break;
      case 'year':
        start.setFullYear(now.getFullYear() - 1);
        break;
    }

    return { start, end };
  };

  it("should calculate week range correctly", () => {
    const { start, end } = getDateRange('week');
    const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    expect(diffDays).toBe(7);
  });

  it("should calculate month range correctly", () => {
    const { start, end } = getDateRange('month');
    const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    expect(diffDays).toBeGreaterThanOrEqual(28);
    expect(diffDays).toBeLessThanOrEqual(31);
  });

  it("should calculate quarter range correctly", () => {
    const { start, end } = getDateRange('quarter');
    const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    expect(diffDays).toBeGreaterThanOrEqual(89);
    expect(diffDays).toBeLessThanOrEqual(92);
  });
});
