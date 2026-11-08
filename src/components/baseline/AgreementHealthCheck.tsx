"use client";

import React, { useMemo } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import {
  evaluateAgreementHealth,
  type HealthCategoryStatus,
} from "@/lib/baseline/health-check";
import type { StructuredScopeBaseline } from "@/lib/ai/schema";

interface AgreementHealthCheckProps {
  baseline: StructuredScopeBaseline;
  rawAgreementText?: string | null;
}

export function AgreementHealthCheck({
  baseline,
  rawAgreementText,
}: AgreementHealthCheckProps) {
  const health = useMemo(
    () => evaluateAgreementHealth(baseline, rawAgreementText),
    [baseline, rawAgreementText]
  );

  const getBandColor = () => {
    if (health.overallBand === "STRONG") {
      return "text-[#43B581] bg-[#43B581]/15 border-[#43B581]/30";
    }
    if (health.overallBand === "MODERATE") {
      return "text-[#E5B45C] bg-[#E5B45C]/15 border-[#E5B45C]/30";
    }
    return "text-[#E06C75] bg-[#E06C75]/15 border-[#E06C75]/30";
  };

  const getCategoryStatusBadge = (status: HealthCategoryStatus, score: number) => {
    switch (status) {
      case "STRONG":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#43B581]/15 text-[#43B581] border border-[#43B581]/30 whitespace-nowrap">
            ✓ STRONG ({score}/10)
          </span>
        );
      case "PARTIAL":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#E5B45C]/15 text-[#E5B45C] border border-[#E5B45C]/30 whitespace-nowrap">
            ~ PARTIAL ({score}/10)
          </span>
        );
      case "MISSING":
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#E06C75]/15 text-[#E06C75] border border-[#E06C75]/30 whitespace-nowrap">
            ✕ MISSING ({score}/10)
          </span>
        );
    }
  };

  return (
    <GlassCard
      variant="surface"
      intensity="prominent"
      className="p-6 lg:p-7 space-y-6 border-[#D4AF65]/30"
    >
      {/* Header & Overall Score */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-[#D4AF65]/15 text-[#D4AF65] border border-[#D4AF65]/30">
              PROACTIVE AGREEMENT HEALTH CHECK
            </span>
            <span className="text-[11px] font-mono text-[#9298A3]">
              Deterministic 10-Point Commercial Rubric
            </span>
          </div>
          <h2 className="text-xl font-extrabold text-[#F5F3ED] tracking-tight">
            Commercial Scope & Payment Protection Assessment
          </h2>
          <p className="text-xs text-[#9298A3] max-w-2xl leading-relaxed">
            {health.overallSummary}
          </p>
        </div>

        <div className="flex items-center gap-4 shrink-0 self-start md:self-auto">
          <div className={`px-4 py-3 rounded-2xl border text-right ${getBandColor()}`}>
            <span className="text-[10px] font-mono uppercase font-bold tracking-wider block opacity-80">
              Agreement Health Score
            </span>
            <div className="flex items-baseline justify-end gap-1.5 mt-0.5">
              <span className="text-2xl font-extrabold font-mono">
                {health.overallScore}
              </span>
              <span className="text-xs font-mono opacity-80">/ {health.maxScore}</span>
            </div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider block mt-0.5">
              {health.overallBand.replace(/_/g, " ")}
            </span>
          </div>
        </div>
      </div>

      {/* Rubric Formula & Counts Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#090A0C]/70 border border-white/[0.07] rounded-xl px-4 py-2.5 text-xs font-mono">
        <span className="text-[#9298A3]">
          Rubric: <strong className="text-[#F5F3ED]">{health.rubricFormula}</strong>
        </span>
        <div className="flex items-center gap-4">
          <span className="text-[#43B581] font-bold">
            {health.counts.strongCount} Strong
          </span>
          <span className="text-[#E5B45C] font-bold">
            {health.counts.partialCount} Partial
          </span>
          <span className="text-[#E06C75] font-bold">
            {health.counts.missingCount} Missing
          </span>
        </div>
      </div>

      {/* 10 Assessment Categories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {health.categories.map((cat) => (
          <div
            key={cat.id}
            className="bg-[#111318]/90 border border-white/[0.08] rounded-xl p-4 flex flex-col justify-between gap-3"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-[#F5F3ED]">
                  <span className="font-mono text-[#D4AF65] mr-1.5">
                    {String(cat.number).padStart(2, "0")}.
                  </span>
                  {cat.title}
                </span>
                {getCategoryStatusBadge(cat.status, cat.score)}
              </div>

              <p className="text-xs text-[#9298A3] leading-relaxed">{cat.summary}</p>

              {cat.missingInformation && (
                <div className="bg-[#E06C75]/[0.07] border border-[#E06C75]/25 rounded-lg p-2.5 text-[11px] text-[#E06C75]">
                  <span className="font-bold">Missing / Weak Point:</span>{" "}
                  <span className="text-[#F5F3ED]/90">{cat.missingInformation}</span>
                </div>
              )}

              {cat.supportingExcerpts.length > 0 && (
                <div className="space-y-1">
                  {cat.supportingExcerpts.map((ex, i) => (
                    <blockquote
                      key={i}
                      className="text-[11px] font-mono italic text-[#F5F3ED]/85 border-l-2 border-[#D4AF65]/60 pl-2.5 py-1 bg-[#090A0C]/80 rounded-r line-clamp-2"
                    >
                      &ldquo;{ex}&rdquo;
                    </blockquote>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-white/[0.06] text-[11px] text-[#9298A3]">
              <span className="font-semibold text-[#D4AF65]">Operational Guidance:</span>{" "}
              {cat.recommendation}
            </div>
          </div>
        ))}
      </div>

      {/* Ambiguous Clauses Section (if present in baseline) */}
      {health.ambiguities.length > 0 && (
        <div className="space-y-2.5 pt-2 border-t border-white/[0.08]">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#E5B45C] font-mono">
            Detected Contractual Ambiguities ({health.ambiguities.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {health.ambiguities.map((amb) => (
              <div
                key={amb.id}
                className="bg-[#E5B45C]/[0.06] border border-[#E5B45C]/30 rounded-xl p-3.5 space-y-1 text-xs"
              >
                <span className="font-bold text-[#E5B45C] block">{amb.issue}</span>
                <p className="text-[#9298A3] text-[11px]">
                  <span className="text-[#F5F3ED] font-medium">Commercial Impact:</span>{" "}
                  {amb.potentialImpact}
                </p>
                {amb.excerpt && (
                  <blockquote className="text-[11px] font-mono italic text-[#F5F3ED]/80 border-l-2 border-[#E5B45C] pl-2 py-0.5 mt-1">
                    &ldquo;{amb.excerpt}&rdquo;
                  </blockquote>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Non-Legal Operational Guidance Disclaimer */}
      <div className="bg-[#090A0C]/80 border border-white/[0.07] rounded-xl px-4 py-3 text-[11px] text-[#9298A3] leading-relaxed">
        {health.disclaimer}
      </div>
    </GlassCard>
  );
}

