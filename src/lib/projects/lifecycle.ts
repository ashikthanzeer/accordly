/**
 * Project Lifecycle & Financial Activity Service.
 *
 * Implements deterministic lifecycle state transitions (ACTIVE <-> ARCHIVED),
 * authoritative payment-activity detection, multi-currency financial aggregation,
 * and archived project mutation protection.
 */

import { NextResponse } from "next/server";
import { formatCurrency } from "@/lib/pricing/calculator";
import type {
  ProjectFinancialSummary,
  ProjectFinancialCurrencySummary,
} from "./schema";

export class ProjectArchivedError extends Error {
  statusCode: number = 409;
  projectId: string;

  constructor(projectId: string, projectName?: string) {
    super(
      `Project "${projectName || projectId}" is archived and cannot receive new commercial modifications.`
    );
    this.name = "ProjectArchivedError";
    this.projectId = projectId;
  }
}

/**
 * Checks whether a project status indicates the project is archived.
 */
export function isProjectArchived(status?: string | null): boolean {
  return (status || "").trim().toUpperCase() === "ARCHIVED";
}

/**
 * Generates a standard HTTP 409 Conflict response for attempted mutations on archived projects.
 */
export function projectArchivedResponse(
  correlationId: string,
  projectId: string,
  projectName?: string
): NextResponse {
  return NextResponse.json(
    {
      error: `Project "${projectName || projectId}" is archived and cannot receive new commercial modifications. Please restore the project first if you wish to continue active commercial work.`,
      code: "PROJECT_ARCHIVED",
      projectId,
      correlationId,
    },
    { status: 409 }
  );
}

/**
 * Asserts that a project is ACTIVE. Throws ProjectArchivedError if ARCHIVED.
 */
export function assertProjectActive(project: {
  id: string;
  name?: string;
  status?: string | null;
}): void {
  if (isProjectArchived(project.status)) {
    throw new ProjectArchivedError(project.id, project.name);
  }
}

/**
 * Deterministically computes the financial activity summary of a project from authoritative persisted records.
 * Multi-currency values are grouped strictly by ISO currency code using decimal-safe integer-cent math.
 */
export function getProjectFinancialSummary(project: {
  id?: string;
  currency?: string | null;
  invoices?: any[] | null;
}): ProjectFinancialSummary {
  const primaryCurrency = (project.currency || "USD").trim().toUpperCase();
  const rawInvoices = Array.isArray(project.invoices) ? project.invoices : [];

  // Deduplicate invoices by paypalInvoiceId or id
  const seenKeys = new Set<string>();
  const invoices: any[] = [];
  for (const inv of rawInvoices) {
    if (!inv) continue;
    const key = String(inv.paypalInvoiceId || inv.id || "");
    if (key && seenKeys.has(key)) continue;
    if (key) seenKeys.add(key);
    invoices.push(inv);
  }

  let hasPaymentActivity = false;

  const centsByCurrency: Record<
    string,
    {
      invoicedCents: number;
      collectedCents: number;
      outstandingCents: number;
      invoiceCount: number;
      paidCount: number;
    }
  > = {};

  for (const inv of invoices) {
    const status = (inv.status || "UNKNOWN").trim().toUpperCase();
    const invCurrency = (inv.currency || primaryCurrency).trim().toUpperCase();

    // Check payment activity: authoritative proof of received money
    const rawPaid = inv.paidAmount !== undefined && inv.paidAmount !== null
      ? Number(inv.paidAmount)
      : null;

    if (status === "PAID") {
      hasPaymentActivity = true;
    } else if (status === "PARTIALLY_PAID" && rawPaid !== null && rawPaid > 0) {
      hasPaymentActivity = true;
    }

    // Exclude drafts, cancelled, refunded, and unknown from active financial calculations
    if (
      status === "DRAFT" ||
      status === "CANCELLED" ||
      status === "REFUNDED" ||
      status === "UNKNOWN"
    ) {
      continue;
    }

    if (!centsByCurrency[invCurrency]) {
      centsByCurrency[invCurrency] = {
        invoicedCents: 0,
        collectedCents: 0,
        outstandingCents: 0,
        invoiceCount: 0,
        paidCount: 0,
      };
    }

    const bucket = centsByCurrency[invCurrency];
    const rawAmount = Number(inv.amount?.toString?.() ?? inv.amount) || 0;
    const amountCents = Math.round(rawAmount * 100);

    bucket.invoiceCount += 1;
    bucket.invoicedCents += amountCents;

    if (status === "PAID") {
      bucket.paidCount += 1;
      bucket.collectedCents += amountCents;
    } else if (status === "PARTIALLY_PAID") {
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
        paidCents = Math.round(amountCents / 2);
        dueCents = amountCents - paidCents;
      }

      bucket.collectedCents += paidCents;
      bucket.outstandingCents += dueCents;
    } else {
      // SENT, UNPAID, OVERDUE, PAYMENT_PENDING, MARKED_AS_UNPAID
      bucket.outstandingCents += amountCents;
    }
  }

  const byCurrency: Record<string, ProjectFinancialCurrencySummary> = {};
  const currencies = Object.keys(centsByCurrency).sort();

  for (const c of currencies) {
    const b = centsByCurrency[c];
    const invoiced = b.invoicedCents / 100;
    const collected = b.collectedCents / 100;
    const outstanding = b.outstandingCents / 100;

    byCurrency[c] = {
      currency: c,
      totalInvoiced: invoiced,
      formattedTotalInvoiced: formatCurrency(invoiced, c),
      totalCollected: collected,
      formattedTotalCollected: formatCurrency(collected, c),
      totalOutstanding: outstanding,
      formattedTotalOutstanding: formatCurrency(outstanding, c),
      invoiceCount: b.invoiceCount,
      paidCount: b.paidCount,
    };
  }

  // Primary currency bucket summary
  const primaryBucket = byCurrency[primaryCurrency] || {
    currency: primaryCurrency,
    totalInvoiced: 0,
    formattedTotalInvoiced: formatCurrency(0, primaryCurrency),
    totalCollected: 0,
    formattedTotalCollected: formatCurrency(0, primaryCurrency),
    totalOutstanding: 0,
    formattedTotalOutstanding: formatCurrency(0, primaryCurrency),
    invoiceCount: 0,
    paidCount: 0,
  };

  return {
    hasPaymentActivity,
    primaryCurrency,
    currencies,
    byCurrency,
    totalInvoiced: primaryBucket.totalInvoiced,
    formattedTotalInvoiced: primaryBucket.formattedTotalInvoiced,
    totalCollected: primaryBucket.totalCollected,
    formattedTotalCollected: primaryBucket.formattedTotalCollected,
    totalOutstanding: primaryBucket.totalOutstanding,
    formattedTotalOutstanding: primaryBucket.formattedTotalOutstanding,
  };
}

