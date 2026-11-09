import { describe, it, expect, vi, beforeEach } from "vitest";
import { softDeleteProposal } from "../deletion";
import { prisma } from "@/lib/db";

vi.mock("@/lib/db", () => {
  const mockTx = {
    changeOrder: {
      findFirst: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    projectEvent: {
      create: vi.fn(),
    },
  };

  return {
    prisma: {
      ...mockTx,
      $transaction: vi.fn(async (cb: (tx: any) => Promise<any>) => cb(mockTx)),
    },
  };
});

describe("Transactional Proposal Soft-Deletion Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockTx = (prisma as any);

  it("successfully soft-deletes an eligible draft proposal and records timeline audit event", async () => {
    const mockProposal = {
      id: "prop_123",
      projectId: "proj_abc",
      version: 1,
      status: "DRAFT",
      amount: "1250.00",
      currency: "USD",
      providerApprovedAt: null,
      clientAcceptedAt: null,
      clientRejectedAt: null,
      reviewTokenHash: null,
      deletedAt: null,
      invoices: [],
      project: {
        id: "proj_abc",
        status: "ACTIVE",
        name: "Cloud Migration",
      },
    };

    mockTx.changeOrder.findFirst.mockResolvedValueOnce(mockProposal);
    mockTx.changeOrder.count.mockResolvedValueOnce(0); // 0 dependent versions
    mockTx.changeOrder.update.mockResolvedValueOnce({
      ...mockProposal,
      deletedAt: new Date(),
      deletedBy: "usr_provider_1",
    });
    mockTx.projectEvent.create.mockResolvedValueOnce({ id: "evt_del_1" });

    const result = await softDeleteProposal(
      "proj_abc",
      "prop_123",
      "usr_provider_1",
      "req_test_1"
    );

    expect(result.success).toBe(true);
    expect(result.statusCode).toBe(200);
    expect(result.proposal?.deletedBy).toBe("usr_provider_1");
    expect(result.proposal?.deletedAt).toBeDefined();

    expect(mockTx.changeOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "prop_123" },
        data: expect.objectContaining({
          deletedBy: "usr_provider_1",
        }),
      })
    );

    expect(mockTx.projectEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          projectId: "proj_abc",
          eventType: "PROPOSAL_DELETED",
          actorType: "USER",
          metadata: expect.objectContaining({
            proposalId: "prop_123",
            version: 1,
            deletedBy: "usr_provider_1",
          }),
        }),
      })
    );
  });

  it("returns 404 when proposal does not exist", async () => {
    mockTx.changeOrder.findFirst.mockResolvedValueOnce(null);

    const result = await softDeleteProposal(
      "proj_abc",
      "prop_missing",
      "usr_provider_1"
    );

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(404);
    expect(result.code).toBe("PROPOSAL_NOT_FOUND");
    expect(mockTx.changeOrder.update).not.toHaveBeenCalled();
  });

  it("returns 409 when proposal is approved and cannot be deleted", async () => {
    mockTx.changeOrder.findFirst.mockResolvedValueOnce({
      id: "prop_approved",
      projectId: "proj_abc",
      version: 1,
      status: "APPROVED",
      providerApprovedAt: new Date(),
      deletedAt: null,
      project: { status: "ACTIVE" },
      invoices: [],
    });
    mockTx.changeOrder.count.mockResolvedValueOnce(0);

    const result = await softDeleteProposal(
      "proj_abc",
      "prop_approved",
      "usr_provider_1"
    );

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(409);
    expect(result.code).toBe("NOT_DRAFT");
    expect(mockTx.changeOrder.update).not.toHaveBeenCalled();
  });

  it("returns 409 when proposal has dependent versions that would be orphaned", async () => {
    mockTx.changeOrder.findFirst.mockResolvedValueOnce({
      id: "prop_v1",
      projectId: "proj_abc",
      version: 1,
      status: "DRAFT",
      providerApprovedAt: null,
      deletedAt: null,
      project: { status: "ACTIVE" },
      invoices: [],
    });
    mockTx.changeOrder.count.mockResolvedValueOnce(1); // 1 dependent version exists

    const result = await softDeleteProposal(
      "proj_abc",
      "prop_v1",
      "usr_provider_1"
    );

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(409);
    expect(result.code).toBe("HAS_DEPENDENT_VERSIONS");
    expect(mockTx.changeOrder.update).not.toHaveBeenCalled();
  });
});
