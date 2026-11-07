"use client";

import React, { useEffect, useRef } from "react";

interface AmbientBackgroundProps {
  showParticles?: boolean;
}

export function AmbientBackground({ showParticles = true }: AmbientBackgroundProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const spotlightRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Only attach desktop pointer listener if environment supports fine pointer and reduced-motion is not preferred
    if (typeof window === "undefined") return;

    const mediaFine = window.matchMedia("(pointer: fine)");
    const mediaReduced = window.matchMedia("(prefers-reduced-motion: reduce)");

    if (!mediaFine.matches || mediaReduced.matches) return;

    let rafId: number | null = null;
    let targetX = window.innerWidth / 2;
    let targetY = window.innerHeight / 2;
    let currentX = targetX;
    let currentY = targetY;

    const handlePointerMove = (e: PointerEvent) => {
      targetX = e.clientX;
      targetY = e.clientY;

      if (!rafId) {
        rafId = requestAnimationFrame(updateSpotlight);
      }
    };

    const updateSpotlight = () => {
      // Smooth linear interpolation for gentle cursor follow
      currentX += (targetX - currentX) * 0.12;
      currentY += (targetY - currentY) * 0.12;

      if (spotlightRef.current) {
        spotlightRef.current.style.transform = `translate3d(${currentX - 300}px, ${currentY - 300}px, 0)`;
      }

      if (Math.abs(targetX - currentX) > 0.5 || Math.abs(targetY - currentY) > 0.5) {
        rafId = requestAnimationFrame(updateSpotlight);
      } else {
        rafId = null;
      }
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none overflow-hidden z-0 select-none"
    >
      {/* Primary Deep Canvas Gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#090A0C] via-[#0B0D12] to-[#090A0C]" />

      {/* Ambient Orb 1: Upper Gold Glow */}
      <div
        className="absolute -top-[15%] left-[20%] w-[650px] h-[650px] rounded-full blur-[140px] opacity-40 bg-gradient-to-br from-[#D4AF65]/15 via-[#A98746]/10 to-transparent animate-ambient-a"
      />

      {/* Ambient Orb 2: Lower-Right Slate Graphite Glow */}
      <div
        className="absolute -bottom-[20%] right-[10%] w-[750px] h-[750px] rounded-full blur-[160px] opacity-30 bg-gradient-to-tl from-[#292D35]/30 via-[#171A20]/20 to-transparent animate-ambient-b"
      />

      {/* Ambient Orb 3: Mid-Left Subtle Champagne Pulse */}
      <div
        className="absolute top-[45%] -left-[10%] w-[500px] h-[500px] rounded-full blur-[120px] opacity-20 bg-gradient-to-r from-[#E2C17F]/10 to-transparent animate-ambient-a"
        style={{ animationDelay: "-14s" }}
      />

      {/* Desktop Cursor Spotlight (Smooth Hardware-Accelerated Radial Light) */}
      <div
        ref={spotlightRef}
        className="absolute top-0 left-0 w-[600px] h-[600px] rounded-full pointer-events-none blur-[100px] opacity-25 bg-gradient-to-r from-[#D4AF65]/20 via-[#A98746]/10 to-transparent transition-opacity duration-500 hidden md:block"
        style={{ transform: "translate3d(-9999px, -9999px, 0)" }}
      />

      {/* Sparse Floating Atmospheric Particles (Non-intrusive) */}
      {showParticles && (
        <div className="absolute inset-0 opacity-40">
          <div
            className="absolute top-[20%] left-[15%] w-1.5 h-1.5 rounded-full bg-[#D4AF65] blur-[0.5px] animate-particle-slow"
            style={{ animationDuration: "18s" }}
          />
          <div
            className="absolute top-[35%] right-[25%] w-1 h-1 rounded-full bg-[#E2C17F] blur-[0.5px] animate-particle-slow"
            style={{ animationDuration: "24s", animationDelay: "-6s" }}
          />
          <div
            className="absolute top-[70%] left-[30%] w-1.5 h-1.5 rounded-full bg-[#D4AF65] blur-[0.5px] animate-particle-slow"
            style={{ animationDuration: "20s", animationDelay: "-11s" }}
          />
          <div
            className="absolute top-[80%] right-[15%] w-1 h-1 rounded-full bg-[#9298A3] blur-[0.5px] animate-particle-slow"
            style={{ animationDuration: "22s", animationDelay: "-15s" }}
          />
          <div
            className="absolute top-[50%] right-[45%] w-1 h-1 rounded-full bg-[#D4AF65] blur-[0.5px] animate-particle-slow"
            style={{ animationDuration: "26s", animationDelay: "-8s" }}
          />
        </div>
      )}

      {/* Ultra-subtle Micro-Grid Overlay for Depth */}
      <div
        className="absolute inset-0 opacity-[0.025] pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(rgba(245, 243, 237, 0.4) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />
    </div>
  );
}

