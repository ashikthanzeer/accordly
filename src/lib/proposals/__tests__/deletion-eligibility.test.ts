import { describe, it, expect } from "vitest";
import { assertProposalDeletable } from "../deletion";

describe("Proposal Deletion Eligibility Engine", () => {
  const baseProposal = {
    id: "prop_draft_1",
    version: 1,
    status: "DRAFT",
    providerApprovedAt: null,
    clientAcceptedAt: null,
    clientRejectedAt: null,
    reviewTokenHash: null,
    deletedAt: null,
    invoices: [],
    project: {
      status: "ACTIVE",
      name: "SaaS Portal",
    },
  };

  it("permits deletion of an uncommitted, unshared DRAFT proposal", () => {
    const result = assertProposalDeletable(baseProposal);
    expect(result.canDelete).toBe(true);
    expect(result.code).toBeUndefined();
    expect(result.reason).toBeUndefined();
  });

  it("rejects deletion if proposal status is not DRAFT (Condition 1)", () => {
    const nonDraftStatuses = [
      "APPROVED",
      "SENT_TO_CLIENT",
      "CLIENT_ACCEPTED",
      "CLIENT_REJECTED",
      "SUPERSEDED",
      "WITHDRAWN",
    ];

    for (const status of nonDraftStatuses) {
      const result = assertProposalDeletable({
        ...baseProposal,
        status,
      });
      expect(result.canDelete).toBe(false);
      expect(result.code).toBe("NOT_DRAFT");
      expect(result.reason).toContain("Only DRAFT proposals can be deleted");
    }
  });

  it("rejects deletion if proposal has ever been approved (Condition 2)", () => {
    const result = assertProposalDeletable({
      ...baseProposal,
      providerApprovedAt: new Date("2026-11-01T10:00:00Z"),
    });
    expect(result.canDelete).toBe(false);
    expect(result.code).toBe("ALREADY_APPROVED");
    expect(result.reason).toContain("Approved proposals are immutable");
  });

  it("rejects deletion if proposal has ever been shared via review token (Condition 3)", () => {
    const result = assertProposalDeletable({
      ...baseProposal,
      reviewTokenHash: "hash_review_abc123",
    });
    expect(result.canDelete).toBe(false);
    expect(result.code).toBe("ALREADY_SHARED");
    expect(result.reason).toContain("has already been shared with the client");
  });

  it("rejects deletion if proposal has client decision records (Condition 4)", () => {
    const acceptedResult = assertProposalDeletable({
      ...baseProposal,
      clientAcceptedAt: new Date("2026-11-02T12:00:00Z"),
    });
    expect(acceptedResult.canDelete).toBe(false);
    expect(acceptedResult.code).toBe("ALREADY_DECIDED");

    const rejectedResult = assertProposalDeletable({
      ...baseProposal,
      clientRejectedAt: new Date("2026-11-03T15:00:00Z"),
    });
    expect(rejectedResult.canDelete).toBe(false);
    expect(rejectedResult.code).toBe("ALREADY_DECIDED");
  });

  it("rejects deletion if proposal has an associated PayPal invoice (Condition 5)", () => {
    const result = assertProposalDeletable({
      ...baseProposal,
      invoices: [
        {
          id: "inv_1",
          status: "SENT",
          amount: "1500.00",
        },
      ],
    });
    expect(result.canDelete).toBe(false);
    expect(result.code).toBe("HAS_INVOICE");
    expect(result.reason).toContain("has 1 associated PayPal invoice record(s)");
  });

  it("rejects deletion if proposal has invoice payment activity (Condition 6)", () => {
    const result = assertProposalDeletable({
      ...baseProposal,
      invoices: [
        {
          id: "inv_paid",
          status: "PARTIALLY_PAID",
          amount: "2000.00",
          paidAmount: "500.00",
        },
      ],
    });
    expect(result.canDelete).toBe(false);
    expect(result.code).toBe("HAS_PAYMENT_ACTIVITY");
    expect(result.reason).toContain("invoice payment activity");
  });

  it("rejects deletion if proposal has dependent proposal versions (Condition 7)", () => {
    const result = assertProposalDeletable(baseProposal, {
      dependentVersionsCount: 2,
    });
    expect(result.canDelete).toBe(false);
    expect(result.code).toBe("HAS_DEPENDENT_VERSIONS");
    expect(result.reason).toContain("has 2 dependent proposal version(s)");
  });

  it("rejects deletion if proposal has already been soft-deleted", () => {
    const result = assertProposalDeletable({
      ...baseProposal,
      deletedAt: new Date("2026-11-05T09:00:00Z"),
    });
    expect(result.canDelete).toBe(false);
    expect(result.code).toBe("ALREADY_DELETED");
    expect(result.reason).toContain("has already been deleted");
  });

  it("rejects deletion if project is archived", () => {
    const result = assertProposalDeletable({
      ...baseProposal,
      project: {
        status: "ARCHIVED",
        name: "Legacy App",
      },
    });
    expect(result.canDelete).toBe(false);
    expect(result.code).toBe("PROJECT_ARCHIVED");
    expect(result.reason).toContain("Mutating operations are prohibited on archived projects");
  });
});
