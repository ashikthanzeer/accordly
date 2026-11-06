import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

interface RouteParams {
  params: Promise<{ id: string; requestId: string }>;
}

/**
 * GET /api/projects/[id]/change-requests/[requestId]
 * Retrieves a single change request with its full analysis details.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: projectId, requestId } = await params;

    const changeRequest = await prisma.changeRequest.findFirst({
      where: {
        id: requestId,
        projectId,
      },
    });

    if (!changeRequest) {
      return NextResponse.json(
        { error: "Change request not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({ changeRequest });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/projects/[id]/change-requests/[requestId]
 * Updates review sign-off and optional provider notes for a change request.
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: projectId, requestId } = await params;
    const body = await req.json();

    const changeRequest = await prisma.changeRequest.findFirst({
      where: {
        id: requestId,
        projectId,
      },
    });

    if (!changeRequest) {
      return NextResponse.json(
        { error: "Change request not found." },
        { status: 404 }
      );
    }

    const existingAnalysis =
      changeRequest.analysis && typeof changeRequest.analysis === "object"
        ? (changeRequest.analysis as Record<string, unknown>)
        : {};

    const reviewStatus = body?.reviewStatus || "REVIEWED";
    const reviewedAt = new Date().toISOString();
    const providerNotes =
      body?.providerNotes !== undefined
        ? String(body.providerNotes)
        : (existingAnalysis.providerNotes as string | undefined) || "";

    const updatedAnalysis = {
      ...existingAnalysis,
      reviewStatus,
      reviewedAt,
      providerNotes,
    };

    const updated = await prisma.changeRequest.update({
      where: { id: requestId },
      data: {
        analysis: updatedAnalysis,
      },
    });

    // Record audit event
    await prisma.projectEvent.create({
      data: {
        projectId,
        actorType: "PROVIDER",
        eventType: "CHANGE_REQUEST_REVIEWED",
        description: `Provider signed off on change request analysis (${changeRequest.classification}).`,
        metadata: {
          changeRequestId: requestId,
          classification: changeRequest.classification,
          reviewStatus,
          hasNotes: Boolean(providerNotes),
        },
      },
    });

    return NextResponse.json({
      success: true,
      changeRequest: updated,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

