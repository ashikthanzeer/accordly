"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Sidebar } from "./Sidebar";
import { AmbientBackground } from "@/components/ui/AmbientBackground";
import { AccordlyIntro } from "@/components/brand/AccordlyIntro";

export interface BreadcrumbItem {
  label: string;
  href?: string;
  active?: boolean;
}

interface AppShellProps {
  children: React.ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  projectId?: string;
  projectName?: string;
  actions?: React.ReactNode;
}

export function AppShell({
  children,
  breadcrumbs = [],
  projectId,
  projectName,
  actions,
}: AppShellProps) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#090A0C] text-[#F5F3ED] flex relative selection:bg-[#D4AF65]/30 selection:text-[#F5F3ED]">
      {/* Cinematic Logo Introduction Overlay */}
      <AccordlyIntro />

      {/* Ambient Animated Background Layer */}
      <AmbientBackground showParticles={true} />

      {/* Sidebar Navigation */}
      <Sidebar
        projectId={projectId}
        projectName={projectName}
        isMobileOpen={isMobileOpen}
        onMobileClose={() => setIsMobileOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64 relative z-10">
        {/* Top Header / Breadcrumbs Bar with Frosted Glass Surface */}
        <header className="sticky top-0 z-30 bg-[#090A0C]/80 backdrop-blur-md border-b border-white/[0.08] px-4 sm:px-6 lg:px-8 py-3.5 transition-all">
          {/* Subtle Top Specular Line */}
          <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />

          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              {/* Mobile Hamburger Button */}
              <button
                type="button"
                onClick={() => setIsMobileOpen(true)}
                className="lg:hidden p-2 rounded-xl text-[#9298A3] hover:text-[#F5F3ED] hover:bg-[#171A20]/80 focus:outline-none transition-colors"
                aria-label="Open sidebar"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>

              {/* Breadcrumbs */}
              <nav className="flex items-center space-x-2 text-xs text-[#9298A3] truncate">
                <Link
                  href="/"
                  className="hover:text-[#D4AF65] transition-colors flex items-center gap-1.5 font-medium"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF65] shadow-[0_0_8px_rgba(212,175,101,0.6)]" />
                  Dashboard
                </Link>

                {breadcrumbs.map((b, idx) => (
                  <React.Fragment key={idx}>
                    <span className="text-[#292D35]">/</span>
                    {b.href && !b.active ? (
                      <Link
                        href={b.href}
                        className="hover:text-[#D4AF65] transition-colors truncate max-w-[150px] font-medium"
                      >
                        {b.label}
                      </Link>
                    ) : (
                      <span className="text-[#F5F3ED] font-semibold truncate max-w-[180px]">
                        {b.label}
                      </span>
                    )}
                  </React.Fragment>
                ))}
              </nav>
            </div>

            {/* Right Header Actions */}
            <div className="flex items-center gap-3">
              {actions}
              <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-white/[0.08]">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#171A20]/80 backdrop-blur-sm text-[#D4AF65] border border-white/[0.08] shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF65] animate-pulse" />
                  Sandbox Mode
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Page Body */}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-8 max-w-7xl w-full mx-auto space-y-8">
          {children}
        </main>
      </div>
    </div>
  );
}
