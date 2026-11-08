import { NextRequest, NextResponse } from "next/server";
import { getProposalInvoicePreview } from "@/lib/paypal";
import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/auth/session";
import { resolveOwnedProject, projectNotFoundResponse } from "@/lib/auth/ownership";

interface RouteParams {
  params: Promise<{ id: string; proposalId: string }>;
}

/**
 * GET /api/projects/[id]/proposals/[proposalId]/invoice/preview
 * Returns mapped commercial invoice preview data without calling PayPal.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
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

    const result = await getProposalInvoicePreview(projectId, proposalId);

    if (!result.eligible && !result.isAlreadyInvoiced) {
      const isIntegrityError = Boolean(
        result.reason?.toLowerCase().includes("integrity verification failed")
      );
      return NextResponse.json(
        {
          error: result.reason || "Proposal not eligible for invoicing.",
          integrityError: isIntegrityError,
        },
        { status: isIntegrityError ? 422 : 400 }
      );
    }

    return NextResponse.json({
      eligible: result.eligible,
      isAlreadyInvoiced: result.isAlreadyInvoiced || false,
      existingInvoice: result.existingInvoice || null,
      preview: result.preview,
    });
  } catch (error: any) {
    console.error("Error generating invoice preview:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error." },
      { status: 500 }
    );
  }
}
