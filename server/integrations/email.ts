import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: string;
}

let transporter: Transporter | null = null;
let defaultFrom: string = '';

export function initializeEmailService(config: EmailConfig): void {
  transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth,
  });
  defaultFrom = config.from;
}

// Initialize with environment variables if available
if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
  initializeEmailService({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
  });
}

// ============================================================================
// CORE EMAIL SENDING
// ============================================================================

export interface SendEmailParams {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  from?: string;
  replyTo?: string;
  cc?: string | string[];
  bcc?: string | string[];
  attachments?: {
    filename: string;
    content?: string | Buffer;
    path?: string;
    contentType?: string;
  }[];
}

export async function sendEmail(params: SendEmailParams): Promise<{ messageId: string; success: boolean }> {
  if (!transporter) {
    console.warn('[Email] Email service not configured, skipping email send');
    return { messageId: '', success: false };
  }

  try {
    const result = await transporter.sendMail({
      from: params.from || defaultFrom,
      to: Array.isArray(params.to) ? params.to.join(', ') : params.to,
      subject: params.subject,
      text: params.text,
      html: params.html,
      replyTo: params.replyTo,
      cc: params.cc,
      bcc: params.bcc,
      attachments: params.attachments,
    });

    return { messageId: result.messageId, success: true };
  } catch (error) {
    console.error('[Email] Failed to send email:', error);
    return { messageId: '', success: false };
  }
}

// ============================================================================
// COMMISSION NOTIFICATIONS
// ============================================================================

export interface CommissionNotificationParams {
  therapistEmail: string;
  therapistName: string;
  commissionAmount: number;
  currency: string;
  transactionType: 'treatment' | 'product_sale' | 'referral';
  customerName?: string;
  serviceName?: string;
  date: Date;
}

export async function sendCommissionEarnedNotification(params: CommissionNotificationParams): Promise<boolean> {
  const formattedAmount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: params.currency,
  }).format(params.commissionAmount);

  const typeLabels = {
    treatment: 'Treatment',
    product_sale: 'Product Sale',
    referral: 'Referral',
  };

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .amount { font-size: 32px; font-weight: bold; color: #28a745; margin: 20px 0; }
        .details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
        .detail-row:last-child { border-bottom: none; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎉 Commission Earned!</h1>
        </div>
        <div class="content">
          <p>Hi ${params.therapistName},</p>
          <p>Great news! You've earned a commission:</p>
          <div class="amount">${formattedAmount}</div>
          <div class="details">
            <div class="detail-row">
              <span>Type:</span>
              <strong>${typeLabels[params.transactionType]}</strong>
            </div>
            ${params.customerName ? `
            <div class="detail-row">
              <span>Customer:</span>
              <strong>${params.customerName}</strong>
            </div>
            ` : ''}
            ${params.serviceName ? `
            <div class="detail-row">
              <span>Service/Product:</span>
              <strong>${params.serviceName}</strong>
            </div>
            ` : ''}
            <div class="detail-row">
              <span>Date:</span>
              <strong>${params.date.toLocaleDateString()}</strong>
            </div>
          </div>
          <p>Keep up the great work! Your commission will be included in your next payout.</p>
        </div>
        <div class="footer">
          <p>SkinTwin Customer Portal</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const result = await sendEmail({
    to: params.therapistEmail,
    subject: `🎉 You earned ${formattedAmount} in commission!`,
    html,
    text: `Hi ${params.therapistName}, You've earned a commission of ${formattedAmount} for a ${typeLabels[params.transactionType]}. Keep up the great work!`,
  });

  return result.success;
}

// ============================================================================
// BOOKING NOTIFICATIONS
// ============================================================================

export interface BookingConfirmationParams {
  salonOwnerEmail: string;
  salonOwnerName: string;
  customerName: string;
  serviceName: string;
  therapistName?: string;
  scheduledAt: Date;
  duration: number;
  locationName?: string;
  price?: number;
  currency?: string;
}

export async function sendBookingConfirmationNotification(params: BookingConfirmationParams): Promise<boolean> {
  const formattedDate = params.scheduledAt.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const formattedTime = params.scheduledAt.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const formattedPrice = params.price && params.currency
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: params.currency }).format(params.price)
    : null;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .booking-card { background: white; padding: 25px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #11998e; }
        .booking-title { font-size: 20px; font-weight: bold; margin-bottom: 15px; }
        .detail-row { display: flex; justify-content: space-between; padding: 8px 0; }
        .detail-label { color: #666; }
        .detail-value { font-weight: 500; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📅 New Booking Confirmed</h1>
        </div>
        <div class="content">
          <p>Hi ${params.salonOwnerName},</p>
          <p>A new booking has been confirmed:</p>
          <div class="booking-card">
            <div class="booking-title">${params.serviceName}</div>
            <div class="detail-row">
              <span class="detail-label">Customer:</span>
              <span class="detail-value">${params.customerName}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Date:</span>
              <span class="detail-value">${formattedDate}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Time:</span>
              <span class="detail-value">${formattedTime}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Duration:</span>
              <span class="detail-value">${params.duration} minutes</span>
            </div>
            ${params.therapistName ? `
            <div class="detail-row">
              <span class="detail-label">Therapist:</span>
              <span class="detail-value">${params.therapistName}</span>
            </div>
            ` : ''}
            ${params.locationName ? `
            <div class="detail-row">
              <span class="detail-label">Location:</span>
              <span class="detail-value">${params.locationName}</span>
            </div>
            ` : ''}
            ${formattedPrice ? `
            <div class="detail-row">
              <span class="detail-label">Price:</span>
              <span class="detail-value">${formattedPrice}</span>
            </div>
            ` : ''}
          </div>
        </div>
        <div class="footer">
          <p>SkinTwin Customer Portal</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const result = await sendEmail({
    to: params.salonOwnerEmail,
    subject: `📅 New Booking: ${params.serviceName} - ${params.customerName}`,
    html,
    text: `New booking confirmed: ${params.serviceName} for ${params.customerName} on ${formattedDate} at ${formattedTime}.`,
  });

  return result.success;
}

// ============================================================================
// PAYMENT NOTIFICATIONS
// ============================================================================

export interface PaymentProcessedParams {
  recipientEmail: string;
  recipientName: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  orderNumber?: string;
  customerName?: string;
  items?: { name: string; quantity: number; price: number }[];
}

export async function sendPaymentProcessedNotification(params: PaymentProcessedParams): Promise<boolean> {
  const formattedAmount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: params.currency,
  }).format(params.amount);

  const itemsHtml = params.items
    ? params.items.map(item => `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.name}</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">${new Intl.NumberFormat('en-US', { style: 'currency', currency: params.currency }).format(item.price)}</td>
        </tr>
      `).join('')
    : '';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .amount { font-size: 28px; font-weight: bold; color: #28a745; text-align: center; margin: 20px 0; }
        .details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
        table { width: 100%; border-collapse: collapse; }
        th { text-align: left; padding: 10px; background: #f5f5f5; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>💳 Payment Received</h1>
        </div>
        <div class="content">
          <p>Hi ${params.recipientName},</p>
          <p>A payment has been successfully processed:</p>
          <div class="amount">${formattedAmount}</div>
          <div class="details">
            ${params.orderNumber ? `<p><strong>Order #:</strong> ${params.orderNumber}</p>` : ''}
            ${params.customerName ? `<p><strong>Customer:</strong> ${params.customerName}</p>` : ''}
            <p><strong>Payment Method:</strong> ${params.paymentMethod}</p>
            ${params.items && params.items.length > 0 ? `
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th style="text-align: center;">Qty</th>
                  <th style="text-align: right;">Price</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
            </table>
            ` : ''}
          </div>
        </div>
        <div class="footer">
          <p>SkinTwin Customer Portal</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const result = await sendEmail({
    to: params.recipientEmail,
    subject: `💳 Payment Received: ${formattedAmount}${params.orderNumber ? ` - Order #${params.orderNumber}` : ''}`,
    html,
    text: `Payment of ${formattedAmount} received via ${params.paymentMethod}.`,
  });

  return result.success;
}

// ============================================================================
// GENERAL NOTIFICATIONS
// ============================================================================

export interface GeneralNotificationParams {
  to: string;
  recipientName: string;
  title: string;
  message: string;
  actionUrl?: string;
  actionText?: string;
}

export async function sendGeneralNotification(params: GeneralNotificationParams): Promise<boolean> {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .message { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .action-button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${params.title}</h1>
        </div>
        <div class="content">
          <p>Hi ${params.recipientName},</p>
          <div class="message">
            ${params.message}
          </div>
          ${params.actionUrl ? `
          <div style="text-align: center;">
            <a href="${params.actionUrl}" class="action-button">${params.actionText || 'View Details'}</a>
          </div>
          ` : ''}
        </div>
        <div class="footer">
          <p>SkinTwin Customer Portal</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const result = await sendEmail({
    to: params.to,
    subject: params.title,
    html,
    text: `${params.title}\n\nHi ${params.recipientName},\n\n${params.message}`,
  });

  return result.success;
}

// ============================================================================
// BULK EMAIL
// ============================================================================

export async function sendBulkEmails(
  emails: SendEmailParams[],
  options: { delayMs?: number; batchSize?: number } = {}
): Promise<{ sent: number; failed: number }> {
  const { delayMs = 100, batchSize = 10 } = options;
  let sent = 0;
  let failed = 0;

  for (let i = 0; i < emails.length; i += batchSize) {
    const batch = emails.slice(i, i + batchSize);
    const results = await Promise.all(batch.map(email => sendEmail(email)));
    
    results.forEach(result => {
      if (result.success) sent++;
      else failed++;
    });

    if (i + batchSize < emails.length) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  return { sent, failed };
}
