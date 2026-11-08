import { describe, it, expect } from "vitest";
import {
  buildProposalVersionHistory,
  compareProposalVersions,
} from "@/lib/proposals/diff";
import { buildApprovedSnapshot } from "@/lib/proposals/snapshot";
import {
  sanitizeEventMetadata,
  resolveEventResourceContext,
} from "@/lib/timeline/service";

describe("Proposal Version Comparison & Lineage (src/lib/proposals/diff.ts)", () => {
  const v1Base = {
    id: "prop_v1",
    version: 1,
    status: "SUPERSEDED",
    description: "Initial mobile app scope expansion",
    amount: "1500.00",
    currency: "USD",
    timelineImpact: "+1 week",
    createdAt: "2026-11-01T10:00:00Z",
    providerApprovedAt: "2026-11-01T12:00:00Z",
    deliverables: {
      title: "Mobile App Expansion v1",
      reasonForChange: "Client requested iOS prototype",
      timelineImpact: "+1 week",
      assumptions: ["Client provides brand assets"],
      deliverables: [
        {
          id: "d1",
          name: "iOS Prototype",
          description: "Interactive Figma prototype for iOS",
          acceptanceCriteria: ["Clickable flows"],
          suggestedEffortHours: 10,
        },
        {
          id: "d2",
          name: "Legacy Export Script",
          description: "CSV export utility",
          acceptanceCriteria: ["Valid CSV"],
          suggestedEffortHours: 5,
        },
      ],
      pricing: {
        model: "ITEMIZED",
        currency: "USD",
        total: 1500,
        formattedTotal: "$1,500.00",
        lineItems: [
          {
            id: "l1",
            description: "iOS Prototype",
            quantity: 10,
            unitPrice: 100,
            subtotal: 1000,
            currency: "USD",
          },
          {
            id: "l2",
            description: "Legacy Export Script",
            quantity: 5,
            unitPrice: 100,
            subtotal: 500,
            currency: "USD",
          },
        ],
      },
    },
  };

  // Attach immutable approvedSnapshot to v1
  (v1Base.deliverables as any).approvedSnapshot = buildApprovedSnapshot({
    proposal: v1Base,
    approvedAt: new Date("2026-11-01T12:00:00Z"),
  });

  const v2Target = {
    id: "prop_v2",
    version: 2,
    status: "CLIENT_ACCEPTED",
    description: "Expanded iOS + Android production build",
    amount: "3200.00",
    currency: "USD",
    timelineImpact: "+3 weeks",
    createdAt: "2026-11-03T10:00:00Z",
    providerApprovedAt: "2026-11-03T11:00:00Z",
    clientAcceptedAt: "2026-11-04T09:00:00Z",
    deliverables: {
      title: "Mobile App Expansion v2",
      reasonForChange: "Client expanded request to include Android build and API integration",
      timelineImpact: "+3 weeks",
      predecessorVersion: 1,
      predecessorProposalId: "prop_v1",
      assumptions: ["Client provides brand assets", "Staging API credentials provided"],
      deliverables: [
        {
          id: "d1",
          name: "iOS Prototype",
          description: "Full interactive iOS prototype with dark mode",
          acceptanceCriteria: ["Clickable flows", "Dark mode screens"],
          suggestedEffortHours: 16,
        },
        {
          id: "d3",
          name: "Android Production Build",
          description: "Signed APK & Play Store bundle",
          acceptanceCriteria: ["Play Store ready"],
          suggestedEffortHours: 16,
        },
      ],
      pricing: {
        model: "ITEMIZED",
        currency: "USD",
        total: 3200,
        formattedTotal: "$3,200.00",
        lineItems: [
          {
            id: "l1",
            description: "iOS Prototype",
            quantity: 16,
            unitPrice: 100,
            subtotal: 1600,
            currency: "USD",
          },
          {
            id: "l3",
            description: "Android Production Build",
            quantity: 16,
            unitPrice: 100,
            subtotal: 1600,
            currency: "USD",
          },
        ],
      },
    },
  };

  (v2Target.deliverables as any).approvedSnapshot = buildApprovedSnapshot({
    proposal: v2Target,
    approvedAt: new Date("2026-11-03T11:00:00Z"),
  });

  it("builds ordered version history with approval dates, client decisions, and snapshot lock flags", () => {
    const history = buildProposalVersionHistory([v1Base, v2Target]);
    expect(history).toHaveLength(2);
    // Descending order (v2 first, v1 second)
    expect(history[0].version).toBe(2);
    expect(history[0].clientDecision).toBe("ACCEPTED");
    expect(history[0].hasImmutableSnapshot).toBe(true);
    expect(history[0].predecessorVersion).toBe(1);

    expect(history[1].version).toBe(1);
    expect(history[1].status).toBe("SUPERSEDED");
    expect(history[1].hasImmutableSnapshot).toBe(true);
  });

  it("detects ADDED, REMOVED, and MODIFIED deliverables, line items, timeline changes, and price delta", () => {
    const diff = compareProposalVersions(v1Base, v2Target);

    expect(diff.baseVersion).toBe(1);
    expect(diff.targetVersion).toBe(2);
    expect(diff.baseAmount).toBe(1500);
    expect(diff.targetAmount).toBe(3200);
    expect(diff.amountDelta).toBe(1700);
    expect(diff.formattedAmountDelta).toBe("+$1,700.00");

    expect(diff.timelineChanged).toBe(true);
    expect(diff.baseTimelineImpact).toBe("+1 week");
    expect(diff.targetTimelineImpact).toBe("+3 weeks");

    expect(diff.justificationChanged).toBe(true);
    expect(diff.assumptionsChanged).toBe(true);

    // Deliverables summary: d1 MODIFIED, d2 REMOVED, d3 ADDED
    expect(diff.summaryCounts).toEqual({
      addedDeliverables: 1,
      removedDeliverables: 1,
      modifiedDeliverables: 1,
      unchangedDeliverables: 0,
      addedLineItems: 1,
      removedLineItems: 1,
      modifiedLineItems: 1,
    });
  });

  it("reads strictly from approvedSnapshot so post-approval tampering cannot alter historical version comparisons", () => {
    const mutatedClone = {
      ...v1Base,
      amount: "99999.00",
      deliverables: {
        ...v1Base.deliverables,
        title: "Tampered Title",
        // approvedSnapshot remains intact at $1,500.00
      },
    };

    const diff = compareProposalVersions(mutatedClone, v2Target);
    expect(diff.baseAmount).toBe(1500);
    expect(diff.amountDelta).toBe(1700);
  });

  it("sanitizes timeline event metadata and resolves direct resource navigation links", () => {
    const rawMeta = {
      proposalId: "prop_v2",
      version: 2,
      amount: "3200.00",
      currency: "USD",
      systemPrompt: "SECRET_INTERNAL_SYSTEM_PROMPT",
      reviewToken: "RAW_SECRET_TOKEN",
    };

    const clean = sanitizeEventMetadata(rawMeta);
    expect(clean).toBeDefined();
    expect(clean?.proposalId).toBe("prop_v2");
    expect(clean?.systemPrompt).toBeUndefined();
    expect(clean?.reviewToken).toBeUndefined();

    const ctx = resolveEventResourceContext("proj_1", "PROPOSAL", clean);
    expect(ctx.resourceId).toBe("prop_v2");
    expect(ctx.proposalVersion).toBe(2);
    expect(ctx.href).toBe("/projects/proj_1/proposals/prop_v2");
  });
});

