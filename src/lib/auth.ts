import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/db";

/**
 * Resolves the canonical public frontend URL for OAuth callbacks and cookie origins.
 * Ensures that even when running on Render behind a Vercel rewrite proxy,
 * Better Auth generates redirect URLs pointing to the public frontend domain.
 */
export function resolveAuthBaseUrl(): string {
  const candidates = [
    process.env.BETTER_AUTH_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.APP_URL,
  ];

  for (const raw of candidates) {
    const trimmed = raw?.trim().replace(/\/+$/, "");
    if (trimmed && /^https?:\/\//i.test(trimmed)) {
      return trimmed;
    }
  }

  return "http://localhost:3000";
}

/**
 * Resolves the list of trusted origins for Better Auth requests and redirects.
 */
export function resolveTrustedOrigins(): string[] {
  const origins = new Set<string>([
    resolveAuthBaseUrl(),
    "http://localhost:3000",
  ]);

  if (process.env.NEXT_PUBLIC_APP_URL?.trim()) {
    origins.add(process.env.NEXT_PUBLIC_APP_URL.trim().replace(/\/+$/, ""));
  }

  if (process.env.BACKEND_API_URL?.trim()) {
    origins.add(process.env.BACKEND_API_URL.trim().replace(/\/+$/, ""));
  }

  if (process.env.CORS_ALLOWED_ORIGINS) {
    for (const item of process.env.CORS_ALLOWED_ORIGINS.split(",")) {
      const cleaned = item.trim().replace(/\/+$/, "");
      if (cleaned) origins.add(cleaned);
    }
  }

  return Array.from(origins);
}

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  baseURL: resolveAuthBaseUrl(),
  secret:
    process.env.BETTER_AUTH_SECRET ||
    "accordly-development-secret-key-minimum-32-chars",
  trustedOrigins: resolveTrustedOrigins(),
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || "missing-google-client-id",
      clientSecret:
        process.env.GOOGLE_CLIENT_SECRET || "missing-google-client-secret",
      scope: ["openid", "profile", "email"],
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes
    },
  },
  advanced: {
    useSecureCookies: process.env.NODE_ENV === "production",
  },
});

export type AuthSession = typeof auth.$Infer.Session;

