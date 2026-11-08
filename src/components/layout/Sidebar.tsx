"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatedAccordlyLogo } from "@/components/brand/AnimatedAccordlyLogo";
import { CreateProjectModal } from "@/components/projects/CreateProjectModal";

interface SidebarUser {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

interface SidebarProps {
  projectId?: string;
  projectName?: string;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
  user?: SidebarUser | null;
  onSignOut?: () => void;
}

export function Sidebar({
  projectId,
  projectName,
  isMobileOpen = false,
  onMobileClose,
  user,
  onSignOut,
}: SidebarProps) {
  const pathname = usePathname();
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);

  const isCurrent = (path: string) => {
    if (path === "/" && pathname === "/") return true;
    if (path !== "/" && pathname.startsWith(path)) return true;
    return false;
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/80 backdrop-blur-md lg:hidden transition-opacity"
          onClick={onMobileClose}
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-[#111318]/85 backdrop-blur-xl border-r border-white/[0.08] flex flex-col transition-transform duration-250 ease-out lg:translate-x-0 ${
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Subtle Top Inner Highlight */}
        <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />

        {/* Brand Header */}
        <div className="px-6 py-6 border-b border-white/[0.08]">
          <Link href="/" className="flex items-center gap-3 group">
            <AnimatedAccordlyLogo variant="symbol" size="sm" />
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-base font-bold tracking-tight text-[#F5F3ED] font-mono group-hover:text-[#D4AF65] transition-colors">
                  ACCORDLY
                </span>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#D4AF65]/15 text-[#D4AF65] border border-[#D4AF65]/30 font-mono">
                  PRO
                </span>
              </div>
              <p className="text-[10px] text-[#9298A3] tracking-wide mt-0.5 font-medium">
                Scope-to-Cash Engine
              </p>
            </div>
          </Link>
        </div>

        {/* Navigation Links */}
        <div className="flex-1 px-3 py-6 space-y-6 overflow-y-auto">
          {/* Main Workspace Navigation */}
          <div>
            <div className="px-3 mb-2 text-[10px] font-bold tracking-wider text-[#9298A3] uppercase">
              Operations
            </div>
            <nav className="space-y-1">
              <Link
                href="/"
                onClick={onMobileClose}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                  isCurrent("/") && !projectId
                    ? "bg-[#171A20]/90 text-[#D4AF65] border border-[#D4AF65]/30 font-semibold shadow-[0_0_12px_-2px_rgba(212,175,101,0.18)]"
                    : "text-[#9298A3] hover:text-[#F5F3ED] hover:bg-white/[0.04]"
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                Executive Dashboard
              </Link>

              <button
                type="button"
                onClick={() => {
                  onMobileClose?.();
                  setIsCreateProjectOpen(true);
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-[#D4AF65] hover:text-[#090A0C] bg-[#D4AF65]/10 hover:bg-[#D4AF65] border border-[#D4AF65]/30 transition-all text-left"
              >
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
                New Project
              </button>
            </nav>
          </div>

          {/* Project Context Navigation (When within a project) */}
          {projectId && (
            <div>
              <div className="px-3 mb-2 flex items-center justify-between">
                <span className="text-[10px] font-bold tracking-wider text-[#D4AF65] uppercase">
                  Project Workspace
                </span>
                <span className="text-[9px] text-[#9298A3] truncate max-w-[90px] font-mono">
                  {projectName || projectId.slice(0, 8)}
                </span>
              </div>
              <nav className="space-y-1">
                <Link
                  href={`/projects/${projectId}/baseline`}
                  onClick={onMobileClose}
                  className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                    isCurrent(`/projects/${projectId}/baseline`)
                      ? "bg-[#171A20]/90 text-[#D4AF65] border border-[#D4AF65]/30 font-semibold shadow-[0_0_12px_-2px_rgba(212,175,101,0.18)]"
                      : "text-[#9298A3] hover:text-[#F5F3ED] hover:bg-white/[0.04]"
                  }`}
                >
                  <span>📄</span>
                  Scope Baseline
                </Link>

                <Link
                  href={`/projects/${projectId}/requests`}
                  onClick={onMobileClose}
                  className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                    isCurrent(`/projects/${projectId}/requests`)
                      ? "bg-[#171A20]/90 text-[#D4AF65] border border-[#D4AF65]/30 font-semibold shadow-[0_0_12px_-2px_rgba(212,175,101,0.18)]"
                      : "text-[#9298A3] hover:text-[#F5F3ED] hover:bg-white/[0.04]"
                  }`}
                >
                  <span>💬</span>
                  Scope Intelligence
                </Link>

                <Link
                  href={`/projects/${projectId}/proposals`}
                  onClick={onMobileClose}
                  className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                    isCurrent(`/projects/${projectId}/proposals`)
                      ? "bg-[#171A20]/90 text-[#D4AF65] border border-[#D4AF65]/30 font-semibold shadow-[0_0_12px_-2px_rgba(212,175,101,0.18)]"
                      : "text-[#9298A3] hover:text-[#F5F3ED] hover:bg-white/[0.04]"
                  }`}
                >
                  <span>📝</span>
                  Change Proposals
                </Link>

                <Link
                  href={`/projects/${projectId}/timeline`}
                  onClick={onMobileClose}
                  className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                    isCurrent(`/projects/${projectId}/timeline`)
                      ? "bg-[#171A20]/90 text-[#D4AF65] border border-[#D4AF65]/30 font-semibold shadow-[0_0_12px_-2px_rgba(212,175,101,0.18)]"
                      : "text-[#9298A3] hover:text-[#F5F3ED] hover:bg-white/[0.04]"
                  }`}
                >
                  <span>⏱️</span>
                  Activity Timeline
                </Link>
              </nav>
            </div>
          )}

          {/* Integration Status Badge */}
          <div className="p-3.5 bg-[#171A20]/75 backdrop-blur-md rounded-xl border border-white/[0.08] space-y-2 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-[#9298A3] uppercase tracking-wider">
                Invoicing Engine
              </span>
              <span className="flex items-center gap-1 text-[10px] font-semibold text-[#43B581]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#43B581] animate-pulse" />
                Active
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#F5F3ED]">PayPal Sandbox</span>
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-white/[0.06] text-[#D4AF65] font-mono">v2</span>
            </div>
            <p className="text-[10px] text-[#9298A3] leading-relaxed">
              Authoritative payment reconciliation enabled.
            </p>
          </div>
        </div>

        {/* User Profile Footer */}
        <div className="p-4 border-t border-white/[0.08] bg-[#090A0C]/60 backdrop-blur-md">
          <div className="flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {user?.image ? (
                <img
                  src={user.image}
                  alt={user.name || "User avatar"}
                  referrerPolicy="no-referrer"
                  className="w-8 h-8 rounded-full object-cover border border-[#D4AF65]/40 shrink-0 shadow-sm"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-[#171A20] border border-[#D4AF65]/40 flex items-center justify-center text-xs font-bold text-[#D4AF65] shrink-0 shadow-sm">
                  {(user?.name || user?.email || "PR")
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-[#F5F3ED] truncate">
                  {user?.name || "Authenticated Provider"}
                </p>
                <p className="text-[10px] text-[#9298A3] truncate">
                  {user?.email || "Provider Workspace"}
                </p>
              </div>
            </div>

            {onSignOut && (
              <button
                type="button"
                onClick={onSignOut}
                title="Sign out"
                className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-[#9298A3] hover:text-[#F5F3ED] hover:bg-white/[0.06] border border-transparent hover:border-white/[0.08] transition-all shrink-0"
              >
                Sign out
              </button>
            )}
          </div>
        </div>
      </aside>

      <CreateProjectModal
        isOpen={isCreateProjectOpen}
        onClose={() => setIsCreateProjectOpen(false)}
      />
    </>
  );
}
