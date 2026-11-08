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
 * POST /api/projects/[id]/archive
 * Transitions an ACTIVE project to ARCHIVED status, recording archival metadata
 * and emitting an immutable project timeline event.
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
      include: {
        invoices: true,
      },
    });

    if (!project || !isProjectOwnedByUser(project.ownerId, user.id)) {
      logDiagnostic({
        level: "warn",
        operation: "project.archive",
        correlationId,
        projectId,
        stage: "db.lookup",
        category: "not_found",
        message: `Cannot archive project: project "${projectId}" was not found.`,
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

    if (project.status === "ARCHIVED") {
      logDiagnostic({
        level: "warn",
        operation: "project.archive",
        correlationId,
        projectId,
        stage: "state.validate",
        category: "validation",
        message: `Project "${projectId}" is already archived.`,
        statusCode: 409,
      });

      return NextResponse.json(
        {
          error: `Project "${project.name}" is already archived.`,
          code: "ALREADY_ARCHIVED",
          correlationId,
        },
        { status: 409 }
      );
    }

    const archivedAt = new Date();
    const financialSummary = getProjectFinancialSummary(project);

    const updatedProject = await prisma.project.update({
      where: { id: projectId },
      data: {
        status: "ARCHIVED",
        archivedAt,
        archivedBy: user.id,
      },
    });

    await prisma.projectEvent.create({
      data: {
        projectId,
        actorType: "PROVIDER",
        actorId: user.id,
        eventType: "PROJECT_ARCHIVED",
        description: `Project "${project.name}" was archived by ${user.name || user.email || "provider"}. All commercial, scope, and payment records remain preserved.`,
        metadata: {
          archivedAt: archivedAt.toISOString(),
          archivedBy: user.id,
          hasPaymentActivity: financialSummary.hasPaymentActivity,
          totalInvoiced: financialSummary.totalInvoiced,
          totalCollected: financialSummary.totalCollected,
          totalOutstanding: financialSummary.totalOutstanding,
          currency: financialSummary.primaryCurrency,
        },
      },
    });

    logDiagnostic({
      level: "info",
      operation: "project.archive",
      correlationId,
      projectId,
      stage: "db.persist",
      category: "success",
      message: `Project "${project.name}" (${projectId}) successfully archived.`,
      statusCode: 200,
      metadata: {
        hasPaymentActivity: financialSummary.hasPaymentActivity,
      },
    });

    return NextResponse.json(
      {
        success: true,
        project: serializeProject(updatedProject),
        financialSummary,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const prismaCode = extractPrismaCode(err);
    logDiagnostic({
      level: "error",
      operation: "project.archive",
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
        error: "Failed to archive project.",
        correlationId,
      },
      { status: 500 }
    );
  }
}
