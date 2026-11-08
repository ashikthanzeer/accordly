"use client";

import React from "react";
import Link from "next/link";
import type { ProjectCardSummary } from "@/lib/dashboard/types";
import { GlassCard } from "@/components/ui/GlassCard";

interface ProjectGridProps {
  projects: ProjectCardSummary[];
  onCreateProject?: () => void;
}

export function ProjectGrid({ projects, onCreateProject }: ProjectGridProps) {
  if (projects.length === 0) {
    return (
      <GlassCard intensity="subtle" className="p-8 text-center space-y-4">
        <div className="w-12 h-12 rounded-xl bg-white/[0.04] border border-white/[0.08] text-2xl mx-auto flex items-center justify-center text-[#9298A3] shadow-sm">
          📁
        </div>
        <div className="space-y-1.5">
          <h3 className="text-sm font-bold text-[#F5F3ED]">No Projects Found</h3>
          <p className="text-xs text-[#9298A3] max-w-sm mx-auto leading-relaxed">
            Start your Scope-to-Cash workflow by creating a client project, uploading an agreement, and establishing your confirmed scope baseline.
          </p>
        </div>
        {onCreateProject && (
          <div className="pt-1">
            <button
              type="button"
              onClick={onCreateProject}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-[#090A0C] bg-[#D4AF65] hover:bg-[#E2C17F] hover:shadow-[0_0_16px_rgba(212,175,101,0.35)] transition-all shadow-sm active:scale-95"
            >
              <span>+ Create Project</span>
            </button>
          </div>
        )}
      </GlassCard>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-[#F5F3ED]">Active Engagements</h2>
          <p className="text-xs text-[#9298A3]">
            Commercial overview across active client projects.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-[#9298A3] font-mono">
            {projects.length} {projects.length === 1 ? "project" : "projects"}
          </span>
          {onCreateProject && (
            <button
              type="button"
              onClick={onCreateProject}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-[#D4AF65] hover:text-[#090A0C] bg-[#D4AF65]/10 hover:bg-[#D4AF65] border border-[#D4AF65]/30 transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#D4AF65]"
            >
              <span>+ New Project</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-5">
        {projects.map((project) => (
          <GlassCard
            key={project.id}
            intensity="medium"
            className="p-5 sm:p-6 space-y-4 flex flex-col justify-between transition-all hover:border-white/[0.14]"
          >
            <div className="space-y-3.5">
              {/* Card Header: Responsive Flexbox with Non-Wrapping Badge */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5 sm:gap-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <h3 className="text-sm font-bold text-[#F5F3ED] hover:text-[#D4AF65] transition-colors break-words leading-snug">
                    <Link
                      href={`/projects/${project.id}/baseline`}
                      className="focus-visible:outline-none focus-visible:underline"
                    >
                      {project.name}
                    </Link>
                  </h3>
                  <p className="text-xs text-[#9298A3] leading-relaxed break-words">
                    Client:{" "}
                    <span className="font-semibold text-[#F5F3ED]">
                      {project.clientName}
                    </span>
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

                {/* Status Badge: Non-wrapping, Symmetrical Pill */}
                <div className="shrink-0 self-start pt-0.5">
                  {project.hasConfirmedBaseline ? (
                    <span className="inline-flex items-center whitespace-nowrap shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-full bg-[#43B581]/15 text-[#43B581] border border-[#43B581]/30 shadow-sm leading-none">
                      Baseline Confirmed
                    </span>
                  ) : (
                    <span className="inline-flex items-center whitespace-nowrap shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-full bg-[#E5B45C]/15 text-[#E5B45C] border border-[#E5B45C]/30 shadow-sm leading-none">
                      Baseline Pending
                    </span>
                  )}
                </div>
              </div>

              {/* Scope & Commercial Badges: Standardized Heights & Baseline Alignment */}
              <div className="flex items-center gap-2 pt-0.5 flex-wrap text-[11px]">
                <span className="inline-flex items-center h-6 px-2.5 rounded-lg bg-[#111318]/90 border border-white/[0.08] text-[#9298A3] whitespace-nowrap">
                  <span>Requests:&nbsp;</span>
                  <strong className="text-[#F5F3ED] font-mono">
                    {project.requestsCount}
                  </strong>
                </span>
                <span className="inline-flex items-center h-6 px-2.5 rounded-lg bg-[#111318]/90 border border-white/[0.08] text-[#9298A3] whitespace-nowrap">
                  <span>Proposals:&nbsp;</span>
                  <strong className="text-[#F5F3ED] font-mono">
                    {project.proposalsCount}
                  </strong>
                </span>
                {project.activeInvoice && (
                  <span className="inline-flex items-center h-6 px-2.5 rounded-lg bg-[#D4AF65]/10 border border-[#D4AF65]/30 text-[#D4AF65] whitespace-nowrap shadow-sm">
                    <span>Invoice:&nbsp;</span>
                    <strong className="font-mono text-[#D4AF65]">
                      {project.activeInvoice.status}
                    </strong>
                  </span>
                )}
              </div>
            </div>

            {/* Quick Links Footer: Resilient Navigation with Primary Gold Action */}
            <div className="border-t border-white/[0.08] pt-3.5 flex flex-wrap items-center justify-between gap-y-2 gap-x-3 text-xs font-medium">
              <Link
                href={`/projects/${project.id}/timeline`}
                className="text-[#9298A3] hover:text-[#D4AF65] transition-colors inline-flex items-center gap-1.5 shrink-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#D4AF65] rounded"
              >
                <span aria-hidden="true">⏱</span>
                <span>Timeline</span>
              </Link>

              <div className="flex items-center gap-2.5 shrink-0">
                <Link
                  href={`/projects/${project.id}/requests`}
                  className="text-[#9298A3] hover:text-[#F5F3ED] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/20 rounded"
                >
                  Requests
                </Link>
                <span className="text-white/20 select-none" aria-hidden="true">
                  &bull;
                </span>
                <Link
                  href={`/projects/${project.id}/proposals`}
                  className="text-[#9298A3] hover:text-[#F5F3ED] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/20 rounded"
                >
                  Proposals
                </Link>
                <span className="text-white/20 select-none" aria-hidden="true">
                  &bull;
                </span>
                <Link
                  href={`/projects/${project.id}/baseline`}
                  className="text-[#D4AF65] font-semibold hover:text-[#E2C17F] transition-colors inline-flex items-center gap-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#D4AF65] rounded"
                >
                  <span>Workspace</span>
                  <span aria-hidden="true">&rarr;</span>
                </Link>
              </div>
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}
