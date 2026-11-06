import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST as handleWebhookPost } from "../../../app/api/webhooks/paypal/route";
import * as webhooks from "../webhooks";
import * as reconciliation from "../reconciliation";
import { prisma } from "@/lib/db";
import { NextRequest } from "next/server";

vi.mock("@/lib/db", () => {
  return {
    prisma: {
      webhookEvent: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      payPalInvoice: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      changeOrder: {
        findFirst: vi.fn(),
      },
      projectEvent: {
        create: vi.fn(),
      },
      $transaction: vi.fn((callback) => callback(prisma)),
    },
  };
});

describe("PayPal Webhook Route Integration", () => {
  const validHeadersRecord = {
    "paypal-auth-algo": "SHA256withRSA",
    "paypal-cert-url": "https://api.sandbox.paypal.com/v1/notifications/certs/CERT.pem",
    "paypal-transmission-id": "trans-int-001",
    "paypal-transmission-sig": "valid-sig-base64",
    "paypal-transmission-time": "2026-11-06T12:00:00Z",
  };

  const sampleEvent = {
    id: "WH-TEST-INT-001",
    event_type: "INVOICING.INVOICE.PAID",
    resource_type: "invoices",
    resource: {
      id: "INV2-INT-PAY-01",
      status: "PAID",
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects webhook requests with missing transmission headers with HTTP 400", async () => {
    const req = new NextRequest("http://localhost:3000/api/webhooks/paypal", {
      method: "POST",
      headers: {},
      body: JSON.stringify(sampleEvent),
    });

    const res = await handleWebhookPost(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("Missing required PayPal transmission header(s)");
  });

  it("returns HTTP 200 for duplicate event delivery without re-reconciling", async () => {
    vi.mocked(prisma.webhookEvent.findUnique).mockResolvedValueOnce({
      id: "existing_wh_rec",
      paypalEventId: "WH-TEST-INT-001",
      processingStatus: "PROCESSED",
    } as any);

    const req = new NextRequest("http://localhost:3000/api/webhooks/paypal", {
      method: "POST",
      headers: validHeadersRecord,
      body: JSON.stringify(sampleEvent),
    });

    const res = await handleWebhookPost(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.status).toBe("duplicate");
    expect(data.eventId).toBe("WH-TEST-INT-001");
  });

  it("rejects invalid signature with HTTP 400 and records failed event", async () => {
    vi.mocked(prisma.webhookEvent.findUnique).mockResolvedValueOnce(null);
    vi.spyOn(webhooks, "verifyWebhookSignature").mockResolvedValueOnce({
      verified: false,
      status: "FAILURE",
      error: "Signature check failed",
    });

    vi.mocked(prisma.webhookEvent.create).mockResolvedValueOnce({} as any);

    const req = new NextRequest("http://localhost:3000/api/webhooks/paypal", {
      method: "POST",
      headers: validHeadersRecord,
      body: JSON.stringify(sampleEvent),
    });

    const res = await handleWebhookPost(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("Webhook signature verification failed.");
    expect(prisma.webhookEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          verificationStatus: "INVALID",
          processingStatus: "FAILED",
        }),
      })
    );
  });

  it("processes verified webhook and triggers authoritative reconciliation", async () => {
    vi.mocked(prisma.webhookEvent.findUnique).mockResolvedValueOnce(null);
    vi.spyOn(webhooks, "verifyWebhookSignature").mockResolvedValueOnce({
      verified: true,
      status: "SUCCESS",
    });

    vi.mocked(prisma.webhookEvent.create).mockResolvedValueOnce({
      id: "wh_saved_101",
      paypalEventId: "WH-TEST-INT-001",
    } as any);

    const mockReconciliationResult = {
      success: true,
      paypalInvoiceId: "INV2-INT-PAY-01",
      reconciledStatus: "PAID" as const,
      rawPayPalStatus: "PAID",
      amount: "1500.00",
      paidAmount: "1500.00",
      dueAmount: "0.00",
      currency: "USD",
      lastReconciledAt: new Date(),
      isStatusChanged: true,
    };

    vi.spyOn(reconciliation, "reconcileInvoiceFromWebhook").mockResolvedValueOnce(
      mockReconciliationResult
    );

    const req = new NextRequest("http://localhost:3000/api/webhooks/paypal", {
      method: "POST",
      headers: validHeadersRecord,
      body: JSON.stringify(sampleEvent),
    });

    const res = await handleWebhookPost(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.status).toBe("success");
    expect(data.reconciled).toBe(true);
    expect(data.reconciledStatus).toBe("PAID");
    expect(reconciliation.reconcileInvoiceFromWebhook).toHaveBeenCalledWith(
      expect.objectContaining({ id: "WH-TEST-INT-001" }),
      "wh_saved_101"
    );
  });
});
