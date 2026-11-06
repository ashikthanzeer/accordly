import { describe, it, expect } from "vitest";
import {
  validateInvoiceEligibility,
  mapProposalToPayPalInvoice,
} from "../mapper";
import { validateCreateInvoiceInput, ValidationError } from "../validation";

describe("Proposal-to-Invoice Eligibility & Mapping", () => {
  const mockProject = {
    id: "proj_123",
    name: "E-Commerce Checkout Revamp",
    clientName: "Acme Retail Corp",
    clientEmail: "billing@acmeretail.com",
  };

  const mockAcceptedProposal = {
    id: "prop_456",
    projectId: "proj_123",
    version: 1,
    status: "CLIENT_ACCEPTED",
    amount: "1500.00",
    currency: "USD",
    description: "Scope expansion for multi-currency checkout",
    deliverables: {
      pricing: {
        model: "ITEMIZED",
        currency: "USD",
        total: 1500,
        lineItems: [
          {
            id: "li_1",
            description: "Frontend checkout flow updates",
            quantity: 10,
            unitPrice: 100,
            subtotal: 1000,
            currency: "USD",
          },
          {
            id: "li_2",
            description: "Currency converter API integration",
            quantity: 5,
            unitPrice: 100,
            subtotal: 500,
            currency: "USD",
          },
        ],
      },
    },
    invoices: [],
  };

  describe("validateInvoiceEligibility", () => {
    it("approves an accepted proposal with valid client email and positive amount", () => {
      const result = validateInvoiceEligibility(mockAcceptedProposal, mockProject);
      expect(result.eligible).toBe(true);
      expect(result.isAlreadyInvoiced).toBeFalsy();
    });

    it("rejects proposals not in CLIENT_ACCEPTED status", () => {
      const draftResult = validateInvoiceEligibility(
        { ...mockAcceptedProposal, status: "DRAFT" },
        mockProject
      );
      expect(draftResult.eligible).toBe(false);
      expect(draftResult.reason).toContain("Only proposals in \"CLIENT_ACCEPTED\" status");

      const approvedResult = validateInvoiceEligibility(
        { ...mockAcceptedProposal, status: "APPROVED" },
        mockProject
      );
      expect(approvedResult.eligible).toBe(false);

      const rejectedResult = validateInvoiceEligibility(
        { ...mockAcceptedProposal, status: "CLIENT_REJECTED" },
        mockProject
      );
      expect(rejectedResult.eligible).toBe(false);
    });

    it("rejects proposal if project lacks client email", () => {
      const noEmailProject = { ...mockProject, clientEmail: "" };
      const result = validateInvoiceEligibility(mockAcceptedProposal, noEmailProject);
      expect(result.eligible).toBe(false);
      expect(result.reason).toContain("valid client email address");
    });

    it("rejects proposal if amount is zero or negative", () => {
      const zeroAmount = { ...mockAcceptedProposal, amount: "0.00" };
      const result = validateInvoiceEligibility(zeroAmount, mockProject);
      expect(result.eligible).toBe(false);
      expect(result.reason).toContain("greater than zero");
    });

    it("detects existing active invoice and marks isAlreadyInvoiced: true", () => {
      const invoicedProposal = {
        ...mockAcceptedProposal,
        invoices: [
          {
            id: "inv_local_1",
            paypalInvoiceId: "INV2-TEST-123",
            status: "SENT",
            amount: 1500,
            currency: "USD",
            hostedInvoiceUrl: "https://www.sandbox.paypal.com/invoice/p/#INV2-TEST-123",
            sentAt: new Date("2026-11-06T12:00:00Z"),
          },
        ],
      };

      const result = validateInvoiceEligibility(invoicedProposal, mockProject);
      expect(result.eligible).toBe(false);
      expect(result.isAlreadyInvoiced).toBe(true);
      expect(result.existingInvoice).toBeDefined();
      expect(result.existingInvoice?.paypalInvoiceId).toBe("INV2-TEST-123");
      expect(result.existingInvoice?.status).toBe("SENT");
    });

    it("allows invoicing if prior invoice was CANCELLED", () => {
      const cancelledInvoiceProposal = {
        ...mockAcceptedProposal,
        invoices: [
          {
            id: "inv_local_cancelled",
            paypalInvoiceId: "INV2-CANCELLED-999",
            status: "CANCELLED",
            amount: 1500,
            currency: "USD",
          },
        ],
      };

      const result = validateInvoiceEligibility(cancelledInvoiceProposal, mockProject);
      expect(result.eligible).toBe(true);
      expect(result.isAlreadyInvoiced).toBeFalsy();
    });
  });

  describe("mapProposalToPayPalInvoice", () => {
    it("maps itemized proposal into structured PayPal invoice input and preview", () => {
      const { input, preview } = mapProposalToPayPalInvoice(
        mockAcceptedProposal,
        mockProject
      );

      expect(input.recipientEmail).toBe("billing@acmeretail.com");
      expect(input.currency).toBe("USD");
      expect(input.amount).toBe("1500.00");
      expect(input.idempotencyKey).toBe("accordly_inv_prop_456_v1");
      expect(input.items).toHaveLength(2);
      expect(input.items?.[0]).toEqual({
        name: "Frontend checkout flow updates",
        description: "Frontend checkout flow updates",
        quantity: 10,
        unitAmount: "100.00",
        currency: "USD",
        unitOfMeasure: "QUANTITY",
      });
      expect(input.items?.[1]).toEqual({
        name: "Currency converter API integration",
        description: "Currency converter API integration",
        quantity: 5,
        unitAmount: "100.00",
        currency: "USD",
        unitOfMeasure: "QUANTITY",
      });

      expect(preview.proposalId).toBe("prop_456");
      expect(preview.totalAmount).toBe("1500.00");
      expect(preview.itemCount).toBe(2);
      expect(preview.lineItems[0].formattedSubtotal).toBe("1000.00");
      expect(preview.lineItems[1].formattedSubtotal).toBe("500.00");
    });

    it("maps fixed price proposal with single fallback line item when no line items are provided", () => {
      const fixedProposal = {
        id: "prop_fixed",
        projectId: "proj_123",
        version: 2,
        status: "CLIENT_ACCEPTED",
        amount: "2500.00",
        currency: "EUR",
        description: "Fixed architecture overhaul",
        deliverables: {},
        invoices: [],
      };

      const { input, preview } = mapProposalToPayPalInvoice(fixedProposal, mockProject);

      expect(input.currency).toBe("EUR");
      expect(input.amount).toBe("2500.00");
      expect(input.items).toHaveLength(1);
      expect(input.items?.[0].name).toBe("Fixed architecture overhaul");
      expect(input.items?.[0].quantity).toBe(1);
      expect(input.items?.[0].unitAmount).toBe("2500.00");

      expect(preview.currency).toBe("EUR");
      expect(preview.totalAmount).toBe("2500.00");
      expect(preview.lineItems).toHaveLength(1);
    });

    it("throws an error when mapping an ineligible proposal", () => {
      const unaccepted = { ...mockAcceptedProposal, status: "DRAFT" };
      expect(() => mapProposalToPayPalInvoice(unaccepted, mockProject)).toThrow(
        /Only proposals in "CLIENT_ACCEPTED" status can be invoiced/
      );
    });
  });

  describe("validateCreateInvoiceInput with line items", () => {
    it("validates line items with valid decimal amounts and quantities", () => {
      const validated = validateCreateInvoiceInput({
        recipientEmail: "client@test.com",
        description: "Custom project work",
        currency: "USD",
        amount: "300.00",
        items: [
          {
            name: "Discovery Phase",
            quantity: 2,
            unitAmount: "150.00",
          },
        ],
      });

      expect(validated.amount).toBe("300.00");
      expect(validated.items).toHaveLength(1);
      expect(validated.items?.[0].name).toBe("Discovery Phase");
      expect(validated.items?.[0].quantity).toBe("2");
      expect(validated.items?.[0].unitAmount).toBe("150.00");
    });

    it("rejects line items with invalid quantity or empty name", () => {
      expect(() =>
        validateCreateInvoiceInput({
          recipientEmail: "client@test.com",
          description: "Custom work",
          currency: "USD",
          amount: "100.00",
          items: [
            {
              name: "",
              quantity: 1,
              unitAmount: "100.00",
            },
          ],
        })
      ).toThrow(ValidationError);

      expect(() =>
        validateCreateInvoiceInput({
          recipientEmail: "client@test.com",
          description: "Custom work",
          currency: "USD",
          amount: "100.00",
          items: [
            {
              name: "Valid name",
              quantity: 0,
              unitAmount: "100.00",
            },
          ],
        })
      ).toThrow(ValidationError);
    });
  });
});

