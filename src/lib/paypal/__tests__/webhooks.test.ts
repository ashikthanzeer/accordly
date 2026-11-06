import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  extractPayPalWebhookHeaders,
  extractWebhookInvoiceId,
  verifyWebhookSignature,
} from "../webhooks";
import * as auth from "../auth";
import { PayPalConfigError } from "../config";

describe("PayPal Webhooks Service", () => {
  const validHeadersRecord = {
    "paypal-auth-algo": "SHA256withRSA",
    "paypal-cert-url": "https://api.sandbox.paypal.com/v1/notifications/certs/CERT-1234.pem",
    "paypal-transmission-id": "trans-123-abc",
    "paypal-transmission-sig": "mock-signature-base64",
    "paypal-transmission-time": "2026-11-06T12:00:00Z",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("extractPayPalWebhookHeaders", () => {
    it("extracts and normalizes valid PayPal transmission headers", () => {
      const result = extractPayPalWebhookHeaders(validHeadersRecord);
      expect(result.valid).toBe(true);
      expect(result.headers).toEqual({
        authAlgo: "SHA256withRSA",
        certUrl: "https://api.sandbox.paypal.com/v1/notifications/certs/CERT-1234.pem",
        transmissionId: "trans-123-abc",
        transmissionSig: "mock-signature-base64",
        transmissionTime: "2026-11-06T12:00:00Z",
      });
    });

    it("rejects when required transmission headers are missing", () => {
      const incomplete = {
        "paypal-auth-algo": "SHA256withRSA",
      };
      const result = extractPayPalWebhookHeaders(incomplete);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Missing required PayPal transmission header(s)");
      expect(result.error).toContain("paypal-cert-url");
    });

    it("rejects non-PayPal or non-HTTPS cert URLs", () => {
      const untrustedCert = {
        ...validHeadersRecord,
        "paypal-cert-url": "http://evil-domain.com/cert.pem",
      };
      const result = extractPayPalWebhookHeaders(untrustedCert);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Must be a trusted HTTPS PayPal domain");
    });
  });

  describe("extractWebhookInvoiceId", () => {
    it("extracts invoice ID from direct resource.id starting with INV2-", () => {
      const event = {
        resource_type: "invoices",
        resource: { id: "INV2-DIRECT-123" },
      };
      expect(extractWebhookInvoiceId(event)).toBe("INV2-DIRECT-123");
    });

    it("extracts invoice ID from nested resource.invoice.id", () => {
      const event = {
        resource_type: "payments",
        resource: { invoice: { id: "INV2-NESTED-456" } },
      };
      expect(extractWebhookInvoiceId(event)).toBe("INV2-NESTED-456");
    });

    it("extracts invoice ID from resource.invoice_id", () => {
      const event = {
        resource: { invoice_id: "INV2-PROPERTY-789" },
      };
      expect(extractWebhookInvoiceId(event)).toBe("INV2-PROPERTY-789");
    });

    it("extracts invoice ID from links regex", () => {
      const event = {
        resource: {
          links: [{ href: "https://api.sandbox.paypal.com/v2/invoicing/invoices/INV2-LINK-MATCH" }],
        },
      };
      expect(extractWebhookInvoiceId(event)).toBe("INV2-LINK-MATCH");
    });

    it("returns null if no invoice identifier is found", () => {
      expect(extractWebhookInvoiceId(null)).toBeNull();
      expect(extractWebhookInvoiceId({})).toBeNull();
      expect(extractWebhookInvoiceId({ resource: {} })).toBeNull();
    });
  });

  describe("verifyWebhookSignature", () => {
    const mockConfig = {
      env: "sandbox" as const,
      clientId: "mock-client-id",
      clientSecret: "mock-secret",
      webhookId: "WH-TEST-9999",
      baseUrl: "https://api-m.sandbox.paypal.com",
    };

    const mockHeaders = {
      authAlgo: "SHA256withRSA",
      certUrl: "https://api.sandbox.paypal.com/v1/notifications/certs/CERT.pem",
      transmissionId: "trans-001",
      transmissionSig: "sig-001",
      transmissionTime: "2026-11-06T12:00:00Z",
    };

    const mockEvent = {
      id: "WH-EVENT-1",
      event_type: "INVOICING.INVOICE.PAID",
      resource: { id: "INV2-PAID-01" },
    };

    it("returns verified: true when PayPal verification returns SUCCESS", async () => {
      vi.spyOn(auth, "getPayPalAccessToken").mockResolvedValueOnce("mock-token-xyz");

      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ verification_status: "SUCCESS" }),
      });
      global.fetch = mockFetch;

      const result = await verifyWebhookSignature(mockHeaders, mockEvent, mockConfig);

      expect(result.verified).toBe(true);
      expect(result.status).toBe("SUCCESS");
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api-m.sandbox.paypal.com/v1/notifications/verify-webhook-signature",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer mock-token-xyz",
          }),
        })
      );
    });

    it("returns verified: false when PayPal verification returns FAILURE", async () => {
      vi.spyOn(auth, "getPayPalAccessToken").mockResolvedValueOnce("mock-token-xyz");

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ verification_status: "FAILURE" }),
      });

      const result = await verifyWebhookSignature(mockHeaders, mockEvent, mockConfig);

      expect(result.verified).toBe(false);
      expect(result.status).toBe("FAILURE");
    });

    it("throws PayPalConfigError if webhookId is missing in configuration", async () => {
      const configNoWebhook = { ...mockConfig, webhookId: undefined };
      await expect(
        verifyWebhookSignature(mockHeaders, mockEvent, configNoWebhook)
      ).rejects.toThrow(PayPalConfigError);
    });
  });
});

