import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const {
  mockGetSession,
  mockProjectFindMany,
  mockProjectFindUnique,
  mockProjectCreate,
  mockUserFindUnique,
  mockUserUpsert,
  mockChangeOrderFindUnique,
  mockChangeOrderFindFirst,
  mockProjectEventCreate,
  mockProjectEventFindMany,
  mockTransaction,
} = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockProjectFindMany: vi.fn(),
  mockProjectFindUnique: vi.fn(),
  mockProjectCreate: vi.fn(),
  mockUserFindUnique: vi.fn(),
  mockUserUpsert: vi.fn(),
  mockChangeOrderFindUnique: vi.fn(),
  mockChangeOrderFindFirst: vi.fn(),
  mockProjectEventCreate: vi.fn(),
  mockProjectEventFindMany: vi.fn(),
  mockTransaction: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: mockGetSession,
    },
  },
}));

vi.mock("@/lib/db", () => {
  const mockDb: Record<string, unknown> = {
    project: {
      findMany: mockProjectFindMany,
      findUnique: mockProjectFindUnique,
      create: mockProjectCreate,
    },
    user: {
      findUnique: mockUserFindUnique,
      upsert: mockUserUpsert,
    },
    changeOrder: {
      findUnique: mockChangeOrderFindUnique,
      findFirst: mockChangeOrderFindFirst,
    },
    projectEvent: {
      create: mockProjectEventCreate,
      findMany: mockProjectEventFindMany,
    },
    $transaction: mockTransaction,
  };
  return {
    db: mockDb,
    prisma: mockDb,
  };
});

import { GET as getProjects, POST as createProject } from "@/app/api/projects/route";
import { GET as getProjectById } from "@/app/api/projects/[id]/route";
import { POST as uploadDocument } from "@/app/api/projects/[id]/documents/route";
import { GET as getProposal, PUT as updateProposal } from "@/app/api/projects/[id]/proposals/[proposalId]/route";
import { GET as getInvoicePreview } from "@/app/api/projects/[id]/proposals/[proposalId]/invoice/preview/route";
import { GET as getDashboardOverview } from "@/app/api/dashboard/overview/route";
import { GET as getPublicReview } from "@/app/api/review/[token]/route";

const PROVIDER_A = {
  user: {
    id: "usr_provider_a",
    email: "alice@agency.com",
    name: "Alice Provider",
    image: "https://lh3.googleusercontent.com/a/alice",
    emailVerified: true,
  },
  session: {
    id: "sess_a",
    userId: "usr_provider_a",
    token: "tok_a",
    expiresAt: new Date(Date.now() + 86400_000),
  },
};

const PROVIDER_B = {
  user: {
    id: "usr_provider_b",
    email: "bob@studio.io",
    name: "Bob Studio",
    image: "https://lh3.googleusercontent.com/a/bob",
    emailVerified: true,
  },
  session: {
    id: "sess_b",
    userId: "usr_provider_b",
    token: "tok_b",
    expiresAt: new Date(Date.now() + 86400_000),
  },
};

describe("Multi-Tenant Authorization & IDOR Isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Unauthenticated API protection", () => {
    beforeEach(() => {
      mockGetSession.mockResolvedValue(null);
    });

    it("rejects unauthenticated GET /api/dashboard/overview with 401", async () => {
      const req = new NextRequest("http://localhost:3000/api/dashboard/overview");
      const res = await getDashboardOverview(req);
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toContain("Authentication required");
    });

    it("rejects unauthenticated GET /api/projects with 401", async () => {
      const req = new NextRequest("http://localhost:3000/api/projects");
      const res = await getProjects(req);
      expect(res.status).toBe(401);
    });

    it("rejects unauthenticated POST /api/projects with 401", async () => {
      const req = new NextRequest("http://localhost:3000/api/projects", {
        method: "POST",
        body: JSON.stringify({
          name: "Unauthorized Project",
          clientName: "Client",
          clientEmail: "client@example.com",
        }),
      });
      const res = await createProject(req);
      expect(res.status).toBe(401);
      expect(mockProjectCreate).not.toHaveBeenCalled();
    });

    it("rejects unauthenticated GET /api/projects/[id] with 401", async () => {
      const req = new NextRequest("http://localhost:3000/api/projects/proj_b");
      const res = await getProjectById(req, { params: Promise.resolve({ id: "proj_b" }) });
      expect(res.status).toBe(401);
      expect(mockProjectFindUnique).not.toHaveBeenCalled();
    });

    it("rejects unauthenticated GET /api/projects/[id]/proposals/[proposalId] with 401", async () => {
      const req = new NextRequest("http://localhost:3000/api/projects/proj_b/proposals/prop_1");
      const res = await getProposal(req, {
        params: Promise.resolve({ id: "proj_b", proposalId: "prop_1" }),
      });
      expect(res.status).toBe(401);
    });
  });

  describe("2. Provider Ownership Assignment & Scoped Queries", () => {
    it("assigns newly created projects to the authenticated provider's user ID", async () => {
      mockGetSession.mockResolvedValue(PROVIDER_A);
      const now = new Date("2026-11-08T12:00:00Z");
      const createdProject = {
        id: "proj_new_a",
        ownerId: "usr_provider_a",
        name: "Alice Brand Refresh",
        clientName: "Acme Corp",
        clientEmail: "acme@example.com",
        currency: "USD",
        pricingModel: "FIXED",
        hourlyRate: null,
        baselineConfirmedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      mockProjectCreate.mockResolvedValue(createdProject);
      mockProjectEventCreate.mockResolvedValue({ id: "evt_1" });

      const req = new NextRequest("http://localhost:3000/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Alice Brand Refresh",
          clientName: "Acme Corp",
          clientEmail: "acme@example.com",
          currency: "USD",
          pricingModel: "FIXED",
        }),
      });

      const res = await createProject(req);
      expect(res.status).toBe(201);
      expect(mockProjectCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            ownerId: "usr_provider_a",
            name: "Alice Brand Refresh",
          }),
        })
      );
    });

    it("filters GET /api/projects strictly by authenticated provider ownerId", async () => {
      mockGetSession.mockResolvedValue(PROVIDER_A);
      const now = new Date("2026-11-08T12:00:00Z");
      mockProjectFindMany.mockResolvedValue([
        {
          id: "proj_a",
          ownerId: "usr_provider_a",
          name: "Alice Project",
          clientName: "Acme Corp",
          clientEmail: "acme@example.com",
          currency: "USD",
          pricingModel: "FIXED",
          hourlyRate: null,
          baselineConfirmedAt: null,
          createdAt: now,
          updatedAt: now,
          clauses: [],
          _count: {
            documents: 1,
            changeRequests: 0,
            changeOrders: 0,
          },
        },
      ]);

      const req = new NextRequest("http://localhost:3000/api/projects");
      const res = await getProjects(req);
      expect(res.status).toBe(200);
      expect(mockProjectFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { ownerId: "usr_provider_a" },
        })
      );
    });

    it("scopes GET /api/dashboard/overview KPIs and recent events strictly to authenticated provider", async () => {
      mockGetSession.mockResolvedValue(PROVIDER_A);
      mockProjectFindMany.mockResolvedValue([]);
      mockProjectEventFindMany.mockResolvedValue([]);

      const req = new NextRequest("http://localhost:3000/api/dashboard/overview");
      const res = await getDashboardOverview(req);
      expect(res.status).toBe(200);

      expect(mockProjectFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { ownerId: "usr_provider_a" },
        })
      );
      expect(mockProjectEventFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            project: {
              ownerId: "usr_provider_a",
            },
          },
        })
      );
    });
  });

  describe("3. Cross-Tenant IDOR Protection (404 Not Found on Foreign Resources)", () => {
    beforeEach(() => {
      // Logged in as Provider A, attempting to access Provider B's project (proj_b)
      mockGetSession.mockResolvedValue(PROVIDER_A);
    });

    it("returns 404 when Provider A requests Provider B's project details (GET /api/projects/[id])", async () => {
      mockProjectFindUnique.mockResolvedValue({
        id: "proj_b",
        ownerId: "usr_provider_b",
        name: "Bob Secret Project",
      });

      const req = new NextRequest("http://localhost:3000/api/projects/proj_b");
      const res = await getProjectById(req, { params: Promise.resolve({ id: "proj_b" }) });
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toContain("not found");
      // Must not leak Bob's project name
      expect(JSON.stringify(body)).not.toContain("Bob Secret Project");
    });

    it("returns 404 when Provider A attempts to upload a document to Provider B's project", async () => {
      mockProjectFindUnique.mockResolvedValue({
        id: "proj_b",
        ownerId: "usr_provider_b",
      });

      const req = new NextRequest("http://localhost:3000/api/projects/proj_b/documents", {
        method: "POST",
      });
      const res = await uploadDocument(req, { params: Promise.resolve({ id: "proj_b" }) });
      expect(res.status).toBe(404);
    });

    it("returns 404 when Provider A attempts to read or modify Provider B's proposal", async () => {
      mockChangeOrderFindFirst.mockResolvedValue({
        id: "prop_b1",
        projectId: "proj_b",
        title: "Bob Private Proposal",
        project: {
          ownerId: "usr_provider_b",
          name: "Bob Project",
        },
      });
      mockProjectFindUnique.mockResolvedValue({
        id: "proj_b",
        ownerId: "usr_provider_b",
      });

      const getReq = new NextRequest("http://localhost:3000/api/projects/proj_b/proposals/prop_b1");
      const getRes = await getProposal(getReq, {
        params: Promise.resolve({ id: "proj_b", proposalId: "prop_b1" }),
      });
      expect(getRes.status).toBe(404);
      const getBody = await getRes.json();
      expect(JSON.stringify(getBody)).not.toContain("Bob Private Proposal");

      const putReq = new NextRequest("http://localhost:3000/api/projects/proj_b/proposals/prop_b1", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Hijacked Title" }),
      });
      const putRes = await updateProposal(putReq, {
        params: Promise.resolve({ id: "proj_b", proposalId: "prop_b1" }),
      });
      expect(putRes.status).toBe(404);
    });

    it("returns 404 when Provider A attempts to preview an invoice on Provider B's proposal", async () => {
      mockProjectFindUnique.mockResolvedValue({
        id: "proj_b",
        ownerId: "usr_provider_b",
      });

      const req = new NextRequest(
        "http://localhost:3000/api/projects/proj_b/proposals/prop_b1/invoice/preview"
      );
      const res = await getInvoicePreview(req, {
        params: Promise.resolve({ id: "proj_b", proposalId: "prop_b1" }),
      });
      expect(res.status).toBe(404);
    });

    it("allows Provider B to access their own project (200 OK)", async () => {
      mockGetSession.mockResolvedValue(PROVIDER_B);
      const now = new Date("2026-11-08T12:00:00Z");
      mockProjectFindUnique.mockResolvedValue({
        id: "proj_b",
        ownerId: "usr_provider_b",
        name: "Bob Legitimate Project",
        clientName: "Bob Client",
        clientEmail: "client@bob.io",
        currency: "USD",
        pricingModel: "FIXED",
        hourlyRate: null,
        baselineConfirmedAt: null,
        createdAt: now,
        updatedAt: now,
        documents: [],
        clauses: [],
        changeRequests: [],
        changeOrders: [],
        _count: {
          documents: 0,
          clauses: 0,
          changeRequests: 0,
          changeOrders: 0,
        },
      });

      const req = new NextRequest("http://localhost:3000/api/projects/proj_b");
      const res = await getProjectById(req, { params: Promise.resolve({ id: "proj_b" }) });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.project.name).toBe("Bob Legitimate Project");
    });
  });

  describe("4. Public Workflow Preservation (Client Review Links)", () => {
    it("allows unauthenticated client access to GET /api/review/[token] without session cookies", async () => {
      mockGetSession.mockResolvedValue(null);
      mockChangeOrderFindFirst.mockResolvedValue(null);

      // Even with no session, /api/review/[token] processes the token lookup and returns 404 (token not found) rather than 401
      const req = new NextRequest("http://localhost:3000/api/review/sample_public_token_12345");
      const res = await getPublicReview(req, {
        params: Promise.resolve({ token: "sample_public_token_12345" }),
      });
      expect(res.status).not.toBe(401);
      expect(res.status).toBe(404);
    });
  });
});
