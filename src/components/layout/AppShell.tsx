"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "@/lib/auth-client";
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
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, isPending } = useSession();

  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isPending && !session?.user) {
      const returnTo = encodeURIComponent(pathname || "/");
      router.replace(`/login?returnTo=${returnTo}`);
    }
  }, [isPending, session, pathname, router]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        accountMenuRef.current &&
        !accountMenuRef.current.contains(e.target as Node)
      ) {
        setIsAccountMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    setIsAccountMenuOpen(false);
    await signOut();
    router.replace("/login");
  };

  // Prevent flashing protected content before session check finishes or redirects
  if (isPending || !session?.user) {
    return (
      <div className="min-h-screen bg-[#090A0C] text-[#F5F3ED] flex items-center justify-center relative">
        <AmbientBackground showParticles={false} />
        <div className="flex flex-col items-center gap-3 z-10">
          <div className="w-7 h-7 rounded-full border-2 border-[#D4AF65]/30 border-t-[#D4AF65] animate-spin" />
          <p className="text-xs text-[#9298A3] font-mono">
            Verifying provider session...
          </p>
        </div>
      </div>
    );
  }

  const user = session.user;
  const userInitials = (user.name || user.email || "PR")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen bg-[#090A0C] text-[#F5F3ED] flex relative selection:bg-[#D4AF65]/30 selection:text-[#F5F3ED]">
      {/* Cinematic Logo Introduction Overlay */}
      <AccordlyIntro />

      <div
        id="accordly-shell"
        className="flex-1 flex min-h-screen relative w-full"
      >
        {/* Ambient Animated Background Layer */}
        <AmbientBackground showParticles={true} />

        {/* Sidebar Navigation */}
        <Sidebar
          projectId={projectId}
          projectName={projectName}
          isMobileOpen={isMobileOpen}
          onMobileClose={() => setIsMobileOpen(false)}
          user={user}
          onSignOut={handleSignOut}
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
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M4 6h16M4 12h16M4 18h16"
                    />
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

              {/* Right Header Actions & Authenticated User Menu */}
              <div className="flex items-center gap-3">
                {actions}

                <div className="hidden md:flex items-center gap-2 pl-3 border-l border-white/[0.08]">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#171A20]/80 backdrop-blur-sm text-[#D4AF65] border border-white/[0.08] shadow-sm whitespace-nowrap">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF65] animate-pulse" />
                    Sandbox Mode
                  </span>
                </div>

                {/* Account Dropdown Menu */}
                <div className="relative pl-2 border-l border-white/[0.08]" ref={accountMenuRef}>
                  <button
                    type="button"
                    onClick={() => setIsAccountMenuOpen((prev) => !prev)}
                    className="flex items-center gap-2.5 p-1 pr-2.5 rounded-full bg-[#171A20]/80 hover:bg-[#171A20] border border-white/[0.08] hover:border-[#D4AF65]/40 transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#D4AF65]"
                    aria-expanded={isAccountMenuOpen}
                    aria-haspopup="true"
                  >
                    {user.image ? (
                      <img
                        src={user.image}
                        alt={user.name || "Provider"}
                        referrerPolicy="no-referrer"
                        className="w-7 h-7 rounded-full object-cover border border-[#D4AF65]/40"
                      />
                    ) : (
                      <span className="w-7 h-7 rounded-full bg-[#111318] border border-[#D4AF65]/40 flex items-center justify-center text-[11px] font-bold text-[#D4AF65]">
                        {userInitials}
                      </span>
                    )}
                    <span className="hidden sm:block text-xs font-semibold text-[#F5F3ED] max-w-[120px] truncate">
                      {user.name || user.email}
                    </span>
                  </button>

                  {isAccountMenuOpen && (
                    <div className="absolute right-0 mt-2 w-60 rounded-2xl bg-[#111318] border border-white/[0.12] shadow-[0_12px_36px_rgba(0,0,0,0.65)] p-2 z-50 space-y-1">
                      <div className="px-3 py-2 border-b border-white/[0.08]">
                        <p className="text-xs font-bold text-[#F5F3ED] truncate">
                          {user.name || "Provider Account"}
                        </p>
                        <p className="text-[11px] text-[#9298A3] font-mono truncate">
                          {user.email}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleSignOut}
                        className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-[#E55C5C] hover:bg-[#E55C5C]/10 transition-colors flex items-center justify-between"
                      >
                        <span>Sign Out</span>
                        <span aria-hidden="true">&rarr;</span>
                      </button>
                    </div>
                  )}
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
    </div>
  );
}
