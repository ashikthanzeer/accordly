import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/auth/session";
import { isProjectOwnedByUser } from "@/lib/auth/ownership";
import { isProjectArchived, projectArchivedResponse } from "@/lib/projects/lifecycle";
import { softDeleteProposal } from "@/lib/proposals/deletion";

interface RouteParams {
  params: Promise<{ id: string; proposalId: string }>;
}

/**
 * POST /api/projects/[id]/proposals/[proposalId]/delete
 * Safely soft-deletes an eligible uncommitted DRAFT proposal.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const correlationId = `req_del_${Date.now().toString(36)}`;

  try {
    const { id: projectId, proposalId } = await params;

    const user = await getAuthenticatedUser(req);
    if (!user) {
      return unauthorizedResponse();
    }

    const proposal = await prisma.changeOrder.findFirst({
      where: { id: proposalId, projectId },
      include: { project: true },
    });

    if (
      !proposal ||
      !isProjectOwnedByUser((proposal as any).project?.ownerId, user.id)
    ) {
      return NextResponse.json(
        { error: "Proposal not found.", correlationId },
        { status: 404 }
      );
    }

    if (isProjectArchived((proposal as any).project?.status)) {
      return projectArchivedResponse(
        correlationId,
        projectId,
        (proposal as any).project?.name
      );
    }

    const result = await softDeleteProposal(
      projectId,
      proposalId,
      user.id,
      correlationId
    );

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.error,
          code: result.code,
          correlationId,
        },
        { status: result.statusCode }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: `Change Proposal v${proposal.version} successfully deleted.`,
        proposal: result.proposal,
        correlationId,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error soft-deleting proposal:", error);
    return NextResponse.json(
      {
        error: error?.message || "Internal server error.",
        correlationId,
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/projects/[id]/proposals/[proposalId]/delete
 * Enforces method restrictions.
 */
export async function DELETE() {
  return NextResponse.json(
    {
      error:
        "Direct HTTP DELETE is not allowed on proposal resources. Use POST /api/projects/:id/proposals/:proposalId/delete for safe, audited soft-deletion.",
      code: "METHOD_NOT_ALLOWED",
      allowedMethods: ["POST"],
    },
    { status: 405 }
  );
}

