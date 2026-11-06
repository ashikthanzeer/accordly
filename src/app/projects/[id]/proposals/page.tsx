"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import { formatCurrency } from "@/lib/pricing/calculator";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ProposalsListPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const projectId = resolvedParams.id;

  const [proposals, setProposals] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadProposals() {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/projects/${projectId}/proposals`);
        const data = await res.json();
        if (res.ok && Array.isArray(data.proposals)) {
          setProposals(data.proposals);
        }
      } catch (err) {
        console.error("Error loading proposals:", err);
      } finally {
        setIsLoading(false);
      }
    }

    loadProposals();
  }, [projectId]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "APPROVED":
      case "PROVIDER_APPROVED":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
            Approved
          </span>
        );
      case "SUPERSEDED":
        return (
          <span className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-600">
            Superseded
          </span>
        );
      case "WITHDRAWN":
        return (
          <span className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
            Withdrawn
          </span>
        );
      case "DRAFT":
      default:
        return (
          <span className="inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
            Draft
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
            >
              ← Dashboard
            </Link>
            <span className="text-slate-300">/</span>
            <span className="text-xs font-medium text-slate-600">
              Project: <code className="text-slate-800 font-semibold">{projectId}</code>
            </span>
            <span className="text-slate-300">/</span>
            <span className="text-xs font-bold text-indigo-600">Change Proposals</span>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`/projects/${projectId}/baseline`}
              className="text-xs font-semibold text-slate-600 hover:text-indigo-600 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              Baseline
            </Link>
            <Link
              href={`/projects/${projectId}/requests`}
              className="text-xs font-semibold text-slate-600 hover:text-indigo-600 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              Requests
            </Link>
            <Link
              href={`/projects/${projectId}/timeline`}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-indigo-600 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              <span>⏱️</span> Activity Timeline
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Change Proposals & Pricing
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Commercial proposals generated from client scope requests with deterministic pricing and provider approval.
            </p>
          </div>

          <Link
            href={`/projects/${projectId}/requests`}
            className="inline-flex items-center px-4 py-2 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-sm"
          >
            + Create Proposal from Request
          </Link>
        </div>

        {isLoading ? (
          <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-slate-400 text-sm">
            Loading change proposals...
          </div>
        ) : proposals.length === 0 ? (
          <div className="bg-white border border-dashed border-slate-300 rounded-xl p-12 text-center text-slate-500 space-y-3">
            <div className="w-12 h-12 mx-auto rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-lg">
              $
            </div>
            <h3 className="text-base font-bold text-slate-900">
              No Change Proposals Created Yet
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Analyze a client request under Scope Intelligence, then convert eligible requests (OUT_OF_SCOPE or justified AMBIGUOUS) into a priced proposal.
            </p>
            <div className="pt-2">
              <Link
                href={`/projects/${projectId}/requests`}
                className="inline-flex items-center px-4 py-2 rounded-lg text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors"
              >
                Go to Change Requests →
              </Link>
            </div>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="divide-y divide-slate-100">
              {proposals.map((prop) => {
                const deliv = prop.deliverables as any;
                const title = deliv?.title || prop.description || "Change Proposal";

                return (
                  <div
                    key={prop.id}
                    className="p-5 flex flex-wrap items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors"
                  >
                    <div className="space-y-1.5 max-w-2xl">
                      <div className="flex items-center gap-2.5">
                        <span className="text-xs font-bold text-indigo-600">
                          v{prop.version}
                        </span>
                        {getStatusBadge(prop.status)}
                        <span className="text-xs text-slate-400">
                          {new Date(prop.createdAt).toLocaleDateString()}
                        </span>
                        {prop.changeRequest && (
                          <span className="text-[10px] uppercase font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                            Req: {prop.changeRequest.classification}
                          </span>
                        )}
                      </div>

                      <h3 className="text-sm font-bold text-slate-900">{title}</h3>
                      <p className="text-xs text-slate-600 line-clamp-1">
                        {prop.description}
                      </p>
                    </div>

                    <div className="flex items-center gap-5">
                      <div className="text-right">
                        <span className="text-lg font-extrabold text-slate-900">
                          {formatCurrency(Number(prop.amount), prop.currency)}
                        </span>
                        <p className="text-[10px] text-slate-400 uppercase font-semibold">
                          {prop.currency}
                        </p>
                      </div>

                      <Link
                        href={`/projects/${projectId}/proposals/${prop.id}`}
                        className="inline-flex items-center px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors border border-slate-200"
                      >
                        Open Workspace →
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

