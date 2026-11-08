"use client";

import React, { useState } from "react";
import Link from "next/link";
import { GlassCard } from "@/components/ui/GlassCard";
import type { ArchivedProjectDetailDto } from "@/lib/projects/schema";

interface ArchivedProjectGridProps {
  projects: ArchivedProjectDetailDto[];
  isLoading?: boolean;
  onProjectRestored?: (projectId: string) => void;
}

export function ArchivedProjectGrid({
  projects,
  isLoading = false,
  onProjectRestored,
}: ArchivedProjectGridProps) {
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleRestore = async (projectId: string, projectName: string) => {
    setRestoringId(projectId);
    setActionError(null);

    try {
      const res = await fetch(`/api/projects/${projectId}/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Failed to restore project "${projectName}".`);
      }

      if (onProjectRestored) {
        onProjectRestored(projectId);
      }
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setRestoringId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="py-12 text-center text-[#9298A3] text-xs space-y-2">
        <div className="w-5 h-5 rounded-full border-2 border-[#D4AF65]/30 border-t-[#D4AF65] animate-spin mx-auto" />
        <p>Loading archived project repository...</p>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <GlassCard intensity="subtle" className="p-8 text-center space-y-3">
        <div className="w-12 h-12 rounded-xl bg-white/[0.04] border border-white/[0.08] text-2xl mx-auto flex items-center justify-center text-[#9298A3] shadow-sm">
          📦
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-[#F5F3ED]">No Archived Projects</h3>
          <p className="text-xs text-[#9298A3] max-w-sm mx-auto leading-relaxed">
            All your engagements are currently active. When projects reach commercial completion, archiving preserves their complete history indefinitely.
          </p>
        </div>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-4">
      {actionError && (
        <div className="p-3 bg-[#E06C75]/15 border border-[#E06C75]/30 rounded-xl text-xs text-[#E06C75] flex items-center justify-between">
          <span>{actionError}</span>
          <button
            onClick={() => setActionError(null)}
            className="text-[#E06C75] hover:text-white font-bold ml-3"
          >
            ✕
          </button>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-[#F5F3ED]">Archived Repository</h2>
          <p className="text-xs text-[#9298A3]">
            Historical engagements with preserved commercial, scope, and payment records.
          </p>
        </div>
        <span className="text-xs text-[#9298A3] font-mono">
          {projects.length} {projects.length === 1 ? "archived engagement" : "archived engagements"}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-5">
        {projects.map((project) => {
          const financial = project.financialSummary;
          const formattedArchivedDate = project.archivedAt
            ? new Date(project.archivedAt).toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
              })
            : "Archived";

          const isRestoringThis = restoringId === project.id;

          return (
            <GlassCard
              key={project.id}
              intensity="medium"
              className="p-5 sm:p-6 space-y-4 flex flex-col justify-between border-white/[0.08] hover:border-white/[0.14] transition-all opacity-90 hover:opacity-100"
            >
              <div className="space-y-3.5">
                {/* Header with Title and ARCHIVED Badge */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5 sm:gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <h3 className="text-sm font-bold text-[#F5F3ED] hover:text-[#D4AF65] transition-colors break-words leading-snug">
                      <Link
                        href={`/projects/${project.id}/timeline`}
                        className="focus-visible:outline-none focus-visible:underline"
                      >
                        {project.name}
                      </Link>
                    </h3>
                    <p className="text-xs text-[#9298A3] leading-relaxed break-words">
                      Client: <span className="font-semibold text-[#F5F3ED]">{project.clientName}</span>
                      {project.clientEmail ? (
                        <>
                          {" "}
                          <span className="font-mono text-[11px] text-[#9298A3]">
                            ({project.clientEmail})
                          </span>
                        </>
                      ) : null}
                    </p>
                  </div>

                  {/* Badges: Non-wrapping ARCHIVED badge + Date */}
                  <div className="shrink-0 flex items-center gap-2 self-start pt-0.5">
                    <span className="inline-flex items-center whitespace-nowrap shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-full bg-[#9298A3]/15 text-[#9298A3] border border-[#9298A3]/30 shadow-sm leading-none">
                      ARCHIVED
                    </span>
                  </div>
                </div>

                {/* Archival metadata timestamp */}
                <div className="text-[11px] text-[#9298A3] font-mono flex items-center gap-1.5">
                  <span className="select-none">📅</span>
                  <span>Archived on {formattedArchivedDate}</span>
                </div>

                {/* Financial Summary Badges */}
                <div className="p-3 rounded-xl bg-black/40 border border-white/[0.06] space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[#9298A3] uppercase tracking-wider font-mono">
                      Commercial Record
                    </span>
                    {financial?.hasPaymentActivity ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#43B581] bg-[#43B581]/10 px-2 py-0.5 rounded-full border border-[#43B581]/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#43B581]" />
                        Payment Recorded
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-[10px] text-[#9298A3] bg-white/[0.04] px-2 py-0.5 rounded-full border border-white/[0.08]">
                        No Payments Recorded
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center pt-1 font-mono text-[11px]">
                    <div className="p-1.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                      <span className="text-[9px] uppercase tracking-wider text-[#9298A3] block">Invoiced</span>
                      <strong className="text-[#F5F3ED] text-xs">
                        {financial?.formattedTotalInvoiced || "$0.00"}
                      </strong>
                    </div>
                    <div className="p-1.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                      <span className="text-[9px] uppercase tracking-wider text-[#9298A3] block">Collected</span>
                      <strong className="text-[#43B581] text-xs">
                        {financial?.formattedTotalCollected || "$0.00"}
                      </strong>
                    </div>
                    <div className="p-1.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                      <span className="text-[9px] uppercase tracking-wider text-[#9298A3] block">Outstanding</span>
                      <strong
                        className={`text-xs ${
                          (financial?.totalOutstanding || 0) > 0 ? "text-[#E5B45C]" : "text-[#9298A3]"
                        }`}
                      >
                        {financial?.formattedTotalOutstanding || "$0.00"}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer Actions: Restore Project + Read-Only Links */}
              <div className="border-t border-white/[0.08] pt-3.5 flex flex-wrap items-center justify-between gap-y-2 gap-x-3 text-xs font-medium">
                <button
                  type="button"
                  onClick={() => handleRestore(project.id, project.name)}
                  disabled={isRestoringThis}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-[#D4AF65] hover:text-[#090A0C] bg-[#D4AF65]/10 hover:bg-[#D4AF65] border border-[#D4AF65]/30 transition-all disabled:opacity-50 active:scale-95 shadow-sm"
                >
                  <span aria-hidden="true">↺</span>
                  <span>{isRestoringThis ? "Restoring..." : "Restore Project"}</span>
                </button>

                <div className="flex items-center gap-2.5 shrink-0 text-xs">
                  <Link
                    href={`/projects/${project.id}/timeline`}
                    className="text-[#9298A3] hover:text-[#D4AF65] transition-colors"
                  >
                    Timeline
                  </Link>
                  <span className="text-white/20 select-none">&bull;</span>
                  <Link
                    href={`/projects/${project.id}/baseline`}
                    className="text-[#9298A3] hover:text-[#F5F3ED] transition-colors"
                  >
                    Baseline
                  </Link>
                  <span className="text-white/20 select-none">&bull;</span>
                  <Link
                    href={`/projects/${project.id}/proposals`}
                    className="text-[#9298A3] hover:text-[#F5F3ED] transition-colors"
                  >
                    Proposals
                  </Link>
                </div>
              </div>
            </GlassCard>
          );
        })}
      </div>
    </div>
  );
}

