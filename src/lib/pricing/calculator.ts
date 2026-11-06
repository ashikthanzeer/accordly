/**
 * Deterministic Decimal-Safe Pricing Calculator.
 *
 * Prevents JavaScript floating-point rounding errors by performing calculations
 * using scaled integer cents. Enforces currency consistency and non-negative values.
 */

import {
  type ProposalPricingInput,
  type CalculatedPricingSummary,
  type PricingLineItem,
  ProposalPricingInputSchema,
} from "./schema";

export class PricingCalculationError extends Error {
  constructor(message: string, public details?: unknown) {
    super(`[PricingCalculationError] ${message}`);
    this.name = "PricingCalculationError";
  }
}

/**
 * Converts a floating-point dollar amount into integer cents safely.
 * e.g., 150.25 -> 15025
 */
export function toCents(amount: number): number {
  if (typeof amount !== "number" || isNaN(amount)) {
    throw new PricingCalculationError("Amount must be a valid number.");
  }
  return Math.round(amount * 100);
}

/**
 * Converts integer cents back to standard major units (dollars) rounded to 2 decimal places.
 * e.g., 15025 -> 150.25
 */
export function fromCents(cents: number): number {
  if (typeof cents !== "number" || isNaN(cents)) {
    throw new PricingCalculationError("Cents must be a valid number.");
  }
  return Number((cents / 100).toFixed(2));
}

/**
 * Multiplies quantity/hours by unit price using integer cent scaling.
 * Avoids 0.1 + 0.2 = 0.30000000000000004 errors.
 */
export function calculateLineItemSubtotal(quantity: number, unitPrice: number): number {
  if (quantity < 0 || unitPrice < 0) {
    throw new PricingCalculationError("Quantity and unit price must be non-negative.");
  }
  const unitCents = toCents(unitPrice);
  const totalCents = Math.round(quantity * unitCents);
  return fromCents(totalCents);
}

/**
 * Formats amount with currency code for human display.
 */
export function formatCurrency(amount: number, currency: string = "USD"): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(amount);
  } catch {
    return `${currency.toUpperCase()} ${amount.toFixed(2)}`;
  }
}

/**
 * Computes deterministic proposal totals based on the configured pricing model.
 */
export function calculateProposalPricing(
  input: ProposalPricingInput,
  projectCurrency?: string
): CalculatedPricingSummary {
  // Validate input schema
  const parsed = ProposalPricingInputSchema.safeParse(input);
  if (!parsed.success) {
    const errorDetails = parsed.error.issues
      ? parsed.error.issues.map((e) => e.message).join("; ")
      : parsed.error.message;
    throw new PricingCalculationError(
      `Invalid pricing configuration: ${errorDetails}`,
      parsed.error.format()
    );
  }

  const data = parsed.data;

  // Strict currency validation against project currency if provided
  if (projectCurrency && data.currency !== projectCurrency.toUpperCase()) {
    throw new PricingCalculationError(
      `Proposal currency (${data.currency}) does not match project currency (${projectCurrency.toUpperCase()}).`
    );
  }

  let totalCents = 0;
  let lineItems: PricingLineItem[] = [];

  if (data.model === "FIXED") {
    const fixed = data.fixedAmount || 0;
    totalCents = toCents(fixed);
    lineItems = [
      {
        id: "LI-FIXED-1",
        description: "Fixed-Price Scope Deliverable",
        quantity: 1,
        unitPrice: fromCents(totalCents),
        currency: data.currency,
        subtotal: fromCents(totalCents),
      },
    ];
  } else if (data.model === "HOURLY") {
    const rate = data.hourlyRate || 0;
    const hours = data.estimatedHours || 0;
    const subtotal = calculateLineItemSubtotal(hours, rate);
    totalCents = toCents(subtotal);
    lineItems = [
      {
        id: "LI-HOURLY-1",
        description: `Hourly Rate Scope (${hours} hrs @ ${formatCurrency(rate, data.currency)}/hr)`,
        quantity: hours,
        unitPrice: rate,
        currency: data.currency,
        subtotal,
      },
    ];
  } else if (data.model === "ITEMIZED") {
    lineItems = data.lineItems.map((item, idx) => {
      // Re-verify line item currency
      if (item.currency !== data.currency) {
        throw new PricingCalculationError(
          `Line item ${idx + 1} currency (${item.currency}) does not match proposal currency (${data.currency}).`
        );
      }
      const verifiedSubtotal = calculateLineItemSubtotal(item.quantity, item.unitPrice);
      totalCents += toCents(verifiedSubtotal);
      return {
        ...item,
        subtotal: verifiedSubtotal,
      };
    });
  }

  const total = fromCents(totalCents);

  return {
    model: data.model,
    currency: data.currency,
    total,
    totalCents,
    lineItems,
    formattedTotal: formatCurrency(total, data.currency),
  };
}
