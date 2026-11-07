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
      alert("Please copy the URL manually from the input.");
    }
  };

  return (
    <div className="fixed inset-0 bg-[#090A0C]/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-[#171A20]/95 backdrop-blur-xl border border-white/10 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 relative overflow-hidden">
        {/* Soft specular sheen */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />
        <div className="flex items-center justify-between border-b border-[#292D35] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#D4AF65]/10 border border-[#D4AF65]/30 text-[#D4AF65] flex items-center justify-center font-bold text-sm shadow-sm">
              🔗
            </div>
            <div>
              <h3 className="text-base font-bold text-[#F5F3ED]">
                Share Proposal with Client
              </h3>
              <p className="text-xs text-[#9298A3] font-mono">
                Proposal Version v{proposalVersion}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-[#9298A3] hover:text-[#F5F3ED] text-lg leading-none transition-colors"
          >
            &times;
          </button>
        </div>

        {error && (
          <div className="bg-[#E06C75]/10 border border-[#E06C75]/30 text-[#E06C75] rounded-lg p-3 text-xs">
            {error}
          </div>
        )}

        {!generatedUrl ? (
          <div className="space-y-4 text-xs text-[#F5F3ED]">
            <p className="text-[#9298A3] leading-relaxed">
              Generate a unique, cryptographically secure review link. Your client will see the exact approved deliverables, pricing, and timeline, and can explicitly accept or reject the proposal.
            </p>

            {clientEmail && (
              <div className="bg-[#111318]/80 border border-[#292D35] rounded-xl p-3">
                <span className="text-[#9298A3] font-medium">Intended Recipient:</span>{" "}
                <span className="font-semibold text-[#F5F3ED] font-mono">{clientEmail}</span>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-bold uppercase text-[#9298A3] mb-1">
                Link Expiration Duration
              </label>
              <select
                value={daysValid}
                onChange={(e) => setDaysValid(Number(e.target.value))}
                className="w-full rounded-lg bg-[#090A0C]/90 border border-[#292D35] px-3 py-2 text-xs font-semibold text-[#F5F3ED] focus:outline-none focus:border-[#D4AF65] transition-colors"
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
                className="px-4 py-2 rounded-lg text-xs font-semibold text-[#9298A3] hover:text-[#F5F3ED] hover:bg-[#1D2129] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isGenerating}
                onClick={handleGenerate}
                className="px-4 py-2 rounded-lg text-xs font-bold text-[#090A0C] bg-[#D4AF65] hover:bg-[#E2C17F] transition-all shadow-sm shadow-[#D4AF65]/20 active:scale-[0.98] disabled:opacity-50"
              >
                {isGenerating ? "Generating..." : "Generate Secure Review Link →"}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 text-xs">
            <div className="bg-[#43B581]/10 border border-[#43B581]/30 rounded-xl p-3.5 text-[#43B581] space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <svg className="w-4 h-4 text-[#43B581]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                </svg>
                Secure Link Generated!
              </p>
              <p className="text-[11px] text-[#43B581]/80">
                Expires on {expiresAt ? new Date(expiresAt).toLocaleDateString() : "in 14 days"}.
                Only the one-way SHA-256 hash is saved in the database.
              </p>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase text-[#9298A3] mb-1">
                Client Review URL
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={generatedUrl}
                  className="flex-1 px-3 py-2 rounded-lg border border-[#292D35] bg-[#090A0C]/90 text-xs font-mono text-[#F5F3ED] select-all focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap shadow-sm active:scale-[0.98] ${
                    copied
                      ? "bg-[#43B581] text-[#090A0C] shadow-[#43B581]/25"
                      : "bg-[#D4AF65] text-[#090A0C] hover:bg-[#E2C17F] shadow-[#D4AF65]/25"
                  }`}
                >
                  {copied ? "Copied!" : "Copy URL"}
                </button>
              </div>
            </div>

            <p className="text-[11px] text-[#9298A3]">
              Share this link directly via email, message, or Slack. When your client accepts or rejects, your proposal status will update automatically.
            </p>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-[#F5F3ED] bg-[#111318] border border-[#292D35] hover:border-[#D4AF65] transition-colors active:scale-[0.98]"
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
