import { describe, it, expect, vi, beforeEach } from "vitest";
import { PUT as updateProposal } from "@/app/api/projects/[id]/proposals/[proposalId]/route";
import { POST as branchVersion } from "@/app/api/projects/[id]/proposals/[proposalId]/versions/route";
import { POST as approveProposal } from "@/app/api/projects/[id]/proposals/[proposalId]/approve/route";
import { POST as withdrawProposal } from "@/app/api/projects/[id]/proposals/[proposalId]/withdraw/route";
import { GET as getReview } from "@/app/api/review/[token]/route";
import { POST as acceptReview } from "@/app/api/review/[token]/accept/route";
import { prisma } from "@/lib/db";
import { NextRequest } from "next/server";
import { buildApprovedSnapshot, computeSnapshotHash } from "../snapshot";
import { hashReviewToken } from "../tokens";

vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedUser: vi.fn().mockResolvedValue({
    id: "usr_demo_provider",
    name: "Sarah Jenkins",
    email: "provider@accordly.local",
  }),
  unauthorizedResponse: vi.fn(),
}));

vi.mock("@/lib/db", () => {
  const mockPrisma = {
    changeOrder: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    projectEvent: {
      create: vi.fn(),
    },
    $transaction: vi.fn(async (cb: any) => cb(mockPrisma)),
  };
  return { prisma: mockPrisma };
});

describe("Approved Proposal Immutability & Lifecycle Integration Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const baseProject = {
    id: "proj_test_1",
    name: "Enterprise Workflow Portal",
    clientName: "Global Logistics Corp",
    clientEmail: "ops@globallogistics.com",
    currency: "USD",
    hourlyRate: 150,
  };

  const sampleDeliverables = {
    title: "Change Proposal: Customs Automation",
    reasonForChange: "Addition of automated customs declaration",
    deliverables: [
      {
        id: "DEL-1",
        name: "Customs API Integration",
        description: "Connect to EDI customs gateway",
        acceptanceCriteria: ["Valid test clearance"],
        suggestedEffortHours: 20,
      },
    ],
    pricing: {
      model: "FIXED",
      currency: "USD",
      total: 3000,
      formattedTotal: "USD 3000.00",
      lineItems: [],
    },
    pricingConfig: {
      model: "FIXED",
      currency: "USD",
      fixedAmount: 3000,
      lineItems: [],
    },
    assumptions: ["Gateway access provided"],
    exclusions: ["Custom hardware"],
    dependencies: ["API keys"],
    timelineImpact: "+2 weeks",
  };

  describe("1. Server-Side Direct Mutation Prevention (PUT /proposals/[id])", () => {
    it("allows editing a DRAFT proposal and recalculates pricing", async () => {
      const draftProposal = {
        id: "prop_draft_1",
        projectId: "proj_test_1",
        version: 1,
        status: "DRAFT",
        description: "Initial draft",
        amount: 3000,
        currency: "USD",
        timelineImpact: "+2 weeks",
        project: baseProject,
        deliverables: sampleDeliverables,
      };

      vi.mocked(prisma.changeOrder.findFirst).mockResolvedValueOnce(draftProposal as any);
      (vi.mocked(prisma.changeOrder.update) as any).mockImplementationOnce(async ({ data }: any) => ({
        ...draftProposal,
        ...data,
      }));

      const req = new NextRequest("http://localhost:3000/api/projects/proj_test_1/proposals/prop_draft_1", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Updated Customs Automation",
          pricingConfig: {
            model: "FIXED",
            currency: "USD",
            fixedAmount: 4500,
            lineItems: [],
          },
        }),
      });

      const res = await updateProposal(req, {
        params: Promise.resolve({ id: "proj_test_1", proposalId: "prop_draft_1" }),
      });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.isNewVersion).toBe(false);
      expect(prisma.changeOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "prop_draft_1" },
          data: expect.objectContaining({
            amount: 4500,
          }),
        })
      );
    });

    it.each([
      ["APPROVED"],
      ["SENT_TO_CLIENT"],
      ["CLIENT_ACCEPTED"],
      ["CLIENT_REJECTED"],
      ["SUPERSEDED"],
      ["WITHDRAWN"],
    ])("rejects modification of %s proposal with HTTP 409 Conflict", async (status) => {
      const lockedProposal = {
        id: `prop_${status.toLowerCase()}`,
        projectId: "proj_test_1",
        version: 1,
        status,
        description: "Locked proposal",
        amount: 3000,
        currency: "USD",
        project: baseProject,
        deliverables: sampleDeliverables,
      };

      vi.mocked(prisma.changeOrder.findFirst).mockResolvedValueOnce(lockedProposal as any);

      const req = new NextRequest(
        `http://localhost:3000/api/projects/proj_test_1/proposals/${lockedProposal.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "Unauthorized Overwrite Attempt" }),
        }
      );

      const res = await updateProposal(req, {
        params: Promise.resolve({ id: "proj_test_1", proposalId: lockedProposal.id }),
      });
      const data = await res.json();

      expect(res.status).toBe(409);
      expect(data.error).toContain("is locked");
      expect(data.status).toBe(status);
      expect(prisma.changeOrder.update).not.toHaveBeenCalled();
    });
  });

  describe("2. Version Branching API (POST /proposals/[id]/versions)", () => {
    it("rejects branching a new version from a proposal that is already in DRAFT status", async () => {
      const draftProposal = {
        id: "prop_draft_1",
        projectId: "proj_test_1",
        version: 1,
        status: "DRAFT",
        project: baseProject,
        deliverables: sampleDeliverables,
      };

      vi.mocked(prisma.changeOrder.findFirst).mockResolvedValueOnce(draftProposal as any);

      const req = new NextRequest("http://localhost:3000/api/projects/proj_test_1/proposals/prop_draft_1/versions", {
        method: "POST",
      });

      const res = await branchVersion(req, {
        params: Promise.resolve({ id: "proj_test_1", proposalId: "prop_draft_1" }),
      });
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toContain("already in DRAFT status");
    });

    it("rejects branching from a WITHDRAWN proposal", async () => {
      const withdrawnProposal = {
        id: "prop_withdrawn_1",
        projectId: "proj_test_1",
        version: 1,
        status: "WITHDRAWN",
        project: baseProject,
        deliverables: sampleDeliverables,
      };

      vi.mocked(prisma.changeOrder.findFirst).mockResolvedValueOnce(withdrawnProposal as any);

      const req = new NextRequest("http://localhost:3000/api/projects/proj_test_1/proposals/prop_withdrawn_1/versions", {
        method: "POST",
      });

      const res = await branchVersion(req, {
        params: Promise.resolve({ id: "proj_test_1", proposalId: "prop_withdrawn_1" }),
      });
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toContain("Cannot branch a new version from a withdrawn proposal");
    });

    it("branches an APPROVED proposal into a new DRAFT (vN+1) without mutating predecessor", async () => {
      const approvedProposal = {
        id: "prop_app_1",
        projectId: "proj_test_1",
        version: 1,
        status: "APPROVED",
        description: "Approved terms",
        amount: 3000,
        currency: "USD",
        assumptions: "Gateway access provided",
        timelineImpact: "+2 weeks",
        project: baseProject,
        deliverables: {
          ...sampleDeliverables,
          approvedSnapshot: { ...sampleDeliverables },
          approvedSnapshotHash: "dummy_hash_1",
        },
      };

      // 1. find source proposal
      vi.mocked(prisma.changeOrder.findFirst)
        .mockResolvedValueOnce(approvedProposal as any) // source
        .mockResolvedValueOnce(approvedProposal as any); // latest version lookup

      // mock create for new DRAFT version
      (vi.mocked(prisma.changeOrder.create) as any).mockImplementationOnce(async ({ data }: any) => ({
        id: "prop_app_2",
        ...data,
      }));

      const req = new NextRequest("http://localhost:3000/api/projects/proj_test_1/proposals/prop_app_1/versions", {
        method: "POST",
      });

      const res = await branchVersion(req, {
        params: Promise.resolve({ id: "proj_test_1", proposalId: "prop_app_1" }),
      });
      const data = await res.json();

      expect(res.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.proposal.version).toBe(2);
      expect(data.proposal.status).toBe("DRAFT");
      expect(data.predecessor.id).toBe("prop_app_1");

      // Verify create call payload
      expect(prisma.changeOrder.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          version: 2,
          status: "DRAFT",
          deliverables: expect.objectContaining({
            predecessorProposalId: "prop_app_1",
            predecessorVersion: 1,
          }),
        }),
      });

      // Verify predecessor is NOT updated during branching
      expect(prisma.changeOrder.update).not.toHaveBeenCalled();

      // Verify audit event creation
      expect(prisma.projectEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventType: "PROPOSAL_VERSION_CREATED",
          metadata: expect.objectContaining({
            sourceProposalId: "prop_app_1",
            newVersion: 2,
          }),
        }),
      });
    });
  });

  describe("3. Delayed Supersession on Provider Approval (POST /approve)", () => {
    it("approves new draft version and supersedes its predecessor atomically", async () => {
      const predecessorProposal = {
        id: "prop_v1",
        projectId: "proj_test_1",
        version: 1,
        status: "APPROVED",
      };

      const newDraftProposal = {
        id: "prop_v2",
        projectId: "proj_test_1",
        version: 2,
        status: "DRAFT",
        description: "Updated terms",
        amount: 4500,
        currency: "USD",
        timelineImpact: "+3 weeks",
        project: baseProject,
        deliverables: {
          ...sampleDeliverables,
          predecessorProposalId: "prop_v1",
          predecessorVersion: 1,
        },
      };

      // 1. Look up new draft proposal
      vi.mocked(prisma.changeOrder.findFirst)
        .mockResolvedValueOnce(newDraftProposal as any)
        .mockResolvedValueOnce(predecessorProposal as any); // look up predecessor

      (vi.mocked(prisma.changeOrder.update) as any).mockImplementation(async ({ data }: any) => ({
        ...newDraftProposal,
        ...data,
      }));

      const req = new NextRequest("http://localhost:3000/api/projects/proj_test_1/proposals/prop_v2/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approverName: "Sarah Jenkins" }),
      });

      const res = await approveProposal(req, {
        params: Promise.resolve({ id: "proj_test_1", proposalId: "prop_v2" }),
      });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.proposal.status).toBe("APPROVED");
      expect(data.snapshotHash).toHaveLength(64);

      // Verify predecessor was transitioned to SUPERSEDED
      expect(prisma.changeOrder.update).toHaveBeenCalledWith({
        where: { id: "prop_v1" },
        data: { status: "SUPERSEDED" },
      });

      // Verify PROPOSAL_SUPERSEDED event logged
      expect(prisma.projectEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventType: "PROPOSAL_SUPERSEDED",
          metadata: expect.objectContaining({
            supersededProposalId: "prop_v1",
            supersedingProposalId: "prop_v2",
          }),
        }),
      });
    });

    it("rejects approving a proposal that is not in DRAFT status with HTTP 409 Conflict", async () => {
      const alreadyApproved = {
        id: "prop_v1",
        projectId: "proj_test_1",
        version: 1,
        status: "APPROVED",
        project: baseProject,
        deliverables: sampleDeliverables,
      };

      vi.mocked(prisma.changeOrder.findFirst).mockResolvedValueOnce(alreadyApproved as any);

      const req = new NextRequest("http://localhost:3000/api/projects/proj_test_1/proposals/prop_v1/approve", {
        method: "POST",
      });

      const res = await approveProposal(req, {
        params: Promise.resolve({ id: "proj_test_1", proposalId: "prop_v1" }),
      });
      const data = await res.json();

      expect(res.status).toBe(409);
      expect(data.error).toContain("Only DRAFT proposals can be approved");
    });
  });

  describe("4. Proposal Withdrawal Guard (POST /withdraw)", () => {
    it("rejects withdrawing a CLIENT_ACCEPTED proposal with HTTP 409 Conflict", async () => {
      const acceptedProposal = {
        id: "prop_acc_1",
        projectId: "proj_test_1",
        version: 1,
        status: "CLIENT_ACCEPTED",
        clientAcceptedAt: new Date("2026-11-08T10:00:00Z"),
      };

      vi.mocked(prisma.changeOrder.findFirst).mockResolvedValueOnce(acceptedProposal as any);

      const req = new NextRequest("http://localhost:3000/api/projects/proj_test_1/proposals/prop_acc_1/withdraw", {
        method: "POST",
      });

      const res = await withdrawProposal(req, {
        params: Promise.resolve({ id: "proj_test_1", proposalId: "prop_acc_1" }),
      });
      const data = await res.json();

      expect(res.status).toBe(409);
      expect(data.error).toContain("already been accepted by the client");
      expect(prisma.changeOrder.update).not.toHaveBeenCalled();
    });

    it("rejects withdrawing a SUPERSEDED proposal with HTTP 409 Conflict", async () => {
      const supersededProposal = {
        id: "prop_sup_1",
        projectId: "proj_test_1",
        version: 1,
        status: "SUPERSEDED",
      };

      vi.mocked(prisma.changeOrder.findFirst).mockResolvedValueOnce(supersededProposal as any);

      const req = new NextRequest("http://localhost:3000/api/projects/proj_test_1/proposals/prop_sup_1/withdraw", {
        method: "POST",
      });

      const res = await withdrawProposal(req, {
        params: Promise.resolve({ id: "proj_test_1", proposalId: "prop_sup_1" }),
      });
      const data = await res.json();

      expect(res.status).toBe(409);
      expect(data.error).toContain("already been superseded");
    });
  });

  describe("5. Client Decision & Review Protections", () => {
    const rawToken = "client_secret_token_12345";
    const tokenHash = hashReviewToken(rawToken);

    it("GET /review/[token] rejects access to SUPERSEDED proposal with HTTP 409 Conflict", async () => {
      const supersededProposal = {
        id: "prop_sup_1",
        version: 1,
        status: "SUPERSEDED",
        reviewTokenHash: tokenHash,
        reviewTokenExpiresAt: new Date(Date.now() + 86400000),
        project: baseProject,
      };

      vi.mocked(prisma.changeOrder.findFirst).mockResolvedValueOnce(supersededProposal as any);

      const req = new NextRequest(`http://localhost:3000/api/review/${rawToken}`);
      const res = await getReview(req, {
        params: Promise.resolve({ token: rawToken }),
      });
      const data = await res.json();

      expect(res.status).toBe(409);
      expect(data.error).toContain("superseded by a newer version");
    });

    it("POST /review/[token]/accept rejects acceptance of WITHDRAWN proposal with HTTP 409 Conflict", async () => {
      const withdrawnProposal = {
        id: "prop_w_1",
        version: 1,
        status: "WITHDRAWN",
        reviewTokenHash: tokenHash,
        reviewTokenExpiresAt: new Date(Date.now() + 86400000),
        project: baseProject,
      };

      vi.mocked(prisma.changeOrder.findFirst).mockResolvedValueOnce(withdrawnProposal as any);

      const req = new NextRequest(`http://localhost:3000/api/review/${rawToken}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientName: "Client Signer" }),
      });

      const res = await acceptReview(req, {
        params: Promise.resolve({ token: rawToken }),
      });
      const data = await res.json();

      expect(res.status).toBe(409);
      expect(data.error).toContain("was withdrawn by the service provider");
    });

    it("POST /review/[token]/accept rejects acceptance when snapshot hash verification fails", async () => {
      const validSnapshot = buildApprovedSnapshot({
        proposal: {
          id: "prop_tampered_1",
          version: 1,
          description: "Original description",
          amount: "3000.00",
          currency: "USD",
          deliverables: sampleDeliverables,
        },
        approverName: "Sarah Jenkins",
        approvedAt: new Date("2026-11-08T12:00:00Z"),
      });

      const validHash = computeSnapshotHash(validSnapshot);

      // Malicious payload tampering: Deliverable modified after provider approval
      const tamperedSnapshot = {
        ...validSnapshot,
        description: "Malicious tampered terms inserted into snapshot",
      };

      const tamperedProposal = {
        id: "prop_tampered_1",
        version: 1,
        status: "SENT_TO_CLIENT",
        amount: "3000.00",
        currency: "USD",
        reviewTokenHash: tokenHash,
        reviewTokenExpiresAt: new Date(Date.now() + 86400000),
        project: baseProject,
        deliverables: {
          ...sampleDeliverables,
          approvedSnapshot: tamperedSnapshot,
          approvedSnapshotHash: validHash,
        },
      };

      vi.mocked(prisma.changeOrder.findFirst).mockResolvedValueOnce(tamperedProposal as any);

      const req = new NextRequest(`http://localhost:3000/api/review/${rawToken}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientName: "Client Signer" }),
      });

      const res = await acceptReview(req, {
        params: Promise.resolve({ token: rawToken }),
      });
      const data = await res.json();

      expect(res.status).toBe(409);
      expect(data.error).toContain("integrity verification failed");
      expect(prisma.changeOrder.update).not.toHaveBeenCalled();
    });

    it("POST /review/[token]/accept successfully binds acceptance to snapshotHash when valid", async () => {
      const validSnapshot = buildApprovedSnapshot({
        proposal: {
          id: "prop_valid_1",
          version: 1,
          description: "Valid description",
          amount: "3000.00",
          currency: "USD",
          deliverables: sampleDeliverables,
        },
        approverName: "Sarah Jenkins",
        approvedAt: new Date("2026-11-08T12:00:00Z"),
      });

      const validHash = computeSnapshotHash(validSnapshot);

      const validProposal = {
        id: "prop_valid_1",
        projectId: "proj_test_1",
        version: 1,
        status: "SENT_TO_CLIENT",
        amount: "3000.00",
        currency: "USD",
        reviewTokenHash: tokenHash,
        reviewTokenExpiresAt: new Date(Date.now() + 86400000),
        project: baseProject,
        deliverables: {
          ...sampleDeliverables,
          approvedSnapshot: validSnapshot,
          approvedSnapshotHash: validHash,
        },
      };

      vi.mocked(prisma.changeOrder.findFirst).mockResolvedValueOnce(validProposal as any);
      (vi.mocked(prisma.changeOrder.update) as any).mockImplementationOnce(async ({ data }: any) => ({
        ...validProposal,
        ...data,
      }));

      const req = new NextRequest(`http://localhost:3000/api/review/${rawToken}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientName: "Alice Director", clientEmail: "alice@globallogistics.com" }),
      });

      const res = await acceptReview(req, {
        params: Promise.resolve({ token: rawToken }),
      });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.proposal.status).toBe("CLIENT_ACCEPTED");

      // Verify update call binds snapshotHash into clientDecision
      expect(prisma.changeOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "prop_valid_1" },
          data: expect.objectContaining({
            status: "CLIENT_ACCEPTED",
            deliverables: expect.objectContaining({
              clientDecision: expect.objectContaining({
                decision: "ACCEPTED",
                snapshotHash: validHash,
              }),
            }),
          }),
        })
      );
    });
  });
});
