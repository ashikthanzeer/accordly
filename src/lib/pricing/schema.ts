import { z } from "zod";

export const PricingModelSchema = z.enum(["FIXED", "HOURLY", "ITEMIZED"]);
export type PricingModel = z.infer<typeof PricingModelSchema>;

export const PricingLineItemSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1, "Line item description is required"),
  quantity: z
    .number()
    .positive("Quantity or hours must be a positive number")
    .max(10000, "Quantity exceeds realistic bound"),
  unitPrice: z
    .number()
    .nonnegative("Unit price cannot be negative")
    .max(1000000, "Unit price exceeds realistic bound"),
  currency: z
    .string()
    .length(3, "Currency must be a 3-letter ISO code (e.g. USD)")
    .toUpperCase(),
  subtotal: z.number().nonnegative(),
});
export type PricingLineItem = z.infer<typeof PricingLineItemSchema>;

export const ProposalPricingInputSchema = z
  .object({
    model: PricingModelSchema,
    currency: z
      .string()
      .length(3, "Currency must be a 3-letter ISO code")
      .toUpperCase(),
    fixedAmount: z.number().positive().optional().nullable(),
    hourlyRate: z.number().positive().optional().nullable(),
    estimatedHours: z.number().positive().optional().nullable(),
    lineItems: z.array(PricingLineItemSchema).default([]),
  })
  .superRefine((data, ctx) => {
    // Model-specific validations
    if (data.model === "FIXED") {
      if (!data.fixedAmount || data.fixedAmount <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Fixed price model requires a positive fixed amount.",
          path: ["fixedAmount"],
        });
      }
    } else if (data.model === "HOURLY") {
      if (!data.hourlyRate || data.hourlyRate <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Hourly model requires a positive hourly rate.",
          path: ["hourlyRate"],
        });
      }
      if (!data.estimatedHours || data.estimatedHours <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Hourly model requires positive estimated hours.",
          path: ["estimatedHours"],
        });
      }
    } else if (data.model === "ITEMIZED") {
      if (!data.lineItems || data.lineItems.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Itemized pricing model requires at least one line item.",
          path: ["lineItems"],
        });
      }
      // Check currency consistency
      for (let i = 0; i < data.lineItems.length; i++) {
        if (data.lineItems[i].currency !== data.currency) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Line item #${i + 1} currency (${data.lineItems[i].currency}) does not match proposal currency (${data.currency}).`,
            path: ["lineItems", i, "currency"],
          });
        }
      }
    }
  });

export type ProposalPricingInput = z.infer<typeof ProposalPricingInputSchema>;

export interface CalculatedPricingSummary {
  model: PricingModel;
  currency: string;
  total: number; // In standard major units (e.g. 150.50)
  totalCents: number; // In integer cents (e.g. 15050)
  lineItems: PricingLineItem[];
  formattedTotal: string;
}

