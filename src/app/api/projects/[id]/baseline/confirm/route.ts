import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ScopeBaselineSchema } from "@/lib/ai/schema";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/projects/[id]/baseline/confirm
 * Confirms a reviewed and provider-edited scope baseline.
 * Enforces versioning, records confirmation timestamp, and logs timeline event.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: projectId } = await params;
    const body = await req.json();

    if (!body || !body.structuredScope) {
      return NextResponse.json(
        { error: "Missing structuredScope in confirmation payload." },
        { status: 400 }
      );
    }

    // Validate provider-edited baseline against schema
    const parseResult = ScopeBaselineSchema.safeParse(body.structuredScope);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Submitted baseline failed schema validation.",
          details: parseResult.error.format(),
        },
        { status: 422 }
      );
    }

    const validatedScope = parseResult.data;
    const confirmedBy = body.confirmedBy?.trim() || "Demo Provider";
    const documentId = body.documentId?.trim() || null;

    // Determine next version (never overwrite historical baselines)
    const latest = await prisma.scopeBaseline.findFirst({
      where: { projectId },
      orderBy: { version: "desc" },
    });

    const nextVersion = (latest?.version || 0) + 1;

    // Create immutable confirmed baseline record
    const confirmedBaseline = await prisma.scopeBaseline.create({
      data: {
        projectId,
        documentId,
        version: nextVersion,
        structuredScope: validatedScope as object,
        confirmedAt: new Date(),
        confirmedBy,
      },
    });

    // Log timeline event
    await prisma.projectEvent.create({
      data: {
        projectId,
        actorType: "PROVIDER",
        eventType: "BASELINE_CONFIRMED",
        description: `Provider confirmed Scope Baseline v${nextVersion} (${validatedScope.deliverables.length} deliverables, ${validatedScope.exclusions.length} exclusions).`,
        metadata: {
          baselineId: confirmedBaseline.id,
          version: nextVersion,
          confirmedBy,
          confirmedAt: confirmedBaseline.confirmedAt,
        },
      },
    });

    return NextResponse.json(
      {
        success: true,
        baseline: {
          id: confirmedBaseline.id,
          version: confirmedBaseline.version,
          confirmedAt: confirmedBaseline.confirmedAt,
          confirmedBy: confirmedBaseline.confirmedBy,
          structuredScope: confirmedBaseline.structuredScope,
        },
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    return NextResponse.json(
      {
        error: `Failed to confirm baseline: ${
          err instanceof Error ? err.message : String(err)
        }`,
      },
      { status: 500 }
    );
  }
}

