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

export interface InvoiceLineItemInput {
  name: string;
  description?: string;
  quantity: string | number;
  unitAmount: string | number;
  currency?: string;
  unitOfMeasure?: string;
}

export interface CreateInvoiceInput {
  recipientEmail: string;
  description: string;
  currency: string;
  amount: string | number;
  items?: InvoiceLineItemInput[];
  idempotencyKey?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  dueDate?: string;
  note?: string;
}

export interface InvoiceEligibilityResult {
  eligible: boolean;
  reason?: string;
  isAlreadyInvoiced?: boolean;
  existingInvoice?: {
    id: string;
    paypalInvoiceId: string;
    status: string;
    amount: string | number;
    currency: string;
    hostedInvoiceUrl?: string | null;
    sentAt?: Date | string | null;
  } | null;
}

export interface MappedInvoiceLineItem {
  id?: string;
  name: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  unitAmount: string;
  subtotal: number;
  formattedSubtotal: string;
  currency: string;
}

export interface MappedInvoicePreview {
  proposalId: string;
  projectId: string;
  recipientEmail: string;
  recipientName?: string;
  proposalTitle: string;
  description: string;
  currency: string;
  totalAmount: string;
  rawAmount: number;
  lineItems: MappedInvoiceLineItem[];
  itemCount: number;
  invoiceNumber?: string;
  note?: string;
  isAlreadyInvoiced?: boolean;
  existingInvoice?: any;
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
  paidAmount?: string;
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

export interface PayPalWebhookHeaders {
  authAlgo: string;
  certUrl: string;
  transmissionId: string;
  transmissionSig: string;
  transmissionTime: string;
}

export interface PayPalWebhookEvent {
  id: string;
  event_version?: string;
  create_time: string;
  resource_type: string;
  event_type: string;
  summary?: string;
  resource: Record<string, any>;
  links?: PayPalHateoasLink[];
}

export interface WebhookVerificationResult {
  verified: boolean;
  status: "SUCCESS" | "FAILURE" | "ERROR";
  error?: string;
  rawResponse?: unknown;
}

export interface AuthoritativeReconciliationResult {
  success: boolean;
  invoiceId?: string;
  paypalInvoiceId: string;
  previousStatus?: string;
  reconciledStatus: NormalizedInvoiceStatus;
  rawPayPalStatus: string;
  amount: string;
  paidAmount?: string;
  dueAmount?: string;
  currency: string;
  paidAt?: Date | string | null;
  lastReconciledAt: Date | string;
  isStatusChanged: boolean;
  unresolved?: boolean;
  error?: string;
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

