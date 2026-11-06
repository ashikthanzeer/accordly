/**
 * Input validation and decimal-safe monetary formatting for PayPal Invoicing.
 */

import type { CreateInvoiceInput } from "./types";

export class ValidationError extends Error {
  constructor(message: string) {
    super(`[ValidationError] ${message}`);
    this.name = "ValidationError";
  }
}

// Currencies with 0 decimal places per ISO 4217 standard used by PayPal
const ZERO_DECIMAL_CURRENCIES = new Set([
  "BIF",
  "CLP",
  "DJF",
  "GNF",
  "JPY",
  "KMF",
  "KRW",
  "MGA",
  "PYG",
  "RWF",
  "UGX",
  "VND",
  "VUV",
  "XAF",
  "XOF",
  "XPF",
  "HUF",
  "TWD",
]);

/**
 * Formats a monetary amount safely as a string with appropriate decimal precision.
 * Prevents IEEE-754 floating-point inaccuracies.
 */
export function formatDecimalAmount(
  amount: string | number,
  currency: string
): string {
  const normCurrency = currency.trim().toUpperCase();
  const isZeroDecimal = ZERO_DECIMAL_CURRENCIES.has(normCurrency);

  let numStr: string;
  if (typeof amount === "number") {
    if (!Number.isFinite(amount) || isNaN(amount)) {
      throw new ValidationError(`Invalid numerical amount: ${amount}`);
    }
    numStr = amount.toString();
  } else if (typeof amount === "string") {
    numStr = amount.trim();
  } else {
    throw new ValidationError(`Invalid amount type: ${typeof amount}`);
  }

  // Basic check for numeric string format (e.g., 100, 100.5, 100.50)
  if (!/^-?\d+(\.\d+)?$/.test(numStr)) {
    throw new ValidationError(`Amount "${numStr}" is not a valid decimal number string.`);
  }

  const [integerPart, fractionalPart = ""] = numStr.split(".");

  if (isZeroDecimal) {
    // For zero-decimal currencies, verify no fractional component was provided
    if (fractionalPart && parseInt(fractionalPart, 10) > 0) {
      throw new ValidationError(
        `Currency ${normCurrency} does not support fractional decimal amounts: "${numStr}".`
      );
    }
    return integerPart;
  }

  // Standard 2-decimal currencies: pad or truncate safely to 2 decimals
  const paddedFraction = (fractionalPart + "00").slice(0, 2);
  return `${integerPart}.${paddedFraction}`;
}

export interface ValidatedInvoiceLineItem {
  name: string;
  description?: string;
  quantity: string;
  unitAmount: string;
  currency?: string;
  unitOfMeasure?: string;
}

export interface ValidatedCreateInvoiceInput {
  recipientEmail: string;
  description: string;
  currency: string;
  amount: string; // Formatted decimal-safe string
  items?: ValidatedInvoiceLineItem[];
  idempotencyKey?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  dueDate?: string;
  note?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CURRENCY_REGEX = /^[A-Z]{3}$/;

/**
 * Validates and normalizes CreateInvoiceInput.
 */
export function validateCreateInvoiceInput(
  input: CreateInvoiceInput
): ValidatedCreateInvoiceInput {
  if (!input) {
    throw new ValidationError("Invoice input is required.");
  }

  const recipientEmail = input.recipientEmail?.trim();
  if (!recipientEmail || !EMAIL_REGEX.test(recipientEmail)) {
    throw new ValidationError(
      `Invalid recipient email: "${input.recipientEmail}". Must be a valid email address.`
    );
  }

  const description = input.description?.trim();
  if (!description) {
    throw new ValidationError("Invoice description is required and cannot be empty.");
  }

  const currency = input.currency?.trim().toUpperCase();
  if (!currency || !CURRENCY_REGEX.test(currency)) {
    throw new ValidationError(
      `Invalid currency code: "${input.currency}". Must be a 3-letter ISO currency code (e.g. USD).`
    );
  }

  const formattedAmount = formatDecimalAmount(input.amount, currency);
  const numericVal = parseFloat(formattedAmount);
  if (numericVal <= 0) {
    throw new ValidationError(
      `Invoice amount must be greater than zero. Received: "${formattedAmount}".`
    );
  }

  let validatedItems: ValidatedInvoiceLineItem[] | undefined;
  if (Array.isArray(input.items) && input.items.length > 0) {
    validatedItems = input.items.map((item, idx) => {
      const name = item.name?.trim();
      if (!name) {
        throw new ValidationError(`Line item at index ${idx} must have a non-empty name.`);
      }

      const qty = typeof item.quantity === "number" ? item.quantity : parseFloat(String(item.quantity));
      if (!Number.isFinite(qty) || qty <= 0) {
        throw new ValidationError(`Line item "${name}" must have a quantity greater than zero. Received: ${item.quantity}`);
      }

      const itemCurrency = item.currency ? item.currency.trim().toUpperCase() : currency;
      const unitAmount = formatDecimalAmount(item.unitAmount, itemCurrency);

      return {
        name,
        description: item.description?.trim() || undefined,
        quantity: String(qty),
        unitAmount,
        currency: itemCurrency,
        unitOfMeasure: item.unitOfMeasure?.trim() || "QUANTITY",
      };
    });
  }

  return {
    recipientEmail,
    description,
    currency,
    amount: formattedAmount,
    items: validatedItems,
    idempotencyKey: input.idempotencyKey?.trim() || undefined,
    invoiceNumber: input.invoiceNumber?.trim() || undefined,
    invoiceDate: input.invoiceDate?.trim() || undefined,
    dueDate: input.dueDate?.trim() || undefined,
    note: input.note?.trim() || undefined,
  };
}

