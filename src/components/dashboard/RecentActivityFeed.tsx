"use client";

import React from "react";
import Link from "next/link";
import type { RecentActivityItem } from "@/lib/dashboard/types";

interface RecentActivityFeedProps {
  activity: RecentActivityItem[];
}

export function RecentActivityFeed({ activity }: RecentActivityFeedProps) {
  if (activity.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm text-center text-slate-500 text-xs">
        No recent activity logged yet.
      </div>
    );
  }

  const getActorBadge = (actorType: string) => {
    switch (actorType) {
      case "PAYPAL":
        return (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">
            PAYPAL
          </span>
        );
      case "CLIENT":
        return (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
            CLIENT
          </span>
        );
      case "PROVIDER":
        return (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800">
            PROVIDER
          </span>
        );
      case "SYSTEM":
      default:
        return (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
            SYSTEM
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <h3 className="text-sm font-bold text-slate-900">Recent Activity</h3>
        <span className="text-[10px] text-slate-400">Live Event Feed</span>
      </div>

      <div className="divide-y divide-slate-100 max-h-[480px] overflow-y-auto pr-1 space-y-2">
        {activity.map((item) => (
          <div key={item.id} className="pt-2 pb-2 text-xs space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-1.5">
                {getActorBadge(item.actorType)}
                <Link
                  href={`/projects/${item.projectId}/timeline`}
                  className="font-bold text-slate-800 hover:text-indigo-600 truncate max-w-[150px]"
                >
                  {item.projectName}
                </Link>
              </div>
              <span className="text-[10px] text-slate-400">{item.formattedTime}</span>
            </div>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              {item.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

