import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { reconcileInvoiceByPayPalId } from "@/lib/paypal/reconciliation";

interface RouteParams {
  params: Promise<{ id: string; proposalId: string }>;
}

/**
 * POST /api/projects/[id]/proposals/[proposalId]/invoice/reconcile
 * Authenticated provider endpoint to manually reconcile invoice state with PayPal.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: projectId, proposalId } = await params;

    const proposal = await prisma.changeOrder.findFirst({
      where: { id: proposalId, projectId },
      include: {
        invoices: {
          where: { status: { not: "CANCELLED" } },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    if (!proposal) {
      return NextResponse.json(
        { error: "Proposal not found or access denied." },
        { status: 404 }
      );
    }

    const invoice = proposal.invoices[0];
    if (!invoice) {
      return NextResponse.json(
        { error: "No active PayPal invoice found for this proposal." },
        { status: 404 }
      );
    }

    const reconciliation = await reconcileInvoiceByPayPalId(invoice.paypalInvoiceId);

    if (!reconciliation.success) {
      return NextResponse.json(
        { error: reconciliation.error || "Failed to reconcile invoice with PayPal." },
        { status: 400 }
      );
    }

    const refreshedInvoice = await prisma.payPalInvoice.findUnique({
      where: { id: invoice.id },
    });

    return NextResponse.json({
      success: true,
      invoice: {
        ...refreshedInvoice,
        amount: refreshedInvoice?.amount.toString(),
        paidAmount: reconciliation.paidAmount,
        dueAmount: reconciliation.dueAmount,
      },
      reconciliation,
    });
  } catch (error: any) {
    console.error("Error in manual proposal invoice reconciliation:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error." },
      { status: 500 }
    );
  }
}

