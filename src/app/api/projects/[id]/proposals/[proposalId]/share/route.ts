import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateSecureReviewToken } from "@/lib/proposals/tokens";
import { getPublicReviewUrl } from "@/lib/config/urls";
import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/auth/session";
import { isProjectOwnedByUser } from "@/lib/auth/ownership";
import { isProjectArchived, projectArchivedResponse } from "@/lib/projects/lifecycle";

interface RouteParams {
  params: Promise<{ id: string; proposalId: string }>;
}

/**
 * POST /api/projects/[id]/proposals/[proposalId]/share
 * Generates an unguessable client review token, hashes it, sets expiration,
 * transitions proposal status to SENT_TO_CLIENT, and returns the shareable URL.
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
      include: {
        project: {
          select: { ownerId: true, name: true, clientName: true, clientEmail: true, status: true },
        },
      },
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
      return projectArchivedResponse("req_share", projectId, (proposal as any).project?.name);
    }

    // Only APPROVED or already SENT proposals can generate a review link
    if (
      proposal.status !== "APPROVED" &&
      proposal.status !== "PROVIDER_APPROVED" &&
      proposal.status !== "SENT_TO_CLIENT"
    ) {
      return NextResponse.json(
        {
          error: `Cannot generate review link: proposal status is '${proposal.status}'. Only provider-approved proposals can be shared with clients.`,
        },
        { status: 400 }
      );
    }

    const daysValid = Number(body?.daysValid) > 0 ? Number(body.daysValid) : 14;
    const { token, tokenHash, expiresAt } = generateSecureReviewToken(daysValid);

    // Update ChangeOrder record with token hash and expiration
    const updated = await prisma.changeOrder.update({
      where: { id: proposalId },
      data: {
        reviewTokenHash: tokenHash,
        reviewTokenExpiresAt: expiresAt,
        status: "SENT_TO_CLIENT",
      },
    });

    // Record audit event
    await prisma.projectEvent.create({
      data: {
        projectId,
        actorType: "PROVIDER",
        eventType: "PROPOSAL_SHARED_WITH_CLIENT",
        description: `Provider generated client review link for Proposal v${proposal.version} (expires ${expiresAt.toLocaleDateString()}).`,
        metadata: {
          proposalId,
          version: proposal.version,
          clientEmail: proposal.project.clientEmail,
          expiresAt: expiresAt.toISOString(),
          daysValid,
        },
      },
    });

    // Form shareable URL pointing to public frontend (NEXT_PUBLIC_APP_URL)
    const { reviewPath, reviewUrl } = getPublicReviewUrl(token, req.nextUrl?.origin);

    return NextResponse.json({
      success: true,
      token,
      reviewPath,
      reviewUrl,
      expiresAt: expiresAt.toISOString(),
      proposal: updated,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

