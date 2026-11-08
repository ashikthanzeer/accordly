"use client";

import React, { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, useSession } from "@/lib/auth-client";
import { AmbientBackground } from "@/components/ui/AmbientBackground";
import { GlassCard } from "@/components/ui/GlassCard";
import { AnimatedAccordlyLogo } from "@/components/brand/AnimatedAccordlyLogo";

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, isPending: isSessionPending } = useSession();

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const returnToParam = searchParams.get("returnTo") || "/";
  // Prevent open redirects; only allow relative application paths
  const safeCallbackUrl =
    returnToParam.startsWith("/") && !returnToParam.startsWith("//")
      ? returnToParam
      : "/";

  const urlError = searchParams.get("error");

  useEffect(() => {
    if (urlError) {
      setErrorMessage(
        urlError === "access_denied"
          ? "Google sign-in was cancelled. Please try again to access your workspace."
          : `Authentication error: ${urlError}`
      );
    }
  }, [urlError]);

  useEffect(() => {
    if (!isSessionPending && session?.user) {
      router.replace(safeCallbackUrl);
    }
  }, [isSessionPending, session, router, safeCallbackUrl]);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await signIn.social({
        provider: "google",
        callbackURL: safeCallbackUrl,
      });

      if (res?.error) {
        setErrorMessage(
          res.error.message ||
            "Unable to initiate Google sign-in. Verify OAuth configuration."
        );
        setIsLoading(false);
      }
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred during Google sign-in."
      );
      setIsLoading(false);
    }
  };

  return (
    <GlassCard
      intensity="medium"
      className="w-full max-w-md p-8 sm:p-10 space-y-8 relative z-10 border-white/[0.12]"
    >
      {/* Top Brand Header */}
      <div className="flex flex-col items-center text-center space-y-4">
        <div className="p-3 rounded-2xl bg-[#171A20]/90 border border-[#D4AF65]/30 shadow-[0_0_24px_rgba(212,175,101,0.18)]">
          <AnimatedAccordlyLogo variant="symbol" size="md" />
        </div>

        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-[#F5F3ED] font-mono">
              ACCORDLY
            </h1>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#D4AF65]/15 text-[#D4AF65] border border-[#D4AF65]/30 font-mono">
              PRO
            </span>
          </div>
          <p className="text-xs text-[#9298A3] max-w-xs mx-auto leading-relaxed">
            AI-Native Scope-to-Cash Commercial Workspace &amp; Change Order
            Intelligence
          </p>
        </div>
      </div>

      {/* Error Alert Banner */}
      {errorMessage && (
        <div
          role="alert"
          className="p-3.5 rounded-xl bg-[#E55C5C]/10 border border-[#E55C5C]/30 text-xs text-[#E55C5C] leading-relaxed"
        >
          <p className="font-semibold">Sign-In Notice</p>
          <p className="mt-0.5 text-[#F5F3ED]/90">{errorMessage}</p>
        </div>
      )}

      {/* Primary Google Sign-In Section */}
      <div className="space-y-4">
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={isLoading || isSessionPending}
          className="w-full flex items-center justify-center gap-3 px-5 py-3.5 rounded-xl text-sm font-semibold bg-[#F5F3ED] text-[#090A0C] hover:bg-white active:scale-[0.99] transition-all shadow-[0_4px_20px_rgba(0,0,0,0.4)] disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF65]"
        >
          {isLoading ? (
            <>
              <span className="w-4 h-4 rounded-full border-2 border-[#090A0C]/30 border-t-[#090A0C] animate-spin" />
              <span>Connecting to Google...</span>
            </>
          ) : (
            <>
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              <span>Continue with Google</span>
            </>
          )}
        </button>

        <p className="text-[11px] text-center text-[#9298A3] leading-relaxed">
          New to Accordly? Signing in with Google automatically provisions your
          isolated provider workspace.
        </p>
      </div>

      {/* Security & Capabilities Footer */}
      <div className="pt-5 border-t border-white/[0.08] space-y-2.5 text-[11px] text-[#9298A3]">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#43B581]" />
            Isolated Provider Workspace
          </span>
          <span className="font-mono text-[10px] text-[#D4AF65]">
            OAuth 2.0 / OIDC
          </span>
        </div>
        <p className="text-[10px] text-[#9298A3]/80 leading-relaxed">
          Client proposal review links remain accessible via secure token URLs
          without requiring client registration.
        </p>
      </div>
    </GlassCard>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[#090A0C] text-[#F5F3ED] flex flex-col items-center justify-center p-4 relative overflow-hidden selection:bg-[#D4AF65]/30 selection:text-[#F5F3ED]">
      <AmbientBackground showParticles={true} />
      <Suspense
        fallback={
          <div className="w-full max-w-md p-10 rounded-2xl bg-[#111318]/80 border border-white/[0.08] text-center text-xs text-[#9298A3]">
            Loading authentication portal...
          </div>
        }
      >
        <LoginFormContent />
      </Suspense>
    </div>
  );
}

