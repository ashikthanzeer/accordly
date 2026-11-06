import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { extractScopeBaseline, ScopeExtractionError } from "@/lib/ai";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/projects/[id]/baseline/extract
 * Triggers AI scope extraction on an uploaded document and returns draft baseline data.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: projectId } = await params;

    let body: { documentId?: string; directText?: string } = {};
    try {
      body = await req.json();
    } catch {
      // Body may be empty if defaulting to latest document
    }

    let textToAnalyze = body.directText?.trim();
    let documentId = body.documentId?.trim();

    if (!textToAnalyze) {
      // Look up document in database
      const document = documentId
        ? await prisma.document.findUnique({
            where: { id: documentId },
          })
        : await prisma.document.findFirst({
            where: { projectId, extractionStatus: "READY" },
            orderBy: { createdAt: "desc" },
          });

      if (!document || !document.extractedText) {
        return NextResponse.json(
          {
            error:
              "No readable document found for this project. Please upload an agreement first.",
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

    return NextResponse.json({
      success: true,
      status: "DRAFT_REVIEW",
      documentId,
      baseline: result.baseline,
      metadata: {
        provider: result.provider,
        model: result.model,
        isMock: result.isMock,
      },
    });
  } catch (err: unknown) {
    if (err instanceof ScopeExtractionError) {
      return NextResponse.json(
        {
          error: err.message,
          validationErrors: err.validationErrors,
        },
        { status: 422 }
      );
    }

    return NextResponse.json(
      {
        error: `Scope extraction failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      },
      { status: 500 }
    );
  }
}

