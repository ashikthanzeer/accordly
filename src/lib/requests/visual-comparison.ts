/**
 * Visual Scope Comparison — Pure Evidence & Baseline Alignment Engine.
 *
 * Aligns a confirmed StructuredScopeBaseline and original agreement metadata with
 * an analyzed client ChangeRequest without fabricating citations, page numbers,
 * or contract clauses.
 */

import type { StructuredScopeBaseline, DeliverableItem, ExclusionItem } from "@/lib/ai/schema";
import type { ChangeRequestAnalysisResult, AnalysisEvidenceItem, ClassificationType } from "@/lib/ai/classifier-schema";

export interface BaselineClauseComparisonItem {
  id: string;
  category: "DELIVERABLE" | "EXCLUSION" | "REVISION_LIMIT" | "TIMELINE" | "PAYMENT_TERMS";
  title: string;
  description: string;
  excerpt: string;
  page?: number | null;
  section?: string | null;
  isDirectlyReferenced: boolean;
}

export interface EvidenceBreakdownItem {
  id: string;
  alignment: "COVERED_IN_BASELINE" | "OUTSIDE_OR_EXCLUDED" | "AMBIGUOUS_OR_CONFLICT";
  category: string;
  agreementName: string;
  verbatimExcerpt: string;
  page?: number | null;
  section?: string | null;
  relevanceExplanation: string;
  isVerified: boolean;
}

export interface VisualScopeComparisonModel {
  agreementName: string;
  baselineVersion: number;
  leftBaselineClauses: BaselineClauseComparisonItem[];
  rightRequest: {
    sourceText: string;
    characterCount: number;
    hasMixedSignals: boolean;
    affectedDeliverables: string[];
    affectedBaselineCategories: string[];
  };
  aiAssessment: {
    classification: ClassificationType;
    confidence: string;
    summary: string;
    reasoning: string;
    evidenceItems: EvidenceBreakdownItem[];
    missingInformation: string[];
    clarificationQuestions: string[];
    hasExplicitExclusion: boolean;
    isSilentContract: boolean;
  };
  providerDecision: {
    reviewStatus: "PENDING_REVIEW" | "REVIEWED";
    reviewedAt?: string | null;
    providerNotes?: string | null;
    hasProviderOverride: boolean;
    overrideJustification?: string | null;
  };
}

/**
 * Builds a deterministic, traceable VisualScopeComparisonModel from persisted baseline and analysis records.
 */
export function buildVisualScopeComparisonModel(params: {
  agreementName?: string | null;
  baselineVersion?: number | null;
  structuredBaseline?: StructuredScopeBaseline | null;
  sourceText: string;
  analysis: ChangeRequestAnalysisResult & {
    reviewStatus?: "PENDING_REVIEW" | "REVIEWED";
    reviewedAt?: string | null;
    providerNotes?: string | null;
    providerOverride?: {
      overriddenAt?: string;
      justification?: string;
      allowInScopeOverride?: boolean;
    } | null;
  };
}): VisualScopeComparisonModel {
  const agreementName = params.agreementName?.trim() || "Signed Project Agreement";
  const baselineVersion = params.baselineVersion || params.analysis?.baselineVersion || 1;
  const baseline = params.structuredBaseline || null;
  const analysis = params.analysis;

  const affectedDeliverableSet = new Set(
    (analysis.affectedDeliverables || []).map((d) => d.trim().toLowerCase())
  );
  const affectedCategorySet = new Set(
    (analysis.affectedBaselineCategories || []).map((c) => c.trim().toUpperCase())
  );

  // Also check verbatim excerpts in supporting & contradicting evidence for matching baseline items
  const allEvidenceExcerpts = [
    ...(analysis.supportingEvidence || []),
    ...(analysis.contradictingEvidence || []),
  ].map((ev) => (ev.verbatimExcerpt || "").trim().toLowerCase());

  const isExcerptReferenced = (excerpt?: string | null, name?: string | null): boolean => {
    const normExcerpt = (excerpt || "").trim().toLowerCase();
    const normName = (name || "").trim().toLowerCase();
    if (normName && affectedDeliverableSet.has(normName)) return true;
    if (!normExcerpt) return false;
    return allEvidenceExcerpts.some(
      (evEx) => evEx.length > 10 && (normExcerpt.includes(evEx) || evEx.includes(normExcerpt))
    );
  };

  const leftBaselineClauses: BaselineClauseComparisonItem[] = [];

  if (baseline) {
    // 1. Deliverables
    for (const deliv of baseline.deliverables || []) {
      const referenced =
        isExcerptReferenced(deliv.source?.excerpt, deliv.name) ||
        affectedDeliverableSet.has(deliv.id.toLowerCase()) ||
        affectedCategorySet.has("DELIVERABLE");

      leftBaselineClauses.push({
        id: deliv.id,
        category: "DELIVERABLE",
        title: deliv.name,
        description: deliv.description,
        excerpt: deliv.source?.excerpt || deliv.description,
        page: deliv.source?.page ?? null,
        section: deliv.source?.section ?? null,
        isDirectlyReferenced: referenced,
      });
    }

    // 2. Exclusions
    for (const excl of baseline.exclusions || []) {
      const referenced =
        isExcerptReferenced(excl.source?.excerpt, excl.description) ||
        affectedCategorySet.has("EXCLUSION");

      leftBaselineClauses.push({
        id: excl.id,
        category: "EXCLUSION",
        title: "Explicit Scope Exclusion",
        description: excl.description,
        excerpt: excl.source?.excerpt || excl.description,
        page: excl.source?.page ?? null,
        section: excl.source?.section ?? null,
        isDirectlyReferenced: referenced,
      });
    }

    // 3. Revision Limits
    if (baseline.revisionLimits?.isSpecified && baseline.revisionLimits.source?.excerpt) {
      leftBaselineClauses.push({
        id: "rev_limits",
        category: "REVISION_LIMIT",
        title: `Revision Limits (${baseline.revisionLimits.includedCount ?? "Specified"})`,
        description:
          baseline.revisionLimits.definition ||
          (baseline.revisionLimits.restrictions || []).join("; ") ||
          "Contractual revision cap",
        excerpt: baseline.revisionLimits.source.excerpt,
        page: baseline.revisionLimits.source.page ?? null,
        section: baseline.revisionLimits.source.section ?? null,
        isDirectlyReferenced:
          isExcerptReferenced(baseline.revisionLimits.source.excerpt, null) ||
          affectedCategorySet.has("REVISION_LIMIT"),
      });
    }
  }

  // Sort directly referenced baseline clauses first so the most relevant clauses appear at top left
  leftBaselineClauses.sort((a, b) => {
    if (a.isDirectlyReferenced && !b.isDirectlyReferenced) return -1;
    if (!a.isDirectlyReferenced && b.isDirectlyReferenced) return 1;
    return 0;
  });

  // Build traceable evidence items
  const evidenceItems: EvidenceBreakdownItem[] = [];
  let hasExplicitExclusion = false;

  for (const ev of analysis.supportingEvidence || []) {
    if (ev.category === "EXCLUSION") {
      hasExplicitExclusion = true;
    }

    const alignment: EvidenceBreakdownItem["alignment"] =
      ev.category === "EXCLUSION" || analysis.classification === "OUT_OF_SCOPE"
        ? "OUTSIDE_OR_EXCLUDED"
        : analysis.classification === "IN_SCOPE"
        ? "COVERED_IN_BASELINE"
        : "AMBIGUOUS_OR_CONFLICT";

    evidenceItems.push({
      id: ev.id,
      alignment,
      category: ev.category,
      agreementName,
      verbatimExcerpt: ev.verbatimExcerpt,
      page: ev.page ?? null,
      section: ev.section ?? null,
      relevanceExplanation: ev.relevanceExplanation,
      isVerified: Boolean(ev.isVerified),
    });
  }

  for (const ce of analysis.contradictingEvidence || []) {
    if (ce.category === "EXCLUSION") {
      hasExplicitExclusion = true;
    }

    evidenceItems.push({
      id: ce.id,
      alignment: "AMBIGUOUS_OR_CONFLICT",
      category: ce.category,
      agreementName,
      verbatimExcerpt: ce.verbatimExcerpt,
      page: ce.page ?? null,
      section: ce.section ?? null,
      relevanceExplanation: ce.relevanceExplanation,
      isVerified: Boolean(ce.isVerified),
    });
  }

  const hasMixedSignals =
    (analysis.supportingEvidence?.length || 0) > 0 &&
    (analysis.contradictingEvidence?.length || 0) > 0;

  const isSilentContract = evidenceItems.length === 0;

  const reviewStatus = analysis.reviewStatus || "PENDING_REVIEW";
  const hasProviderOverride = Boolean(
    analysis.providerOverride?.allowInScopeOverride ||
      analysis.providerOverride?.justification
  );

  return {
    agreementName,
    baselineVersion,
    leftBaselineClauses,
    rightRequest: {
      sourceText: params.sourceText,
      characterCount: (params.sourceText || "").length,
      hasMixedSignals,
      affectedDeliverables: analysis.affectedDeliverables || [],
      affectedBaselineCategories: analysis.affectedBaselineCategories || [],
    },
    aiAssessment: {
      classification: analysis.classification,
      confidence: analysis.confidence,
      summary: analysis.summary,
      reasoning: analysis.reasoning,
      evidenceItems,
      missingInformation: analysis.missingInformation || [],
      clarificationQuestions: analysis.clarificationQuestions || [],
      hasExplicitExclusion,
      isSilentContract,
    },
    providerDecision: {
      reviewStatus,
      reviewedAt: analysis.reviewedAt ?? null,
      providerNotes: analysis.providerNotes ?? null,
      hasProviderOverride,
      overrideJustification: analysis.providerOverride?.justification ?? null,
    },
  };
}

