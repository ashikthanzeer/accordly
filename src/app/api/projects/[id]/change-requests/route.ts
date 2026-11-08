import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { classifyChangeRequest, ClassificationError } from "@/lib/ai/classifier";
import type { StructuredScopeBaseline } from "@/lib/ai/schema";
import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/auth/session";
import { resolveOwnedProject, projectNotFoundResponse } from "@/lib/auth/ownership";
import { isProjectArchived, projectArchivedResponse } from "@/lib/projects/lifecycle";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/projects/[id]/change-requests
 * Analyzes a new client request against the project's confirmed scope baseline.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
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

    if (isProjectArchived(project.status)) {
      return projectArchivedResponse("req_cr", projectId, project.name);
    }

    const body = await req.json();

    const requestText = body?.requestText?.trim();
    if (!requestText || requestText.length < 5) {
      return NextResponse.json(
        { error: "Client request text is required (minimum 5 characters)." },
        { status: 400 }
      );
    }

    if (requestText.length > 10000) {
      return NextResponse.json(
        { error: "Client request text exceeds maximum length of 10,000 characters." },
        { status: 400 }
      );
    }

    // Baseline Eligibility Check: Must have an explicitly confirmed baseline
    const confirmedBaseline = await prisma.scopeBaseline.findFirst({
      where: {
        projectId,
        confirmedAt: { not: null },
      },
      orderBy: { version: "desc" },
      include: { document: true },
    });

    if (!confirmedBaseline) {
      return NextResponse.json(
        {
          error:
            "Cannot analyze change request: An agreement scope baseline must be confirmed before requests can be analyzed. Please upload and confirm your agreement baseline first.",
        },
        { status: 400 }
      );
    }

    const structuredScope = confirmedBaseline.structuredScope as unknown as StructuredScopeBaseline;
    const agreementText = confirmedBaseline.document?.extractedText || "";

    // Run AI scope classification
    const analysis = await classifyChangeRequest({
      clientRequest: requestText,
      baseline: structuredScope,
      baselineVersion: confirmedBaseline.version,
      agreementText,
    });

    // Persist ChangeRequest record
    const changeRequest = await prisma.changeRequest.create({
      data: {
        projectId,
        sourceText: requestText,
        classification: analysis.classification,
        analysis: analysis as object,
        analysisModel: analysis.analysisModel || "scope-intelligence-v1",
        promptVersion: analysis.promptVersion || "v1.0",
      },
    });

    // Record audit event
    await prisma.projectEvent.create({
      data: {
        projectId,
        actorType: "SYSTEM",
        eventType: "CHANGE_REQUEST_ANALYZED",
        description: `Classified client request as ${analysis.classification} against baseline v${confirmedBaseline.version} (${analysis.confidence} confidence).`,
        metadata: {
          changeRequestId: changeRequest.id,
          classification: analysis.classification,
          confidence: analysis.confidence,
          baselineVersion: confirmedBaseline.version,
          supportingEvidenceCount: analysis.supportingEvidence.length,
        },
      },
    });

    return NextResponse.json(
      {
        success: true,
        changeRequest: {
          id: changeRequest.id,
          sourceText: changeRequest.sourceText,
          classification: changeRequest.classification,
          analysis: changeRequest.analysis,
          baselineVersion: confirmedBaseline.version,
          createdAt: changeRequest.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    if (err instanceof ClassificationError) {
      return NextResponse.json(
        {
          error: err.message,
          details: err.details,
        },
        { status: 422 }
      );
    }

    return NextResponse.json(
      {
        error: `Failed to analyze change request: ${
          err instanceof Error ? err.message : String(err)
        }`,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/projects/[id]/change-requests
 * Retrieves list of past change requests and their analyses for a project.
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

    if (isProjectArchived(project.status)) {
      return projectArchivedResponse("req_cr", projectId, project.name);
    }

    const changeRequests = await prisma.changeRequest.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ changeRequests });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

