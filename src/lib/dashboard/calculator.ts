/**
 * Dashboard Financial Aggregator & KPI Calculator.
 *
 * Implements strict decimal-safe financial calculations grouped by ISO 4217 currency.
 * Never sums across different currencies and excludes drafts and cancelled invoices.
 */

import { formatCurrency } from "@/lib/pricing/calculator";
import type { CurrencyFinancialSummary, DashboardKpis } from "./types";

interface RawInvoice {
  id?: string;
  status?: string;
  currency?: string;
  amount: number | string | { toString: () => string };
  paidAmount?: number | string | null;
  dueAmount?: number | string | null;
}

/**
 * Aggregates invoices strictly grouped by currency using integer cents to prevent rounding drift.
 */
export function aggregateFinancialsByCurrency(
  invoices: RawInvoice[]
): Record<string, CurrencyFinancialSummary> {
  const summaries: Record<string, CurrencyFinancialSummary> = {};

  if (!Array.isArray(invoices)) return summaries;

  const seenInvoiceKeys = new Set<string>();

  for (const inv of invoices) {
    if (!inv) continue;

    const dedupeKey = String((inv as any).paypalInvoiceId || inv.id || "");
    if (dedupeKey && seenInvoiceKeys.has(dedupeKey)) {
      continue;
    }
    if (dedupeKey) {
      seenInvoiceKeys.add(dedupeKey);
    }

    const status = (inv.status || "UNKNOWN").trim().toUpperCase();

    // Exclude drafts (unsent), cancelled, refunded, and unknown invoices
    if (
      status === "DRAFT" ||
      status === "CANCELLED" ||
      status === "REFUNDED" ||
      status === "UNKNOWN"
    ) {
      continue;
    }

    const currency = (inv.currency || "USD").trim().toUpperCase();
    if (!summaries[currency]) {
      summaries[currency] = {
        currency,
        totalInvoiced: 0,
        formattedTotalInvoiced: formatCurrency(0, currency),
        totalCollected: 0,
        formattedTotalCollected: formatCurrency(0, currency),
        outstandingBalance: 0,
        formattedOutstandingBalance: formatCurrency(0, currency),
        invoiceCount: 0,
        paidCount: 0,
        partiallyPaidCount: 0,
        sentCount: 0,
      };
    }

    const summary = summaries[currency];
    const rawAmountNum = Number(inv.amount?.toString?.() ?? inv.amount) || 0;
    const amountCents = Math.round(rawAmountNum * 100);

    summary.invoiceCount += 1;
    summary.totalInvoiced = Math.round((summary.totalInvoiced * 100) + amountCents) / 100;

    if (status === "PAID") {
      summary.paidCount += 1;
      summary.totalCollected = Math.round((summary.totalCollected * 100) + amountCents) / 100;
    } else if (status === "PARTIALLY_PAID") {
      summary.partiallyPaidCount += 1;

      const rawPaid = inv.paidAmount !== undefined && inv.paidAmount !== null
        ? Number(inv.paidAmount)
        : null;
      const rawDue = inv.dueAmount !== undefined && inv.dueAmount !== null
        ? Number(inv.dueAmount)
        : null;

      let paidCents = 0;
      let dueCents = 0;

      if (rawPaid !== null && Number.isFinite(rawPaid)) {
        paidCents = Math.round(rawPaid * 100);
        dueCents = rawDue !== null && Number.isFinite(rawDue)
          ? Math.round(rawDue * 100)
          : Math.max(0, amountCents - paidCents);
      } else if (rawDue !== null && Number.isFinite(rawDue)) {
        dueCents = Math.round(rawDue * 100);
        paidCents = Math.max(0, amountCents - dueCents);
      } else {
        // Fallback half if unrecorded
        paidCents = Math.round(amountCents / 2);
        dueCents = amountCents - paidCents;
      }

      summary.totalCollected = Math.round((summary.totalCollected * 100) + paidCents) / 100;
      summary.outstandingBalance = Math.round((summary.outstandingBalance * 100) + dueCents) / 100;
    } else {
      // SENT, PAYMENT_PENDING, UNPAID, etc.
      summary.sentCount += 1;
      summary.outstandingBalance = Math.round((summary.outstandingBalance * 100) + amountCents) / 100;
    }

    // Refresh formatted strings
    summary.formattedTotalInvoiced = formatCurrency(summary.totalInvoiced, currency);
    summary.formattedTotalCollected = formatCurrency(summary.totalCollected, currency);
    summary.formattedOutstandingBalance = formatCurrency(summary.outstandingBalance, currency);
  }

  return summaries;
}

/**
 * Calculates executive KPI metrics from persisted project, proposal, and invoice models.
 */
export function calculateDashboardKpis(
  projects: Array<{
    id: string;
    status: string;
    changeOrders?: Array<{ status: string }>;
    invoices?: Array<{ status: string }>;
  }>
): DashboardKpis {
  if (!Array.isArray(projects)) {
    return {
      activeProjectsCount: 0,
      pendingApprovalsCount: 0,
      outstandingInvoicesCount: 0,
      totalProjectsCount: 0,
    };
  }

  let activeProjectsCount = 0;
  let pendingApprovalsCount = 0;
  let outstandingInvoicesCount = 0;

  for (const project of projects) {
    const isProjActive = (project.status || "").toUpperCase() === "ACTIVE";
    if (isProjActive) {
      activeProjectsCount += 1;
    }

    if (isProjActive && Array.isArray(project.changeOrders)) {
      for (const proposal of project.changeOrders) {
        const pStatus = (proposal.status || "").toUpperCase();
        if (pStatus === "SENT_TO_CLIENT" || pStatus === "APPROVED") {
          pendingApprovalsCount += 1;
        }
      }
    }

    if (isProjActive && Array.isArray(project.invoices)) {
      for (const invoice of project.invoices) {
        const iStatus = (invoice.status || "").toUpperCase();
        if (
          iStatus === "SENT" ||
          iStatus === "PARTIALLY_PAID" ||
          iStatus === "PAYMENT_PENDING" ||
          iStatus === "UNPAID" ||
          iStatus === "OVERDUE" ||
          iStatus === "MARKED_AS_UNPAID"
        ) {
          outstandingInvoicesCount += 1;
        }
      }
    }
  }

  return {
    activeProjectsCount,
    pendingApprovalsCount,
    outstandingInvoicesCount,
    totalProjectsCount: projects.length,
  };
}

