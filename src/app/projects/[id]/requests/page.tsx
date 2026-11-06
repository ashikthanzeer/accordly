"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
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
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      case "OUT_OF_SCOPE":
        return "bg-rose-100 text-rose-800 border-rose-200";
      case "AMBIGUOUS":
      default:
        return "bg-amber-100 text-amber-800 border-amber-200";
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16">
      {/* Top Navigation Bar */}
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
            <span className="text-xs font-bold text-indigo-600">Scope Intelligence</span>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`/projects/${projectId}/baseline`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Baseline {baselineVersion ? `(v${baselineVersion})` : ""}
            </Link>
            <Link
              href={`/projects/${projectId}/proposals`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              Proposals
            </Link>
            <Link
              href={`/projects/${projectId}/timeline`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              <span>⏱️</span> Timeline
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
        {/* Page Title & Status */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Change Request Analysis & Scope Intelligence
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Compare client communications against the signed agreement baseline to identify billable scope creep or contract ambiguities.
            </p>
          </div>

          <div>
            {isLoadingStatus ? (
              <span className="text-xs text-slate-400">Loading baseline...</span>
            ) : hasConfirmedBaseline ? (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-semibold text-emerald-800">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Baseline v{baselineVersion} Confirmed & Active
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-xs font-semibold text-amber-800">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                No Confirmed Baseline
              </div>
            )}
          </div>
        </div>

        {/* Error notification if any */}
        {pageError && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-4 text-sm flex items-center justify-between">
            <span>{pageError}</span>
            <button
              onClick={() => setPageError(null)}
              className="text-xs font-semibold underline ml-4"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Baseline Warning Card if missing */}
        {!isLoadingStatus && !hasConfirmedBaseline && (
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-base font-bold text-amber-900">
                Action Required: Confirm Agreement Scope Baseline
              </h2>
              <p className="text-sm text-amber-800">
                Accordly requires an explicitly confirmed scope baseline before running AI scope comparisons. Unconfirmed drafts cannot be used as authoritative contract evidence.
              </p>
            </div>
            <Link
              href={`/projects/${projectId}/baseline`}
              className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 transition-colors shadow-sm whitespace-nowrap"
            >
              Upload & Confirm Baseline →
            </Link>
          </div>
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
              <h2 className="text-lg font-bold text-slate-900">
                Detailed Scope Classification
              </h2>
              <span className="text-xs text-slate-500">
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
            <div className="bg-white border border-dashed border-slate-300 rounded-xl p-10 text-center text-slate-500">
              <svg className="w-10 h-10 mx-auto text-slate-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              <h3 className="text-sm font-semibold text-slate-800">
                No Change Requests Analyzed Yet
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                Paste a client request above or pick one of the preset scenarios to run evidence-based scope comparison.
              </p>
            </div>
          )
        )}

        {/* History of Change Requests */}
        {changeRequests.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Past Change Requests ({changeRequests.length})
                </h3>
                <p className="text-xs text-slate-500">
                  All requests submitted and classified for this project.
                </p>
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {changeRequests.map((req) => {
                const isSelected = activeRequest?.id === req.id;
                const isReviewed = req.analysis?.reviewStatus === "REVIEWED";

                return (
                  <div
                    key={req.id}
                    className={`py-3.5 px-3 rounded-lg flex flex-wrap items-center justify-between gap-3 transition-colors ${
                      isSelected
                        ? "bg-indigo-50/70 border border-indigo-200"
                        : "hover:bg-slate-50"
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
                          <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            Reviewed
                          </span>
                        ) : (
                          <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                            Pending Review
                          </span>
                        )}
                        <span className="text-xs text-slate-400">
                          {new Date(req.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-xs text-slate-700 line-clamp-1 font-mono">
                        {req.sourceText}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setActiveRequest(req)}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
                        isSelected
                          ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      {isSelected ? "Active View" : "View Analysis"}
                    </button>
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
