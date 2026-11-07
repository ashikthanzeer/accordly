"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { GlassCard } from "@/components/ui/GlassCard";
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
          sublabel: "Covered by Confirmed Baseline Agreement",
          bg: "bg-[#43B581]/10 border-[#43B581]/30 text-[#43B581]",
          pill: "bg-[#43B581]/20 text-[#43B581] border-[#43B581]/40",
          icon: (
            <svg
              className="w-6 h-6 text-[#43B581]"
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
          sublabel: "Explicitly Excluded or Billable Expansion",
          bg: "bg-[#E06C75]/10 border-[#E06C75]/30 text-[#E06C75]",
          pill: "bg-[#E06C75]/20 text-[#E06C75] border-[#E06C75]/40",
          icon: (
            <svg
              className="w-6 h-6 text-[#E06C75]"
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
          bg: "bg-[#E5B45C]/10 border-[#E5B45C]/30 text-[#E5B45C]",
          pill: "bg-[#E5B45C]/20 text-[#E5B45C] border-[#E5B45C]/40",
          icon: (
            <svg
              className="w-6 h-6 text-[#E5B45C]"
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
        return "bg-[#171A20] text-[#D4AF65] border-[#D4AF65]/30";
      case "MEDIUM":
        return "bg-[#171A20] text-[#F5F3ED] border-[#292D35]";
      case "LOW":
      default:
        return "bg-[#111318] text-[#9298A3] border-[#292D35]";
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
        className={`border rounded-2xl p-6 ${badge.bg} transition-all backdrop-blur-md relative overflow-hidden shadow-sm`}
      >
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent pointer-events-none" />
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-[#111318]/80 border border-[#292D35]">
              {badge.icon}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
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
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#111318] text-[#9298A3] border border-[#292D35] font-mono">
                  Baseline v{analysis.baselineVersion}
                </span>
              </div>
              <p className="text-sm opacity-90 mt-1">{badge.sublabel}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {reviewStatus === "REVIEWED" ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#43B581]/20 text-[#43B581] border border-[#43B581]/30">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                </svg>
                Reviewed
              </span>
            ) : (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-[#1D2129] text-[#9298A3] border border-[#292D35]">
                Pending Provider Review
              </span>
            )}
          </div>
        </div>

        {/* Executive Summary & Reasoning */}
        <div className="mt-5 pt-4 border-t border-[#292D35]/50 space-y-3">
          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#9298A3] mb-1">
              Intelligence Summary
            </h4>
            <p className="text-sm leading-relaxed text-[#F5F3ED]">{analysis.summary}</p>
          </div>
          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#9298A3] mb-1">
              Detailed Scope Reasoning
            </h4>
            <p className="text-sm leading-relaxed text-[#F5F3ED]/90">{analysis.reasoning}</p>
          </div>
        </div>
      </div>

      {/* Client Request Context */}
      <GlassCard variant="surface" intensity="subtle" className="p-5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#9298A3] mb-2 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF65]" />
          Original Client Message
        </h3>
        <div className="bg-[#090A0C]/90 border border-[#292D35] rounded-lg p-3.5 text-sm text-[#F5F3ED] font-mono whitespace-pre-wrap">
          {sourceText}
        </div>
      </GlassCard>

      {/* Supporting Evidence Cards */}
      <GlassCard variant="surface" intensity="prominent" className="p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-[#292D35] pb-3">
          <div>
            <h3 className="text-base font-bold text-[#F5F3ED]">
              Contractual Evidence & Source Citations
            </h3>
            <p className="text-xs text-[#9298A3]">
              Clauses retrieved from the signed agreement and confirmed baseline.
            </p>
          </div>
          <span className="text-xs font-mono text-[#D4AF65]">
            {analysis.supportingEvidence.length} citation
            {analysis.supportingEvidence.length === 1 ? "" : "s"}
          </span>
        </div>

        {analysis.supportingEvidence.length === 0 ? (
          <p className="text-sm text-[#9298A3] italic py-2">
            No specific contract clauses directly mention this request (silence in agreement).
          </p>
        ) : (
          <div className="space-y-3">
            {analysis.supportingEvidence.map((ev, idx) => (
              <div
                key={idx}
                className="border border-[#292D35] rounded-lg p-4 bg-[#111318]/70 hover:bg-[#111318] space-y-2 hover:border-[#D4AF65]/40 transition-all"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold uppercase px-2 py-0.5 rounded bg-[#D4AF65]/10 text-[#D4AF65] border border-[#D4AF65]/30">
                      {ev.category.replace(/_/g, " ")}
                    </span>
                    {ev.page && (
                      <span className="text-xs text-[#9298A3] font-medium">
                        Page {ev.page}
                      </span>
                    )}
                    {ev.section && (
                      <span className="text-xs text-[#9298A3]">
                        • Section: {ev.section}
                      </span>
                    )}
                  </div>

                  <div>
                    {ev.isVerified ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#43B581] bg-[#43B581]/10 border border-[#43B581]/30 px-2 py-0.5 rounded-full">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                        </svg>
                        Verified in Contract
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#E5B45C] bg-[#E5B45C]/10 border border-[#E5B45C]/30 px-2 py-0.5 rounded-full">
                        Unverified Quote
                      </span>
                    )}
                  </div>
                </div>

                <blockquote className="border-l-2 border-[#D4AF65] pl-3 italic text-sm text-[#F5F3ED] my-1 bg-[#090A0C]/80 py-2 rounded-r">
                  &ldquo;{ev.verbatimExcerpt}&rdquo;
                </blockquote>

                <p className="text-xs text-[#9298A3]">
                  <span className="font-semibold text-[#F5F3ED]">Relevance:</span>{" "}
                  {ev.relevanceExplanation}
                </p>
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      {/* Contradicting Evidence (if any) */}
      {analysis.contradictingEvidence &&
        analysis.contradictingEvidence.length > 0 && (
          <GlassCard variant="surface" intensity="subtle" className="border-[#E5B45C]/30 p-5 space-y-3 bg-[#E5B45C]/5">
            <div className="flex items-center gap-2 text-[#E5B45C] font-bold text-sm">
              <svg className="w-5 h-5 text-[#E5B45C]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>Potential Contract Conflicts Detected</span>
            </div>
            <div className="space-y-2">
              {analysis.contradictingEvidence.map((ce, idx) => (
                <div key={idx} className="bg-[#171A20] border border-[#E5B45C]/30 rounded-lg p-3 text-xs text-[#F5F3ED]">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-[#E5B45C]">{ce.category}</span>
                    {ce.page && <span className="text-[#9298A3]">Page {ce.page}</span>}
                    {ce.section && <span className="text-[#9298A3]">• {ce.section}</span>}
                  </div>
                  <p className="text-[#9298A3] mb-1">
                    <span className="font-medium text-[#F5F3ED]">Conflict:</span> {ce.relevanceExplanation}
                  </p>
                  <blockquote className="italic border-l-2 border-[#E5B45C] pl-2 text-[#9298A3] bg-[#090A0C] py-1">
                    &ldquo;{ce.verbatimExcerpt}&rdquo;
                  </blockquote>
                </div>
              ))}
            </div>
          </GlassCard>
        )}

      {/* Clarification & Client Questions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Missing Information */}
        <GlassCard variant="surface" intensity="subtle" className="p-5">
          <h3 className="text-sm font-bold text-[#F5F3ED] mb-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#9298A3]" />
            Missing Information
          </h3>
          {analysis.missingInformation.length === 0 ? (
            <p className="text-xs text-[#9298A3] italic">None identified.</p>
          ) : (
            <ul className="list-disc list-inside space-y-1 text-xs text-[#9298A3]">
              {analysis.missingInformation.map((item, idx) => (
                <li key={idx} className="text-[#F5F3ED]/90">{item}</li>
              ))}
            </ul>
          )}
        </GlassCard>

        {/* Clarification Questions for Client */}
        <GlassCard variant="surface" intensity="subtle" className="p-5">
          <h3 className="text-sm font-bold text-[#F5F3ED] mb-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#D4AF65]" />
            Recommended Client Clarification Questions
          </h3>
          {analysis.clarificationQuestions.length === 0 ? (
            <p className="text-xs text-[#9298A3] italic">No clarification questions needed.</p>
          ) : (
            <ul className="list-disc list-inside space-y-1.5 text-xs text-[#9298A3]">
              {analysis.clarificationQuestions.map((q, idx) => (
                <li key={idx} className="leading-relaxed text-[#F5F3ED]/90">
                  {q}
                </li>
              ))}
            </ul>
          )}
        </GlassCard>
      </div>

      {/* Provider Review Sign-off & Internal Notes */}
      <GlassCard variant="surface" intensity="prominent" className="p-6 space-y-4">
        <div className="border-b border-[#292D35] pb-3">
          <h3 className="text-base font-bold text-[#F5F3ED]">
            Provider Review & Sign-Off
          </h3>
          <p className="text-xs text-[#9298A3]">
            Confirm your assessment of this change request and record internal notes before creating a change order.
          </p>
        </div>

        {saveSuccess && (
          <div className="bg-[#43B581]/10 border border-[#43B581]/30 text-[#43B581] rounded-lg p-3 text-sm flex items-center gap-2">
            <svg className="w-4 h-4 text-[#43B581]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
            Review sign-off saved successfully.
            {reviewedAt && (
              <span className="text-xs font-mono text-[#43B581]/80 ml-auto">
                {new Date(reviewedAt).toLocaleString()}
              </span>
            )}
          </div>
        )}

        {saveError && (
          <div className="bg-[#E06C75]/10 border border-[#E06C75]/30 text-[#E06C75] rounded-lg p-3 text-sm">
            {saveError}
          </div>
        )}

        <div>
          <label
            htmlFor="providerNotes"
            className="block text-xs font-semibold uppercase tracking-wider text-[#9298A3] mb-1"
          >
            Internal Provider Notes (Optional)
          </label>
          <textarea
            id="providerNotes"
            rows={3}
            value={providerNotes}
            onChange={(e) => setProviderNotes(e.target.value)}
            placeholder="Add internal notes on client communication, commercial impact, or rationale..."
            className="w-full rounded-lg bg-[#090A0C]/90 border border-[#292D35] px-3.5 py-2 text-sm text-[#F5F3ED] placeholder-[#9298A3]/50 focus:outline-none focus:border-[#D4AF65]"
          />
        </div>

        <div className="flex items-center justify-between pt-2">
          <div className="text-xs text-[#9298A3]">
            {reviewStatus === "REVIEWED" && reviewedAt ? (
              <span>Last reviewed: <span className="text-[#F5F3ED] font-mono">{new Date(reviewedAt).toLocaleString()}</span></span>
            ) : (
              <span>Status: <span className="text-[#E5B45C]">Awaiting provider sign-off</span></span>
            )}
          </div>

          <button
            type="button"
            disabled={isSaving}
            onClick={handleSaveReview}
            className="inline-flex items-center px-4 py-2 rounded-lg text-xs font-bold text-[#F5F3ED] bg-[#1D2129] border border-[#292D35] hover:border-[#D4AF65] hover:text-[#D4AF65] focus:outline-none disabled:opacity-50 transition-all active:scale-[0.98]"
          >
            {isSaving ? "Saving Sign-off..." : "Mark as Reviewed"}
          </button>
        </div>
      </GlassCard>

      {/* Commercial Decision & Change Proposal Generation */}
      <GlassCard variant="gold" intensity="prominent" className="p-6 text-[#F5F3ED] space-y-4 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-[#F5F3ED] flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#D4AF65]" />
              Commercial Action: Change Proposal & Pricing
            </h3>
            <p className="text-xs text-[#9298A3] mt-0.5">
              Turn this analyzed change request into a structured, priced commercial proposal.
            </p>
          </div>

          <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded bg-[#111318] text-[#D4AF65] border border-[#292D35]">
            Status: {analysis.classification}
          </span>
        </div>

        {proposalError && (
          <div className="bg-[#E06C75]/10 border border-[#E06C75]/30 text-[#E06C75] rounded-lg p-3 text-xs">
            {proposalError}
          </div>
        )}

        {/* IN_SCOPE Guardrail */}
        {analysis.classification === "IN_SCOPE" && !allowInScopeOverride && (
          <div className="bg-[#E5B45C]/10 border border-[#E5B45C]/30 rounded-lg p-3.5 text-xs text-[#E5B45C] space-y-2">
            <p className="font-semibold text-[#E5B45C]">
              In-Scope Protection Active:
            </p>
            <p className="text-[#F5F3ED]/80">
              This request was classified as IN_SCOPE (already included in the signed contract baseline).
              Accordly blocks automatic billable proposal creation to protect client trust and prevent double billing.
            </p>
            <label className="flex items-center gap-2 text-[#9298A3] cursor-pointer pt-1 hover:text-[#F5F3ED]">
              <input
                type="checkbox"
                checked={allowInScopeOverride}
                onChange={(e) => setAllowInScopeOverride(e.target.checked)}
                className="rounded bg-[#090A0C] border-[#292D35] text-[#D4AF65] focus:ring-[#D4AF65]"
              />
              <span>Allow provider override (e.g. for a zero-cost scope clarification)</span>
            </label>
          </div>
        )}

        {/* AMBIGUOUS Commercial Justification */}
        {analysis.classification === "AMBIGUOUS" && (
          <div className="bg-[#111318]/80 border border-[#292D35] rounded-lg p-3.5 space-y-2 text-xs">
            <label className="block font-semibold text-[#F5F3ED]">
              Provider Commercial Justification Required (Minimum 10 chars):
            </label>
            <p className="text-[#9298A3]">
              The baseline agreement is silent or ambiguous on this work. Explain why this work warrants a paid change proposal:
            </p>
            <input
              type="text"
              value={commercialJustification}
              onChange={(e) => setCommercialJustification(e.target.value)}
              placeholder="e.g. Chatbot requires external third-party API and custom dataset embeddings not contemplated in initial agreement."
              className="w-full bg-[#090A0C] border border-[#292D35] rounded px-3 py-2 text-[#F5F3ED] placeholder-[#9298A3]/50 text-xs focus:outline-none focus:border-[#D4AF65]"
            />
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <p className="text-[11px] text-[#9298A3] max-w-lg">
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
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold text-[#090A0C] bg-[#D4AF65] hover:bg-[#E2C17F] disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm shadow-[#D4AF65]/20 hover:shadow-[#D4AF65]/35 active:scale-[0.98]"
          >
            {isCreatingProposal ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5 text-[#090A0C]" fill="none" viewBox="0 0 24 24">
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
      </GlassCard>
    </div>
  );
}
