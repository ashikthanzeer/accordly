import { describe, it, expect } from "vitest";
import {
  canonicalizeJson,
  computeSnapshotHash,
  buildApprovedSnapshot,
  verifySnapshotIntegrity,
  type ApprovedProposalSnapshot,
} from "../snapshot";

describe("Canonical JSON Serialization & Hashing", () => {
  it("sorts object keys deterministically regardless of insertion order", () => {
    const objA = { z: 1, a: 2, m: { y: "hello", b: "world" } };
    const objB = { a: 2, m: { b: "world", y: "hello" }, z: 1 };

    const canonicalA = canonicalizeJson(objA);
    const canonicalB = canonicalizeJson(objB);

    expect(canonicalA).toBe(canonicalB);
    expect(canonicalA).toBe('{"a":2,"m":{"b":"world","y":"hello"},"z":1}');
  });

  it("computes deterministic SHA-256 hash for identical snapshot contents", () => {
    const snapshot1: ApprovedProposalSnapshot = {
      version: 1,
      title: "Landing Page Redesign",
      description: "Complete design overhaul",
      reasonForChange: "Client requested new aesthetic",
      amount: "1500.00",
      currency: "USD",
      pricingModel: "FIXED",
      pricing: {
        model: "FIXED",
        currency: "USD",
        total: 1500,
        formattedTotal: "USD 1500.00",
        lineItems: [],
      },
      deliverables: [
        {
          id: "DEL-1",
          name: "Homepage Wireframes",
          description: "Figma wireframes",
          acceptanceCriteria: ["Mobile and desktop"],
          suggestedEffortHours: 10,
        },
      ],
      assumptions: ["Client supplies branding assets"],
      exclusions: ["Custom font licensing"],
      dependencies: ["Domain access"],
      timelineImpact: "+3 business days",
      commercialJustification: null,
      disclaimer: "Legal terms",
      approvedAt: "2026-11-08T12:00:00.000Z",
      approvedBy: "Sarah Jenkins",
    };

    const snapshot2: ApprovedProposalSnapshot = {
      ...snapshot1,
      deliverables: [{ ...snapshot1.deliverables[0] }],
    };

    const hash1 = computeSnapshotHash(snapshot1);
    const hash2 = computeSnapshotHash(snapshot2);

    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64); // SHA-256 hex string
  });
});

describe("Approved Snapshot Construction & Verification", () => {
  const mockProposal = {
    id: "prop_123",
    version: 1,
    status: "APPROVED",
    description: "Initial change order description",
    amount: "2500.00",
    currency: "USD",
    assumptions: "Assumption 1\nAssumption 2",
    timelineImpact: "+7 days",
    deliverables: {
      title: "Commercial Feature Upgrade",
      reasonForChange: "Client expanded requirements",
      deliverables: [
        {
          id: "DEL-1",
          name: "PayPal v2 Integration",
          description: "Full checkout flow",
          acceptanceCriteria: ["Sandbox verified"],
          suggestedEffortHours: 15,
        },
      ],
      pricing: {
        model: "ITEMIZED",
        currency: "USD",
        total: 2500,
        formattedTotal: "USD 2500.00",
        lineItems: [
          {
            id: "LI-1",
            description: "Backend Gateway Integration",
            quantity: 10,
            unitPrice: 250,
            subtotal: 2500,
            currency: "USD",
          },
        ],
      },
      commercialJustification: "Requires external gateway certification",
    },
  };

  it("builds a complete ApprovedProposalSnapshot from proposal content", () => {
    const snapshot = buildApprovedSnapshot({
      proposal: mockProposal,
      approverName: "Sarah Jenkins",
      approvedAt: new Date("2026-11-08T12:00:00Z"),
    });

    expect(snapshot.version).toBe(1);
    expect(snapshot.title).toBe("Commercial Feature Upgrade");
    expect(snapshot.amount).toBe("2500.00");
    expect(snapshot.currency).toBe("USD");
    expect(snapshot.pricingModel).toBe("ITEMIZED");
    expect(snapshot.deliverables).toHaveLength(1);
    expect(snapshot.assumptions).toEqual(["Assumption 1", "Assumption 2"]);
    expect(snapshot.pricing.lineItems).toHaveLength(1);
    expect(snapshot.approvedBy).toBe("Sarah Jenkins");
  });

  it("verifies snapshot integrity when hashes and root amounts match", () => {
    const snapshot = buildApprovedSnapshot({
      proposal: mockProposal,
      approverName: "Sarah Jenkins",
      approvedAt: new Date("2026-11-08T12:00:00Z"),
    });
    const hash = computeSnapshotHash(snapshot);

    const verifiedProposal = {
      ...mockProposal,
      deliverables: {
        ...mockProposal.deliverables,
        approvedSnapshot: snapshot,
        approvedSnapshotHash: hash,
      },
    };

    const result = verifySnapshotIntegrity(verifiedProposal);
    expect(result.isValid).toBe(true);
    expect(result.computedHash).toBe(hash);
  });

  it("detects tampering when snapshot deliverables are altered", () => {
    const snapshot = buildApprovedSnapshot({
      proposal: mockProposal,
      approverName: "Sarah Jenkins",
      approvedAt: new Date("2026-11-08T12:00:00Z"),
    });
    const hash = computeSnapshotHash(snapshot);

    // Tamper with snapshot deliverables
    const tamperedSnapshot = {
      ...snapshot,
      description: "Tampered malicious description",
    };

    const tamperedProposal = {
      ...mockProposal,
      deliverables: {
        ...mockProposal.deliverables,
        approvedSnapshot: tamperedSnapshot,
        approvedSnapshotHash: hash,
      },
    };

    const result = verifySnapshotIntegrity(tamperedProposal);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain("integrity verification failed");
  });

  it("detects tampering when root amount deviates from snapshot amount", () => {
    const snapshot = buildApprovedSnapshot({
      proposal: mockProposal,
      approverName: "Sarah Jenkins",
      approvedAt: new Date("2026-11-08T12:00:00Z"),
    });
    const hash = computeSnapshotHash(snapshot);

    // Tamper with root proposal amount
    const tamperedProposal = {
      ...mockProposal,
      amount: "9999.00",
      deliverables: {
        ...mockProposal.deliverables,
        approvedSnapshot: snapshot,
        approvedSnapshotHash: hash,
      },
    };

    const result = verifySnapshotIntegrity(tamperedProposal);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain("root amount");
  });

  it("gracefully allows legacy proposals with snapshot but no hash", () => {
    const snapshot = buildApprovedSnapshot({
      proposal: mockProposal,
      approverName: "Sarah Jenkins",
      approvedAt: new Date("2026-11-08T12:00:00Z"),
    });

    const legacyProposal = {
      ...mockProposal,
      deliverables: {
        ...mockProposal.deliverables,
        approvedSnapshot: snapshot,
        // approvedSnapshotHash omitted
      },
    };

    const result = verifySnapshotIntegrity(legacyProposal);
    expect(result.isValid).toBe(true);
    expect(result.isLegacyUnsigned).toBe(true);

    const strictResult = verifySnapshotIntegrity(legacyProposal, { strict: true });
    expect(strictResult.isValid).toBe(false);
  });
});

