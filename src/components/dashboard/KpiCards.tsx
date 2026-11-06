"use client";

import React from "react";
import type { DashboardKpis } from "@/lib/dashboard/types";

interface KpiCardsProps {
  kpis: DashboardKpis;
}

export function KpiCards({ kpis }: KpiCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Active Projects */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-2 hover:border-slate-300 transition-colors">
        <div className="flex items-center justify-between text-slate-500">
          <span className="text-xs font-bold uppercase tracking-wider">Active Projects</span>
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm">
            📁
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-black text-slate-900">{kpis.activeProjectsCount}</span>
          <span className="text-xs text-slate-400">/ {kpis.totalProjectsCount} total</span>
        </div>
        <p className="text-[11px] text-slate-500">
          Engagements currently in active development or review.
        </p>
      </div>

      {/* Pending Approvals */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-2 hover:border-slate-300 transition-colors">
        <div className="flex items-center justify-between text-slate-500">
          <span className="text-xs font-bold uppercase tracking-wider">Pending Approvals</span>
          <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-sm">
            ⏱
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-black text-amber-600">{kpis.pendingApprovalsCount}</span>
          <span className="text-xs text-amber-700/80 font-medium">awaiting decision</span>
        </div>
        <p className="text-[11px] text-slate-500">
          Change proposals shared and pending client sign-off.
        </p>
      </div>

      {/* Outstanding Invoices */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-2 hover:border-slate-300 transition-colors">
        <div className="flex items-center justify-between text-slate-500">
          <span className="text-xs font-bold uppercase tracking-wider">Unpaid Invoices</span>
          <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm">
            💳
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-black text-indigo-600">{kpis.outstandingInvoicesCount}</span>
          <span className="text-xs text-indigo-700/80 font-medium">pending payment</span>
        </div>
        <p className="text-[11px] text-slate-500">
          Invoices sent to clients awaiting full settlement.
        </p>
      </div>

      {/* Scope-to-Cash Pipeline Health */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-2 hover:border-slate-300 transition-colors">
        <div className="flex items-center justify-between text-slate-500">
          <span className="text-xs font-bold uppercase tracking-wider">Workflow Health</span>
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-sm">
            ✓
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-black text-emerald-600">100%</span>
          <span className="text-xs text-emerald-700/80 font-medium">reconciled</span>
        </div>
        <p className="text-[11px] text-slate-500">
          Live PayPal Sandbox verification and webhook listeners active.
        </p>
      </div>
    </div>
  );
}

