import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST as handleArchive } from "@/app/api/projects/[id]/archive/route";
import { POST as handleRestore } from "@/app/api/projects/[id]/restore/route";
import { DELETE as handleDeleteProject } from "@/app/api/projects/[id]/route";
import { POST as handleDocumentUpload } from "@/app/api/projects/[id]/documents/route";
import { POST as handleChangeRequest } from "@/app/api/projects/[id]/change-requests/route";
import { POST as handleProposalCreate } from "@/app/api/projects/[id]/proposals/route";
import { POST as handleProposalDelete } from "@/app/api/projects/[id]/proposals/[proposalId]/delete/route";
import { POST as handleInvoiceCreate } from "@/app/api/projects/[id]/proposals/[proposalId]/invoice/create-and-send/route";
import { prisma } from "@/lib/db";
import * as sessionModule from "@/lib/auth/session";
import {
  getProjectFinancialSummary,
  assertProjectActive,
  isProjectArchived,
  ProjectArchivedError,
} from "@/lib/projects/lifecycle";

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
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    projectEvent: {
      create: vi.fn(),
    },
    changeRequest: {
      findFirst: vi.fn(),
    },
    scopeBaseline: {
      findFirst: vi.fn(),
    },
    changeOrder: {
      findFirst: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(async (cb: any) => cb(prisma)),
  },
}));

describe("Project Archiving & Lifecycle Management Integration Suite", () => {
  const providerA = {
    id: "usr_provider_alpha",
    name: "Alpha Studio",
    email: "alpha@studio.example.com",
  };

  const providerB = {
    id: "usr_provider_beta",
    name: "Beta Labs",
    email: "beta@labs.example.com",
  };

  const activeProjectWithPayments = {
    id: "proj_commercial_1",
    ownerId: "usr_provider_alpha",
    name: "Global E-Commerce Platform",
    clientName: "Retail Corp",
    clientEmail: "billing@retailcorp.example.com",
    currency: "USD",
    pricingModel: "ITEMIZED",
    hourlyRate: null,
    status: "ACTIVE",
    archivedAt: null,
    archivedBy: null,
    createdAt: new Date("2026-10-01T10:00:00Z"),
    updatedAt: new Date("2026-11-01T10:00:00Z"),
    invoices: [
      {
        id: "inv_paid_1",
        paypalInvoiceId: "INV2-PAID-001",
        status: "PAID",
        amount: "6000.00",
        currency: "USD",
      },
      {
        id: "inv_part_1",
        paypalInvoiceId: "INV2-PART-002",
        status: "PARTIALLY_PAID",
        amount: "4000.00",
        paidAmount: 1500,
        dueAmount: 2500,
        currency: "USD",
      },
    ],
  };

  const archivedProject = {
    id: "proj_archived_1",
    ownerId: "usr_provider_alpha",
    name: "Legacy Mobile App",
    clientName: "Mobile Corp",
    clientEmail: "contact@mobilecorp.example.com",
    currency: "USD",
    pricingModel: "HOURLY",
    hourlyRate: 150,
    status: "ARCHIVED",
    archivedAt: new Date("2026-11-05T12:00:00Z"),
    archivedBy: "usr_provider_alpha",
    createdAt: new Date("2026-09-01T10:00:00Z"),
    updatedAt: new Date("2026-11-05T12:00:00Z"),
    invoices: [
      {
        id: "inv_old_1",
        paypalInvoiceId: "INV2-OLD-001",
        status: "PAID",
        amount: "3000.00",
        currency: "USD",
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 1. Permanent Deletion Safeguard
  it("rejects DELETE /api/projects/[id] universally with HTTP 405 Method Not Allowed", async () => {
    const req = new NextRequest("http://localhost:3000/api/projects/proj_commercial_1", {
      method: "DELETE",
    });
    const res = await handleDeleteProject(req, {
      params: Promise.resolve({ id: "proj_commercial_1" }),
    });
    const data = await res.json();

    expect(res.status).toBe(405);
    expect(data.code).toBe("PERMANENT_DELETION_PROHIBITED");
    expect(data.allowedAlternative).toBe("ARCHIVE");
    expect(data.archiveEndpoint).toBe("/api/projects/proj_commercial_1/archive");
    expect(data.error).toContain("Permanent project deletion is prohibited");
  });

  // 2. Payment-Aware Financial Detection
  it("computes authoritative payment activity without double counting or cross-currency mixing", () => {
    const summary = getProjectFinancialSummary(activeProjectWithPayments);
    expect(summary.hasPaymentActivity).toBe(true);
    // Invoiced = 6000 + 4000 = 10000
    expect(summary.totalInvoiced).toBe(10000);
    // Collected = 6000 + 1500 = 7500
    expect(summary.totalCollected).toBe(7500);
    // Outstanding = 2500
    expect(summary.totalOutstanding).toBe(2500);
    expect(summary.formattedTotalInvoiced).toBe("$10,000.00");
    expect(summary.formattedTotalCollected).toBe("$7,500.00");
    expect(summary.formattedTotalOutstanding).toBe("$2,500.00");
  });

  // 3. Lifecycle Transitions (Archive & Restore)
  it("archives an active project, sets archival metadata, logs timeline event, and returns financial summary", async () => {
    vi.mocked(sessionModule.getAuthenticatedUser).mockResolvedValueOnce(providerA as any);
    vi.mocked(prisma.project.findUnique).mockResolvedValueOnce(activeProjectWithPayments as any);

    const archivedAt = new Date();
    vi.mocked(prisma.project.update).mockResolvedValueOnce({
      ...activeProjectWithPayments,
      status: "ARCHIVED",
      archivedAt,
      archivedBy: providerA.id,
    } as any);

    vi.mocked(prisma.projectEvent.create).mockResolvedValueOnce({ id: "evt_archived" } as any);

    const req = new NextRequest("http://localhost:3000/api/projects/proj_commercial_1/archive", {
      method: "POST",
    });
    const res = await handleArchive(req, {
      params: Promise.resolve({ id: "proj_commercial_1" }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.project.status).toBe("ARCHIVED");
    expect(data.financialSummary.hasPaymentActivity).toBe(true);
    expect(data.financialSummary.totalInvoiced).toBe(10000);
    expect(data.financialSummary.totalCollected).toBe(7500);

    // Verify audit event emission
    expect(prisma.projectEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          projectId: "proj_commercial_1",
          actorType: "PROVIDER",
          eventType: "PROJECT_ARCHIVED",
          metadata: expect.objectContaining({
            hasPaymentActivity: true,
            totalInvoiced: 10000,
            totalCollected: 7500,
          }),
        }),
      })
    );
  });

  it("restores an archived project back to active and clears archival metadata", async () => {
    vi.mocked(sessionModule.getAuthenticatedUser).mockResolvedValueOnce(providerA as any);
    vi.mocked(prisma.project.findUnique).mockResolvedValueOnce(archivedProject as any);

    vi.mocked(prisma.project.update).mockResolvedValueOnce({
      ...archivedProject,
      status: "ACTIVE",
      archivedAt: null,
      archivedBy: null,
    } as any);

    vi.mocked(prisma.projectEvent.create).mockResolvedValueOnce({ id: "evt_restored" } as any);

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

    expect(prisma.projectEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          projectId: "proj_archived_1",
          actorType: "PROVIDER",
          eventType: "PROJECT_RESTORED",
        }),
      })
    );
  });

  it("returns HTTP 409 Conflict when attempting duplicate archive or duplicate restore", async () => {
    vi.mocked(sessionModule.getAuthenticatedUser).mockResolvedValue(providerA as any);

    // 1. Archiving an already archived project
    vi.mocked(prisma.project.findUnique).mockResolvedValueOnce(archivedProject as any);
    const archiveReq = new NextRequest("http://localhost:3000/api/projects/proj_archived_1/archive", {
      method: "POST",
    });
    const archiveRes = await handleArchive(archiveReq, {
      params: Promise.resolve({ id: "proj_archived_1" }),
    });
    expect(archiveRes.status).toBe(409);
    const archiveData = await archiveRes.json();
    expect(archiveData.code).toBe("ALREADY_ARCHIVED");

    // 2. Restoring an already active project
    vi.mocked(prisma.project.findUnique).mockResolvedValueOnce(activeProjectWithPayments as any);
    const restoreReq = new NextRequest("http://localhost:3000/api/projects/proj_commercial_1/restore", {
      method: "POST",
    });
    const restoreRes = await handleRestore(restoreReq, {
      params: Promise.resolve({ id: "proj_commercial_1" }),
    });
    expect(restoreRes.status).toBe(409);
    const restoreData = await restoreRes.json();
    expect(restoreData.code).toBe("ALREADY_ACTIVE");
  });

  // 4. Multi-Tenant IDOR Isolation
  it("enforces tenant isolation: Provider B cannot archive or restore Provider A's projects (HTTP 404)", async () => {
    vi.mocked(sessionModule.getAuthenticatedUser).mockResolvedValue(providerB as any);

    // Cross-tenant archive
    vi.mocked(prisma.project.findUnique).mockResolvedValueOnce(activeProjectWithPayments as any);
    const archiveReq = new NextRequest("http://localhost:3000/api/projects/proj_commercial_1/archive", {
      method: "POST",
    });
    const archiveRes = await handleArchive(archiveReq, {
      params: Promise.resolve({ id: "proj_commercial_1" }),
    });
    expect(archiveRes.status).toBe(404);

    // Cross-tenant restore
    vi.mocked(prisma.project.findUnique).mockResolvedValueOnce(archivedProject as any);
    const restoreReq = new NextRequest("http://localhost:3000/api/projects/proj_archived_1/restore", {
      method: "POST",
    });
    const restoreRes = await handleRestore(restoreReq, {
      params: Promise.resolve({ id: "proj_archived_1" }),
    });
    expect(restoreRes.status).toBe(404);
  });

  // 5. Commercial Mutation Restrictions on Archived Projects
  it("enforces assertProjectActive guard and rejects commercial mutations on archived projects with HTTP 409", async () => {
    expect(() => assertProjectActive(archivedProject)).toThrow(ProjectArchivedError);

    vi.mocked(sessionModule.getAuthenticatedUser).mockResolvedValue(providerA as any);
    vi.mocked(prisma.project.findFirst).mockResolvedValue(archivedProject as any);
    vi.mocked(prisma.project.findUnique).mockResolvedValue(archivedProject as any);

    // 1. Document upload rejected
    const docReq = new NextRequest("http://localhost:3000/api/projects/proj_archived_1/documents", {
      method: "POST",
    });
    const docRes = await handleDocumentUpload(docReq, {
      params: Promise.resolve({ id: "proj_archived_1" }),
    });
    expect(docRes.status).toBe(409);
    const docData = await docRes.json();
    expect(docData.code).toBe("PROJECT_ARCHIVED");

    // 2. Change request submission rejected
    const crReq = new NextRequest("http://localhost:3000/api/projects/proj_archived_1/change-requests", {
      method: "POST",
      body: JSON.stringify({ requestText: "Add dark mode to customer dashboard" }),
    });
    const crRes = await handleChangeRequest(crReq, {
      params: Promise.resolve({ id: "proj_archived_1" }),
    });
    expect(crRes.status).toBe(409);
    const crData = await crRes.json();
    expect(crData.code).toBe("PROJECT_ARCHIVED");

    // 3. Proposal creation rejected
    const propReq = new NextRequest("http://localhost:3000/api/projects/proj_archived_1/proposals", {
      method: "POST",
      body: JSON.stringify({ changeRequestId: "req_1" }),
    });
    const propRes = await handleProposalCreate(propReq, {
      params: Promise.resolve({ id: "proj_archived_1" }),
    });
    expect(propRes.status).toBe(409);
    const propData = await propRes.json();
    expect(propData.code).toBe("PROJECT_ARCHIVED");

    // 4. Invoice generation rejected
    const invReq = new NextRequest(
      "http://localhost:3000/api/projects/proj_archived_1/proposals/prop_1/invoice/create-and-send",
      {
        method: "POST",
      }
    );
    const invRes = await handleInvoiceCreate(invReq, {
      params: Promise.resolve({ id: "proj_archived_1", proposalId: "prop_1" }),
    });
    expect(invRes.status).toBe(409);
    const invData = await invRes.json();
    expect(invData.code).toBe("PROJECT_ARCHIVED");

    // 5. Proposal deletion rejected on archived project
    vi.mocked(prisma.changeOrder.findFirst).mockResolvedValueOnce({
      id: "prop_1",
      projectId: "proj_archived_1",
      project: archivedProject,
    } as any);
    const delReq = new NextRequest(
      "http://localhost:3000/api/projects/proj_archived_1/proposals/prop_1/delete",
      {
        method: "POST",
      }
    );
    const delRes = await handleProposalDelete(delReq, {
      params: Promise.resolve({ id: "proj_archived_1", proposalId: "prop_1" }),
    });
    expect(delRes.status).toBe(409);
    const delData = await delRes.json();
    expect(delData.code).toBe("PROJECT_ARCHIVED");
  });
});

