"use client";

import React, { useEffect, useState, useCallback } from "react";
import Image from "next/image";

const STORAGE_KEY = "accordly_intro_seen";

export function AccordlyIntro() {
  const [mounted, setMounted] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [scene, setScene] = useState<number>(0);

  const handleComplete = useCallback(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, "true");
      if (typeof document !== "undefined") {
        document.documentElement.classList.remove("intro-active");
      }
    } catch {
      // Ignore storage errors in restricted contexts
    }
    setIsExiting(true);
    setTimeout(() => {
      setIsVisible(false);
    }, 600);
  }, []);

  useEffect(() => {
    setMounted(true);

    // 1. Accessibility guard: skip intro if user prefers reduced motion
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    // 2. Session guard: skip intro if already displayed during this session
    let alreadySeen = false;
    try {
      alreadySeen = sessionStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      alreadySeen = false;
    }

    if (prefersReducedMotion || alreadySeen) {
      if (typeof document !== "undefined") {
        document.documentElement.classList.remove("intro-active");
      }
      return;
    }

    // Begin sequence
    setIsVisible(true);

    // Phased 6-scene deliberate luxury choreography across ~4.3 seconds
    // Scene 1: Golden Awakening (0.0s – 0.8s)
    setScene(1);

    const t2 = setTimeout(() => setScene(2), 800);  // Scene 2: Document outline draw (0.8s – 1.6s)
    const t3 = setTimeout(() => setScene(3), 1600); // Scene 3: Approval checkmark draw (1.6s – 2.4s)
    const t4 = setTimeout(() => setScene(4), 2400); // Scene 4: Scope-to-Cash arrow trajectory (2.4s – 3.2s)
    const t5 = setTimeout(() => setScene(5), 3200); // Scene 5: Wordmark reveal & reflection sweep (3.2s – 3.8s)
    const t6 = setTimeout(() => setScene(6), 3800); // Scene 6: Website dissolution start (3.8s – 4.3s)
    const tEnd = setTimeout(() => handleComplete(), 4300);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleComplete();
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(t5);
      clearTimeout(t6);
      clearTimeout(tEnd);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleComplete]);

  if (!mounted || !isVisible) {
    return null;
  }

  return (
    <aside
      aria-label="Accordly brand introduction"
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-[#07080B] overflow-hidden transition-opacity duration-700 ease-out ${
        isExiting ? "opacity-0 pointer-events-none" : "opacity-100 pointer-events-auto"
      }`}
    >
      <style>{`
        @keyframes accordlyDrawPath {
          0% { stroke-dashoffset: 600; opacity: 0; }
          15% { opacity: 1; }
          100% { stroke-dashoffset: 0; opacity: 1; }
        }
        @keyframes accordlyDrawCheck {
          0% { stroke-dashoffset: 80; opacity: 0; }
          25% { opacity: 1; }
          100% { stroke-dashoffset: 0; opacity: 1; }
        }
        @keyframes accordlyDrawArrow {
          0% { stroke-dashoffset: 300; opacity: 0; }
          20% { opacity: 1; }
          100% { stroke-dashoffset: 0; opacity: 1; }
        }
        @keyframes accordlyRipple {
          0% { transform: scale(0.85); opacity: 0.9; }
          100% { transform: scale(2.4); opacity: 0; }
        }
        @keyframes accordlySheen {
          0% { transform: translateX(-150%) skewX(-25deg); }
          100% { transform: translateX(250%) skewX(-25deg); }
        }
        @keyframes accordlyDrift {
          0% { transform: translateY(0px) scale(0.9); opacity: 0.3; }
          50% { transform: translateY(-15px) scale(1.1); opacity: 0.8; }
          100% { transform: translateY(-30px) scale(0.9); opacity: 0.2; }
        }
        .anim-draw-doc {
          stroke-dasharray: 600;
          stroke-dashoffset: 0;
          animation: accordlyDrawPath 0.9s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .anim-draw-check {
          stroke-dasharray: 80;
          stroke-dashoffset: 0;
          animation: accordlyDrawCheck 0.65s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .anim-draw-arrow {
          stroke-dasharray: 300;
          stroke-dashoffset: 0;
          animation: accordlyDrawArrow 0.75s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .anim-ripple {
          animation: accordlyRipple 1.2s cubic-bezier(0, 0, 0.2, 1) forwards;
        }
        .anim-sheen {
          animation: accordlySheen 1.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      {/* Skip Button */}
      <button
        type="button"
        onClick={handleComplete}
        className="absolute top-6 right-6 z-50 px-3.5 py-1.5 rounded-full text-xs font-mono font-medium text-[#9298A3] hover:text-[#F4CF70] bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.1] backdrop-blur-md transition-all flex items-center gap-2 group cursor-pointer"
        aria-label="Skip brand introduction"
      >
        <span className="tracking-wider">SKIP INTRO</span>
        <span className="text-[10px] text-[#9298A3] group-hover:text-[#F4CF70] transition-colors">✕</span>
      </button>

      {/* Ambient Radial Golden Glow (Scene 1 — Golden Awakening) */}
      <div
        className={`absolute inset-0 flex items-center justify-center pointer-events-none transition-all duration-1000 ${
          scene >= 1 ? "opacity-100 scale-100" : "opacity-0 scale-75"
        }`}
      >
        <div className="w-[500px] h-[500px] md:w-[700px] md:h-[700px] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(212,175,101,0.18)_0%,rgba(212,175,101,0.06)_45%,rgba(7,8,11,0)_70%)] blur-2xl" />
      </div>

      {/* Golden Micro-Particles (Scene 1 — Golden Awakening) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[
          { top: "35%", left: "42%", delay: "0s", duration: "3.2s", size: "w-1 h-1" },
          { top: "60%", left: "55%", delay: "0.2s", duration: "3.6s", size: "w-1.5 h-1.5" },
          { top: "45%", left: "62%", delay: "0.4s", duration: "3.0s", size: "w-1 h-1" },
          { top: "52%", left: "38%", delay: "0.1s", duration: "3.4s", size: "w-1 h-1" },
          { top: "30%", left: "52%", delay: "0.5s", duration: "3.8s", size: "w-1.5 h-1.5" },
          { top: "68%", left: "46%", delay: "0.3s", duration: "3.3s", size: "w-1 h-1" },
          { top: "40%", left: "35%", delay: "0.6s", duration: "3.5s", size: "w-1 h-1" },
          { top: "58%", left: "65%", delay: "0.4s", duration: "3.1s", size: "w-1.5 h-1.5" },
        ].map((pt, i) => (
          <div
            key={i}
            className={`absolute rounded-full bg-[#F4CF70] shadow-[0_0_8px_#F4CF70] ${pt.size}`}
            style={{
              top: pt.top,
              left: pt.left,
              animation: `accordlyDrift ${pt.duration} ease-in-out infinite`,
              animationDelay: pt.delay,
              opacity: scene >= 1 ? 0.75 : 0,
              transition: "opacity 0.8s ease",
            }}
          />
        ))}
      </div>

      {/* Main Narrative Cinema Stage */}
      <div className="relative z-10 flex flex-col items-center justify-center px-4 max-w-lg w-full">
        {/* Animated Scope-to-Cash Vector Metaphor (Scenes 2, 3, 4) */}
        <div className="relative w-72 h-44 sm:w-80 sm:h-48 flex items-center justify-center">
          <svg
            viewBox="0 0 320 200"
            className="w-full h-full overflow-visible drop-shadow-[0_0_24px_rgba(212,175,101,0.25)]"
          >
            <defs>
              {/* Metallic Gold Gradients */}
              <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#F7D36F" />
                <stop offset="50%" stopColor="#D4AF65" />
                <stop offset="100%" stopColor="#A98746" />
              </linearGradient>

              <linearGradient id="goldBeam" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#F7D36F" stopOpacity="0.2" />
                <stop offset="50%" stopColor="#F4CF70" stopOpacity="1" />
                <stop offset="100%" stopColor="#D4AF65" stopOpacity="0.8" />
              </linearGradient>

              <filter id="goldGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* SCENE 2: Document Animation (Left Document Box) */}
            {scene >= 2 && (
              <g className="transition-all duration-700">
                {/* Document Border Outline */}
                <path
                  d="M 40 40 L 110 40 L 135 65 L 135 160 L 40 160 Z"
                  fill="rgba(17, 19, 24, 0.85)"
                  stroke="url(#goldGradient)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="anim-draw-doc"
                />
                {/* Document Folded Corner */}
                <path
                  d="M 110 40 L 110 65 L 135 65"
                  fill="none"
                  stroke="url(#goldGradient)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="anim-draw-doc"
                />

                {/* Sequential Document Clause Lines */}
                <line
                  x1="55"
                  y1="75"
                  x2="100"
                  y2="75"
                  stroke="#EEC25C"
                  strokeWidth="2"
                  strokeLinecap="round"
                  className="transition-all duration-500"
                  style={{
                    opacity: scene >= 2 ? 0.9 : 0,
                    transitionDelay: "200ms",
                  }}
                />
                <line
                  x1="55"
                  y1="95"
                  x2="120"
                  y2="95"
                  stroke="#D4AF65"
                  strokeWidth="2"
                  strokeLinecap="round"
                  className="transition-all duration-500"
                  style={{
                    opacity: scene >= 2 ? 0.75 : 0,
                    transitionDelay: "450ms",
                  }}
                />
                <line
                  x1="55"
                  y1="115"
                  x2="90"
                  y2="115"
                  stroke="#D4AF65"
                  strokeWidth="2"
                  strokeLinecap="round"
                  className="transition-all duration-500"
                  style={{
                    opacity: scene >= 2 ? 0.6 : 0,
                    transitionDelay: "700ms",
                  }}
                />
              </g>
            )}

            {/* SCENE 3: Commercial Approval Circle & Checkmark */}
            {scene >= 3 && (
              <g className="transition-all duration-500">
                {/* Pulse wave ring */}
                <circle
                  cx="120"
                  cy="140"
                  r="16"
                  fill="none"
                  stroke="#F7D36F"
                  strokeWidth="2"
                  className="anim-ripple origin-center"
                />
                {/* Approval circle background */}
                <circle
                  cx="120"
                  cy="140"
                  r="16"
                  fill="#090A0C"
                  stroke="url(#goldGradient)"
                  strokeWidth="2.5"
                  filter="url(#goldGlow)"
                />
                {/* Checkmark SVG Stroke */}
                <path
                  d="M 112 140 L 118 146 L 129 134"
                  fill="none"
                  stroke="#F4CF70"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="anim-draw-check"
                />
              </g>
            )}

            {/* SCENE 4: Scope-to-Cash Arrow & Invoice Arrival */}
            {scene >= 4 && (
              <g className="transition-all duration-700">
                {/* Animated Scope-to-Cash Trajectory Beam */}
                <path
                  d="M 140 140 C 175 140, 185 85, 215 85"
                  fill="none"
                  stroke="url(#goldBeam)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  filter="url(#goldGlow)"
                  className="anim-draw-arrow"
                />
                {/* Trajectory Arrow Head */}
                <polygon
                  points="218,80 226,85 218,90"
                  fill="#F4CF70"
                  className="transition-opacity duration-500"
                  style={{ opacity: scene >= 4 ? 1 : 0 }}
                />

                {/* Cash/Invoice Settlement Card */}
                <rect
                  x="225"
                  y="55"
                  width="75"
                  height="100"
                  rx="6"
                  fill="rgba(17, 19, 24, 0.9)"
                  stroke="url(#goldGradient)"
                  strokeWidth="2"
                  className="transition-all duration-700"
                  style={{
                    opacity: scene >= 4 ? 1 : 0,
                    transform: scene >= 4 ? "translateY(0)" : "translateY(8px)",
                    transitionDelay: "350ms",
                  }}
                />
                {/* Invoice Header Badge */}
                <rect
                  x="233"
                  y="65"
                  width="35"
                  height="8"
                  rx="2"
                  fill="#F4CF70"
                  style={{ opacity: scene >= 4 ? 0.9 : 0, transitionDelay: "450ms" }}
                />
                {/* Invoice Currency Sign / Check */}
                <text
                  x="262"
                  y="110"
                  fill="#F4CF70"
                  fontSize="22"
                  fontWeight="bold"
                  fontFamily="monospace"
                  textAnchor="middle"
                  style={{ opacity: scene >= 4 ? 1 : 0, transitionDelay: "550ms" }}
                >
                  $
                </text>
                {/* Invoice Verified Line */}
                <line
                  x1="235"
                  y1="135"
                  x2="290"
                  y2="135"
                  stroke="#43B581"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  style={{ opacity: scene >= 4 ? 1 : 0, transitionDelay: "650ms" }}
                />
              </g>
            )}
          </svg>
        </div>

        {/* SCENE 5: Wordmark Reveal & Specular Sheen Sweep */}
        <div
          className={`relative mt-4 flex flex-col items-center transition-all duration-1000 ease-out overflow-hidden px-6 py-2 rounded-2xl ${
            scene >= 5
              ? "opacity-100 translate-y-0 scale-100"
              : "opacity-0 translate-y-4 scale-95"
          }`}
        >
          {/* Official ACCORDLY Wordmark */}
          <div className="relative">
            <Image
              src="/logo/logo-text.png"
              alt="ACCORDLY"
              width={990}
              height={252}
              className="h-7 sm:h-9 w-auto object-contain drop-shadow-[0_0_16px_rgba(212,175,101,0.5)]"
              priority
            />

            {/* Specular Light Sweep Reflection (Scene 5) */}
            {scene >= 5 && (
              <div
                className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-[#FFF4D0]/40 to-transparent pointer-events-none anim-sheen"
                aria-hidden="true"
              />
            )}
          </div>

          {/* Subtitle FinTech Baseline */}
          <p
            className={`text-[10px] sm:text-xs font-mono uppercase tracking-[0.25em] text-[#D4AF65] mt-2 font-semibold transition-all duration-700 ${
              scene >= 5 ? "opacity-90 tracking-[0.3em]" : "opacity-0 tracking-widest"
            }`}
          >
            Scope-to-Cash Commercial Terminal
          </p>
        </div>

        {/* Status Indication (Scene 6 — Transitioning) */}
        <div
          className={`mt-6 flex items-center gap-2 transition-opacity duration-500 ${
            scene >= 6 ? "opacity-100" : "opacity-0"
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#43B581] animate-ping" />
          <span className="text-[11px] font-mono text-[#9298A3] tracking-wide">
            Terminal Ready
          </span>
        </div>
      </div>
    </aside>
  );
}
