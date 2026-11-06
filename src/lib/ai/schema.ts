/**
 * Zod runtime schemas and TypeScript types for Scope Baseline Extraction.
 */

import { z } from "zod";

export const SourceReferenceSchema = z.object({
  page: z.number().int().positive().optional().nullable(),
  section: z.string().optional().nullable(),
  excerpt: z.string().min(1, "Excerpt cannot be empty"),
  isInferred: z.boolean().default(false),
});

export type SourceReference = z.infer<typeof SourceReferenceSchema>;

export const DeliverableItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, "Deliverable name is required"),
  description: z.string().min(1, "Deliverable description is required"),
  conditions: z.array(z.string()).default([]),
  source: SourceReferenceSchema,
});

export type DeliverableItem = z.infer<typeof DeliverableItemSchema>;

export const ExclusionItemSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1, "Exclusion description is required"),
  conditions: z.string().optional().nullable(),
  source: SourceReferenceSchema,
});

export type ExclusionItem = z.infer<typeof ExclusionItemSchema>;

export const RevisionLimitsSchema = z.object({
  includedCount: z.union([z.number().int().nonnegative(), z.string()]).optional().nullable(),
  definition: z.string().optional().nullable(),
  restrictions: z.array(z.string()).default([]),
  isSpecified: z.boolean().default(true),
  source: SourceReferenceSchema.optional().nullable(),
});

export type RevisionLimits = z.infer<typeof RevisionLimitsSchema>;

export const MilestoneItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, "Milestone name is required"),
  description: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  associatedDeliverables: z.array(z.string()).default([]),
  source: SourceReferenceSchema,
});

export type MilestoneItem = z.infer<typeof MilestoneItemSchema>;

export const AcceptanceCriteriaItemSchema = z.object({
  id: z.string().min(1),
  criteria: z.string().min(1, "Criteria text is required"),
  associatedDeliverableId: z.string().optional().nullable(),
  testingRequirements: z.string().optional().nullable(),
  source: SourceReferenceSchema,
});

export type AcceptanceCriteriaItem = z.infer<typeof AcceptanceCriteriaItemSchema>;

export const PaymentMilestoneSchema = z.object({
  name: z.string().min(1),
  amountOrPercentage: z.string().min(1),
  triggerCondition: z.string().min(1),
});

export type PaymentMilestone = z.infer<typeof PaymentMilestoneSchema>;

export const PaymentTermsSchema = z.object({
  totalAmount: z.string().optional().nullable(),
  currency: z.string().length(3).optional().nullable(),
  depositRequired: z.string().optional().nullable(),
  milestones: z.array(PaymentMilestoneSchema).default([]),
  dueConditions: z.string().optional().nullable(),
  isSpecified: z.boolean().default(true),
  source: SourceReferenceSchema.optional().nullable(),
});

export type PaymentTerms = z.infer<typeof PaymentTermsSchema>;

export const TimelinesSchema = z.object({
  startDate: z.string().optional().nullable(),
  deliveryDeadlines: z.array(z.string()).default([]),
  dependencies: z.array(z.string()).default([]),
  isSpecified: z.boolean().default(true),
  source: SourceReferenceSchema.optional().nullable(),
});

export type Timelines = z.infer<typeof TimelinesSchema>;

export const AmbiguityItemSchema = z.object({
  id: z.string().min(1),
  issue: z.string().min(1, "Ambiguity issue description is required"),
  potentialImpact: z.string().min(1, "Potential impact is required"),
  source: SourceReferenceSchema.optional().nullable(),
});

export type AmbiguityItem = z.infer<typeof AmbiguityItemSchema>;

/**
 * Authoritative Structured Scope Baseline Schema.
 */
export const ScopeBaselineSchema = z.object({
  projectObjective: z.string().min(1, "Project objective is required"),
  deliverables: z.array(DeliverableItemSchema).min(1, "At least one deliverable must be extracted"),
  exclusions: z.array(ExclusionItemSchema).default([]),
  revisionLimits: RevisionLimitsSchema.default({ isSpecified: false, restrictions: [] }),
  milestones: z.array(MilestoneItemSchema).default([]),
  acceptanceCriteria: z.array(AcceptanceCriteriaItemSchema).default([]),
  paymentTerms: PaymentTermsSchema.default({ isSpecified: false, milestones: [] }),
  timelines: TimelinesSchema.default({ isSpecified: false, deliveryDeadlines: [], dependencies: [] }),
  ambiguities: z.array(AmbiguityItemSchema).default([]),
});

export type StructuredScopeBaseline = z.infer<typeof ScopeBaselineSchema>;

