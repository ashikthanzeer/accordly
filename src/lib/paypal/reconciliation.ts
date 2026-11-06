/**
 * Authoritative PayPal Payment Reconciliation Engine.
 *
 * Reconciles local invoice records with the official PayPal Invoicing API v2 state.
 * Never trusts unverified payloads; protects against out-of-order status regressions.
 */

import { prisma } from "@/lib/db";
import { type PayPalConfig } from "./config";
import { getInvoice } from "./invoicing";
import {
  type AuthoritativeReconciliationResult,
  type NormalizedInvoiceStatus,
  PayPalApiError,
} from "./types";
import { extractWebhookInvoiceId } from "./webhooks";

/**
 * Status hierarchy ranks to prevent out-of-order downgrades.
 * Higher rank wins over lower rank.
 */
const STATUS_RANK: Record<string, number> = {
  UNKNOWN: 0,
  DRAFT: 1,
  SENT: 2,
  PARTIALLY_PAID: 3,
  CANCELLED: 4,
  REFUNDED: 4,
  PAID: 5,
};

/**
 * Reconciles an invoice against PayPal API using its PayPal Invoice ID.
 */
export async function reconcileInvoiceByPayPalId(
  paypalInvoiceId: string,
  customConfig?: PayPalConfig
): Promise<AuthoritativeReconciliationResult> {
  const cleanId = paypalInvoiceId.trim();

  const localInvoice = await prisma.payPalInvoice.findFirst({
    where: { paypalInvoiceId: cleanId },
  });

  if (!localInvoice) {
    return {
      success: false,
      unresolved: true,
      paypalInvoiceId: cleanId,
      reconciledStatus: "UNKNOWN",
      rawPayPalStatus: "UNKNOWN",
      amount: "0.00",
      currency: "USD",
      lastReconciledAt: new Date(),
      isStatusChanged: false,
      error: `No local invoice found matching PayPal invoice ID "${cleanId}".`,
    };
  }

  // Authoritative retrieval from PayPal API
  let summary;
  try {
    summary = await getInvoice(cleanId, customConfig);
  } catch (err: unknown) {
    const message =
      err instanceof PayPalApiError
        ? `PayPal API Error (${err.status}): ${err.message}`
        : err instanceof Error
        ? err.message
        : "Failed to retrieve authoritative invoice from PayPal.";

    return {
      success: false,
      invoiceId: localInvoice.id,
      paypalInvoiceId: cleanId,
      previousStatus: localInvoice.status,
      reconciledStatus: localInvoice.status as NormalizedInvoiceStatus,
      rawPayPalStatus: "FETCH_FAILED",
      amount: localInvoice.amount.toString(),
      currency: localInvoice.currency,
      lastReconciledAt: localInvoice.lastReconciledAt || new Date(),
      isStatusChanged: false,
      error: message,
    };
  }

  const currentStatus = localInvoice.status;
  const retrievedStatus = summary.normalizedStatus;

  // Protect against out-of-order status regressions
  const currentRank = STATUS_RANK[currentStatus] || 0;
  const retrievedRank = STATUS_RANK[retrievedStatus] || 0;

  let finalStatus: NormalizedInvoiceStatus = retrievedStatus;
  if (currentRank >= 4 && retrievedRank < currentRank) {
    // Keep terminal or advanced state (e.g. PAID or CANCELLED)
    finalStatus = currentStatus as NormalizedInvoiceStatus;
  }

  const isStatusChanged = currentStatus !== finalStatus;
  const isPaid = finalStatus === "PAID";
  const now = new Date();
  const paidAt = isPaid ? localInvoice.paidAt || now : localInvoice.paidAt;

  // Persist authoritative updates transactionally
  const updatedInvoice = await prisma.$transaction(async (tx) => {
    const updated = await tx.payPalInvoice.update({
      where: { id: localInvoice.id },
      data: {
        status: finalStatus,
        hostedInvoiceUrl: summary.recipientViewUrl || localInvoice.hostedInvoiceUrl,
        lastReconciledAt: now,
        paidAt,
      },
    });

    await tx.projectEvent.create({
      data: {
        projectId: localInvoice.projectId,
        actorType: "PAYPAL",
        eventType: isStatusChanged
          ? "PAYPAL_PAYMENT_RECONCILED"
          : "PAYPAL_INVOICE_SYNCHRONIZED",
        description: `PayPal invoice ${cleanId} reconciled. Status: ${finalStatus}. Total: ${summary.currency} ${summary.totalAmount}, Paid: ${summary.paidAmount || (isPaid ? summary.totalAmount : "0.00")}, Due: ${summary.dueAmount || "0.00"}.`,
        metadata: {
          invoiceId: localInvoice.id,
          proposalId: localInvoice.changeOrderId,
          paypalInvoiceId: cleanId,
          previousStatus: currentStatus,
          reconciledStatus: finalStatus,
          rawPayPalStatus: summary.rawStatus,
          totalAmount: summary.totalAmount,
          paidAmount: summary.paidAmount,
          dueAmount: summary.dueAmount,
          currency: summary.currency,
        },
      },
    });

    return updated;
  });

  return {
    success: true,
    invoiceId: updatedInvoice.id,
    paypalInvoiceId: cleanId,
    previousStatus: currentStatus,
    reconciledStatus: finalStatus,
    rawPayPalStatus: summary.rawStatus,
    amount: updatedInvoice.amount.toString(),
    paidAmount: summary.paidAmount,
    dueAmount: summary.dueAmount,
    currency: summary.currency,
    paidAt: updatedInvoice.paidAt,
    lastReconciledAt: now,
    isStatusChanged,
  };
}

/**
 * Reconciles an invoice triggered by an incoming verified webhook event.
 */
export async function reconcileInvoiceFromWebhook(
  event: any,
  webhookEventId?: string,
  customConfig?: PayPalConfig
): Promise<AuthoritativeReconciliationResult> {
  const paypalInvoiceId = extractWebhookInvoiceId(event);

  if (!paypalInvoiceId) {
    if (webhookEventId) {
      await prisma.webhookEvent.update({
        where: { id: webhookEventId },
        data: {
          processingStatus: "IGNORED",
          processedAt: new Date(),
        },
      }).catch(() => null);
    }

    return {
      success: false,
      unresolved: true,
      paypalInvoiceId: "UNKNOWN",
      reconciledStatus: "UNKNOWN",
      rawPayPalStatus: "UNKNOWN",
      amount: "0.00",
      currency: "USD",
      lastReconciledAt: new Date(),
      isStatusChanged: false,
      error: "No invoice ID found in webhook event resource.",
    };
  }

  const result = await reconcileInvoiceByPayPalId(paypalInvoiceId, customConfig);

  if (webhookEventId) {
    const processingStatus = result.success
      ? "PROCESSED"
      : result.unresolved
      ? "IGNORED"
      : "FAILED";

    await prisma.webhookEvent.update({
      where: { id: webhookEventId },
      data: {
        resourceId: paypalInvoiceId,
        processingStatus,
        processedAt: new Date(),
      },
    }).catch(() => null);
  }

  return result;
}

