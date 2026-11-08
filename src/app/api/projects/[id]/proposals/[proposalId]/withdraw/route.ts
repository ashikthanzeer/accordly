import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/auth/session";
import { isProjectOwnedByUser } from "@/lib/auth/ownership";
import { isProjectArchived, projectArchivedResponse } from "@/lib/projects/lifecycle";

interface RouteParams {
  params: Promise<{ id: string; proposalId: string }>;
}

/**
 * POST /api/projects/[id]/proposals/[proposalId]/withdraw
 * Withdraws a proposal, marking it as WITHDRAWN.
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
      where: { id: proposalId, projectId },
      include: { project: true },
    });

    if (
      !proposal ||
      !isProjectOwnedByUser((proposal as any).project?.ownerId, user.id)
    ) {
      return NextResponse.json(
        { error: "Proposal not found." },
        { status: 404 }
      );
    }

    if (isProjectArchived((proposal as any).project?.status)) {
      return projectArchivedResponse("req_wdr", projectId, (proposal as any).project?.name);
    }

    if (proposal.status === "WITHDRAWN") {
      return NextResponse.json(
        { error: "Proposal is already withdrawn." },
        { status: 409 }
      );
    }

    if (proposal.status === "CLIENT_ACCEPTED") {
      return NextResponse.json(
        {
          error: `Cannot withdraw proposal: Change Proposal v${proposal.version} has already been accepted by the client. Formal credit/cancellation or a superseding amendment is required.`,
          status: proposal.status,
          acceptedAt: proposal.clientAcceptedAt,
        },
        { status: 409 }
      );
    }

    if (proposal.status === "SUPERSEDED") {
      return NextResponse.json(
        {
          error: `Cannot withdraw proposal: Proposal v${proposal.version} has already been superseded by a newer version.`,
          status: proposal.status,
        },
        { status: 409 }
      );
    }

    const withdrawalReason = body?.reason?.trim() || "Withdrawn by provider";

    const updated = await prisma.changeOrder.update({
      where: { id: proposalId },
      data: {
        status: "WITHDRAWN",
      },
    });

    // Record audit event
    await prisma.projectEvent.create({
      data: {
        projectId,
        actorType: "PROVIDER",
        eventType: "PROPOSAL_WITHDRAWN",
        description: `Provider withdrew Change Proposal v${proposal.version}: "${withdrawalReason}".`,
        metadata: {
          proposalId,
          version: proposal.version,
          reason: withdrawalReason,
        },
      },
    });

    return NextResponse.json({
      success: true,
      proposal: updated,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

