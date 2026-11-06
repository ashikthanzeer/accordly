/**
 * Proposal-to-Invoice Mapping & Eligibility Validator.
 *
 * Implements deterministic mapping of client-accepted change orders to
 * PayPal Invoicing REST API v2 draft payloads and preview summaries.
 */

import {
  CreateInvoiceInput,
  InvoiceEligibilityResult,
  MappedInvoiceLineItem,
  MappedInvoicePreview,
} from "./types";
import { formatDecimalAmount } from "./validation";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validates whether a proposal and project meet all conditions to generate an invoice.
 */
export function validateInvoiceEligibility(
  proposal: any,
  project: any
): InvoiceEligibilityResult {
  if (!proposal || !proposal.id) {
    return {
      eligible: false,
      reason: "Proposal record is required.",
    };
  }

  // 1. Must be in CLIENT_ACCEPTED status
  if (proposal.status !== "CLIENT_ACCEPTED") {
    return {
      eligible: false,
      reason: `Proposal status is "${proposal.status}". Only proposals in "CLIENT_ACCEPTED" status can be invoiced.`,
    };
  }

  // 2. Project must have a valid client email address
  const clientEmail = project?.clientEmail?.trim();
  if (!clientEmail || !EMAIL_REGEX.test(clientEmail)) {
    return {
      eligible: false,
      reason: "Project must have a valid client email address configured to send a PayPal invoice.",
    };
  }

  // 3. Proposal total amount must be positive
  const rawAmount = Number(proposal.amount);
  if (!Number.isFinite(rawAmount) || rawAmount <= 0) {
    return {
      eligible: false,
      reason: `Proposal total amount must be greater than zero. Received: "${proposal.amount}".`,
    };
  }

  // 4. Check for existing active (non-cancelled) invoice
  const existingInvoices = Array.isArray(proposal.invoices) ? proposal.invoices : [];
  const activeInvoice = existingInvoices.find(
    (inv: any) => inv && inv.status && inv.status.toUpperCase() !== "CANCELLED"
  );

  if (activeInvoice) {
    return {
      eligible: false,
      isAlreadyInvoiced: true,
      existingInvoice: {
        id: activeInvoice.id,
        paypalInvoiceId: activeInvoice.paypalInvoiceId,
        status: activeInvoice.status,
        amount: activeInvoice.amount?.toString?.() || String(activeInvoice.amount),
        currency: activeInvoice.currency || proposal.currency || "USD",
        hostedInvoiceUrl: activeInvoice.hostedInvoiceUrl || null,
        sentAt: activeInvoice.sentAt || null,
      },
      reason: `An active PayPal invoice (${activeInvoice.paypalInvoiceId}) already exists for this proposal.`,
    };
  }

  return {
    eligible: true,
  };
}

/**
 * Maps an accepted change proposal and its parent project into a PayPal draft invoice payload and preview.
 */
export function mapProposalToPayPalInvoice(
  proposal: any,
  project: any,
  options?: { note?: string; invoiceNumber?: string }
): { input: CreateInvoiceInput; preview: MappedInvoicePreview } {
  const eligibility = validateInvoiceEligibility(proposal, project);
  if (!eligibility.eligible && !eligibility.isAlreadyInvoiced) {
    throw new Error(eligibility.reason || "Proposal is not eligible for invoicing.");
  }

  const deliverablesJson =
    proposal.deliverables && typeof proposal.deliverables === "object"
      ? (proposal.deliverables as Record<string, any>)
      : {};

  const pricing = deliverablesJson.pricing || {};
  const currency = (proposal.currency || pricing.currency || "USD").trim().toUpperCase();
  const rawAmount = Number(proposal.amount) || Number(pricing.total) || 0;
  const formattedTotal = formatDecimalAmount(rawAmount, currency);

  const rawLineItems = Array.isArray(pricing.lineItems) ? pricing.lineItems : [];
  const mappedLineItems: MappedInvoiceLineItem[] = [];

  if (rawLineItems.length > 0) {
    for (const item of rawLineItems) {
      const qty =
        typeof item.quantity === "number"
          ? item.quantity
          : parseFloat(String(item.quantity)) || 1;
      const unitPrice =
        typeof item.unitPrice === "number"
          ? item.unitPrice
          : parseFloat(String(item.unitPrice)) || 0;
      const itemCurrency = (item.currency || currency).trim().toUpperCase();
      const unitAmount = formatDecimalAmount(unitPrice, itemCurrency);
      const subtotal =
        typeof item.subtotal === "number" ? item.subtotal : qty * unitPrice;
      const formattedSubtotal = formatDecimalAmount(subtotal, itemCurrency);

      mappedLineItems.push({
        id: item.id ? String(item.id) : undefined,
        name: (item.description || item.name || "Scope Deliverable").slice(0, 120),
        description: item.description || undefined,
        quantity: qty,
        unitPrice,
        unitAmount,
        subtotal,
        formattedSubtotal,
        currency: itemCurrency,
      });
    }
  } else {
    // Single deliverable fallback
    mappedLineItems.push({
      name: (proposal.description || "Approved Scope Change Order").slice(0, 120),
      description: proposal.description || undefined,
      quantity: 1,
      unitPrice: rawAmount,
      unitAmount: formattedTotal,
      subtotal: rawAmount,
      formattedSubtotal: formattedTotal,
      currency,
    });
  }

  const clientEmail = (project?.clientEmail || "").trim();
  const clientName = project?.clientName?.trim();
  const note =
    options?.note ||
    `Change Proposal #${proposal.version || 1} for ${
      project?.name || "Project"
    } - Client Accepted`;

  const input: CreateInvoiceInput = {
    recipientEmail: clientEmail,
    description: (
      proposal.description || `Invoice for change proposal v${proposal.version || 1}`
    ).slice(0, 250),
    currency,
    amount: formattedTotal,
    items: mappedLineItems.map((li) => ({
      name: li.name,
      description: li.description,
      quantity: li.quantity,
      unitAmount: li.unitAmount,
      currency: li.currency,
      unitOfMeasure: "QUANTITY",
    })),
    idempotencyKey: `accordly_inv_${proposal.id}_v${proposal.version || 1}`,
    invoiceNumber: options?.invoiceNumber,
    note,
  };

  const preview: MappedInvoicePreview = {
    proposalId: proposal.id,
    projectId: project?.id || proposal.projectId,
    recipientEmail: clientEmail,
    recipientName: clientName,
    proposalTitle: proposal.description
      ? proposal.description.slice(0, 100)
      : `Proposal v${proposal.version || 1}`,
    description: proposal.description || `Change Proposal v${proposal.version || 1}`,
    currency,
    totalAmount: formattedTotal,
    rawAmount,
    lineItems: mappedLineItems,
    itemCount: mappedLineItems.length,
    invoiceNumber: options?.invoiceNumber,
    note,
    isAlreadyInvoiced: eligibility.isAlreadyInvoiced || false,
    existingInvoice: eligibility.existingInvoice || null,
  };

  return { input, preview };
}

