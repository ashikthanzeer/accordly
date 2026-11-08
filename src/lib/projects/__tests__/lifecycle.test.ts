import { describe, it, expect } from "vitest";
import {
  getProjectFinancialSummary,
  isProjectArchived,
  assertProjectActive,
  ProjectArchivedError,
} from "../lifecycle";

describe("Project Lifecycle & Financial Activity Service (src/lib/projects/lifecycle.ts)", () => {
  it("correctly identifies active vs archived project statuses", () => {
    expect(isProjectArchived("ACTIVE")).toBe(false);
    expect(isProjectArchived("active")).toBe(false);
    expect(isProjectArchived(null)).toBe(false);
    expect(isProjectArchived(undefined)).toBe(false);

    expect(isProjectArchived("ARCHIVED")).toBe(true);
    expect(isProjectArchived("archived")).toBe(true);
    expect(isProjectArchived(" ARCHIVED ")).toBe(true);

    expect(() => assertProjectActive({ id: "p1", status: "ACTIVE" })).not.toThrow();
    expect(() => assertProjectActive({ id: "p2", status: "ARCHIVED", name: "Redesign" })).toThrow(
      ProjectArchivedError
    );
  });

  it("returns hasPaymentActivity: false for project with no invoices or only draft invoices", () => {
    const emptyProj = { id: "p_empty", currency: "USD", invoices: [] };
    const emptySummary = getProjectFinancialSummary(emptyProj);

    expect(emptySummary.hasPaymentActivity).toBe(false);
    expect(emptySummary.totalInvoiced).toBe(0);
    expect(emptySummary.totalCollected).toBe(0);
    expect(emptySummary.totalOutstanding).toBe(0);
    expect(emptySummary.currencies).toEqual([]);

    const draftProj = {
      id: "p_draft",
      currency: "USD",
      invoices: [
        {
          id: "inv_d1",
          paypalInvoiceId: "INV2-DRAFT",
          status: "DRAFT",
          amount: "1500.00",
        },
      ],
    };
    const draftSummary = getProjectFinancialSummary(draftProj);
    expect(draftSummary.hasPaymentActivity).toBe(false);
    expect(draftSummary.totalInvoiced).toBe(0);
  });

  it("returns hasPaymentActivity: false for sent but unpaid invoices (money not yet received)", () => {
    const sentProj = {
      id: "p_sent",
      currency: "USD",
      invoices: [
        {
          id: "inv_s1",
          paypalInvoiceId: "INV2-SENT",
          status: "SENT",
          amount: "2500.00",
          currency: "USD",
        },
        {
          id: "inv_ov",
          paypalInvoiceId: "INV2-OVERDUE",
          status: "OVERDUE",
          amount: "1000.00",
          currency: "USD",
        },
      ],
    };
    const sentSummary = getProjectFinancialSummary(sentProj);
    expect(sentSummary.hasPaymentActivity).toBe(false);
    expect(sentSummary.totalInvoiced).toBe(3500);
    expect(sentSummary.totalCollected).toBe(0);
    expect(sentSummary.totalOutstanding).toBe(3500);
  });

  it("returns hasPaymentActivity: true for fully PAID invoice", () => {
    const paidProj = {
      id: "p_paid",
      currency: "USD",
      invoices: [
        {
          id: "inv_p1",
          paypalInvoiceId: "INV2-PAID",
          status: "PAID",
          amount: "4000.00",
          currency: "USD",
        },
      ],
    };
    const paidSummary = getProjectFinancialSummary(paidProj);
    expect(paidSummary.hasPaymentActivity).toBe(true);
    expect(paidSummary.totalInvoiced).toBe(4000);
    expect(paidSummary.totalCollected).toBe(4000);
    expect(paidSummary.totalOutstanding).toBe(0);
  });

  it("returns hasPaymentActivity: true for PARTIALLY_PAID invoice with positive paidAmount", () => {
    const partialProj = {
      id: "p_partial",
      currency: "USD",
      invoices: [
        {
          id: "inv_part",
          paypalInvoiceId: "INV2-PARTIAL",
          status: "PARTIALLY_PAID",
          amount: "3000.00",
          paidAmount: 1200,
          dueAmount: 1800,
          currency: "USD",
        },
      ],
    };
    const partialSummary = getProjectFinancialSummary(partialProj);
    expect(partialSummary.hasPaymentActivity).toBe(true);
    expect(partialSummary.totalInvoiced).toBe(3000);
    expect(partialSummary.totalCollected).toBe(1200);
    expect(partialSummary.totalOutstanding).toBe(1800);
  });

  it("excludes CANCELLED invoices and deduplicates identical invoice IDs", () => {
    const mixedProj = {
      id: "p_mix",
      currency: "USD",
      invoices: [
        {
          id: "inv_canc",
          paypalInvoiceId: "INV2-CANC",
          status: "CANCELLED",
          amount: "9999.00",
          currency: "USD",
        },
        {
          id: "inv_dup_1",
          paypalInvoiceId: "INV2-PAID-DUP",
          status: "PAID",
          amount: "2000.00",
          currency: "USD",
        },
        {
          id: "inv_dup_2",
          paypalInvoiceId: "INV2-PAID-DUP",
          status: "PAID",
          amount: "2000.00",
          currency: "USD",
        },
      ],
    };
    const summary = getProjectFinancialSummary(mixedProj);
    expect(summary.hasPaymentActivity).toBe(true);
    expect(summary.totalInvoiced).toBe(2000);
    expect(summary.totalCollected).toBe(2000);
    expect(summary.totalOutstanding).toBe(0);
  });

  it("groups multi-currency financials strictly by ISO currency without combining them", () => {
    const multiProj = {
      id: "p_multi",
      currency: "USD",
      invoices: [
        {
          id: "inv_usd",
          paypalInvoiceId: "INV2-USD-1",
          status: "PAID",
          amount: "1500.00",
          currency: "USD",
        },
        {
          id: "inv_eur",
          paypalInvoiceId: "INV2-EUR-1",
          status: "SENT",
          amount: "2000.00",
          currency: "EUR",
        },
      ],
    };
    const summary = getProjectFinancialSummary(multiProj);
    expect(summary.hasPaymentActivity).toBe(true);
    expect(summary.currencies).toEqual(["EUR", "USD"]);

    // USD summary
    expect(summary.byCurrency["USD"]).toEqual({
      currency: "USD",
      totalInvoiced: 1500,
      formattedTotalInvoiced: "$1,500.00",
      totalCollected: 1500,
      formattedTotalCollected: "$1,500.00",
      totalOutstanding: 0,
      formattedTotalOutstanding: "$0.00",
      invoiceCount: 1,
      paidCount: 1,
    });

    // EUR summary
    expect(summary.byCurrency["EUR"]).toEqual({
      currency: "EUR",
      totalInvoiced: 2000,
      formattedTotalInvoiced: "€2,000.00",
      totalCollected: 0,
      formattedTotalCollected: "€0.00",
      totalOutstanding: 2000,
      formattedTotalOutstanding: "€2,000.00",
      invoiceCount: 1,
      paidCount: 0,
    });

    // Root summary defaults to primaryCurrency (USD)
    expect(summary.totalInvoiced).toBe(1500);
    expect(summary.totalCollected).toBe(1500);
    expect(summary.totalOutstanding).toBe(0);
  });
});

