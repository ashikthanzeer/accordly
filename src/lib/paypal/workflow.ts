/**
 * PayPal Invoicing Workflow Service.
 *
 * Coordinates proposal validation, draft creation, sending, persistence,
 * and on-demand synchronization with PayPal Invoicing REST API v2.
 */

import { prisma } from "@/lib/db";
import { type PayPalConfig } from "./config";
import { createDraftInvoice, getInvoice, sendInvoice } from "./invoicing";
import { mapProposalToPayPalInvoice, validateInvoiceEligibility } from "./mapper";
import { PayPalApiError } from "./types";

export interface ProposalInvoicePreviewResult {
  eligible: boolean;
  reason?: string;
  isAlreadyInvoiced?: boolean;
  existingInvoice?: any;
  preview?: any;
}

export interface ProposalInvoiceOperationResult {
  success: boolean;
  invoice?: any;
  alreadyExisted?: boolean;
  error?: string;
  rawStatus?: string;
}

/**
 * Generates an invoice preview for a change proposal without calling PayPal.
 */
export async function getProposalInvoicePreview(
  projectId: string,
  proposalId: string
): Promise<ProposalInvoicePreviewResult> {
  const proposal = await prisma.changeOrder.findFirst({
    where: { id: proposalId, projectId },
    include: {
      invoices: true,
      project: {
        select: {
          id: true,
          name: true,
          clientName: true,
          clientEmail: true,
        },
      },
    },
  });

  if (!proposal) {
    return {
      eligible: false,
      reason: "Proposal not found.",
    };
  }

  const eligibility = validateInvoiceEligibility(proposal, proposal.project);
  if (!eligibility.eligible && !eligibility.isAlreadyInvoiced) {
    return {
      eligible: false,
      reason: eligibility.reason,
    };
  }

  const { preview } = mapProposalToPayPalInvoice(proposal, proposal.project);

  return {
    eligible: eligibility.eligible,
    reason: eligibility.reason,
    isAlreadyInvoiced: eligibility.isAlreadyInvoiced,
    existingInvoice: eligibility.existingInvoice,
    preview,
  };
}

/**
 * Creates and sends a PayPal invoice for a client-accepted proposal.
 * Enforces idempotency to avoid duplicate active invoices.
 */
export async function createAndSendProposalInvoice(
  projectId: string,
  proposalId: string,
  options?: { note?: string; customConfig?: PayPalConfig }
): Promise<ProposalInvoiceOperationResult> {
  const proposal = await prisma.changeOrder.findFirst({
    where: { id: proposalId, projectId },
    include: {
      invoices: true,
      project: {
        select: {
          id: true,
          name: true,
          clientName: true,
          clientEmail: true,
        },
      },
    },
  });

  if (!proposal) {
    return {
      success: false,
      error: "Proposal not found.",
    };
  }

  const eligibility = validateInvoiceEligibility(proposal, proposal.project);
  if (eligibility.isAlreadyInvoiced && eligibility.existingInvoice) {
    return {
      success: true,
      alreadyExisted: true,
      invoice: eligibility.existingInvoice,
    };
  }

  if (!eligibility.eligible) {
    return {
      success: false,
      error: eligibility.reason || "Proposal is not eligible for invoicing.",
    };
  }

  const { input, preview } = mapProposalToPayPalInvoice(
    proposal,
    proposal.project,
    options
  );

  // 1. Create draft invoice in PayPal Sandbox
  let draftResult;
  try {
    draftResult = await createDraftInvoice(input, options?.customConfig);
  } catch (err: unknown) {
    const message =
      err instanceof PayPalApiError
        ? `PayPal API Error (${err.status}): ${err.message}`
        : err instanceof Error
        ? err.message
        : "Failed to create draft invoice on PayPal.";
    return { success: false, error: message };
  }

  const paypalInvoiceId = draftResult.id;
  if (!paypalInvoiceId) {
    return {
      success: false,
      error: "PayPal did not return an invoice ID.",
    };
  }

  // 2. Send invoice via PayPal
  let sendResult;
  try {
    sendResult = await sendInvoice(
      paypalInvoiceId,
      { sendToRecipient: true },
      options?.customConfig
    );
  } catch (err: unknown) {
    // If send fails, persist DRAFT in DB so it can be investigated or retried
    await prisma.payPalInvoice.create({
      data: {
        projectId,
        changeOrderId: proposalId,
        paypalInvoiceId,
        status: "DRAFT",
        currency: input.currency,
        amount: Number(input.amount),
        lastReconciledAt: new Date(),
      },
    }).catch(() => null);

    const message =
      err instanceof PayPalApiError
        ? `PayPal Send Error (${err.status}): ${err.message}`
        : err instanceof Error
        ? err.message
        : "Failed to send invoice via PayPal.";
    return { success: false, error: message };
  }

  const hostedInvoiceUrl =
    sendResult.recipientViewUrl ||
    draftResult.recipientViewUrl ||
    `https://www.sandbox.paypal.com/invoice/p/#${paypalInvoiceId}`;

  // 3. Persist PayPalInvoice record and audit ProjectEvent
  const invoiceRecord = await prisma.$transaction(async (tx) => {
    const created = await tx.payPalInvoice.create({
      data: {
        projectId,
        changeOrderId: proposalId,
        paypalInvoiceId,
        status: "SENT",
        currency: input.currency,
        amount: Number(input.amount),
        hostedInvoiceUrl,
        sentAt: new Date(),
        lastReconciledAt: new Date(),
      },
    });

    await tx.projectEvent.create({
      data: {
        projectId,
        actorType: "PROVIDER",
        eventType: "PAYPAL_INVOICE_SENT",
        description: `PayPal invoice ${paypalInvoiceId} (${input.currency} ${input.amount}) created and sent to client ${input.recipientEmail}.`,
        metadata: {
          proposalId,
          version: proposal.version,
          paypalInvoiceId,
          amount: input.amount,
          currency: input.currency,
          recipientEmail: input.recipientEmail,
          hostedInvoiceUrl,
        },
      },
    });

    return created;
  });

  return {
    success: true,
    invoice: {
      ...invoiceRecord,
      amount: invoiceRecord.amount.toString(),
    },
  };
}

/**
 * Retrieves the stored invoice for a proposal if one exists.
 */
export async function getProposalInvoice(
  projectId: string,
  proposalId: string
) {
  const invoice = await prisma.payPalInvoice.findFirst({
    where: {
      projectId,
      changeOrderId: proposalId,
      status: { not: "CANCELLED" },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!invoice) return null;

  return {
    ...invoice,
    amount: invoice.amount.toString(),
  };
}

/**
 * Synchronizes invoice status on-demand directly from PayPal Invoicing API v2.
 */
export async function syncProposalInvoiceStatus(
  projectId: string,
  proposalId: string,
  customConfig?: PayPalConfig
): Promise<ProposalInvoiceOperationResult> {
  const invoice = await prisma.payPalInvoice.findFirst({
    where: {
      projectId,
      changeOrderId: proposalId,
    },
    orderBy: { createdAt: "desc" },
  });

  if (!invoice) {
    return {
      success: false,
      error: "No PayPal invoice found for this proposal.",
    };
  }

  let summary;
  try {
    summary = await getInvoice(invoice.paypalInvoiceId, customConfig);
  } catch (err: unknown) {
    const message =
      err instanceof PayPalApiError
        ? `PayPal API Error (${err.status}): ${err.message}`
        : err instanceof Error
        ? err.message
        : "Failed to retrieve invoice status from PayPal.";
    return { success: false, error: message };
  }

  const prevStatus = invoice.status;
  const newStatus = summary.normalizedStatus;
  const isPaid = newStatus === "PAID";
  const now = new Date();

  const updatedInvoice = await prisma.$transaction(async (tx) => {
    const updated = await tx.payPalInvoice.update({
      where: { id: invoice.id },
      data: {
        status: newStatus,
        hostedInvoiceUrl: summary.recipientViewUrl || invoice.hostedInvoiceUrl,
        lastReconciledAt: now,
        paidAt: isPaid ? invoice.paidAt || now : invoice.paidAt,
      },
    });

    if (prevStatus !== newStatus) {
      await tx.projectEvent.create({
        data: {
          projectId,
          actorType: "PAYPAL",
          eventType: "PAYPAL_INVOICE_STATUS_UPDATED",
          description: `PayPal invoice ${invoice.paypalInvoiceId} status updated from ${prevStatus} to ${newStatus}.`,
          metadata: {
            proposalId,
            paypalInvoiceId: invoice.paypalInvoiceId,
            prevStatus,
            newStatus,
            rawStatus: summary.rawStatus,
          },
        },
      });
    }

    return updated;
  });

  return {
    success: true,
    invoice: {
      ...updatedInvoice,
      amount: updatedInvoice.amount.toString(),
    },
    rawStatus: summary.rawStatus,
  };
}
