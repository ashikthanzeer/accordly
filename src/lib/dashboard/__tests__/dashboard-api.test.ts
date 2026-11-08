import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET as handleDashboardGet } from "../../../app/api/dashboard/overview/route";
import { GET as handleTimelineGet } from "../../../app/api/projects/[id]/timeline/route";
import { prisma } from "@/lib/db";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedUser: vi.fn().mockResolvedValue({
    id: "usr_demo_provider",
    name: "Sarah Jenkins",
    email: "provider@accordly.local",
  }),
  unauthorizedResponse: vi.fn(),
}));

vi.mock("@/lib/db", () => {
  return {
    prisma: {
      project: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
      },
      projectEvent: {
        findMany: vi.fn(),
      },
    },
  };
});

describe("Dashboard & Timeline API Endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/dashboard/overview", () => {
    it("returns structured overview matching database records", async () => {
      const mockProjects = [
        {
          id: "proj_dash_1",
          name: "SaaS Platform Redesign",
          clientName: "Initech",
          clientEmail: "billing@initech.com",
          currency: "USD",
          status: "ACTIVE",
          updatedAt: new Date("2026-11-06T12:00:00Z"),
          baselines: [{ id: "b1", status: "CONFIRMED", version: 1 }],
          requests: [],
          changeOrders: [
            {
              id: "prop_1",
              version: 1,
              status: "CLIENT_ACCEPTED",
              invoices: [
                {
                  id: "inv_1",
                  paypalInvoiceId: "INV2-DASH-01",
                  status: "PAID",
                  currency: "USD",
                  amount: { toString: () => "3500.00" },
                },
              ],
            },
          ],
          invoices: [
            {
              id: "inv_1",
              paypalInvoiceId: "INV2-DASH-01",
              status: "PAID",
              currency: "USD",
              amount: { toString: () => "3500.00" },
            },
          ],
        },
      ];

      vi.mocked(prisma.project.findMany).mockResolvedValueOnce(mockProjects as any);
      vi.mocked(prisma.projectEvent.findMany).mockResolvedValueOnce([
        {
          id: "evt_1",
          projectId: "proj_dash_1",
          actorType: "PAYPAL",
          eventType: "PAYPAL_PAYMENT_RECONCILED",
          description: "Payment of $3500.00 reconciled.",
          createdAt: new Date("2026-11-06T12:00:00Z"),
          project: { id: "proj_dash_1", name: "SaaS Platform Redesign" },
        },
      ] as any);

      const req = new NextRequest("http://localhost:3000/api/dashboard/overview");
      const res = await handleDashboardGet(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.kpis).toBeDefined();
      expect(data.kpis.activeProjectsCount).toBe(1);
      expect(data.financialSummaries["USD"]).toBeDefined();
      expect(data.financialSummaries["USD"].totalInvoiced).toBe(3500.0);
      expect(data.financialSummaries["USD"].totalCollected).toBe(3500.0);
      expect(data.financialSummaries["USD"].outstandingBalance).toBe(0.0);
      expect(data.recentProjects).toHaveLength(1);
      expect(data.recentActivity).toHaveLength(1);
    });
  });

  describe("GET /api/projects/[id]/timeline", () => {
    it("returns chronological events for existing project", async () => {
      vi.mocked(prisma.project.findUnique).mockResolvedValueOnce({
        id: "proj_time_1",
        name: "FinTech Migration",
        clientName: "Apex Corp",
        status: "ACTIVE",
      } as any);

      vi.mocked(prisma.projectEvent.findMany).mockResolvedValueOnce([
        {
          id: "evt_time_1",
          projectId: "proj_time_1",
          actorType: "PROVIDER",
          eventType: "SCOPE_BASELINE_CONFIRMED",
          description: "Agreed scope baseline confirmed.",
          createdAt: new Date("2026-11-06T10:00:00Z"),
        },
      ] as any);

      const req = new NextRequest("http://localhost:3000/api/projects/proj_time_1/timeline");
      const res = await handleTimelineGet(req, {
        params: Promise.resolve({ id: "proj_time_1" }),
      });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.project.name).toBe("FinTech Migration");
      expect(data.events).toHaveLength(1);
      expect(data.events[0].category).toBe("SCOPE");
      expect(data.events[0].actorType).toBe("PROVIDER");
    });

    it("returns HTTP 404 for non-existent project", async () => {
      vi.mocked(prisma.project.findUnique).mockResolvedValueOnce(null);

      const req = new NextRequest("http://localhost:3000/api/projects/proj_missing/timeline");
      const res = await handleTimelineGet(req, {
        params: Promise.resolve({ id: "proj_missing" }),
      });

      expect(res.status).toBe(404);
    });
  });
});

