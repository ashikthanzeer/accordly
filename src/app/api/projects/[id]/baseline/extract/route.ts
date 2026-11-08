import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  extractScopeBaseline,
  ScopeExtractionError,
  AiProviderError,
} from "@/lib/ai";
import {
  createCorrelationId,
  extractPrismaCode,
  logDiagnostic,
} from "@/lib/logger";
import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/auth/session";
import { resolveOwnedProject, projectNotFoundResponse } from "@/lib/auth/ownership";
import { isProjectArchived, projectArchivedResponse } from "@/lib/projects/lifecycle";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/projects/[id]/baseline/extract
 * Triggers AI scope extraction on an uploaded document and returns draft baseline data.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const correlationId = createCorrelationId();
  const { id: projectId } = await params;

  const user = await getAuthenticatedUser(req);
  if (!user) {
    return unauthorizedResponse(correlationId);
  }

  try {
    const project = await resolveOwnedProject(projectId, user.id);
    if (!project) {
      return projectNotFoundResponse(projectId, correlationId);
    }

    if (isProjectArchived(project.status)) {
      return projectArchivedResponse(correlationId, projectId, project.name);
    }

    let body: { documentId?: string; directText?: string } = {};
    try {
      body = await req.json();
    } catch {
      // Body may be empty if defaulting to latest document
    }

    let textToAnalyze = body.directText?.trim();
    let documentId = body.documentId?.trim();

    if (!textToAnalyze) {
      // Look up document in database scoped strictly to projectId
      const document = documentId
        ? await prisma.document.findFirst({
            where: { id: documentId, projectId },
          })
        : await prisma.document.findFirst({
            where: { projectId, extractionStatus: "READY" },
            orderBy: { createdAt: "desc" },
          });

      if (!document || !document.extractedText) {
        logDiagnostic({
          level: "warn",
          operation: "baseline.extract",
          correlationId,
          projectId,
          stage: "document.lookup",
          category: "not_found",
          message: "No readable document found for scope extraction.",
          statusCode: 404,
          metadata: { documentId: documentId || null },
        });

        return NextResponse.json(
          {
            error:
              "No readable document found for this project. Please upload an agreement first.",
            correlationId,
          },
          { status: 404 }
        );
      }

      textToAnalyze = document.extractedText;
      documentId = document.id;
    }

    // Call the AI extraction pipeline with runtime Zod validation
    const result = await extractScopeBaseline(textToAnalyze);

    // Record timeline event
    await prisma.projectEvent.create({
      data: {
        projectId,
        actorType: "SYSTEM",
        eventType: "SCOPE_EXTRACTED",
        description: `AI extracted draft scope baseline (${result.baseline.deliverables.length} deliverables, ${result.baseline.exclusions.length} exclusions).`,
        metadata: {
          documentId,
          provider: result.provider,
          model: result.model,
          isMock: result.isMock,
        },
      },
    });

    logDiagnostic({
      level: "info",
      operation: "baseline.extract",
      correlationId,
      projectId,
      stage: "complete",
      category: "success",
      message: `Extracted draft scope baseline (${result.baseline.deliverables.length} deliverables).`,
      statusCode: 200,
      metadata: {
        documentId: documentId || null,
        provider: result.provider,
        model: result.model,
        isMock: result.isMock,
      },
    });

    return NextResponse.json({
      success: true,
      status: "DRAFT_REVIEW",
      documentId,
      baseline: result.baseline,
      extractedText: textToAnalyze,
      metadata: {
        provider: result.provider,
        model: result.model,
        isMock: result.isMock,
      },
    });
  } catch (err: unknown) {
    if (err instanceof ScopeExtractionError) {
      logDiagnostic({
        level: "warn",
        operation: "baseline.extract",
        correlationId,
        projectId,
        stage: "ai.validate",
        category: "extraction",
        message: err.message,
        statusCode: 422,
        error: err,
      });

      return NextResponse.json(
        {
          error: err.message,
          validationErrors: err.validationErrors,
          correlationId,
        },
        { status: 422 }
      );
    }

    if (err instanceof AiProviderError) {
      const status =
        err.statusCode === 503 ||
        err.statusCode === 429 ||
        err.message.includes("Missing")
          ? 503
          : 502;

      logDiagnostic({
        level: "error",
        operation: "baseline.extract",
        correlationId,
        projectId,
        stage: "ai.provider",
        category: "ai_provider",
        message: err.message,
        statusCode: status,
        error: err,
      });

      return NextResponse.json(
        {
          error: `AI provider error during scope extraction: ${err.message}`,
          correlationId,
        },
        { status }
      );
    }

    const prismaCode = extractPrismaCode(err);
    logDiagnostic({
      level: "error",
      operation: "baseline.extract",
      correlationId,
      projectId,
      stage: prismaCode ? "db.persist" : "unexpected",
      category: prismaCode ? "database" : "unexpected",
      message: err instanceof Error ? err.message : String(err),
      statusCode: 500,
      error: err,
    });

    return NextResponse.json(
      {
        error: `Scope extraction failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
        correlationId,
      },
      { status: 500 }
    );
  }
}
