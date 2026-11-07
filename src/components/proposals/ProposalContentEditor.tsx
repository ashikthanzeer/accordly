"use client";

import React from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import type { ProposalSuggestedDeliverable } from "@/lib/ai/proposal-drafter";

interface ProposalContentState {
  title: string;
  description: string;
  reasonForChange: string;
  deliverables: ProposalSuggestedDeliverable[];
  assumptions: string[];
  exclusions: string[];
  dependencies: string[];
  timelineImpact: string;
}

interface ProposalContentEditorProps {
  content: ProposalContentState;
  isReadOnly?: boolean;
  onChange: (updated: ProposalContentState) => void;
}

export function ProposalContentEditor({
  content,
  isReadOnly = false,
  onChange,
}: ProposalContentEditorProps) {
  // Title & description handlers
  const handleTitleChange = (val: string) => {
    onChange({ ...content, title: val });
  };

  const handleDescriptionChange = (val: string) => {
    onChange({ ...content, description: val });
  };

  const handleReasonChange = (val: string) => {
    onChange({ ...content, reasonForChange: val });
  };

  const handleTimelineChange = (val: string) => {
    onChange({ ...content, timelineImpact: val });
  };

  // Deliverables handlers
  const handleAddDeliverable = () => {
    const newDel: ProposalSuggestedDeliverable = {
      id: `DEL-CO-${content.deliverables.length + 1}`,
      name: "New Deliverable Scope",
      description: "Detailed deliverable specifications",
      acceptanceCriteria: ["Functional acceptance and client sign-off"],
      suggestedEffortHours: 4,
    };
    onChange({
      ...content,
      deliverables: [...content.deliverables, newDel],
    });
  };

  const handleUpdateDeliverable = (
    index: number,
    patch: Partial<ProposalSuggestedDeliverable>
  ) => {
    const list = [...content.deliverables];
    list[index] = { ...list[index], ...patch };
    onChange({ ...content, deliverables: list });
  };

  const handleRemoveDeliverable = (index: number) => {
    if (content.deliverables.length <= 1) {
      alert("A proposal must have at least one deliverable.");
      return;
    }
    const list = content.deliverables.filter((_, i) => i !== index);
    onChange({ ...content, deliverables: list });
  };

  // Simple string list handlers (assumptions, exclusions, dependencies)
  const handleUpdateArrayItem = (
    field: "assumptions" | "exclusions" | "dependencies",
    index: number,
    val: string
  ) => {
    const list = [...content[field]];
    list[index] = val;
    onChange({ ...content, [field]: list });
  };

  const handleAddArrayItem = (field: "assumptions" | "exclusions" | "dependencies") => {
    onChange({
      ...content,
      [field]: [...content[field], "New provision"],
    });
  };

  const handleRemoveArrayItem = (
    field: "assumptions" | "exclusions" | "dependencies",
    index: number
  ) => {
    const list = content[field].filter((_, i) => i !== index);
    onChange({ ...content, [field]: list });
  };

  return (
    <div className="space-y-6">
      {/* Title & Description Card */}
      <GlassCard variant="surface" intensity="prominent" className="p-6 space-y-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-[#9298A3] mb-1">
            Proposal Title
          </label>
          <input
            type="text"
            disabled={isReadOnly}
            value={content.title}
            onChange={(e) => handleTitleChange(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-lg bg-[#090A0C]/90 border border-[#292D35] text-base font-bold text-[#F5F3ED] placeholder-[#9298A3]/50 focus:outline-none focus:border-[#D4AF65] disabled:opacity-60 transition-colors"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-[#9298A3] mb-1">
            Summary of Proposed Work
          </label>
          <textarea
            rows={3}
            disabled={isReadOnly}
            value={content.description}
            onChange={(e) => handleDescriptionChange(e.target.value)}
            className="w-full px-3.5 py-2 rounded-lg bg-[#090A0C]/90 border border-[#292D35] text-sm text-[#F5F3ED] placeholder-[#9298A3]/50 focus:outline-none focus:border-[#D4AF65] disabled:opacity-60 transition-colors"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-[#9298A3] mb-1">
            Commercial Rationale & Reason for Change
          </label>
          <textarea
            rows={2}
            disabled={isReadOnly}
            value={content.reasonForChange}
            onChange={(e) => handleReasonChange(e.target.value)}
            className="w-full px-3.5 py-2 rounded-lg bg-[#090A0C]/90 border border-[#292D35] text-sm text-[#F5F3ED] placeholder-[#9298A3]/50 focus:outline-none focus:border-[#D4AF65] disabled:opacity-60 transition-colors"
          />
        </div>
      </GlassCard>

      {/* Deliverables List */}
      <GlassCard variant="surface" intensity="prominent" className="p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-[#292D35] pb-3">
          <div>
            <h3 className="text-base font-bold text-[#F5F3ED]">
              Proposed Deliverables ({content.deliverables.length})
            </h3>
            <p className="text-xs text-[#9298A3]">
              Specific outputs and acceptance criteria covered under this change order.
            </p>
          </div>
          {!isReadOnly && (
            <button
              type="button"
              onClick={handleAddDeliverable}
              className="inline-flex items-center text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#D4AF65]/10 text-[#D4AF65] border border-[#D4AF65]/30 hover:bg-[#D4AF65]/20 transition-all hover:scale-[1.01] active:scale-[0.98]"
            >
              + Add Deliverable
            </button>
          )}
        </div>

        <div className="space-y-4">
          {content.deliverables.map((del, idx) => (
            <div
              key={del.id || idx}
              className="border border-[#292D35] rounded-xl p-4 bg-[#111318]/70 hover:bg-[#111318] space-y-3 hover:border-[#D4AF65]/30 transition-all"
            >
              <div className="flex items-center justify-between gap-2">
                <input
                  type="text"
                  disabled={isReadOnly}
                  value={del.name}
                  onChange={(e) =>
                    handleUpdateDeliverable(idx, { name: e.target.value })
                  }
                  className="font-bold text-sm text-[#F5F3ED] bg-[#090A0C]/90 border border-[#292D35] rounded px-2.5 py-1.5 flex-1 max-w-md focus:outline-none focus:border-[#D4AF65]"
                />

                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#9298A3] font-medium">Est. Hours:</span>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    disabled={isReadOnly}
                    value={del.suggestedEffortHours ?? ""}
                    onChange={(e) =>
                      handleUpdateDeliverable(idx, {
                        suggestedEffortHours: Number(e.target.value),
                      })
                    }
                    className="w-16 text-xs text-center font-mono font-semibold text-[#F5F3ED] bg-[#090A0C]/90 border border-[#292D35] rounded py-1 focus:outline-none focus:border-[#D4AF65]"
                  />
                  {!isReadOnly && (
                    <button
                      type="button"
                      onClick={() => handleRemoveDeliverable(idx)}
                      className="text-[#9298A3] hover:text-[#E06C75] transition-colors text-sm px-1.5"
                    >
                      &times;
                    </button>
                  )}
                </div>
              </div>

              <div>
                <textarea
                  rows={2}
                  disabled={isReadOnly}
                  value={del.description}
                  onChange={(e) =>
                    handleUpdateDeliverable(idx, { description: e.target.value })
                  }
                  placeholder="Deliverable description and specifications..."
                  className="w-full text-xs text-[#F5F3ED] bg-[#090A0C]/90 border border-[#292D35] rounded p-2 focus:outline-none focus:border-[#D4AF65] placeholder-[#9298A3]/50"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase text-[#9298A3] mb-1">
                  Acceptance Criteria (comma-separated or one per line):
                </label>
                <input
                  type="text"
                  disabled={isReadOnly}
                  value={del.acceptanceCriteria.join("; ")}
                  onChange={(e) =>
                    handleUpdateDeliverable(idx, {
                      acceptanceCriteria: e.target.value
                        .split(";")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                  placeholder="e.g. Browser validation; Staging testing"
                  className="w-full text-xs text-[#F5F3ED] bg-[#090A0C]/90 border border-[#292D35] rounded px-2 py-1.5 focus:outline-none focus:border-[#D4AF65] placeholder-[#9298A3]/50"
                />
              </div>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* Assumptions, Exclusions, Dependencies */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Assumptions */}
        <GlassCard variant="surface" intensity="subtle" className="p-5 space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#9298A3]">
              Assumptions
            </h4>
            {!isReadOnly && (
              <button
                type="button"
                onClick={() => handleAddArrayItem("assumptions")}
                className="text-[11px] font-semibold text-[#D4AF65] hover:text-[#E2C17F]"
              >
                + Add
              </button>
            )}
          </div>
          <div className="space-y-1.5">
            {content.assumptions.map((item, idx) => (
              <div key={idx} className="flex items-center gap-1">
                <input
                  type="text"
                  disabled={isReadOnly}
                  value={item}
                  onChange={(e) =>
                    handleUpdateArrayItem("assumptions", idx, e.target.value)
                  }
                  className="w-full text-xs text-[#F5F3ED] bg-[#090A0C]/90 border border-[#292D35] rounded px-2 py-1 focus:outline-none focus:border-[#D4AF65]"
                />
                {!isReadOnly && (
                  <button
                    type="button"
                    onClick={() => handleRemoveArrayItem("assumptions", idx)}
                    className="text-[#9298A3] hover:text-[#E06C75] text-xs px-1"
                  >
                    &times;
                  </button>
                )}
              </div>
            ))}
          </div>
        </GlassCard>

        {/* Exclusions */}
        <GlassCard variant="surface" intensity="subtle" className="p-5 space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#9298A3]">
              Exclusions
            </h4>
            {!isReadOnly && (
              <button
                type="button"
                onClick={() => handleAddArrayItem("exclusions")}
                className="text-[11px] font-semibold text-[#D4AF65] hover:text-[#E2C17F]"
              >
                + Add
              </button>
            )}
          </div>
          <div className="space-y-1.5">
            {content.exclusions.map((item, idx) => (
              <div key={idx} className="flex items-center gap-1">
                <input
                  type="text"
                  disabled={isReadOnly}
                  value={item}
                  onChange={(e) =>
                    handleUpdateArrayItem("exclusions", idx, e.target.value)
                  }
                  className="w-full text-xs text-[#F5F3ED] bg-[#090A0C]/90 border border-[#292D35] rounded px-2 py-1 focus:outline-none focus:border-[#D4AF65]"
                />
                {!isReadOnly && (
                  <button
                    type="button"
                    onClick={() => handleRemoveArrayItem("exclusions", idx)}
                    className="text-[#9298A3] hover:text-[#E06C75] text-xs px-1"
                  >
                    &times;
                  </button>
                )}
              </div>
            ))}
          </div>
        </GlassCard>

        {/* Dependencies */}
        <GlassCard variant="surface" intensity="subtle" className="p-5 space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#9298A3]">
              Dependencies
            </h4>
            {!isReadOnly && (
              <button
                type="button"
                onClick={() => handleAddArrayItem("dependencies")}
                className="text-[11px] font-semibold text-[#D4AF65] hover:text-[#E2C17F]"
              >
                + Add
              </button>
            )}
          </div>
          <div className="space-y-1.5">
            {content.dependencies.map((item, idx) => (
              <div key={idx} className="flex items-center gap-1">
                <input
                  type="text"
                  disabled={isReadOnly}
                  value={item}
                  onChange={(e) =>
                    handleUpdateArrayItem("dependencies", idx, e.target.value)
                  }
                  className="w-full text-xs text-[#F5F3ED] bg-[#090A0C]/90 border border-[#292D35] rounded px-2 py-1 focus:outline-none focus:border-[#D4AF65]"
                />
                {!isReadOnly && (
                  <button
                    type="button"
                    onClick={() => handleRemoveArrayItem("dependencies", idx)}
                    className="text-[#9298A3] hover:text-[#E06C75] text-xs px-1"
                  >
                    &times;
                  </button>
                )}
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      {/* Timeline Impact */}
      <GlassCard variant="surface" intensity="subtle" className="p-5 space-y-2">
        <label className="block text-xs font-semibold uppercase tracking-wider text-[#9298A3]">
          Timeline & Milestone Impact
        </label>
        <input
          type="text"
          disabled={isReadOnly}
          value={content.timelineImpact}
          onChange={(e) => handleTimelineChange(e.target.value)}
          placeholder="e.g. Estimated +3 to +5 business days added to milestone 2"
          className="w-full text-xs text-[#F5F3ED] bg-[#090A0C]/90 border border-[#292D35] rounded px-3 py-2 focus:outline-none focus:border-[#D4AF65]"
        />
      </GlassCard>
    </div>
  );
}
