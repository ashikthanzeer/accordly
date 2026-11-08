import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { CreateProjectSchema } from "../schema";
import {
  POST as handleCreateProject,
  GET as handleListProjects,
} from "../../../app/api/projects/route";
import {
  GET as handleGetProjectById,
  DELETE as handleDeleteProject,
} from "../../../app/api/projects/[id]/route";
import { prisma } from "@/lib/db";

vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedUser: vi.fn().mockResolvedValue({
    id: "usr_demo_provider",
    name: "Sarah Jenkins",
    email: "provider@accordly.local",
  }),
  unauthorizedResponse: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      upsert: vi.fn(),
    },
    project: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    projectEvent: {
      create: vi.fn(),
    },
  },
}));

describe("Project Creation Validation Schema (src/lib/projects/schema.ts)", () => {
  it("validates a complete HOURLY project creation payload", () => {
    const parsed = CreateProjectSchema.safeParse({
      name: "Enterprise Brand & Web Overhaul",
      clientName: "Sterling Cooper",
      clientEmail: "accounts@sterlingcooper.com",
      currency: "usd",
      pricingModel: "HOURLY",
      hourlyRate: "175.50",
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.name).toBe("Enterprise Brand & Web Overhaul");
      expect(parsed.data.clientName).toBe("Sterling Cooper");
      expect(parsed.data.clientEmail).toBe("accounts@sterlingcooper.com");
      expect(parsed.data.currency).toBe("USD");
      expect(parsed.data.pricingModel).toBe("HOURLY");
      expect(parsed.data.hourlyRate).toBe(175.5);
    }
  });

  it("allows optional / empty clientEmail and FIXED pricing without hourlyRate", () => {
    const parsed = CreateProjectSchema.safeParse({
      name: "Mobile App MVP",
      clientName: "Globex Corp",
      clientEmail: "",
      currency: "EUR",
      pricingModel: "FIXED",
      hourlyRate: null,
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.clientEmail).toBe("");
      expect(parsed.data.pricingModel).toBe("FIXED");
      expect(parsed.data.hourlyRate).toBeNull();
    }
  });

  it("rejects missing project name or client name", () => {
    const missingName = CreateProjectSchema.safeParse({
      name: "   ",
      clientName: "Acme Corp",
      currency: "USD",
      pricingModel: "FIXED",
    });
    expect(missingName.success).toBe(false);

    const missingClient = CreateProjectSchema.safeParse({
      name: "Redesign",
      clientName: "",
      currency: "USD",
      pricingModel: "FIXED",
    });
    expect(missingClient.success).toBe(false);
  });

  it("rejects HOURLY pricing model when hourlyRate is missing or non-positive", () => {
    const missingRate = CreateProjectSchema.safeParse({
      name: "Retainer Engagement",
      clientName: "Wayne Enterprises",
      currency: "USD",
      pricingModel: "HOURLY",
      hourlyRate: "",
    });
    expect(missingRate.success).toBe(false);

    const negativeRate = CreateProjectSchema.safeParse({
      name: "Retainer Engagement",
      clientName: "Wayne Enterprises",
      currency: "USD",
      pricingModel: "HOURLY",
      hourlyRate: -50,
    });
    expect(negativeRate.success).toBe(false);
  });

  it("rejects invalid clientEmail format when provided", () => {
    const badEmail = CreateProjectSchema.safeParse({
      name: "Portal Build",
      clientName: "Stark Industries",
      clientEmail: "not-an-email",
      currency: "USD",
      pricingModel: "ITEMIZED",
    });
    expect(badEmail.success).toBe(false);
  });
});

describe("Project Creation & Retrieval API Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("POST /api/projects creates a project and logs PROJECT_CREATED event (HTTP 201)", async () => {
    vi.mocked(prisma.user.upsert).mockResolvedValueOnce({
      id: "usr_demo_provider",
      name: "Sarah Jenkins",
      email: "provider@accordly.local",
    } as any);

    const now = new Date("2026-11-08T12:00:00Z");
    vi.mocked(prisma.project.create).mockResolvedValueOnce({
      id: "proj_created_123",
      ownerId: "usr_demo_provider",
      name: "Cloud Migration & Security Audit",
      clientName: "Hooli Inc",
      clientEmail: "finance@hooli.com",
      currency: "USD",
      pricingModel: "HOURLY",
      hourlyRate: 200,
      status: "ACTIVE",
      createdAt: now,
      updatedAt: now,
    } as any);

    vi.mocked(prisma.projectEvent.create).mockResolvedValueOnce({
      id: "evt_created_123",
    } as any);

    const req = new NextRequest("http://localhost:3000/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Cloud Migration & Security Audit",
        clientName: "Hooli Inc",
        clientEmail: "finance@hooli.com",
        currency: "USD",
        pricingModel: "HOURLY",
        hourlyRate: 200,
      }),
    });

    const res = await handleCreateProject(req);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.project.id).toBe("proj_created_123");
    expect(data.project.name).toBe("Cloud Migration & Security Audit");
    expect(data.project.clientName).toBe("Hooli Inc");
    expect(data.project.hourlyRate).toBe(200);
    expect(prisma.project.create).toHaveBeenCalledTimes(1);
    expect(prisma.projectEvent.create).toHaveBeenCalledTimes(1);
  });

  it("POST /api/projects returns HTTP 400 with fieldErrors for invalid input", async () => {
    const req = new NextRequest("http://localhost:3000/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "",
        clientName: "Acme",
        pricingModel: "HOURLY",
        hourlyRate: null,
      }),
    });

    const res = await handleCreateProject(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBeDefined();
    expect(data.fieldErrors).toBeDefined();
    expect(data.correlationId).toMatch(/^req_/);
    expect(prisma.project.create).not.toHaveBeenCalled();
  });

  it("GET /api/projects lists persisted projects (HTTP 200)", async () => {
    const now = new Date("2026-11-08T12:00:00Z");
    vi.mocked(prisma.project.findMany).mockResolvedValueOnce([
      {
        id: "proj_1",
        ownerId: "usr_demo_provider",
        name: "Project Alpha",
        clientName: "Alpha Client",
        clientEmail: "alpha@client.com",
        currency: "GBP",
        pricingModel: "FIXED",
        hourlyRate: null,
        status: "ACTIVE",
        createdAt: now,
        updatedAt: now,
      },
    ] as any);

    const res = await handleListProjects(new NextRequest("http://localhost:3000/api/projects"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.projects).toHaveLength(1);
    expect(data.projects[0].name).toBe("Project Alpha");
    expect(data.projects[0].currency).toBe("GBP");
  });

  it("GET /api/projects/[id] returns HTTP 200 for existing project and HTTP 404 when missing", async () => {
    const now = new Date("2026-11-08T12:00:00Z");
    vi.mocked(prisma.project.findUnique).mockResolvedValueOnce({
      id: "proj_existing",
      ownerId: "usr_demo_provider",
      name: "Design System v2",
      clientName: "Umbrella Corp",
      clientEmail: "ops@umbrella.com",
      currency: "USD",
      pricingModel: "ITEMIZED",
      hourlyRate: 140,
      status: "ACTIVE",
      createdAt: now,
      updatedAt: now,
    } as any);

    const foundReq = new NextRequest("http://localhost:3000/api/projects/proj_existing");
    const foundRes = await handleGetProjectById(foundReq, {
      params: Promise.resolve({ id: "proj_existing" }),
    });
    const foundData = await foundRes.json();

    expect(foundRes.status).toBe(200);
    expect(foundData.project.name).toBe("Design System v2");

    vi.mocked(prisma.project.findUnique).mockResolvedValueOnce(null);
    const missingReq = new NextRequest("http://localhost:3000/api/projects/proj_unknown");
    const missingRes = await handleGetProjectById(missingReq, {
      params: Promise.resolve({ id: "proj_unknown" }),
    });
    expect(missingRes.status).toBe(404);
  });

  it("DELETE /api/projects/[id] universally rejects permanent deletion with HTTP 405 Method Not Allowed", async () => {
    const delReq = new NextRequest("http://localhost:3000/api/projects/proj_existing", {
      method: "DELETE",
    });
    const delRes = await handleDeleteProject(delReq, {
      params: Promise.resolve({ id: "proj_existing" }),
    });
    const data = await delRes.json();

    expect(delRes.status).toBe(405);
    expect(data.code).toBe("PERMANENT_DELETION_PROHIBITED");
    expect(data.archiveEndpoint).toBe("/api/projects/proj_existing/archive");
    expect(data.error).toContain("Permanent project deletion is prohibited");
  });
});

