"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CreateProjectSchema,
  SUPPORTED_CURRENCIES,
  type ProjectSummaryDto,
  type SupportedCurrency,
} from "@/lib/projects/schema";
import type { PricingModel } from "@/lib/pricing/schema";

export interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectCreated?: (project: ProjectSummaryDto) => void;
}

export function CreateProjectModal({
  isOpen,
  onClose,
  onProjectCreated,
}: CreateProjectModalProps) {
  const router = useRouter();

  const [name, setName] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [currency, setCurrency] = useState<SupportedCurrency>("USD");
  const [pricingModel, setPricingModel] = useState<PricingModel>("HOURLY");
  const [hourlyRate, setHourlyRate] = useState("150");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  // Reset errors when modal opens/closes and allow Escape to close
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSubmitting) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setFieldErrors({});

    const payload = {
      name,
      clientName,
      clientEmail,
      currency,
      pricingModel,
      hourlyRate: hourlyRate.trim() === "" ? null : hourlyRate.trim(),
    };

    const parsed = CreateProjectSchema.safeParse(payload);
    if (!parsed.success) {
      const flattened = parsed.error.flatten();
      setFieldErrors(flattened.fieldErrors as Record<string, string[]>);
      setErrorMsg(parsed.error.issues[0]?.message || "Please check the required fields.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.fieldErrors) {
          setFieldErrors(data.fieldErrors);
        }
        throw new Error(data.error || `Failed to create project (HTTP ${res.status})`);
      }

      const created: ProjectSummaryDto = data.project;
      onProjectCreated?.(created);
      onClose();
      router.push(`/projects/${created.id}/baseline`);
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : "An unexpected error occurred while creating the project."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-project-title"
    >
      {/* Backdrop click target */}
      <div
        className="fixed inset-0"
        onClick={() => {
          if (!isSubmitting) onClose();
        }}
      />

      <div className="relative z-10 w-full max-w-lg rounded-2xl bg-[#111318] border border-white/[0.12] shadow-[0_24px_64px_rgba(0,0,0,0.85)] overflow-hidden">
        {/* Top Gold Accent Bar */}
        <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-[#D4AF65] to-transparent" />

        {/* Header */}
        <div className="px-6 py-5 border-b border-white/[0.08] flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold tracking-widest text-[#D4AF65] uppercase font-mono block">
              NEW COMMERCIAL ENGAGEMENT
            </span>
            <h2
              id="create-project-title"
              className="text-lg font-extrabold text-[#F5F3ED] tracking-tight mt-0.5"
            >
              Create New Project
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close modal"
            className="p-1.5 rounded-lg text-[#9298A3] hover:text-[#F5F3ED] hover:bg-white/[0.06] transition-colors disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate className="p-6 space-y-4">
          {errorMsg && (
            <div
              role="alert"
              className="p-3.5 rounded-xl bg-[#E06C75]/15 border border-[#E06C75]/35 text-xs text-[#E06C75] font-medium"
            >
              {errorMsg}
            </div>
          )}

          {/* Project Name */}
          <div>
            <label
              htmlFor="project-name-input"
              className="block text-xs font-bold text-[#F5F3ED] mb-1.5"
            >
              Project Name <span className="text-[#D4AF65]">*</span>
            </label>
            <input
              id="project-name-input"
              name="name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., E-Commerce Platform Redesign & Checkout"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#090A0C] border border-white/[0.1] text-xs text-[#F5F3ED] placeholder-[#9298A3]/50 focus:outline-none focus:border-[#D4AF65] transition-colors"
            />
            {fieldErrors.name?.[0] && (
              <p className="mt-1 text-[11px] text-[#E06C75]">{fieldErrors.name[0]}</p>
            )}
          </div>

          {/* Client Name & Client Email */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="client-name-input"
                className="block text-xs font-bold text-[#F5F3ED] mb-1.5"
              >
                Client Name <span className="text-[#D4AF65]">*</span>
              </label>
              <input
                id="client-name-input"
                name="clientName"
                type="text"
                required
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="e.g., Acme Digital Corp"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#090A0C] border border-white/[0.1] text-xs text-[#F5F3ED] placeholder-[#9298A3]/50 focus:outline-none focus:border-[#D4AF65] transition-colors"
              />
              {fieldErrors.clientName?.[0] && (
                <p className="mt-1 text-[11px] text-[#E06C75]">{fieldErrors.clientName[0]}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="client-email-input"
                className="block text-xs font-bold text-[#F5F3ED] mb-1.5"
              >
                Client Email <span className="text-[10px] font-normal text-[#9298A3]">(Optional)</span>
              </label>
              <input
                id="client-email-input"
                name="clientEmail"
                type="email"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                placeholder="billing@client.com"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#090A0C] border border-white/[0.1] text-xs text-[#F5F3ED] placeholder-[#9298A3]/50 focus:outline-none focus:border-[#D4AF65] transition-colors"
              />
              {fieldErrors.clientEmail?.[0] && (
                <p className="mt-1 text-[11px] text-[#E06C75]">{fieldErrors.clientEmail[0]}</p>
              )}
            </div>
          </div>

          {/* Currency & Pricing Model */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="project-currency-select"
                className="block text-xs font-bold text-[#F5F3ED] mb-1.5"
              >
                Currency <span className="text-[#D4AF65]">*</span>
              </label>
              <select
                id="project-currency-select"
                name="currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value as SupportedCurrency)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#090A0C] border border-white/[0.1] text-xs text-[#F5F3ED] focus:outline-none focus:border-[#D4AF65] transition-colors"
              >
                {SUPPORTED_CURRENCIES.map((code) => (
                  <option key={code} value={code} className="bg-[#111318] text-[#F5F3ED]">
                    {code}
                  </option>
                ))}
              </select>
              {fieldErrors.currency?.[0] && (
                <p className="mt-1 text-[11px] text-[#E06C75]">{fieldErrors.currency[0]}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="pricing-model-select"
                className="block text-xs font-bold text-[#F5F3ED] mb-1.5"
              >
                Pricing Model <span className="text-[#D4AF65]">*</span>
              </label>
              <select
                id="pricing-model-select"
                name="pricingModel"
                value={pricingModel}
                onChange={(e) => setPricingModel(e.target.value as PricingModel)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#090A0C] border border-white/[0.1] text-xs text-[#F5F3ED] focus:outline-none focus:border-[#D4AF65] transition-colors"
              >
                <option value="HOURLY" className="bg-[#111318] text-[#F5F3ED]">
                  Hourly Rate (HOURLY)
                </option>
                <option value="FIXED" className="bg-[#111318] text-[#F5F3ED]">
                  Fixed Fee (FIXED)
                </option>
                <option value="ITEMIZED" className="bg-[#111318] text-[#F5F3ED]">
                  Itemized Line Items (ITEMIZED)
                </option>
              </select>
              {fieldErrors.pricingModel?.[0] && (
                <p className="mt-1 text-[11px] text-[#E06C75]">{fieldErrors.pricingModel[0]}</p>
              )}
            </div>
          </div>

          {/* Relevant Pricing Information */}
          <div>
            <label
              htmlFor="hourly-rate-input"
              className="block text-xs font-bold text-[#F5F3ED] mb-1.5"
            >
              {pricingModel === "HOURLY" ? (
                <>
                  Hourly Rate ({currency}/hr) <span className="text-[#D4AF65]">*</span>
                </>
              ) : (
                <>
                  Default Out-of-Scope Hourly Rate ({currency}/hr){" "}
                  <span className="text-[10px] font-normal text-[#9298A3]">(Optional)</span>
                </>
              )}
            </label>
            <input
              id="hourly-rate-input"
              name="hourlyRate"
              type="number"
              step="0.01"
              min="0.01"
              required={pricingModel === "HOURLY"}
              value={hourlyRate}
              onChange={(e) => setHourlyRate(e.target.value)}
              placeholder="150.00"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#090A0C] border border-white/[0.1] text-xs text-[#F5F3ED] font-mono placeholder-[#9298A3]/50 focus:outline-none focus:border-[#D4AF65] transition-colors"
            />
            {fieldErrors.hourlyRate?.[0] && (
              <p className="mt-1 text-[11px] text-[#E06C75]">{fieldErrors.hourlyRate[0]}</p>
            )}
            <p className="mt-1.5 text-[11px] text-[#9298A3]">
              {pricingModel === "HOURLY"
                ? "Used as the default billing rate when pricing out-of-scope change orders."
                : pricingModel === "FIXED"
                  ? "Fixed-fee change orders will default to flat-amount pricing in this currency."
                  : "Itemized change orders will compute totals across deliverable line items in this currency."}
            </p>
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-white/[0.08] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-[#9298A3] hover:text-[#F5F3ED] bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold text-[#090A0C] bg-[#D4AF65] hover:bg-[#E2C17F] hover:shadow-[0_0_16px_rgba(212,175,101,0.35)] transition-all shadow-sm disabled:opacity-50 active:scale-95"
            >
              {isSubmitting ? "Creating Project..." : "Create Project & Upload Agreement"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

