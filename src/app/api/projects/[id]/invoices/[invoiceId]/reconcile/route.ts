import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { reconcileInvoiceByPayPalId } from "@/lib/paypal/reconciliation";
import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/auth/session";
import { isProjectOwnedByUser } from "@/lib/auth/ownership";

interface RouteParams {
  params: Promise<{ id: string; invoiceId: string }>;
}

/**
 * POST /api/projects/[id]/invoices/[invoiceId]/reconcile
 * Authenticated provider endpoint to manually reconcile invoice state with PayPal by invoiceId.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: projectId, invoiceId } = await params;

    const user = await getAuthenticatedUser(req);
    if (!user) {
      return unauthorizedResponse();
    }

    const invoice = await prisma.payPalInvoice.findFirst({
      where: {
        id: invoiceId,
        projectId,
      },
      include: {
        project: true,
      },
    });

    if (
      !invoice ||
      !isProjectOwnedByUser((invoice as any).project?.ownerId, user.id)
    ) {
      return NextResponse.json(
        { error: "Invoice not found or does not belong to the specified project." },
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
    console.error("Error in manual invoice reconciliation:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error." },
      { status: 500 }
    );
  }
}
