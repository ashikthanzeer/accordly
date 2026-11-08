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
    // Only proposals linked to OUT_OF_SCOPE requests should be counted when filtering by classification
    expect(byClassification.globalMetrics.clientAcceptedProposalsCount).toBe(1);
    expect(byClassification.pipelineByCurrency["USD"].additionalProposedValue).toBe(2500);
  });

  it("correctly handles all proposal and invoice lifecycle states without double-counting", () => {
    const complexProject = [
      {
        id: "proj_fin_audit",
        name: "Financial Invariant Audit",
        clientName: "FinCorp",
        currency: "USD",
        status: "ACTIVE",
        updatedAt: new Date().toISOString(),
        baselines: [],
        requests: [
          {
            id: "req_rejected_only",
            sourceText: "Add blockchain integration",
            classification: "OUT_OF_SCOPE",
            analysis: { reviewStatus: "REVIEWED" },
            createdAt: new Date().toISOString(),
          },
          {
            id: "req_rev_within",
            sourceText: "Minor copy revision",
            classification: "REVISION_WITHIN_LIMIT",
            analysis: { reviewStatus: "REVIEWED" },
            createdAt: new Date().toISOString(),
          },
          {
            id: "req_rev_exceeds",
            sourceText: "Fourth major redesign revision",
            classification: "REVISION_EXCEEDS_LIMIT",
            analysis: { reviewStatus: "REVIEWED" },
            createdAt: new Date().toISOString(),
          },
          {
            id: "req_clarification",
            sourceText: "Unspecified hosting setup",
            classification: "CLARIFICATION_NEEDED",
            analysis: { reviewStatus: "PENDING_REVIEW" },
            createdAt: new Date().toISOString(),
          },
        ],
        changeOrders: [
          // 1. DRAFT proposal ($500) -> counts in Proposed only
          {
            id: "prop_draft",
            version: 1,
            status: "DRAFT",
            amount: "500.00",
            currency: "USD",
          },
          // 2. APPROVED proposal ($1000, snapshot $1000) -> counts in Proposed & Provider-Approved
          {
            id: "prop_approved",
            version: 2,
            status: "APPROVED",
            amount: "9999.00", // Tampered top-level amount; snapshot should win
            deliverables: {
              approvedSnapshot: { amount: 1000, currency: "USD" },
            },
            currency: "USD",
          },
          // 3. CLIENT_REJECTED proposal ($4000) -> counts in Proposed & Provider-Approved, NOT Client-Accepted, and does NOT resolve req_rejected_only
          {
            id: "prop_rejected",
            changeRequestId: "req_rejected_only",
            version: 3,
            status: "CLIENT_REJECTED",
            amount: "4000.00",
            currency: "USD",
          },
          // 4. SUPERSEDED ($2000) & WITHDRAWN ($3000) -> excluded from ALL financial pipeline metrics
          {
            id: "prop_superseded",
            version: 4,
            status: "SUPERSEDED",
            amount: "2000.00",
            currency: "USD",
          },
          {
            id: "prop_withdrawn",
            version: 5,
            status: "WITHDRAWN",
            amount: "3000.00",
            currency: "USD",
          },
          // 5. CLIENT_ACCEPTED proposal with only a DRAFT (unsent) invoice ($1500) -> triggers ACCEPTED_PROPOSAL_WITHOUT_INVOICE
          {
            id: "prop_acc_unsent_inv",
            changeRequestId: "req_rev_exceeds",
            version: 6,
            status: "CLIENT_ACCEPTED",
            amount: "1500.00",
            currency: "USD",
            invoices: [
              {
                id: "inv_draft",
                paypalInvoiceId: "INV2-DRAFT-1",
                changeOrderId: "prop_acc_unsent_inv",
                status: "DRAFT",
                currency: "USD",
                amount: "1500.00",
              },
            ],
          },
          // 6. CLIENT_ACCEPTED proposal with PAID invoice ($2000), SENT invoice ($800), OVERDUE invoice ($600), CANCELLED invoice ($900)
          {
            id: "prop_acc_paid",
            version: 7,
            status: "CLIENT_ACCEPTED",
            amount: "3400.00",
            currency: "USD",
          },
        ],
        invoices: [
          // Unsent DRAFT invoice -> NOT counted in Invoiced or Outstanding
          {
            id: "inv_draft",
            paypalInvoiceId: "INV2-DRAFT-1",
            changeOrderId: "prop_acc_unsent_inv",
            status: "DRAFT",
            currency: "USD",
            amount: "1500.00",
          },
          // Cancelled invoice -> NOT counted in Invoiced, Collected, or Outstanding
          {
            id: "inv_cancelled",
            paypalInvoiceId: "INV2-CANC-1",
            changeOrderId: "prop_acc_paid",
            status: "CANCELLED",
            currency: "USD",
            amount: "900.00",
          },
          // Fully PAID invoice ($2000) + duplicate entry with same paypalInvoiceId (simulating duplicate webhook/join)
          {
            id: "inv_paid_1",
            paypalInvoiceId: "INV2-PAID-1",
            changeOrderId: "prop_acc_paid",
            status: "PAID",
            currency: "USD",
            amount: "2000.00",
          },
          {
            id: "inv_paid_1_dup",
            paypalInvoiceId: "INV2-PAID-1",
            changeOrderId: "prop_acc_paid",
            status: "PAID",
            currency: "USD",
            amount: "2000.00",
          },
          // SENT unpaid invoice ($800)
          {
            id: "inv_sent_1",
            paypalInvoiceId: "INV2-SENT-1",
            changeOrderId: "prop_acc_paid",
            status: "SENT",
            currency: "USD",
            amount: "800.00",
          },
          // OVERDUE unpaid invoice ($600)
          {
            id: "inv_overdue_1",
            paypalInvoiceId: "INV2-OVERDUE-1",
            changeOrderId: "prop_acc_paid",
            status: "OVERDUE",
            currency: "USD",
            amount: "600.00",
          },
        ],
      },
    ];

    const radar = computeScopeDriftRadar(complexProject);

    // Classification normalization check:
    // IN_SCOPE: req_rev_within (1)
    // OUT_OF_SCOPE: req_rejected_only + req_rev_exceeds (2)
    // AMBIGUOUS: req_clarification (1)
    expect(radar.globalMetrics.inScopeCount).toBe(1);
    expect(radar.globalMetrics.outOfScopeCount).toBe(2);
    expect(radar.globalMetrics.ambiguousCount).toBe(1);

    const usd = radar.pipelineByCurrency["USD"];
    // Proposed = 500 (draft) + 1000 (approved snapshot) + 1500 (accepted1) + 3400 (accepted2) = 6400
    // (Excludes 4000 CLIENT_REJECTED, 2000 SUPERSEDED, and 3000 WITHDRAWN)
    expect(usd.additionalProposedValue).toBe(6400);
    // Provider-approved = 1000 (approved) + 1500 (accepted1) + 3400 (accepted2) = 5900
    expect(usd.providerApprovedValue).toBe(5900);
    // Client-accepted = 1500 + 3400 = 4900
    expect(usd.clientAcceptedValue).toBe(4900);
    // Invoiced = 2000 (paid, deduplicated) + 800 (sent) + 600 (overdue) = 3400 (excludes 1500 DRAFT and 900 CANCELLED)
    expect(usd.additionalInvoicedValue).toBe(3400);
    // Collected = 2000 (paid, deduplicated)
    expect(usd.additionalRevenueCollected).toBe(2000);
    // Outstanding = 800 (sent) + 600 (overdue) = 1400
    expect(usd.outstandingAdditionalPayments).toBe(1400);

    // Alerts check:
    // req_rejected_only only has CLIENT_REJECTED proposal -> must still trigger OUT_OF_SCOPE_WITHOUT_PROPOSAL
    const oosAlert = radar.driftAlerts.find(
      (a) => a.type === "OUT_OF_SCOPE_WITHOUT_PROPOSAL" && a.resourceId === "req_rejected_only"
    );
    expect(oosAlert).toBeDefined();

    // prop_acc_unsent_inv only has DRAFT invoice -> must still trigger ACCEPTED_PROPOSAL_WITHOUT_INVOICE
    const noInvAlert = radar.driftAlerts.find(
      (a) => a.type === "ACCEPTED_PROPOSAL_WITHOUT_INVOICE" && a.resourceId === "prop_acc_unsent_inv"
    );
    expect(noInvAlert).toBeDefined();

    // UNPAID filter must match both SENT and OVERDUE invoices
    const unpaidFiltered = computeScopeDriftRadar(complexProject, {
      invoiceStatus: "UNPAID",
    });
    expect(unpaidFiltered.pipelineByCurrency["USD"].additionalInvoicedValue).toBe(1400);
    expect(unpaidFiltered.pipelineByCurrency["USD"].outstandingAdditionalPayments).toBe(1400);
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

