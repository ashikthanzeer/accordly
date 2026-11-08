import { describe, it, expect } from "vitest";
import { computeScopeDriftRadar } from "@/lib/dashboard/drift-radar";

const SAMPLE_PROJECTS = [
  {
    id: "proj_usd_1",
    name: "SaaS Replatforming",
    clientName: "Acme Corp",
    currency: "USD",
    status: "ACTIVE",
    updatedAt: "2026-11-08T10:00:00Z",
    baselines: [
      {
        id: "base_1",
        version: 1,
        confirmedAt: "2026-11-01T10:00:00Z",
        structuredScope: {
          deliverables: [
            { id: "d1", name: "Marketing Landing Page", description: "5 responsive pages" },
            { id: "d2", name: "Auth Flow", description: "Google OAuth login" },
            { id: "d3", name: "Checkout Integration", description: "PayPal v2 checkout" },
          ],
        },
      },
    ],
    requests: [
      {
        id: "req_in_1",
        sourceText: "Update button color on landing page",
        classification: "IN_SCOPE",
        analysis: { reviewStatus: "REVIEWED" },
        createdAt: "2026-11-05T10:00:00Z",
      },
      {
        id: "req_oos_1",
        sourceText: "Build custom iOS and Android native apps",
        classification: "OUT_OF_SCOPE",
        analysis: { reviewStatus: "REVIEWED" },
        createdAt: "2026-11-06T10:00:00Z",
      },
      {
        id: "req_oos_unres",
        sourceText: "Add multi-warehouse ERP inventory sync",
        classification: "OUT_OF_SCOPE",
        analysis: { reviewStatus: "PENDING_REVIEW" },
        createdAt: "2026-11-07T10:00:00Z",
      },
      {
        id: "req_amb_unres",
        sourceText: "Include multi-language localization for 12 regions",
        classification: "AMBIGUOUS",
        analysis: { reviewStatus: "PENDING_REVIEW" },
        createdAt: "2026-11-08T09:00:00Z",
      },
    ],
    changeOrders: [
      {
        id: "prop_superseded_v1",
        changeRequestId: "req_oos_1",
        version: 1,
        status: "SUPERSEDED",
        amount: "2000.00",
        currency: "USD",
        createdAt: "2026-11-06T11:00:00Z",
      },
      {
        id: "prop_withdrawn_v2",
        changeRequestId: "req_oos_1",
        version: 2,
        status: "WITHDRAWN",
        amount: "9999.00",
        currency: "USD",
        createdAt: "2026-11-06T11:30:00Z",
      },
      {
        id: "prop_accepted_v3",
        changeRequestId: "req_oos_1",
        version: 3,
        status: "CLIENT_ACCEPTED",
        amount: "2500.00",
        currency: "USD",
        createdAt: "2026-11-06T12:00:00Z",
        invoices: [
          {
            id: "inv_1",
            paypalInvoiceId: "INV2-USD-1001",
            changeOrderId: "prop_accepted_v3",
            status: "PARTIALLY_PAID",
            currency: "USD",
            amount: "2500.00",
            paidAmount: 1500,
            dueAmount: 1000,
            createdAt: "2026-11-07T10:00:00Z",
          },
        ],
      },
      {
        id: "prop_approved_v4",
        changeRequestId: null,
        version: 4,
        status: "APPROVED",
        amount: "1200.00",
        currency: "USD",
        createdAt: "2026-11-07T15:00:00Z",
      },
      {
        id: "prop_draft_v5",
        changeRequestId: null,
        version: 5,
        status: "DRAFT",
        amount: "800.00",
        currency: "USD",
        createdAt: "2026-11-08T08:00:00Z",
      },
    ],
    invoices: [
      {
        id: "inv_1",
        paypalInvoiceId: "INV2-USD-1001",
        changeOrderId: "prop_accepted_v3",
        status: "PARTIALLY_PAID",
        currency: "USD",
        amount: "2500.00",
        paidAmount: 1500,
        dueAmount: 1000,
        createdAt: "2026-11-07T10:00:00Z",
      },
    ],
  },
  {
    id: "proj_eur_2",
    name: "European Portal",
    clientName: "Berlin Digital GmbH",
    currency: "EUR",
    status: "ACTIVE",
    updatedAt: "2026-11-08T11:00:00Z",
    baselines: [],
    requests: [],
    changeOrders: [
      {
        id: "prop_eur_acc",
        version: 1,
        status: "CLIENT_ACCEPTED",
        amount: "3000.00",
        currency: "EUR",
        createdAt: "2026-11-07T10:00:00Z",
        invoices: [],
      },
    ],
    invoices: [],
  },
];

describe("Scope Drift Radar Engine (src/lib/dashboard/drift-radar.ts)", () => {
  it("computes accurate global scope metrics and excludes SUPERSEDED and WITHDRAWN proposals from financial totals", () => {
    const radar = computeScopeDriftRadar(SAMPLE_PROJECTS);

    expect(radar.globalMetrics).toEqual({
      activeEngagementsCount: 2,
      totalChangeRequestsCount: 4,
      inScopeCount: 1,
      outOfScopeCount: 2,
      ambiguousCount: 1,
      pendingProposalsCount: 2, // prop_approved_v4 + prop_draft_v5
      providerApprovedProposalsCount: 3, // prop_accepted_v3 + prop_approved_v4 + prop_eur_acc
      clientAcceptedProposalsCount: 2, // prop_accepted_v3 + prop_eur_acc
    });

    // Verify USD and EUR are strictly separated
    expect(radar.currencies).toEqual(["EUR", "USD"]);

    const usd = radar.pipelineByCurrency["USD"];
    expect(usd).toBeDefined();
    // Proposed = 2500 (accepted v3) + 1200 (approved v4) + 800 (draft v5) = 4500.00
    // Superseded v1 (2000) and Withdrawn v2 (9999) MUST NOT be included!
    expect(usd.additionalProposedValue).toBe(4500);
    // Provider-Approved = 2500 (v3) + 1200 (v4) = 3700.00
    expect(usd.providerApprovedValue).toBe(3700);
    // Client-Accepted = 2500.00 (v3 only)
    expect(usd.clientAcceptedValue).toBe(2500);
    // Invoiced = 2500.00
    expect(usd.additionalInvoicedValue).toBe(2500);
    // Collected = 1500.00 (partial payment)
    expect(usd.additionalRevenueCollected).toBe(1500);
    // Outstanding = 1000.00
    expect(usd.outstandingAdditionalPayments).toBe(1000);

    const eur = radar.pipelineByCurrency["EUR"];
    expect(eur).toBeDefined();
    expect(eur.additionalProposedValue).toBe(3000);
    expect(eur.clientAcceptedValue).toBe(3000);
    expect(eur.additionalInvoicedValue).toBe(0);
    expect(eur.additionalRevenueCollected).toBe(0);
  });

  it("computes project-level scope intelligence including baseline deliverables count and unresolved requests", () => {
    const radar = computeScopeDriftRadar(SAMPLE_PROJECTS);
    const usdProj = radar.projectIntelligence.find((p) => p.projectId === "proj_usd_1");
    expect(usdProj).toBeDefined();
    expect(usdProj?.hasConfirmedBaseline).toBe(true);
    expect(usdProj?.baselineDeliverablesCount).toBe(3);
    expect(usdProj?.classificationDistribution).toEqual({
      inScope: 1,
      outOfScope: 2,
      ambiguous: 1,
    });
    // req_oos_unres (no proposal) + req_amb_unres (pending review) = 2 unresolved
    expect(usdProj?.unresolvedRequestsCount).toBe(2);
    expect(usdProj?.additionalAcceptedValue).toBe(2500);
    expect(usdProj?.additionalInvoicedValue).toBe(2500);
    expect(usdProj?.additionalCollectedValue).toBe(1500);
    expect(usdProj?.outstandingPayments).toBe(1000);
  });

  it("generates deterministic state-backed scope drift alerts with direct workspace links", () => {
    const radar = computeScopeDriftRadar(SAMPLE_PROJECTS);
    const alertTypes = radar.driftAlerts.map((a) => a.type);

    expect(alertTypes).toContain("OUT_OF_SCOPE_WITHOUT_PROPOSAL");
    expect(alertTypes).toContain("AMBIGUOUS_REQUIRING_REVIEW");
    expect(alertTypes).toContain("MULTIPLE_UNRESOLVED_CHANGE_REQUESTS");
    expect(alertTypes).toContain("PROPOSAL_AWAITING_CLIENT_ACCEPTANCE");
    expect(alertTypes).toContain("ACCEPTED_PROPOSAL_WITHOUT_INVOICE");
    expect(alertTypes).toContain("UNPAID_OR_OVERDUE_INVOICE");

    for (const alert of radar.driftAlerts) {
      expect(alert.href).toMatch(/^\/projects\//);
      expect(alert.rationale.length).toBeGreaterThan(10);
    }
  });

  it("supports filtering by projectId, classification, proposalStatus, and invoiceStatus", () => {
    const byProject = computeScopeDriftRadar(SAMPLE_PROJECTS, {
      projectId: "proj_eur_2",
    });
    expect(byProject.projectIntelligence).toHaveLength(1);
    expect(byProject.projectIntelligence[0].projectId).toBe("proj_eur_2");
    expect(byProject.currencies).toEqual(["EUR"]);

    const byClassification = computeScopeDriftRadar(SAMPLE_PROJECTS, {
      classification: "OUT_OF_SCOPE",
    });
    expect(byClassification.globalMetrics.totalChangeRequestsCount).toBe(2);
    expect(byClassification.globalMetrics.inScopeCount).toBe(0);
    expect(byClassification.globalMetrics.outOfScopeCount).toBe(2);
  });

  it("handles empty projects state safely without errors", () => {
    const empty = computeScopeDriftRadar([]);
    expect(empty.globalMetrics.activeEngagementsCount).toBe(0);
    expect(empty.globalMetrics.totalChangeRequestsCount).toBe(0);
    expect(empty.currencies).toEqual([]);
    expect(empty.projectIntelligence).toEqual([]);
    expect(empty.driftAlerts).toEqual([]);
  });
});

