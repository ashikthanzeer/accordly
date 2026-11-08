import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  createCorrelationId,
  extractPrismaCode,
  logDiagnostic,
} from "@/lib/logger";
import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/auth/session";
import { isProjectOwnedByUser } from "@/lib/auth/ownership";
import type { ProjectSummaryDto } from "@/lib/projects/schema";

interface RouteParams {
  params: Promise<{ id: string }>;
}

function serializeProject(project: any): ProjectSummaryDto {
  return {
    id: project.id,
    ownerId: project.ownerId,
    name: project.name,
    clientName: project.clientName,
    clientEmail: project.clientEmail,
    currency: project.currency,
    pricingModel: project.pricingModel,
    hourlyRate:
      project.hourlyRate !== null && project.hourlyRate !== undefined
        ? Number(project.hourlyRate)
        : null,
    status: project.status,
    archivedAt: project.archivedAt ? new Date(project.archivedAt).toISOString() : null,
    archivedBy: project.archivedBy || null,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
}

/**
 * POST /api/projects/[id]/restore
 * Restores an ARCHIVED project back to ACTIVE status in the provider's active workspace.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const correlationId = createCorrelationId();
  const { id: projectId } = await params;

  const user = await getAuthenticatedUser(req);
  if (!user) {
    return unauthorizedResponse(correlationId);
  }

  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project || !isProjectOwnedByUser(project.ownerId, user.id)) {
      logDiagnostic({
        level: "warn",
        operation: "project.restore",
        correlationId,
        projectId,
        stage: "db.lookup",
        category: "not_found",
        message: `Cannot restore project: project "${projectId}" was not found.`,
        statusCode: 404,
      });

      return NextResponse.json(
        {
          error: `Project "${projectId}" not found.`,
          correlationId,
        },
        { status: 404 }
      );
    }

    if (project.status === "ACTIVE") {
      logDiagnostic({
        level: "warn",
        operation: "project.restore",
        correlationId,
        projectId,
        stage: "state.validate",
        category: "validation",
        message: `Project "${projectId}" is already active.`,
        statusCode: 409,
      });

      return NextResponse.json(
        {
          error: `Project "${project.name}" is already active.`,
          code: "ALREADY_ACTIVE",
          correlationId,
        },
        { status: 409 }
      );
    }

    const previousArchivedAt = (project as any).archivedAt;
    const previousArchivedBy = (project as any).archivedBy;

    const updatedProject = await prisma.project.update({
      where: { id: projectId },
      data: {
        status: "ACTIVE",
        archivedAt: null,
        archivedBy: null,
      },
    });

    await prisma.projectEvent.create({
      data: {
        projectId,
        actorType: "PROVIDER",
        actorId: user.id,
        eventType: "PROJECT_RESTORED",
        description: `Project "${project.name}" was restored to active workspace by ${user.name || user.email || "provider"}.`,
        metadata: {
          restoredAt: new Date().toISOString(),
          restoredBy: user.id,
          previousArchivedAt: previousArchivedAt ? new Date(previousArchivedAt).toISOString() : null,
          previousArchivedBy,
        },
      },
    });

    logDiagnostic({
      level: "info",
      operation: "project.restore",
      correlationId,
      projectId,
      stage: "db.persist",
      category: "success",
      message: `Project "${project.name}" (${projectId}) successfully restored to active workspace.`,
      statusCode: 200,
    });

    return NextResponse.json(
      {
        success: true,
        project: serializeProject(updatedProject),
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const prismaCode = extractPrismaCode(err);
    logDiagnostic({
      level: "error",
      operation: "project.restore",
      correlationId,
      projectId,
      stage: "db.persist",
      category: prismaCode ? "database" : "unexpected",
      message: err instanceof Error ? err.message : String(err),
      statusCode: 500,
      error: err,
    });

    return NextResponse.json(
      {
        error: "Failed to restore project.",
        correlationId,
      },
      { status: 500 }
    );
  }
}
