/**
 * PayPal domain types, status mappings, and custom errors.
 */

export type NormalizedInvoiceStatus =
  | "DRAFT"
  | "SENT"
  | "PARTIALLY_PAID"
  | "PAID"
  | "CANCELLED"
  | "REFUNDED"
  | "UNKNOWN";

export type RawPayPalInvoiceStatus =
  | "DRAFT"
  | "SENT"
  | "SCHEDULED"
  | "PAID"
  | "MARKED_AS_PAID"
  | "CANCELLED"
  | "REFUNDED"
  | "PARTIALLY_PAID"
  | "PARTIALLY_REFUNDED"
  | "PAYMENT_PENDING"
  | "UNPAID"
  | string;

/**
 * Maps PayPal Invoicing v2 raw status to Accordly normalized invoice status.
 */
export function normalizePayPalInvoiceStatus(rawStatus?: string | null): NormalizedInvoiceStatus {
  if (!rawStatus) return "UNKNOWN";

  const upper = rawStatus.trim().toUpperCase();
  switch (upper) {
    case "DRAFT":
      return "DRAFT";
    case "SENT":
    case "SCHEDULED":
    case "UNPAID":
    case "PAYMENT_PENDING":
      return "SENT";
    case "PARTIALLY_PAID":
      return "PARTIALLY_PAID";
    case "PAID":
    case "MARKED_AS_PAID":
      return "PAID";
    case "CANCELLED":
      return "CANCELLED";
    case "REFUNDED":
    case "PARTIALLY_REFUNDED":
      return "REFUNDED";
    default:
      return "UNKNOWN";
  }
}

export interface CreateInvoiceInput {
  recipientEmail: string;
  description: string;
  currency: string;
  amount: string | number;
  idempotencyKey?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  dueDate?: string;
  note?: string;
}

export interface PayPalHateoasLink {
  href: string;
  rel: string;
  method?: string;
}

export interface PayPalInvoiceSummary {
  id: string;
  rawStatus: string;
  normalizedStatus: NormalizedInvoiceStatus;
  currency: string;
  totalAmount: string;
  dueAmount?: string;
  recipientEmail?: string;
  recipientViewUrl?: string;
  invoiceNumber?: string;
  createTime?: string;
  links?: PayPalHateoasLink[];
  raw?: unknown;
}

export interface SendInvoiceResult {
  invoiceId: string;
  status: NormalizedInvoiceStatus;
  rawStatus: string;
  recipientViewUrl?: string;
  links?: PayPalHateoasLink[];
  rawResponse?: unknown;
}

export class PayPalApiError extends Error {
  readonly status: number;
  readonly statusText: string;
  readonly errorName?: string;
  readonly paypalDebugId?: string;
  readonly details?: unknown;

  constructor(params: {
    message: string;
    status: number;
    statusText: string;
    errorName?: string;
    paypalDebugId?: string;
    details?: unknown;
  }) {
    super(`[PayPalApiError ${params.status} ${params.statusText}] ${params.message}`);
    this.name = "PayPalApiError";
    this.status = params.status;
    this.statusText = params.statusText;
    this.errorName = params.errorName;
    this.paypalDebugId = params.paypalDebugId;
    this.details = params.details;
  }
}

