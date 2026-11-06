import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getPayPalConfig,
  isPayPalConfigured,
  PayPalConfigError,
} from "../config";
import {
  formatDecimalAmount,
  validateCreateInvoiceInput,
  ValidationError,
} from "../validation";
import {
  normalizePayPalInvoiceStatus,
  PayPalApiError,
} from "../types";
import {
  getPayPalAccessToken,
  clearPayPalTokenCache,
} from "../auth";
import {
  createDraftInvoice,
  sendInvoice,
  getInvoice,
} from "../invoicing";

describe("PayPal Configuration & Validation", () => {
  it("validates a correct sandbox configuration", () => {
    const config = getPayPalConfig({
      PAYPAL_ENV: "sandbox",
      PAYPAL_CLIENT_ID: "test-client-id",
      PAYPAL_CLIENT_SECRET: "test-client-secret",
      PAYPAL_BASE_URL: "https://api-m.sandbox.paypal.com",
    });

    expect(config.env).toBe("sandbox");
    expect(config.clientId).toBe("test-client-id");
    expect(config.clientSecret).toBe("test-client-secret");
    expect(config.baseUrl).toBe("https://api-m.sandbox.paypal.com");
  });

  it("checks whether credentials are fully populated via isPayPalConfigured", () => {
    expect(
      isPayPalConfigured({
        PAYPAL_CLIENT_ID: "id",
        PAYPAL_CLIENT_SECRET: "secret",
      })
    ).toBe(true);

    expect(
      isPayPalConfigured({
        PAYPAL_CLIENT_ID: "",
        PAYPAL_CLIENT_SECRET: "secret",
      })
    ).toBe(false);

    expect(isPayPalConfigured({})).toBe(false);
  });

  it("throws if PAYPAL_CLIENT_ID is missing", () => {
    expect(() =>
      getPayPalConfig({
        PAYPAL_ENV: "sandbox",
        PAYPAL_CLIENT_SECRET: "secret",
      })
    ).toThrow(PayPalConfigError);
  });

  it("throws if PAYPAL_CLIENT_SECRET is missing", () => {
    expect(() =>
      getPayPalConfig({
        PAYPAL_ENV: "sandbox",
        PAYPAL_CLIENT_ID: "id",
      })
    ).toThrow(PayPalConfigError);
  });

  it("rejects mismatched Sandbox environment pointing to Live API URL", () => {
    expect(() =>
      getPayPalConfig({
        PAYPAL_ENV: "sandbox",
        PAYPAL_CLIENT_ID: "id",
        PAYPAL_CLIENT_SECRET: "secret",
        PAYPAL_BASE_URL: "https://api-m.paypal.com",
      })
    ).toThrow(/Keep Sandbox and Live configurations strictly separate/);
  });

  it("rejects mismatched Live environment pointing to Sandbox URL", () => {
    expect(() =>
      getPayPalConfig({
        PAYPAL_ENV: "live",
        PAYPAL_CLIENT_ID: "id",
        PAYPAL_CLIENT_SECRET: "secret",
        PAYPAL_BASE_URL: "https://api-m.sandbox.paypal.com",
      })
    ).toThrow(/Keep Sandbox and Live configurations strictly separate/);
  });
});

describe("Decimal-Safe Monetary Formatting & Validation", () => {
  it("formats standard 2-decimal currencies deterministically", () => {
    expect(formatDecimalAmount("100", "USD")).toBe("100.00");
    expect(formatDecimalAmount("100.5", "USD")).toBe("100.50");
    expect(formatDecimalAmount("100.55", "USD")).toBe("100.55");
    expect(formatDecimalAmount(250, "EUR")).toBe("250.00");
    expect(formatDecimalAmount(250.75, "GBP")).toBe("250.75");
  });

  it("formats zero-decimal currencies without fractions", () => {
    expect(formatDecimalAmount("5000", "JPY")).toBe("5000");
    expect(() => formatDecimalAmount("5000.50", "JPY")).toThrow(ValidationError);
  });

  it("validates valid invoice input correctly", () => {
    const validated = validateCreateInvoiceInput({
      recipientEmail: "client@example.com",
      description: "Additional landing page design",
      currency: "usd",
      amount: "150.00",
    });

    expect(validated.recipientEmail).toBe("client@example.com");
    expect(validated.currency).toBe("USD");
    expect(validated.amount).toBe("150.00");
    expect(validated.description).toBe("Additional landing page design");
  });

  it("rejects invalid emails", () => {
    expect(() =>
      validateCreateInvoiceInput({
        recipientEmail: "not-an-email",
        description: "Work",
        currency: "USD",
        amount: "100.00",
      })
    ).toThrow(ValidationError);
  });

  it("rejects zero and negative amounts", () => {
    expect(() =>
      validateCreateInvoiceInput({
        recipientEmail: "client@example.com",
        description: "Work",
        currency: "USD",
        amount: "0.00",
      })
    ).toThrow(ValidationError);

    expect(() =>
      validateCreateInvoiceInput({
        recipientEmail: "client@example.com",
        description: "Work",
        currency: "USD",
        amount: "-50.00",
      })
    ).toThrow(ValidationError);
  });

  it("rejects invalid currency codes", () => {
    expect(() =>
      validateCreateInvoiceInput({
        recipientEmail: "client@example.com",
        description: "Work",
        currency: "US",
        amount: "100.00",
      })
    ).toThrow(ValidationError);
  });
});

describe("Status Normalization", () => {
  it("maps raw PayPal statuses to normalized Accordly statuses", () => {
    expect(normalizePayPalInvoiceStatus("DRAFT")).toBe("DRAFT");
    expect(normalizePayPalInvoiceStatus("SENT")).toBe("SENT");
    expect(normalizePayPalInvoiceStatus("SCHEDULED")).toBe("SENT");
    expect(normalizePayPalInvoiceStatus("PAYMENT_PENDING")).toBe("SENT");
    expect(normalizePayPalInvoiceStatus("PARTIALLY_PAID")).toBe("PARTIALLY_PAID");
    expect(normalizePayPalInvoiceStatus("PAID")).toBe("PAID");
    expect(normalizePayPalInvoiceStatus("MARKED_AS_PAID")).toBe("PAID");
    expect(normalizePayPalInvoiceStatus("CANCELLED")).toBe("CANCELLED");
    expect(normalizePayPalInvoiceStatus("REFUNDED")).toBe("REFUNDED");
    expect(normalizePayPalInvoiceStatus("UNKNOWN_CODE")).toBe("UNKNOWN");
    expect(normalizePayPalInvoiceStatus(null)).toBe("UNKNOWN");
  });
});

describe("OAuth 2.0 Client Credentials Authentication & Caching", () => {
  const mockConfig = {
    env: "sandbox" as const,
    clientId: "mock-client-id",
    clientSecret: "mock-client-secret",
    baseUrl: "https://api-m.sandbox.paypal.com",
  };

  beforeEach(() => {
    clearPayPalTokenCache();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    clearPayPalTokenCache();
  });

  it("retrieves access token and caches it", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers(),
      json: async () => ({
        access_token: "mock-access-token-12345",
        token_type: "Bearer",
        expires_in: 3600,
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const token1 = await getPayPalAccessToken(mockConfig);
    expect(token1).toBe("mock-access-token-12345");
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Second call should hit memory cache without network call
    const token2 = await getPayPalAccessToken(mockConfig);
    expect(token2).toBe("mock-access-token-12345");
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("handles authentication failures without leaking secret", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      headers: new Headers({ "paypal-debug-id": "debug-xyz" }),
      json: async () => ({
        error: "invalid_client",
        error_description: "Client Authentication failed",
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await expect(getPayPalAccessToken(mockConfig)).rejects.toThrow(PayPalApiError);
  });
});

describe("PayPal Invoicing Service Operations", () => {
  const mockConfig = {
    env: "sandbox" as const,
    clientId: "mock-client-id",
    clientSecret: "mock-client-secret",
    baseUrl: "https://api-m.sandbox.paypal.com",
  };

  beforeEach(() => {
    clearPayPalTokenCache();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    clearPayPalTokenCache();
  });

  it("creates a draft invoice with idempotency header and return=representation", async () => {
    let capturedHeaders: HeadersInit | undefined;
    let capturedBody: string | undefined;

    const mockFetch = vi.fn().mockImplementation((url: string, options: RequestInit) => {
      if (url.includes("/v1/oauth2/token")) {
        return Promise.resolve({
          ok: true,
          headers: new Headers(),
          json: async () => ({ access_token: "tok_123", expires_in: 3600 }),
        });
      }

      if (url.includes("/v2/invoicing/invoices")) {
        capturedHeaders = options.headers;
        capturedBody = options.body as string;
        return Promise.resolve({
          ok: true,
          status: 201,
          statusText: "Created",
          headers: new Headers({ "paypal-debug-id": "dbg-1" }),
          json: async () => ({
            id: "INV2-TEST-1234",
            status: "DRAFT",
            detail: {
              invoice_number: "TEST-001",
              currency_code: "USD",
              metadata: {
                recipient_view_url: "https://www.sandbox.paypal.com/invoice/p/#TEST",
              },
            },
            amount: {
              currency_code: "USD",
              value: "150.00",
            },
            links: [
              { rel: "self", href: "https://api-m.sandbox.paypal.com/v2/invoicing/invoices/INV2-TEST-1234" },
            ],
          }),
        });
      }

      return Promise.reject(new Error(`Unexpected url: ${url}`));
    });

    vi.stubGlobal("fetch", mockFetch);

    const result = await createDraftInvoice(
      {
        recipientEmail: "client@example.com",
        description: "Scope change order 1",
        currency: "USD",
        amount: "150.00",
        idempotencyKey: "test-idempotency-key-01",
      },
      mockConfig
    );

    expect(result.id).toBe("INV2-TEST-1234");
    expect(result.rawStatus).toBe("DRAFT");
    expect(result.normalizedStatus).toBe("DRAFT");
    expect(result.totalAmount).toBe("150.00");
    expect(result.recipientViewUrl).toBe("https://www.sandbox.paypal.com/invoice/p/#TEST");

    // Verify headers
    const headersObj = capturedHeaders as Record<string, string>;
    expect(headersObj["Prefer"]).toBe("return=representation");
    expect(headersObj["PayPal-Request-Id"]).toBe("test-idempotency-key-01");
    expect(headersObj["Authorization"]).toBe("Bearer tok_123");

    // Verify payload
    const parsedBody = JSON.parse(capturedBody || "{}");
    expect(parsedBody.primary_recipients[0].billing_info.email_address).toBe("client@example.com");
    expect(parsedBody.items[0].unit_amount.value).toBe("150.00");
  });

  it("sends an invoice and retrieves updated authoritative state", async () => {
    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/v1/oauth2/token")) {
        return Promise.resolve({
          ok: true,
          headers: new Headers(),
          json: async () => ({ access_token: "tok_123", expires_in: 3600 }),
        });
      }

      if (url.includes("/send")) {
        return Promise.resolve({
          ok: true,
          status: 202,
          statusText: "Accepted",
          headers: new Headers(),
          json: async () => ({
            links: [
              { rel: "payer-view", href: "https://www.sandbox.paypal.com/invoice/payer-view" },
            ],
          }),
        });
      }

      // getInvoice call following send
      if (url.includes("/v2/invoicing/invoices/INV2-TEST-1234")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: "OK",
          headers: new Headers(),
          json: async () => ({
            id: "INV2-TEST-1234",
            status: "SENT",
            detail: {
              metadata: {
                recipient_view_url: "https://www.sandbox.paypal.com/invoice/payer-view",
              },
            },
            amount: { currency_code: "USD", value: "150.00" },
          }),
        });
      }

      return Promise.reject(new Error(`Unexpected url: ${url}`));
    });

    vi.stubGlobal("fetch", mockFetch);

    const sendRes = await sendInvoice("INV2-TEST-1234", {}, mockConfig);
    expect(sendRes.invoiceId).toBe("INV2-TEST-1234");
    expect(sendRes.status).toBe("SENT");
    expect(sendRes.rawStatus).toBe("SENT");
    expect(sendRes.recipientViewUrl).toBe("https://www.sandbox.paypal.com/invoice/payer-view");
  });

  it("retrieves invoice details by id and normalizes status", async () => {
    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/v1/oauth2/token")) {
        return Promise.resolve({
          ok: true,
          headers: new Headers(),
          json: async () => ({ access_token: "tok_123", expires_in: 3600 }),
        });
      }

      if (url.includes("/v2/invoicing/invoices/INV2-999")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: "OK",
          headers: new Headers(),
          json: async () => ({
            id: "INV2-999",
            status: "PAID",
            detail: {
              invoice_number: "INV-999",
              metadata: {
                recipient_view_url: "https://www.sandbox.paypal.com/view/999",
              },
            },
            amount: { currency_code: "USD", value: "300.00" },
            due_amount: { currency_code: "USD", value: "0.00" },
          }),
        });
      }

      return Promise.reject(new Error(`Unexpected url: ${url}`));
    });

    vi.stubGlobal("fetch", mockFetch);

    const invoice = await getInvoice("INV2-999", mockConfig);
    expect(invoice.id).toBe("INV2-999");
    expect(invoice.rawStatus).toBe("PAID");
    expect(invoice.normalizedStatus).toBe("PAID");
    expect(invoice.totalAmount).toBe("300.00");
    expect(invoice.dueAmount).toBe("0.00");
  });
});

