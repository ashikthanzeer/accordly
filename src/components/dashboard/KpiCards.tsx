"use client";

import React from "react";
import type { DashboardKpis } from "@/lib/dashboard/types";
import { GlassCard } from "@/components/ui/GlassCard";

interface KpiCardsProps {
  kpis: DashboardKpis;
}

export function KpiCards({ kpis }: KpiCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Active Projects */}
      <GlassCard tilt={true} intensity="medium" className="p-5 space-y-2.5">
        <div className="flex items-center justify-between text-[#9298A3]">
          <span className="text-[11px] font-bold uppercase tracking-wider">Active Projects</span>
          <div className="w-8 h-8 rounded-xl bg-white/[0.04] border border-white/[0.08] text-[#D4AF65] flex items-center justify-center font-bold text-sm shadow-sm">
            📁
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-extrabold font-mono text-[#F5F3ED]">{kpis.activeProjectsCount}</span>
          <span className="text-xs text-[#9298A3]">/ {kpis.totalProjectsCount} total</span>
        </div>
        <p className="text-[11px] text-[#9298A3] leading-relaxed">
          Engagements currently in active development or review.
        </p>
      </GlassCard>

      {/* Pending Approvals */}
      <GlassCard tilt={true} intensity="medium" className="p-5 space-y-2.5">
        <div className="flex items-center justify-between text-[#9298A3]">
          <span className="text-[11px] font-bold uppercase tracking-wider">Pending Approvals</span>
          <div className="w-8 h-8 rounded-xl bg-[#E5B45C]/10 border border-[#E5B45C]/25 text-[#E5B45C] flex items-center justify-center font-bold text-sm shadow-sm">
            ⏱
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-extrabold font-mono text-[#E5B45C]">{kpis.pendingApprovalsCount}</span>
          <span className="text-xs text-[#E5B45C]/80 font-medium">awaiting client</span>
        </div>
        <p className="text-[11px] text-[#9298A3] leading-relaxed">
          Change proposals shared and pending client sign-off.
        </p>
      </GlassCard>

      {/* Outstanding Invoices */}
      <GlassCard tilt={true} intensity="prominent" className="p-5 space-y-2.5">
        <div className="flex items-center justify-between text-[#9298A3]">
          <span className="text-[11px] font-bold uppercase tracking-wider">Unpaid Invoices</span>
          <div className="w-8 h-8 rounded-xl bg-[#D4AF65]/10 border border-[#D4AF65]/25 text-[#D4AF65] flex items-center justify-center font-bold text-sm shadow-sm">
            💳
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-extrabold font-mono text-[#D4AF65]">{kpis.outstandingInvoicesCount}</span>
          <span className="text-xs text-[#D4AF65]/80 font-medium">pending payment</span>
        </div>
        <p className="text-[11px] text-[#9298A3] leading-relaxed">
          Invoices sent to clients awaiting full settlement.
        </p>
      </GlassCard>

      {/* Total Engagements */}
      <GlassCard tilt={true} intensity="subtle" className="p-5 space-y-2.5">
        <div className="flex items-center justify-between text-[#9298A3]">
          <span className="text-[11px] font-bold uppercase tracking-wider">Total Engagements</span>
          <div className="w-8 h-8 rounded-xl bg-white/[0.04] border border-white/[0.08] text-[#9298A3] flex items-center justify-center font-bold text-sm shadow-sm">
            📊
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-extrabold font-mono text-[#F5F3ED]">{kpis.totalProjectsCount}</span>
          <span className="text-xs text-[#9298A3]">all time</span>
        </div>
        <p className="text-[11px] text-[#9298A3] leading-relaxed">
          Total client projects managed across Accordly.
        </p>
      </GlassCard>
    </div>
  );
}
