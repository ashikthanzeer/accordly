/**
 * Zod runtime schemas and types for Change Request Scope Analysis & Classification.
 */

import { z } from "zod";

export const ClassificationTypeSchema = z.enum(["IN_SCOPE", "OUT_OF_SCOPE", "AMBIGUOUS"]);
export type ClassificationType = z.infer<typeof ClassificationTypeSchema>;

export const ConfidenceLevelSchema = z.enum(["HIGH", "MEDIUM", "LOW"]);
export type ConfidenceLevel = z.infer<typeof ConfidenceLevelSchema>;

export const EvidenceCategorySchema = z.enum([
  "DELIVERABLE",
  "EXCLUSION",
  "REVISION_LIMIT",
  "MILESTONE",
  "ACCEPTANCE_CRITERIA",
  "PAYMENT_TERMS",
  "TIMELINE",
  "GENERAL_CONTRACT",
]);
export type EvidenceCategory = z.infer<typeof EvidenceCategorySchema>;

export const EvidenceTypeSchema = z.enum(["SUPPORTING", "CONTRADICTING", "NEUTRAL"]);
export type EvidenceType = z.infer<typeof EvidenceTypeSchema>;

export const AnalysisEvidenceItemSchema = z.object({
  id: z.string().min(1),
  type: EvidenceTypeSchema,
  category: EvidenceCategorySchema,
  sourceDocumentId: z.string().optional().nullable(),
  page: z.number().int().positive().optional().nullable(),
  section: z.string().optional().nullable(),
  verbatimExcerpt: z.string().min(1, "Excerpt cannot be empty"),
  relevanceExplanation: z.string().min(1, "Relevance explanation is required"),
  isVerified: z.boolean().default(false),
});
export type AnalysisEvidenceItem = z.infer<typeof AnalysisEvidenceItemSchema>;

export const ChangeRequestAnalysisSchema = z.object({
  classification: ClassificationTypeSchema,
  summary: z.string().min(1, "Summary is required"),
  reasoning: z.string().min(1, "Reasoning is required"),
  supportingEvidence: z.array(AnalysisEvidenceItemSchema).default([]),
  contradictingEvidence: z.array(AnalysisEvidenceItemSchema).default([]),
  missingInformation: z.array(z.string()).default([]),
  clarificationQuestions: z.array(z.string()).default([]),
  affectedDeliverables: z.array(z.string()).default([]),
  affectedBaselineCategories: z.array(z.string()).default([]),
  confidence: ConfidenceLevelSchema,
  limitations: z.string().default("AI classification is an advisory proposal; provider review is required."),
  baselineVersion: z.number().int().positive().default(1),
  analysisModel: z.string().optional().nullable(),
  promptVersion: z.string().optional().nullable(),
  reviewStatus: z.enum(["PENDING_REVIEW", "REVIEWED"]).default("PENDING_REVIEW"),
  reviewedAt: z.string().optional().nullable(),
  providerNotes: z.string().optional().nullable(),
});

export type ChangeRequestAnalysisResult = z.infer<typeof ChangeRequestAnalysisSchema>;

