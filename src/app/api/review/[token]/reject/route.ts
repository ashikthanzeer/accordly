import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashReviewToken, isTokenExpired } from "@/lib/proposals/tokens";
import { serializePublicProposal } from "@/lib/proposals/serializer";

interface RouteParams {
  params: Promise<{ token: string }>;
}

/**
 * POST /api/review/[token]/reject
 * Client explicitly rejects the change proposal with optional feedback.
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
        { error: "Cannot reject: this review link has expired." },
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

    const rejectedAt = new Date();
    const rejectionReason = body?.reason?.trim() || "No feedback provided";
    const deliverablesJson =
      proposal.deliverables && typeof proposal.deliverables === "object"
        ? (proposal.deliverables as Record<string, unknown>)
        : {};

    const clientDecision = {
      decision: "REJECTED",
      rejectedAt: rejectedAt.toISOString(),
      rejectionReason,
      clientName: body?.clientName || proposal.project.clientName,
      clientEmail: body?.clientEmail || proposal.project.clientEmail,
      ipAddress: req.headers.get("x-forwarded-for") || "unknown",
      userAgent: req.headers.get("user-agent") || "unknown",
    };

    const updated = await prisma.changeOrder.update({
      where: { id: proposal.id },
      data: {
        status: "CLIENT_REJECTED",
        clientRejectedAt: rejectedAt,
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
        eventType: "PROPOSAL_REJECTED_BY_CLIENT",
        description: `Client rejected Change Proposal v${proposal.version} (Reason: "${rejectionReason}").`,
        metadata: {
          proposalId: proposal.id,
          version: proposal.version,
          reason: rejectionReason,
          rejectedAt: rejectedAt.toISOString(),
        },
      },
    });

    const publicSnapshot = serializePublicProposal(updated, proposal.project);

    return NextResponse.json({
      success: true,
      message: "Proposal rejection recorded.",
      proposal: publicSnapshot,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

