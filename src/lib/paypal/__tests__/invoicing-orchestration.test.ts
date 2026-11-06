import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getProposalInvoicePreview,
  createAndSendProposalInvoice,
  getProposalInvoice,
  syncProposalInvoiceStatus,
} from "../workflow";
import * as invoicing from "../invoicing";
import { prisma } from "@/lib/db";

// Mock prisma and paypal invoicing client
vi.mock("@/lib/db", () => {
  return {
    prisma: {
      changeOrder: {
        findFirst: vi.fn(),
      },
      payPalInvoice: {
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      projectEvent: {
        create: vi.fn(),
      },
      $transaction: vi.fn((callback) => callback(prisma)),
    },
  };
});

describe("Invoicing Orchestration Workflow", () => {
  const mockProject = {
    id: "proj_99",
    name: "Enterprise Cloud Migration",
    clientName: "Global FinTech Ltd",
    clientEmail: "accounts@globalfintech.com",
  };

  const mockProposal = {
    id: "prop_101",
    projectId: "proj_99",
    version: 1,
    status: "CLIENT_ACCEPTED",
    amount: "2400.00",
    currency: "USD",
    description: "Database cluster scaling and failover testing",
    deliverables: {
      pricing: {
        model: "ITEMIZED",
        currency: "USD",
        total: 2400,
        lineItems: [
          {
            id: "li_1",
            description: "Cluster configuration",
            quantity: 8,
            unitPrice: 150,
            subtotal: 1200,
            currency: "USD",
          },
          {
            id: "li_2",
            description: "Failover load simulation",
            quantity: 8,
            unitPrice: 150,
            subtotal: 1200,
            currency: "USD",
          },
        ],
      },
    },
    invoices: [],
    project: mockProject,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getProposalInvoicePreview", () => {
    it("returns formatted commercial preview for accepted proposal", async () => {
      vi.mocked(prisma.changeOrder.findFirst).mockResolvedValueOnce(mockProposal as any);

      const result = await getProposalInvoicePreview("proj_99", "prop_101");

      expect(result.eligible).toBe(true);
      expect(result.isAlreadyInvoiced).toBeFalsy();
      expect(result.preview).toBeDefined();
      expect(result.preview.recipientEmail).toBe("accounts@globalfintech.com");
      expect(result.preview.totalAmount).toBe("2400.00");
      expect(result.preview.itemCount).toBe(2);
    });

    it("detects existing active invoice and returns isAlreadyInvoiced flag", async () => {
      const alreadyInvoiced = {
        ...mockProposal,
        invoices: [
          {
            id: "inv_existing_1",
            paypalInvoiceId: "INV2-ALREADY-EXISTS",
            status: "SENT",
            amount: 2400,
            currency: "USD",
            hostedInvoiceUrl: "https://www.sandbox.paypal.com/invoice/p/#INV2-ALREADY-EXISTS",
            sentAt: new Date(),
          },
        ],
      };

      vi.mocked(prisma.changeOrder.findFirst).mockResolvedValueOnce(alreadyInvoiced as any);

      const result = await getProposalInvoicePreview("proj_99", "prop_101");

      expect(result.isAlreadyInvoiced).toBe(true);
      expect(result.existingInvoice?.paypalInvoiceId).toBe("INV2-ALREADY-EXISTS");
    });

    it("returns ineligible result for non-accepted proposal", async () => {
      const draftProposal = { ...mockProposal, status: "DRAFT" };
      vi.mocked(prisma.changeOrder.findFirst).mockResolvedValueOnce(draftProposal as any);

      const result = await getProposalInvoicePreview("proj_99", "prop_101");

      expect(result.eligible).toBe(false);
      expect(result.reason).toContain("Only proposals in \"CLIENT_ACCEPTED\" status");
    });
  });

  describe("createAndSendProposalInvoice", () => {
    it("orchestrates draft creation, sending, persistence, and audit logging", async () => {
      vi.mocked(prisma.changeOrder.findFirst).mockResolvedValueOnce(mockProposal as any);

      const mockDraftResponse = {
        id: "INV2-MOCK-CREATED-001",
        rawStatus: "DRAFT",
        normalizedStatus: "DRAFT" as const,
        currency: "USD",
        totalAmount: "2400.00",
        recipientEmail: "accounts@globalfintech.com",
        recipientViewUrl: "https://www.sandbox.paypal.com/invoice/p/#INV2-MOCK-CREATED-001",
      };

      const mockSendResponse = {
        invoiceId: "INV2-MOCK-CREATED-001",
        status: "SENT" as const,
        rawStatus: "SENT",
        recipientViewUrl: "https://www.sandbox.paypal.com/invoice/p/#INV2-MOCK-CREATED-001",
      };

      vi.spyOn(invoicing, "createDraftInvoice").mockResolvedValueOnce(mockDraftResponse);
      vi.spyOn(invoicing, "sendInvoice").mockResolvedValueOnce(mockSendResponse);

      const mockPersistedInvoice = {
        id: "local_inv_001",
        projectId: "proj_99",
        changeOrderId: "prop_101",
        paypalInvoiceId: "INV2-MOCK-CREATED-001",
        status: "SENT",
        currency: "USD",
        amount: { toString: () => "2400.00" },
        hostedInvoiceUrl: "https://www.sandbox.paypal.com/invoice/p/#INV2-MOCK-CREATED-001",
        sentAt: new Date(),
        lastReconciledAt: new Date(),
      };

      vi.mocked(prisma.payPalInvoice.create).mockResolvedValueOnce(mockPersistedInvoice as any);
      vi.mocked(prisma.projectEvent.create).mockResolvedValueOnce({} as any);

      const result = await createAndSendProposalInvoice("proj_99", "prop_101");

      expect(result.success).toBe(true);
      expect(result.invoice?.paypalInvoiceId).toBe("INV2-MOCK-CREATED-001");
      expect(result.invoice?.status).toBe("SENT");
      expect(invoicing.createDraftInvoice).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientEmail: "accounts@globalfintech.com",
          amount: "2400.00",
          currency: "USD",
        }),
        undefined
      );
      expect(invoicing.sendInvoice).toHaveBeenCalledWith(
        "INV2-MOCK-CREATED-001",
        { sendToRecipient: true },
        undefined
      );
      expect(prisma.payPalInvoice.create).toHaveBeenCalled();
      expect(prisma.projectEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            actorType: "PROVIDER",
            eventType: "PAYPAL_INVOICE_SENT",
          }),
        })
      );
    });

    it("prevents duplicate creation if invoice already exists", async () => {
      const existingInv = {
        id: "local_inv_existing",
        paypalInvoiceId: "INV2-ALREADY-ACTIVE",
        status: "SENT",
        amount: "2400.00",
        currency: "USD",
        hostedInvoiceUrl: "https://paypal.com/inv",
        sentAt: new Date(),
      };

      const alreadyInvoiced = {
        ...mockProposal,
        invoices: [existingInv],
      };

      vi.mocked(prisma.changeOrder.findFirst).mockResolvedValueOnce(alreadyInvoiced as any);
      const draftSpy = vi.spyOn(invoicing, "createDraftInvoice");

      const result = await createAndSendProposalInvoice("proj_99", "prop_101");

      expect(result.success).toBe(true);
      expect(result.alreadyExisted).toBe(true);
      expect(result.invoice?.paypalInvoiceId).toBe("INV2-ALREADY-ACTIVE");
      expect(draftSpy).not.toHaveBeenCalled();
    });
  });

  describe("getProposalInvoice", () => {
    it("returns stored active invoice for proposal", async () => {
      const mockRecord = {
        id: "rec_1",
        projectId: "proj_99",
        changeOrderId: "prop_101",
        paypalInvoiceId: "INV2-GET-TEST",
        status: "SENT",
        currency: "USD",
        amount: { toString: () => "2400.00" },
        hostedInvoiceUrl: "https://sandbox.paypal.com/inv",
      };

      vi.mocked(prisma.payPalInvoice.findFirst).mockResolvedValueOnce(mockRecord as any);

      const result = await getProposalInvoice("proj_99", "prop_101");
      expect(result?.paypalInvoiceId).toBe("INV2-GET-TEST");
      expect(result?.amount).toBe("2400.00");
    });
  });

  describe("syncProposalInvoiceStatus", () => {
    it("fetches updated status from PayPal and updates local record", async () => {
      const storedRecord = {
        id: "rec_sync",
        projectId: "proj_99",
        changeOrderId: "prop_101",
        paypalInvoiceId: "INV2-SYNC-TEST",
        status: "SENT",
        currency: "USD",
        amount: { toString: () => "2400.00" },
        hostedInvoiceUrl: "https://sandbox.paypal.com/inv",
      };

      vi.mocked(prisma.payPalInvoice.findFirst).mockResolvedValueOnce(storedRecord as any);

      const mockGetSummary = {
        id: "INV2-SYNC-TEST",
        rawStatus: "PAID",
        normalizedStatus: "PAID" as const,
        currency: "USD",
        totalAmount: "2400.00",
        recipientViewUrl: "https://sandbox.paypal.com/inv/paid",
      };

      vi.spyOn(invoicing, "getInvoice").mockResolvedValueOnce(mockGetSummary);

      const updatedRecord = {
        ...storedRecord,
        status: "PAID",
        hostedInvoiceUrl: "https://sandbox.paypal.com/inv/paid",
        amount: { toString: () => "2400.00" },
      };

      vi.mocked(prisma.payPalInvoice.update).mockResolvedValueOnce(updatedRecord as any);
      vi.mocked(prisma.projectEvent.create).mockResolvedValueOnce({} as any);

      const result = await syncProposalInvoiceStatus("proj_99", "prop_101");

      expect(result.success).toBe(true);
      expect(result.invoice?.status).toBe("PAID");
      expect(result.rawStatus).toBe("PAID");
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
            actorType: "PAYPAL",
            eventType: "PAYPAL_INVOICE_STATUS_UPDATED",
          }),
        })
      );
    });
  });
});

