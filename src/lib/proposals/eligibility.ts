/**
 * Change Proposal Eligibility Gating.
 *
 * Ensures commercial boundaries are respected:
 * - IN_SCOPE requests are blocked from auto-generating billable proposals without explicit override.
 * - AMBIGUOUS requests require explicit provider commercial justification.
 * - OUT_OF_SCOPE requests are permitted directly.
 * - Requests without confirmed baseline or completed analysis are strictly rejected.
 */

import type { ClassificationType } from "../ai/classifier-schema";

export interface ProposalEligibilityInput {
  classification: ClassificationType;
  hasConfirmedBaseline: boolean;
  hasCompletedAnalysis: boolean;
  providerJustification?: string;
  allowInScopeOverride?: boolean;
}

export interface ProposalEligibilityResult {
  isEligible: boolean;
  canProceed: boolean;
  classification: ClassificationType;
  requiresJustification: boolean;
  warning?: string;
  error?: string;
}

export function validateProposalEligibility(
  input: ProposalEligibilityInput
): ProposalEligibilityResult {
  const {
    classification,
    hasConfirmedBaseline,
    hasCompletedAnalysis,
    providerJustification,
    allowInScopeOverride,
  } = input;

  if (!hasConfirmedBaseline) {
    return {
      isEligible: false,
      canProceed: false,
      classification,
      requiresJustification: false,
      error: "Cannot create change proposal: Project must have an explicitly confirmed agreement baseline first.",
    };
  }

  if (!hasCompletedAnalysis) {
    return {
      isEligible: false,
      canProceed: false,
      classification,
      requiresJustification: false,
      error: "Cannot create change proposal: Change request must have a completed scope analysis.",
    };
  }

  // Handle IN_SCOPE
  if (classification === "IN_SCOPE") {
    if (!allowInScopeOverride) {
      return {
        isEligible: false,
        canProceed: false,
        classification,
        requiresJustification: false,
        warning:
          "This request is classified as IN_SCOPE (already covered by the agreed baseline). Generating a billable change proposal is blocked to prevent accidental double-billing. Enable provider override if drafting a zero-cost scope clarification.",
      };
    }
    return {
      isEligible: true,
      canProceed: true,
      classification,
      requiresJustification: false,
      warning:
        "Proceeding with proposal drafting for an IN_SCOPE request under provider override.",
    };
  }

  // Handle AMBIGUOUS
  if (classification === "AMBIGUOUS") {
    const hasValidJustification =
      Boolean(providerJustification) && providerJustification!.trim().length >= 10;

    if (!hasValidJustification) {
      return {
        isEligible: true,
        canProceed: false,
        classification,
        requiresJustification: true,
        warning:
          "This request was classified as AMBIGUOUS. The original agreement is silent or unclear on this scope. A commercial justification (minimum 10 characters) is required from the provider before a change proposal can be drafted.",
      };
    }

    return {
      isEligible: true,
      canProceed: true,
      classification,
      requiresJustification: true,
    };
  }

  // Handle OUT_OF_SCOPE
  return {
    isEligible: true,
    canProceed: true,
    classification,
    requiresJustification: false,
  };
}
