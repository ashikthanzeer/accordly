import { describe, it, expect } from "vitest";
import { validateProposalEligibility } from "../eligibility";
import {
  draftProposalContent,
  ProposalDraftSchema,
} from "../../ai/proposal-drafter";
import type { ChangeRequestAnalysisResult } from "../../ai/classifier-schema";

const SAMPLE_OUT_OF_SCOPE_ANALYSIS: ChangeRequestAnalysisResult = {
  classification: "OUT_OF_SCOPE",
  summary: "Client request for video production is explicitly excluded under Section 2.",
  reasoning: "Section 2 explicitly excludes custom photography and video production.",
  supportingEvidence: [],
  contradictingEvidence: [],
  missingInformation: [],
  clarificationQuestions: [
    "Would client like an itemized proposal for custom video production?",
  ],
  affectedDeliverables: [],
  affectedBaselineCategories: ["Exclusions"],
  confidence: "HIGH",
  limitations: "Explicit exclusion clause identified.",
  baselineVersion: 1,
  reviewStatus: "REVIEWED",
};

const SAMPLE_AMBIGUOUS_ANALYSIS: ChangeRequestAnalysisResult = {
  classification: "AMBIGUOUS",
  summary: "Contract is silent regarding chatbot integration.",
  reasoning: "Chatbots are neither included as deliverables nor excluded in Section 2.",
  supportingEvidence: [],
  contradictingEvidence: [],
  missingInformation: ["No contract clause specifies chatbot functionality."],
  clarificationQuestions: ["Is this intended as an add-on or separate project?"],
  affectedDeliverables: [],
  affectedBaselineCategories: ["Deliverables"],
  confidence: "MEDIUM",
  limitations: "Absence of mention is not proof of exclusion.",
  baselineVersion: 1,
  reviewStatus: "REVIEWED",
};

describe("Change Proposal Eligibility & Commercial Decision Engine", () => {
  it("blocks IN_SCOPE requests from auto-generating chargeable proposals without override", () => {
    const check = validateProposalEligibility({
      classification: "IN_SCOPE",
      hasConfirmedBaseline: true,
      hasCompletedAnalysis: true,
      allowInScopeOverride: false,
    });

    expect(check.canProceed).toBe(false);
    expect(check.isEligible).toBe(false);
    expect(check.warning).toContain("blocked to prevent accidental double-billing");
  });

  it("permits IN_SCOPE proposal creation when provider explicitly provides override", () => {
    const check = validateProposalEligibility({
      classification: "IN_SCOPE",
      hasConfirmedBaseline: true,
      hasCompletedAnalysis: true,
      allowInScopeOverride: true,
    });

    expect(check.canProceed).toBe(true);
    expect(check.isEligible).toBe(true);
    expect(check.warning).toContain("under provider override");
  });

  it("requires a commercial justification for AMBIGUOUS requests before proceeding", () => {
    // Missing justification
    const check1 = validateProposalEligibility({
      classification: "AMBIGUOUS",
      hasConfirmedBaseline: true,
      hasCompletedAnalysis: true,
      providerJustification: "",
    });

    expect(check1.canProceed).toBe(false);
    expect(check1.requiresJustification).toBe(true);
    expect(check1.warning).toContain("commercial justification (minimum 10 characters) is required");

    // Valid justification
    const check2 = validateProposalEligibility({
      classification: "AMBIGUOUS",
      hasConfirmedBaseline: true,
      hasCompletedAnalysis: true,
      providerJustification: "Third-party AI API and token costs were never included in the initial contract.",
    });

    expect(check2.canProceed).toBe(true);
  });

  it("permits OUT_OF_SCOPE requests directly without requiring special override", () => {
    const check = validateProposalEligibility({
      classification: "OUT_OF_SCOPE",
      hasConfirmedBaseline: true,
      hasCompletedAnalysis: true,
    });

    expect(check.canProceed).toBe(true);
    expect(check.isEligible).toBe(true);
  });

  it("strictly rejects proposal creation if project baseline is not confirmed", () => {
    const check = validateProposalEligibility({
      classification: "OUT_OF_SCOPE",
      hasConfirmedBaseline: false,
      hasCompletedAnalysis: true,
    });

    expect(check.canProceed).toBe(false);
    expect(check.error).toContain("must have an explicitly confirmed agreement baseline");
  });

  it("strictly rejects proposal creation if change request analysis is incomplete", () => {
    const check = validateProposalEligibility({
      classification: "OUT_OF_SCOPE",
      hasConfirmedBaseline: true,
      hasCompletedAnalysis: false,
    });

    expect(check.canProceed).toBe(false);
    expect(check.error).toContain("must have a completed scope analysis");
  });
});

describe("AI Proposal Drafting Service & Guardrails", () => {
  it("drafts structured proposal deliverables and assumptions while strictly omitting prices", async () => {
    const draft = await draftProposalContent(
      {
        clientRequest: "We need 3 custom promotional videos and 3D animations for the launch.",
        analysis: SAMPLE_OUT_OF_SCOPE_ANALYSIS,
      },
      { provider: "mock" }
    );

    // Validate draft against Zod schema
    const parsed = ProposalDraftSchema.safeParse(draft);
    expect(parsed.success).toBe(true);

    expect(draft.title).toContain("Video Production");
    expect(draft.deliverables.length).toBeGreaterThan(0);
    expect(draft.assumptions.length).toBeGreaterThan(0);
    expect(draft.exclusions.length).toBeGreaterThan(0);
    expect(draft.timelineImpact).toBeDefined();

    // Guardrail verification: Proposal draft object must NOT contain financial price properties
    expect((draft as any).price).toBeUndefined();
    expect((draft as any).totalAmount).toBeUndefined();
    expect((draft as any).currency).toBeUndefined();
  });
});
