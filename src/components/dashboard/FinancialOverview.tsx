"use client";

import React from "react";
import type { CurrencyFinancialSummary } from "@/lib/dashboard/types";
import { GlassCard } from "@/components/ui/GlassCard";

interface FinancialOverviewProps {
  financialSummaries: Record<string, CurrencyFinancialSummary>;
  currencies: string[];
}

export function FinancialOverview({
  financialSummaries,
  currencies,
}: FinancialOverviewProps) {
  if (currencies.length === 0) {
    return (
      <GlassCard intensity="subtle" className="p-8 text-center space-y-3">
        <div className="w-12 h-12 rounded-xl bg-white/[0.04] border border-white/[0.08] text-2xl mx-auto flex items-center justify-center text-[#D4AF65] shadow-sm">
          📊
        </div>
        <h3 className="text-sm font-bold text-[#F5F3ED]">No Invoiced Commercial Activity Yet</h3>
        <p className="text-xs text-[#9298A3] max-w-md mx-auto leading-relaxed">
          Once client-accepted proposals are converted into sent PayPal invoices, authoritative financial totals and collection metrics will appear here.
        </p>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-[#F5F3ED]">Financial Position</h2>
          <p className="text-xs text-[#9298A3]">
            Authoritative invoiced, collected, and outstanding receivables grouped strictly by currency.
          </p>
        </div>
        <span className="text-[11px] font-semibold text-[#D4AF65] bg-[#171A20]/80 border border-white/[0.08] px-2.5 py-1 rounded-full shadow-sm">
          {currencies.length} {currencies.length === 1 ? "Currency" : "Currencies"}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {currencies.map((curr) => {
          const summary = financialSummaries[curr];
          if (!summary) return null;

          const collectionPercent =
            summary.totalInvoiced > 0
              ? Math.min(100, Math.round((summary.totalCollected / summary.totalInvoiced) * 100))
              : 0;

          return (
            <GlassCard
              key={curr}
              intensity="prominent"
              className="p-5 space-y-4"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-xl bg-[#D4AF65]/10 text-[#D4AF65] border border-[#D4AF65]/30 font-bold text-xs flex items-center justify-center font-mono shadow-sm">
                    {curr}
                  </span>
                  <div>
                    <h4 className="text-sm font-bold text-[#F5F3ED]">{curr} Portfolio</h4>
                    <span className="text-[10px] text-[#9298A3]">
                      {summary.invoiceCount} {summary.invoiceCount === 1 ? "invoice" : "invoices"} billed
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs font-black text-[#43B581] bg-[#43B581]/15 px-2.5 py-1 rounded-full border border-[#43B581]/30">
                    {collectionPercent}% Collected
                  </span>
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#9298A3] tracking-wider">
                    Total Billed
                  </span>
                  <p className="text-sm font-black font-mono text-[#F5F3ED] mt-0.5">
                    {summary.formattedTotalInvoiced}
                  </p>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-bold text-[#43B581] tracking-wider">
                    Collected
                  </span>
                  <p className="text-sm font-black font-mono text-[#43B581] mt-0.5">
                    {summary.formattedTotalCollected}
                  </p>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-bold text-[#9298A3] tracking-wider">
                    Outstanding
                  </span>
                  <p className={`text-sm font-black font-mono mt-0.5 ${summary.outstandingBalance > 0 ? "text-[#E5B45C]" : "text-[#43B581]"}`}>
                    {summary.formattedOutstandingBalance}
                  </p>
                </div>
              </div>

              {/* Liquid Gold Progress Bar */}
              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between text-[11px] font-semibold text-[#9298A3]">
                  <span>Collection Realization</span>
                  <span className="text-[#F5F3ED] font-mono">{collectionPercent}%</span>
                </div>
                <div className="w-full bg-[#090A0C] rounded-full h-2 overflow-hidden border border-white/[0.06]">
                  <div
                    className="h-full bg-gradient-to-r from-[#A98746] via-[#D4AF65] to-[#E2C17F] rounded-full transition-all duration-500 shadow-[0_0_12px_rgba(212,175,101,0.35)]"
                    style={{ width: `${collectionPercent}%` }}
                  />
                </div>
              </div>

              {/* Subtitle notes */}
              <div className="text-[10px] text-[#9298A3] flex items-center justify-between pt-1 border-t border-white/[0.06]">
                <span>
                  Authoritative collected payments: <strong className="text-[#F5F3ED] font-mono">{summary.paidCount}</strong>
                </span>
                <span className="text-[#D4AF65] font-semibold font-mono">
                  Settled
                </span>
              </div>
            </GlassCard>
          );
        })}
      </div>
    </div>
  );
}
