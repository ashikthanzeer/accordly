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
    onChange({
      ...baseline,
      deliverables: [...baseline.deliverables, newDel],
    });
  };

  // Exclusion handlers
  const handleRemoveExclusion = (index: number) => {
    const exclusions = baseline.exclusions.filter((_, i) => i !== index);
    onChange({ ...baseline, exclusions });
  };

  const handleAddExclusion = () => {
    const newId = `EXC-${baseline.exclusions.length + 1}`;
    const newExc: ExclusionItem = {
      id: newId,
      description: "Enter explicitly excluded service or deliverable",
      conditions: null,
      source: {
        excerpt: "Added manually by provider during review",
        isInferred: true,
      },
    };
    onChange({
      ...baseline,
      exclusions: [...baseline.exclusions, newExc],
    });
  };

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-xl font-bold text-slate-900">
              Scope Baseline {isConfirmed ? `v${version}` : "(Draft Review)"}
            </h2>
            {isConfirmed ? (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                ✓ Confirmed
              </span>
            ) : (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
                Pending Provider Confirmation
              </span>
            )}
            {metadata?.isMock && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600 border border-slate-300">
                Demo Extraction Engine
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-1">
            {isConfirmed
              ? `Confirmed on ${new Date(confirmedAt || "").toLocaleDateString()} — Authoritative baseline for scope changes.`
              : "Review AI-extracted deliverables, exclusions, and payment terms against source excerpts before confirming."}
          </p>
        </div>
      </div>

      {/* Citation Inspector Modal / Callout */}
      {activeCitation && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg shadow-sm">
          <div className="flex items-start justify-between">
            <div className="text-xs font-semibold uppercase tracking-wider text-blue-700">
              Contract Evidence Excerpt{" "}
              {activeCitation.page ? `[Page ${activeCitation.page}]` : ""}{" "}
              {activeCitation.section ? `[${activeCitation.section}]` : ""}
            </div>
            <button
              type="button"
              onClick={() => setActiveCitation(null)}
              className="text-xs text-blue-600 hover:text-blue-800 font-bold"
            >
              ✕ Close
            </button>
          </div>
          <blockquote className="mt-2 text-sm italic text-blue-950 bg-white/70 p-3 rounded border border-blue-100">
            &ldquo;{activeCitation.excerpt}&rdquo;
          </blockquote>
          {activeCitation.isInferred && (
            <p className="mt-1 text-xs text-amber-700">
              Note: Identified as an inference or manual edit.
            </p>
          )}
        </div>
      )}

      {/* 1. Deliverables Section */}
      <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              1. Agreed Deliverables ({baseline.deliverables.length})
            </h3>
            <p className="text-xs text-slate-500">
              Specific tangible outcomes and work products covered in the contract.
            </p>
          </div>
          {!isConfirmed && (
            <button
              type="button"
              onClick={handleAddDeliverable}
              className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold px-3 py-1.5 rounded border border-blue-200 transition"
            >
              + Add Deliverable
            </button>
          )}
        </div>

        <div className="space-y-4">
          {baseline.deliverables.map((del, idx) => (
            <div
              key={del.id || idx}
              className="p-4 border border-slate-200 rounded-md bg-slate-50/50 hover:bg-slate-50 transition"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  {isConfirmed ? (
                    <h4 className="font-semibold text-slate-900 text-sm">{del.name}</h4>
                  ) : (
                    <input
                      type="text"
                      value={del.name}
                      onChange={(e) =>
                        handleUpdateDeliverable(idx, { ...del, name: e.target.value })
                      }
                      className="font-semibold text-slate-900 text-sm bg-white border border-slate-300 rounded px-2 py-1 w-full max-w-md focus:ring-1 focus:ring-blue-500"
                    />
                  )}
                </div>
                <div className="flex items-center space-x-2 ml-4">
                  {del.source?.excerpt && (
                    <button
                      type="button"
                      onClick={() => setActiveCitation(del.source)}
                      className="text-xs bg-blue-100 text-blue-800 hover:bg-blue-200 px-2 py-0.5 rounded font-medium"
                    >
                      {del.source.page ? `Page ${del.source.page}` : "Source Excerpt"} 🔍
                    </button>
                  )}
                  {!isConfirmed && (
                    <button
                      type="button"
                      onClick={() => handleRemoveDeliverable(idx)}
                      className="text-xs text-red-600 hover:text-red-800 px-1 py-0.5"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-2">
                {isConfirmed ? (
                  <p className="text-sm text-slate-700">{del.description}</p>
                ) : (
                  <textarea
                    rows={2}
                    value={del.description}
                    onChange={(e) =>
                      handleUpdateDeliverable(idx, { ...del, description: e.target.value })
                    }
                    className="text-sm text-slate-700 bg-white border border-slate-300 rounded p-2 w-full focus:ring-1 focus:ring-blue-500"
                  />
                )}
              </div>

              {del.conditions && del.conditions.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {del.conditions.map((cond, cIdx) => (
                    <span
                      key={cIdx}
                      className="text-xs bg-slate-200 text-slate-800 px-2 py-0.5 rounded"
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
      <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              2. Explicit Exclusions ({baseline.exclusions.length})
            </h3>
            <p className="text-xs text-slate-500">
              Services explicitly stated as not included in the original project agreement.
            </p>
          </div>
          {!isConfirmed && (
            <button
              type="button"
              onClick={handleAddExclusion}
              className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-3 py-1.5 rounded border border-slate-300 transition"
            >
              + Add Exclusion
            </button>
          )}
        </div>

        {baseline.exclusions.length === 0 ? (
          <p className="text-sm text-slate-500 italic">
            No explicit exclusions found in the agreement.
          </p>
        ) : (
          <div className="space-y-3">
            {baseline.exclusions.map((exc, idx) => (
              <div
                key={exc.id || idx}
                className="flex items-start justify-between p-3 border border-red-100 bg-red-50/40 rounded-md"
              >
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-800">{exc.description}</p>
                  {exc.conditions && (
                    <p className="text-xs text-slate-500 mt-0.5">Condition: {exc.conditions}</p>
                  )}
                </div>
                <div className="flex items-center space-x-2 ml-4">
                  {exc.source?.excerpt && (
                    <button
                      type="button"
                      onClick={() => setActiveCitation(exc.source)}
                      className="text-xs bg-red-100 text-red-800 hover:bg-red-200 px-2 py-0.5 rounded font-medium"
                    >
                      {exc.source.page ? `Page ${exc.source.page}` : "Citation"} 🔍
                    </button>
                  )}
                  {!isConfirmed && (
                    <button
                      type="button"
                      onClick={() => handleRemoveExclusion(idx)}
                      className="text-xs text-slate-400 hover:text-red-600"
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
        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-slate-900">3. Revision Limits</h3>
            {baseline.revisionLimits.source?.excerpt && (
              <button
                type="button"
                onClick={() => setActiveCitation(baseline.revisionLimits.source!)}
                className="text-xs bg-slate-100 text-slate-700 hover:bg-slate-200 px-2 py-0.5 rounded"
              >
                Cite 🔍
              </button>
            )}
          </div>
          {baseline.revisionLimits.isSpecified ? (
            <div className="text-sm space-y-2">
              <p>
                <strong>Included Rounds:</strong>{" "}
                <span className="font-semibold text-blue-600">
                  {baseline.revisionLimits.includedCount ?? "Unspecified"}
                </span>
              </p>
              {baseline.revisionLimits.definition && (
                <p className="text-slate-600">
                  <strong>Definition:</strong> {baseline.revisionLimits.definition}
                </p>
              )}
              {baseline.revisionLimits.restrictions?.length > 0 && (
                <div className="text-xs text-slate-500">
                  <strong>Restrictions:</strong>{" "}
                  {baseline.revisionLimits.restrictions.join(", ")}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-500 italic">No revision limits specified in contract.</p>
          )}
        </div>

        {/* Acceptance Criteria */}
        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-slate-900">4. Acceptance Criteria</h3>
          </div>
          {baseline.acceptanceCriteria.length === 0 ? (
            <p className="text-sm text-slate-500 italic">No formal acceptance criteria specified.</p>
          ) : (
            <ul className="text-sm space-y-2 list-disc list-inside text-slate-700">
              {baseline.acceptanceCriteria.map((ac, idx) => (
                <li key={ac.id || idx}>
                  <span>{ac.criteria}</span>
                  {ac.source?.excerpt && (
                    <button
                      type="button"
                      onClick={() => setActiveCitation(ac.source)}
                      className="ml-2 text-xs text-blue-600 hover:underline"
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
      <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-slate-900">5. Payment Terms & Schedule</h3>
          {baseline.paymentTerms.source?.excerpt && (
            <button
              type="button"
              onClick={() => setActiveCitation(baseline.paymentTerms.source!)}
              className="text-xs bg-slate-100 text-slate-700 hover:bg-slate-200 px-2 py-0.5 rounded"
            >
              Cite 🔍
            </button>
          )}
        </div>

        {baseline.paymentTerms.isSpecified ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 text-sm bg-slate-50 p-4 rounded border border-slate-200">
            <div>
              <span className="text-xs text-slate-500 uppercase font-semibold">Total Price</span>
              <p className="text-lg font-bold text-slate-900">
                {baseline.paymentTerms.currency || "USD"}{" "}
                {baseline.paymentTerms.totalAmount || "Not specified"}
              </p>
            </div>
            <div>
              <span className="text-xs text-slate-500 uppercase font-semibold">Deposit Required</span>
              <p className="text-sm font-medium text-slate-800">
                {baseline.paymentTerms.depositRequired || "None"}
              </p>
            </div>
            <div>
              <span className="text-xs text-slate-500 uppercase font-semibold">Payment Terms</span>
              <p className="text-sm font-medium text-slate-800">
                {baseline.paymentTerms.dueConditions || "Due upon receipt"}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500 italic mb-4">No payment terms specified.</p>
        )}

        {baseline.milestones.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
              Project Milestones
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {baseline.milestones.map((ms, idx) => (
                <div key={ms.id || idx} className="p-3 bg-white border border-slate-200 rounded text-sm">
                  <div className="flex justify-between items-start">
                    <span className="font-semibold text-slate-800">{ms.name}</span>
                    {ms.dueDate && (
                      <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                        Due: {ms.dueDate}
                      </span>
                    )}
                  </div>
                  {ms.description && <p className="text-xs text-slate-600 mt-1">{ms.description}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 5. Contract Ambiguities */}
      {baseline.ambiguities.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-5">
          <h3 className="text-sm font-bold text-amber-900 uppercase tracking-wider mb-2">
            ⚠️ Identified Ambiguities or Missing Terms ({baseline.ambiguities.length})
          </h3>
          <ul className="space-y-2 text-sm text-amber-950">
            {baseline.ambiguities.map((amb, idx) => (
              <li key={amb.id || idx} className="bg-white/80 p-3 rounded border border-amber-200">
                <p className="font-semibold">{amb.issue}</p>
                <p className="text-xs text-amber-800 mt-0.5">Impact: {amb.potentialImpact}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

