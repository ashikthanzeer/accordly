import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import {
  isOriginAllowed,
  getDefaultAllowedOrigins,
  getCorsHeaders,
  createPreflightResponse,
  applyCorsHeaders,
  cors,
  withCors,
  corsMiddleware,
} from "../cors";

describe("CORS Module (src/lib/cors.ts)", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("Origin Matching (isOriginAllowed)", () => {
    it("permits requests with missing or empty origin (server-to-server, same-origin, webhooks)", () => {
      expect(isOriginAllowed(null)).toBe(true);
      expect(isOriginAllowed(undefined)).toBe(true);
      expect(isOriginAllowed("")).toBe(true);
    });

    it("matches exact allowed origins", () => {
      const options = {
        allowedOrigins: ["https://accordly.com", "https://app.accordly.com"],
      };

      expect(isOriginAllowed("https://accordly.com", options)).toBe(true);
      expect(isOriginAllowed("https://app.accordly.com", options)).toBe(true);
      expect(isOriginAllowed("https://malicious.com", options)).toBe(false);
    });

    it("matches wildcard subdomains (e.g. *.vercel.app)", () => {
      const options = {
        allowedOrigins: ["https://*.vercel.app"],
      };

      expect(
        isOriginAllowed("https://accordly-preview-123.vercel.app", options)
      ).toBe(true);
      expect(
        isOriginAllowed("https://accordly.vercel.app", options)
      ).toBe(true);
      expect(isOriginAllowed("https://evilvercel.app", options)).toBe(false);
      expect(isOriginAllowed("https://otherdomain.com", options)).toBe(false);
    });

    it("matches port wildcards in dev (e.g. http://localhost:*)", () => {
      const options = {
        allowedOrigins: ["http://localhost:*", "http://127.0.0.1:*"],
      };

      expect(isOriginAllowed("http://localhost:3000", options)).toBe(true);
      expect(isOriginAllowed("http://localhost:8080", options)).toBe(true);
      expect(isOriginAllowed("http://127.0.0.1:3000", options)).toBe(true);
      expect(isOriginAllowed("http://example.com", options)).toBe(false);
    });

    it("supports RegExp patterns", () => {
      const options = {
        allowedOrigins: [/^https:\/\/([a-z0-9-]+\.)?accordly\.com$/],
      };

      expect(isOriginAllowed("https://accordly.com", options)).toBe(true);
      expect(isOriginAllowed("https://staging.accordly.com", options)).toBe(true);
      expect(isOriginAllowed("https://notaccordly.com", options)).toBe(false);
    });

    it("supports boolean flags", () => {
      expect(isOriginAllowed("https://any-origin.com", { allowedOrigins: true })).toBe(true);
      expect(isOriginAllowed("https://any-origin.com", { allowedOrigins: false })).toBe(false);
    });

    it("supports function predicates", () => {
      const options = {
        allowedOrigins: (origin: string | null | undefined) =>
          Boolean(origin?.endsWith(".internal.company")),
      };

      expect(isOriginAllowed("https://app.internal.company", options)).toBe(true);
      expect(isOriginAllowed("https://external.com", options)).toBe(false);
    });

    it("reads allowed origins from CORS_ALLOWED_ORIGINS environment variable", () => {
      process.env.CORS_ALLOWED_ORIGINS = "https://prod.accordly.com, https://admin.accordly.com";
      (process.env as Record<string, string | undefined>).NODE_ENV = "production";

      expect(isOriginAllowed("https://prod.accordly.com")).toBe(true);
      expect(isOriginAllowed("https://admin.accordly.com")).toBe(true);
      expect(isOriginAllowed("https://attacker.com")).toBe(false);
    });

    it("reads JSON-formatted CORS_ALLOWED_ORIGINS", () => {
      process.env.CORS_ALLOWED_ORIGINS = '["https://api.accordly.com", "https://*.acme.org"]';
      (process.env as Record<string, string | undefined>).NODE_ENV = "production";

      expect(isOriginAllowed("https://api.accordly.com")).toBe(true);
      expect(isOriginAllowed("https://test.acme.org")).toBe(true);
      expect(isOriginAllowed("https://other.com")).toBe(false);
    });

    it("reads NEXT_PUBLIC_APP_URL environment variable", () => {
      process.env.NEXT_PUBLIC_APP_URL = "https://checkout.accordly.com/pay";
      (process.env as Record<string, string | undefined>).NODE_ENV = "production";

      expect(isOriginAllowed("https://checkout.accordly.com")).toBe(true);
      expect(isOriginAllowed("https://other.com")).toBe(false);
    });
  });

  describe("CORS Headers Generation (getCorsHeaders)", () => {
    it("returns standard CORS headers for allowed origin", () => {
      const req = new NextRequest("http://localhost:3000/api/dashboard", {
        headers: { origin: "https://accordly.com" },
      });

      const headers = getCorsHeaders(req, {
        allowedOrigins: ["https://accordly.com"],
      });

      expect(headers["Access-Control-Allow-Origin"]).toBe("https://accordly.com");
      expect(headers["Access-Control-Allow-Credentials"]).toBe("true");
      expect(headers["Vary"]).toBe("Origin");
      expect(headers["Access-Control-Allow-Methods"]).toContain("GET");
      expect(headers["Access-Control-Allow-Methods"]).toContain("POST");
      expect(headers["Access-Control-Allow-Headers"]).toContain("Authorization");
      expect(headers["Access-Control-Allow-Headers"]).toContain("X-PayPal-Transmission-Id");
      expect(headers["Access-Control-Max-Age"]).toBe("86400");
    });

    it("omits Access-Control-Allow-Origin when origin is unauthorized", () => {
      const req = new NextRequest("http://localhost:3000/api/dashboard", {
        headers: { origin: "https://unauthorized.com" },
      });

      const headers = getCorsHeaders(req, {
        allowedOrigins: ["https://accordly.com"],
      });

      expect(headers["Access-Control-Allow-Origin"]).toBeUndefined();
    });

    it("supports custom methods, headers, and maxAge", () => {
      const req = new NextRequest("http://localhost:3000/api/dashboard", {
        headers: { origin: "https://accordly.com" },
      });

      const headers = getCorsHeaders(req, {
        allowedOrigins: ["https://accordly.com"],
        allowedMethods: ["GET", "POST"],
        allowedHeaders: ["Content-Type", "X-Custom-Header"],
        maxAge: 3600,
      });

      expect(headers["Access-Control-Allow-Methods"]).toBe("GET, POST");
      expect(headers["Access-Control-Allow-Headers"]).toBe("Content-Type, X-Custom-Header");
      expect(headers["Access-Control-Max-Age"]).toBe("3600");
    });

    it("handles plain object headers in mock requests", () => {
      const mockReq = {
        headers: { origin: "https://accordly.com" },
      };

      const headers = getCorsHeaders(mockReq as any, {
        allowedOrigins: ["https://accordly.com"],
      });

      expect(headers["Access-Control-Allow-Origin"]).toBe("https://accordly.com");
    });
  });

  describe("Preflight and Response Helpers", () => {
    it("createPreflightResponse returns status 204 with CORS headers", () => {
      const req = new NextRequest("http://localhost:3000/api/change-requests", {
        method: "OPTIONS",
        headers: { origin: "https://accordly.com" },
      });

      const res = createPreflightResponse(req, {
        allowedOrigins: ["https://accordly.com"],
      });

      expect(res.status).toBe(204);
      expect(res.headers.get("access-control-allow-origin")).toBe("https://accordly.com");
      expect(res.headers.get("access-control-allow-credentials")).toBe("true");
    });

    it("applyCorsHeaders appends CORS headers onto an existing NextResponse", () => {
      const req = new NextRequest("http://localhost:3000/api/baseline", {
        headers: { origin: "https://accordly.com" },
      });
      const initialRes = NextResponse.json({ success: true }, { status: 200 });

      const updated = applyCorsHeaders(initialRes, req, {
        allowedOrigins: ["https://accordly.com"],
      });

      expect(updated.status).toBe(200);
      expect(updated.headers.get("access-control-allow-origin")).toBe("https://accordly.com");
    });

    it("cors() intercepts OPTIONS request automatically", () => {
      const req = new NextRequest("http://localhost:3000/api/documents", {
        method: "OPTIONS",
        headers: { origin: "https://accordly.com" },
      });

      const res = cors(req, undefined, {
        allowedOrigins: ["https://accordly.com"],
      });

      expect(res).not.toBeNull();
      expect(res?.status).toBe(204);
      expect(res?.headers.get("access-control-allow-origin")).toBe("https://accordly.com");
    });

    it("cors() decorates regular response when provided", () => {
      const req = new NextRequest("http://localhost:3000/api/documents", {
        method: "GET",
        headers: { origin: "https://accordly.com" },
      });
      const response = NextResponse.json({ items: [] });

      const res = cors(req, response, {
        allowedOrigins: ["https://accordly.com"],
      });

      expect(res).toBe(response);
      expect(res?.headers.get("access-control-allow-origin")).toBe("https://accordly.com");
    });
  });

  describe("Higher-Order Wrapper (withCors)", () => {
    it("handles preflight OPTIONS requests without executing handler", async () => {
      let handlerCalled = false;
      const handler = withCors(
        async () => {
          handlerCalled = true;
          return NextResponse.json({ ok: true });
        },
        { allowedOrigins: ["https://accordly.com"] }
      );

      const req = new NextRequest("http://localhost:3000/api/test", {
        method: "OPTIONS",
        headers: { origin: "https://accordly.com" },
      });

      const res = await handler(req);

      expect(handlerCalled).toBe(false);
      expect(res.status).toBe(204);
      expect(res.headers.get("access-control-allow-origin")).toBe("https://accordly.com");
    });

    it("executes handler and attaches CORS headers to successful response", async () => {
      const handler = withCors(
        async (_req) => {
          return NextResponse.json({ data: 42 });
        },
        { allowedOrigins: ["https://accordly.com"] }
      );

      const req = new NextRequest("http://localhost:3000/api/test", {
        method: "POST",
        headers: { origin: "https://accordly.com" },
      });

      const res = await handler(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toEqual({ data: 42 });
      expect(res.headers.get("access-control-allow-origin")).toBe("https://accordly.com");
    });

    it("catches thrown exceptions and attaches CORS headers to 500 response", async () => {
      const handler = withCors(
        async () => {
          throw new Error("Database timeout");
        },
        { allowedOrigins: ["https://accordly.com"] }
      );

      const req = new NextRequest("http://localhost:3000/api/test", {
        method: "GET",
        headers: { origin: "https://accordly.com" },
      });

      const res = await handler(req);
      const body = await res.json();

      expect(res.status).toBe(500);
      expect(body.error).toBe("Database timeout");
      expect(res.headers.get("access-control-allow-origin")).toBe("https://accordly.com");
    });
  });

  describe("Middleware Utility (corsMiddleware)", () => {
    it("returns 204 for OPTIONS preflight in middleware", () => {
      const req = new NextRequest("http://localhost:3000/api/projects", {
        method: "OPTIONS",
        headers: { origin: "https://accordly.com" },
      });

      const result = corsMiddleware(req, {
        allowedOrigins: ["https://accordly.com"],
      });

      expect(result).not.toBeNull();
      expect(result?.status).toBe(204);
      expect(result?.headers.get("access-control-allow-origin")).toBe("https://accordly.com");
    });

    it("returns 403 when origin is disallowed", () => {
      const req = new NextRequest("http://localhost:3000/api/projects", {
        method: "GET",
        headers: { origin: "https://hacker.com" },
      });

      const result = corsMiddleware(req, {
        allowedOrigins: ["https://accordly.com"],
      });

      expect(result).not.toBeNull();
      expect(result?.status).toBe(403);
    });

    it("returns null for allowed non-OPTIONS request allowing pipeline to continue", () => {
      const req = new NextRequest("http://localhost:3000/api/projects", {
        method: "GET",
        headers: { origin: "https://accordly.com" },
      });

      const result = corsMiddleware(req, {
        allowedOrigins: ["https://accordly.com"],
      });

      expect(result).toBeNull();
    });
  });
});
