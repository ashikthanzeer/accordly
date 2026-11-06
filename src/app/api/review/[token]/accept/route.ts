import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashReviewToken, isTokenExpired } from "@/lib/proposals/tokens";
import { serializePublicProposal } from "@/lib/proposals/serializer";

interface RouteParams {
  params: Promise<{ token: string }>;
}

/**
 * POST /api/review/[token]/accept
 * Client explicitly accepts the change proposal.
 * Enforces token validity, unexpired status, and duplicate decision prevention.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { token } = await params;
    const body = await req.json().catch(() => ({}));

    if (!token || !token.trim()) {
      return NextResponse.json(
        { error: "Review token is required." },
        { status: 400 }
      );
    }

    const tokenHash = hashReviewToken(token.trim());

    const proposal = await prisma.changeOrder.findFirst({
      where: { reviewTokenHash: tokenHash },
      include: { project: true },
    });

    if (!proposal) {
      return NextResponse.json(
        { error: "Proposal review link not found or inactive." },
        { status: 404 }
      );
    }

    // Check expiration
    if (isTokenExpired(proposal.reviewTokenExpiresAt)) {
      return NextResponse.json(
        { error: "Cannot accept: this review link has expired." },
        { status: 410 }
      );
    }

    // Prevent duplicate decisions (Replay protection)
    if (proposal.clientAcceptedAt || proposal.clientRejectedAt) {
      return NextResponse.json(
        {
          error: `A final decision has already been recorded for this proposal (${proposal.status}). Subsequent modifications are prohibited.`,
          status: proposal.status,
          decidedAt: proposal.clientAcceptedAt || proposal.clientRejectedAt,
        },
        { status: 409 }
      );
    }

    const acceptedAt = new Date();
    const deliverablesJson =
      proposal.deliverables && typeof proposal.deliverables === "object"
        ? (proposal.deliverables as Record<string, unknown>)
        : {};

    const clientDecision = {
      decision: "ACCEPTED",
      acceptedAt: acceptedAt.toISOString(),
      clientName: body?.clientName || proposal.project.clientName,
      clientEmail: body?.clientEmail || proposal.project.clientEmail,
      ipAddress: req.headers.get("x-forwarded-for") || "unknown",
      userAgent: req.headers.get("user-agent") || "unknown",
    };

    const updated = await prisma.changeOrder.update({
      where: { id: proposal.id },
      data: {
        status: "CLIENT_ACCEPTED",
        clientAcceptedAt: acceptedAt,
        deliverables: {
          ...deliverablesJson,
          clientDecision,
        } as any,
      },
    });

    // Record audit event
    await prisma.projectEvent.create({
      data: {
        projectId: proposal.projectId,
        actorType: "CLIENT",
        eventType: "PROPOSAL_ACCEPTED_BY_CLIENT",
        description: `Client (${clientDecision.clientName}) explicitly accepted Change Proposal v${proposal.version} for ${proposal.amount} ${proposal.currency}.`,
        metadata: {
          proposalId: proposal.id,
          version: proposal.version,
          amount: Number(proposal.amount),
          currency: proposal.currency,
          acceptedAt: acceptedAt.toISOString(),
        },
      },
    });

    const publicSnapshot = serializePublicProposal(updated, proposal.project);

    return NextResponse.json({
      success: true,
      message: "Proposal has been explicitly accepted.",
      proposal: publicSnapshot,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

