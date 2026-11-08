import { describe, it, expect } from "vitest";
import {
  evaluateAgreementHealth,
  COMMERCIAL_GUIDANCE_DISCLAIMER,
} from "@/lib/baseline/health-check";
import type { StructuredScopeBaseline } from "@/lib/ai/schema";

const STRONG_BASELINE: StructuredScopeBaseline = {
  projectObjective: "Design and build an enterprise e-commerce web application.",
  deliverables: [
    {
      id: "d1",
      name: "Storefront Web Application",
      description: "Responsive Next.js storefront with product catalog, search, and cart.",
      conditions: ["Up to 12 page templates"],
      source: { page: 1, section: "1.1", excerpt: "Deliver 12 responsive storefront templates.", isInferred: false },
    },
    {
      id: "d2",
      name: "PayPal Checkout & Webhook Service",
      description: "Server-side PayPal v2 Orders and Invoices integration with webhook reconciliation.",
      conditions: ["Sandbox and Live configuration"],
      source: { page: 2, section: "1.2", excerpt: "Integrate PayPal v2 checkout and webhooks.", isInferred: false },
    },
  ],
  exclusions: [
    {
      id: "e1",
      description: "Native iOS/Android mobile apps are out of scope.",
      conditions: null,
      source: { page: 3, section: "2.1", excerpt: "Native mobile apps are excluded; additional work requires a written change order.", isInferred: false },
    },
    {
      id: "e2",
      description: "Ongoing 24/7 hosting maintenance after handover is excluded.",
      conditions: null,
      source: { page: 3, section: "2.2", excerpt: "Post-handover maintenance is excluded.", isInferred: false },
    },
  ],
  revisionLimits: {
    includedCount: 2,
    definition: "Two rounds of consolidated design and code feedback per milestone.",
    restrictions: ["Out-of-scope revisions billed at $175/hr via change order"],
    isSpecified: true,
    source: { page: 4, section: "3.1", excerpt: "Includes 2 consolidated revision rounds; extra work billed at $175/hr.", isInferred: false },
  },
  milestones: [
    {
      id: "m1",
      name: "Architecture & UI Sign-off",
      description: "Complete wireframes and system design",
      dueDate: "2026-11-15",
      associatedDeliverables: ["d1"],
      source: { page: 5, section: "4.1", excerpt: "Milestone 1 due Nov 15.", isInferred: false },
    },
    {
      id: "m2",
      name: "Production Launch & Handover",
      description: "Final deployment and IP transfer upon final payment",
      dueDate: "2026-12-15",
      associatedDeliverables: ["d1", "d2"],
      source: { page: 5, section: "4.2", excerpt: "Final handover and intellectual property transfer upon final payment.", isInferred: false },
    },
  ],
  acceptanceCriteria: [
    {
      id: "ac1",
      criteria: "All storefront pages pass Lighthouse >= 90 and UAT sign-off within 5 business days.",
      associatedDeliverableId: "d1",
      testingRequirements: "Automated E2E suite",
      source: { page: 6, section: "5.1", excerpt: "UAT sign-off within 5 business days.", isInferred: false },
    },
    {
      id: "ac2",
      criteria: "PayPal webhook signature verification passes in Sandbox.",
      associatedDeliverableId: "d2",
      testingRequirements: "Integration tests",
      source: { page: 6, section: "5.2", excerpt: "Webhook verification passes.", isInferred: false },
    },
  ],
  paymentTerms: {
    totalAmount: "24,000",
    currency: "USD",
    depositRequired: "50% upfront deposit ($12,000)",
    milestones: [
      { name: "Deposit", amountOrPercentage: "50%", triggerCondition: "Upon contract signing" },
      { name: "Final Settlement", amountOrPercentage: "50%", triggerCondition: "Upon Milestone 2 acceptance prior to handover" },
    ],
    dueConditions: "Net 14 days from invoice issue date",
    isSpecified: true,
    source: { page: 7, section: "6.1", excerpt: "$24,000 USD total, Net 14 days. Either party may terminate with 14 days written notice and kill fee for completed work.", isInferred: false },
  },
  timelines: {
    startDate: "2026-11-01",
    deliveryDeadlines: ["2026-11-15", "2026-12-15"],
    dependencies: ["Client must provide product catalog CSV and brand guidelines within 3 business days"],
    isSpecified: true,
    source: { page: 8, section: "7.1", excerpt: "Starts Nov 1; dependent on client asset delivery.", isInferred: false },
  },
  ambiguities: [],
};

describe("Agreement Health Check Engine (src/lib/baseline/health-check.ts)", () => {
  it("scores a comprehensive, well-structured agreement as STRONG (100/100) across all 10 categories", () => {
    const result = evaluateAgreementHealth(STRONG_BASELINE);

    expect(result.maxScore).toBe(100);
    expect(result.overallScore).toBe(100);
    expect(result.overallBand).toBe("STRONG");
    expect(result.categories).toHaveLength(10);
    expect(result.counts).toEqual({
      strongCount: 10,
      partialCount: 0,
      missingCount: 0,
    });
    expect(result.disclaimer).toBe(COMMERCIAL_GUIDANCE_DISCLAIMER);
  });

  it("detects missing clauses accurately and scores weak agreements as NEEDS_ATTENTION without inventing findings", () => {
    const weakBaseline: StructuredScopeBaseline = {
      projectObjective: "Build website",
      deliverables: [
        {
          id: "d1",
          name: "Website",
          description: "A website",
          conditions: [],
          source: { page: 1, section: null, excerpt: "Build a website.", isInferred: false },
        },
      ],
      exclusions: [],
      revisionLimits: { isSpecified: false, restrictions: [] },
      milestones: [],
      acceptanceCriteria: [],
      paymentTerms: { isSpecified: false, milestones: [] },
      timelines: { isSpecified: false, deliveryDeadlines: [], dependencies: [] },
      ambiguities: [
        {
          id: "amb_1",
          issue: "Number of pages is unspecified",
          potentialImpact: "Unlimited page additions could be requested",
          source: { page: 1, section: null, excerpt: "Build a website.", isInferred: false },
        },
      ],
    };

    const result = evaluateAgreementHealth(weakBaseline);

    expect(result.overallScore).toBe(5); // Only Deliverable Specificity is PARTIAL (5), all other 9 are MISSING (0)
    expect(result.overallBand).toBe("NEEDS_ATTENTION");
    expect(result.counts.missingCount).toBe(9);
    expect(result.counts.partialCount).toBe(1);
    expect(result.ambiguities).toHaveLength(1);
    expect(result.ambiguities[0].issue).toContain("Number of pages is unspecified");

    // Verify missing categories have zero fabricated excerpts
    const exclusionsCat = result.categories.find((c) => c.id === "SCOPE_EXCLUSIONS");
    expect(exclusionsCat?.status).toBe("MISSING");
    expect(exclusionsCat?.supportingExcerpts).toEqual([]);
    expect(exclusionsCat?.missingInformation).toBeTruthy();
  });
});

