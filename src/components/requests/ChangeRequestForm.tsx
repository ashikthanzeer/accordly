"use client";

import React, { useState } from "react";

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
    badgeColor: "bg-emerald-100 text-emerald-800",
    text: "Client says: 'The checkout modal has an alignment bug on mobile Safari where the button overlaps the text. Please fix this.'",
  },
  {
    label: "Excluded Feature (Out-of-Scope)",
    badge: "OUT_OF_SCOPE",
    badgeColor: "bg-rose-100 text-rose-800",
    text: "Client asks: 'Can you implement custom multi-currency payment processing via Stripe, Apple Pay, and cryptocurrency integration?'",
  },
  {
    label: "Exceeded Revisions (Out-of-Scope)",
    badge: "OUT_OF_SCOPE",
    badgeColor: "bg-rose-100 text-rose-800",
    text: "Client writes: 'Here are our round 4 revisions for the homepage branding, typography, and color palette.'",
  },
  {
    label: "Silence / Unmentioned (Ambiguous)",
    badge: "AMBIGUOUS",
    badgeColor: "bg-amber-100 text-amber-800",
    text: "Client asks: 'Can you integrate a live customer support chatbot with OpenAI on the homepage?'",
  },
  {
    label: "Conflicting Terms (Ambiguous)",
    badge: "AMBIGUOUS",
    badgeColor: "bg-amber-100 text-amber-800",
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

  const charCount = requestText.length;
  const isTooShort = charCount > 0 && charCount < 5;
  const isTooLong = charCount > 10000;
  const isValid = charCount >= 5 && !isTooLong;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || isLoading) return;

    setError(null);
    try {
      await onSubmit(requestText);
      setRequestText("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to analyze change request.");
    }
  };

  const applyPreset = (preset: PresetScenario) => {
    setRequestText(preset.text);
    setError(null);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Submit Client Change Request
          </h2>
          <p className="text-sm text-slate-500">
            Compare incoming client communications against Confirmed Scope Baseline{" "}
            {baselineVersion ? `(v${baselineVersion})` : ""}.
          </p>
        </div>
        <div>
          {hasConfirmedBaseline ? (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
              Baseline Confirmed v{baselineVersion || 1}
            </span>
          ) : (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
              No Confirmed Baseline
            </span>
          )}
        </div>
      </div>

      {!hasConfirmedBaseline && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
          <p className="font-semibold mb-1">Baseline Required Before Analysis</p>
          <p>
            You must upload an agreement and confirm its scope baseline before analyzing client requests.
            Unconfirmed drafts cannot be used as authoritative comparison sources.
          </p>
        </div>
      )}

      {/* Preset Quick Scenarios */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
          Or load a preset scenario:
        </label>
        <div className="flex flex-wrap gap-2">
          {PRESET_SCENARIOS.map((preset, idx) => (
            <button
              key={idx}
              type="button"
              disabled={!hasConfirmedBaseline || isLoading}
              onClick={() => applyPreset(preset)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${preset.badgeColor}`}
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
            className="block text-sm font-medium text-slate-700 mb-1"
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
            className={`w-full rounded-lg border px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 font-sans ${
              isTooShort || isTooLong
                ? "border-rose-300 focus:ring-rose-400"
                : "border-slate-300 focus:ring-indigo-500"
            } disabled:bg-slate-50 disabled:text-slate-400`}
          />
          <div className="flex justify-between items-center mt-1.5 text-xs">
            <div>
              {isTooShort && (
                <span className="text-rose-600">
                  Minimum 5 characters required (current: {charCount})
                </span>
              )}
              {isTooLong && (
                <span className="text-rose-600">
                  Maximum 10,000 characters exceeded
                </span>
              )}
            </div>
            <span
              className={
                charCount > 10000
                  ? "text-rose-600 font-semibold"
                  : "text-slate-400"
              }
            >
              {charCount.toLocaleString()} / 10,000 characters
            </span>
          </div>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-lg p-3 text-sm">
            {error}
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!hasConfirmedBaseline || !isValid || isLoading}
            className="inline-flex items-center px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors"
          >
            {isLoading ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
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
    </div>
  );
}

