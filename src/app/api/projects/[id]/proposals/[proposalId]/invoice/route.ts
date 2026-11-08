import { NextRequest, NextResponse } from "next/server";
import { getProposalInvoice, createAndSendProposalInvoice } from "@/lib/paypal";
import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/auth/session";
import { resolveOwnedProject, projectNotFoundResponse } from "@/lib/auth/ownership";
import { isProjectArchived, projectArchivedResponse } from "@/lib/projects/lifecycle";

interface RouteParams {
  params: Promise<{ id: string; proposalId: string }>;
}

/**
 * GET /api/projects/[id]/proposals/[proposalId]/invoice
 * Retrieves the stored invoice for the proposal if one exists in an owned project.
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

    const invoice = await getProposalInvoice(projectId, proposalId);

    if (!invoice) {
      return NextResponse.json(
        { invoice: null, message: "No active invoice found for this proposal." },
        { status: 200 }
      );
    }

    return NextResponse.json({ invoice });
  } catch (error: any) {
    console.error("Error fetching invoice:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/projects/[id]/proposals/[proposalId]/invoice
 * Endpoint alias for creating and sending an invoice for an owned project.
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

    if (isProjectArchived(project.status)) {
      return projectArchivedResponse("req_inv", projectId, project.name);
    }

    const body = await req.json().catch(() => ({}));

    const result = await createAndSendProposalInvoice(projectId, proposalId, {
      note: body?.note,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to create and send invoice." },
        { status: 400 }
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
