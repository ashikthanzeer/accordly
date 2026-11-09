import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  buildApprovedSnapshot,
  computeSnapshotHash,
} from "@/lib/proposals/snapshot";
import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/auth/session";
import { isProjectOwnedByUser } from "@/lib/auth/ownership";
import { isProjectArchived, projectArchivedResponse } from "@/lib/projects/lifecycle";

interface RouteParams {
  params: Promise<{ id: string; proposalId: string }>;
}

/**
 * POST /api/projects/[id]/proposals/[proposalId]/approve
 * Provider approves the change proposal, locking its contents into an immutable
 * canonical snapshot with a cryptographic SHA-256 hash.
 * If this proposal was branched from a predecessor, supersedes the predecessor upon approval.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: projectId, proposalId } = await params;

    const user = await getAuthenticatedUser(req);
    if (!user) {
      return unauthorizedResponse();
    }

    const body = await req.json().catch(() => ({}));

    const proposal = await prisma.changeOrder.findFirst({
      where: { id: proposalId, projectId, deletedAt: null },
      include: { project: true },
    });

    if (
      !proposal ||
      !isProjectOwnedByUser(proposal.project?.ownerId, user.id)
    ) {
      return NextResponse.json(
        { error: "Proposal not found." },
        { status: 404 }
      );
    }

    if (isProjectArchived((proposal as any).project?.status)) {
      return projectArchivedResponse("req_appr", projectId, (proposal as any).project?.name);
    }

    if (proposal.status !== "DRAFT") {
      return NextResponse.json(
        {
          error: `Cannot approve proposal with status '${proposal.status}'. Only DRAFT proposals can be approved.`,
        },
        { status: 409 }
      );
    }

    const deliverablesObj =
      proposal.deliverables && typeof proposal.deliverables === "object"
        ? (proposal.deliverables as Record<string, unknown>)
        : {};

    const approvedAt = new Date();
    const approvedBy = body?.approverName || "Project Provider";

    // 1. Construct canonical snapshot and SHA-256 hash
    const approvedSnapshot = buildApprovedSnapshot({
      proposal,
      project: proposal.project,
      approverName: approvedBy,
      approvedAt,
    });
    const approvedSnapshotHash = computeSnapshotHash(approvedSnapshot);

    // 2. Predecessor Supersession
    const predecessorId = (deliverablesObj.predecessorProposalId ||
      deliverablesObj.supersededProposalId) as string | undefined;

    if (predecessorId && predecessorId !== proposalId) {
      const predecessor = await prisma.changeOrder.findFirst({
        where: { id: predecessorId, projectId },
      });

      if (predecessor) {
        // If predecessor was APPROVED or SENT_TO_CLIENT, transition it to SUPERSEDED
        if (
          predecessor.status === "APPROVED" ||
          predecessor.status === "PROVIDER_APPROVED" ||
          predecessor.status === "SENT_TO_CLIENT"
        ) {
          await prisma.changeOrder.update({
            where: { id: predecessor.id },
            data: { status: "SUPERSEDED" },
          });

          await prisma.projectEvent.create({
            data: {
              projectId,
              actorType: "SYSTEM",
              eventType: "PROPOSAL_SUPERSEDED",
              description: `Change Proposal v${predecessor.version} was superseded by approved v${proposal.version}.`,
              metadata: {
                supersededProposalId: predecessor.id,
                supersededVersion: predecessor.version,
                supersedingProposalId: proposal.id,
                supersedingVersion: proposal.version,
              },
            },
          });
        }
      }
    }

    // 3. Update current proposal to APPROVED with snapshot and hash
    const updated = await prisma.changeOrder.update({
      where: { id: proposalId },
      data: {
        status: "APPROVED",
        providerApprovedAt: approvedAt,
        deliverables: {
          ...deliverablesObj,
          approvedSnapshot,
          approvedSnapshotHash,
        } as any,
      },
    });

    // 4. Record audit event
    await prisma.projectEvent.create({
      data: {
        projectId,
        actorType: "PROVIDER",
        eventType: "PROPOSAL_APPROVED",
        description: `Provider explicitly approved Change Proposal v${proposal.version} for ${proposal.amount} ${proposal.currency} (Snapshot Hash: ${approvedSnapshotHash.slice(0, 12)}...).`,
        metadata: {
          proposalId,
          version: proposal.version,
          amount: Number(proposal.amount),
          currency: proposal.currency,
          approvedBy,
          approvedAt: approvedAt.toISOString(),
          snapshotHash: approvedSnapshotHash,
        },
      },
    });

    return NextResponse.json({
      success: true,
      proposal: updated,
      snapshotHash: approvedSnapshotHash,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
