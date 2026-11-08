import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST as handleArchive } from "@/app/api/projects/[id]/archive/route";
import { POST as handleRestore } from "@/app/api/projects/[id]/restore/route";
import { prisma } from "@/lib/db";
import * as sessionModule from "@/lib/auth/session";

vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedUser: vi.fn(),
  unauthorizedResponse: vi.fn((correlationId) =>
    new Response(JSON.stringify({ error: "Unauthorized", correlationId }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    })
  ),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    project: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    projectEvent: {
      create: vi.fn(),
    },
  },
}));

describe("Project Archive & Restore APIs", () => {
  const providerA = {
    id: "usr_provider_a",
    name: "Alice Provider",
    email: "alice@provider.example.com",
  };

  const providerB = {
    id: "usr_provider_b",
    name: "Bob Provider",
    email: "bob@provider.example.com",
  };

  const activeProject = {
    id: "proj_active_1",
    ownerId: "usr_provider_a",
    name: "Storefront Overhaul",
    clientName: "Acme Corp",
    clientEmail: "acme@client.com",
    currency: "USD",
    pricingModel: "FIXED",
    hourlyRate: null,
    status: "ACTIVE",
    archivedAt: null,
    archivedBy: null,
    createdAt: new Date("2026-11-01T10:00:00Z"),
    updatedAt: new Date("2026-11-01T10:00:00Z"),
    invoices: [
      {
        id: "inv_1",
        paypalInvoiceId: "INV2-PAID-1",
        status: "PAID",
        amount: "5000.00",
        currency: "USD",
      },
    ],
  };

  const archivedProject = {
    id: "proj_archived_1",
    ownerId: "usr_provider_a",
    name: "Old Campaign",
    clientName: "Globex Corp",
    clientEmail: "globex@client.com",
    currency: "USD",
    pricingModel: "HOURLY",
    hourlyRate: 150,
    status: "ARCHIVED",
    archivedAt: new Date("2026-11-05T12:00:00Z"),
    archivedBy: "usr_provider_a",
    createdAt: new Date("2026-10-01T10:00:00Z"),
    updatedAt: new Date("2026-11-05T12:00:00Z"),
    invoices: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("POST /api/projects/[id]/archive archives an active project and emits event (HTTP 200)", async () => {
    vi.mocked(sessionModule.getAuthenticatedUser).mockResolvedValueOnce(providerA as any);
    vi.mocked(prisma.project.findUnique).mockResolvedValueOnce(activeProject as any);

    const now = new Date();
    vi.mocked(prisma.project.update).mockResolvedValueOnce({
      ...activeProject,
      status: "ARCHIVED",
      archivedAt: now,
      archivedBy: providerA.id,
    } as any);

    vi.mocked(prisma.projectEvent.create).mockResolvedValueOnce({ id: "evt_1" } as any);

    const req = new NextRequest("http://localhost:3000/api/projects/proj_active_1/archive", {
      method: "POST",
    });
    const res = await handleArchive(req, {
      params: Promise.resolve({ id: "proj_active_1" }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.project.status).toBe("ARCHIVED");
    expect(data.financialSummary.hasPaymentActivity).toBe(true);
    expect(data.financialSummary.totalInvoiced).toBe(5000);
    expect(data.financialSummary.totalCollected).toBe(5000);

    expect(prisma.project.update).toHaveBeenCalledWith({
      where: { id: "proj_active_1" },
      data: expect.objectContaining({
        status: "ARCHIVED",
        archivedBy: providerA.id,
      }),
    });
    expect(prisma.projectEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          projectId: "proj_active_1",
          eventType: "PROJECT_ARCHIVED",
        }),
      })
    );
  });

  it("POST /api/projects/[id]/archive returns HTTP 409 Conflict if project is already archived", async () => {
    vi.mocked(sessionModule.getAuthenticatedUser).mockResolvedValueOnce(providerA as any);
    vi.mocked(prisma.project.findUnique).mockResolvedValueOnce(archivedProject as any);

    const req = new NextRequest("http://localhost:3000/api/projects/proj_archived_1/archive", {
      method: "POST",
    });
    const res = await handleArchive(req, {
      params: Promise.resolve({ id: "proj_archived_1" }),
    });
    const data = await res.json();

    expect(res.status).toBe(409);
    expect(data.code).toBe("ALREADY_ARCHIVED");
    expect(prisma.project.update).not.toHaveBeenCalled();
  });

  it("POST /api/projects/[id]/archive rejects unauthenticated requests with HTTP 401", async () => {
    vi.mocked(sessionModule.getAuthenticatedUser).mockResolvedValueOnce(null);

    const req = new NextRequest("http://localhost:3000/api/projects/proj_active_1/archive", {
      method: "POST",
    });
    const res = await handleArchive(req, {
      params: Promise.resolve({ id: "proj_active_1" }),
    });

    expect(res.status).toBe(401);
    expect(prisma.project.update).not.toHaveBeenCalled();
  });

  it("POST /api/projects/[id]/archive returns HTTP 404 for cross-tenant archive attempt (Provider B -> Provider A's project)", async () => {
    vi.mocked(sessionModule.getAuthenticatedUser).mockResolvedValueOnce(providerB as any);
    // Project owned by provider A
    vi.mocked(prisma.project.findUnique).mockResolvedValueOnce(activeProject as any);

    const req = new NextRequest("http://localhost:3000/api/projects/proj_active_1/archive", {
      method: "POST",
    });
    const res = await handleArchive(req, {
      params: Promise.resolve({ id: "proj_active_1" }),
    });
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toContain("not found");
    expect(prisma.project.update).not.toHaveBeenCalled();
  });

  it("POST /api/projects/[id]/restore restores an archived project back to ACTIVE (HTTP 200)", async () => {
    vi.mocked(sessionModule.getAuthenticatedUser).mockResolvedValueOnce(providerA as any);
    vi.mocked(prisma.project.findUnique).mockResolvedValueOnce(archivedProject as any);

    vi.mocked(prisma.project.update).mockResolvedValueOnce({
      ...archivedProject,
      status: "ACTIVE",
      archivedAt: null,
      archivedBy: null,
    } as any);

    vi.mocked(prisma.projectEvent.create).mockResolvedValueOnce({ id: "evt_2" } as any);

    const req = new NextRequest("http://localhost:3000/api/projects/proj_archived_1/restore", {
      method: "POST",
    });
    const res = await handleRestore(req, {
      params: Promise.resolve({ id: "proj_archived_1" }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.project.status).toBe("ACTIVE");
    expect(data.project.archivedAt).toBeNull();
    expect(data.project.archivedBy).toBeNull();

    expect(prisma.project.update).toHaveBeenCalledWith({
      where: { id: "proj_archived_1" },
      data: {
        status: "ACTIVE",
        archivedAt: null,
        archivedBy: null,
      },
    });
    expect(prisma.projectEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          projectId: "proj_archived_1",
          eventType: "PROJECT_RESTORED",
        }),
      })
    );
  });

  it("POST /api/projects/[id]/restore returns HTTP 409 Conflict if project is already active", async () => {
    vi.mocked(sessionModule.getAuthenticatedUser).mockResolvedValueOnce(providerA as any);
    vi.mocked(prisma.project.findUnique).mockResolvedValueOnce(activeProject as any);

    const req = new NextRequest("http://localhost:3000/api/projects/proj_active_1/restore", {
      method: "POST",
    });
    const res = await handleRestore(req, {
      params: Promise.resolve({ id: "proj_active_1" }),
    });
    const data = await res.json();

    expect(res.status).toBe(409);
    expect(data.code).toBe("ALREADY_ACTIVE");
    expect(prisma.project.update).not.toHaveBeenCalled();
  });

  it("POST /api/projects/[id]/restore returns HTTP 404 for cross-tenant restore attempt", async () => {
    vi.mocked(sessionModule.getAuthenticatedUser).mockResolvedValueOnce(providerB as any);
    vi.mocked(prisma.project.findUnique).mockResolvedValueOnce(archivedProject as any);

    const req = new NextRequest("http://localhost:3000/api/projects/proj_archived_1/restore", {
      method: "POST",
    });
    const res = await handleRestore(req, {
      params: Promise.resolve({ id: "proj_archived_1" }),
    });

    expect(res.status).toBe(404);
    expect(prisma.project.update).not.toHaveBeenCalled();
  });
});

