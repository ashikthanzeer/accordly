"use client";

import React from "react";
import { AccordlyLogo, type AccordlyLogoProps } from "./AccordlyLogo";

export interface AnimatedAccordlyLogoProps extends AccordlyLogoProps {
  glowOnHover?: boolean;
  shimmer?: boolean;
  containerClassName?: string;
}

export function AnimatedAccordlyLogo({
  variant = "full",
  size = "md",
  className = "",
  imageClassName = "",
  priority = false,
  alt = "Accordly",
  glowOnHover = true,
  shimmer = true,
  containerClassName = "",
}: AnimatedAccordlyLogoProps) {
  return (
    <div
      className={`group relative inline-flex items-center select-none cursor-pointer transition-transform duration-300 ease-out hover:scale-[1.02] ${containerClassName}`}
    >
      {/* Ambient Radial Golden Glow on Hover */}
      {glowOnHover && (
        <div
          className="absolute -inset-2 rounded-2xl bg-gradient-to-r from-[#D4AF65]/0 via-[#D4AF65]/15 to-[#D4AF65]/0 blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
          aria-hidden="true"
        />
      )}

      {/* Core Logo with Metallic Drop Shadow */}
      <div className="relative z-10 overflow-hidden rounded-xl">
        <AccordlyLogo
          variant={variant}
          size={size}
          className={className}
          imageClassName={`transition-all duration-300 group-hover:drop-shadow-[0_0_8px_rgba(212,175,101,0.45)] ${imageClassName}`}
          priority={priority}
          alt={alt}
        />

        {/* Specular Shimmer Sweep on Hover */}
        {shimmer && (
          <div
            className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out bg-gradient-to-r from-transparent via-[#F4CF70]/25 to-transparent pointer-events-none"
            aria-hidden="true"
          />
        )}
      </div>
    </div>
  );
}

