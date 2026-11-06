import { describe, it, expect } from "vitest";
import {
  toCents,
  fromCents,
  calculateLineItemSubtotal,
  calculateProposalPricing,
  PricingCalculationError,
  formatCurrency,
} from "../calculator";

describe("Deterministic Decimal-Safe Pricing Calculator", () => {
  it("converts floating dollar amounts to integer cents without rounding drift", () => {
    expect(toCents(10.5)).toBe(1050);
    expect(toCents(0.1)).toBe(10);
    expect(toCents(0.2)).toBe(20);
    expect(toCents(99.99)).toBe(9999);
  });

  it("converts integer cents back to major units cleanly", () => {
    expect(fromCents(1050)).toBe(10.5);
    expect(fromCents(30)).toBe(0.3);
    expect(fromCents(9999)).toBe(99.99);
  });

  it("prevents classic JavaScript 0.1 + 0.2 floating point errors", () => {
    // In raw JS: 0.1 + 0.2 = 0.30000000000000004
    expect(0.1 + 0.2).not.toBe(0.3);

    const result = calculateProposalPricing({
      model: "ITEMIZED",
      currency: "USD",
      lineItems: [
        {
          id: "1",
          description: "Micro-service A",
          quantity: 1,
          unitPrice: 0.1,
          currency: "USD",
          subtotal: 0.1,
        },
        {
          id: "2",
          description: "Micro-service B",
          quantity: 1,
          unitPrice: 0.2,
          currency: "USD",
          subtotal: 0.2,
        },
      ],
    });

    expect(result.total).toBe(0.3);
    expect(result.totalCents).toBe(30);
  });

  it("correctly calculates fractional quantities and hours", () => {
    const subtotal = calculateLineItemSubtotal(3.5, 150.0);
    expect(subtotal).toBe(525.0);

    const result = calculateProposalPricing({
      model: "HOURLY",
      currency: "USD",
      hourlyRate: 150.0,
      estimatedHours: 3.5,
      lineItems: [],
    });

    expect(result.total).toBe(525.0);
    expect(result.totalCents).toBe(52500);
  });

  it("calculates fixed price proposals cleanly", () => {
    const result = calculateProposalPricing(
      {
        model: "FIXED",
        currency: "USD",
        fixedAmount: 2500.0,
        lineItems: [],
      },
      "USD"
    );

    expect(result.total).toBe(2500.0);
    expect(result.totalCents).toBe(250000);
    expect(result.model).toBe("FIXED");
  });

  it("rejects negative unit prices and quantities", () => {
    expect(() => calculateLineItemSubtotal(-1, 100)).toThrow(
      PricingCalculationError
    );
    expect(() => calculateLineItemSubtotal(5, -50)).toThrow(
      PricingCalculationError
    );
  });

  it("enforces single currency consistency and rejects mismatched line item currency", () => {
    expect(() =>
      calculateProposalPricing({
        model: "ITEMIZED",
        currency: "USD",
        lineItems: [
          {
            id: "1",
            description: "Feature A",
            quantity: 1,
            unitPrice: 100,
            currency: "USD",
            subtotal: 100,
          },
          {
            id: "2",
            description: "Feature B",
            quantity: 1,
            unitPrice: 150,
            currency: "EUR", // Mismatched currency
            subtotal: 150,
          },
        ],
      })
    ).toThrow(PricingCalculationError);
  });

  it("rejects proposal currency that does not match project currency", () => {
    expect(() =>
      calculateProposalPricing(
        {
          model: "FIXED",
          currency: "EUR",
          fixedAmount: 1000,
          lineItems: [],
        },
        "USD" // Project is USD
      )
    ).toThrow(PricingCalculationError);
  });

  it("formats currencies reliably", () => {
    expect(formatCurrency(1250.5, "USD")).toContain("1,250.50");
  });
});

