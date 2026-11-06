"use client";

import React, { useState } from "react";

interface ClientShareModalProps {
  isOpen: boolean;
  projectId: string;
  proposalId: string;
  proposalVersion: number;
  clientEmail?: string;
  onClose: () => void;
  onLinkGenerated?: (data: { reviewUrl: string; expiresAt: string }) => void;
}

export function ClientShareModal({
  isOpen,
  projectId,
  proposalId,
  proposalVersion,
  clientEmail,
  onClose,
  onLinkGenerated,
}: ClientShareModalProps) {
  const [daysValid, setDaysValid] = useState<number>(14);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/proposals/${proposalId}/share`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ daysValid }),
        }
      );

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to generate review link.");
      }

      setGeneratedUrl(data.reviewUrl);
      setExpiresAt(data.expiresAt);
      if (onLinkGenerated) {
        onLinkGenerated({
          reviewUrl: data.reviewUrl,
          expiresAt: data.expiresAt,
        });
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error generating link");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!generatedUrl) return;
    try {
      await navigator.clipboard.writeText(generatedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
      alert("Please copy the URL manually from the input.");
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              🔗
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Share Proposal with Client
              </h3>
              <p className="text-xs text-slate-500">
                Proposal Version v{proposalVersion}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-lg leading-none"
          >
            &times;
          </button>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-lg p-3 text-xs">
            {error}
          </div>
        )}

        {!generatedUrl ? (
          <div className="space-y-4 text-xs text-slate-700">
            <p className="text-slate-600">
              Generate a unique, cryptographically secure review link. Your client will see the exact approved deliverables, pricing, and timeline, and can explicitly accept or reject the proposal.
            </p>

            {clientEmail && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <span className="text-slate-400 font-medium">Intended Recipient:</span>{" "}
                <span className="font-semibold text-slate-800">{clientEmail}</span>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                Link Expiration Duration
              </label>
              <select
                value={daysValid}
                onChange={(e) => setDaysValid(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value={7}>7 Days</option>
                <option value={14}>14 Days (Default)</option>
                <option value={30}>30 Days</option>
                <option value={60}>60 Days</option>
              </select>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isGenerating}
                onClick={handleGenerate}
                className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50"
              >
                {isGenerating ? "Generating..." : "Generate Secure Review Link →"}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 text-xs">
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3.5 text-emerald-900 space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                </svg>
                Secure Link Generated!
              </p>
              <p className="text-[11px] text-emerald-800">
                Expires on {expiresAt ? new Date(expiresAt).toLocaleDateString() : "in 14 days"}.
                Only the one-way SHA-256 hash is saved in our database.
              </p>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                Client Review URL
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={generatedUrl}
                  className="flex-1 px-3 py-2 rounded-lg border border-slate-300 bg-slate-50 text-xs font-mono text-slate-800 select-all focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shadow-sm ${
                    copied
                      ? "bg-emerald-600 text-white"
                      : "bg-indigo-600 text-white hover:bg-indigo-700"
                  }`}
                >
                  {copied ? "Copied!" : "Copy URL"}
                </button>
              </div>
            </div>

            <p className="text-[11px] text-slate-500">
              Share this link directly via email, message, or Slack. When your client accepts or rejects, your proposal status will update automatically.
            </p>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

