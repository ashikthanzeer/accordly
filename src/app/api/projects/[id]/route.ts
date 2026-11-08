import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  createCorrelationId,
  extractPrismaCode,
  logDiagnostic,
} from "@/lib/logger";
import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/auth/session";
import { isProjectOwnedByUser } from "@/lib/auth/ownership";
import { getProjectFinancialSummary } from "@/lib/projects/lifecycle";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/projects/[id]
 * Retrieves metadata for a single project owned by the authenticated provider.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const correlationId = createCorrelationId();
  const { id: projectId } = await params;

  const user = await getAuthenticatedUser(req);
  if (!user) {
    return unauthorizedResponse(correlationId);
  }

  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        invoices: true,
      },
    });

    if (!project || !isProjectOwnedByUser(project.ownerId, user.id)) {
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

    const financialSummary = getProjectFinancialSummary(project);

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
          archivedAt: (project as any).archivedAt ? (project as any).archivedAt.toISOString() : null,
          archivedBy: (project as any).archivedBy || null,
          createdAt: project.createdAt.toISOString(),
          updatedAt: project.updatedAt.toISOString(),
        },
        financialSummary,
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

/**
 * DELETE /api/projects/[id]
 * Universal Permanent Deletion Prohibition Safeguard.
 *
 * Permanently deleting projects is strictly prohibited in Accordly to preserve
 * binding commercial, baseline, change request, invoice, and payment audit trails.
 * Projects can only be archived via POST /api/projects/[id]/archive.
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const correlationId = createCorrelationId();
  const { id: projectId } = await params;

  logDiagnostic({
    level: "warn",
    operation: "project.delete",
    correlationId,
    projectId,
    stage: "request.reject",
    category: "validation",
    message: `Rejected permanent deletion attempt for project "${projectId}". Projects may only be archived.`,
    statusCode: 405,
  });

  return NextResponse.json(
    {
      error: "Permanent project deletion is prohibited. Accordly retains full commercial and payment history indefinitely. To remove this project from your active workspace, please archive it via POST /api/projects/[id]/archive.",
      code: "PERMANENT_DELETION_PROHIBITED",
      allowedAlternative: "ARCHIVE",
      archiveEndpoint: `/api/projects/${projectId}/archive`,
      projectId,
      correlationId,
    },
    {
      status: 405,
      headers: {
        Allow: "GET, POST",
      },
    }
  );
}
