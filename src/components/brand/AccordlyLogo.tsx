import React from "react";
import Image from "next/image";

export interface AccordlyLogoProps {
  variant?: "full" | "symbol" | "wordmark";
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  imageClassName?: string;
  priority?: boolean;
  alt?: string;
}

const SIZE_CONFIG = {
  xs: {
    symbol: "w-6 h-6",
    wordmark: "h-3.5 w-auto",
    gap: "gap-2",
  },
  sm: {
    symbol: "w-8 h-8",
    wordmark: "h-4 w-auto",
    gap: "gap-2.5",
  },
  md: {
    symbol: "w-10 h-10",
    wordmark: "h-5 w-auto",
    gap: "gap-3",
  },
  lg: {
    symbol: "w-14 h-14",
    wordmark: "h-7 w-auto",
    gap: "gap-3.5",
  },
  xl: {
    symbol: "w-20 h-20",
    wordmark: "h-10 w-auto",
    gap: "gap-4",
  },
};

export function AccordlyLogo({
  variant = "full",
  size = "md",
  className = "",
  imageClassName = "",
  priority = false,
  alt = "Accordly",
}: AccordlyLogoProps) {
  const currentSize = SIZE_CONFIG[size] || SIZE_CONFIG.md;

  if (variant === "symbol") {
    return (
      <div
        className={`relative inline-flex items-center justify-center shrink-0 ${currentSize.symbol} ${className}`}
      >
        <Image
          src="/logo/logo.svg"
          alt={alt}
          width={560}
          height={446}
          className={`w-full h-full object-contain ${imageClassName}`}
          priority={priority}
          unoptimized
        />
      </div>
    );
  }

  if (variant === "wordmark") {
    return (
      <div
        className={`relative inline-flex items-center shrink-0 ${currentSize.wordmark} ${className}`}
      >
        <Image
          src="/logo/logo-text.png"
          alt={alt}
          width={990}
          height={252}
          className={`h-full w-auto object-contain ${imageClassName}`}
          priority={priority}
        />
      </div>
    );
  }

  // variant === "full"
  return (
    <div className={`inline-flex items-center ${currentSize.gap} ${className}`}>
      <div
        className={`relative inline-flex items-center justify-center shrink-0 ${currentSize.symbol}`}
      >
        <Image
          src="/logo/logo.svg"
          alt=""
          width={560}
          height={446}
          className={`w-full h-full object-contain ${imageClassName}`}
          priority={priority}
          unoptimized
        />
      </div>
      <div
        className={`relative inline-flex items-center shrink-0 ${currentSize.wordmark}`}
      >
        <Image
          src="/logo/logo-text.png"
          alt={alt}
          width={990}
          height={252}
          className={`h-full w-auto object-contain ${imageClassName}`}
          priority={priority}
        />
      </div>
    </div>
  );
}

