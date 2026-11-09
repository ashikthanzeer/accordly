import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET as listProposals } from "@/app/api/projects/[id]/proposals/route";
import { POST as deleteProposal } from "@/app/api/projects/[id]/proposals/[proposalId]/delete/route";
import { POST as approveProposal } from "@/app/api/projects/[id]/proposals/[proposalId]/approve/route";
import { POST as shareProposal } from "@/app/api/projects/[id]/proposals/[proposalId]/share/route";
import { POST as branchVersion } from "@/app/api/projects/[id]/proposals/[proposalId]/versions/route";
import { prisma } from "@/lib/db";
import * as sessionModule from "@/lib/auth/session";

const {
  mockChangeOrderFindMany,
  mockChangeOrderFindFirst,
  mockChangeOrderCount,
  mockChangeOrderUpdate,
  mockProjectEventCreate,
  mockProjectFindFirst,
  mockProjectFindUnique,
} = vi.hoisted(() => ({
  mockChangeOrderFindMany: vi.fn(),
  mockChangeOrderFindFirst: vi.fn(),
  mockChangeOrderCount: vi.fn(),
  mockChangeOrderUpdate: vi.fn(),
  mockProjectEventCreate: vi.fn(),
  mockProjectFindFirst: vi.fn(),
  mockProjectFindUnique: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedUser: vi.fn(),
  unauthorizedResponse: vi.fn((correlationId) =>
    new Response(JSON.stringify({ error: "Unauthorized", correlationId }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    })
  ),
}));

vi.mock("@/lib/db", () => {
  const mockTx = {
    changeOrder: {
      findFirst: mockChangeOrderFindFirst,
      findMany: mockChangeOrderFindMany,
      count: mockChangeOrderCount,
      update: mockChangeOrderUpdate,
    },
    project: {
      findFirst: mockProjectFindFirst,
      findUnique: mockProjectFindUnique,
    },
    projectEvent: {
      create: mockProjectEventCreate,
    },
  };

  return {
    prisma: {
      ...mockTx,
      $transaction: vi.fn(async (cb: (tx: any) => Promise<any>) => cb(mockTx)),
    },
  };
});

describe("Safe Proposal Deletion Lifecycle Integration Suite", () => {
  const provider = {
    id: "usr_provider_lead",
    name: "Lead Provider",
    email: "lead@agency.example.com",
  };

  const activeProject = {
    id: "proj_lifecycle_1",
    ownerId: "usr_provider_lead",
    name: "Enterprise Migration",
    status: "ACTIVE",
    currency: "USD",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(sessionModule.getAuthenticatedUser).mockResolvedValue(provider as any);
    mockProjectFindFirst.mockResolvedValue(activeProject as any);
    mockProjectFindUnique.mockResolvedValue(activeProject as any);
  });

  it("filters soft-deleted proposals from GET /api/projects/[id]/proposals", async () => {
    mockChangeOrderFindMany.mockResolvedValueOnce([
      {
        id: "prop_v2_active",
        version: 2,
        status: "DRAFT",
        deletedAt: null,
      },
    ]);

    const req = new NextRequest("http://localhost:3000/api/projects/proj_lifecycle_1/proposals");
    const res = await listProposals(req, {
      params: Promise.resolve({ id: "proj_lifecycle_1" }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.proposals).toHaveLength(1);
    expect(mockChangeOrderFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          projectId: "proj_lifecycle_1",
          deletedAt: null,
        }),
      })
    );
  });

  it("soft-deletes an eligible draft proposal, records audit event, and updates deletedAt", async () => {
    const draftProposal = {
      id: "prop_to_delete",
      projectId: "proj_lifecycle_1",
      version: 1,
      status: "DRAFT",
      amount: "800.00",
      currency: "USD",
      providerApprovedAt: null,
      clientAcceptedAt: null,
      clientRejectedAt: null,
      reviewTokenHash: null,
      deletedAt: null,
      invoices: [],
      project: activeProject,
    };

    mockChangeOrderFindFirst.mockResolvedValue(draftProposal as any);
    mockChangeOrderCount.mockResolvedValue(0);
    mockChangeOrderUpdate.mockResolvedValueOnce({
      ...draftProposal,
      deletedAt: new Date(),
      deletedBy: provider.id,
    });
    mockProjectEventCreate.mockResolvedValueOnce({ id: "evt_del" });

    const req = new NextRequest(
      "http://localhost:3000/api/projects/proj_lifecycle_1/proposals/prop_to_delete/delete",
      { method: "POST" }
    );
    const res = await deleteProposal(req, {
      params: Promise.resolve({ id: "proj_lifecycle_1", proposalId: "prop_to_delete" }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(mockChangeOrderUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "prop_to_delete" },
        data: expect.objectContaining({
          deletedBy: provider.id,
        }),
      })
    );
    expect(mockProjectEventCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: "PROPOSAL_DELETED",
          projectId: "proj_lifecycle_1",
        }),
      })
    );
  });

  it("rejects approval on soft-deleted proposals with HTTP 404", async () => {
    // findFirst with deletedAt: null returns null
    mockChangeOrderFindFirst.mockResolvedValueOnce(null);

    const req = new NextRequest(
      "http://localhost:3000/api/projects/proj_lifecycle_1/proposals/prop_deleted/approve",
      { method: "POST" }
    );
    const res = await approveProposal(req, {
      params: Promise.resolve({ id: "proj_lifecycle_1", proposalId: "prop_deleted" }),
    });

    expect(res.status).toBe(404);
  });

  it("rejects sharing review links on soft-deleted proposals with HTTP 404", async () => {
    // findFirst with deletedAt: null returns null
    mockChangeOrderFindFirst.mockResolvedValueOnce(null);

    const req = new NextRequest(
      "http://localhost:3000/api/projects/proj_lifecycle_1/proposals/prop_deleted/share",
      { method: "POST" }
    );
    const res = await shareProposal(req, {
      params: Promise.resolve({ id: "proj_lifecycle_1", proposalId: "prop_deleted" }),
    });

    expect(res.status).toBe(404);
  });

  it("rejects branching new versions from soft-deleted proposals with HTTP 404", async () => {
    // findFirst with deletedAt: null returns null
    mockChangeOrderFindFirst.mockResolvedValueOnce(null);

    const req = new NextRequest(
      "http://localhost:3000/api/projects/proj_lifecycle_1/proposals/prop_deleted/versions",
      { method: "POST" }
    );
    const res = await branchVersion(req, {
      params: Promise.resolve({ id: "proj_lifecycle_1", proposalId: "prop_deleted" }),
    });

    expect(res.status).toBe(404);
  });
});
