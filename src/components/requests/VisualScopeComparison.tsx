"use client";

import React from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { buildVisualScopeComparisonModel } from "@/lib/requests/visual-comparison";
import type { StructuredScopeBaseline } from "@/lib/ai/schema";
import type { ChangeRequestAnalysisResult } from "@/lib/ai/classifier-schema";

interface VisualScopeComparisonProps {
  agreementName?: string | null;
  baselineVersion?: number | null;
  structuredBaseline?: StructuredScopeBaseline | null;
  sourceText: string;
  createdAt?: string;
  analysis: ChangeRequestAnalysisResult & {
    reviewStatus?: "PENDING_REVIEW" | "REVIEWED";
    reviewedAt?: string | null;
    providerNotes?: string | null;
    providerOverride?: {
      overriddenAt?: string;
      justification?: string;
      allowInScopeOverride?: boolean;
    } | null;
  };
}

export function VisualScopeComparison({
  agreementName,
  baselineVersion,
  structuredBaseline,
  sourceText,
  createdAt,
  analysis,
}: VisualScopeComparisonProps) {
  const model = buildVisualScopeComparisonModel({
    agreementName,
    baselineVersion,
    structuredBaseline,
    sourceText,
    analysis,
  });

  const getAlignmentBadge = (
    alignment: "COVERED_IN_BASELINE" | "OUTSIDE_OR_EXCLUDED" | "AMBIGUOUS_OR_CONFLICT"
  ) => {
    switch (alignment) {
      case "COVERED_IN_BASELINE":
        return {
          label: "Covered in Baseline",
          className: "bg-[#43B581]/15 text-[#43B581] border-[#43B581]/30",
        };
      case "OUTSIDE_OR_EXCLUDED":
        return {
          label: "Additional Work / Excluded",
          className: "bg-[#E06C75]/15 text-[#E06C75] border-[#E06C75]/30",
        };
      case "AMBIGUOUS_OR_CONFLICT":
      default:
        return {
          label: "Ambiguous / Contract Conflict",
          className: "bg-[#E5B45C]/15 text-[#E5B45C] border-[#E5B45C]/30",
        };
    }
  };

  return (
    <div className="space-y-6">
      {/* Split-Screen Visual Comparison: LEFT (Original Agreement Baseline) vs RIGHT (Client Change Request) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* LEFT PANE: Signed Agreement Clauses & Baseline Deliverables */}
        <GlassCard
          variant="surface"
          intensity="prominent"
          className="lg:col-span-6 p-5 lg:p-6 flex flex-col justify-between border-white/[0.09] space-y-4"
        >
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-white/[0.08] pb-3.5">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-[#D4AF65]/15 text-[#D4AF65] border border-[#D4AF65]/30">
                    LEFT &bull; CONTRACT BASELINE
                  </span>
                  <span className="text-[11px] font-mono text-[#43B581] bg-[#43B581]/10 border border-[#43B581]/25 px-2 py-0.5 rounded">
                    Baseline v{model.baselineVersion}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-[#F5F3ED] mt-1.5">
                  Original Agreement Clauses & Deliverables
                </h3>
                <p className="text-xs text-[#9298A3] font-mono mt-0.5 truncate">
                  Source Document: {model.agreementName}
                </p>
              </div>
            </div>

            {model.leftBaselineClauses.length === 0 ? (
              <div className="bg-[#090A0C]/70 border border-white/[0.07] rounded-xl p-4 text-xs text-[#9298A3]">
                Confirmed baseline clauses are referenced in the citation breakdown below.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                {model.leftBaselineClauses.map((clause) => (
                  <div
                    key={`${clause.category}_${clause.id}`}
                    className={`rounded-xl p-3.5 border transition-all space-y-1.5 ${
                      clause.isDirectlyReferenced
                        ? "bg-[#D4AF65]/[0.07] border-[#D4AF65]/40 shadow-sm"
                        : "bg-[#090A0C]/75 border-white/[0.07]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded border ${
                            clause.category === "EXCLUSION"
                              ? "bg-[#E06C75]/15 text-[#E06C75] border-[#E06C75]/30"
                              : clause.category === "REVISION_LIMIT"
                              ? "bg-[#E5B45C]/15 text-[#E5B45C] border-[#E5B45C]/30"
                              : "bg-[#43B581]/15 text-[#43B581] border-[#43B581]/30"
                          }`}
                        >
                          {clause.category.replace(/_/g, " ")}
                        </span>
                        <span className="text-xs font-bold text-[#F5F3ED]">
                          {clause.title}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 text-[10px] font-mono text-[#9298A3]">
                        {clause.isDirectlyReferenced && (
                          <span className="px-2 py-0.5 rounded-full bg-[#D4AF65]/20 text-[#D4AF65] font-bold">
                            Matched to Request
                          </span>
                        )}
                        {clause.page && <span>Page {clause.page}</span>}
                        {clause.section && <span>&bull; {clause.section}</span>}
                      </div>
                    </div>

                    <p className="text-xs text-[#9298A3] leading-relaxed">
                      {clause.description}
                    </p>

                    {clause.excerpt && clause.excerpt !== clause.description && (
                      <blockquote className="text-[11px] font-mono italic text-[#F5F3ED]/85 border-l-2 border-[#D4AF65]/60 pl-2.5 py-1 bg-[#090A0C]/80 rounded-r">
                        &ldquo;{clause.excerpt}&rdquo;
                      </blockquote>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between text-[11px] text-[#9298A3] font-mono">
            <span>{model.leftBaselineClauses.length} baseline clause(s) loaded</span>
            <span>Authoritative Contract Benchmark</span>
          </div>
        </GlassCard>

        {/* RIGHT PANE: Incoming Client Change Request */}
        <GlassCard
          variant="surface"
          intensity="prominent"
          className="lg:col-span-6 p-5 lg:p-6 flex flex-col justify-between border-white/[0.09] space-y-4"
        >
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-white/[0.08] pb-3.5">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-white/[0.08] text-[#F5F3ED] border border-white/[0.12]">
                    RIGHT &bull; CLIENT CHANGE REQUEST
                  </span>
                  {createdAt && (
                    <span className="text-[11px] font-mono text-[#9298A3]">
                      Submitted {new Date(createdAt).toLocaleString()}
                    </span>
                  )}
                </div>
                <h3 className="text-sm font-bold text-[#F5F3ED] mt-1.5">
                  Client Scope Request Under Evaluation
                </h3>
                <p className="text-xs text-[#9298A3] mt-0.5">
                  Evaluated strictly as untrusted client input against Baseline v{model.baselineVersion}.
                </p>
              </div>
            </div>

            {/* Verbatim Client Request Box */}
            <div className="bg-[#090A0C]/90 border border-white/[0.1] rounded-xl p-4 text-sm text-[#F5F3ED] font-mono whitespace-pre-wrap leading-relaxed min-h-[140px]">
              {model.rightRequest.sourceText}
            </div>

            {/* Impacted Categories & Mixed-Scope Indicators */}
            <div className="space-y-3">
              {model.rightRequest.affectedBaselineCategories.length > 0 && (
                <div>
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#9298A3] block mb-1.5">
                    Impacted Contract Categories:
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {model.rightRequest.affectedBaselineCategories.map((cat, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-0.5 rounded-md text-[11px] font-mono font-semibold bg-[#D4AF65]/15 text-[#D4AF65] border border-[#D4AF65]/30"
                      >
                        {cat}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {model.rightRequest.affectedDeliverables.length > 0 && (
                <div>
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#9298A3] block mb-1.5">
                    Impacted Baseline Deliverables:
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {model.rightRequest.affectedDeliverables.map((deliv, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-0.5 rounded-md text-[11px] font-mono text-[#F5F3ED] bg-white/[0.05] border border-white/[0.1]"
                      >
                        {deliv}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {model.rightRequest.hasMixedSignals && (
                <div className="bg-[#E5B45C]/10 border border-[#E5B45C]/30 rounded-xl p-3 text-xs text-[#E5B45C] space-y-1">
                  <span className="font-bold block">
                    Mixed-Scope / Conflicting Contract Signals Detected
                  </span>
                  <p className="text-[#F5F3ED]/85 text-[11px]">
                    This request touches both covered baseline clauses and conflicting or excluded provisions. Inspect the individual evidence citations below before approving a commercial proposal.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between text-[11px] text-[#9298A3] font-mono">
            <span>{model.rightRequest.characterCount} characters</span>
            <span>Prompt-Injection Isolated Input</span>
          </div>
        </GlassCard>
      </div>

      {/* BELOW PANE: Traceable Evidence Breakdown & Explicit AI vs. Provider Decision Boundary */}
      <GlassCard variant="surface" intensity="prominent" className="p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-3.5">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-[#D4AF65]/15 text-[#D4AF65] border border-[#D4AF65]/30">
                BELOW &bull; TRACEABLE EVIDENCE & CITATION VERIFICATION
              </span>
              {model.aiAssessment.hasExplicitExclusion && (
                <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-[#E06C75]/15 text-[#E06C75] border border-[#E06C75]/30">
                  Explicit Contractual Exclusion Cited
                </span>
              )}
            </div>
            <h3 className="text-base font-bold text-[#F5F3ED] mt-1.5">
              Contractual Evidence & Verbatim Citations ({model.aiAssessment.evidenceItems.length})
            </h3>
            <p className="text-xs text-[#9298A3]">
              Every excerpt is verified against <span className="font-mono text-[#F5F3ED]">{model.agreementName}</span>. Missing evidence is never treated as proof of exclusion.
            </p>
          </div>
        </div>

        {model.aiAssessment.isSilentContract ? (
          <div className="bg-[#E5B45C]/10 border border-[#E5B45C]/30 rounded-xl p-4 text-xs text-[#E5B45C] space-y-1">
            <span className="font-bold block">
              Contract Silent on Requested Work (No Direct Clauses Found)
            </span>
            <p className="text-[#F5F3ED]/85">
              No specific clauses in <span className="font-mono">{model.agreementName}</span> directly govern this request. Per Accordly&apos;s evidence rules, silence in the agreement is surfaced transparently rather than fabricating citations.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {model.aiAssessment.evidenceItems.map((ev, idx) => {
              const alignBadge = getAlignmentBadge(ev.alignment);
              return (
                <div
                  key={`${ev.id}_${idx}`}
                  className="border border-white/[0.09] rounded-xl p-4 bg-[#111318]/80 hover:border-[#D4AF65]/40 transition-all space-y-2.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded border ${alignBadge.className}`}
                      >
                        {alignBadge.label}
                      </span>
                      <span className="text-[11px] font-bold uppercase px-2 py-0.5 rounded bg-[#D4AF65]/10 text-[#D4AF65] border border-[#D4AF65]/30 font-mono">
                        {ev.category.replace(/_/g, " ")}
                      </span>
                      <span className="text-xs font-mono text-[#F5F3ED]/90">
                        {ev.agreementName}
                      </span>
                      {ev.page && (
                        <span className="text-xs text-[#9298A3] font-mono">
                          &bull; Page {ev.page}
                        </span>
                      )}
                      {ev.section && (
                        <span className="text-xs text-[#9298A3] font-mono">
                          &bull; Section: {ev.section}
                        </span>
                      )}
                    </div>

                    <div>
                      {ev.isVerified ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#43B581] bg-[#43B581]/10 border border-[#43B581]/30 px-2.5 py-0.5 rounded-full">
                          ✓ Verified in Agreement
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#E5B45C] bg-[#E5B45C]/10 border border-[#E5B45C]/30 px-2.5 py-0.5 rounded-full">
                          Paraphrased / Unverified Excerpt
                        </span>
                      )}
                    </div>
                  </div>

                  <blockquote className="border-l-2 border-[#D4AF65] pl-3.5 italic text-sm text-[#F5F3ED] bg-[#090A0C]/85 py-2.5 pr-3 rounded-r font-mono">
                    &ldquo;{ev.verbatimExcerpt}&rdquo;
                  </blockquote>

                  <p className="text-xs text-[#9298A3] leading-relaxed">
                    <span className="font-semibold text-[#F5F3ED]">Contractual Relevance:</span>{" "}
                    {ev.relevanceExplanation}
                  </p>
                </div>
              );
            })}
          </div>
        )}

        {/* Explicit Separation: AI Assessment vs. Provider Review & Override */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-white/[0.08] text-xs">
          <div className="bg-[#090A0C]/80 border border-white/[0.08] rounded-xl p-4 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#9298A3]">
                Immutable AI Scope Assessment
              </span>
              <span className="text-[11px] font-mono font-bold text-[#D4AF65]">
                {model.aiAssessment.classification} ({model.aiAssessment.confidence})
              </span>
            </div>
            <p className="text-[#F5F3ED]/90 leading-relaxed">
              {model.aiAssessment.summary}
            </p>
          </div>

          <div className="bg-[#090A0C]/80 border border-white/[0.08] rounded-xl p-4 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#9298A3]">
                Provider Review & Commercial Override
              </span>
              <span
                className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                  model.providerDecision.hasProviderOverride
                    ? "bg-[#D4AF65]/15 text-[#D4AF65] border-[#D4AF65]/30"
                    : model.providerDecision.reviewStatus === "REVIEWED"
                    ? "bg-[#43B581]/15 text-[#43B581] border-[#43B581]/30"
                    : "bg-white/[0.05] text-[#9298A3] border-white/[0.1]"
                }`}
              >
                {model.providerDecision.hasProviderOverride
                  ? "PROVIDER OVERRIDE ACTIVE"
                  : model.providerDecision.reviewStatus}
              </span>
            </div>
            {model.providerDecision.overrideJustification ? (
              <p className="text-[#D4AF65] font-mono text-[11px]">
                Override Justification: &ldquo;{model.providerDecision.overrideJustification}&rdquo;
              </p>
            ) : model.providerDecision.providerNotes ? (
              <p className="text-[#F5F3ED]/90">
                Provider Notes: &ldquo;{model.providerDecision.providerNotes}&rdquo;
              </p>
            ) : (
              <p className="text-[#9298A3] italic">
                No provider override applied. AI assessment stands as the active classification.
              </p>
            )}
          </div>
        </div>
      </GlassCard>
    </div>
  );
}

