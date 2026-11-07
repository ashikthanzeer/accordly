"use client";

import React from "react";
import Link from "next/link";
import type { RecentActivityItem } from "@/lib/dashboard/types";
import { GlassCard } from "@/components/ui/GlassCard";

interface RecentActivityFeedProps {
  activity: RecentActivityItem[];
}

export function RecentActivityFeed({ activity }: RecentActivityFeedProps) {
  if (activity.length === 0) {
    return (
      <GlassCard intensity="subtle" className="p-6 text-center text-[#9298A3] text-xs">
        No recent activity logged yet.
      </GlassCard>
    );
  }

  const getActorBadge = (actorType: string) => {
    switch (actorType) {
      case "PAYPAL":
        return (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#3B82F6]/15 text-[#60A5FA] border border-[#3B82F6]/30 font-mono">
            PAYPAL
          </span>
        );
      case "CLIENT":
        return (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#43B581]/15 text-[#43B581] border border-[#43B581]/30">
            CLIENT
          </span>
        );
      case "PROVIDER":
        return (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#D4AF65]/15 text-[#D4AF65] border border-[#D4AF65]/30">
            PROVIDER
          </span>
        );
      case "SYSTEM":
      default:
        return (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/[0.04] text-[#9298A3] border border-white/[0.08]">
            SYSTEM
          </span>
        );
    }
  };

  return (
    <GlassCard intensity="subtle" className="p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
        <h3 className="text-sm font-bold text-[#F5F3ED]">Recent Activity</h3>
        <span className="text-[10px] text-[#D4AF65] font-semibold flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF65] animate-pulse" />
          Live Event Feed
        </span>
      </div>

      <div className="divide-y divide-white/[0.06] max-h-[480px] overflow-y-auto pr-1 space-y-2">
        {activity.map((item) => (
          <div key={item.id} className="pt-2.5 pb-2.5 text-xs space-y-1.5 hover:bg-white/[0.02] rounded-lg px-1.5 transition-colors">
            <div className="flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-1.5">
                {getActorBadge(item.actorType)}
                <Link
                  href={`/projects/${item.projectId}/timeline`}
                  className="font-bold text-[#F5F3ED] hover:text-[#D4AF65] transition-colors truncate max-w-[150px]"
                >
                  {item.projectName}
                </Link>
              </div>
              <span className="text-[10px] text-[#9298A3] font-mono">{item.formattedTime}</span>
            </div>
            <p className="text-[#9298A3] text-[11px] leading-relaxed">
              {item.description}
            </p>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}
