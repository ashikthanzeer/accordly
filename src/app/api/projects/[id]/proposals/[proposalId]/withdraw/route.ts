import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

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
    const body = await req.json().catch(() => ({}));

    const proposal = await prisma.changeOrder.findFirst({
      where: { id: proposalId, projectId },
    });

    if (!proposal) {
      return NextResponse.json(
        { error: "Proposal not found." },
        { status: 404 }
      );
    }

    if (proposal.status === "WITHDRAWN") {
      return NextResponse.json(
        { error: "Proposal is already withdrawn." },
        { status: 400 }
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

