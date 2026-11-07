"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { GlassCard } from "@/components/ui/GlassCard";
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
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#43B581]/15 text-[#43B581] border border-[#43B581]/30">
            Approved
          </span>
        );
      case "SUPERSEDED":
        return (
          <span className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded bg-[#111318] text-[#9298A3] border border-[#292D35]">
            Superseded
          </span>
        );
      case "WITHDRAWN":
        return (
          <span className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded bg-[#E06C75]/15 text-[#E06C75] border border-[#E06C75]/30">
            Withdrawn
          </span>
        );
      case "DRAFT":
      default:
        return (
          <span className="inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded bg-[#E5B45C]/15 text-[#E5B45C] border border-[#E5B45C]/30">
            Draft
          </span>
        );
    }
  };

  return (
    <AppShell
      breadcrumbs={[
        { label: "Dashboard", href: "/" },
        { label: `Project (${projectId.slice(0, 8)}...)`, href: `/projects/${projectId}/baseline` },
        { label: "Change Proposals" },
      ]}
    >
      <div className="space-y-6">
        {/* Workspace Subnavigation Tabs */}
        <div className="flex items-center gap-2 border-b border-[#292D35] pb-3 overflow-x-auto">
          <Link
            href={`/projects/${projectId}/baseline`}
            className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-[#9298A3] hover:text-[#F5F3ED] hover:bg-[#171A20] transition-colors"
          >
            Baseline
          </Link>
          <Link
            href={`/projects/${projectId}/requests`}
            className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-[#9298A3] hover:text-[#F5F3ED] hover:bg-[#171A20] transition-colors"
          >
            Scope Intelligence
          </Link>
          <span className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-[#D4AF65] bg-[#D4AF65]/10 border border-[#D4AF65]/30">
            Proposals
          </span>
          <Link
            href={`/projects/${projectId}/timeline`}
            className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-[#9298A3] hover:text-[#F5F3ED] hover:bg-[#171A20] transition-colors"
          >
            Timeline
          </Link>
        </div>

        {/* Title and Action */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#292D35] pb-5">
          <div>
            <h1 className="text-2xl font-extrabold text-[#F5F3ED] tracking-tight">
              Change Proposals & Pricing
            </h1>
            <p className="text-sm text-[#9298A3] mt-1">
              Commercial proposals generated from client scope requests with deterministic pricing and provider approval.
            </p>
          </div>

          <Link
            href={`/projects/${projectId}/requests`}
            className="inline-flex items-center px-4 py-2 rounded-lg text-xs font-bold text-[#090A0C] bg-[#D4AF65] hover:bg-[#E2C17F] transition-colors shadow-sm"
          >
            + Create Proposal from Request
          </Link>
        </div>

        {isLoading ? (
          <GlassCard intensity="subtle" className="p-10 text-center text-[#9298A3] text-sm font-mono">
            Loading change proposals...
          </GlassCard>
        ) : proposals.length === 0 ? (
          <GlassCard intensity="subtle" className="border-dashed border-[#292D35] p-12 text-center text-[#9298A3] space-y-3">
            <div className="w-12 h-12 mx-auto rounded-full bg-[#D4AF65]/10 text-[#D4AF65] flex items-center justify-center font-bold text-lg border border-[#D4AF65]/30">
              $
            </div>
            <h3 className="text-base font-bold text-[#F5F3ED]">
              No Change Proposals Created Yet
            </h3>
            <p className="text-xs text-[#9298A3] max-w-md mx-auto">
              Analyze a client request under Scope Intelligence, then convert eligible requests (OUT_OF_SCOPE or justified AMBIGUOUS) into a priced proposal.
            </p>
            <div className="pt-2">
              <Link
                href={`/projects/${projectId}/requests`}
                className="inline-flex items-center px-4 py-2 rounded-lg text-xs font-semibold text-[#D4AF65] bg-[#D4AF65]/10 border border-[#D4AF65]/30 hover:bg-[#D4AF65]/20 transition-all hover:scale-[1.01] active:scale-[0.98]"
              >
                Go to Change Requests →
              </Link>
            </div>
          </GlassCard>
        ) : (
          <GlassCard variant="surface" intensity="prominent" className="overflow-hidden">
            <div className="divide-y divide-[#292D35]">
              {proposals.map((prop) => {
                const deliv = prop.deliverables as any;
                const title = deliv?.title || prop.description || "Change Proposal";

                return (
                  <div
                    key={prop.id}
                    className="p-5 flex flex-wrap items-center justify-between gap-4 hover:bg-[#1D2129]/60 transition-colors"
                  >
                    <div className="space-y-1.5 max-w-2xl">
                      <div className="flex items-center gap-2.5">
                        <span className="text-xs font-mono font-bold text-[#D4AF65]">
                          v{prop.version}
                        </span>
                        {getStatusBadge(prop.status)}
                        <span className="text-xs font-mono text-[#9298A3]">
                          {new Date(prop.createdAt).toLocaleDateString()}
                        </span>
                        {prop.changeRequest && (
                          <span className="text-[10px] uppercase font-bold text-[#9298A3] bg-[#111318]/90 border border-[#292D35] px-2 py-0.5 rounded">
                            Req: {prop.changeRequest.classification}
                          </span>
                        )}
                      </div>

                      <h3 className="text-sm font-bold text-[#F5F3ED]">{title}</h3>
                      <p className="text-xs text-[#9298A3] line-clamp-1">
                        {prop.description}
                      </p>
                    </div>

                    <div className="flex items-center gap-5">
                      <div className="text-right">
                        <span className="text-lg font-mono font-extrabold text-[#F5F3ED]">
                          {formatCurrency(Number(prop.amount), prop.currency)}
                        </span>
                        <p className="text-[10px] text-[#D4AF65] uppercase font-semibold font-mono">
                          {prop.currency}
                        </p>
                      </div>

                      <Link
                        href={`/projects/${projectId}/proposals/${prop.id}`}
                        className="inline-flex items-center px-3.5 py-2 rounded-lg text-xs font-semibold text-[#F5F3ED] bg-[#111318]/90 hover:text-[#D4AF65] hover:border-[#D4AF65]/50 transition-all border border-[#292D35] active:scale-[0.98]"
                      >
                        Open Workspace →
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </GlassCard>
        )}
      </div>
    </AppShell>
  );
}
