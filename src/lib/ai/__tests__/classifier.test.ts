import { describe, it, expect } from "vitest";
import { classifyChangeRequest, ClassificationError } from "../classifier";
import { verifyCitation, verifyAnalysisCitations } from "../citation-validator";
import { ChangeRequestAnalysisSchema } from "../classifier-schema";
import type { StructuredScopeBaseline } from "../schema";

const SAMPLE_AGREEMENT_TEXT = `
PROJECT MASTER SERVICES AGREEMENT
Effective Date: November 15, 2026
Client: Acme Corp
Provider: Demo Agency LLC

1. Scope of Work & Deliverables
Provider will deliver responsive website templates and brand components (Deliverable DEL-1).
All templates shall render properly across modern desktop and mobile browsers.

2. Exclusions
All copywriting, custom photography, stock photo licensing, and custom video production are explicitly excluded from this agreement.

3. Revisions and Feedback
Agreement includes two (2) rounds of revisions. Further revisions will be billed separately at $150 per hour.

4. Milestones and Timelines
Final delivery shall occur on December 30, 2026.
`;

const SAMPLE_CONFIRMED_BASELINE: StructuredScopeBaseline = {
  projectObjective: "Develop responsive website templates and brand components.",
  deliverables: [
    {
      id: "DEL-1",
      name: "Responsive Website Templates",
      description: "Templates and brand components supporting desktop and mobile browsers.",
      conditions: ["Modern browser compatibility"],
      source: {
        page: 1,
        section: "1. Scope of Work",
        excerpt: "Provider will deliver responsive website templates and brand components.",
        isInferred: false,
      },
    },
  ],
  exclusions: [
    {
      id: "EXC-1",
      description: "Copywriting, custom photography, and video production.",
      conditions: null,
      source: {
        page: 2,
        section: "2. Exclusions",
        excerpt: "All copywriting, custom photography, and stock photo licensing are explicitly excluded.",
        isInferred: false,
      },
    },
  ],
  revisionLimits: {
    includedCount: 2,
    definition: "Two rounds of revisions",
    restrictions: ["Additional revisions at $150/hr"],
    isSpecified: true,
    source: {
      page: 2,
      excerpt: "Agreement includes two (2) rounds of revisions. Further revisions will be billed separately.",
      isInferred: false,
    },
  },
  milestones: [
    {
      id: "MS-1",
      name: "Final Delivery",
      description: "Delivery of all templates",
      dueDate: "2026-12-30",
      associatedDeliverables: ["DEL-1"],
      source: {
        page: 2,
        excerpt: "Final delivery shall occur on December 30, 2026.",
        isInferred: false,
      },
    },
  ],
  acceptanceCriteria: [
    {
      id: "AC-1",
      criteria: "Cross-browser validation",
      associatedDeliverableId: "DEL-1",
      testingRequirements: "Desktop and mobile Safari, Chrome, Edge",
      source: {
        page: 1,
        excerpt: "All templates shall render properly across modern desktop and mobile browsers.",
        isInferred: false,
      },
    },
  ],
  paymentTerms: {
    totalAmount: "5000",
    currency: "USD",
    depositRequired: "50%",
    milestones: [
      { name: "Initial Deposit", amountOrPercentage: "50%", triggerCondition: "Signing" },
      { name: "Completion", amountOrPercentage: "50%", triggerCondition: "Final Delivery" },
    ],
    dueConditions: "Net 15",
    isSpecified: true,
    source: {
      page: 2,
      excerpt: "Billed separately at $150 per hour.",
      isInferred: false,
    },
  },
    timelines: {
    startDate: "2026-11-15",
    deliveryDeadlines: ["Final delivery December 30, 2026"],
    dependencies: ["Client asset delivery"],
    isSpecified: true,
    source: {
      page: 2,
      excerpt: "Final delivery shall occur on December 30, 2026.",
      isInferred: false,
    },
  },
  ambiguities: [],
};

describe("Scope Change Request Classifier & Intelligence Engine", () => {
  const mockConfig = { provider: "mock" as const };

  it("Scenario 1: Classifies defect fix and agreed deliverable as IN_SCOPE with verified citation", async () => {
    const result = await classifyChangeRequest(
      {
        clientRequest: "The mobile view has a layout bug on safari. Please fix the responsive templates.",
        baseline: SAMPLE_CONFIRMED_BASELINE,
        baselineVersion: 1,
        agreementText: SAMPLE_AGREEMENT_TEXT,
        totalPages: 2,
      },
      mockConfig
    );

    expect(result.classification).toBe("IN_SCOPE");
    expect(result.confidence).toBe("HIGH");
    expect(result.affectedDeliverables).toContain("DEL-1");
    expect(result.supportingEvidence.length).toBeGreaterThan(0);
    // Excerpt exists in SAMPLE_AGREEMENT_TEXT so it should be verified
    expect(result.supportingEvidence[0].isVerified).toBe(true);
    expect(result.baselineVersion).toBe(1);

    // Validate full object against Zod schema
    const parsed = ChangeRequestAnalysisSchema.safeParse(result);
    expect(parsed.success).toBe(true);
  });

  it("Scenario 2: Classifies explicitly excluded feature as OUT_OF_SCOPE with contractual evidence", async () => {
    const result = await classifyChangeRequest(
      {
        clientRequest: "We want you to produce custom video production and 3D animation for the header.",
        baseline: SAMPLE_CONFIRMED_BASELINE,
        baselineVersion: 1,
        agreementText: SAMPLE_AGREEMENT_TEXT,
        totalPages: 2,
      },
      mockConfig
    );

    expect(result.classification).toBe("OUT_OF_SCOPE");
    expect(result.confidence).toBe("HIGH");
    expect(result.affectedBaselineCategories).toContain("Exclusions");
    expect(result.clarificationQuestions.length).toBeGreaterThan(0);
    expect(result.supportingEvidence[0].isVerified).toBe(true);
  });

  it("Scenario 3: Classifies exceeded revision limit as OUT_OF_SCOPE", async () => {
    const result = await classifyChangeRequest(
      {
        clientRequest: "Please find attached our fourth revision round comments for the designs.",
        baseline: SAMPLE_CONFIRMED_BASELINE,
        baselineVersion: 1,
        agreementText: SAMPLE_AGREEMENT_TEXT,
        totalPages: 2,
      },
      mockConfig
    );

    expect(result.classification).toBe("OUT_OF_SCOPE");
    expect(result.affectedBaselineCategories).toContain("Revision Limits");
    expect(result.supportingEvidence[0].category).toBe("REVISION_LIMIT");
    expect(result.supportingEvidence[0].isVerified).toBe(true);
  });

  it("Scenario 4: Classifies silence / unmentioned feature as AMBIGUOUS without inventing exclusions", async () => {
    const result = await classifyChangeRequest(
      {
        clientRequest: "Can you integrate a real-time AI customer chatbot onto the contact page?",
        baseline: SAMPLE_CONFIRMED_BASELINE,
        baselineVersion: 1,
        agreementText: SAMPLE_AGREEMENT_TEXT,
        totalPages: 2,
      },
      mockConfig
    );

    // Accordly Core Principle: Absence of mention is NOT an exclusion. Silence must be AMBIGUOUS.
    expect(result.classification).toBe("AMBIGUOUS");
    expect(result.missingInformation.length).toBeGreaterThan(0);
    expect(result.clarificationQuestions.length).toBeGreaterThan(0);
    expect(result.reasoning).toContain("contractual silence cannot be assumed to be an exclusion");
  });

  it("Scenario 5: Algorithmic citation validation catches unverified and out-of-bounds citations", () => {
    // 5a: Excerpt not in text
    const bogusEvidence = {
      id: "EV-BOGUS",
      type: "SUPPORTING" as const,
      category: "DELIVERABLE" as const,
      page: 1,
      section: "1. Scope",
      verbatimExcerpt: "The provider shall build a blockchain bridge to Ethereum.",
      relevanceExplanation: "Claims blockchain is included.",
      isVerified: false,
    };

    const check1 = verifyCitation(bogusEvidence, SAMPLE_AGREEMENT_TEXT, 2);
    expect(check1.isVerified).toBe(false);
    expect(check1.foundInDocument).toBe(false);
    expect(check1.warning).toBeDefined();

    // 5b: Valid excerpt but page exceeds total pages
    const outOfBoundsEvidence = {
      id: "EV-PAGE-ERR",
      type: "SUPPORTING" as const,
      category: "DELIVERABLE" as const,
      page: 99,
      section: "1. Scope",
      verbatimExcerpt: "Provider will deliver responsive website templates",
      relevanceExplanation: "Valid quote but invalid page number.",
      isVerified: false,
    };

    const check2 = verifyCitation(outOfBoundsEvidence, SAMPLE_AGREEMENT_TEXT, 2);
    expect(check2.foundInDocument).toBe(true);
    expect(check2.pageValid).toBe(false);
    expect(check2.isVerified).toBe(false);
  });

  it("Scenario 6: Validates input length constraints and rejects too-short requests", async () => {
    await expect(
      classifyChangeRequest(
        {
          clientRequest: "fix", // only 3 chars, min is 5
          baseline: SAMPLE_CONFIRMED_BASELINE,
          baselineVersion: 1,
          agreementText: SAMPLE_AGREEMENT_TEXT,
        },
        mockConfig
      )
    ).rejects.toThrow(ClassificationError);
  });
});
