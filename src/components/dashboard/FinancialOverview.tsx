"use client";

import React from "react";
import type { CurrencyFinancialSummary } from "@/lib/dashboard/types";

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
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm text-center space-y-2">
        <div className="text-2xl">📊</div>
        <h3 className="text-sm font-bold text-slate-800">No Invoiced Commercial Activity Yet</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Once client-accepted proposals are converted into sent PayPal invoices, authoritative financial totals and collection metrics will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900">Financial Position</h2>
          <p className="text-xs text-slate-500">
            Authoritative invoiced, collected, and outstanding receivables grouped strictly by currency.
          </p>
        </div>
        <span className="text-[11px] font-semibold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">
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
            <div
              key={curr}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4 hover:border-slate-300 transition-colors"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 font-bold text-xs flex items-center justify-center">
                    {curr}
                  </span>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">{curr} Portfolio</h4>
                    <span className="text-[10px] text-slate-400">
                      {summary.invoiceCount} {summary.invoiceCount === 1 ? "invoice" : "invoices"} billed
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    {collectionPercent}% Collected
                  </span>
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    Total Billed
                  </span>
                  <p className="text-sm font-black text-slate-900 mt-0.5">
                    {summary.formattedTotalInvoiced}
                  </p>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-bold text-emerald-600 tracking-wider">
                    Collected
                  </span>
                  <p className="text-sm font-black text-emerald-700 mt-0.5">
                    {summary.formattedTotalCollected}
                  </p>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    Outstanding
                  </span>
                  <p className={`text-sm font-black mt-0.5 ${summary.outstandingBalance > 0 ? "text-indigo-600" : "text-slate-500"}`}>
                    {summary.formattedOutstandingBalance}
                  </p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="space-y-1">
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden flex">
                  <div
                    className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${collectionPercent}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>Settled: {summary.paidCount}</span>
                  {summary.partiallyPaidCount > 0 && (
                    <span>Partial: {summary.partiallyPaidCount}</span>
                  )}
                  <span>Awaiting: {summary.sentCount}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

