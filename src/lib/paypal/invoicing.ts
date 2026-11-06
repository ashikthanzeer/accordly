/**
 * PayPal Invoicing v2 service.
 *
 * Implements draft invoice creation, invoice sending, invoice retrieval,
 * and status normalization against the official PayPal Invoicing REST API v2.
 */

import { getPayPalAccessToken } from "./auth";
import { getPayPalConfig, type PayPalConfig } from "./config";
import {
  type CreateInvoiceInput,
  type PayPalHateoasLink,
  type PayPalInvoiceSummary,
  type SendInvoiceResult,
  normalizePayPalInvoiceStatus,
  PayPalApiError,
} from "./types";
import { validateCreateInvoiceInput } from "./validation";
import crypto from "node:crypto";

// Local in-flight registry to prevent concurrent duplicate invoice creation requests
const inFlightRequests = new Set<string>();

interface RawInvoiceDetail {
  currency_code?: string;
  invoice_number?: string;
  invoice_date?: string;
  metadata?: {
    recipient_view_url?: string;
    invoicer_view_url?: string;
    create_time?: string;
    last_update_time?: string;
  };
}

interface RawInvoiceResponse {
  id?: string;
  status?: string;
  detail?: RawInvoiceDetail;
  amount?: {
    currency_code?: string;
    value?: string;
  };
  due_amount?: {
    currency_code?: string;
    value?: string;
  };
  primary_recipients?: Array<{
    billing_info?: {
      email_address?: string;
    };
  }>;
  links?: PayPalHateoasLink[];
  [key: string]: unknown;
}

/**
 * Extracts invoice ID from a response or HATEOAS self link if needed.
 */
function extractInvoiceId(data: RawInvoiceResponse): string | null {
  if (data.id && typeof data.id === "string") {
    return data.id;
  }
  if (Array.isArray(data.links)) {
    const selfLink = data.links.find((l) => l.rel === "self");
    if (selfLink?.href) {
      const match = selfLink.href.match(/\/v2\/invoicing\/invoices\/([^/?#]+)/);
      if (match && match[1]) {
        return match[1];
      }
    }
  }
  return null;
}

/**
 * Creates a minimal draft invoice in PayPal Sandbox/Live using Invoicing API v2.
 */
export async function createDraftInvoice(
  input: CreateInvoiceInput,
  customConfig?: PayPalConfig
): Promise<PayPalInvoiceSummary> {
  const validated = validateCreateInvoiceInput(input);
  const config = customConfig || getPayPalConfig();

  // Generate or derive a deterministic idempotency key
  const idempotencyKey =
    validated.idempotencyKey ||
    `accordly_${crypto.randomUUID()}`;

  if (inFlightRequests.has(idempotencyKey)) {
    throw new PayPalApiError({
      message: `A request with idempotency key "${idempotencyKey}" is already in-flight. Duplicate request prevented.`,
      status: 409,
      statusText: "Conflict",
    });
  }

  inFlightRequests.add(idempotencyKey);

  try {
    const accessToken = await getPayPalAccessToken(config);
    const url = `${config.baseUrl}/v2/invoicing/invoices`;

    const today = new Date().toISOString().slice(0, 10);
    const invoiceDate = validated.invoiceDate || today;

    const payload = {
      detail: {
        invoice_number: validated.invoiceNumber,
        invoice_date: invoiceDate,
        currency_code: validated.currency,
        note: validated.note || "Created via Accordly",
      },
      primary_recipients: [
        {
          billing_info: {
            email_address: validated.recipientEmail,
          },
        },
      ],
      items: [
        {
          name: validated.description.slice(0, 120),
          description: validated.description,
          quantity: "1",
          unit_amount: {
            currency_code: validated.currency,
            value: validated.amount,
          },
          unit_of_measure: "QUANTITY",
        },
      ],
      configuration: {
        partial_payment: {
          allow_partial_payment: false,
        },
        tax_calculated_after_discount: true,
        tax_inclusive: false,
      },
    };

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          Accept: "application/json",
          "Prefer": "return=representation",
          "PayPal-Request-Id": idempotencyKey,
        },
        body: JSON.stringify(payload),
      });
    } catch (err: unknown) {
      throw new PayPalApiError({
        message: `Network failure connecting to PayPal Invoicing endpoint: ${
          err instanceof Error ? err.message : String(err)
        }`,
        status: 0,
        statusText: "NetworkError",
      });
    }

    const debugId = response.headers.get("paypal-debug-id") || undefined;

    if (!response.ok) {
      let errorBody: unknown;
      try {
        errorBody = await response.json();
      } catch {
        errorBody = await response.text();
      }

      const message =
        typeof errorBody === "object" && errorBody !== null && "message" in errorBody
          ? String((errorBody as { message: unknown }).message)
          : response.statusText;

      throw new PayPalApiError({
        message: `PayPal invoice creation failed: ${message}`,
        status: response.status,
        statusText: response.statusText,
        paypalDebugId: debugId,
        details: errorBody,
      });
    }

    const data = (await response.json()) as RawInvoiceResponse;
    const invoiceId = extractInvoiceId(data);

    if (!invoiceId) {
      throw new PayPalApiError({
        message: "PayPal invoice creation succeeded but no invoice ID was returned.",
        status: response.status,
        statusText: response.statusText,
        paypalDebugId: debugId,
        details: data,
      });
    }

    const recipientViewUrl =
      data.detail?.metadata?.recipient_view_url ||
      data.links?.find((l) => l.rel === "payer-view")?.href;

    return {
      id: invoiceId,
      rawStatus: data.status || "DRAFT",
      normalizedStatus: normalizePayPalInvoiceStatus(data.status || "DRAFT"),
      currency: data.amount?.currency_code || validated.currency,
      totalAmount: data.amount?.value || validated.amount,
      dueAmount: data.due_amount?.value,
      recipientEmail: validated.recipientEmail,
      recipientViewUrl,
      invoiceNumber: data.detail?.invoice_number || validated.invoiceNumber,
      createTime: data.detail?.metadata?.create_time,
      links: data.links,
      raw: data,
    };
  } finally {
    inFlightRequests.delete(idempotencyKey);
  }
}

/**
 * Sends a draft invoice via the PayPal Invoicing API.
 * Captures authoritative status and hosted invoice URL.
 */
export async function sendInvoice(
  invoiceId: string,
  options?: {
    sendToRecipient?: boolean;
    sendToInvoicer?: boolean;
    subject?: string;
    note?: string;
  },
  customConfig?: PayPalConfig
): Promise<SendInvoiceResult> {
  const cleanId = invoiceId?.trim();
  if (!cleanId) {
    throw new PayPalApiError({
      message: "Cannot send invoice: invoiceId is required.",
      status: 400,
      statusText: "Bad Request",
    });
  }

  const config = customConfig || getPayPalConfig();
  const accessToken = await getPayPalAccessToken(config);
  const url = `${config.baseUrl}/v2/invoicing/invoices/${encodeURIComponent(cleanId)}/send`;

  const payload = {
    send_to_recipient: options?.sendToRecipient ?? true,
    send_to_invoicer: options?.sendToInvoicer ?? false,
    subject: options?.subject,
    note: options?.note,
  };

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch (err: unknown) {
    throw new PayPalApiError({
      message: `Network failure sending PayPal invoice ${cleanId}: ${
        err instanceof Error ? err.message : String(err)
      }`,
      status: 0,
      statusText: "NetworkError",
    });
  }

  const debugId = response.headers.get("paypal-debug-id") || undefined;

  // PayPal send returns 200 OK or 202 Accepted
  if (!response.ok && response.status !== 202) {
    let errorBody: unknown;
    try {
      errorBody = await response.json();
    } catch {
      errorBody = await response.text();
    }

    const message =
      typeof errorBody === "object" && errorBody !== null && "message" in errorBody
        ? String((errorBody as { message: unknown }).message)
        : response.statusText;

    throw new PayPalApiError({
      message: `PayPal invoice send failed: ${message}`,
      status: response.status,
      statusText: response.statusText,
      paypalDebugId: debugId,
      details: errorBody,
    });
  }

  let sendResponseJson: { links?: PayPalHateoasLink[] } = {};
  try {
    sendResponseJson = (await response.json()) as { links?: PayPalHateoasLink[] };
  } catch {
    // Some PayPal send responses have empty body
  }

  // Retrieve current authoritative invoice details to get updated status and hosted URL
  const updatedInvoice = await getInvoice(cleanId, config);

  const payerViewLink =
    sendResponseJson.links?.find((l) => l.rel === "payer-view")?.href ||
    updatedInvoice.recipientViewUrl;

  return {
    invoiceId: cleanId,
    status: updatedInvoice.normalizedStatus,
    rawStatus: updatedInvoice.rawStatus,
    recipientViewUrl: payerViewLink,
    links: sendResponseJson.links || updatedInvoice.links,
    rawResponse: sendResponseJson,
  };
}

/**
 * Retrieves invoice details by PayPal invoice ID.
 */
export async function getInvoice(
  invoiceId: string,
  customConfig?: PayPalConfig
): Promise<PayPalInvoiceSummary> {
  const cleanId = invoiceId?.trim();
  if (!cleanId) {
    throw new PayPalApiError({
      message: "Cannot retrieve invoice: invoiceId is required.",
      status: 400,
      statusText: "Bad Request",
    });
  }

  const config = customConfig || getPayPalConfig();
  const accessToken = await getPayPalAccessToken(config);
  const url = `${config.baseUrl}/v2/invoicing/invoices/${encodeURIComponent(cleanId)}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });
  } catch (err: unknown) {
    throw new PayPalApiError({
      message: `Network failure fetching PayPal invoice ${cleanId}: ${
        err instanceof Error ? err.message : String(err)
      }`,
      status: 0,
      statusText: "NetworkError",
    });
  }

  const debugId = response.headers.get("paypal-debug-id") || undefined;

  if (!response.ok) {
    let errorBody: unknown;
    try {
      errorBody = await response.json();
    } catch {
      errorBody = await response.text();
    }

    const message =
      typeof errorBody === "object" && errorBody !== null && "message" in errorBody
        ? String((errorBody as { message: unknown }).message)
        : response.statusText;

    throw new PayPalApiError({
      message: `Failed to retrieve PayPal invoice ${cleanId}: ${message}`,
      status: response.status,
      statusText: response.statusText,
      paypalDebugId: debugId,
      details: errorBody,
    });
  }

  const data = (await response.json()) as RawInvoiceResponse;
  const resolvedId = extractInvoiceId(data) || cleanId;
  const rawStatus = data.status || "UNKNOWN";
  const normalizedStatus = normalizePayPalInvoiceStatus(rawStatus);

  const recipientViewUrl =
    data.detail?.metadata?.recipient_view_url ||
    data.links?.find((l) => l.rel === "payer-view")?.href;

  const recipientEmail =
    data.primary_recipients?.[0]?.billing_info?.email_address;

  return {
    id: resolvedId,
    rawStatus,
    normalizedStatus,
    currency: data.amount?.currency_code || data.detail?.currency_code || "USD",
    totalAmount: data.amount?.value || "0.00",
    dueAmount: data.due_amount?.value,
    recipientEmail,
    recipientViewUrl,
    invoiceNumber: data.detail?.invoice_number,
    createTime: data.detail?.metadata?.create_time,
    links: data.links,
    raw: data,
  };
}

