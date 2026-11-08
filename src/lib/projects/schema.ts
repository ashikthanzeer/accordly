import { z } from "zod";
import { PricingModelSchema, type PricingModel } from "@/lib/pricing/schema";

export const SUPPORTED_CURRENCIES = [
  "USD",
  "EUR",
  "GBP",
  "CAD",
  "AUD",
  "INR",
  "JPY",
  "SGD",
] as const;

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

const OptionalEmailSchema = z
  .union([
    z.string().trim().email("Please provide a valid client email address."),
    z.literal(""),
    z.undefined(),
    z.null(),
  ])
  .transform((val) => (typeof val === "string" ? val.trim() : ""));

const OptionalPositiveRateSchema = z
  .preprocess((val) => {
    if (val === "" || val === null || val === undefined) return null;
    if (typeof val === "string") {
      const parsed = Number(val);
      return Number.isNaN(parsed) ? val : parsed;
    }
    return val;
  }, z.number("Rate must be a valid number.").positive("Rate must be greater than zero.").max(1000000, "Rate exceeds maximum allowed value.").nullable().optional())
  .transform((val) => (val === undefined ? null : val));

export const CreateProjectSchema = z
  .object({
    name: z
      .string("Project name is required.")
      .trim()
      .min(1, "Project name is required.")
      .max(120, "Project name must be 120 characters or fewer."),
    clientName: z
      .string("Client name is required.")
      .trim()
      .min(1, "Client name is required.")
      .max(120, "Client name must be 120 characters or fewer."),
    clientEmail: OptionalEmailSchema,
    currency: z
      .string()
      .trim()
      .toUpperCase()
      .refine(
        (val): val is SupportedCurrency =>
          (SUPPORTED_CURRENCIES as readonly string[]).includes(val),
        {
          message: `Currency must be a supported 3-letter ISO code (${SUPPORTED_CURRENCIES.join(", ")}).`,
        }
      )
      .default("USD"),
    pricingModel: PricingModelSchema.default("HOURLY"),
    hourlyRate: OptionalPositiveRateSchema,
  })
  .superRefine((data, ctx) => {
    if (data.pricingModel === "HOURLY") {
      if (data.hourlyRate === null || data.hourlyRate === undefined || data.hourlyRate <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Hourly rate is required and must be greater than 0 when Hourly pricing model is selected.",
          path: ["hourlyRate"],
        });
      }
    }
  });

export type CreateProjectInput = z.input<typeof CreateProjectSchema>;
export type ValidatedCreateProjectInput = z.output<typeof CreateProjectSchema>;

export interface ProjectSummaryDto {
  id: string;
  ownerId: string;
  name: string;
  clientName: string;
  clientEmail: string;
  currency: string;
  pricingModel: PricingModel | string;
  hourlyRate: number | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}
