import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

interface RouteParams {
  params: Promise<{ id: string; proposalId: string }>;
}

/**
 * POST /api/projects/[id]/proposals/[proposalId]/revoke-link
 * Revokes an active client review link, clearing the token hash and reverting
 * the proposal to APPROVED if it was not already decided.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: projectId, proposalId } = await params;

    const proposal = await prisma.changeOrder.findFirst({
      where: { id: proposalId, projectId },
    });

    if (!proposal) {
      return NextResponse.json(
        { error: "Proposal not found." },
        { status: 404 }
      );
    }

    if (!proposal.reviewTokenHash) {
      return NextResponse.json(
        { error: "No active review link exists for this proposal." },
        { status: 400 }
      );
    }

    // Do not revoke if already accepted or rejected
    if (proposal.clientAcceptedAt || proposal.clientRejectedAt) {
      return NextResponse.json(
        {
          error: `Cannot revoke review link: the client has already recorded a decision (${proposal.status}).`,
        },
        { status: 400 }
      );
    }

    const updated = await prisma.changeOrder.update({
      where: { id: proposalId },
      data: {
        reviewTokenHash: null,
        reviewTokenExpiresAt: null,
        status: "APPROVED",
      },
    });

    // Record audit event
    await prisma.projectEvent.create({
      data: {
        projectId,
        actorType: "PROVIDER",
        eventType: "PROPOSAL_LINK_REVOKED",
        description: `Provider revoked active review link for Proposal v${proposal.version}.`,
        metadata: {
          proposalId,
          version: proposal.version,
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Client review link revoked successfully.",
      proposal: updated,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

