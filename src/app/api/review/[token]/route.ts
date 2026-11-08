import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashReviewToken, isTokenExpired } from "@/lib/proposals/tokens";
import { serializePublicProposal } from "@/lib/proposals/serializer";
import { verifySnapshotIntegrity } from "@/lib/proposals/snapshot";

interface RouteParams {
  params: Promise<{ token: string }>;
}

/**
 * GET /api/review/[token]
 * Public endpoint allowing clients to retrieve an approved proposal snapshot
 * using their secure review token.
 * Enforces snapshot integrity verification and blocks superseded or withdrawn proposals.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { token } = await params;

    if (!token || !token.trim()) {
      return NextResponse.json(
        { error: "Review token is required." },
        { status: 400 }
      );
    }

    const tokenHash = hashReviewToken(token.trim());

    const proposal = await prisma.changeOrder.findFirst({
      where: { reviewTokenHash: tokenHash },
      include: {
        project: {
          select: {
            name: true,
            clientName: true,
            clientEmail: true,
            currency: true,
          },
        },
      },
    });

    if (!proposal) {
      return NextResponse.json(
        { error: "Proposal review link not found, inactive, or revoked." },
        { status: 404 }
      );
    }

    // Check expiration
    if (isTokenExpired(proposal.reviewTokenExpiresAt)) {
      return NextResponse.json(
        {
          error: "This proposal review link has expired. Please contact the service provider to request an updated link.",
          isExpired: true,
          expiredAt: proposal.reviewTokenExpiresAt,
        },
        { status: 410 }
      );
    }

    // Reject superseded proposals
    if (proposal.status === "SUPERSEDED") {
      return NextResponse.json(
        {
          error: `This proposal (v${proposal.version}) has been superseded by a newer version. Please contact the service provider to request an updated review link.`,
          status: "SUPERSEDED",
          version: proposal.version,
        },
        { status: 409 }
      );
    }

    // Reject withdrawn proposals
    if (proposal.status === "WITHDRAWN") {
      return NextResponse.json(
        {
          error: `This proposal (v${proposal.version}) has been withdrawn by the service provider.`,
          status: "WITHDRAWN",
          version: proposal.version,
        },
        { status: 409 }
      );
    }

    // Verify cryptographic snapshot integrity
    const integrity = verifySnapshotIntegrity(proposal);
    if (!integrity.isValid) {
      return NextResponse.json(
        {
          error: `Proposal snapshot integrity verification failed: ${integrity.error}`,
          integrityError: true,
        },
        { status: 409 }
      );
    }

    const publicSnapshot = serializePublicProposal(proposal, proposal.project);

    return NextResponse.json({
      success: true,
      proposal: publicSnapshot,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
