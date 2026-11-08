/**
 * Scope Drift Radar — Commercial Scope & Revenue Intelligence Engine.
 *
 * Computes global scope drift metrics, a 6-stage currency-grouped commercial value pipeline,
 * per-project scope intelligence rows, and state-backed scope drift alerts using
 * decimal-safe integer-cent arithmetic.
 */

import { formatCurrency } from "@/lib/pricing/calculator";
import type {
  CurrencyCommercialPipeline,
  ProjectScopeIntelligence,
  ScopeDriftAlert,
  ScopeDriftFilterInput,
  ScopeDriftGlobalMetrics,
  ScopeDriftRadarData,
} from "./types";

function toCents(val: unknown): number {
  if (val === null || val === undefined) return 0;
  const num = Number((val as { toString?: () => string })?.toString?.() ?? val);
  if (!Number.isFinite(num)) return 0;
  return Math.round(num * 100);
}

function fromCents(cents: number): number {
  return Math.round(cents) / 100;
}

function isWithinDateRange(
  dateInput: Date | string | null | undefined,
  dateRange?: "ALL" | "7D" | "30D" | "90D",
  referenceNow: number = Date.now()
): boolean {
  if (!dateRange || dateRange === "ALL") return true;
  if (!dateInput) return true;
  const ts = new Date(dateInput).getTime();
  if (!Number.isFinite(ts)) return true;

  const days = dateRange === "7D" ? 7 : dateRange === "30D" ? 30 : 90;
  const cutoff = referenceNow - days * 24 * 60 * 60 * 1000;
  return ts >= cutoff;
}

function ensureCurrencyPipeline(
  map: Record<string, {
    proposedCents: number;
    approvedCents: number;
    acceptedCents: number;
    invoicedCents: number;
    collectedCents: number;
    outstandingCents: number;
  }>,
  currency: string
) {
  const norm = (currency || "USD").trim().toUpperCase();
  if (!map[norm]) {
    map[norm] = {
      proposedCents: 0,
      approvedCents: 0,
      acceptedCents: 0,
      invoicedCents: 0,
      collectedCents: 0,
      outstandingCents: 0,
    };
  }
  return map[norm];
}

/**
 * Extracts paid and outstanding cents from an invoice record.
 */
function computeInvoiceSettlementCents(inv: any): {
  invoicedCents: number;
  collectedCents: number;
  outstandingCents: number;
  isBillable: boolean;
} {
  const status = (inv?.status || "UNKNOWN").trim().toUpperCase();
  if (status === "DRAFT" || status === "CANCELLED" || status === "REFUNDED") {
    return { invoicedCents: 0, collectedCents: 0, outstandingCents: 0, isBillable: false };
  }

  const amountCents = toCents(inv.amount);

  if (status === "PAID") {
    return {
      invoicedCents: amountCents,
      collectedCents: amountCents,
      outstandingCents: 0,
      isBillable: true,
    };
  }

  if (status === "PARTIALLY_PAID") {
    const rawPaid = inv.paidAmount !== undefined && inv.paidAmount !== null ? Number(inv.paidAmount) : null;
    const rawDue = inv.dueAmount !== undefined && inv.dueAmount !== null ? Number(inv.dueAmount) : null;

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

    return {
      invoicedCents: amountCents,
      collectedCents: paidCents,
      outstandingCents: dueCents,
      isBillable: true,
    };
  }

  // SENT, PAYMENT_PENDING, UNPAID, etc.
  return {
    invoicedCents: amountCents,
    collectedCents: 0,
    outstandingCents: amountCents,
    isBillable: true,
  };
}

/**
 * Computes the complete Scope Drift Radar commercial intelligence report from persisted project graphs.
 */
export function computeScopeDriftRadar(
  projects: any[],
  filters: ScopeDriftFilterInput = {},
  referenceNow: number = Date.now()
): ScopeDriftRadarData {
  const safeProjects = Array.isArray(projects) ? projects : [];

  const filteredProjects = safeProjects.filter((p) => {
    if (!p) return false;
    if (filters.projectId && filters.projectId !== "ALL" && p.id !== filters.projectId) {
      return false;
    }
    return true;
  });

  const globalMetrics: ScopeDriftGlobalMetrics = {
    activeEngagementsCount: 0,
    totalChangeRequestsCount: 0,
    inScopeCount: 0,
    outOfScopeCount: 0,
    ambiguousCount: 0,
    pendingProposalsCount: 0,
    providerApprovedProposalsCount: 0,
    clientAcceptedProposalsCount: 0,
  };

  const currencyCentsMap: Record<
    string,
    {
      proposedCents: number;
      approvedCents: number;
      acceptedCents: number;
      invoicedCents: number;
      collectedCents: number;
      outstandingCents: number;
    }
  > = {};

  const projectIntelligence: ProjectScopeIntelligence[] = [];
  const driftAlerts: ScopeDriftAlert[] = [];

  for (const project of filteredProjects) {
    const projectId = project.id;
    const projectName = project.name || "Untitled Project";
    const clientName = project.clientName || "Client";
    const projectCurrency = (project.currency || "USD").trim().toUpperCase();
    const projectStatus = (project.status || "ACTIVE").trim().toUpperCase();

    if (projectStatus === "ACTIVE") {
      globalMetrics.activeEngagementsCount += 1;
    }

    // Determine confirmed baseline deliverables count
    const baselines = Array.isArray(project.baselines) ? project.baselines : [];
    const confirmedBaselines = baselines
      .filter((b: any) => b && (b.confirmedAt !== null && b.confirmedAt !== undefined))
      .sort((a: any, b: any) => (b.version || 0) - (a.version || 0));

    const latestConfirmedBaseline = confirmedBaselines[0] || null;
    const hasConfirmedBaseline = Boolean(latestConfirmedBaseline);
    const structuredScope = (latestConfirmedBaseline?.structuredScope as any) || null;
    const baselineDeliverablesCount = Array.isArray(structuredScope?.deliverables)
      ? structuredScope.deliverables.length
      : 0;

    // Filter change requests
    const allRequests = Array.isArray(project.requests) ? project.requests : [];
    const matchingRequests = allRequests.filter((req: any) => {
      if (!req) return false;
      if (!isWithinDateRange(req.createdAt, filters.dateRange, referenceNow)) return false;
      const cls = (req.classification || "").trim().toUpperCase();
      if (filters.classification && filters.classification !== "ALL" && cls !== filters.classification) {
        return false;
      }
      return true;
    });

    // Filter proposals (ChangeOrders)
    const allProposals = Array.isArray(project.changeOrders) ? project.changeOrders : [];
    const matchingProposals = allProposals.filter((prop: any) => {
      if (!prop) return false;
      if (!isWithinDateRange(prop.createdAt, filters.dateRange, referenceNow)) return false;
      const pStatus = (prop.status || "").trim().toUpperCase();
      if (filters.proposalStatus && filters.proposalStatus !== "ALL") {
        if (filters.proposalStatus === "APPROVED") {
          if (pStatus !== "APPROVED" && pStatus !== "PROVIDER_APPROVED") return false;
        } else if (pStatus !== filters.proposalStatus) {
          return false;
        }
      }
      return true;
    });

    // Filter invoices
    const allInvoices = Array.isArray(project.invoices) ? project.invoices : [];
    const matchingInvoices = allInvoices.filter((inv: any) => {
      if (!inv) return false;
      if (!isWithinDateRange(inv.createdAt, filters.dateRange, referenceNow)) return false;
      const iStatus = (inv.status || "").trim().toUpperCase();
      if (filters.invoiceStatus && filters.invoiceStatus !== "ALL") {
        if (filters.invoiceStatus === "UNPAID") {
          if (iStatus !== "SENT" && iStatus !== "PARTIALLY_PAID" && iStatus !== "UNPAID" && iStatus !== "PAYMENT_PENDING") {
            return false;
          }
        } else if (iStatus !== filters.invoiceStatus) {
          return false;
        }
      }
      return true;
    });

    // Build set of changeRequestIds that have at least one non-withdrawn proposal
    const requestIdsWithActiveProposal = new Set<string>();
    for (const prop of allProposals) {
      const pStatus = (prop?.status || "").trim().toUpperCase();
      if (pStatus !== "WITHDRAWN" && prop?.changeRequestId) {
        requestIdsWithActiveProposal.add(prop.changeRequestId);
      }
    }

    let projInScope = 0;
    let projOutOfScope = 0;
    let projAmbiguous = 0;
    let projUnresolvedRequests = 0;

    for (const req of matchingRequests) {
      const cls = (req.classification || "").trim().toUpperCase();
      globalMetrics.totalChangeRequestsCount += 1;

      if (cls === "IN_SCOPE") {
        projInScope += 1;
        globalMetrics.inScopeCount += 1;
      } else if (cls === "OUT_OF_SCOPE") {
        projOutOfScope += 1;
        globalMetrics.outOfScopeCount += 1;
      } else {
        projAmbiguous += 1;
        globalMetrics.ambiguousCount += 1;
      }

      const analysis = (req.analysis as any) || {};
      const reviewStatus = (analysis.reviewStatus || "PENDING_REVIEW").toUpperCase();
      const hasProposal = requestIdsWithActiveProposal.has(req.id);
      const snippet = req.sourceText
        ? req.sourceText.length > 60
          ? `${req.sourceText.slice(0, 60)}...`
          : req.sourceText
        : "Change request";

      // Check unresolved status and generate request-level alerts
      if (cls === "OUT_OF_SCOPE" && !hasProposal) {
        projUnresolvedRequests += 1;
        driftAlerts.push({
          id: `drift_oos_${req.id}`,
          type: "OUT_OF_SCOPE_WITHOUT_PROPOSAL",
          severity: "HIGH",
          title: "Out-of-Scope Request Without Commercial Proposal",
          description: `"${snippet}" was classified as OUT_OF_SCOPE in ${projectName}, but no commercial proposal has been generated.`,
          rationale: "Delivering out-of-scope work without a priced change order causes direct revenue leakage.",
          projectId,
          projectName,
          resourceId: req.id,
          href: `/projects/${projectId}/requests`,
        });
      } else if (cls === "AMBIGUOUS" && reviewStatus !== "REVIEWED" && !hasProposal) {
        projUnresolvedRequests += 1;
        driftAlerts.push({
          id: `drift_amb_${req.id}`,
          type: "AMBIGUOUS_REQUIRING_REVIEW",
          severity: "MEDIUM",
          title: "Ambiguous Request Requiring Provider Review",
          description: `"${snippet}" in ${projectName} has contractual ambiguity and awaits provider sign-off or clarification.`,
          rationale: "The baseline agreement is silent or ambiguous on this requirement; provider review is required before proceeding.",
          projectId,
          projectName,
          resourceId: req.id,
          href: `/projects/${projectId}/requests`,
        });
      }
    }

    if (projUnresolvedRequests >= 2) {
      driftAlerts.push({
        id: `drift_multi_unres_${projectId}`,
        type: "MULTIPLE_UNRESOLVED_CHANGE_REQUESTS",
        severity: "HIGH",
        title: `Multiple Unresolved Change Requests (${projUnresolvedRequests})`,
        description: `Project "${projectName}" has ${projUnresolvedRequests} unresolved out-of-scope or ambiguous requests accumulating.`,
        rationale: "Multiple unresolved scope changes increase commercial dispute risk and delay milestone sign-offs.",
        projectId,
        projectName,
        href: `/projects/${projectId}/requests`,
      });
    }

    // Track proposal metrics and financial pipeline
    let projPendingProposals = 0;
    let projAcceptedProposals = 0;
    let projProposedCents = 0;
    let projApprovedCents = 0;
    let projAcceptedCents = 0;

    for (const prop of matchingProposals) {
      const pStatus = (prop.status || "DRAFT").trim().toUpperCase();
      const propCurrency = (prop.currency || projectCurrency).trim().toUpperCase();
      const amountCents = toCents(prop.amount);

      // Strictly exclude SUPERSEDED and WITHDRAWN from active financial totals
      if (pStatus === "SUPERSEDED" || pStatus === "WITHDRAWN") {
        continue;
      }

      const globalBucket = ensureCurrencyPipeline(currencyCentsMap, propCurrency);

      if (pStatus === "DRAFT") {
        projPendingProposals += 1;
        globalMetrics.pendingProposalsCount += 1;
        projProposedCents += amountCents;
        globalBucket.proposedCents += amountCents;
      } else if (
        pStatus === "APPROVED" ||
        pStatus === "PROVIDER_APPROVED" ||
        pStatus === "SENT_TO_CLIENT"
      ) {
        projPendingProposals += 1;
        globalMetrics.pendingProposalsCount += 1;
        globalMetrics.providerApprovedProposalsCount += 1;

        projProposedCents += amountCents;
        projApprovedCents += amountCents;
        globalBucket.proposedCents += amountCents;
        globalBucket.approvedCents += amountCents;

        driftAlerts.push({
          id: `drift_prop_wait_${prop.id}`,
          type: "PROPOSAL_AWAITING_CLIENT_ACCEPTANCE",
          severity: "MEDIUM",
          title: `Proposal v${prop.version} Awaiting Client Acceptance`,
          description: `Approved proposal v${prop.version} (${formatCurrency(fromCents(amountCents), propCurrency)}) in ${projectName} has not yet been accepted by the client.`,
          rationale: "Provider-approved proposals do not become billable contract amendments until explicitly accepted by the client.",
          projectId,
          projectName,
          resourceId: prop.id,
          href: `/projects/${projectId}/proposals/${prop.id}`,
        });
      } else if (pStatus === "CLIENT_ACCEPTED") {
        projAcceptedProposals += 1;
        globalMetrics.providerApprovedProposalsCount += 1;
        globalMetrics.clientAcceptedProposalsCount += 1;

        projProposedCents += amountCents;
        projApprovedCents += amountCents;
        projAcceptedCents += amountCents;
        globalBucket.proposedCents += amountCents;
        globalBucket.approvedCents += amountCents;
        globalBucket.acceptedCents += amountCents;

        // Check if an active (non-cancelled) invoice exists for this accepted proposal
        const propInvoices = Array.isArray(prop.invoices)
          ? prop.invoices
          : allInvoices.filter((inv: any) => inv?.changeOrderId === prop.id);
        const activeInvoice = propInvoices.find((inv: any) => {
          const st = (inv?.status || "").trim().toUpperCase();
          return st !== "CANCELLED" && st !== "REFUNDED";
        });

        if (!activeInvoice) {
          driftAlerts.push({
            id: `drift_acc_no_inv_${prop.id}`,
            type: "ACCEPTED_PROPOSAL_WITHOUT_INVOICE",
            severity: "HIGH",
            title: `Accepted Proposal v${prop.version} Ready for PayPal Invoicing`,
            description: `Client accepted proposal v${prop.version} (${formatCurrency(fromCents(amountCents), propCurrency)}) in ${projectName}, but no PayPal invoice has been issued.`,
            rationale: "Client-accepted scope expansions should be invoiced promptly to convert agreed scope into collected cash.",
            projectId,
            projectName,
            resourceId: prop.id,
            href: `/projects/${projectId}/proposals/${prop.id}`,
          });
        }
      }
    }

    // Track invoice metrics and financial pipeline
    let projInvoicedCents = 0;
    let projCollectedCents = 0;
    let projOutstandingCents = 0;

    for (const inv of matchingInvoices) {
      const invCurrency = (inv.currency || projectCurrency).trim().toUpperCase();
      const settlement = computeInvoiceSettlementCents(inv);
      if (!settlement.isBillable) continue;

      const globalBucket = ensureCurrencyPipeline(currencyCentsMap, invCurrency);
      globalBucket.invoicedCents += settlement.invoicedCents;
      globalBucket.collectedCents += settlement.collectedCents;
      globalBucket.outstandingCents += settlement.outstandingCents;

      projInvoicedCents += settlement.invoicedCents;
      projCollectedCents += settlement.collectedCents;
      projOutstandingCents += settlement.outstandingCents;

      if (settlement.outstandingCents > 0) {
        const invStatus = (inv.status || "SENT").trim().toUpperCase();
        driftAlerts.push({
          id: `drift_inv_unpaid_${inv.id || inv.paypalInvoiceId}`,
          type: "UNPAID_OR_OVERDUE_INVOICE",
          severity: invStatus === "PARTIALLY_PAID" ? "MEDIUM" : "LOW",
          title: `PayPal Invoice ${inv.paypalInvoiceId || ""} (${invStatus})`,
          description: `Outstanding balance of ${formatCurrency(fromCents(settlement.outstandingCents), invCurrency)} on invoice in ${projectName}.`,
          rationale: "An issued invoice represents billed value, not collected cash, until settled and reconciled via PayPal.",
          projectId,
          projectName,
          resourceId: inv.id || inv.paypalInvoiceId,
          href: inv.changeOrderId
            ? `/projects/${projectId}/proposals/${inv.changeOrderId}`
            : `/projects/${projectId}/proposals`,
        });
      }
    }

    projectIntelligence.push({
      projectId,
      projectName,
      clientName,
      currency: projectCurrency,
      status: projectStatus,
      hasConfirmedBaseline,
      baselineDeliverablesCount,
      totalChangeRequests: matchingRequests.length,
      classificationDistribution: {
        inScope: projInScope,
        outOfScope: projOutOfScope,
        ambiguous: projAmbiguous,
      },
      unresolvedRequestsCount: projUnresolvedRequests,
      pendingProposalsCount: projPendingProposals,
      acceptedChangesCount: projAcceptedProposals,
      additionalProposedValue: fromCents(projProposedCents),
      formattedAdditionalProposedValue: formatCurrency(fromCents(projProposedCents), projectCurrency),
      providerApprovedValue: fromCents(projApprovedCents),
      formattedProviderApprovedValue: formatCurrency(fromCents(projApprovedCents), projectCurrency),
      additionalAcceptedValue: fromCents(projAcceptedCents),
      formattedAdditionalAcceptedValue: formatCurrency(fromCents(projAcceptedCents), projectCurrency),
      additionalInvoicedValue: fromCents(projInvoicedCents),
      formattedAdditionalInvoicedValue: formatCurrency(fromCents(projInvoicedCents), projectCurrency),
      additionalCollectedValue: fromCents(projCollectedCents),
      formattedAdditionalCollectedValue: formatCurrency(fromCents(projCollectedCents), projectCurrency),
      outstandingPayments: fromCents(projOutstandingCents),
      formattedOutstandingPayments: formatCurrency(fromCents(projOutstandingCents), projectCurrency),
      lastActivityAt: project.updatedAt
        ? new Date(project.updatedAt).toISOString()
        : new Date().toISOString(),
    });
  }

  // Build formatted currency pipeline summaries
  const pipelineByCurrency: Record<string, CurrencyCommercialPipeline> = {};
  const currencies = Object.keys(currencyCentsMap).sort();

  for (const curr of currencies) {
    const bucket = currencyCentsMap[curr];
    const proposed = fromCents(bucket.proposedCents);
    const approved = fromCents(bucket.approvedCents);
    const accepted = fromCents(bucket.acceptedCents);
    const invoiced = fromCents(bucket.invoicedCents);
    const collected = fromCents(bucket.collectedCents);
    const outstanding = fromCents(bucket.outstandingCents);

    pipelineByCurrency[curr] = {
      currency: curr,
      additionalProposedValue: proposed,
      formattedAdditionalProposedValue: formatCurrency(proposed, curr),
      providerApprovedValue: approved,
      formattedProviderApprovedValue: formatCurrency(approved, curr),
      clientAcceptedValue: accepted,
      formattedClientAcceptedValue: formatCurrency(accepted, curr),
      additionalInvoicedValue: invoiced,
      formattedAdditionalInvoicedValue: formatCurrency(invoiced, curr),
      additionalRevenueCollected: collected,
      formattedAdditionalRevenueCollected: formatCurrency(collected, curr),
      outstandingAdditionalPayments: outstanding,
      formattedOutstandingAdditionalPayments: formatCurrency(outstanding, curr),
    };
  }

  // Sort alerts by severity (HIGH -> MEDIUM -> LOW)
  const severityRank = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  driftAlerts.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);

  return {
    globalMetrics,
    pipelineByCurrency,
    currencies,
    projectIntelligence,
    driftAlerts,
  };
}

