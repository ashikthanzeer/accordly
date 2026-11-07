"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { GlassCard } from "@/components/ui/GlassCard";
import { ChangeRequestForm } from "@/components/requests/ChangeRequestForm";
import { ChangeRequestAnalysisView } from "@/components/requests/ChangeRequestAnalysisView";
import type { ChangeRequestAnalysisResult } from "@/lib/ai/classifier-schema";

interface PageProps {
  params: Promise<{ id: string }>;
}

interface StoredChangeRequest {
  id: string;
  projectId: string;
  sourceText: string;
  classification: "IN_SCOPE" | "OUT_OF_SCOPE" | "AMBIGUOUS";
  analysis: ChangeRequestAnalysisResult & {
    reviewStatus?: "PENDING_REVIEW" | "REVIEWED";
    reviewedAt?: string | null;
    providerNotes?: string | null;
    baselineVersion?: number;
  };
  analysisModel?: string;
  promptVersion?: string;
  createdAt: string;
}

export default function ProjectRequestsPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const projectId = resolvedParams.id;

  const [hasConfirmedBaseline, setHasConfirmedBaseline] = useState<boolean>(false);
  const [baselineVersion, setBaselineVersion] = useState<number | undefined>(undefined);
  const [isLoadingStatus, setIsLoadingStatus] = useState<boolean>(true);
  const [changeRequests, setChangeRequests] = useState<StoredChangeRequest[]>([]);
  const [activeRequest, setActiveRequest] = useState<StoredChangeRequest | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [pageError, setPageError] = useState<string | null>(null);

  // Load baseline status and past requests on mount
  useEffect(() => {
    async function loadData() {
      setIsLoadingStatus(true);
      try {
        // 1. Check baseline status
        const baselineRes = await fetch(`/api/projects/${projectId}/baseline`);
        const baselineData = await baselineRes.json();

        if (baselineData.hasConfirmedBaseline && baselineData.baseline) {
          setHasConfirmedBaseline(true);
          setBaselineVersion(baselineData.baseline.version || 1);
        } else {
          setHasConfirmedBaseline(false);
        }

        // 2. Fetch past change requests
        const requestsRes = await fetch(`/api/projects/${projectId}/change-requests`);
        const requestsData = await requestsRes.json();

        if (requestsRes.ok && Array.isArray(requestsData.changeRequests)) {
          setChangeRequests(requestsData.changeRequests);
          if (requestsData.changeRequests.length > 0) {
            setActiveRequest(requestsData.changeRequests[0]);
          }
        }
      } catch (err: unknown) {
        console.error("Failed to load project request state:", err);
        setPageError(err instanceof Error ? err.message : "Error loading data");
      } finally {
        setIsLoadingStatus(false);
      }
    }

    loadData();
  }, [projectId]);

  const handleSubmitRequest = async (requestText: string) => {
    setIsSubmitting(true);
    setPageError(null);

    try {
      const res = await fetch(`/api/projects/${projectId}/change-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestText }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to analyze change request.");
      }

      const newRecord: StoredChangeRequest = {
        id: data.changeRequest.id,
        projectId,
        sourceText: data.changeRequest.sourceText,
        classification: data.changeRequest.classification,
        analysis: data.changeRequest.analysis,
        createdAt: data.changeRequest.createdAt,
      };

      setChangeRequests((prev) => [newRecord, ...prev]);
      setActiveRequest(newRecord);
    } catch (err: unknown) {
      setPageError(err instanceof Error ? err.message : "Analysis submission failed.");
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReviewSaved = (updatedRecord: StoredChangeRequest) => {
    setChangeRequests((prev) =>
      prev.map((item) => (item.id === updatedRecord.id ? updatedRecord : item))
    );
    if (activeRequest?.id === updatedRecord.id) {
      setActiveRequest(updatedRecord);
    }
  };

  const getBadgeStyle = (classification: string) => {
    switch (classification) {
      case "IN_SCOPE":
        return "bg-[#43B581]/15 text-[#43B581] border-[#43B581]/30";
      case "OUT_OF_SCOPE":
        return "bg-[#E06C75]/15 text-[#E06C75] border-[#E06C75]/30";
      case "AMBIGUOUS":
      default:
        return "bg-[#E5B45C]/15 text-[#E5B45C] border-[#E5B45C]/30";
    }
  };

  return (
    <AppShell
      breadcrumbs={[
        { label: "Dashboard", href: "/" },
        { label: `Project (${projectId.slice(0, 8)}...)`, href: `/projects/${projectId}/baseline` },
        { label: "Scope Intelligence" },
      ]}
    >
      <div className="space-y-8">
        {/* Workspace Subnavigation Tabs */}
        <div className="flex items-center gap-2 border-b border-[#292D35] pb-3 overflow-x-auto">
          <Link
            href={`/projects/${projectId}/baseline`}
            className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-[#9298A3] hover:text-[#F5F3ED] hover:bg-[#171A20] transition-colors"
          >
            Baseline {baselineVersion ? `(v${baselineVersion})` : ""}
          </Link>
          <span className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-[#D4AF65] bg-[#D4AF65]/10 border border-[#D4AF65]/30">
            Scope Intelligence
          </span>
          <Link
            href={`/projects/${projectId}/proposals`}
            className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-[#9298A3] hover:text-[#F5F3ED] hover:bg-[#171A20] transition-colors"
          >
            Proposals
          </Link>
          <Link
            href={`/projects/${projectId}/timeline`}
            className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-[#9298A3] hover:text-[#F5F3ED] hover:bg-[#171A20] transition-colors"
          >
            Timeline
          </Link>
        </div>

        {/* Page Title & Status */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#292D35] pb-5">
          <div>
            <h1 className="text-2xl font-extrabold text-[#F5F3ED] tracking-tight">
              Change Request Analysis & Scope Intelligence
            </h1>
            <p className="text-sm text-[#9298A3] mt-1">
              Compare client communications against the signed agreement baseline to identify billable scope creep or contract ambiguities.
            </p>
          </div>

          <div>
            {isLoadingStatus ? (
              <span className="text-xs text-[#9298A3] font-mono">Loading baseline status...</span>
            ) : hasConfirmedBaseline ? (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-[#43B581]/10 border border-[#43B581]/30 rounded-lg text-xs font-semibold text-[#43B581]">
                <span className="w-2 h-2 rounded-full bg-[#43B581] animate-pulse" />
                Baseline v{baselineVersion} Confirmed & Active
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-[#E5B45C]/10 border border-[#E5B45C]/30 rounded-lg text-xs font-semibold text-[#E5B45C]">
                <span className="w-2 h-2 rounded-full bg-[#E5B45C]" />
                No Confirmed Baseline
              </div>
            )}
          </div>
        </div>

        {/* Error notification if any */}
        {pageError && (
          <div className="bg-[#E06C75]/10 border border-[#E06C75]/30 text-[#E06C75] rounded-xl p-4 text-sm flex items-center justify-between">
            <span>{pageError}</span>
            <button
              onClick={() => setPageError(null)}
              className="text-xs font-semibold underline ml-4 hover:text-[#F5F3ED]"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Baseline Warning Card if missing */}
        {!isLoadingStatus && !hasConfirmedBaseline && (
          <GlassCard
            variant="surface"
            intensity="prominent"
            className="border-[#E5B45C]/40 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
          >
            <div className="space-y-1">
              <h2 className="text-base font-bold text-[#E5B45C] flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#E5B45C]" />
                Action Required: Confirm Agreement Scope Baseline
              </h2>
              <p className="text-sm text-[#9298A3]">
                Accordly requires an explicitly confirmed scope baseline before running AI scope comparisons. Unconfirmed drafts cannot be used as authoritative contract evidence.
              </p>
            </div>
            <Link
              href={`/projects/${projectId}/baseline`}
              className="inline-flex items-center px-4 py-2 rounded-lg text-xs font-bold text-[#090A0C] bg-[#D4AF65] hover:bg-[#E2C17F] transition-all shadow-sm whitespace-nowrap active:scale-[0.98]"
            >
              Upload & Confirm Baseline →
            </Link>
          </GlassCard>
        )}

        {/* Change Request Submission Form */}
        <ChangeRequestForm
          onSubmit={handleSubmitRequest}
          isLoading={isSubmitting}
          hasConfirmedBaseline={hasConfirmedBaseline}
          baselineVersion={baselineVersion}
        />

        {/* Active Analysis View */}
        {activeRequest ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#F5F3ED]">
                Detailed Scope Classification
              </h2>
              <span className="text-xs text-[#9298A3] font-mono">
                Analyzed on {new Date(activeRequest.createdAt).toLocaleString()}
              </span>
            </div>

            <ChangeRequestAnalysisView
              changeRequestId={activeRequest.id}
              projectId={projectId}
              sourceText={activeRequest.sourceText}
              analysis={activeRequest.analysis}
              onReviewSaved={handleReviewSaved}
            />
          </div>
        ) : (
          !isLoadingStatus &&
          changeRequests.length === 0 && (
            <GlassCard
              variant="default"
              intensity="subtle"
              className="border-dashed border-[#292D35] p-10 text-center text-[#9298A3]"
            >
              <svg className="w-10 h-10 mx-auto text-[#9298A3]/50 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              <h3 className="text-sm font-semibold text-[#F5F3ED]">
                No Change Requests Analyzed Yet
              </h3>
              <p className="text-xs text-[#9298A3] max-w-sm mx-auto mt-1">
                Paste a client request above or pick one of the preset scenarios to run evidence-based scope comparison.
              </p>
            </GlassCard>
          )
        )}

        {/* History of Change Requests */}
        {changeRequests.length > 0 && (
          <GlassCard
            variant="surface"
            intensity="prominent"
            className="p-6 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-[#292D35] pb-3">
              <div>
                <h3 className="text-base font-bold text-[#F5F3ED]">
                  Past Change Requests ({changeRequests.length})
                </h3>
                <p className="text-xs text-[#9298A3]">
                  All requests submitted and classified for this project.
                </p>
              </div>
            </div>

            <div className="divide-y divide-[#292D35]">
              {changeRequests.map((req) => {
                const isSelected = activeRequest?.id === req.id;
                const isReviewed = req.analysis?.reviewStatus === "REVIEWED";

                return (
                  <div
                    key={req.id}
                    className={`py-3.5 px-3 rounded-lg flex flex-wrap items-center justify-between gap-3 transition-all ${
                      isSelected
                        ? "bg-[#1D2129]/80 border border-[#D4AF65]/40 shadow-sm"
                        : "hover:bg-[#111318]/60"
                    }`}
                  >
                    <div className="space-y-1 max-w-2xl">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${getBadgeStyle(
                            req.classification
                          )}`}
                        >
                          {req.classification}
                        </span>
                        {isReviewed ? (
                          <span className="text-[11px] font-semibold text-[#43B581] bg-[#43B581]/10 px-2 py-0.5 rounded border border-[#43B581]/30">
                            Reviewed
                          </span>
                        ) : (
                          <span className="text-[11px] font-medium text-[#9298A3] bg-[#111318] px-2 py-0.5 rounded border border-[#292D35]">
                            Pending Review
                          </span>
                        )}
                        <span className="text-xs text-[#9298A3] font-mono">
                          {new Date(req.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-xs text-[#F5F3ED]/80 line-clamp-1 font-mono">
                        {req.sourceText}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setActiveRequest(req)}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all active:scale-[0.98] ${
                        isSelected
                          ? "bg-[#D4AF65] text-[#090A0C] border-[#D4AF65] shadow-sm shadow-[#D4AF65]/20 font-bold"
                          : "bg-[#111318]/80 text-[#9298A3] border-[#292D35] hover:text-[#F5F3ED] hover:border-[#D4AF65]/40"
                      }`}
                    >
                      {isSelected ? "Active View" : "View Analysis"}
                    </button>
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
