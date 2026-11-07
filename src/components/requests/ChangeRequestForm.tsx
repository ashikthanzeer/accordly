"use client";

import React, { useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";

interface PresetScenario {
  label: string;
  badge: string;
  badgeColor: string;
  text: string;
}

const PRESET_SCENARIOS: PresetScenario[] = [
  {
    label: "Defect Fix (In-Scope)",
    badge: "IN_SCOPE",
    badgeColor: "bg-[#43B581]/15 text-[#43B581] border border-[#43B581]/30",
    text: "Client says: 'The checkout modal has an alignment bug on mobile Safari where the button overlaps the text. Please fix this.'",
  },
  {
    label: "Excluded Feature (Out-of-Scope)",
    badge: "OUT_OF_SCOPE",
    badgeColor: "bg-[#E06C75]/15 text-[#E06C75] border border-[#E06C75]/30",
    text: "Client asks: 'Can you implement custom multi-currency payment processing via Stripe, Apple Pay, and cryptocurrency integration?'",
  },
  {
    label: "Exceeded Revisions (Out-of-Scope)",
    badge: "OUT_OF_SCOPE",
    badgeColor: "bg-[#E06C75]/15 text-[#E06C75] border border-[#E06C75]/30",
    text: "Client writes: 'Here are our round 4 revisions for the homepage branding, typography, and color palette.'",
  },
  {
    label: "Silence / Unmentioned (Ambiguous)",
    badge: "AMBIGUOUS",
    badgeColor: "bg-[#E5B45C]/15 text-[#E5B45C] border border-[#E5B45C]/30",
    text: "Client asks: 'Can you integrate a live customer support chatbot with OpenAI on the homepage?'",
  },
  {
    label: "Conflicting Terms (Ambiguous)",
    badge: "AMBIGUOUS",
    badgeColor: "bg-[#E5B45C]/15 text-[#E5B45C] border border-[#E5B45C]/30",
    text: "Client says: 'We need the project delivered by Oct 15 instead of Nov 30, and please use our internal proprietary authentication system.'",
  },
];

interface ChangeRequestFormProps {
  onSubmit: (requestText: string) => Promise<void>;
  isLoading: boolean;
  hasConfirmedBaseline: boolean;
  baselineVersion?: number;
}

export function ChangeRequestForm({
  onSubmit,
  isLoading,
  hasConfirmedBaseline,
  baselineVersion,
}: ChangeRequestFormProps) {
  const [requestText, setRequestText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const charCount = requestText.trim().length;
  const isTooShort = charCount > 0 && charCount < 5;
  const isTooLong = charCount > 10000;
  const isValid = charCount >= 5 && charCount <= 10000;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || isLoading) return;

    setError(null);
    try {
      await onSubmit(requestText.trim());
      setRequestText("");
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred while analyzing the request."
      );
    }
  };

  const applyPreset = (preset: PresetScenario) => {
    setRequestText(preset.text);
    setError(null);
  };

  return (
    <GlassCard variant="surface" intensity="prominent" className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#292D35] pb-4">
        <div>
          <h2 className="text-base font-bold text-[#F5F3ED]">
            Submit Client Communication for Analysis
          </h2>
          <p className="text-xs text-[#9298A3] mt-0.5">
            Paste client emails, Slack messages, or meeting transcripts to evaluate scope classification against the agreed baseline.
          </p>
        </div>

        {hasConfirmedBaseline ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#43B581]/15 text-[#43B581] border border-[#43B581]/30">
            <span className="w-1.5 h-1.5 rounded-full bg-[#43B581]" />
            Baseline v{baselineVersion} Active
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#E5B45C]/15 text-[#E5B45C] border border-[#E5B45C]/30">
            <span className="w-1.5 h-1.5 rounded-full bg-[#E5B45C]" />
            Requires Confirmed Baseline
          </span>
        )}
      </div>

      {/* Preset Quick Scenarios */}
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-[#9298A3] mb-2.5">
          Or load a preset scenario:
        </label>
        <div className="flex flex-wrap gap-2">
          {PRESET_SCENARIOS.map((preset, idx) => (
            <button
              key={idx}
              type="button"
              disabled={!hasConfirmedBaseline || isLoading}
              onClick={() => applyPreset(preset)}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg border border-[#292D35] bg-[#111318]/70 hover:bg-[#1D2129] hover:border-[#D4AF65]/40 text-[#9298A3] hover:text-[#F5F3ED] transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span
                className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${preset.badgeColor}`}
              >
                {preset.badge}
              </span>
              <span>{preset.label}</span>
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="requestText"
            className="block text-xs font-bold uppercase tracking-wider text-[#F5F3ED] mb-1.5"
          >
            Client Request Message / Transcript
          </label>
          <textarea
            id="requestText"
            rows={5}
            disabled={!hasConfirmedBaseline || isLoading}
            value={requestText}
            onChange={(e) => setRequestText(e.target.value)}
            placeholder="Paste client email, Slack message, scope alteration request, or transcript here..."
            className={`w-full rounded-xl border px-3.5 py-3 text-xs text-[#F5F3ED] bg-[#090A0C]/90 focus:outline-none focus:ring-1 font-sans placeholder-[#5E6573] ${
              isTooShort || isTooLong
                ? "border-[#E06C75] focus:ring-[#E06C75]"
                : "border-[#292D35] focus:border-[#D4AF65] focus:ring-[#D4AF65]"
            } disabled:opacity-40 transition-colors`}
          />
          <div className="flex justify-between items-center mt-1.5 text-xs">
            <div>
              {isTooShort && (
                <span className="text-[#E06C75]">
                  Minimum 5 characters required (current: {charCount})
                </span>
              )}
              {isTooLong && (
                <span className="text-[#E06C75]">
                  Maximum 10,000 characters exceeded
                </span>
              )}
            </div>
            <span
              className={
                charCount > 10000
                  ? "text-[#E06C75] font-semibold"
                  : "text-[#9298A3]"
              }
            >
              {charCount.toLocaleString()} / 10,000 characters
            </span>
          </div>
        </div>

        {error && (
          <div className="bg-[#E06C75]/15 border border-[#E06C75]/30 text-[#E06C75] rounded-xl p-3.5 text-xs">
            {error}
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!hasConfirmedBaseline || !isValid || isLoading}
            className="inline-flex items-center px-5 py-2.5 rounded-lg text-xs font-bold text-[#090A0C] bg-[#D4AF65] hover:bg-[#E2C17F] disabled:opacity-40 disabled:cursor-not-allowed shadow-sm shadow-[#D4AF65]/20 hover:shadow-[#D4AF65]/35 transition-all active:scale-[0.98]"
          >
            {isLoading ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4 text-[#090A0C]"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Comparing Against Baseline...
              </>
            ) : (
              "Analyze Scope Classification"
            )}
          </button>
        </div>
      </form>
    </GlassCard>
  );
}
