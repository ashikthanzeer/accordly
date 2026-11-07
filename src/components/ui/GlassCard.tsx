"use client";

import React, { useRef, useState, useCallback, useMemo } from "react";

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  tilt?: boolean;
  variant?: "default" | "surface" | "gold";
  intensity?: "subtle" | "medium" | "prominent";
  className?: string;
  contentClassName?: string;
}

const LAYOUT_CLASS_REGEX =
  /^(?:[a-z0-9]+:)*(?:flex$|inline-flex$|grid$|inline-grid$|flex-.*|items-.*|justify-.*|content-.*|gap-.*|space-[xy]-.*|divide-.*)/;

export function GlassCard({
  children,
  tilt = false,
  variant = "default",
  intensity = "medium",
  className = "",
  contentClassName = "",
  ...props
}: GlassCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      // Skip cursor tracking on touch devices
      if (e.pointerType === "touch" || !cardRef.current) return;

      const rect = cardRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Update CSS custom properties for specular highlight
      cardRef.current.style.setProperty("--mouse-x", `${x}px`);
      cardRef.current.style.setProperty("--mouse-y", `${y}px`);

      if (tilt) {
        // Skip tilt if user prefers reduced motion
        if (
          typeof window !== "undefined" &&
          window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
        ) {
          return;
        }

        // Safe micro-tilt (max 2.5 degrees)
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const rotateX = ((y - centerY) / centerY) * -2.5;
        const rotateY = ((x - centerX) / centerX) * 2.5;

        cardRef.current.style.transform = `perspective(1000px) rotateX(${rotateX.toFixed(
          2
        )}deg) rotateY(${rotateY.toFixed(2)}deg) translateY(-2px)`;
      }
    },
    [tilt]
  );

  const handlePointerLeave = useCallback(() => {
    setIsHovered(false);
    if (!cardRef.current) return;

    if (tilt) {
      cardRef.current.style.transform =
        "perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0px)";
    }
  }, [tilt]);

  const handlePointerEnter = useCallback(() => {
    setIsHovered(true);
  }, []);

  const getIntensityStyles = () => {
    if (variant === "gold") {
      return "bg-[#171A20]/80 border-[rgba(212,175,101,0.25)] hover:border-[rgba(212,175,101,0.45)] shadow-[0_16px_36px_-12px_rgba(0,0,0,0.7),0_0_25px_-5px_rgba(212,175,101,0.18)]";
    }

    switch (intensity) {
      case "prominent":
        return "bg-[#171A20]/80 border-[rgba(255,255,255,0.12)] hover:border-[rgba(212,175,101,0.4)] hover:shadow-[0_16px_36px_-12px_rgba(0,0,0,0.7),0_0_24px_-4px_rgba(212,175,101,0.22)]";
      case "subtle":
        return "bg-[#171A20]/65 border-[rgba(255,255,255,0.06)] hover:border-[rgba(212,175,101,0.25)] hover:shadow-[0_10px_25px_-10px_rgba(0,0,0,0.5)]";
      case "medium":
      default:
        return "bg-[#171A20]/75 border-[rgba(255,255,255,0.08)] hover:border-[rgba(212,175,101,0.3)] hover:shadow-[0_12px_30px_-10px_rgba(0,0,0,0.6),0_0_20px_-5px_rgba(212,175,101,0.16)]";
    }
  };

  const { outerClassName, innerLayoutClassName } = useMemo(() => {
    if (!className) return { outerClassName: "", innerLayoutClassName: "" };
    const outer: string[] = [];
    const inner: string[] = [];
    const tokens = className.split(/\s+/).filter(Boolean);
    for (const token of tokens) {
      if (LAYOUT_CLASS_REGEX.test(token)) {
        inner.push(token);
      } else {
        outer.push(token);
      }
      if (token === "h-full" || token === "w-full") {
        inner.push(token);
      }
    }
    return {
      outerClassName: outer.join(" "),
      innerLayoutClassName: inner.join(" "),
    };
  }, [className]);

  return (
    <div
      ref={cardRef}
      onPointerMove={handlePointerMove}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      className={`relative rounded-2xl backdrop-blur-md transition-all duration-300 ease-out overflow-hidden ${
        !tilt ? "hover:-translate-y-0.5" : ""
      } ${getIntensityStyles()} ${outerClassName}`}
      {...props}
    >
      {/* Specular Highlight Overlay Following Cursor Position */}
      <div
        aria-hidden="true"
        className={`absolute inset-0 pointer-events-none transition-opacity duration-300 z-10 ${
          isHovered ? "opacity-100" : "opacity-0"
        }`}
        style={{
          background:
            "radial-gradient(350px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(212, 175, 101, 0.12), transparent 75%)",
        }}
      />

      {/* Soft Top Inner Highlight Sheen */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none z-10"
      />

      {/* Content Container */}
      <div
        className={`relative z-20 ${innerLayoutClassName} ${contentClassName}`.trim()}
      >
        {children}
      </div>
    </div>
  );
}
