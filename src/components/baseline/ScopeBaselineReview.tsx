"use client";

import React, { useState } from "react";
import type {
  StructuredScopeBaseline,
  DeliverableItem,
  ExclusionItem,
  SourceReference,
} from "@/lib/ai/schema";

interface ScopeBaselineReviewProps {
  baseline: StructuredScopeBaseline;
  onChange: (updated: StructuredScopeBaseline) => void;
  isConfirmed?: boolean;
  version?: number;
  confirmedAt?: string;
  metadata?: {
    provider?: string;
    model?: string;
    isMock?: boolean;
  };
}

export function ScopeBaselineReview({
  baseline,
  onChange,
  isConfirmed = false,
  version = 1,
  confirmedAt,
  metadata,
}: ScopeBaselineReviewProps) {
  const [activeCitation, setActiveCitation] = useState<SourceReference | null>(null);

  // Deliverable edit handlers
  const handleUpdateDeliverable = (index: number, updated: DeliverableItem) => {
    const deliverables = [...baseline.deliverables];
    deliverables[index] = updated;
    onChange({ ...baseline, deliverables });
  };

  const handleRemoveDeliverable = (index: number) => {
    if (baseline.deliverables.length <= 1) {
      alert("A baseline must contain at least one deliverable.");
      return;
    }
    const deliverables = baseline.deliverables.filter((_, i) => i !== index);
    onChange({ ...baseline, deliverables });
  };

  const handleAddDeliverable = () => {
    const newId = `DEL-${baseline.deliverables.length + 1}`;
    const newDel: DeliverableItem = {
      id: newId,
      name: "New Deliverable",
      description: "Enter detailed deliverable specifications",
      conditions: [],
      source: {
        excerpt: "Added manually by provider during review",
        isInferred: true,
      },
    };
    onChange({ ...baseline, deliverables: [...baseline.deliverables, newDel] });
  };

  // Exclusion handlers
  const handleAddExclusion = () => {
    const newId = `EXC-${baseline.exclusions.length + 1}`;
    const newExc: ExclusionItem = {
      id: newId,
      description: "Enter newly identified out-of-scope exclusion",
      source: {
        excerpt: "Added manually by provider during review",
        isInferred: true,
      },
    };
    onChange({ ...baseline, exclusions: [...baseline.exclusions, newExc] });
  };

  const handleRemoveExclusion = (index: number) => {
    const exclusions = baseline.exclusions.filter((_, i) => i !== index);
    onChange({ ...baseline, exclusions });
  };

  return (
    <div className="space-y-6">
      {/* Header status bar */}
      <div className="bg-[#171A20]/80 backdrop-blur-md border border-white/[0.08] shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)] rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold tracking-wider uppercase text-[#D4AF65] font-mono">
              Scope Baseline v{version}
            </span>
            {isConfirmed ? (
              <span className="bg-[#43B581]/15 text-[#43B581] border border-[#43B581]/30 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                Confirmed & Active
              </span>
            ) : (
              <span className="bg-[#E5B45C]/15 text-[#E5B45C] border border-[#E5B45C]/30 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                AI Draft — Review Required
              </span>
            )}
          </div>
          <p className="text-xs text-[#9298A3] mt-1">
            {isConfirmed && confirmedAt
              ? `Confirmed on ${new Date(confirmedAt).toLocaleDateString()} at ${new Date(confirmedAt).toLocaleTimeString()}`
              : "Review and edit the extracted scope components before final confirmation."}
          </p>
        </div>

        {/* AI Extraction Metadata */}
        <div className="text-right text-[11px] text-[#9298A3] space-y-0.5">
          {metadata?.provider && (
            <div>
              Extraction Engine:{" "}
              <strong className="text-[#F5F3ED] font-mono">
                {metadata.provider} {metadata.model ? `(${metadata.model})` : ""}
              </strong>
            </div>
          )}
          {metadata?.isMock && (
            <span className="inline-block text-[10px] text-[#D4AF65] font-medium bg-[#111318] px-2 py-0.5 rounded border border-[#292D35]">
              Deterministic Contract Extractor
            </span>
          )}
        </div>
      </div>

      {/* Citation Inspector Modal / Callout */}
      {activeCitation && (
        <div className="p-4 bg-[#111318] border border-[#D4AF65]/40 rounded-xl space-y-2">
          <div className="flex items-start justify-between">
            <div className="text-xs font-bold uppercase tracking-wider text-[#D4AF65] font-mono">
              Contract Evidence Excerpt{" "}
              {activeCitation.page ? `[Page ${activeCitation.page}]` : ""}{" "}
              {activeCitation.section ? `[${activeCitation.section}]` : ""}
            </div>
            <button
              type="button"
              onClick={() => setActiveCitation(null)}
              className="text-xs text-[#9298A3] hover:text-[#F5F3ED] font-bold"
            >
              ✕ Close
            </button>
          </div>
          <blockquote className="mt-1 text-xs italic text-[#F5F3ED] bg-[#171A20] p-3 rounded-lg border border-[#292D35]">
            &ldquo;{activeCitation.excerpt}&rdquo;
          </blockquote>
          {activeCitation.isInferred && (
            <p className="text-[11px] text-[#E5B45C]">
              Note: Identified as an inference or manual edit.
            </p>
          )}
        </div>
      )}

      {/* 1. Deliverables Section */}
      <div className="bg-[#171A20]/80 backdrop-blur-md border border-white/[0.08] shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)] rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-[#F5F3ED]">
              1. Agreed Deliverables ({baseline.deliverables.length})
            </h3>
            <p className="text-xs text-[#9298A3]">
              Specific tangible outcomes and work products covered in the contract.
            </p>
          </div>
          {!isConfirmed && (
            <button
              type="button"
              onClick={handleAddDeliverable}
              className="text-xs bg-[#D4AF65]/10 hover:bg-[#D4AF65]/20 text-[#D4AF65] font-semibold px-3 py-1.5 rounded-lg border border-[#D4AF65]/30 transition"
            >
              + Add Deliverable
            </button>
          )}
        </div>

        <div className="space-y-3">
          {baseline.deliverables.map((del, idx) => (
            <div
              key={del.id || idx}
              className="p-4 border border-[#292D35] rounded-xl bg-[#111318] hover:border-[#D4AF65]/30 transition"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  {isConfirmed ? (
                    <h4 className="font-semibold text-[#F5F3ED] text-sm">{del.name}</h4>
                  ) : (
                    <input
                      type="text"
                      value={del.name}
                      onChange={(e) =>
                        handleUpdateDeliverable(idx, { ...del, name: e.target.value })
                      }
                      className="font-semibold text-[#F5F3ED] text-sm bg-[#090A0C] border border-[#292D35] rounded-lg px-2.5 py-1.5 w-full max-w-md focus:border-[#D4AF65] focus:outline-none"
                    />
                  )}
                </div>
                <div className="flex items-center space-x-2 ml-4">
                  {del.source?.excerpt && (
                    <button
                      type="button"
                      onClick={() => setActiveCitation(del.source)}
                      className="text-[11px] bg-[#1D2129] text-[#D4AF65] hover:bg-[#292D35] border border-[#292D35] px-2.5 py-1 rounded-lg font-medium"
                    >
                      {del.source.page ? `Page ${del.source.page}` : "Source Excerpt"} 🔍
                    </button>
                  )}
                  {!isConfirmed && (
                    <button
                      type="button"
                      onClick={() => handleRemoveDeliverable(idx)}
                      className="text-xs text-[#E06C75] hover:text-[#E06C75]/80 px-1 py-0.5"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-2.5">
                {isConfirmed ? (
                  <p className="text-xs text-[#9298A3] leading-relaxed">{del.description}</p>
                ) : (
                  <textarea
                    rows={2}
                    value={del.description}
                    onChange={(e) =>
                      handleUpdateDeliverable(idx, { ...del, description: e.target.value })
                    }
                    className="text-xs text-[#F5F3ED] bg-[#090A0C] border border-[#292D35] rounded-lg p-2.5 w-full focus:border-[#D4AF65] focus:outline-none"
                  />
                )}
              </div>

              {del.conditions && del.conditions.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {del.conditions.map((cond, cIdx) => (
                    <span
                      key={cIdx}
                      className="text-[10px] bg-[#1D2129] text-[#9298A3] px-2 py-0.5 rounded border border-[#292D35]"
                    >
                      Condition: {cond}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 2. Explicit Exclusions */}
      <div className="bg-[#171A20]/80 backdrop-blur-md border border-white/[0.08] shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)] rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-[#F5F3ED]">
              2. Explicit Exclusions ({baseline.exclusions.length})
            </h3>
            <p className="text-xs text-[#9298A3]">
              Services explicitly stated as not included in the original project agreement.
            </p>
          </div>
          {!isConfirmed && (
            <button
              type="button"
              onClick={handleAddExclusion}
              className="text-xs bg-[#111318] hover:bg-[#1D2129] text-[#9298A3] hover:text-[#F5F3ED] font-semibold px-3 py-1.5 rounded-lg border border-[#292D35] transition"
            >
              + Add Exclusion
            </button>
          )}
        </div>

        {baseline.exclusions.length === 0 ? (
          <p className="text-xs text-[#9298A3] italic">
            No explicit exclusions found in the agreement.
          </p>
        ) : (
          <div className="space-y-2.5">
            {baseline.exclusions.map((exc, idx) => (
              <div
                key={exc.id || idx}
                className="flex items-start justify-between p-3.5 border border-[#E06C75]/25 bg-[#E06C75]/10 rounded-xl"
              >
                <div className="flex-1">
                  <p className="text-xs font-medium text-[#F5F3ED]">{exc.description}</p>
                  {exc.conditions && (
                    <p className="text-[11px] text-[#9298A3] mt-0.5">Condition: {exc.conditions}</p>
                  )}
                </div>
                <div className="flex items-center space-x-2 ml-4">
                  {exc.source?.excerpt && (
                    <button
                      type="button"
                      onClick={() => setActiveCitation(exc.source)}
                      className="text-[10px] bg-[#111318] text-[#E06C75] border border-[#E06C75]/30 hover:bg-[#1D2129] px-2 py-0.5 rounded font-medium"
                    >
                      {exc.source.page ? `Page ${exc.source.page}` : "Citation"} 🔍
                    </button>
                  )}
                  {!isConfirmed && (
                    <button
                      type="button"
                      onClick={() => handleRemoveExclusion(idx)}
                      className="text-xs text-[#9298A3] hover:text-[#E06C75]"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. Revision Limits & Acceptance Criteria Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Revision Limits */}
        <div className="bg-[#171A20]/80 backdrop-blur-md border border-white/[0.08] shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)] rounded-2xl p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#F5F3ED]">3. Revision Limits</h3>
            {baseline.revisionLimits.source?.excerpt && (
              <button
                type="button"
                onClick={() => setActiveCitation(baseline.revisionLimits.source!)}
                className="text-[10px] bg-[#111318] text-[#D4AF65] border border-[#292D35] hover:bg-[#1D2129] px-2 py-0.5 rounded"
              >
                Cite 🔍
              </button>
            )}
          </div>
          {baseline.revisionLimits.isSpecified ? (
            <div className="text-xs space-y-2">
              <p className="text-[#9298A3]">
                <strong className="text-[#F5F3ED]">Included Rounds:</strong>{" "}
                <span className="font-bold text-[#D4AF65]">
                  {baseline.revisionLimits.includedCount ?? "Unspecified"}
                </span>
              </p>
              {baseline.revisionLimits.definition && (
                <p className="text-[#9298A3] leading-relaxed">
                  <strong className="text-[#F5F3ED]">Definition:</strong> {baseline.revisionLimits.definition}
                </p>
              )}
              {baseline.revisionLimits.restrictions?.length > 0 && (
                <div className="text-[11px] text-[#9298A3]">
                  <strong className="text-[#F5F3ED]">Restrictions:</strong>{" "}
                  {baseline.revisionLimits.restrictions.join(", ")}
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-[#9298A3] italic">No revision limits specified in contract.</p>
          )}
        </div>

        {/* Acceptance Criteria */}
        <div className="bg-[#171A20]/80 backdrop-blur-md border border-white/[0.08] shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)] rounded-2xl p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#F5F3ED]">4. Acceptance Criteria</h3>
          </div>
          {baseline.acceptanceCriteria.length === 0 ? (
            <p className="text-xs text-[#9298A3] italic">No formal acceptance criteria specified.</p>
          ) : (
            <ul className="text-xs space-y-2 list-disc list-inside text-[#9298A3]">
              {baseline.acceptanceCriteria.map((ac, idx) => (
                <li key={ac.id || idx}>
                  <span className="text-[#F5F3ED]">{ac.criteria}</span>
                  {ac.source?.excerpt && (
                    <button
                      type="button"
                      onClick={() => setActiveCitation(ac.source)}
                      className="ml-2 text-[10px] text-[#D4AF65] hover:underline"
                    >
                      [Cite]
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* 4. Payment Terms & Milestones */}
      <div className="bg-[#171A20]/80 backdrop-blur-md border border-white/[0.08] shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)] rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#F5F3ED]">5. Payment Terms & Schedule</h3>
          {baseline.paymentTerms.source?.excerpt && (
            <button
              type="button"
              onClick={() => setActiveCitation(baseline.paymentTerms.source!)}
              className="text-[10px] bg-[#111318] text-[#D4AF65] border border-[#292D35] hover:bg-[#1D2129] px-2 py-0.5 rounded"
            >
              Cite 🔍
            </button>
          )}
        </div>

        {baseline.paymentTerms.isSpecified ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs bg-[#111318] p-4 rounded-xl border border-[#292D35]">
            <div>
              <span className="text-[10px] text-[#9298A3] uppercase font-bold tracking-wider">Total Price</span>
              <p className="text-base font-black text-[#D4AF65] mt-0.5">
                {baseline.paymentTerms.currency || "USD"}{" "}
                {baseline.paymentTerms.totalAmount || "Not specified"}
              </p>
            </div>
            <div>
              <span className="text-[10px] text-[#9298A3] uppercase font-bold tracking-wider">Deposit Required</span>
              <p className="text-xs font-semibold text-[#F5F3ED] mt-0.5">
                {baseline.paymentTerms.depositRequired || "None"}
              </p>
            </div>
            <div>
              <span className="text-[10px] text-[#9298A3] uppercase font-bold tracking-wider">Payment Terms</span>
              <p className="text-xs font-semibold text-[#F5F3ED] mt-0.5">
                {baseline.paymentTerms.dueConditions || "Due upon receipt"}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-xs text-[#9298A3] italic">No payment terms specified.</p>
        )}

        {baseline.milestones.length > 0 && (
          <div className="pt-2">
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-[#9298A3] mb-2.5">
              Project Milestones
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {baseline.milestones.map((ms, idx) => (
                <div key={ms.id || idx} className="p-3.5 bg-[#111318] border border-[#292D35] rounded-xl text-xs space-y-1">
                  <div className="flex justify-between items-start">
                    <span className="font-bold text-[#F5F3ED]">{ms.name}</span>
                    {ms.dueDate && (
                      <span className="text-[10px] bg-[#171A20] text-[#D4AF65] border border-[#292D35] px-2 py-0.5 rounded">
                        Due: {ms.dueDate}
                      </span>
                    )}
                  </div>
                  {ms.description && <p className="text-[11px] text-[#9298A3]">{ms.description}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 5. Contract Ambiguities */}
      {baseline.ambiguities.length > 0 && (
        <div className="bg-[#E5B45C]/10 border border-[#E5B45C]/30 rounded-2xl p-5 space-y-2">
          <h3 className="text-xs font-bold text-[#E5B45C] uppercase tracking-wider">
            ⚠️ Identified Ambiguities or Missing Terms ({baseline.ambiguities.length})
          </h3>
          <ul className="space-y-2 text-xs">
            {baseline.ambiguities.map((amb, idx) => (
              <li key={amb.id || idx} className="bg-[#111318] p-3 rounded-xl border border-[#292D35]">
                <p className="font-semibold text-[#F5F3ED]">{amb.issue}</p>
                <p className="text-[11px] text-[#9298A3] mt-0.5">Impact: {amb.potentialImpact}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
