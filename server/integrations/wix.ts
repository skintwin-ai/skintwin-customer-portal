import axios, { AxiosInstance } from 'axios';

interface WixConfig {
  siteId: string;
  accessToken: string;
}

interface WixService {
  id: string;
  name: string;
  description: string;
  type: 'APPOINTMENT' | 'CLASS' | 'COURSE';
  category: { id: string; name: string };
  payment: { rateType: string; price: { value: string; currency: string } };
  schedule: any;
}

interface WixBooking {
  id: string;
  bookedEntity: {
    serviceId: string;
    scheduleId: string;
    slot: {
      startDate: string;
      endDate: string;
      resource: { id: string; name: string };
    };
  };
  contactDetails: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
  status: 'PENDING' | 'CONFIRMED' | 'CANCELED' | 'PENDING_CHECKOUT' | 'DECLINED';
  paymentStatus: 'NOT_PAID' | 'PAID' | 'PARTIALLY_PAID' | 'REFUNDED';
  createdDate: string;
  updatedDate: string;
}

interface WixStaffMember {
  id: string;
  name: string;
  email: string;
  phone: string;
  scheduleIds: string[];
}

interface WixTimeSlot {
  startDate: string;
  endDate: string;
  serviceId: string;
  resource: { id: string; name: string };
  bookable: boolean;
  openSpots: number;
}

export class WixBookingsService {
  private client: AxiosInstance;
  private siteId: string;

  constructor(config: WixConfig) {
    this.siteId = config.siteId;
    this.client = axios.create({
      baseURL: 'https://www.wixapis.com',
      headers: {
        Authorization: config.accessToken,
        'wix-site-id': config.siteId,
        'Content-Type': 'application/json',
      },
    });
  }

  // ============================================================================
  // SERVICES
  // ============================================================================

  async listServices(params: { limit?: number; offset?: number } = {}): Promise<WixService[]> {
    const response = await this.client.post('/bookings/v1/services/query', {
      query: {
        paging: { limit: params.limit || 100, offset: params.offset || 0 },
      },
    });
    return response.data.services;
  }

  async getService(serviceId: string): Promise<WixService> {
    const response = await this.client.get(`/bookings/v1/services/${serviceId}`);
    return response.data.service;
  }

  async createService(service: Partial<WixService>): Promise<WixService> {
    const response = await this.client.post('/bookings/v1/services', { service });
    return response.data.service;
  }

  async updateService(serviceId: string, service: Partial<WixService>): Promise<WixService> {
    const response = await this.client.patch(`/bookings/v1/services/${serviceId}`, { service });
    return response.data.service;
  }

  async deleteService(serviceId: string): Promise<void> {
    await this.client.delete(`/bookings/v1/services/${serviceId}`);
  }

  // ============================================================================
  // BOOKINGS
  // ============================================================================

  async listBookings(params: {
    limit?: number;
    offset?: number;
    status?: string[];
    startDate?: string;
    endDate?: string;
  } = {}): Promise<WixBooking[]> {
    const filter: any = {};
    
    if (params.status) {
      filter.status = { $in: params.status };
    }
    if (params.startDate && params.endDate) {
      filter['bookedEntity.slot.startDate'] = {
        $gte: params.startDate,
        $lte: params.endDate,
      };
    }

    const response = await this.client.post('/bookings/v2/bookings/query', {
      query: {
        filter,
        paging: { limit: params.limit || 100, offset: params.offset || 0 },
        sort: [{ fieldName: 'bookedEntity.slot.startDate', order: 'DESC' }],
      },
    });
    return response.data.bookings;
  }

  async getBooking(bookingId: string): Promise<WixBooking> {
    const response = await this.client.get(`/bookings/v2/bookings/${bookingId}`);
    return response.data.booking;
  }

  async createBooking(booking: {
    serviceId: string;
    slot: { startDate: string; endDate: string; resourceId?: string };
    contactDetails: { firstName: string; lastName: string; email: string; phone?: string };
    participantNotification?: { notifyParticipants: boolean };
  }): Promise<WixBooking> {
    const response = await this.client.post('/bookings/v2/bookings', {
      booking: {
        bookedEntity: {
          serviceId: booking.serviceId,
          slot: booking.slot,
        },
        contactDetails: booking.contactDetails,
      },
      participantNotification: booking.participantNotification,
    });
    return response.data.booking;
  }

  async confirmBooking(bookingId: string): Promise<WixBooking> {
    const response = await this.client.post(`/bookings/v2/bookings/${bookingId}/confirm`);
    return response.data.booking;
  }

  async cancelBooking(bookingId: string, params?: {
    participantNotification?: { notifyParticipants: boolean };
    flowControlSettings?: { ignoreCancellationPolicy: boolean };
  }): Promise<WixBooking> {
    const response = await this.client.post(`/bookings/v2/bookings/${bookingId}/cancel`, params);
    return response.data.booking;
  }

  async declineBooking(bookingId: string): Promise<WixBooking> {
    const response = await this.client.post(`/bookings/v2/bookings/${bookingId}/decline`);
    return response.data.booking;
  }

  async rescheduleBooking(bookingId: string, newSlot: {
    startDate: string;
    endDate: string;
    resourceId?: string;
  }): Promise<WixBooking> {
    const response = await this.client.post(`/bookings/v2/bookings/${bookingId}/reschedule`, {
      slot: newSlot,
    });
    return response.data.booking;
  }

  // ============================================================================
  // AVAILABILITY
  // ============================================================================

  async getAvailability(params: {
    serviceId: string;
    startDate: string;
    endDate: string;
    resourceId?: string;
    timezone?: string;
  }): Promise<WixTimeSlot[]> {
    const response = await this.client.post('/bookings/v1/availability/query', {
      query: {
        filter: {
          serviceId: params.serviceId,
          startDate: params.startDate,
          endDate: params.endDate,
          ...(params.resourceId && { resourceId: params.resourceId }),
        },
        ...(params.timezone && { timezone: params.timezone }),
      },
    });
    return response.data.availability?.slots || [];
  }

  async checkSlotAvailability(params: {
    serviceId: string;
    slot: { startDate: string; endDate: string };
    resourceId?: string;
  }): Promise<{ available: boolean; openSpots: number }> {
    const response = await this.client.post('/bookings/v1/availability/check', {
      serviceId: params.serviceId,
      slot: params.slot,
      ...(params.resourceId && { resourceId: params.resourceId }),
    });
    return response.data;
  }

  // ============================================================================
  // STAFF MEMBERS (Resources)
  // ============================================================================

  async listStaffMembers(params: { limit?: number; offset?: number } = {}): Promise<WixStaffMember[]> {
    const response = await this.client.post('/bookings/v1/resources/query', {
      query: {
        paging: { limit: params.limit || 100, offset: params.offset || 0 },
      },
    });
    return response.data.resources;
  }

  async getStaffMember(staffId: string): Promise<WixStaffMember> {
    const response = await this.client.get(`/bookings/v1/resources/${staffId}`);
    return response.data.resource;
  }

  async createStaffMember(staff: {
    name: string;
    email?: string;
    phone?: string;
    scheduleIds?: string[];
  }): Promise<WixStaffMember> {
    const response = await this.client.post('/bookings/v1/resources', { resource: staff });
    return response.data.resource;
  }

  async updateStaffMember(staffId: string, staff: Partial<WixStaffMember>): Promise<WixStaffMember> {
    const response = await this.client.patch(`/bookings/v1/resources/${staffId}`, { resource: staff });
    return response.data.resource;
  }

  async deleteStaffMember(staffId: string): Promise<void> {
    await this.client.delete(`/bookings/v1/resources/${staffId}`);
  }

  // ============================================================================
  // SCHEDULES
  // ============================================================================

  async listSchedules(params: { limit?: number; offset?: number } = {}): Promise<any[]> {
    const response = await this.client.post('/bookings/v1/schedules/query', {
      query: {
        paging: { limit: params.limit || 100, offset: params.offset || 0 },
      },
    });
    return response.data.schedules;
  }

  async getSchedule(scheduleId: string): Promise<any> {
    const response = await this.client.get(`/bookings/v1/schedules/${scheduleId}`);
    return response.data.schedule;
  }

  // ============================================================================
  // EXTERNAL CALENDAR SYNC
  // ============================================================================

  async syncExternalCalendar(resourceId: string, calendarType: 'GOOGLE' | 'MICROSOFT' | 'APPLE'): Promise<any> {
    const response = await this.client.post('/bookings/v1/external-calendars/connect', {
      resourceId,
      calendarType,
    });
    return response.data;
  }

  async disconnectExternalCalendar(resourceId: string, calendarType: string): Promise<void> {
    await this.client.post('/bookings/v1/external-calendars/disconnect', {
      resourceId,
      calendarType,
    });
  }

  // ============================================================================
  // WEBHOOKS
  // ============================================================================

  async createWebhook(params: {
    eventTypes: string[];
    callbackUrl: string;
  }): Promise<any> {
    const response = await this.client.post('/webhooks/v1/webhooks', {
      webhook: {
        eventTypes: params.eventTypes,
        callbackUrl: params.callbackUrl,
      },
    });
    return response.data.webhook;
  }
}

// Factory function
export function createWixBookingsService(siteId: string, accessToken: string): WixBookingsService {
  return new WixBookingsService({ siteId, accessToken });
}
