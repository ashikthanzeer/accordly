/**
 * Dashboard Overview Service & Action-Required Detector.
 *
 * Coordinates database retrieval, KPI calculations, multi-currency financial aggregation,
 * priority task detection, and recent activity streams.
 */

import { prisma } from "@/lib/db";
import {
  aggregateFinancialsByCurrency,
  calculateDashboardKpis,
} from "./calculator";
import type {
  ActionRequiredItem,
  DashboardOverviewResponse,
  ProjectCardSummary,
  RecentActivityItem,
} from "./types";

/**
 * Detects items requiring immediate provider attention across all projects.
 */
export function detectActionRequiredItems(projects: any[]): ActionRequiredItem[] {
  const items: ActionRequiredItem[] = [];

  for (const project of projects) {
    const projectId = project.id;
    const projectName = project.name;

    // 1. Projects without confirmed baseline
    const confirmedBaselines = Array.isArray(project.baselines)
      ? project.baselines.filter((b: any) => b.confirmedAt !== null || b.status === "CONFIRMED")
      : [];

    if (confirmedBaselines.length === 0) {
      items.push({
        id: `act_base_${projectId}`,
        type: "UNCONFIRMED_BASELINE",
        title: "Agreement Scope Baseline Not Confirmed",
        description: `Project "${projectName}" has not confirmed an agreed scope baseline.`,
        severity: "HIGH",
        projectId,
        projectName,
        href: `/projects/${projectId}/baseline`,
      });
    }

    // 2. Change requests with completed AI analysis awaiting provider review
    if (Array.isArray(project.requests)) {
      for (const req of project.requests) {
        const analysis = req.analysis as any;
        const reviewStatus = analysis?.reviewStatus || "PENDING";
        const requestLabel = req.sourceText
          ? req.sourceText.length > 40
            ? req.sourceText.slice(0, 40) + "..."
            : req.sourceText
          : req.title || "Untitled";

        if (reviewStatus !== "REVIEWED") {
          items.push({
            id: `act_req_${req.id}`,
            type: "PENDING_REQUEST_REVIEW",
            title: "Change Request Awaiting Review",
            description: `Client request "${requestLabel}" has been analyzed by AI and requires provider review.`,
            severity: "HIGH",
            projectId,
            projectName,
            entityId: req.id,
            href: `/projects/${projectId}/requests`,
          });
        }
      }
    }

    // 3. Proposals lifecycle actions
    if (Array.isArray(project.changeOrders)) {
      for (const prop of project.changeOrders) {
        const status = (prop.status || "").toUpperCase();

        if (status === "APPROVED" || status === "PROVIDER_APPROVED") {
          if (!prop.reviewTokenHash) {
            items.push({
              id: `act_prop_share_${prop.id}`,
              type: "UNSHARED_PROPOSAL",
              title: "Approved Proposal Not Shared",
              description: `Proposal v${prop.version} has been approved but has not been shared with the client.`,
              severity: "MEDIUM",
              projectId,
              projectName,
              entityId: prop.id,
              href: `/projects/${projectId}/proposals/${prop.id}`,
            });
          }
        } else if (status === "SENT_TO_CLIENT") {
          items.push({
            id: `act_prop_sent_${prop.id}`,
            type: "AWAITING_CLIENT_DECISION",
            title: "Awaiting Client Acceptance",
            description: `Proposal v${prop.version} is currently awaiting client decision via secure review link.`,
            severity: "LOW",
            projectId,
            projectName,
            entityId: prop.id,
            href: `/projects/${projectId}/proposals/${prop.id}`,
          });
        } else if (status === "CLIENT_ACCEPTED") {
          const invoices = Array.isArray(prop.invoices) ? prop.invoices : [];
          const activeInvoice = invoices.find(
            (inv: any) => (inv.status || "").toUpperCase() !== "CANCELLED"
          );

          if (!activeInvoice) {
            items.push({
              id: `act_prop_inv_${prop.id}`,
              type: "UNINVOICED_ACCEPTED_PROPOSAL",
              title: "Proposal Accepted — Ready for Invoice",
              description: `Client accepted proposal v${prop.version}. Create and send a PayPal Sandbox invoice to bill for deliverables.`,
              severity: "HIGH",
              projectId,
              projectName,
              entityId: prop.id,
              href: `/projects/${projectId}/proposals/${prop.id}`,
            });
          }
        }
      }
    }

    // 4. Invoices awaiting payment
    if (Array.isArray(project.invoices)) {
      for (const inv of project.invoices) {
        const invStatus = (inv.status || "").toUpperCase();
        if (invStatus === "SENT" || invStatus === "PARTIALLY_PAID") {
          items.push({
            id: `act_inv_pay_${inv.id}`,
            type: "INVOICE_AWAITING_PAYMENT",
            title: `Invoice ${inv.paypalInvoiceId} Awaiting Payment`,
            description: `Invoice for ${inv.currency} ${inv.amount} is currently ${invStatus}.`,
            severity: "LOW",
            projectId,
            projectName,
            entityId: inv.id,
            href: inv.changeOrderId
              ? `/projects/${projectId}/proposals/${inv.changeOrderId}`
              : `/projects/${projectId}/proposals`,
          });
        }
      }
    }
  }

  // Sort by severity (HIGH first)
  const severityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  return items.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
}

/**
 * Retrieves the complete executive dashboard overview from persisted records.
 */
export async function getDashboardOverview(): Promise<DashboardOverviewResponse> {
  const projects = await prisma.project.findMany({
    include: {
      baselines: {
        select: { id: true, confirmedAt: true, version: true },
      },
      requests: {
        select: { id: true, sourceText: true, classification: true, analysis: true, createdAt: true },
      },
      changeOrders: {
        include: {
          invoices: true,
        },
      },
      invoices: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  // Collect all invoices across all projects
  const allInvoices = projects.flatMap((p) => p.invoices || []);
  const financialSummaries = aggregateFinancialsByCurrency(allInvoices);
  const currencies = Object.keys(financialSummaries).sort();

  const kpis = calculateDashboardKpis(projects);
  const actionRequiredItems = detectActionRequiredItems(projects);

  // Recent projects summary cards
  const recentProjects: ProjectCardSummary[] = projects.map((p) => {
    const hasConfirmedBaseline = Array.isArray(p.baselines)
      ? p.baselines.some((b) => b.confirmedAt !== null)
      : false;

    const latestInvoice = Array.isArray(p.invoices) && p.invoices.length > 0
      ? p.invoices[p.invoices.length - 1]
      : null;

    return {
      id: p.id,
      name: p.name,
      clientName: p.clientName,
      clientEmail: p.clientEmail,
      currency: p.currency,
      status: p.status,
      hasConfirmedBaseline,
      requestsCount: p.requests?.length || 0,
      proposalsCount: p.changeOrders?.length || 0,
      activeInvoice: latestInvoice
        ? {
            paypalInvoiceId: latestInvoice.paypalInvoiceId,
            status: latestInvoice.status,
            amount: latestInvoice.amount.toString(),
            currency: latestInvoice.currency,
          }
        : null,
      lastActivityAt: p.updatedAt.toISOString(),
    };
  });

  // Fetch recent cross-project activity from ProjectEvent
  const rawEvents = await prisma.projectEvent.findMany({
    include: {
      project: {
        select: { id: true, name: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const recentActivity: RecentActivityItem[] = rawEvents.map((evt) => ({
    id: evt.id,
    projectId: evt.projectId,
    projectName: evt.project?.name || "Project",
    actorType: evt.actorType,
    eventType: evt.eventType,
    description: evt.description,
    metadata: (evt.metadata as Record<string, any>) || undefined,
    createdAt: evt.createdAt.toISOString(),
    formattedTime: formatRelativeTime(evt.createdAt),
  }));

  return {
    kpis,
    financialSummaries,
    currencies,
    actionRequiredItems,
    recentProjects,
    recentActivity,
  };
}

/**
 * Helper to format relative human-readable timestamps.
 */
function formatRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}
