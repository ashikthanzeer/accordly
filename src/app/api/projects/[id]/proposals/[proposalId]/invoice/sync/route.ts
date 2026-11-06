import { NextRequest, NextResponse } from "next/server";
import { syncProposalInvoiceStatus } from "@/lib/paypal";

interface RouteParams {
  params: Promise<{ id: string; proposalId: string }>;
}

/**
 * POST /api/projects/[id]/proposals/[proposalId]/invoice/sync
 * Manually synchronizes the invoice status directly from PayPal Invoicing API v2.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: projectId, proposalId } = await params;
    const result = await syncProposalInvoiceStatus(projectId, proposalId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to sync invoice status." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      invoice: result.invoice,
      rawStatus: result.rawStatus,
    });
  } catch (error: any) {
    console.error("Error syncing invoice status:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error." },
      { status: 500 }
    );
  }
}

