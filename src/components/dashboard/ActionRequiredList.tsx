"use client";

import React from "react";
import Link from "next/link";
import type { ActionRequiredItem } from "@/lib/dashboard/types";

interface ActionRequiredListProps {
  items: ActionRequiredItem[];
}

export function ActionRequiredList({ items }: ActionRequiredListProps) {
  if (items.length === 0) {
    return (
      <div className="bg-emerald-50/60 border border-emerald-200 rounded-2xl p-5 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
            ✓
          </div>
          <div>
            <h4 className="text-xs font-bold text-emerald-950">All Commercial Tasks Caught Up</h4>
            <p className="text-[11px] text-emerald-800">
              No baselines pending confirmation, requests awaiting review, or uninvoiced accepted proposals.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const getSeverityBadge = (severity: "HIGH" | "MEDIUM" | "LOW") => {
    switch (severity) {
      case "HIGH":
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
            Action Urgent
          </span>
        );
      case "MEDIUM":
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
            Action Needed
          </span>
        );
      case "LOW":
      default:
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
            In Progress
          </span>
        );
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold text-slate-900">Action Required</h2>
          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
            {items.length}
          </span>
        </div>
        <span className="text-xs text-slate-500">Items needing provider decision</span>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 shadow-sm overflow-hidden">
        {items.map((item) => (
          <div
            key={item.id}
            className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
          >
            <div className="space-y-1 max-w-xl">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                  {item.projectName}
                </span>
                {getSeverityBadge(item.severity)}
                <h4 className="text-xs font-bold text-slate-900">{item.title}</h4>
              </div>
              <p className="text-xs text-slate-600">{item.description}</p>
            </div>

            <div className="flex-shrink-0">
              <Link
                href={item.href}
                className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg border border-indigo-200 transition-colors"
              >
                <span>Take Action</span>
                <span>→</span>
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

