import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

interface RouteParams {
  params: Promise<{ id: string; proposalId: string }>;
}

/**
 * POST /api/projects/[id]/proposals/[proposalId]/approve
 * Provider approves the change proposal, transitioning it to APPROVED and locking pricing.
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

    if (proposal.status !== "DRAFT") {
      return NextResponse.json(
        { error: `Cannot approve proposal with status ${proposal.status}. Only DRAFT proposals can be approved.` },
        { status: 400 }
      );
    }

    const deliverablesObj =
      proposal.deliverables && typeof proposal.deliverables === "object"
        ? (proposal.deliverables as Record<string, unknown>)
        : {};

    const approvedAt = new Date();
    const approvedBy = body?.approverName || "Project Provider";

    const approvedSnapshot = {
      approvedAt: approvedAt.toISOString(),
      approvedBy,
      amount: Number(proposal.amount),
      currency: proposal.currency,
      description: proposal.description,
      deliverables: deliverablesObj.deliverables || [],
      pricing: deliverablesObj.pricing || null,
    };

    const updated = await prisma.changeOrder.update({
      where: { id: proposalId },
      data: {
        status: "APPROVED",
        providerApprovedAt: approvedAt,
        deliverables: {
          ...deliverablesObj,
          approvedSnapshot,
        } as any,
      },
    });

    // Record audit event
    await prisma.projectEvent.create({
      data: {
        projectId,
        actorType: "PROVIDER",
        eventType: "PROPOSAL_APPROVED",
        description: `Provider explicitly approved Change Proposal v${proposal.version} for ${proposal.amount} ${proposal.currency}.`,
        metadata: {
          proposalId,
          version: proposal.version,
          amount: Number(proposal.amount),
          currency: proposal.currency,
          approvedBy,
          approvedAt: approvedAt.toISOString(),
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

