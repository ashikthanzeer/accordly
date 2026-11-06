"use client";

import React from "react";
import Link from "next/link";
import type { ProjectCardSummary } from "@/lib/dashboard/types";

interface ProjectGridProps {
  projects: ProjectCardSummary[];
}

export function ProjectGrid({ projects }: ProjectGridProps) {
  if (projects.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3">
        <div className="text-3xl">📁</div>
        <h3 className="text-sm font-bold text-slate-800">No Projects Found</h3>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">
          Start your Scope-to-Cash workflow by uploading a client agreement and establishing your first confirmed scope baseline.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900">Active Engagements</h2>
          <p className="text-xs text-slate-500">
            Overview of commercial progress across client projects.
          </p>
        </div>
        <span className="text-xs text-slate-400">
          {projects.length} {projects.length === 1 ? "project" : "projects"}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {projects.map((project) => (
          <div
            key={project.id}
            className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4 hover:border-slate-300 transition-colors flex flex-col justify-between"
          >
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 hover:text-indigo-600 transition-colors">
                    <Link href={`/projects/${project.id}/baseline`}>{project.name}</Link>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Client: <span className="font-semibold text-slate-700">{project.clientName}</span> ({project.clientEmail})
                  </p>
                </div>

                <div>
                  {project.hasConfirmedBaseline ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                      Baseline Confirmed
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                      Baseline Pending
                    </span>
                  )}
                </div>
              </div>

              {/* Scope & Commercial Badges */}
              <div className="flex items-center gap-2 pt-1 flex-wrap text-[11px] text-slate-600">
                <span className="bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg">
                  Requests: <strong className="text-slate-900">{project.requestsCount}</strong>
                </span>
                <span className="bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg">
                  Proposals: <strong className="text-slate-900">{project.proposalsCount}</strong>
                </span>
                {project.activeInvoice && (
                  <span className="bg-blue-50 border border-blue-200 text-blue-900 px-2.5 py-1 rounded-lg">
                    Invoice: <strong className="font-mono text-blue-700">{project.activeInvoice.status}</strong>
                  </span>
                )}
              </div>
            </div>

            {/* Quick Links Footer */}
            <div className="border-t border-slate-100 pt-3 flex items-center justify-between text-xs font-semibold">
              <Link
                href={`/projects/${project.id}/timeline`}
                className="text-slate-500 hover:text-slate-800 transition-colors inline-flex items-center gap-1"
              >
                <span>⏱ Timeline</span>
              </Link>

              <div className="flex items-center gap-2">
                <Link
                  href={`/projects/${project.id}/requests`}
                  className="text-indigo-600 hover:underline"
                >
                  Requests
                </Link>
                <span className="text-slate-300">·</span>
                <Link
                  href={`/projects/${project.id}/proposals`}
                  className="text-indigo-600 hover:underline"
                >
                  Proposals
                </Link>
                <span className="text-slate-300">·</span>
                <Link
                  href={`/projects/${project.id}/baseline`}
                  className="text-indigo-600 hover:underline font-bold"
                >
                  Workspace →
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

