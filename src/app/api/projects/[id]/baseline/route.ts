import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/auth/session";
import { resolveOwnedProject, projectNotFoundResponse } from "@/lib/auth/ownership";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/projects/[id]/baseline
 * Returns the latest confirmed scope baseline and project status for an owned project.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: projectId } = await params;

    const user = await getAuthenticatedUser(req);
    if (!user) {
      return unauthorizedResponse();
    }

    const project = await resolveOwnedProject(projectId, user.id);
    if (!project) {
      return projectNotFoundResponse(projectId);
    }

    const latestBaseline = await prisma.scopeBaseline.findFirst({
      where: { projectId },
      orderBy: { version: "desc" },
      include: {
        document: {
          select: {
            id: true,
            fileName: true,
            createdAt: true,
          },
        },
      },
    });

    if (!latestBaseline) {
      return NextResponse.json({
        hasConfirmedBaseline: false,
        baseline: null,
      });
    }

    return NextResponse.json({
      hasConfirmedBaseline: true,
      baseline: latestBaseline,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
