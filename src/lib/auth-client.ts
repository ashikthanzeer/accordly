import { createAuthClient } from "better-auth/react";

/**
 * Browser-side authentication client for Accordly.
 * Uses relative / current origin requests in browser so Vercel rewrites
 * transparently forward /api/auth/* to the backend service while keeping
 * cookies bound to the frontend domain.
 */
export const authClient = createAuthClient({
  baseURL:
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
});

export const { signIn, signOut, useSession, getSession } = authClient;

