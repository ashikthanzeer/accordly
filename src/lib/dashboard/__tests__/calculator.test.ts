import { describe, it, expect } from "vitest";
import {
  aggregateFinancialsByCurrency,
  calculateDashboardKpis,
} from "../calculator";
import { detectActionRequiredItems } from "../service";

describe("Dashboard Calculator & Aggregator", () => {
  describe("aggregateFinancialsByCurrency", () => {
    it("aggregates single-currency invoices with paid, sent, and partial states", () => {
      const invoices = [
        {
          id: "inv_1",
          status: "PAID",
          currency: "USD",
          amount: "1000.00",
        },
        {
          id: "inv_2",
          status: "SENT",
          currency: "USD",
          amount: "500.00",
        },
        {
          id: "inv_3",
          status: "PARTIALLY_PAID",
          currency: "USD",
          amount: "800.00",
          paidAmount: "300.00",
          dueAmount: "500.00",
        },
      ];

      const summaries = aggregateFinancialsByCurrency(invoices);

      expect(summaries["USD"]).toBeDefined();
      const usd = summaries["USD"];
      expect(usd.totalInvoiced).toBe(2300.0);
      expect(usd.totalCollected).toBe(1300.0); // 1000 + 300
      expect(usd.outstandingBalance).toBe(1000.0); // 500 + 500
      expect(usd.invoiceCount).toBe(3);
      expect(usd.paidCount).toBe(1);
      expect(usd.sentCount).toBe(1);
      expect(usd.partiallyPaidCount).toBe(1);
    });

    it("strictly isolates different currencies without cross-currency summation", () => {
      const invoices = [
        {
          id: "inv_usd",
          status: "PAID",
          currency: "USD",
          amount: "1500.00",
        },
        {
          id: "inv_eur",
          status: "SENT",
          currency: "EUR",
          amount: "2000.00",
        },
      ];

      const summaries = aggregateFinancialsByCurrency(invoices);

      expect(Object.keys(summaries)).toHaveLength(2);
      expect(summaries["USD"].totalInvoiced).toBe(1500.0);
      expect(summaries["USD"].totalCollected).toBe(1500.0);
      expect(summaries["EUR"].totalInvoiced).toBe(2000.0);
      expect(summaries["EUR"].outstandingBalance).toBe(2000.0);
      expect(summaries["EUR"].totalCollected).toBe(0.0);
    });

    it("excludes draft and cancelled invoices from receivables and revenue", () => {
      const invoices = [
        {
          id: "inv_draft",
          status: "DRAFT",
          currency: "USD",
          amount: "5000.00",
        },
        {
          id: "inv_cancelled",
          status: "CANCELLED",
          currency: "USD",
          amount: "3000.00",
        },
        {
          id: "inv_sent",
          status: "SENT",
          currency: "USD",
          amount: "1000.00",
        },
      ];

      const summaries = aggregateFinancialsByCurrency(invoices);

      expect(summaries["USD"].totalInvoiced).toBe(1000.0);
      expect(summaries["USD"].outstandingBalance).toBe(1000.0);
      expect(summaries["USD"].invoiceCount).toBe(1);
    });
  });

  describe("calculateDashboardKpis", () => {
    it("computes accurate project and proposal counts", () => {
      const projects = [
        {
          id: "p1",
          status: "ACTIVE",
          changeOrders: [
            { status: "SENT_TO_CLIENT" },
            { status: "CLIENT_ACCEPTED" },
          ],
          invoices: [{ status: "SENT" }],
        },
        {
          id: "p2",
          status: "ARCHIVED",
          changeOrders: [{ status: "APPROVED" }],
          invoices: [{ status: "PAID" }],
        },
      ];

      const kpis = calculateDashboardKpis(projects);

      expect(kpis.totalProjectsCount).toBe(2);
      expect(kpis.activeProjectsCount).toBe(1);
      expect(kpis.pendingApprovalsCount).toBe(2); // 1 SENT_TO_CLIENT + 1 APPROVED
      expect(kpis.outstandingInvoicesCount).toBe(1); // 1 SENT
    });
  });

  describe("detectActionRequiredItems", () => {
    it("flags unconfirmed baselines, unreviewed requests, and uninvoiced acceptances", () => {
      const sampleProjects = [
        {
          id: "p_action",
          name: "Mobile App Rebuild",
          baselines: [], // No confirmed baseline!
          requests: [
            {
              id: "req_1",
              title: "Add Biometric Auth",
              analysis: { reviewStatus: "PENDING" },
            },
          ],
          changeOrders: [
            {
              id: "prop_1",
              version: 1,
              status: "CLIENT_ACCEPTED",
              invoices: [], // Accepted but no invoice!
            },
            {
              id: "prop_2",
              version: 2,
              status: "APPROVED",
              reviewTokenHash: null, // Approved but not shared!
            },
          ],
          invoices: [
            {
              id: "inv_sent",
              paypalInvoiceId: "INV2-ACT-123",
              status: "SENT",
              amount: 500,
              currency: "USD",
            },
          ],
        },
      ];

      const actionItems = detectActionRequiredItems(sampleProjects);

      const types = actionItems.map((a) => a.type);
      expect(types).toContain("UNCONFIRMED_BASELINE");
      expect(types).toContain("PENDING_REQUEST_REVIEW");
      expect(types).toContain("UNSHARED_PROPOSAL");
      expect(types).toContain("UNINVOICED_ACCEPTED_PROPOSAL");
      expect(types).toContain("INVOICE_AWAITING_PAYMENT");
    });
  });
});

