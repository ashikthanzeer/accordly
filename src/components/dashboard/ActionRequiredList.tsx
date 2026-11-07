"use client";

import React from "react";
import Link from "next/link";
import type { ActionRequiredItem } from "@/lib/dashboard/types";
import { GlassCard } from "@/components/ui/GlassCard";

interface ActionRequiredListProps {
  items: ActionRequiredItem[];
}

export function ActionRequiredList({ items }: ActionRequiredListProps) {
  if (items.length === 0) {
    return (
      <GlassCard intensity="subtle" className="p-5 flex items-center justify-between border-[#43B581]/30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#43B581]/15 border border-[#43B581]/30 text-[#43B581] flex items-center justify-center font-bold text-sm shadow-sm">
            ✓
          </div>
          <div>
            <h4 className="text-xs font-bold text-[#F5F3ED]">All Commercial Tasks Caught Up</h4>
            <p className="text-[11px] text-[#9298A3]">
              No baselines pending confirmation, requests awaiting review, or uninvoiced accepted proposals.
            </p>
          </div>
        </div>
      </GlassCard>
    );
  }

  const getSeverityBadge = (severity: "HIGH" | "MEDIUM" | "LOW") => {
    switch (severity) {
      case "HIGH":
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E06C75]/15 text-[#E06C75] border border-[#E06C75]/30 shadow-sm">
            Urgent
          </span>
        );
      case "MEDIUM":
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E5B45C]/15 text-[#E5B45C] border border-[#E5B45C]/30 shadow-sm">
            Action Needed
          </span>
        );
      case "LOW":
      default:
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#D4AF65]/15 text-[#D4AF65] border border-[#D4AF65]/30 shadow-sm">
            In Progress
          </span>
        );
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold text-[#F5F3ED]">Action Required</h2>
          <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-[#E06C75]/15 text-[#E06C75] border border-[#E06C75]/30 shadow-sm">
            {items.length}
          </span>
        </div>
        <span className="text-xs text-[#9298A3]">Items needing provider decision</span>
      </div>

      <GlassCard intensity="prominent" className="divide-y divide-white/[0.08] overflow-hidden">
        {items.map((item) => (
          <div
            key={item.id}
            className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-white/[0.03] transition-colors"
          >
            <div className="space-y-1.5 max-w-xl">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-bold text-[#9298A3] bg-white/[0.04] px-2 py-0.5 rounded border border-white/[0.08]">
                  {item.projectName}
                </span>
                {getSeverityBadge(item.severity)}
                <h4 className="text-xs font-bold text-[#F5F3ED]">{item.title}</h4>
              </div>
              <p className="text-xs text-[#9298A3] leading-relaxed">{item.description}</p>
            </div>

            <div className="flex-shrink-0">
              <Link
                href={item.href}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#090A0C] bg-[#D4AF65] hover:bg-[#E2C17F] hover:shadow-[0_0_16px_rgba(212,175,101,0.35)] px-3.5 py-1.5 rounded-xl transition-all shadow-sm active:scale-95"
              >
                <span>Take Action</span>
                <span>→</span>
              </Link>
            </div>
          </div>
        ))}
      </GlassCard>
    </div>
  );
}
