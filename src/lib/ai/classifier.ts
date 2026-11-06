/**
 * Scope Change Request Classification Service.
 *
 * Coordinates prompt building, AI model invocation, JSON schema validation,
 * citation evidence verification, and deterministic test fixtures.
 */

import { buildScopeClassificationPrompt } from "./classifier-prompts";
import {
  ChangeRequestAnalysisSchema,
  type ChangeRequestAnalysisResult,
  type ClassificationType,
} from "./classifier-schema";
import { verifyAnalysisCitations } from "./citation-validator";
import { completePrompt, type AiClientConfig, getAiConfig } from "./provider";
import type { StructuredScopeBaseline } from "./schema";

export class ClassificationError extends Error {
  constructor(message: string, public rawResponse?: string, public details?: unknown) {
    super(`[ClassificationError] ${message}`);
    this.name = "ClassificationError";
  }
}

export interface ClassifyRequestInput {
  clientRequest: string;
  baseline: StructuredScopeBaseline;
  baselineVersion: number;
  agreementText: string;
  totalPages?: number;
}

/**
 * Strips code fences and extra non-JSON markdown wrappers.
 */
function cleanJsonOutput(raw: string): string {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.slice(3);
  }

  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3);
  }

  return cleaned.trim();
}

/**
 * Classifies a new client request against the confirmed scope baseline.
 */
export async function classifyChangeRequest(
  input: ClassifyRequestInput,
  customConfig?: AiClientConfig
): Promise<ChangeRequestAnalysisResult> {
  const reqText = input.clientRequest?.trim();
  if (!reqText || reqText.length < 5) {
    throw new ClassificationError("Client request is too short (minimum 5 characters).");
  }

  const config = customConfig || getAiConfig();

  let rawContent: string;
  let modelUsed = config.model || "mock-classifier-v1";
  let promptVersion = "v1.0";

  if (config.provider === "mock") {
    rawContent = generateDeterministicClassificationMock(input);
  } else {
    const { systemPrompt, userPrompt } = buildScopeClassificationPrompt(
      reqText,
      input.baseline,
      input.agreementText
    );

    const completion = await completePrompt(systemPrompt, userPrompt, config);
    rawContent = completion.content;
    modelUsed = completion.model;
  }

  const cleaned = cleanJsonOutput(rawContent);

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(cleaned);
  } catch (err: unknown) {
    throw new ClassificationError(
      `Model response did not contain valid JSON: ${err instanceof Error ? err.message : String(err)}`,
      rawContent
    );
  }

  // Inject metadata
  if (typeof parsedJson === "object" && parsedJson !== null) {
    (parsedJson as Record<string, unknown>).baselineVersion = input.baselineVersion;
    (parsedJson as Record<string, unknown>).analysisModel = modelUsed;
    (parsedJson as Record<string, unknown>).promptVersion = promptVersion;
  }

  const parsed = ChangeRequestAnalysisSchema.safeParse(parsedJson);
  if (!parsed.success) {
    throw new ClassificationError(
      `Classification result failed schema validation: ${parsed.error.message}`,
      rawContent,
      parsed.error.format()
    );
  }

  // Algorithmic Citation Verification: Verify excerpts exist in agreement text
  const verifiedAnalysis = verifyAnalysisCitations(
    parsed.data,
    input.agreementText,
    input.totalPages
  );

  return verifiedAnalysis;
}

/**
 * Generates deterministic, grounded mock classifications for testing different contract scenarios.
 */
function generateDeterministicClassificationMock(input: ClassifyRequestInput): string {
  const req = input.clientRequest.toLowerCase();

  // Scenario 1: Clearly IN_SCOPE (e.g. bug fixes, agreed deliverable, mobile styling)
  if (
    req.includes("fix") ||
    req.includes("bug") ||
    req.includes("mobile") ||
    req.includes("responsive") ||
    req.includes("template")
  ) {
    return JSON.stringify({
      classification: "IN_SCOPE" as ClassificationType,
      summary: "Request is covered under agreed front-end deliverable DEL-1 (responsive templates & defect resolution).",
      reasoning:
        "The client is requesting responsive layout adjustments and styling fixes. Deliverable DEL-1 explicitly obligates the provider to deliver responsive website templates supporting desktop and mobile viewports.",
      supportingEvidence: [
        {
          id: "EV-1",
          type: "SUPPORTING",
          category: "DELIVERABLE",
          page: 1,
          section: "1. Scope of Work",
          verbatimExcerpt: "Provider will deliver responsive website templates and brand components.",
          relevanceExplanation: "Directly covers responsive template behavior across viewports.",
          isVerified: false,
        },
      ],
      contradictingEvidence: [],
      missingInformation: [],
      clarificationQuestions: [],
      affectedDeliverables: ["DEL-1"],
      affectedBaselineCategories: ["Deliverables"],
      confidence: "HIGH",
      limitations: "Work is covered under agreed DEL-1 scope; no additional fee should be billed.",
    });
  }

  // Scenario 2: Explicitly OUT_OF_SCOPE (e.g. video production, 3d animation, copywriting)
  if (
    req.includes("video") ||
    req.includes("3d") ||
    req.includes("animation") ||
    req.includes("copywriting") ||
    req.includes("photography")
  ) {
    return JSON.stringify({
      classification: "OUT_OF_SCOPE" as ClassificationType,
      summary: "Request is explicitly excluded under contract Section 2 (Exclusions).",
      reasoning:
        "The client request specifies custom video or asset creation. Contract Section 2 expressly excludes custom video production, copywriting, and 3D animation assets from the agreement scope.",
      supportingEvidence: [
        {
          id: "EV-EXC-1",
          type: "SUPPORTING",
          category: "EXCLUSION",
          page: 2,
          section: "2. Exclusions",
          verbatimExcerpt:
            "All copywriting, custom photography, stock photo licensing, and custom video production are explicitly excluded from this agreement.",
          relevanceExplanation: "Identifies that creative asset production, video, and copywriting are outside the contracted scope.",
          isVerified: false,
        },
      ],
      contradictingEvidence: [],
      missingInformation: [],
      clarificationQuestions: [
        "Would the client like an itemized change order with an estimated quote for this excluded service?",
      ],
      affectedDeliverables: [],
      affectedBaselineCategories: ["Exclusions"],
      confidence: "HIGH",
      limitations: "Affirmative exclusion clause identified in contract text.",
    });
  }

  // Scenario 3: Exceeded Revision Limits (e.g. 4th revision round, additional rounds)
  if (
    req.includes("fourth revision") ||
    req.includes("4th revision") ||
    req.includes("third round") ||
    req.includes("extra revisions")
  ) {
    return JSON.stringify({
      classification: "OUT_OF_SCOPE" as ClassificationType,
      summary: "Request exceeds the contractual limit of two (2) revision rounds.",
      reasoning:
        "Contract Section 3 limits included revisions to two rounds. Additional revisions must be billed at the standard rate of $150/hour as an additional change order.",
      supportingEvidence: [
        {
          id: "EV-REV-1",
          type: "SUPPORTING",
          category: "REVISION_LIMIT",
          page: 2,
          section: "3. Revisions",
          verbatimExcerpt: "Agreement includes two (2) rounds of revisions. Further revisions will be billed separately.",
          relevanceExplanation: "Sets the explicit revision boundary at two rounds.",
          isVerified: false,
        },
      ],
      contradictingEvidence: [],
      missingInformation: [],
      clarificationQuestions: [
        "Confirm whether the client approves billing additional revision hours at $150/hr.",
      ],
      affectedDeliverables: ["DEL-1"],
      affectedBaselineCategories: ["Revision Limits"],
      confidence: "HIGH",
      limitations: "Contract specifies explicit two-round revision cap.",
    });
  }

  // Scenario 4: AMBIGUOUS (e.g. unmentioned features, translation, mobile app, vague terms)
  return JSON.stringify({
    classification: "AMBIGUOUS" as ClassificationType,
    summary: "Request is not explicitly addressed in deliverables or exclusions; contract silence requires clarification.",
    reasoning:
      "The client request touches on functionality that is neither listed as an agreed deliverable nor explicitly excluded in Section 2. Under Accordly's core principles, contractual silence cannot be assumed to be an exclusion. The scope boundary must be clarified with the client.",
    supportingEvidence: [],
    contradictingEvidence: [],
    missingInformation: [
      "No contractual clause defines scope for this capability.",
      "Contract does not specify whether third-party integration or translation is within scope.",
    ],
    clarificationQuestions: [
      "Is this requested feature intended as an addition to the current project or a separate future phase?",
      "Does the client expect this work within the current $5,000 fixed price?",
    ],
    affectedDeliverables: [],
    affectedBaselineCategories: ["Ambiguities", "Deliverables"],
    confidence: "MEDIUM",
    limitations: "Ambiguity detected: absence of mention is not proof of exclusion.",
  });
}
