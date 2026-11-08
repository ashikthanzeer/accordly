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
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-[#D4AF65] hover:text-[#090A0C] bg-[#D4AF65]/10 hover:bg-[#D4AF65] border border-[#D4AF65]/30 transition-all"
            >
              <span>+ New Project</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {projects.map((project) => (
          <GlassCard
            key={project.id}
            intensity="medium"
            className="p-5 space-y-4 flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-[#F5F3ED] hover:text-[#D4AF65] transition-colors">
                    <Link href={`/projects/${project.id}/baseline`}>{project.name}</Link>
                  </h3>
                  <p className="text-xs text-[#9298A3] mt-0.5">
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

                <div>
                  {project.hasConfirmedBaseline ? (
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-[#43B581]/15 text-[#43B581] border border-[#43B581]/30 shadow-sm">
                      Baseline Confirmed
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-[#E5B45C]/15 text-[#E5B45C] border border-[#E5B45C]/30 shadow-sm">
                      Baseline Pending
                    </span>
                  )}
                </div>
              </div>

              {/* Scope & Commercial Badges */}
              <div className="flex items-center gap-2 pt-1 flex-wrap text-[11px] text-[#9298A3]">
                <span className="bg-[#111318]/90 border border-white/[0.08] px-2.5 py-1 rounded-lg">
                  Requests: <strong className="text-[#F5F3ED] font-mono">{project.requestsCount}</strong>
                </span>
                <span className="bg-[#111318]/90 border border-white/[0.08] px-2.5 py-1 rounded-lg">
                  Proposals: <strong className="text-[#F5F3ED] font-mono">{project.proposalsCount}</strong>
                </span>
                {project.activeInvoice && (
                  <span className="bg-[#D4AF65]/10 border border-[#D4AF65]/30 text-[#D4AF65] px-2.5 py-1 rounded-lg shadow-sm">
                    Invoice: <strong className="font-mono text-[#D4AF65]">{project.activeInvoice.status}</strong>
                  </span>
                )}
              </div>
            </div>

            {/* Quick Links Footer */}
            <div className="border-t border-white/[0.08] pt-3 flex items-center justify-between text-xs font-semibold">
              <Link
                href={`/projects/${project.id}/timeline`}
                className="text-[#9298A3] hover:text-[#D4AF65] transition-colors inline-flex items-center gap-1.5"
              >
                <span>⏱ Timeline</span>
              </Link>

              <div className="flex items-center gap-2">
                <Link
                  href={`/projects/${project.id}/requests`}
                  className="text-[#9298A3] hover:text-[#F5F3ED] transition-colors"
                >
                  Requests
                </Link>
                <span className="text-[#292D35]">&bull;</span>
                <Link
                  href={`/projects/${project.id}/proposals`}
                  className="text-[#9298A3] hover:text-[#F5F3ED] transition-colors"
                >
                  Proposals
                </Link>
                <span className="text-[#292D35]">&bull;</span>
                <Link
                  href={`/projects/${project.id}/baseline`}
                  className="text-[#D4AF65] hover:text-[#E2C17F] transition-colors"
                >
                  Workspace &rarr;
                </Link>
              </div>
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}
