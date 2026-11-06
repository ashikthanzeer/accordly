/**
 * PayPal Webhook Signature Verification and Event Parser Service.
 *
 * Implements cryptographic signature verification via PayPal's
 * /v1/notifications/verify-webhook-signature API and extracts invoice IDs.
 */

import { getPayPalAccessToken } from "./auth";
import { getPayPalConfig, type PayPalConfig, PayPalConfigError } from "./config";
import {
  type PayPalWebhookHeaders,
  type WebhookVerificationResult,
  PayPalApiError,
} from "./types";

/**
 * Extracts and validates required PayPal transmission headers.
 */
export function extractPayPalWebhookHeaders(
  headers: Headers | Record<string, string | string[] | undefined>
): { valid: boolean; headers?: PayPalWebhookHeaders; error?: string } {
  const getHeader = (name: string): string | undefined => {
    if (typeof (headers as Headers).get === "function") {
      const val = (headers as Headers).get(name);
      return val || undefined;
    }
    const record = headers as Record<string, string | string[] | undefined>;
    const target = name.toLowerCase();
    for (const [k, v] of Object.entries(record)) {
      if (k.toLowerCase() === target) {
        if (Array.isArray(v)) return v[0];
        return v;
      }
    }
    return undefined;
  };

  const authAlgo = getHeader("paypal-auth-algo")?.trim();
  const certUrl = getHeader("paypal-cert-url")?.trim();
  const transmissionId = getHeader("paypal-transmission-id")?.trim();
  const transmissionSig = getHeader("paypal-transmission-sig")?.trim();
  const transmissionTime = getHeader("paypal-transmission-time")?.trim();

  const missing: string[] = [];
  if (!authAlgo) missing.push("paypal-auth-algo");
  if (!certUrl) missing.push("paypal-cert-url");
  if (!transmissionId) missing.push("paypal-transmission-id");
  if (!transmissionSig) missing.push("paypal-transmission-sig");
  if (!transmissionTime) missing.push("paypal-transmission-time");

  if (missing.length > 0) {
    return {
      valid: false,
      error: `Missing required PayPal transmission header(s): ${missing.join(", ")}`,
    };
  }

  // Security sanity check on certUrl
  if (!certUrl!.startsWith("https://") || !certUrl!.includes("paypal.com")) {
    return {
      valid: false,
      error: `Invalid paypal-cert-url: "${certUrl}". Must be a trusted HTTPS PayPal domain.`,
    };
  }

  return {
    valid: true,
    headers: {
      authAlgo: authAlgo!,
      certUrl: certUrl!,
      transmissionId: transmissionId!,
      transmissionSig: transmissionSig!,
      transmissionTime: transmissionTime!,
    },
  };
}

/**
 * Extracts the associated PayPal Invoice ID from an event resource payload.
 */
export function extractWebhookInvoiceId(event: any): string | null {
  if (!event || typeof event !== "object") return null;

  const resource = event.resource;
  if (!resource || typeof resource !== "object") return null;

  // 1. Direct ID if resource_type is invoices or ID starts with INV2-
  if (typeof resource.id === "string") {
    if (resource.id.startsWith("INV2-") || event.resource_type === "invoices") {
      return resource.id;
    }
  }

  // 2. Nested invoice.id
  if (typeof resource.invoice?.id === "string") {
    return resource.invoice.id;
  }

  // 3. invoice_id property
  if (typeof resource.invoice_id === "string") {
    return resource.invoice_id;
  }

  // 4. Fallback search inside links or parent_payment
  if (Array.isArray(resource.links)) {
    for (const link of resource.links) {
      if (link.href && typeof link.href === "string") {
        const match = link.href.match(/\/v2\/invoicing\/invoices\/(INV2-[A-Za-z0-9_-]+)/);
        if (match && match[1]) {
          return match[1];
        }
      }
    }
  }

  return typeof resource.id === "string" ? resource.id : null;
}

/**
 * Verifies webhook authenticity with PayPal's /v1/notifications/verify-webhook-signature API.
 */
export async function verifyWebhookSignature(
  headers: PayPalWebhookHeaders,
  rawBody: string | Record<string, any>,
  customConfig?: PayPalConfig
): Promise<WebhookVerificationResult> {
  const config = customConfig || getPayPalConfig();

  if (!config.webhookId) {
    throw new PayPalConfigError(
      "PAYPAL_WEBHOOK_ID environment variable is required to verify PayPal webhook signatures."
    );
  }

  const webhookEvent =
    typeof rawBody === "string" ? JSON.parse(rawBody) : rawBody;

  const accessToken = await getPayPalAccessToken(config);
  const verifyUrl = `${config.baseUrl}/v1/notifications/verify-webhook-signature`;

  const payload = {
    auth_algo: headers.authAlgo,
    cert_url: headers.certUrl,
    transmission_id: headers.transmissionId,
    transmission_sig: headers.transmissionSig,
    transmission_time: headers.transmissionTime,
    webhook_id: config.webhookId,
    webhook_event: webhookEvent,
  };

  let response: Response;
  try {
    response = await fetch(verifyUrl, {
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
      message: `Network failure connecting to PayPal webhook verification: ${
        err instanceof Error ? err.message : String(err)
      }`,
      status: 0,
      statusText: "NetworkError",
    });
  }

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

    return {
      verified: false,
      status: "ERROR",
      error: `PayPal verification API responded with HTTP ${response.status}: ${message}`,
      rawResponse: errorBody,
    };
  }

  const data = (await response.json()) as { verification_status?: string };
  const verified = data.verification_status === "SUCCESS";

  return {
    verified,
    status: verified ? "SUCCESS" : "FAILURE",
    rawResponse: data,
  };
}

