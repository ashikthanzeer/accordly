import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST, DELETE } from "@/app/api/projects/[id]/proposals/[proposalId]/delete/route";
import { DELETE as rootProposalDelete } from "@/app/api/projects/[id]/proposals/[proposalId]/route";
import { prisma } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/auth/session";

vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedUser: vi.fn(),
  unauthorizedResponse: vi.fn((correlationId) =>
    new Response(JSON.stringify({ error: "Unauthorized", correlationId }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    })
  ),
}));

const {
  mockChangeOrderFindFirst,
  mockChangeOrderCount,
  mockChangeOrderUpdate,
  mockProjectEventCreate,
} = vi.hoisted(() => ({
  mockChangeOrderFindFirst: vi.fn(),
  mockChangeOrderCount: vi.fn(),
  mockChangeOrderUpdate: vi.fn(),
  mockProjectEventCreate: vi.fn(),
}));

vi.mock("@/lib/db", () => {
  const mockTx = {
    changeOrder: {
      findFirst: mockChangeOrderFindFirst,
      count: mockChangeOrderCount,
      update: mockChangeOrderUpdate,
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

describe("Proposal Deletion API Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const authUser = {
    id: "usr_provider_a",
    name: "Provider A",
    email: "provider.a@example.com",
  };

  const routeParams = {
    params: Promise.resolve({
      id: "proj_1",
      proposalId: "prop_1",
    }),
  };

  it("returns 401 Unauthorized when unauthenticated", async () => {
    vi.mocked(getAuthenticatedUser).mockResolvedValueOnce(null);

    const req = new NextRequest(
      "http://localhost:3000/api/projects/proj_1/proposals/prop_1/delete",
      { method: "POST" }
    );
    const res = await POST(req, routeParams);
    expect(res.status).toBe(401);
  });

  it("returns 404 Not Found when proposal belongs to another provider (cross-tenant IDOR)", async () => {
    vi.mocked(getAuthenticatedUser).mockResolvedValueOnce(authUser as any);
    vi.mocked(prisma.changeOrder.findFirst).mockResolvedValueOnce({
      id: "prop_1",
      projectId: "proj_1",
      project: {
        id: "proj_1",
        ownerId: "usr_provider_b", // Owned by someone else
      },
    } as any);

    const req = new NextRequest(
      "http://localhost:3000/api/projects/proj_1/proposals/prop_1/delete",
      { method: "POST" }
    );
    const res = await POST(req, routeParams);
    expect(res.status).toBe(404);
  });

  it("returns 409 Conflict when project is archived", async () => {
    vi.mocked(getAuthenticatedUser).mockResolvedValueOnce(authUser as any);
    vi.mocked(prisma.changeOrder.findFirst).mockResolvedValueOnce({
      id: "prop_1",
      projectId: "proj_1",
      project: {
        id: "proj_1",
        ownerId: "usr_provider_a",
        status: "ARCHIVED",
        name: "Legacy App",
      },
    } as any);

    const req = new NextRequest(
      "http://localhost:3000/api/projects/proj_1/proposals/prop_1/delete",
      { method: "POST" }
    );
    const res = await POST(req, routeParams);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("PROJECT_ARCHIVED");
  });

  it("returns 409 Conflict when proposal is not eligible (e.g. APPROVED)", async () => {
    vi.mocked(getAuthenticatedUser).mockResolvedValueOnce(authUser as any);

    const mockProposal = {
      id: "prop_1",
      projectId: "proj_1",
      version: 1,
      status: "APPROVED",
      providerApprovedAt: new Date(),
      invoices: [],
      project: {
        id: "proj_1",
        ownerId: "usr_provider_a",
        status: "ACTIVE",
      },
    };

    mockChangeOrderFindFirst.mockResolvedValue(mockProposal as any);
    mockChangeOrderCount.mockResolvedValue(0);

    const req = new NextRequest(
      "http://localhost:3000/api/projects/proj_1/proposals/prop_1/delete",
      { method: "POST" }
    );
    const res = await POST(req, routeParams);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("NOT_DRAFT");
  });

  it("successfully soft-deletes an eligible draft proposal (200 OK)", async () => {
    vi.mocked(getAuthenticatedUser).mockResolvedValueOnce(authUser as any);

    const mockProposal = {
      id: "prop_1",
      projectId: "proj_1",
      version: 1,
      status: "DRAFT",
      providerApprovedAt: null,
      clientAcceptedAt: null,
      clientRejectedAt: null,
      reviewTokenHash: null,
      deletedAt: null,
      amount: "1500.00",
      currency: "USD",
      invoices: [],
      project: {
        id: "proj_1",
        ownerId: "usr_provider_a",
        status: "ACTIVE",
      },
    };

    mockChangeOrderFindFirst.mockResolvedValue(mockProposal as any);
    mockChangeOrderCount.mockResolvedValue(0);
    mockChangeOrderUpdate.mockResolvedValue({
      ...mockProposal,
      deletedAt: new Date(),
      deletedBy: "usr_provider_a",
    });
    mockProjectEventCreate.mockResolvedValue({ id: "evt_1" });

    const req = new NextRequest(
      "http://localhost:3000/api/projects/proj_1/proposals/prop_1/delete",
      { method: "POST" }
    );
    const res = await POST(req, routeParams);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.proposal.deletedBy).toBe("usr_provider_a");
  });

  it("rejects DELETE method on delete route with 405 Method Not Allowed", async () => {
    const res = await DELETE();
    expect(res.status).toBe(405);
    const body = await res.json();
    expect(body.code).toBe("METHOD_NOT_ALLOWED");
  });

  it("rejects DELETE method on root proposal route with 405 Method Not Allowed", async () => {
    const res = await rootProposalDelete();
    expect(res.status).toBe(405);
    const body = await res.json();
    expect(body.code).toBe("PERMANENT_DELETION_PROHIBITED");
  });
});
