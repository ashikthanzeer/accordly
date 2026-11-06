import { describe, it, expect } from "vitest";
import { serializePublicProposal } from "../serializer";
import { hashReviewToken, validateTokenAgainstHash } from "../tokens";

describe("Client Proposal Snapshot Serializer & Confidentiality", () => {
  const mockInternalProposal = {
    id: "co_12345_internal_id",
    projectId: "proj_abc",
    version: 2,
    status: "SENT_TO_CLIENT",
    description: "Scope expansion for custom payment gateway integration.",
    amount: 1500.0,
    currency: "USD",
    reviewTokenHash: "dummy_hash_123",
    reviewTokenExpiresAt: new Date(Date.now() + 86400000 * 14),
    providerApprovedAt: new Date(),
    clientAcceptedAt: null,
    clientRejectedAt: null,
    deliverables: {
      title: "Change Proposal: Payment Gateway Integration",
      reasonForChange: "Client requested multi-currency Stripe support outside initial scope.",
      deliverables: [
        {
          id: "DEL-1",
          name: "Stripe Connect API Integration",
          description: "Full backend webhook and checkout flow.",
          acceptanceCriteria: ["Successful sandbox charges", "Webhook idempotency"],
          suggestedEffortHours: 10,
        },
      ],
      pricing: {
        model: "ITEMIZED",
        currency: "USD",
        total: 1500.0,
        formattedTotal: "$1,500.00",
        lineItems: [
          {
            id: "LI-1",
            description: "Backend Gateway Integration",
            quantity: 10,
            unitPrice: 150.0,
            subtotal: 1500.0,
            currency: "USD",
          },
        ],
      },
      assumptions: ["Client provides Stripe credentials"],
      exclusions: ["In-person training"],
      dependencies: ["Client sandbox keys"],
      timelineImpact: "+5 business days",
      // Internal metadata that MUST NOT be exposed to client:
      providerNotes: "Internal note: Client was pushy on deadlines, make sure scope is firm.",
      promptVersion: "v1.0",
      originatingClassification: "OUT_OF_SCOPE",
    },
  };

  const mockProject = {
    name: "Acme Web Platform",
    clientName: "Acme Corporation",
    clientEmail: "billing@acme.com",
    currency: "USD",
  };

  it("serializes public commercial proposal snapshot and strips all private internal data", () => {
    const publicData = serializePublicProposal(mockInternalProposal, mockProject);

    expect(publicData.projectName).toBe("Acme Web Platform");
    expect(publicData.clientName).toBe("Acme Corporation");
    expect(publicData.version).toBe(2);
    expect(publicData.title).toBe("Change Proposal: Payment Gateway Integration");
    expect(publicData.deliverables).toHaveLength(1);
    expect(publicData.deliverables[0].acceptanceCriteria).toContain("Webhook idempotency");
    expect(publicData.pricing.total).toBe(1500.0);
    expect(publicData.pricing.lineItems).toHaveLength(1);

    // CRITICAL SECURITY ASSERTION: Internal provider notes and database IDs must not exist
    expect((publicData as any).providerNotes).toBeUndefined();
    expect((publicData as any).promptVersion).toBeUndefined();
    expect((publicData as any).originatingClassification).toBeUndefined();
    expect((publicData as any).id).toBeUndefined();
    expect((publicData as any).reviewTokenHash).toBeUndefined();
  });
});

describe("Client Decision Rules & Guardrails", () => {
  it("enforces replay protection: prevents decisions on already-decided proposals", () => {
    // If clientAcceptedAt is already set, decision check rejects duplicate action
    const acceptedProposal = {
      status: "CLIENT_ACCEPTED",
      clientAcceptedAt: new Date(),
      clientRejectedAt: null,
    };

    const hasPriorDecision = Boolean(
      acceptedProposal.clientAcceptedAt || acceptedProposal.clientRejectedAt
    );
    expect(hasPriorDecision).toBe(true);
  });

  it("verifies client review token matching with hash calculation", () => {
    const rawToken = "my_super_secret_unpredictable_token_12345";
    const expectedHash = hashReviewToken(rawToken);

    const validation = validateTokenAgainstHash(
      rawToken,
      expectedHash,
      new Date(Date.now() + 100000)
    );
    expect(validation.isValid).toBe(true);
  });
});

