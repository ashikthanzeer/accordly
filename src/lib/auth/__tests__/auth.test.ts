import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { resolveAuthBaseUrl, resolveTrustedOrigins, auth } from "../../auth";
import { getAuthenticatedUser, unauthorizedResponse } from "../session";

describe("Google OAuth & Better Auth Configuration (src/lib/auth.ts)", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("resolves public frontend URL from BETTER_AUTH_URL or NEXT_PUBLIC_APP_URL for Vercel-to-Render proxy", () => {
    process.env.BETTER_AUTH_URL = "https://accordly.vercel.app/";
    process.env.NEXT_PUBLIC_APP_URL = "https://other.vercel.app";
    expect(resolveAuthBaseUrl()).toBe("https://accordly.vercel.app");

    delete process.env.BETTER_AUTH_URL;
    expect(resolveAuthBaseUrl()).toBe("https://other.vercel.app");

    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.APP_URL;
    expect(resolveAuthBaseUrl()).toBe("http://localhost:3000");
  });

  it("includes public Vercel origin, Render backend, and localhost in trustedOrigins", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://accordly.vercel.app";
    process.env.BACKEND_API_URL = "https://accordly-api.onrender.com";
    process.env.CORS_ALLOWED_ORIGINS = "https://staging.accordly.app, http://localhost:3000";

    const origins = resolveTrustedOrigins();
    expect(origins).toContain("https://accordly.vercel.app");
    expect(origins).toContain("https://accordly-api.onrender.com");
    expect(origins).toContain("https://staging.accordly.app");
    expect(origins).toContain("http://localhost:3000");
  });
});

describe("Session Lifecycle, User Provisioning & Logout (src/lib/auth/session.ts)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("extracts newly registered or returning Google OAuth user from active session", async () => {
    vi.spyOn(auth.api, "getSession").mockResolvedValueOnce({
      user: {
        id: "usr_google_001",
        name: "Elena Vance",
        email: "elena@vance-studio.io",
        emailVerified: true,
        image: "https://lh3.googleusercontent.com/a/elena-avatar",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      session: {
        id: "sess_abc123",
        userId: "usr_google_001",
        token: "tok_secret_session",
        expiresAt: new Date(Date.now() + 86400000),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    } as any);

    const req = new NextRequest("http://localhost:3000/api/projects", {
      headers: {
        cookie: "better-auth.session_token=tok_secret_session",
      },
    });

    const user = await getAuthenticatedUser(req);
    expect(user).not.toBeNull();
    expect(user?.id).toBe("usr_google_001");
    expect(user?.name).toBe("Elena Vance");
    expect(user?.email).toBe("elena@vance-studio.io");
    expect(user?.image).toBe("https://lh3.googleusercontent.com/a/elena-avatar");
  });

  it("returns null when session is missing, expired, or logged out", async () => {
    vi.spyOn(auth.api, "getSession").mockResolvedValueOnce(null as any);

    const req = new NextRequest("http://localhost:3000/api/projects");
    const user = await getAuthenticatedUser(req);
    expect(user).toBeNull();
  });

  it("builds standard 401 Unauthorized JSON response with optional correlationId", async () => {
    const res = unauthorizedResponse("req_test_401");
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toContain("Authentication required");
    expect(body.correlationId).toBe("req_test_401");
  });
});

