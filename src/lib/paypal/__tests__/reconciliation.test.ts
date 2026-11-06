import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  reconcileInvoiceByPayPalId,
  reconcileInvoiceFromWebhook,
} from "../reconciliation";
import * as invoicing from "../invoicing";
import { prisma } from "@/lib/db";

vi.mock("@/lib/db", () => {
  return {
    prisma: {
      payPalInvoice: {
        findFirst: vi.fn(),
        update: vi.fn(),
      },
      webhookEvent: {
        update: vi.fn(),
      },
      projectEvent: {
        create: vi.fn(),
      },
      $transaction: vi.fn((callback) => callback(prisma)),
    },
  };
});

describe("Authoritative Payment Reconciliation", () => {
  const mockLocalInvoice = {
    id: "loc_inv_001",
    projectId: "proj_abc",
    changeOrderId: "prop_xyz",
    paypalInvoiceId: "INV2-RECON-123",
    status: "SENT",
    currency: "USD",
    amount: { toString: () => "1200.00" },
    hostedInvoiceUrl: "https://sandbox.paypal.com/inv",
    sentAt: new Date("2026-11-06T10:00:00Z"),
    paidAt: null,
    lastReconciledAt: new Date("2026-11-06T10:00:00Z"),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("reconcileInvoiceByPayPalId", () => {
    it("updates local invoice to PAID when PayPal returns PAID", async () => {
      vi.mocked(prisma.payPalInvoice.findFirst).mockResolvedValueOnce(mockLocalInvoice as any);

      const mockAuthoritativeSummary = {
        id: "INV2-RECON-123",
        rawStatus: "PAID",
        normalizedStatus: "PAID" as const,
        currency: "USD",
        totalAmount: "1200.00",
        dueAmount: "0.00",
        paidAmount: "1200.00",
        recipientViewUrl: "https://sandbox.paypal.com/inv/paid",
      };

      vi.spyOn(invoicing, "getInvoice").mockResolvedValueOnce(mockAuthoritativeSummary);

      const updatedRecord = {
        ...mockLocalInvoice,
        status: "PAID",
        paidAt: new Date(),
        amount: { toString: () => "1200.00" },
      };

      vi.mocked(prisma.payPalInvoice.update).mockResolvedValueOnce(updatedRecord as any);
      vi.mocked(prisma.projectEvent.create).mockResolvedValueOnce({} as any);

      const result = await reconcileInvoiceByPayPalId("INV2-RECON-123");

      expect(result.success).toBe(true);
      expect(result.reconciledStatus).toBe("PAID");
      expect(result.isStatusChanged).toBe(true);
      expect(result.paidAmount).toBe("1200.00");
      expect(result.dueAmount).toBe("0.00");
      expect(prisma.payPalInvoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "PAID",
          }),
        })
      );
      expect(prisma.projectEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventType: "PAYPAL_PAYMENT_RECONCILED",
            actorType: "PAYPAL",
          }),
        })
      );
    });

    it("handles partial payments and records balance due without marking PAID", async () => {
      vi.mocked(prisma.payPalInvoice.findFirst).mockResolvedValueOnce(mockLocalInvoice as any);

      const mockPartialSummary = {
        id: "INV2-RECON-123",
        rawStatus: "PARTIALLY_PAID",
        normalizedStatus: "PARTIALLY_PAID" as const,
        currency: "USD",
        totalAmount: "1200.00",
        dueAmount: "600.00",
        paidAmount: "600.00",
        recipientViewUrl: "https://sandbox.paypal.com/inv/partial",
      };

      vi.spyOn(invoicing, "getInvoice").mockResolvedValueOnce(mockPartialSummary);

      const updatedRecord = {
        ...mockLocalInvoice,
        status: "PARTIALLY_PAID",
        amount: { toString: () => "1200.00" },
      };

      vi.mocked(prisma.payPalInvoice.update).mockResolvedValueOnce(updatedRecord as any);
      vi.mocked(prisma.projectEvent.create).mockResolvedValueOnce({} as any);

      const result = await reconcileInvoiceByPayPalId("INV2-RECON-123");

      expect(result.success).toBe(true);
      expect(result.reconciledStatus).toBe("PARTIALLY_PAID");
      expect(result.dueAmount).toBe("600.00");
      expect(result.paidAmount).toBe("600.00");
      expect(prisma.payPalInvoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "PARTIALLY_PAID",
          }),
        })
      );
    });

    it("protects against out-of-order downgrade when local invoice is already PAID", async () => {
      const alreadyPaidInvoice = {
        ...mockLocalInvoice,
        status: "PAID",
        paidAt: new Date("2026-11-06T11:00:00Z"),
      };

      vi.mocked(prisma.payPalInvoice.findFirst).mockResolvedValueOnce(alreadyPaidInvoice as any);

      // Delayed webhook or out-of-order API response returning older status SENT
      const delayedSummary = {
        id: "INV2-RECON-123",
        rawStatus: "SENT",
        normalizedStatus: "SENT" as const,
        currency: "USD",
        totalAmount: "1200.00",
        dueAmount: "1200.00",
      };

      vi.spyOn(invoicing, "getInvoice").mockResolvedValueOnce(delayedSummary);

      const updatedRecord = {
        ...alreadyPaidInvoice,
        amount: { toString: () => "1200.00" },
      };

      vi.mocked(prisma.payPalInvoice.update).mockResolvedValueOnce(updatedRecord as any);
      vi.mocked(prisma.projectEvent.create).mockResolvedValueOnce({} as any);

      const result = await reconcileInvoiceByPayPalId("INV2-RECON-123");

      expect(result.success).toBe(true);
      // Status MUST remain PAID and not downgrade to SENT
      expect(result.reconciledStatus).toBe("PAID");
      expect(prisma.payPalInvoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "PAID",
          }),
        })
      );
    });

    it("returns unresolved result when no local invoice matches PayPal invoice ID", async () => {
      vi.mocked(prisma.payPalInvoice.findFirst).mockResolvedValueOnce(null);

      const result = await reconcileInvoiceByPayPalId("INV2-UNKNOWN-999");

      expect(result.success).toBe(false);
      expect(result.unresolved).toBe(true);
      expect(result.error).toContain("No local invoice found matching");
    });
  });

  describe("reconcileInvoiceFromWebhook", () => {
    it("extracts invoice ID from event and triggers reconciliation, updating WebhookEvent", async () => {
      vi.mocked(prisma.payPalInvoice.findFirst).mockResolvedValueOnce(mockLocalInvoice as any);

      const mockSummary = {
        id: "INV2-WH-EVENT-ID",
        rawStatus: "PAID",
        normalizedStatus: "PAID" as const,
        currency: "USD",
        totalAmount: "1200.00",
      };
      vi.spyOn(invoicing, "getInvoice").mockResolvedValueOnce(mockSummary);

      vi.mocked(prisma.payPalInvoice.update).mockResolvedValueOnce({
        ...mockLocalInvoice,
        status: "PAID",
        amount: { toString: () => "1200.00" },
      } as any);
      vi.mocked(prisma.projectEvent.create).mockResolvedValueOnce({} as any);
      vi.mocked(prisma.webhookEvent.update).mockResolvedValueOnce({} as any);

      const event = {
        id: "WH-123",
        event_type: "INVOICING.INVOICE.PAID",
        resource: { id: "INV2-WH-EVENT-ID" },
      };

      const result = await reconcileInvoiceFromWebhook(event, "webhook_rec_1");

      expect(result.success).toBe(true);
      expect(prisma.webhookEvent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "webhook_rec_1" },
          data: expect.objectContaining({
            processingStatus: "PROCESSED",
          }),
        })
      );
    });
  });
});

