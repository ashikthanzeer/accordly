"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import type {
  ChangeRequestAnalysisResult,
  ClassificationType,
} from "@/lib/ai/classifier-schema";

interface ChangeRequestAnalysisViewProps {
  changeRequestId: string;
  projectId: string;
  sourceText: string;
  analysis: ChangeRequestAnalysisResult & {
    reviewStatus?: "PENDING_REVIEW" | "REVIEWED";
    reviewedAt?: string | null;
    providerNotes?: string | null;
  };
  onReviewSaved?: (updated: any) => void;
}

export function ChangeRequestAnalysisView({
  changeRequestId,
  projectId,
  sourceText,
  analysis,
  onReviewSaved,
}: ChangeRequestAnalysisViewProps) {
  const router = useRouter();
  const [providerNotes, setProviderNotes] = useState(
    analysis.providerNotes || ""
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [reviewStatus, setReviewStatus] = useState<"PENDING_REVIEW" | "REVIEWED">(
    analysis.reviewStatus || "PENDING_REVIEW"
  );
  const [reviewedAt, setReviewedAt] = useState<string | null | undefined>(
    analysis.reviewedAt
  );

  // Proposal Creation state
  const [isCreatingProposal, setIsCreatingProposal] = useState(false);
  const [commercialJustification, setCommercialJustification] = useState("");
  const [allowInScopeOverride, setAllowInScopeOverride] = useState(false);
  const [proposalError, setProposalError] = useState<string | null>(null);

  const getClassificationBadge = (classification: ClassificationType) => {
    switch (classification) {
      case "IN_SCOPE":
        return {
          label: "In Scope",
          sublabel: "Covered by Confirmed Baseline",
          bg: "bg-emerald-50 border-emerald-300 text-emerald-800",
          pill: "bg-emerald-100 text-emerald-800",
          icon: (
            <svg
              className="w-6 h-6 text-emerald-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          ),
        };
      case "OUT_OF_SCOPE":
        return {
          label: "Out of Scope",
          sublabel: "Explicitly Excluded or Billable Addition",
          bg: "bg-rose-50 border-rose-300 text-rose-800",
          pill: "bg-rose-100 text-rose-800",
          icon: (
            <svg
              className="w-6 h-6 text-rose-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          ),
        };
      case "AMBIGUOUS":
      default:
        return {
          label: "Ambiguous Scope",
          sublabel: "Contract Silent or Requires Clarification",
          bg: "bg-amber-50 border-amber-300 text-amber-800",
          pill: "bg-amber-100 text-amber-800",
          icon: (
            <svg
              className="w-6 h-6 text-amber-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          ),
        };
    }
  };

  const getConfidenceBadge = (confidence: string) => {
    switch (confidence) {
      case "HIGH":
        return "bg-slate-100 text-slate-800 border-slate-300";
      case "MEDIUM":
        return "bg-slate-100 text-slate-700 border-slate-200";
      case "LOW":
      default:
        return "bg-slate-50 text-slate-500 border-slate-200";
    }
  };

  const badge = getClassificationBadge(analysis.classification);

  const handleSaveReview = async () => {
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const res = await fetch(
        `/api/projects/${projectId}/change-requests/${changeRequestId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reviewStatus: "REVIEWED",
            providerNotes,
          }),
        }
      );

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update review status.");
      }

      setReviewStatus("REVIEWED");
      setReviewedAt(new Date().toISOString());
      setSaveSuccess(true);
      if (onReviewSaved) {
        onReviewSaved(data.changeRequest);
      }
    } catch (err: unknown) {
      setSaveError(
        err instanceof Error ? err.message : "Error saving provider review."
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Classification Banner */}
      <div
        className={`border rounded-xl p-6 ${badge.bg} transition-colors shadow-sm`}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-white/70 shadow-sm">{badge.icon}</div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold tracking-tight">
                  {badge.label}
                </span>
                <span
                  className={`text-xs px-2.5 py-0.5 rounded-full border font-semibold ${getConfidenceBadge(
                    analysis.confidence
                  )}`}
                >
                  {analysis.confidence} Confidence
                </span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 font-medium">
                  Baseline v{analysis.baselineVersion}
                </span>
              </div>
              <p className="text-sm opacity-90 mt-0.5">{badge.sublabel}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {reviewStatus === "REVIEWED" ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-600 text-white shadow-sm">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                </svg>
                Reviewed
              </span>
            ) : (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-slate-200 text-slate-800">
                Pending Provider Review
              </span>
            )}
          </div>
        </div>

        {/* Executive Summary & Reasoning */}
        <div className="mt-4 pt-4 border-t border-black/10 space-y-2">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider opacity-75 mb-1">
              Intelligence Summary
            </h4>
            <p className="text-sm leading-relaxed">{analysis.summary}</p>
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider opacity-75 mb-1">
              Detailed Scope Reasoning
            </h4>
            <p className="text-sm leading-relaxed opacity-95">{analysis.reasoning}</p>
          </div>
        </div>
      </div>

      {/* Client Request Context */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
          Original Client Message
        </h3>
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 text-sm text-slate-800 font-mono whitespace-pre-wrap">
          {sourceText}
        </div>
      </div>

      {/* Supporting Evidence Cards */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Contractual Evidence & Source Citations
            </h3>
            <p className="text-xs text-slate-500">
              Clauses retrieved from the signed agreement and confirmed baseline.
            </p>
          </div>
          <span className="text-xs font-medium text-slate-500">
            {analysis.supportingEvidence.length} evidence citation
            {analysis.supportingEvidence.length === 1 ? "" : "s"}
          </span>
        </div>

        {analysis.supportingEvidence.length === 0 ? (
          <p className="text-sm text-slate-500 italic py-2">
            No specific contract clauses directly mention this request (silence in agreement).
          </p>
        ) : (
          <div className="space-y-3">
            {analysis.supportingEvidence.map((ev, idx) => (
              <div
                key={idx}
                className="border border-slate-200 rounded-lg p-4 bg-slate-50/50 space-y-2 hover:border-slate-300 transition-colors"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold uppercase px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                      {ev.category.replace(/_/g, " ")}
                    </span>
                    {ev.page && (
                      <span className="text-xs text-slate-600 font-medium">
                        Page {ev.page}
                      </span>
                    )}
                    {ev.section && (
                      <span className="text-xs text-slate-500">
                        • Section: {ev.section}
                      </span>
                    )}
                  </div>

                  <div>
                    {ev.isVerified ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                        </svg>
                        Verified in Contract
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                        Unverified Quote
                      </span>
                    )}
                  </div>
                </div>

                <blockquote className="border-l-2 border-indigo-400 pl-3 italic text-sm text-slate-700 my-1 bg-white py-1.5 rounded-r">
                  &ldquo;{ev.verbatimExcerpt}&rdquo;
                </blockquote>

                <p className="text-xs text-slate-600">
                  <span className="font-semibold text-slate-700">Relevance:</span>{" "}
                  {ev.relevanceExplanation}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Contradicting Evidence (if any) */}
      {analysis.contradictingEvidence &&
        analysis.contradictingEvidence.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 shadow-sm space-y-3">
            <div className="flex items-center gap-2 text-amber-800 font-bold text-sm">
              <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>Potential Contract Conflicts Detected</span>
            </div>
            <div className="space-y-2">
              {analysis.contradictingEvidence.map((ce, idx) => (
                <div key={idx} className="bg-white border border-amber-200 rounded-lg p-3 text-xs text-slate-700">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-amber-900">{ce.category}</span>
                    {ce.page && <span>Page {ce.page}</span>}
                    {ce.section && <span>• {ce.section}</span>}
                  </div>
                  <p className="text-slate-600 mb-1">
                    <span className="font-medium">Conflict:</span> {ce.relevanceExplanation}
                  </p>
                  <blockquote className="italic border-l-2 border-amber-400 pl-2 text-slate-600">
                    &ldquo;{ce.verbatimExcerpt}&rdquo;
                  </blockquote>
                </div>
              ))}
            </div>
          </div>
        )}

      {/* Clarification & Client Questions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Missing Information */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-slate-400" />
            Missing Information
          </h3>
          {analysis.missingInformation.length === 0 ? (
            <p className="text-xs text-slate-500 italic">None identified.</p>
          ) : (
            <ul className="list-disc list-inside space-y-1 text-xs text-slate-700">
              {analysis.missingInformation.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          )}
        </div>

        {/* Clarification Questions for Client */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-500" />
            Recommended Client Clarification Questions
          </h3>
          {analysis.clarificationQuestions.length === 0 ? (
            <p className="text-xs text-slate-500 italic">No clarification questions needed.</p>
          ) : (
            <ul className="list-disc list-inside space-y-1 text-xs text-slate-700">
              {analysis.clarificationQuestions.map((q, idx) => (
                <li key={idx} className="leading-relaxed">
                  {q}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Provider Review Sign-off & Internal Notes */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
        <div className="border-b border-slate-100 pb-3">
          <h3 className="text-base font-bold text-slate-900">
            Provider Review & Sign-Off
          </h3>
          <p className="text-xs text-slate-500">
            Confirm your assessment of this change request and record internal notes before creating a change order.
          </p>
        </div>

        {saveSuccess && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg p-3 text-sm flex items-center gap-2">
            <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
            Review sign-off saved successfully.
            {reviewedAt && (
              <span className="text-xs text-emerald-700 ml-auto">
                {new Date(reviewedAt).toLocaleString()}
              </span>
            )}
          </div>
        )}

        {saveError && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-lg p-3 text-sm">
            {saveError}
          </div>
        )}

        <div>
          <label
            htmlFor="providerNotes"
            className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1"
          >
            Internal Provider Notes (Optional)
          </label>
          <textarea
            id="providerNotes"
            rows={3}
            value={providerNotes}
            onChange={(e) => setProviderNotes(e.target.value)}
            placeholder="Add internal notes on client communication, commercial impact, or rationale..."
            className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center justify-between pt-2">
          <div className="text-xs text-slate-500">
            {reviewStatus === "REVIEWED" && reviewedAt ? (
              <span>Last reviewed: {new Date(reviewedAt).toLocaleString()}</span>
            ) : (
              <span>Status: Awaiting provider sign-off</span>
            )}
          </div>

          <button
            type="button"
            disabled={isSaving}
            onClick={handleSaveReview}
            className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 transition-colors shadow-sm"
          >
            {isSaving ? "Saving Sign-off..." : "Mark as Reviewed"}
          </button>
        </div>
      </div>

      {/* Commercial Decision & Change Proposal Generation */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-900/50 rounded-xl p-6 text-white shadow-md space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              Commercial Action: Change Proposal & Pricing
            </h3>
            <p className="text-xs text-slate-300 mt-0.5">
              Turn this analyzed change request into a structured, priced commercial proposal.
            </p>
          </div>

          <span className="text-xs font-semibold px-2.5 py-1 rounded bg-white/10 text-slate-200">
            Status: {analysis.classification}
          </span>
        </div>

        {proposalError && (
          <div className="bg-rose-950/80 border border-rose-500/50 text-rose-200 rounded-lg p-3 text-xs">
            {proposalError}
          </div>
        )}

        {/* IN_SCOPE Guardrail */}
        {analysis.classification === "IN_SCOPE" && !allowInScopeOverride && (
          <div className="bg-amber-950/40 border border-amber-500/40 rounded-lg p-3.5 text-xs text-amber-200 space-y-2">
            <p className="font-semibold text-amber-100">
              In-Scope Protection Active:
            </p>
            <p>
              This request was classified as IN_SCOPE (already included in the signed contract baseline).
              Accordly blocks automatic billable proposal creation to protect client trust and prevent double billing.
            </p>
            <label className="flex items-center gap-2 text-slate-300 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={allowInScopeOverride}
                onChange={(e) => setAllowInScopeOverride(e.target.checked)}
                className="rounded border-slate-700 text-indigo-500 focus:ring-indigo-400"
              />
              <span>Allow provider override (e.g. for a zero-cost scope clarification)</span>
            </label>
          </div>
        )}

        {/* AMBIGUOUS Commercial Justification */}
        {analysis.classification === "AMBIGUOUS" && (
          <div className="bg-slate-800/80 border border-slate-700 rounded-lg p-3.5 space-y-2 text-xs">
            <label className="block font-semibold text-slate-200">
              Provider Commercial Justification Required (Minimum 10 chars):
            </label>
            <p className="text-slate-400">
              The baseline agreement is silent or ambiguous on this work. Explain why this work warrants a paid change proposal:
            </p>
            <input
              type="text"
              value={commercialJustification}
              onChange={(e) => setCommercialJustification(e.target.value)}
              placeholder="e.g. Chatbot requires external third-party API and custom dataset embeddings not contemplated in initial agreement."
              className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white placeholder-slate-500 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
            />
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <p className="text-[11px] text-slate-400 max-w-lg">
            Generating a proposal will launch the interactive pricing workspace where you can review AI deliverables, edit hours and rates, and explicitly approve the proposal.
          </p>

          <button
            type="button"
            disabled={
              isCreatingProposal ||
              (analysis.classification === "IN_SCOPE" && !allowInScopeOverride) ||
              (analysis.classification === "AMBIGUOUS" && commercialJustification.trim().length < 10)
            }
            onClick={async () => {
              setIsCreatingProposal(true);
              setProposalError(null);
              try {
                const res = await fetch(`/api/projects/${projectId}/proposals`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    changeRequestId,
                    providerJustification: commercialJustification,
                    allowInScopeOverride,
                  }),
                });
                const data = await res.json();
                if (!res.ok) {
                  throw new Error(data.error || "Failed to create change proposal.");
                }
                router.push(`/projects/${projectId}/proposals/${data.proposal.id}`);
              } catch (err: unknown) {
                setProposalError(err instanceof Error ? err.message : "Error creating proposal");
              } finally {
                setIsCreatingProposal(false);
              }
            }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
          >
            {isCreatingProposal ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Drafting Proposal...
              </>
            ) : (
              "Generate Change Proposal & Pricing →"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
