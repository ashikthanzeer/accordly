import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  createCorrelationId,
  extractPrismaCode,
  logDiagnostic,
} from "@/lib/logger";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/projects/[id]
 * Retrieves metadata for a single project to display in workspace headers and forms.
 */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const correlationId = createCorrelationId();
  const { id: projectId } = await params;

  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      logDiagnostic({
        level: "warn",
        operation: "project.get",
        correlationId,
        projectId,
        stage: "db.lookup",
        category: "not_found",
        message: `Project "${projectId}" was not found.`,
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

    return NextResponse.json(
      {
        project: {
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
          createdAt: project.createdAt.toISOString(),
          updatedAt: project.updatedAt.toISOString(),
        },
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const prismaCode = extractPrismaCode(err);
    logDiagnostic({
      level: "error",
      operation: "project.get",
      correlationId,
      projectId,
      stage: "db.lookup",
      category: prismaCode ? "database" : "unexpected",
      message: err instanceof Error ? err.message : String(err),
      statusCode: 500,
      error: err,
    });

    return NextResponse.json(
      {
        error: "Failed to load project details.",
        correlationId,
      },
      { status: 500 }
    );
  }
}

