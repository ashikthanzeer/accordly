import { NextRequest, NextResponse } from "next/server";
import { createAndSendProposalInvoice } from "@/lib/paypal";
import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/auth/session";
import { resolveOwnedProject, projectNotFoundResponse } from "@/lib/auth/ownership";

interface RouteParams {
  params: Promise<{ id: string; proposalId: string }>;
}

/**
 * POST /api/projects/[id]/proposals/[proposalId]/invoice/create-and-send
 * Idempotently creates a draft invoice and sends it via PayPal Sandbox for an owned project.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: projectId, proposalId } = await params;

    const user = await getAuthenticatedUser(req);
    if (!user) {
      return unauthorizedResponse();
    }

    const project = await resolveOwnedProject(projectId, user.id);
    if (!project) {
      return projectNotFoundResponse(projectId);
    }

    const body = await req.json().catch(() => ({}));

    const result = await createAndSendProposalInvoice(projectId, proposalId, {
      note: body?.note,
    });

    if (!result.success) {
      const isIntegrityError = Boolean(
        result.error?.toLowerCase().includes("integrity verification failed")
      );
      return NextResponse.json(
        {
          error: result.error || "Failed to create and send invoice.",
          integrityError: isIntegrityError,
        },
        { status: isIntegrityError ? 422 : 400 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        invoice: result.invoice,
        alreadyExisted: result.alreadyExisted || false,
      },
      { status: result.alreadyExisted ? 200 : 201 }
    );
  } catch (error: any) {
    console.error("Error creating and sending invoice:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error." },
      { status: 500 }
    );
  }
}
