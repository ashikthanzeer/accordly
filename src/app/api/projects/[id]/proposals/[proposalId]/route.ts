import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  calculateProposalPricing,
  PricingCalculationError,
} from "@/lib/pricing/calculator";
import type { ProposalPricingInput } from "@/lib/pricing/schema";
import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/auth/session";
import { isProjectOwnedByUser } from "@/lib/auth/ownership";

interface RouteParams {
  params: Promise<{ id: string; proposalId: string }>;
}

/**
 * GET /api/projects/[id]/proposals/[proposalId]
 * Retrieves full details for a single change proposal owned by the authenticated provider.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: projectId, proposalId } = await params;

    const user = await getAuthenticatedUser(req);
    if (!user) {
      return unauthorizedResponse();
    }

    const proposal = await prisma.changeOrder.findFirst({
      where: { id: proposalId, projectId },
      include: {
        changeRequest: true,
        project: {
          select: {
            ownerId: true,
            name: true,
            currency: true,
            hourlyRate: true,
            clientName: true,
            clientEmail: true,
          },
        },
      },
    });

    if (
      !proposal ||
      !isProjectOwnedByUser((proposal as any).project?.ownerId, user.id)
    ) {
      return NextResponse.json(
        { error: "Proposal not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({ proposal });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/projects/[id]/proposals/[proposalId]
 * Updates proposal content and pricing.
 * Strictly enforced: Only proposals in DRAFT status can be modified.
 * Once approved, terminal, or withdrawn, proposals are immutable (HTTP 409 Conflict).
 * Subsequent modifications must branch into a new version via POST /.../versions.
 */
export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: projectId, proposalId } = await params;

    const user = await getAuthenticatedUser(req);
    if (!user) {
      return unauthorizedResponse();
    }

    const body = await req.json();

    const existingProposal = await prisma.changeOrder.findFirst({
      where: { id: proposalId, projectId },
      include: { project: true },
    });

    if (
      !existingProposal ||
      !isProjectOwnedByUser(existingProposal.project?.ownerId, user.id)
    ) {
      return NextResponse.json(
        { error: "Proposal not found." },
        { status: 404 }
      );
    }

    // Strict Immutability Guard: Only DRAFT proposals can be modified
    if (existingProposal.status !== "DRAFT") {
      return NextResponse.json(
        {
          error: `Proposal v${existingProposal.version} is locked in '${existingProposal.status}' status and cannot be modified. To make changes, create a new version.`,
          status: existingProposal.status,
          version: existingProposal.version,
        },
        { status: 409 }
      );
    }

    const projectCurrency = existingProposal.project.currency || "USD";
    const existingDeliverables =
      existingProposal.deliverables && typeof existingProposal.deliverables === "object"
        ? (existingProposal.deliverables as Record<string, unknown>)
        : {};

    // Merge incoming content
    const title = body?.title?.trim() || (existingDeliverables.title as string) || "Change Proposal";
    const description = body?.description?.trim() || existingProposal.description;
    const reasonForChange =
      body?.reasonForChange?.trim() || (existingDeliverables.reasonForChange as string) || "";
    const deliverables = body?.deliverables || existingDeliverables.deliverables || [];
    const assumptions = body?.assumptions || existingDeliverables.assumptions || [];
    const exclusions = body?.exclusions || existingDeliverables.exclusions || [];
    const dependencies = body?.dependencies || existingDeliverables.dependencies || [];
    const timelineImpact =
      body?.timelineImpact?.trim() || existingProposal.timelineImpact || "";

    // Recalculate pricing
    const pricingConfig: ProposalPricingInput =
      body?.pricingConfig ||
      (existingDeliverables.pricingConfig as ProposalPricingInput) || {
        model: "FIXED",
        currency: projectCurrency,
        fixedAmount: Number(existingProposal.amount),
        lineItems: [],
      };

    const calculatedPricing = calculateProposalPricing(
      pricingConfig,
      projectCurrency
    );

    const updatedDeliverablesPayload = {
      ...existingDeliverables,
      title,
      reasonForChange,
      deliverables,
      assumptions,
      exclusions,
      dependencies,
      timelineImpact,
      pricing: calculatedPricing,
      pricingConfig,
    };

    const updated = await prisma.changeOrder.update({
      where: { id: proposalId },
      data: {
        description,
        deliverables: updatedDeliverablesPayload as any,
        assumptions: Array.isArray(assumptions) ? assumptions.join("\n") : String(assumptions),
        timelineImpact,
        amount: calculatedPricing.total,
        currency: projectCurrency,
      },
    });

    return NextResponse.json({
      success: true,
      proposal: updated,
      isNewVersion: false,
    });
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

