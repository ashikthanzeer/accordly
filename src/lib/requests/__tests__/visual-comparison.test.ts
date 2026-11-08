import { describe, it, expect } from "vitest";
import { buildVisualScopeComparisonModel } from "@/lib/requests/visual-comparison";
import type { StructuredScopeBaseline } from "@/lib/ai/schema";
import type { ChangeRequestAnalysisResult } from "@/lib/ai/classifier-schema";

const SAMPLE_BASELINE: StructuredScopeBaseline = {
  projectObjective: "Redesign corporate marketing site and integrate PayPal checkout.",
  deliverables: [
    {
      id: "deliv_1",
      name: "Responsive Marketing Pages",
      description: "Design and build 5 core marketing pages (Home, About, Pricing, FAQ, Contact).",
      conditions: ["Up to 5 pages"],
      source: {
        page: 2,
        section: "2.1 Deliverables",
        excerpt: "Provider shall deliver five (5) responsive web pages.",
        isInferred: false,
      },
    },
  ],
  exclusions: [
    {
      id: "excl_1",
      description: "Native mobile iOS and Android applications are excluded.",
      conditions: null,
      source: {
        page: 4,
        section: "3.2 Exclusions",
        excerpt: "Native iOS and Android mobile apps are explicitly excluded from this agreement.",
        isInferred: false,
      },
    },
  ],
  revisionLimits: {
    includedCount: 2,
    definition: "Consolidated feedback rounds per deliverable",
    restrictions: ["Additional revisions billed at $150/hr"],
    isSpecified: true,
    source: {
      page: 5,
      section: "4.1 Revisions",
      excerpt: "Client is entitled to two (2) rounds of revisions per deliverable.",
      isInferred: false,
    },
  },
  milestones: [],
  acceptanceCriteria: [],
  paymentTerms: { isSpecified: false, milestones: [] },
  timelines: { isSpecified: false, deliveryDeadlines: [], dependencies: [] },
  ambiguities: [],
};

describe("Visual Scope Comparison Engine (src/lib/requests/visual-comparison.ts)", () => {
  it("aligns baseline clauses with an OUT_OF_SCOPE request citing an explicit exclusion", () => {
    const analysis: ChangeRequestAnalysisResult = {
      classification: "OUT_OF_SCOPE",
      summary: "Native mobile app development is explicitly excluded.",
      reasoning: "Section 3.2 explicitly excludes native iOS and Android apps.",
      supportingEvidence: [
        {
          id: "ev_1",
          type: "SUPPORTING",
          category: "EXCLUSION",
          page: 4,
          section: "3.2 Exclusions",
          verbatimExcerpt:
            "Native iOS and Android mobile apps are explicitly excluded from this agreement.",
          relevanceExplanation: "Directly excludes requested mobile app.",
          isVerified: true,
        },
      ],
      contradictingEvidence: [],
      missingInformation: [],
      clarificationQuestions: [],
      affectedDeliverables: [],
      affectedBaselineCategories: ["EXCLUSION"],
      confidence: "HIGH",
      limitations: "Advisory analysis.",
      baselineVersion: 2,
      reviewStatus: "REVIEWED",
      providerNotes: "Confirmed out of scope; preparing $4,500 proposal.",
    };

    const model = buildVisualScopeComparisonModel({
      agreementName: "Master_Services_Agreement_v2.pdf",
      baselineVersion: 2,
      structuredBaseline: SAMPLE_BASELINE,
      sourceText: "Can you also build a native iOS app for our store?",
      analysis,
    });

    expect(model.agreementName).toBe("Master_Services_Agreement_v2.pdf");
    expect(model.baselineVersion).toBe(2);
    expect(model.aiAssessment.hasExplicitExclusion).toBe(true);
    expect(model.aiAssessment.isSilentContract).toBe(false);
    expect(model.aiAssessment.evidenceItems).toHaveLength(1);
    expect(model.aiAssessment.evidenceItems[0].alignment).toBe("OUTSIDE_OR_EXCLUDED");
    expect(model.aiAssessment.evidenceItems[0].page).toBe(4);
    expect(model.aiAssessment.evidenceItems[0].isVerified).toBe(true);

    // Directly referenced exclusion should be sorted first in leftBaselineClauses
    expect(model.leftBaselineClauses[0].category).toBe("EXCLUSION");
    expect(model.leftBaselineClauses[0].isDirectlyReferenced).toBe(true);
  });

  it("handles missing evidence (silent contract) transparently without fabricating citations", () => {
    const silentAnalysis: ChangeRequestAnalysisResult = {
      classification: "AMBIGUOUS",
      summary: "Agreement is silent on multi-region GDPR data residency.",
      reasoning: "No clauses mention regional hosting or GDPR residency requirements.",
      supportingEvidence: [],
      contradictingEvidence: [],
      missingInformation: ["Hosting region and data residency requirements"],
      clarificationQuestions: ["Which EU region is required for hosting?"],
      affectedDeliverables: [],
      affectedBaselineCategories: [],
      confidence: "MEDIUM",
      limitations: "Advisory analysis.",
      baselineVersion: 1,
      reviewStatus: "PENDING_REVIEW",
    };

    const model = buildVisualScopeComparisonModel({
      agreementName: "Statement_of_Work.pdf",
      baselineVersion: 1,
      structuredBaseline: SAMPLE_BASELINE,
      sourceText: "Please deploy dedicated EU-central-1 database replicas for GDPR.",
      analysis: silentAnalysis,
    });

    expect(model.aiAssessment.isSilentContract).toBe(true);
    expect(model.aiAssessment.evidenceItems).toHaveLength(0);
    expect(model.aiAssessment.missingInformation).toContain(
      "Hosting region and data residency requirements"
    );
  });

  it("detects mixed-scope signals and preserves separation between AI classification and provider override", () => {
    const mixedAnalysis: ChangeRequestAnalysisResult & {
      providerOverride?: { allowInScopeOverride?: boolean; justification?: string };
    } = {
      classification: "IN_SCOPE",
      summary: "Covers landing page copy placement, though custom illustrations conflict.",
      reasoning: "Landing page layout is covered under Deliverable 1.",
      supportingEvidence: [
        {
          id: "ev_s1",
          type: "SUPPORTING",
          category: "DELIVERABLE",
          page: 2,
          section: "2.1 Deliverables",
          verbatimExcerpt: "Provider shall deliver five (5) responsive web pages.",
          relevanceExplanation: "Covers the 5 core pages.",
          isVerified: true,
        },
      ],
      contradictingEvidence: [
        {
          id: "ev_c1",
          type: "CONTRADICTING",
          category: "REVISION_LIMIT",
          page: 5,
          section: "4.1 Revisions",
          verbatimExcerpt: "Client is entitled to two (2) rounds of revisions per deliverable.",
          relevanceExplanation: "Client already used 2 revision rounds.",
          isVerified: true,
        },
      ],
      missingInformation: [],
      clarificationQuestions: [],
      affectedDeliverables: ["Responsive Marketing Pages"],
      affectedBaselineCategories: ["DELIVERABLE", "REVISION_LIMIT"],
      confidence: "MEDIUM",
      limitations: "Advisory analysis.",
      baselineVersion: 1,
      reviewStatus: "REVIEWED",
      providerNotes: "Overriding to create a change order for 3rd revision round.",
      providerOverride: {
        allowInScopeOverride: true,
        justification: "Client requested a 3rd revision round beyond the 2-round contractual cap.",
      },
    };

    const model = buildVisualScopeComparisonModel({
      agreementName: "Agreement.pdf",
      baselineVersion: 1,
      structuredBaseline: SAMPLE_BASELINE,
      sourceText: "We need a 3rd round of layout revisions on the Home page.",
      analysis: mixedAnalysis,
    });

    expect(model.rightRequest.hasMixedSignals).toBe(true);
    // AI classification remains IN_SCOPE, while provider override is recorded separately
    expect(model.aiAssessment.classification).toBe("IN_SCOPE");
    expect(model.providerDecision.hasProviderOverride).toBe(true);
    expect(model.providerDecision.overrideJustification).toContain("3rd revision round");
  });
});

