/**
 * Agreement Health Check — Deterministic 10-Category Commercial Rubric Engine.
 *
 * Evaluates a StructuredScopeBaseline (and optional extracted agreement text) across
 * 10 commercial dimensions using a documented deterministic scoring rubric (10 × 10 = 100 pts)
 * without making additional AI API calls.
 */

import type { StructuredScopeBaseline } from "@/lib/ai/schema";

export type HealthCategoryStatus = "STRONG" | "PARTIAL" | "MISSING";
export type OverallHealthBand = "STRONG" | "MODERATE" | "NEEDS_ATTENTION";

export interface AgreementHealthCategoryItem {
  id:
    | "DELIVERABLE_SPECIFICITY"
    | "SCOPE_EXCLUSIONS"
    | "REVISION_LIMITS"
    | "ACCEPTANCE_CRITERIA"
    | "PAYMENT_TERMS"
    | "PAYMENT_DEADLINES"
    | "PROJECT_MILESTONES"
    | "DELIVERY_TIMELINES"
    | "SCOPE_CHANGE_PROCEDURE"
    | "TERMINATION_AND_HANDOVER";
  number: number;
  title: string;
  status: HealthCategoryStatus;
  score: number; // 10 = STRONG, 5 = PARTIAL, 0 = MISSING
  maxScore: 10;
  summary: string;
  supportingExcerpts: string[];
  missingInformation: string | null;
  recommendation: string;
}

export interface AgreementHealthCheckResult {
  overallScore: number; // 0 to 100
  maxScore: 100;
  overallBand: OverallHealthBand;
  overallSummary: string;
  rubricFormula: string;
  disclaimer: string;
  categories: AgreementHealthCategoryItem[];
  ambiguities: Array<{
    id: string;
    issue: string;
    potentialImpact: string;
    excerpt?: string | null;
  }>;
  counts: {
    strongCount: number;
    partialCount: number;
    missingCount: number;
  };
}

export const COMMERCIAL_GUIDANCE_DISCLAIMER =
  "Commercial & Operational Guidance Only: This Agreement Health Check evaluates operational scope clarity and billing protection using a deterministic rubric. It does not constitute legal advice and does not assess legal validity or enforceability.";

/**
 * Helper to search baseline excerpts/descriptions and optional raw contract text for keywords.
 */
function findMatchingExcerpts(
  baseline: StructuredScopeBaseline,
  rawText: string | null | undefined,
  keywords: RegExp
): string[] {
  const matches: string[] = [];

  for (const d of baseline.deliverables || []) {
    const combined = `${d.name} ${d.description} ${(d.conditions || []).join(" ")} ${d.source?.excerpt || ""}`;
    if (keywords.test(combined) && d.source?.excerpt) {
      matches.push(d.source.excerpt);
    }
  }

  for (const e of baseline.exclusions || []) {
    const combined = `${e.description} ${e.conditions || ""} ${e.source?.excerpt || ""}`;
    if (keywords.test(combined) && e.source?.excerpt) {
      matches.push(e.source.excerpt);
    }
  }

  if (baseline.revisionLimits?.source?.excerpt && keywords.test(baseline.revisionLimits.source.excerpt)) {
    matches.push(baseline.revisionLimits.source.excerpt);
  }

  if (baseline.paymentTerms?.source?.excerpt && keywords.test(baseline.paymentTerms.source.excerpt)) {
    matches.push(baseline.paymentTerms.source.excerpt);
  }

  if (rawText && matches.length === 0) {
    const sentences = rawText
      .split(/(?<=[.!?])\s+|\n+/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 20 && s.length <= 320);

    for (const s of sentences) {
      if (keywords.test(s)) {
        matches.push(s);
        if (matches.length >= 2) break;
      }
    }
  }

  return Array.from(new Set(matches)).slice(0, 2);
}

/**
 * Evaluates a StructuredScopeBaseline across the 10 commercial dimensions.
 *
 * Scoring Rubric:
 * - 10 categories × 10 points max = 100 points total
 * - STRONG = 10 pts, PARTIAL = 5 pts, MISSING = 0 pts
 * - Overall Band: 80–100 = STRONG, 50–79 = MODERATE, 0–49 = NEEDS_ATTENTION
 */
export function evaluateAgreementHealth(
  baseline: StructuredScopeBaseline | null | undefined,
  rawAgreementText?: string | null
): AgreementHealthCheckResult {
  const safeBaseline: StructuredScopeBaseline = baseline || {
    projectObjective: "",
    deliverables: [],
    exclusions: [],
    revisionLimits: { isSpecified: false, restrictions: [] },
    milestones: [],
    acceptanceCriteria: [],
    paymentTerms: { isSpecified: false, milestones: [] },
    timelines: { isSpecified: false, deliveryDeadlines: [], dependencies: [] },
    ambiguities: [],
  };

  const categories: AgreementHealthCategoryItem[] = [];

  // 1. Deliverable Specificity
  const delivs = safeBaseline.deliverables || [];
  const detailedDelivs = delivs.filter(
    (d) => (d.description || "").trim().length >= 25 && Boolean(d.source?.excerpt)
  );
  if (delivs.length >= 2 && detailedDelivs.length === delivs.length) {
    categories.push({
      id: "DELIVERABLE_SPECIFICITY",
      number: 1,
      title: "Deliverable Specificity",
      status: "STRONG",
      score: 10,
      maxScore: 10,
      summary: `${delivs.length} concrete deliverables defined with detailed descriptions and verifiable contract excerpts.`,
      supportingExcerpts: delivs
        .map((d) => d.source?.excerpt)
        .filter((x): x is string => Boolean(x))
        .slice(0, 2),
      missingInformation: null,
      recommendation: "Deliverables are well-specified to anchor future scope comparisons.",
    });
  } else if (delivs.length >= 1) {
    categories.push({
      id: "DELIVERABLE_SPECIFICITY",
      number: 1,
      title: "Deliverable Specificity",
      status: "PARTIAL",
      score: 5,
      maxScore: 10,
      summary: `${delivs.length} deliverable(s) extracted, but some lack detailed boundaries or quantitative conditions.`,
      supportingExcerpts: delivs
        .map((d) => d.source?.excerpt)
        .filter((x): x is string => Boolean(x))
        .slice(0, 2),
      missingInformation: "Some deliverables have brief descriptions without explicit feature counts or technical boundaries.",
      recommendation: "Clarify exact counts (e.g. number of pages, endpoints, or templates) for each deliverable.",
    });
  } else {
    categories.push({
      id: "DELIVERABLE_SPECIFICITY",
      number: 1,
      title: "Deliverable Specificity",
      status: "MISSING",
      score: 0,
      maxScore: 10,
      summary: "No structured deliverables were found in the agreement.",
      supportingExcerpts: [],
      missingInformation: "Concrete list of project deliverables is missing.",
      recommendation: "Define each deliverable with measurable outputs before commencing work.",
    });
  }

  // 2. Scope Exclusions
  const exclusions = safeBaseline.exclusions || [];
  if (exclusions.length >= 2) {
    categories.push({
      id: "SCOPE_EXCLUSIONS",
      number: 2,
      title: "Scope Exclusions",
      status: "STRONG",
      score: 10,
      maxScore: 10,
      summary: `${exclusions.length} explicit out-of-scope exclusions protect against unpaid feature expansion.`,
      supportingExcerpts: exclusions
        .map((e) => e.source?.excerpt)
        .filter((x): x is string => Boolean(x))
        .slice(0, 2),
      missingInformation: null,
      recommendation: "Explicit exclusions are present and ready for automated out-of-scope detection.",
    });
  } else if (exclusions.length === 1) {
    categories.push({
      id: "SCOPE_EXCLUSIONS",
      number: 2,
      title: "Scope Exclusions",
      status: "PARTIAL",
      score: 5,
      maxScore: 10,
      summary: "1 explicit exclusion found; additional boundary exclusions could strengthen protection.",
      supportingExcerpts: exclusions
        .map((e) => e.source?.excerpt)
        .filter((x): x is string => Boolean(x))
        .slice(0, 1),
      missingInformation: "Only a single exclusion clause was identified.",
      recommendation: "Consider listing common adjacent requests (e.g. copywriting, third-party licenses, post-launch maintenance) as explicit exclusions.",
    });
  } else {
    categories.push({
      id: "SCOPE_EXCLUSIONS",
      number: 2,
      title: "Scope Exclusions",
      status: "MISSING",
      score: 0,
      maxScore: 10,
      summary: "No explicit out-of-scope exclusions specified in the agreement.",
      supportingExcerpts: [],
      missingInformation: "Contract lacks an explicit 'Out of Scope / Exclusions' clause.",
      recommendation: "Add an explicit exclusions section so adjacent client requests are unambiguously billable.",
    });
  }

  // 3. Revision Limits
  const rev = safeBaseline.revisionLimits;
  const hasRevCount = rev?.includedCount !== null && rev?.includedCount !== undefined && String(rev.includedCount).trim() !== "";
  if (rev?.isSpecified && hasRevCount && (rev.definition || (rev.restrictions && rev.restrictions.length > 0))) {
    categories.push({
      id: "REVISION_LIMITS",
      number: 3,
      title: "Revision Limits",
      status: "STRONG",
      score: 10,
      maxScore: 10,
      summary: `Revision cap (${rev.includedCount}) and revision definition/restrictions are explicitly stated.`,
      supportingExcerpts: rev.source?.excerpt ? [rev.source.excerpt] : [],
      missingInformation: null,
      recommendation: "Revision limits are clearly bounded.",
    });
  } else if (rev?.isSpecified || hasRevCount) {
    categories.push({
      id: "REVISION_LIMITS",
      number: 3,
      title: "Revision Limits",
      status: "PARTIAL",
      score: 5,
      maxScore: 10,
      summary: `Revisions mentioned (${rev?.includedCount ?? "specified"}), but what qualifies as a single revision round is not fully defined.`,
      supportingExcerpts: rev?.source?.excerpt ? [rev.source.excerpt] : [],
      missingInformation: "Clear distinction between minor feedback and structural re-work is missing.",
      recommendation: "Specify the exact number of included revision rounds and the hourly rate for additional rounds.",
    });
  } else {
    categories.push({
      id: "REVISION_LIMITS",
      number: 3,
      title: "Revision Limits",
      status: "MISSING",
      score: 0,
      maxScore: 10,
      summary: "No cap on client feedback or revision rounds was found.",
      supportingExcerpts: [],
      missingInformation: "Contract does not cap included revision rounds.",
      recommendation: "Add an explicit limit (e.g. 'Up to 2 rounds of consolidated revisions per deliverable') to prevent endless iteration.",
    });
  }

  // 4. Acceptance Criteria
  const criteria = safeBaseline.acceptanceCriteria || [];
  if (criteria.length >= 2) {
    categories.push({
      id: "ACCEPTANCE_CRITERIA",
      number: 4,
      title: "Acceptance Criteria",
      status: "STRONG",
      score: 10,
      maxScore: 10,
      summary: `${criteria.length} objective acceptance criteria defined for deliverable sign-off.`,
      supportingExcerpts: criteria
        .map((c) => c.source?.excerpt)
        .filter((x): x is string => Boolean(x))
        .slice(0, 2),
      missingInformation: null,
      recommendation: "Acceptance criteria provide clear sign-off conditions.",
    });
  } else if (criteria.length === 1) {
    categories.push({
      id: "ACCEPTANCE_CRITERIA",
      number: 4,
      title: "Acceptance Criteria",
      status: "PARTIAL",
      score: 5,
      maxScore: 10,
      summary: "1 acceptance criterion identified, but not all deliverables have explicit sign-off rules.",
      supportingExcerpts: criteria
        .map((c) => c.source?.excerpt)
        .filter((x): x is string => Boolean(x))
        .slice(0, 1),
      missingInformation: "Deliverable-specific acceptance testing or sign-off windows are incomplete.",
      recommendation: "Define objective acceptance criteria and a deemed-accepted window (e.g. 5 business days) for each deliverable.",
    });
  } else {
    categories.push({
      id: "ACCEPTANCE_CRITERIA",
      number: 4,
      title: "Acceptance Criteria",
      status: "MISSING",
      score: 0,
      maxScore: 10,
      summary: "No explicit deliverable acceptance or sign-off criteria found.",
      supportingExcerpts: [],
      missingInformation: "Contract lacks objective completion and sign-off criteria.",
      recommendation: "Define how deliverables are reviewed and approved so milestone completion cannot be indefinitely delayed.",
    });
  }

  // 5. Payment Terms
  const pay = safeBaseline.paymentTerms;
  const hasTotal = Boolean(pay?.totalAmount && pay.totalAmount.trim().length > 0);
  const hasPayMilestones = Array.isArray(pay?.milestones) && pay.milestones.length > 0;
  if (pay?.isSpecified && hasTotal && (hasPayMilestones || Boolean(pay?.depositRequired))) {
    categories.push({
      id: "PAYMENT_TERMS",
      number: 5,
      title: "Payment Terms",
      status: "STRONG",
      score: 10,
      maxScore: 10,
      summary: `Total fee (${pay.currency || ""} ${pay.totalAmount}) and payment schedule (${pay.milestones.length} installment(s)) are clearly specified.`,
      supportingExcerpts: pay.source?.excerpt ? [pay.source.excerpt] : [],
      missingInformation: null,
      recommendation: "Payment structure is well-defined.",
    });
  } else if (pay?.isSpecified || hasTotal || hasPayMilestones) {
    categories.push({
      id: "PAYMENT_TERMS",
      number: 5,
      title: "Payment Terms",
      status: "PARTIAL",
      score: 5,
      maxScore: 10,
      summary: "Payment terms are partially specified, but installment breakdown or deposit requirement is incomplete.",
      supportingExcerpts: pay?.source?.excerpt ? [pay.source.excerpt] : [],
      missingInformation: "Complete deposit or milestone payment schedule is not fully detailed.",
      recommendation: "Specify total contract price, currency, upfront deposit, and milestone payment schedule.",
    });
  } else {
    categories.push({
      id: "PAYMENT_TERMS",
      number: 5,
      title: "Payment Terms",
      status: "MISSING",
      score: 0,
      maxScore: 10,
      summary: "No structured fee or payment schedule was found in the agreement.",
      supportingExcerpts: [],
      missingInformation: "Total project fee and billing schedule are missing.",
      recommendation: "Include explicit pricing, currency, and deposit/milestone payment terms.",
    });
  }

  // 6. Payment Deadlines
  const hasDueConditions = Boolean(pay?.dueConditions && pay.dueConditions.trim().length > 0);
  const hasMilestoneTriggers = Array.isArray(pay?.milestones) && pay.milestones.some((m) => Boolean(m.triggerCondition?.trim()));
  if (hasDueConditions && hasMilestoneTriggers) {
    categories.push({
      id: "PAYMENT_DEADLINES",
      number: 6,
      title: "Payment Deadlines",
      status: "STRONG",
      score: 10,
      maxScore: 10,
      summary: `Invoice due conditions (${pay?.dueConditions}) and payment triggers are explicitly defined.`,
      supportingExcerpts: pay?.source?.excerpt ? [pay.source.excerpt] : [],
      missingInformation: null,
      recommendation: "Payment due dates and triggers are clearly established.",
    });
  } else if (hasDueConditions || hasMilestoneTriggers) {
    categories.push({
      id: "PAYMENT_DEADLINES",
      number: 6,
      title: "Payment Deadlines",
      status: "PARTIAL",
      score: 5,
      maxScore: 10,
      summary: `Payment triggers or due terms (${pay?.dueConditions || "milestone triggers"}) are partially stated.`,
      supportingExcerpts: pay?.source?.excerpt ? [pay.source.excerpt] : [],
      missingInformation: "Explicit net payment window (e.g. Due upon receipt or Net 14) or late-payment terms are incomplete.",
      recommendation: "Specify exact invoice payment deadlines (e.g. Net 7 or Net 14 days from invoice date).",
    });
  } else {
    categories.push({
      id: "PAYMENT_DEADLINES",
      number: 6,
      title: "Payment Deadlines",
      status: "MISSING",
      score: 0,
      maxScore: 10,
      summary: "No invoice payment due dates or net payment windows were found.",
      supportingExcerpts: [],
      missingInformation: "Invoice payment due dates (e.g. Net 14) are not specified.",
      recommendation: "Define clear payment deadlines for all invoices to prevent settlement delays.",
    });
  }

  // 7. Project Milestones
  const milestones = safeBaseline.milestones || [];
  const milestonesWithDates = milestones.filter((m) => Boolean(m.dueDate?.trim()));
  if (milestones.length >= 2 && milestonesWithDates.length >= 1) {
    categories.push({
      id: "PROJECT_MILESTONES",
      number: 7,
      title: "Project Milestones",
      status: "STRONG",
      score: 10,
      maxScore: 10,
      summary: `${milestones.length} project milestones defined with target dates and deliverable checkpoints.`,
      supportingExcerpts: milestones
        .map((m) => m.source?.excerpt)
        .filter((x): x is string => Boolean(x))
        .slice(0, 2),
      missingInformation: null,
      recommendation: "Milestones provide clear delivery checkpoints.",
    });
  } else if (milestones.length >= 1) {
    categories.push({
      id: "PROJECT_MILESTONES",
      number: 7,
      title: "Project Milestones",
      status: "PARTIAL",
      score: 5,
      maxScore: 10,
      summary: `${milestones.length} milestone(s) listed, but target dates or linked deliverables are incomplete.`,
      supportingExcerpts: milestones
        .map((m) => m.source?.excerpt)
        .filter((x): x is string => Boolean(x))
        .slice(0, 1),
      missingInformation: "Target completion dates for each milestone are not fully specified.",
      recommendation: "Assign target dates or relative durations (e.g. Week 2, Week 4) to each project milestone.",
    });
  } else {
    categories.push({
      id: "PROJECT_MILESTONES",
      number: 7,
      title: "Project Milestones",
      status: "MISSING",
      score: 0,
      maxScore: 10,
      summary: "No structured project milestones were extracted from the agreement.",
      supportingExcerpts: [],
      missingInformation: "Phased delivery milestones are missing.",
      recommendation: "Break the engagement into phased milestones tied to deliverable reviews and payments.",
    });
  }

  // 8. Delivery Timelines
  const time = safeBaseline.timelines;
  const hasStart = Boolean(time?.startDate?.trim());
  const hasDeadlines = Array.isArray(time?.deliveryDeadlines) && time.deliveryDeadlines.length > 0;
  if (time?.isSpecified && (hasStart || hasDeadlines) && (time.dependencies?.length || 0) > 0) {
    categories.push({
      id: "DELIVERY_TIMELINES",
      number: 8,
      title: "Delivery Timelines",
      status: "STRONG",
      score: 10,
      maxScore: 10,
      summary: "Delivery schedule, deadlines, and client dependencies are explicitly documented.",
      supportingExcerpts: time.source?.excerpt ? [time.source.excerpt] : [],
      missingInformation: null,
      recommendation: "Delivery schedule and dependencies are well-documented.",
    });
  } else if (time?.isSpecified || hasStart || hasDeadlines) {
    categories.push({
      id: "DELIVERY_TIMELINES",
      number: 8,
      title: "Delivery Timelines",
      status: "PARTIAL",
      score: 5,
      maxScore: 10,
      summary: "Delivery timeline is referenced, but client feedback dependencies or exact deadlines are incomplete.",
      supportingExcerpts: time?.source?.excerpt ? [time.source.excerpt] : [],
      missingInformation: "Impact of client delays on delivery deadlines is not explicitly stated.",
      recommendation: "State that delivery timelines depend on timely client asset delivery and feedback.",
    });
  } else {
    categories.push({
      id: "DELIVERY_TIMELINES",
      number: 8,
      title: "Delivery Timelines",
      status: "MISSING",
      score: 0,
      maxScore: 10,
      summary: "No project start date or delivery deadlines were specified.",
      supportingExcerpts: [],
      missingInformation: "Start date, target completion date, and timeline dependencies are missing.",
      recommendation: "Include an estimated schedule and state that client delays extend deadlines accordingly.",
    });
  }

  // 9. Scope-Change Procedure
  const changeKeywords =
    /change order|change request|additional work|out[- ]of[- ]scope|hourly rate|written approval|scope change|additional fee/i;
  const changeExcerpts = findMatchingExcerpts(safeBaseline, rawAgreementText, changeKeywords);
  if (changeExcerpts.length >= 1 && (exclusions.length >= 1 || rev?.isSpecified)) {
    categories.push({
      id: "SCOPE_CHANGE_PROCEDURE",
      number: 9,
      title: "Scope-Change Procedure",
      status: "STRONG",
      score: 10,
      maxScore: 10,
      summary: "Agreement references handling of additional work, change orders, or out-of-scope billing.",
      supportingExcerpts: changeExcerpts,
      missingInformation: null,
      recommendation: "Change-order procedure is supported by contractual language.",
    });
  } else if (changeExcerpts.length >= 1) {
    categories.push({
      id: "SCOPE_CHANGE_PROCEDURE",
      number: 9,
      title: "Scope-Change Procedure",
      status: "PARTIAL",
      score: 5,
      maxScore: 10,
      summary: "Additional work is mentioned, but a formal written change-order approval workflow is not fully detailed.",
      supportingExcerpts: changeExcerpts,
      missingInformation: "Formal written change-order sign-off and rate card are not explicitly detailed.",
      recommendation: "Specify that any out-of-scope work requires a written Change Proposal approved by the client before work begins.",
    });
  } else {
    categories.push({
      id: "SCOPE_CHANGE_PROCEDURE",
      number: 9,
      title: "Scope-Change Procedure",
      status: "MISSING",
      score: 0,
      maxScore: 10,
      summary: "No explicit scope-change or change-order procedure was detected.",
      supportingExcerpts: [],
      missingInformation: "Contract does not specify how out-of-scope requests are estimated, approved, and billed.",
      recommendation: "Add a Change Control clause requiring written approval and additional payment for out-of-scope requests.",
    });
  }

  // 10. Termination and Handover Provisions
  const termKeywords =
    /terminat|cancel|kill fee|handover|intellectual property|ownership|transfer upon payment|final payment|suspension/i;
  const termExcerpts = findMatchingExcerpts(safeBaseline, rawAgreementText, termKeywords);
  if (termExcerpts.length >= 2) {
    categories.push({
      id: "TERMINATION_AND_HANDOVER",
      number: 10,
      title: "Termination & Handover Provisions",
      status: "STRONG",
      score: 10,
      maxScore: 10,
      summary: "Termination notice and deliverable handover / IP transfer conditions are documented.",
      supportingExcerpts: termExcerpts,
      missingInformation: null,
      recommendation: "Termination and handover terms are documented.",
    });
  } else if (termExcerpts.length === 1) {
    categories.push({
      id: "TERMINATION_AND_HANDOVER",
      number: 10,
      title: "Termination & Handover Provisions",
      status: "PARTIAL",
      score: 5,
      maxScore: 10,
      summary: "Handover or termination is partially mentioned, but payment-on-termination or IP transfer triggers are incomplete.",
      supportingExcerpts: termExcerpts,
      missingInformation: "Explicit payment for work completed prior to termination or IP transfer upon final payment is incomplete.",
      recommendation: "Ensure final asset handover and IP transfer are conditioned on full settlement of all outstanding invoices.",
    });
  } else {
    categories.push({
      id: "TERMINATION_AND_HANDOVER",
      number: 10,
      title: "Termination & Handover Provisions",
      status: "MISSING",
      score: 0,
      maxScore: 10,
      summary: "No termination notice, kill-fee, or final handover provisions were detected in the extracted scope.",
      supportingExcerpts: [],
      missingInformation: "Termination notice period, payment for work-in-progress, and handover conditions are missing.",
      recommendation: "Add a termination clause protecting payment for work completed to date and conditioning final handover on full payment.",
    });
  }

  const overallScore = categories.reduce((sum, c) => sum + c.score, 0);
  const overallBand: OverallHealthBand =
    overallScore >= 80
      ? "STRONG"
      : overallScore >= 50
      ? "MODERATE"
      : "NEEDS_ATTENTION";

  const strongCount = categories.filter((c) => c.status === "STRONG").length;
  const partialCount = categories.filter((c) => c.status === "PARTIAL").length;
  const missingCount = categories.filter((c) => c.status === "MISSING").length;

  const overallSummary =
    overallBand === "STRONG"
      ? `Strong commercial baseline (${overallScore}/100): ${strongCount} of 10 commercial protection categories are well-specified.`
      : overallBand === "MODERATE"
      ? `Moderate commercial baseline (${overallScore}/100): ${strongCount} strong, ${partialCount} partial, and ${missingCount} missing categories identified.`
      : `Commercial weaknesses detected (${overallScore}/100): ${missingCount} categories are missing and ${partialCount} are only partially specified. Review recommendations before locking the baseline.`;

  const ambiguities = (safeBaseline.ambiguities || []).map((a) => ({
    id: a.id,
    issue: a.issue,
    potentialImpact: a.potentialImpact,
    excerpt: a.source?.excerpt ?? null,
  }));

  return {
    overallScore,
    maxScore: 100,
    overallBand,
    overallSummary,
    rubricFormula:
      "10 commercial categories × 10 pts max (STRONG = 10, PARTIAL = 5, MISSING = 0) = 100 pts total",
    disclaimer: COMMERCIAL_GUIDANCE_DISCLAIMER,
    categories,
    ambiguities,
    counts: {
      strongCount,
      partialCount,
      missingCount,
    },
  };
}

