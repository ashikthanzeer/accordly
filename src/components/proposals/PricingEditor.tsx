"use client";

import React from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import type {
  PricingModel,
  PricingLineItem,
  ProposalPricingInput,
  CalculatedPricingSummary,
} from "@/lib/pricing/schema";
import {
  calculateLineItemSubtotal,
  formatCurrency,
} from "@/lib/pricing/calculator";

interface PricingEditorProps {
  pricingConfig: ProposalPricingInput;
  calculatedPricing?: CalculatedPricingSummary;
  currency: string;
  isReadOnly?: boolean;
  onChange: (updated: ProposalPricingInput) => void;
}

export function PricingEditor({
  pricingConfig,
  calculatedPricing,
  currency,
  isReadOnly = false,
  onChange,
}: PricingEditorProps) {
  const model = pricingConfig.model;

  const handleModelChange = (newModel: PricingModel) => {
    if (isReadOnly) return;
    onChange({
      ...pricingConfig,
      model: newModel,
    });
  };

  const handleFixedAmountChange = (val: number) => {
    onChange({
      ...pricingConfig,
      fixedAmount: val,
    });
  };

  const handleHourlyRateChange = (rate: number) => {
    onChange({
      ...pricingConfig,
      hourlyRate: rate,
    });
  };

  const handleHoursChange = (hours: number) => {
    onChange({
      ...pricingConfig,
      estimatedHours: hours,
    });
  };

  const handleAddLineItem = () => {
    const newItem: PricingLineItem = {
      id: `LI-${(pricingConfig.lineItems?.length || 0) + 1}`,
      description: "Additional Deliverable Scope",
      quantity: 1,
      unitPrice: 100,
      currency,
      subtotal: 100,
    };
    onChange({
      ...pricingConfig,
      lineItems: [...(pricingConfig.lineItems || []), newItem],
    });
  };

  const handleUpdateLineItem = (index: number, patch: Partial<PricingLineItem>) => {
    const items = [...(pricingConfig.lineItems || [])];
    const current = items[index];
    const updated = { ...current, ...patch };

    // Recalculate subtotal
    if (patch.quantity !== undefined || patch.unitPrice !== undefined) {
      updated.subtotal = calculateLineItemSubtotal(
        updated.quantity,
        updated.unitPrice
      );
    }

    items[index] = updated;
    onChange({
      ...pricingConfig,
      lineItems: items,
    });
  };

  const handleRemoveLineItem = (index: number) => {
    const items = (pricingConfig.lineItems || []).filter((_, i) => i !== index);
    onChange({
      ...pricingConfig,
      lineItems: items,
    });
  };

  // Determine current display total
  let displayTotal = 0;
  if (calculatedPricing) {
    displayTotal = calculatedPricing.total;
  } else if (model === "FIXED") {
    displayTotal = pricingConfig.fixedAmount || 0;
  } else if (model === "HOURLY") {
    displayTotal = calculateLineItemSubtotal(
      pricingConfig.estimatedHours || 0,
      pricingConfig.hourlyRate || 0
    );
  } else if (model === "ITEMIZED") {
    displayTotal = (pricingConfig.lineItems || []).reduce(
      (sum, item) => sum + (item.subtotal || 0),
      0
    );
  }

  return (
    <GlassCard variant="surface" intensity="prominent" tilt={false} className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#292D35] pb-4">
        <div>
          <h3 className="text-base font-bold text-[#F5F3ED]">
            Commercial Pricing Configuration
          </h3>
          <p className="text-xs text-[#9298A3]">
            Deterministic calculations using decimal-safe scaled integer precision.
          </p>
        </div>

        {/* Model Selector Buttons */}
        {!isReadOnly && (
          <div className="inline-flex rounded-lg border border-[#292D35] p-1 bg-[#111318]/90 text-xs font-semibold">
            <button
              type="button"
              onClick={() => handleModelChange("FIXED")}
              className={`px-3 py-1.5 rounded-md transition-all active:scale-[0.98] ${
                model === "FIXED"
                  ? "bg-[#171A20] text-[#D4AF65] border border-[#D4AF65]/40 shadow-sm shadow-[#D4AF65]/10 font-bold"
                  : "text-[#9298A3] hover:text-[#F5F3ED]"
              }`}
            >
              Fixed Price
            </button>
            <button
              type="button"
              onClick={() => handleModelChange("HOURLY")}
              className={`px-3 py-1.5 rounded-md transition-all active:scale-[0.98] ${
                model === "HOURLY"
                  ? "bg-[#171A20] text-[#D4AF65] border border-[#D4AF65]/40 shadow-sm shadow-[#D4AF65]/10 font-bold"
                  : "text-[#9298A3] hover:text-[#F5F3ED]"
              }`}
            >
              Hourly Rate
            </button>
            <button
              type="button"
              onClick={() => handleModelChange("ITEMIZED")}
              className={`px-3 py-1.5 rounded-md transition-all active:scale-[0.98] ${
                model === "ITEMIZED"
                  ? "bg-[#171A20] text-[#D4AF65] border border-[#D4AF65]/40 shadow-sm shadow-[#D4AF65]/10 font-bold"
                  : "text-[#9298A3] hover:text-[#F5F3ED]"
              }`}
            >
              Itemized Line Items
            </button>
          </div>
        )}
      </div>

      {/* FIXED PRICE MODEL */}
      {model === "FIXED" && (
        <div className="bg-[#111318]/80 border border-[#292D35] rounded-xl p-4 space-y-3">
          <label className="block text-xs font-semibold uppercase tracking-wider text-[#9298A3]">
            Lump-Sum Fixed Price Amount ({currency})
          </label>
          <div className="relative max-w-xs">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-[#D4AF65] font-semibold">
              $
            </span>
            <input
              type="number"
              min="0"
              step="0.01"
              disabled={isReadOnly}
              value={pricingConfig.fixedAmount ?? ""}
              onChange={(e) => handleFixedAmountChange(Number(e.target.value))}
              placeholder="e.g. 500.00"
              className="w-full pl-8 pr-3 py-2 rounded-lg bg-[#090A0C]/90 border border-[#292D35] text-sm font-semibold font-mono text-[#F5F3ED] placeholder-[#9298A3]/50 focus:outline-none focus:border-[#D4AF65] disabled:opacity-60 transition-colors"
            />
          </div>
          <p className="text-xs text-[#9298A3]">
            All proposed deliverables will be covered under this single fixed commercial total.
          </p>
        </div>
      )}

      {/* HOURLY RATE MODEL */}
      {model === "HOURLY" && (
        <div className="bg-[#111318]/80 border border-[#292D35] rounded-xl p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#9298A3] mb-1">
                Hourly Rate ({currency}/hr)
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-[#D4AF65] font-semibold">
                  $
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  disabled={isReadOnly}
                  value={pricingConfig.hourlyRate ?? ""}
                  onChange={(e) => handleHourlyRateChange(Number(e.target.value))}
                  placeholder="150.00"
                  className="w-full pl-8 pr-3 py-2 rounded-lg bg-[#090A0C]/90 border border-[#292D35] text-sm font-semibold font-mono text-[#F5F3ED] placeholder-[#9298A3]/50 focus:outline-none focus:border-[#D4AF65] disabled:opacity-60 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#9298A3] mb-1">
                Estimated Hours
              </label>
              <input
                type="number"
                min="0"
                step="0.5"
                disabled={isReadOnly}
                value={pricingConfig.estimatedHours ?? ""}
                onChange={(e) => handleHoursChange(Number(e.target.value))}
                placeholder="e.g. 8"
                className="w-full px-3 py-2 rounded-lg bg-[#090A0C]/90 border border-[#292D35] text-sm font-semibold font-mono text-[#F5F3ED] placeholder-[#9298A3]/50 focus:outline-none focus:border-[#D4AF65] disabled:opacity-60 transition-colors"
              />
            </div>
          </div>
          <p className="text-xs text-[#9298A3]">
            Calculation: <span className="font-mono text-[#F5F3ED]">{pricingConfig.estimatedHours || 0} hrs</span> ×{" "}
            <span className="font-mono text-[#F5F3ED]">{formatCurrency(pricingConfig.hourlyRate || 0, currency)}/hr</span> ={" "}
            <span className="font-semibold font-mono text-[#D4AF65]">
              {formatCurrency(displayTotal, currency)}
            </span>
          </p>
        </div>
      )}

      {/* ITEMIZED LINE ITEMS MODEL */}
      {model === "ITEMIZED" && (
        <div className="space-y-3">
          <div className="divide-y divide-[#292D35] border border-[#292D35] rounded-xl overflow-hidden bg-[#171A20]/60 backdrop-blur-sm">
            <div className="bg-[#111318]/90 px-3.5 py-2 text-[11px] font-bold uppercase tracking-wider text-[#9298A3] grid grid-cols-12 gap-2 border-b border-[#292D35]">
              <span className="col-span-5 sm:col-span-6">Description</span>
              <span className="col-span-2 text-right">Qty/Hours</span>
              <span className="col-span-2 text-right">Unit Price</span>
              <span className="col-span-2 text-right">Subtotal</span>
              <span className="col-span-1 text-center"></span>
            </div>

            {(pricingConfig.lineItems || []).map((item, idx) => (
              <div
                key={item.id || idx}
                className="px-3.5 py-2.5 grid grid-cols-12 gap-2 items-center hover:bg-[#1D2129]/60 transition-colors"
              >
                <div className="col-span-5 sm:col-span-6">
                  <input
                    type="text"
                    disabled={isReadOnly}
                    value={item.description}
                    onChange={(e) =>
                      handleUpdateLineItem(idx, { description: e.target.value })
                    }
                    placeholder="Line item description"
                    className="w-full text-xs font-medium text-[#F5F3ED] border-0 bg-transparent focus:ring-1 focus:ring-[#D4AF65] rounded p-1 placeholder-[#9298A3]/50"
                  />
                </div>

                <div className="col-span-2">
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    disabled={isReadOnly}
                    value={item.quantity}
                    onChange={(e) =>
                      handleUpdateLineItem(idx, { quantity: Number(e.target.value) })
                    }
                    className="w-full text-xs font-mono font-semibold text-right text-[#F5F3ED] bg-[#090A0C]/90 border border-[#292D35] rounded p-1 focus:outline-none focus:border-[#D4AF65]"
                  />
                </div>

                <div className="col-span-2">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    disabled={isReadOnly}
                    value={item.unitPrice}
                    onChange={(e) =>
                      handleUpdateLineItem(idx, { unitPrice: Number(e.target.value) })
                    }
                    className="w-full text-xs font-mono font-semibold text-right text-[#F5F3ED] bg-[#090A0C]/90 border border-[#292D35] rounded p-1 focus:outline-none focus:border-[#D4AF65]"
                  />
                </div>

                <div className="col-span-2 text-right text-xs font-mono font-bold text-[#D4AF65]">
                  {formatCurrency(item.subtotal, currency)}
                </div>

                <div className="col-span-1 text-center">
                  {!isReadOnly && (
                    <button
                      type="button"
                      onClick={() => handleRemoveLineItem(idx)}
                      className="text-[#9298A3] hover:text-[#E06C75] transition-colors"
                      title="Remove line item"
                    >
                      &times;
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {!isReadOnly && (
            <button
              type="button"
              onClick={handleAddLineItem}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#D4AF65] hover:text-[#E2C17F] transition-all hover:scale-[1.01] active:scale-[0.98]"
            >
              + Add Itemized Line Item
            </button>
          )}
        </div>
      )}

      {/* Calculated Grand Total Summary Box */}
      <GlassCard variant="gold" intensity="prominent" tilt={false} className="flex flex-wrap items-center justify-between p-5 shadow-lg">
        <div className="space-y-0.5">
          <span className="text-xs uppercase tracking-wider text-[#9298A3] font-semibold">
            Calculated Proposal Total ({currency})
          </span>
          <p className="text-xs text-[#9298A3]">
            Model: <span className="font-semibold text-[#F5F3ED]">{model}</span> | Currency:{" "}
            <span className="font-semibold font-mono text-[#D4AF65]">{currency}</span>
          </p>
        </div>

        <div className="text-right">
          <span className="text-2xl font-mono font-black text-[#F5F3ED] tracking-tight">
            {formatCurrency(displayTotal, currency)}
          </span>
          <p className="text-[10px] text-[#9298A3] font-mono">
            Decimal-safe exact cents precision
          </p>
        </div>
      </GlassCard>
    </GlassCard>
  );
}
