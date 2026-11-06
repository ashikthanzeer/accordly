import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  calculateProposalPricing,
  PricingCalculationError,
} from "@/lib/pricing/calculator";
import type { ProposalPricingInput } from "@/lib/pricing/schema";

interface RouteParams {
  params: Promise<{ id: string; proposalId: string }>;
}

/**
 * GET /api/projects/[id]/proposals/[proposalId]
 * Retrieves full details for a single change proposal.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: projectId, proposalId } = await params;

    const proposal = await prisma.changeOrder.findFirst({
      where: { id: proposalId, projectId },
      include: {
        changeRequest: true,
        project: {
          select: {
            name: true,
            currency: true,
            hourlyRate: true,
            clientName: true,
            clientEmail: true,
          },
        },
      },
    });

    if (!proposal) {
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
 * If proposal is already APPROVED, automatically creates a new version (vN+1)
 * with status DRAFT and marks the existing version as SUPERSEDED.
 */
export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: projectId, proposalId } = await params;
    const body = await req.json();

    const existingProposal = await prisma.changeOrder.findFirst({
      where: { id: proposalId, projectId },
      include: { project: true },
    });

    if (!existingProposal) {
      return NextResponse.json(
        { error: "Proposal not found." },
        { status: 404 }
      );
    }

    if (existingProposal.status === "WITHDRAWN") {
      return NextResponse.json(
        { error: "Cannot edit a withdrawn proposal." },
        { status: 400 }
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

    // Case 1: Proposal is currently DRAFT -> update in-place
    if (existingProposal.status === "DRAFT") {
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
    }

    // Case 2: Proposal is APPROVED -> Immutability enforced! Create version N+1
    if (
      existingProposal.status === "APPROVED" ||
      existingProposal.status === "PROVIDER_APPROVED"
    ) {
      // 1. Mark existing proposal as SUPERSEDED
      await prisma.changeOrder.update({
        where: { id: proposalId },
        data: { status: "SUPERSEDED" },
      });

      // 2. Find next version number
      const latestOrder = await prisma.changeOrder.findFirst({
        where: { projectId },
        orderBy: { version: "desc" },
      });
      const newVersion = (latestOrder?.version || 0) + 1;

      // 3. Create new ChangeOrder record
      const newProposal = await prisma.changeOrder.create({
        data: {
          projectId,
          changeRequestId: existingProposal.changeRequestId,
          version: newVersion,
          status: "DRAFT",
          description,
          deliverables: {
            ...updatedDeliverablesPayload,
            supersededProposalId: proposalId,
            supersededVersion: existingProposal.version,
          } as any,
          assumptions: Array.isArray(assumptions) ? assumptions.join("\n") : String(assumptions),
          timelineImpact,
          amount: calculatedPricing.total,
          currency: projectCurrency,
        },
      });

      // 4. Log audit event
      await prisma.projectEvent.create({
        data: {
          projectId,
          actorType: "PROVIDER",
          eventType: "PROPOSAL_VERSION_CREATED",
          description: `Created Change Proposal v${newVersion} (superseding approved v${existingProposal.version}).`,
          metadata: {
            newProposalId: newProposal.id,
            previousProposalId: proposalId,
            newVersion,
            previousVersion: existingProposal.version,
            amount: calculatedPricing.total,
          },
        },
      });

      return NextResponse.json(
        {
          success: true,
          proposal: newProposal,
          isNewVersion: true,
          supersededProposalId: proposalId,
        },
        { status: 201 }
      );
    }

    return NextResponse.json(
      { error: `Cannot update proposal with status ${existingProposal.status}.` },
      { status: 400 }
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

