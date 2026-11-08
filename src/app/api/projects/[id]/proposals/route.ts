import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateProposalEligibility } from "@/lib/proposals/eligibility";
import { draftProposalContent } from "@/lib/ai/proposal-drafter";
import {
  calculateProposalPricing,
  PricingCalculationError,
} from "@/lib/pricing/calculator";
import type { ProposalPricingInput } from "@/lib/pricing/schema";
import type { ChangeRequestAnalysisResult } from "@/lib/ai/classifier-schema";
import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/auth/session";
import { resolveOwnedProject, projectNotFoundResponse } from "@/lib/auth/ownership";
import { isProjectArchived, projectArchivedResponse } from "@/lib/projects/lifecycle";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/projects/[id]/proposals
 * Returns all change proposals / orders for an owned project.
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

    const proposals = await prisma.changeOrder.findMany({
      where: { projectId },
      orderBy: { version: "desc" },
      include: {
        changeRequest: {
          select: {
            id: true,
            sourceText: true,
            classification: true,
          },
        },
      },
    });

    return NextResponse.json({ proposals });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

/**
 * POST /api/projects/[id]/proposals
 * Creates a new change proposal draft from an eligible change request.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: projectId } = await params;

    const user = await getAuthenticatedUser(req);
    if (!user) {
      return unauthorizedResponse();
    }

    const body = await req.json();

    const changeRequestId = body?.changeRequestId?.trim();
    if (!changeRequestId) {
      return NextResponse.json(
        { error: "changeRequestId is required." },
        { status: 400 }
      );
    }

    // 1. Verify project and ownership
    const project = await resolveOwnedProject(projectId, user.id);
    if (!project) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    if (isProjectArchived(project.status)) {
      return projectArchivedResponse("req_prop", projectId, project.name);
    }

    // 2. Verify change request
    const changeRequest = await prisma.changeRequest.findFirst({
      where: { id: changeRequestId, projectId },
    });
    if (!changeRequest) {
      return NextResponse.json(
        { error: "Change request not found for this project." },
        { status: 404 }
      );
    }

    // 3. Verify confirmed scope baseline
    const confirmedBaseline = await prisma.scopeBaseline.findFirst({
      where: { projectId, confirmedAt: { not: null } },
      orderBy: { version: "desc" },
    });

    const analysis = changeRequest.analysis as unknown as ChangeRequestAnalysisResult;
    const providerJustification = body?.providerJustification?.trim();
    const allowInScopeOverride = Boolean(body?.allowInScopeOverride);

    // 4. Validate proposal eligibility
    const eligibility = validateProposalEligibility({
      classification: changeRequest.classification as any,
      hasConfirmedBaseline: Boolean(confirmedBaseline),
      hasCompletedAnalysis: Boolean(analysis && analysis.classification),
      providerJustification,
      allowInScopeOverride,
    });

    if (!eligibility.canProceed) {
      return NextResponse.json(
        {
          error: eligibility.error || eligibility.warning,
          eligibility,
        },
        { status: 400 }
      );
    }

    // Persist provider override / commercial justification on the change request's analysis
    // while strictly preserving the original AI classification and evidence.
    if (allowInScopeOverride || (providerJustification && providerJustification.length > 0)) {
      const existingAnalysisObj =
        changeRequest.analysis && typeof changeRequest.analysis === "object"
          ? (changeRequest.analysis as Record<string, unknown>)
          : {};
      await prisma.changeRequest.update({
        where: { id: changeRequestId },
        data: {
          analysis: {
            ...existingAnalysisObj,
            reviewStatus: "REVIEWED",
            reviewedAt: (existingAnalysisObj.reviewedAt as string) || new Date().toISOString(),
            providerOverride: {
              overriddenAt: new Date().toISOString(),
              justification: providerJustification || "Provider override enabled for proposal generation.",
              allowInScopeOverride,
            },
          } as any,
        },
      });
    }

    // 5. Generate AI draft proposal content
    const draftContent = await draftProposalContent({
      clientRequest: changeRequest.sourceText,
      analysis,
      providerJustification,
    });

    // 6. Calculate deterministic pricing
    const projectCurrency = project.currency || "USD";
    const hourlyRateNumber = project.hourlyRate ? Number(project.hourlyRate) : 100;

    let pricingConfig: ProposalPricingInput;
    if (body?.pricing) {
      pricingConfig = body.pricing;
    } else {
      // Default to hourly pricing using suggested effort hours and project hourly rate, or fixed fallback
      const totalSuggestedHours = draftContent.deliverables.reduce(
        (sum, d) => sum + (d.suggestedEffortHours || 4),
        0
      );
      pricingConfig = {
        model: "HOURLY",
        currency: projectCurrency,
        hourlyRate: hourlyRateNumber,
        estimatedHours: totalSuggestedHours || 4,
        lineItems: [],
      };
    }

    const calculatedPricing = calculateProposalPricing(
      pricingConfig,
      projectCurrency
    );

    // 7. Determine next sequential version for this project
    const latestOrder = await prisma.changeOrder.findFirst({
      where: { projectId },
      orderBy: { version: "desc" },
    });
    const version = (latestOrder?.version || 0) + 1;

    // 8. Package structured deliverables JSON
    const deliverablesPayload = {
      title: draftContent.title,
      reasonForChange: draftContent.reasonForChange,
      deliverables: draftContent.deliverables,
      assumptions: draftContent.assumptions,
      exclusions: draftContent.exclusions,
      dependencies: draftContent.dependencies,
      timelineImpact: draftContent.timelineImpact,
      pricing: calculatedPricing,
      pricingConfig,
      commercialJustification: providerJustification || null,
      originatingClassification: changeRequest.classification,
      disclaimer: draftContent.disclaimer,
    };

    // 9. Persist ChangeOrder
    const changeOrder = await prisma.changeOrder.create({
      data: {
        projectId,
        changeRequestId,
        version,
        status: "DRAFT",
        description: draftContent.description,
        deliverables: deliverablesPayload as any,
        assumptions: draftContent.assumptions.join("\n"),
        timelineImpact: draftContent.timelineImpact,
        amount: calculatedPricing.total,
        currency: projectCurrency,
      },
    });

    // 10. Log audit event
    await prisma.projectEvent.create({
      data: {
        projectId,
        actorType: "PROVIDER",
        eventType: "PROPOSAL_CREATED",
        description: `Created Change Proposal v${version} for "${draftContent.title}" (${calculatedPricing.formattedTotal}).`,
        metadata: {
          proposalId: changeOrder.id,
          changeRequestId,
          version,
          amount: calculatedPricing.total,
          currency: projectCurrency,
          model: calculatedPricing.model,
        },
      },
    });

    return NextResponse.json(
      {
        success: true,
        proposal: changeOrder,
        eligibility,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    if (err instanceof PricingCalculationError) {
      return NextResponse.json(
        { error: err.message, details: err.details },
        { status: 422 }
      );
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

