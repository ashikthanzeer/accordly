import { describe, it, expect } from "vitest";
import { evaluateAgreementHealth } from "@/lib/baseline/health-check";
import { verifyAnalysisCitations } from "@/lib/ai/citation-validator";
import { buildVisualScopeComparisonModel } from "@/lib/requests/visual-comparison";
import {
  buildApprovedSnapshot,
  computeSnapshotHash,
  verifySnapshotIntegrity,
} from "@/lib/proposals/snapshot";
import {
  buildProposalVersionHistory,
  compareProposalVersions,
} from "@/lib/proposals/diff";
import {
  validateInvoiceEligibility,
  mapProposalToPayPalInvoice,
} from "@/lib/paypal/mapper";
import { computeScopeDriftRadar } from "@/lib/dashboard/drift-radar";
import {
  sanitizeEventMetadata,
  resolveEventResourceContext,
} from "@/lib/timeline/service";

describe("Master Product Expansion — Comprehensive 20-Step End-to-End Audit & Invariants", () => {
  const RAW_CONTRACT_TEXT = `
MASTER SERVICE AGREEMENT — ACME COMMERCE REBUILD
1. Deliverables:
- Custom Next.js Storefront (5 core marketing and product templates)
- PayPal Orders v2 & Invoicing API Integration
2. Exclusions:
- Native iOS and Android mobile apps are strictly excluded from this agreement.
- Legacy ERP migration is excluded.
3. Revision Limits:
- Up to 2 rounds of UI design revisions per template. Additional revisions billed at $150/hr.
  `.trim();

  const CONFIRMED_BASELINE: any = {
    id: "base_e2e_1",
    version: 1,
    confirmedAt: "2026-11-01T10:00:00Z",
    structuredScope: {
      deliverables: [
        {
          id: "del_1",
          name: "Custom Next.js Storefront",
          description: "5 core marketing and product templates",
          conditions: ["Responsive across desktop and mobile", "Lighthouse score >= 90"],
          source: {
            excerpt: "Custom Next.js Storefront (5 core marketing and product templates)",
            page: 1,
            section: "Section 1: Deliverables",
          },
        },
        {
          id: "del_2",
          name: "PayPal Orders v2 & Invoicing API Integration",
          description: "Full sandbox and live PayPal invoicing flow",
          conditions: ["Webhook signature verification", "Idempotent invoice creation"],
          source: {
            excerpt: "PayPal Orders v2 & Invoicing API Integration",
            page: 1,
            section: "Section 1: Deliverables",
          },
        },
      ],
      exclusions: [
        {
          id: "exc_1",
          description: "Native iOS and Android mobile apps are strictly excluded from this agreement.",
          source: {
            excerpt: "Native iOS and Android mobile apps are strictly excluded from this agreement.",
            page: 1,
            section: "Section 2: Exclusions",
          },
        },
        {
          id: "exc_2",
          description: "Legacy ERP migration is excluded.",
          source: {
            excerpt: "Legacy ERP migration is excluded.",
            page: 1,
            section: "Section 2: Exclusions",
          },
        },
      ],
      revisionLimits: {
        isSpecified: true,
        includedCount: 2,
        definition: "UI design revisions per template",
        restrictions: ["Additional revisions billed at $150/hr"],
        source: {
          excerpt: "Up to 2 rounds of UI design revisions per template. Additional revisions billed at $150/hr.",
          page: 1,
          section: "Section 3: Revision Limits",
        },
      },
      milestones: [],
      paymentTerms: null,
      assumptions: ["Client supplies product catalog JSON"],
      ambiguities: [],
      riskFlags: [],
    },
  };

  it("Steps 1-6: Evaluates 10-category Agreement Health Check, detects missing commercial clauses, and preserves baseline confirmation", () => {
    const health = evaluateAgreementHealth(
      CONFIRMED_BASELINE.structuredScope,
      RAW_CONTRACT_TEXT
    );

    expect(health.categories).toHaveLength(10);
    expect(health.overallScore).toBeGreaterThan(0);
    expect(health.overallScore).toBeLessThan(100);

    // Deliverable Specificity, Scope Exclusions, Revision Limits are STRONG
    const delCat = health.categories.find((c) => c.id === "DELIVERABLE_SPECIFICITY");
    const excCat = health.categories.find((c) => c.id === "SCOPE_EXCLUSIONS");
    const revCat = health.categories.find((c) => c.id === "REVISION_LIMITS");
    expect(delCat?.status).toBe("STRONG");
    expect(excCat?.status).toBe("STRONG");
    expect(revCat?.status).toBe("STRONG");

    // Payment Terms & Project Milestones are MISSING
    const payCat = health.categories.find((c) => c.id === "PAYMENT_TERMS");
    const mileCat = health.categories.find((c) => c.id === "PROJECT_MILESTONES");
    expect(payCat?.status).toBe("MISSING");
    expect(mileCat?.status).toBe("MISSING");

    // Verify actionable recommendations and missingInformation explanations
    const missingCategories = health.categories.filter((c) => c.status === "MISSING");
    expect(missingCategories.length).toBeGreaterThanOrEqual(3);
    for (const cat of missingCategories) {
      expect(cat.missingInformation && cat.missingInformation.length).toBeGreaterThan(10);
      expect(cat.recommendation.length).toBeGreaterThan(15);
    }
  });

  it("Steps 7-9: Enforces strict citation verification and builds 3-pane Visual Scope Comparison with immutable AI assessment vs Provider Override", () => {
    const rawAnalysis: any = {
      classification: "OUT_OF_SCOPE",
      confidence: "HIGH",
      summary: "Native iOS mobile app is explicitly excluded from the agreement.",
      reasoning:
        "The client requested a native iOS app, which is explicitly excluded by Section 2 of the agreement.",
      affectedDeliverables: ["Custom Next.js Storefront"],
      affectedBaselineCategories: ["EXCLUSION"],
      supportingEvidence: [
        {
          category: "EXCLUSION",
          verbatimExcerpt:
            "Native iOS and Android mobile apps are strictly excluded from this agreement.",
          page: 1,
          section: "Section 2: Exclusions",
          relevanceExplanation: "Directly excludes native iOS app development.",
          isVerified: true,
        },
        {
          category: "GENERAL_CONTRACT",
          verbatimExcerpt: "This quote does not exist anywhere in the contract or baseline.",
          page: 99,
          section: "Section 99",
          relevanceExplanation: "Should be flagged as unverified by deterministic citation validator.",
          isVerified: true,
        },
      ],
      contradictingEvidence: [],
      ambiguityTriggers: [],
      clarificationQuestions: [],
      missingInformation: [],
      recommendedNextStep: "GENERATE_CHANGE_ORDER",
    };

    // Citation verification marks the fabricated quote as isVerified: false and downgrades confidence
    const verifiedAnalysis = verifyAnalysisCitations(
      rawAnalysis,
      RAW_CONTRACT_TEXT,
      2
    );

    expect(verifiedAnalysis.supportingEvidence[0].isVerified).toBe(true);
    expect(verifiedAnalysis.supportingEvidence[1].isVerified).toBe(false);
    expect(verifiedAnalysis.confidence).toBe("MEDIUM");

    // Attach a provider review override without mutating the AI classification
    const analysisWithOverride = {
      ...verifiedAnalysis,
      reviewStatus: "REVIEWED" as const,
      reviewedAt: "2026-11-08T12:00:00Z",
      providerNotes: "Discussed on client sync call.",
      providerOverride: {
        overriddenAt: "2026-11-08T12:00:00Z",
        justification: "Approved for fixed-fee commercial proposal after client kickoff call.",
        allowInScopeOverride: false,
      },
    };

    const comparisonModel = buildVisualScopeComparisonModel({
      agreementName: "Master Service Agreement — Acme Commerce Rebuild",
      baselineVersion: 1,
      structuredBaseline: CONFIRMED_BASELINE.structuredScope,
      sourceText: "Can you also build a native iOS app for our loyalty members?",
      analysis: analysisWithOverride,
    });

    // Verify 3-pane model integrity
    expect(comparisonModel.leftBaselineClauses.length).toBeGreaterThanOrEqual(4);
    expect(
      comparisonModel.aiAssessment.evidenceItems.filter((e) => e.isVerified)
    ).toHaveLength(1);
    expect(comparisonModel.aiAssessment.classification).toBe("OUT_OF_SCOPE");
    expect(comparisonModel.providerDecision.hasProviderOverride).toBe(true);
    expect(comparisonModel.providerDecision.overrideJustification).toContain(
      "Approved for fixed-fee commercial proposal"
    );
    // AI decision remains immutable
    expect(comparisonModel.aiAssessment.classification).toBe("OUT_OF_SCOPE");
  });

  it("Steps 10-20: Enforces Proposal v1 lock, rejects mutation after approval, creates v2 superseding v1, maps accepted v2 snapshot to PayPal invoice, and updates Scope Drift Radar", () => {
    const project = {
      id: "proj_e2e_1",
      name: "Acme Commerce Rebuild",
      clientName: "Acme Corp",
      clientEmail: "billing@acmecorp.example.com",
      currency: "USD",
      status: "ACTIVE",
      updatedAt: "2026-11-08T14:00:00Z",
    };

    // Step 10-12: Create & Approve Proposal v1 ($6,000.00)
    const propV1: any = {
      id: "prop_e2e_v1",
      projectId: project.id,
      changeRequestId: "req_e2e_1",
      version: 1,
      status: "APPROVED",
      description: "Native iOS Loyalty App MVP (v1)",
      amount: "6000.00",
      currency: "USD",
      timelineImpact: "+3 weeks",
      createdAt: "2026-11-08T12:00:00Z",
      providerApprovedAt: "2026-11-08T12:15:00Z",
      deliverables: {
        title: "Native iOS Loyalty App MVP (v1)",
        reasonForChange: "Explicitly excluded in Section 2 of MSA",
        timelineImpact: "+3 weeks",
        assumptions: ["Client provides Apple Developer Enterprise account"],
        deliverables: [
          {
            id: "ios_1",
            name: "iOS SwiftUI App Shell",
            description: "Core authentication and catalog browse",
            acceptanceCriteria: ["Runs on iOS 17+"],
            suggestedEffortHours: 40,
          },
        ],
        pricing: {
          model: "ITEMIZED",
          currency: "USD",
          total: 6000,
          formattedTotal: "USD 6000.00",
          lineItems: [
            {
              id: "li_1",
              description: "iOS SwiftUI App Shell",
              quantity: 40,
              unitPrice: 150,
              subtotal: 6000,
              currency: "USD",
            },
          ],
        },
      },
    };

    const snapshotV1 = buildApprovedSnapshot({
      proposal: propV1,
      project,
      approverName: "Lead Provider",
      approvedAt: new Date("2026-11-08T12:15:00Z"),
    });
    const hashV1 = computeSnapshotHash(snapshotV1);
    propV1.deliverables.approvedSnapshot = snapshotV1;
    propV1.deliverables.approvedSnapshotHash = hashV1;

    // Verify v1 cryptographic lock
    const v1Verification = verifySnapshotIntegrity(propV1, { strict: true });
    expect(v1Verification.isValid).toBe(true);
    expect(v1Verification.computedHash).toBe(hashV1);

    // Step 13: Tampering with approved proposal amount is caught by verifySnapshotIntegrity
    const tamperedV1 = {
      ...propV1,
      amount: "9500.00",
    };
    const tamperedCheck = verifySnapshotIntegrity(tamperedV1, { strict: true });
    expect(tamperedCheck.isValid).toBe(false);
    expect(tamperedCheck.error).toContain("does not match approved snapshot amount");

    // Step 14: Create Proposal v2 ($7,500.00) superseding v1
    propV1.status = "SUPERSEDED";
    const propV2: any = {
      id: "prop_e2e_v2",
      projectId: project.id,
      changeRequestId: "req_e2e_1",
      version: 2,
      status: "CLIENT_ACCEPTED",
      description: "Native iOS Loyalty App + Push Notifications (v2)",
      amount: "7500.00",
      currency: "USD",
      timelineImpact: "+4 weeks",
      createdAt: "2026-11-08T13:00:00Z",
      providerApprovedAt: "2026-11-08T13:10:00Z",
      clientAcceptedAt: "2026-11-08T13:30:00Z",
      deliverables: {
        title: "Native iOS Loyalty App + Push Notifications (v2)",
        reasonForChange: "Added APNs push notifications per client feedback on v1",
        timelineImpact: "+4 weeks",
        predecessorProposalId: propV1.id,
        predecessorVersion: 1,
        assumptions: ["Client provides Apple Developer Enterprise account"],
        deliverables: [
          {
            id: "ios_1",
            name: "iOS SwiftUI App Shell",
            description: "Core authentication and catalog browse",
            acceptanceCriteria: ["Runs on iOS 17+"],
            suggestedEffortHours: 40,
          },
          {
            id: "ios_2",
            name: "APNs Push Notification Service",
            description: "Order status & loyalty reward push notifications",
            acceptanceCriteria: ["Delivers push alerts in sandbox & prod"],
            suggestedEffortHours: 10,
          },
        ],
        pricing: {
          model: "ITEMIZED",
          currency: "USD",
          total: 7500,
          formattedTotal: "USD 7500.00",
          lineItems: [
            {
              id: "li_1",
              description: "iOS SwiftUI App Shell",
              quantity: 40,
              unitPrice: 150,
              subtotal: 6000,
              currency: "USD",
            },
            {
              id: "li_2",
              description: "APNs Push Notification Service",
              quantity: 10,
              unitPrice: 150,
              subtotal: 1500,
              currency: "USD",
            },
          ],
        },
      },
      invoices: [],
    };

    const snapshotV2 = buildApprovedSnapshot({
      proposal: propV2,
      project,
      approverName: "Lead Provider",
      approvedAt: new Date("2026-11-08T13:10:00Z"),
    });
    propV2.deliverables.approvedSnapshot = snapshotV2;
    propV2.deliverables.approvedSnapshotHash = computeSnapshotHash(snapshotV2);

    // Step 15: Compare Proposal v1 and v2
    const versionHistory = buildProposalVersionHistory([propV1, propV2]);
    expect(versionHistory[0].version).toBe(2);
    expect(versionHistory[0].status).toBe("CLIENT_ACCEPTED");
    expect(versionHistory[1].version).toBe(1);
    expect(versionHistory[1].status).toBe("SUPERSEDED");

    const diff = compareProposalVersions(propV1, propV2);
    expect(diff.amountDelta).toBe(1500);
    expect(diff.summaryCounts.addedDeliverables).toBe(1);
    expect(diff.summaryCounts.addedLineItems).toBe(1);
    expect(diff.timelineChanged).toBe(true);

    // Step 16-18: Generate PayPal invoice payload from accepted Proposal v2 snapshot
    const eligibility = validateInvoiceEligibility(propV2, project);
    expect(eligibility.eligible).toBe(true);

    const mappedInvoice = mapProposalToPayPalInvoice(propV2, project);
    expect(mappedInvoice.input.amount).toBe("7500.00");
    expect(mappedInvoice.input.currency).toBe("USD");
    expect(mappedInvoice.input.recipientEmail).toBe("billing@acmecorp.example.com");
    expect(mappedInvoice.input.items).toHaveLength(2);
    expect(mappedInvoice.input.items![0].unitAmount).toBe("150.00");
    expect(mappedInvoice.input.items![1].name).toBe("APNs Push Notification Service");

    // Step 19: Reconcile paid invoice and verify Scope Drift Radar excludes SUPERSEDED v1 ($6,000) and counts PAID v2 ($7,500)
    const paidInvoice = {
      id: "inv_e2e_1",
      paypalInvoiceId: "INV2-E2E-7500",
      changeOrderId: propV2.id,
      status: "PAID",
      currency: "USD",
      amount: "7500.00",
      createdAt: "2026-11-08T14:00:00Z",
    };
    propV2.invoices = [paidInvoice];

    const radar = computeScopeDriftRadar([
      {
        ...project,
        baselines: [CONFIRMED_BASELINE],
        requests: [
          {
            id: "req_e2e_1",
            sourceText: "Can you also build a native iOS app for our loyalty members?",
            classification: "OUT_OF_SCOPE",
            analysis: { reviewStatus: "REVIEWED" },
            createdAt: "2026-11-08T11:30:00Z",
          },
        ],
        changeOrders: [propV1, propV2],
        invoices: [paidInvoice],
      },
    ]);

    const usd = radar.pipelineByCurrency["USD"];
    // Superseded v1 ($6,000) is excluded; only v2 ($7,500) is counted across the pipeline
    expect(usd.additionalProposedValue).toBe(7500);
    expect(usd.providerApprovedValue).toBe(7500);
    expect(usd.clientAcceptedValue).toBe(7500);
    expect(usd.additionalInvoicedValue).toBe(7500);
    expect(usd.additionalRevenueCollected).toBe(7500);
    expect(usd.outstandingAdditionalPayments).toBe(0);
    expect(radar.driftAlerts).toHaveLength(0);

    // Step 20: Verify Activity Timeline sanitization & deep links
    const cleanMeta = sanitizeEventMetadata({
      proposalId: propV2.id,
      version: 2,
      invoiceId: paidInvoice.id,
      paypalInvoiceId: paidInvoice.paypalInvoiceId,
      status: "PAID",
      amount: "7500.00",
      currency: "USD",
      systemPrompt: "SHOULD_BE_STRIPPED",
      reviewToken: "SHOULD_BE_STRIPPED",
    });
    expect(cleanMeta?.systemPrompt).toBeUndefined();
    expect(cleanMeta?.reviewToken).toBeUndefined();
    const linkCtx = resolveEventResourceContext(project.id, "PAYMENT", cleanMeta);
    expect(linkCtx.href).toBe(`/projects/${project.id}/proposals/${propV2.id}`);
  });
});
