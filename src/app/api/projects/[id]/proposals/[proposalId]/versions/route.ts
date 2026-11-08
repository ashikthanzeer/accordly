import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  calculateProposalPricing,
  PricingCalculationError,
} from "@/lib/pricing/calculator";
import type { ProposalPricingInput } from "@/lib/pricing/schema";
import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/auth/session";
import { isProjectOwnedByUser } from "@/lib/auth/ownership";
import { isProjectArchived, projectArchivedResponse } from "@/lib/projects/lifecycle";

interface RouteParams {
  params: Promise<{ id: string; proposalId: string }>;
}

/**
 * POST /api/projects/[id]/proposals/[proposalId]/versions
 * Branches an approved, sent, or client-decided proposal into a new sequential DRAFT version (vN+1).
 * Preserves the historical predecessor proposal intact with explicit predecessor linkage.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: projectId, proposalId } = await params;

    const user = await getAuthenticatedUser(req);
    if (!user) {
      return unauthorizedResponse();
    }

    const sourceProposal = await prisma.changeOrder.findFirst({
      where: { id: proposalId, projectId },
      include: { project: true },
    });

    if (
      !sourceProposal ||
      !isProjectOwnedByUser(sourceProposal.project?.ownerId, user.id)
    ) {
      return NextResponse.json(
        { error: "Source proposal not found." },
        { status: 404 }
      );
    }

    if (isProjectArchived((sourceProposal as any).project?.status)) {
      return projectArchivedResponse("req_vers", projectId, (sourceProposal as any).project?.name);
    }

    // Only non-draft proposals can be branched into a new version
    if (sourceProposal.status === "DRAFT") {
      return NextResponse.json(
        {
          error: `Proposal v${sourceProposal.version} is already in DRAFT status. Edit the current draft directly rather than creating a new version.`,
        },
        { status: 400 }
      );
    }

    if (sourceProposal.status === "WITHDRAWN") {
      return NextResponse.json(
        { error: "Cannot branch a new version from a withdrawn proposal." },
        { status: 400 }
      );
    }

    const projectCurrency = sourceProposal.project.currency || "USD";
    const sourceDeliverables =
      sourceProposal.deliverables && typeof sourceProposal.deliverables === "object"
        ? (sourceProposal.deliverables as Record<string, unknown>)
        : {};
    const lockedSnapshot =
      sourceDeliverables.approvedSnapshot &&
      typeof sourceDeliverables.approvedSnapshot === "object"
        ? (sourceDeliverables.approvedSnapshot as Record<string, any>)
        : null;

    // 1. Determine next sequential version number across the project
    const latestOrder = await prisma.changeOrder.findFirst({
      where: { projectId },
      orderBy: { version: "desc" },
    });
    const newVersion = (latestOrder?.version || 0) + 1;

    // 2. Clone commercial terms from the locked snapshot (if present) or deliverables and strip approval/decision signatures
    const pricingConfig: ProposalPricingInput =
      (sourceDeliverables.pricingConfig as ProposalPricingInput) || {
        model: (lockedSnapshot?.pricingModel as any) || "FIXED",
        currency: projectCurrency,
        fixedAmount: Number(lockedSnapshot?.amount ?? sourceProposal.amount),
        lineItems: Array.isArray(lockedSnapshot?.pricing?.lineItems)
          ? lockedSnapshot.pricing.lineItems
          : [],
      };

    const calculatedPricing = calculateProposalPricing(
      pricingConfig,
      projectCurrency
    );

    const sourceDelivList = Array.isArray(lockedSnapshot?.deliverables)
      ? lockedSnapshot.deliverables
      : Array.isArray(sourceDeliverables.deliverables)
      ? sourceDeliverables.deliverables
      : [];

    const sourceAssumptionsList = Array.isArray(lockedSnapshot?.assumptions)
      ? lockedSnapshot.assumptions
      : Array.isArray(sourceDeliverables.assumptions)
      ? sourceDeliverables.assumptions
      : sourceProposal.assumptions
      ? sourceProposal.assumptions.split("\n")
      : [];

    const clonedDeliverables = {
      title: lockedSnapshot?.title || sourceDeliverables.title || "Change Proposal",
      reasonForChange:
        lockedSnapshot?.reasonForChange || sourceDeliverables.reasonForChange || "",
      deliverables: JSON.parse(JSON.stringify(sourceDelivList)),
      assumptions: [...sourceAssumptionsList],
      exclusions: Array.isArray(lockedSnapshot?.exclusions)
        ? [...lockedSnapshot.exclusions]
        : Array.isArray(sourceDeliverables.exclusions)
        ? [...sourceDeliverables.exclusions]
        : [],
      dependencies: Array.isArray(lockedSnapshot?.dependencies)
        ? [...lockedSnapshot.dependencies]
        : Array.isArray(sourceDeliverables.dependencies)
        ? [...sourceDeliverables.dependencies]
        : [],
      timelineImpact:
        lockedSnapshot?.timelineImpact ||
        sourceProposal.timelineImpact ||
        sourceDeliverables.timelineImpact ||
        "",
      commercialJustification:
        lockedSnapshot?.commercialJustification ||
        sourceDeliverables.commercialJustification ||
        null,
      originatingClassification: sourceDeliverables.originatingClassification || null,
      disclaimer: sourceDeliverables.disclaimer || undefined,
      pricing: calculatedPricing,
      pricingConfig,
      // Predecessor Linkage
      predecessorProposalId: sourceProposal.id,
      predecessorVersion: sourceProposal.version,
      supersededProposalId: sourceProposal.id,
      supersededVersion: sourceProposal.version,
    };

    // 3. Persist new DRAFT ChangeOrder
    const newProposal = await prisma.changeOrder.create({
      data: {
        projectId,
        changeRequestId: sourceProposal.changeRequestId,
        version: newVersion,
        status: "DRAFT",
        description: sourceProposal.description,
        deliverables: clonedDeliverables as any,
        assumptions: Array.isArray(clonedDeliverables.assumptions)
          ? clonedDeliverables.assumptions.join("\n")
          : String(sourceProposal.assumptions || ""),
        timelineImpact: sourceProposal.timelineImpact,
        amount: calculatedPricing.total,
        currency: projectCurrency,
      },
    });

    // 4. Record audit event
    await prisma.projectEvent.create({
      data: {
        projectId,
        actorType: "PROVIDER",
        eventType: "PROPOSAL_VERSION_CREATED",
        description: `Created Change Proposal v${newVersion} branched from v${sourceProposal.version} (${calculatedPricing.formattedTotal}).`,
        metadata: {
          newProposalId: newProposal.id,
          sourceProposalId: sourceProposal.id,
          newVersion,
          sourceVersion: sourceProposal.version,
          sourceStatus: sourceProposal.status,
          amount: calculatedPricing.total,
          currency: projectCurrency,
        },
      },
    });

    return NextResponse.json(
      {
        success: true,
        proposal: newProposal,
        predecessor: {
          id: sourceProposal.id,
          version: sourceProposal.version,
          status: sourceProposal.status,
        },
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

