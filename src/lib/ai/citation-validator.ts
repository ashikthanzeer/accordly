/**
 * Citation and Evidence Verification Service.
 *
 * Validates whether AI-generated evidence citations and verbatim excerpts
 * genuinely exist within the source agreement text, preventing fabricated
 * citations from entering authoritative records.
 */

import type { AnalysisEvidenceItem, ChangeRequestAnalysisResult } from "./classifier-schema";

/**
 * Normalizes text for substring search by collapsing whitespace and punctuation variations.
 */
export function normalizeForSearch(text: string): string {
  return text
    .toLowerCase()
    .replace(/["'""'']/g, "") // strip quotes
    .replace(/[^\w\s]/g, " ") // replace punctuation with space
    .replace(/\s+/g, " ")
    .trim();
}

export interface CitationCheckResult {
  isVerified: boolean;
  foundInDocument: boolean;
  pageValid: boolean;
  warning?: string;
}

/**
 * Checks an individual evidence item against the source agreement text.
 */
export function verifyCitation(
  evidence: AnalysisEvidenceItem,
  agreementText: string,
  totalPages?: number
): CitationCheckResult {
  if (!evidence.verbatimExcerpt || evidence.verbatimExcerpt.trim().length === 0) {
    return {
      isVerified: false,
      foundInDocument: false,
      pageValid: false,
      warning: "Empty verbatim excerpt.",
    };
  }

  const normAgreement = normalizeForSearch(agreementText);
  const normExcerpt = normalizeForSearch(evidence.verbatimExcerpt);

  // Check substring existence in agreement
  const foundInDocument = normAgreement.includes(normExcerpt);

  // Check page validity if provided
  let pageValid = true;
  if (typeof evidence.page === "number" && evidence.page > 0) {
    if (typeof totalPages === "number" && totalPages > 0) {
      pageValid = evidence.page <= totalPages;
    }
  }

  const isVerified = foundInDocument && pageValid;

  let warning: string | undefined;
  if (!foundInDocument) {
    warning = `Excerpt could not be verified in the source agreement: "${evidence.verbatimExcerpt.slice(0, 60)}..."`;
  } else if (!pageValid) {
    warning = `Referenced page ${evidence.page} exceeds document total pages (${totalPages}).`;
  }

  return {
    isVerified,
    foundInDocument,
    pageValid,
    warning,
  };
}

/**
 * Validates all evidence items in a ChangeRequestAnalysisResult.
 * Updates each item's `isVerified` flag and notes any discrepancies.
 */
export function verifyAnalysisCitations(
  analysis: ChangeRequestAnalysisResult,
  agreementText: string,
  totalPages?: number
): ChangeRequestAnalysisResult {
  const verifiedSupporting: AnalysisEvidenceItem[] = [];
  const verifiedContradicting: AnalysisEvidenceItem[] = [];
  let unverifiedCount = 0;

  for (const item of analysis.supportingEvidence) {
    const check = verifyCitation(item, agreementText, totalPages);
    if (!check.isVerified) unverifiedCount++;
    verifiedSupporting.push({
      ...item,
      isVerified: check.isVerified,
      relevanceExplanation: check.warning
        ? `${item.relevanceExplanation} [Verification Warning: ${check.warning}]`
        : item.relevanceExplanation,
    });
  }

  for (const item of analysis.contradictingEvidence) {
    const check = verifyCitation(item, agreementText, totalPages);
    if (!check.isVerified) unverifiedCount++;
    verifiedContradicting.push({
      ...item,
      isVerified: check.isVerified,
      relevanceExplanation: check.warning
        ? `${item.relevanceExplanation} [Verification Warning: ${check.warning}]`
        : item.relevanceExplanation,
    });
  }

  // Adjust confidence if unverified citations are present
  let adjustedConfidence = analysis.confidence;
  let updatedLimitations = analysis.limitations;

  if (unverifiedCount > 0) {
    if (adjustedConfidence === "HIGH") adjustedConfidence = "MEDIUM";
    updatedLimitations = `${analysis.limitations} Notice: ${unverifiedCount} cited excerpt(s) could not be verified directly in the source agreement text.`;
  }

  return {
    ...analysis,
    supportingEvidence: verifiedSupporting,
    contradictingEvidence: verifiedContradicting,
    confidence: adjustedConfidence,
    limitations: updatedLimitations,
  };
}

