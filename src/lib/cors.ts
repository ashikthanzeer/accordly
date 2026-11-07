import { NextRequest, NextResponse } from "next/server";

export interface CorsOptions {
  /**
   * Allowed origin(s). Can be:
   * - A single string (e.g. 'https://accordly.com', wildcard 'https://*.vercel.app', or '*')
   * - An array of strings or RegExp patterns
   * - A boolean (true allows any requesting origin, false denies all cross-origin requests)
   * - A function receiving origin and returning boolean
   * Defaults to reading CORS_ALLOWED_ORIGINS, NEXT_PUBLIC_APP_URL, etc., or localhost in dev.
   */
  allowedOrigins?:
    | string
    | (string | RegExp)[]
    | boolean
    | ((origin: string | null | undefined) => boolean);

  /**
   * Allowed HTTP methods.
   * Defaults to: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD']
   */
  allowedMethods?: string[] | string;

  /**
   * Allowed request headers.
   * Defaults to standard headers + PayPal webhook transmission headers.
   */
  allowedHeaders?: string[] | string;

  /**
   * Headers exposed to the browser.
   * Defaults to: ['Content-Length', 'Content-Range', 'X-Total-Count', 'ETag']
   */
  exposedHeaders?: string[] | string;

  /**
   * Whether Access-Control-Allow-Credentials is true.
   * Defaults to true.
   * When true, Access-Control-Allow-Origin cannot be '*'; it returns the explicit matched origin.
   */
  credentials?: boolean;

  /**
   * Preflight cache duration in seconds (Access-Control-Max-Age).
   * Defaults to 86400 (24 hours).
   */
  maxAge?: number;
}

const DEFAULT_METHODS = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "OPTIONS",
  "HEAD",
];

const DEFAULT_HEADERS = [
  "Content-Type",
  "Authorization",
  "X-Requested-With",
  "Accept",
  "Origin",
  "X-PayPal-Transmission-Id",
  "X-PayPal-Transmission-Time",
  "X-PayPal-Transmission-Sig",
  "X-PayPal-Cert-Url",
  "X-PayPal-Auth-Algo",
];

const DEFAULT_EXPOSED_HEADERS = [
  "Content-Length",
  "Content-Range",
  "X-Total-Count",
  "ETag",
];

/**
 * Normalizes pattern string into regular expression support (e.g. *.vercel.app).
 */
function matchOriginPattern(pattern: string | RegExp, origin: string): boolean {
  if (pattern instanceof RegExp) {
    return pattern.test(origin);
  }
  if (pattern === "*") {
    return true;
  }
  if (pattern === origin) {
    return true;
  }
  if (pattern.includes("*")) {
    const escaped = pattern
      .split("*")
      .map((part) => part.replace(/[.+?^$()|[\]\\]/g, "\\$&"))
      .join("[a-zA-Z0-9-_.]+");
    const regex = new RegExp(`^${escaped}$`, "i");
    return regex.test(origin);
  }
  return false;
}

/**
 * Resolves the list of allowed origins from configuration and environment variables.
 */
export function getDefaultAllowedOrigins(): (string | RegExp)[] {
  const origins: (string | RegExp)[] = [];

  // Parse CORS_ALLOWED_ORIGINS or ALLOWED_ORIGINS
  const envCors = process.env.CORS_ALLOWED_ORIGINS || process.env.ALLOWED_ORIGINS;
  if (envCors) {
    try {
      if (envCors.startsWith("[") && envCors.endsWith("]")) {
        const parsed = JSON.parse(envCors);
        if (Array.isArray(parsed)) {
          origins.push(...parsed);
        }
      } else {
        origins.push(
          ...envCors
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        );
      }
    } catch {
      origins.push(
        ...envCors
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      );
    }
  }

  // Parse app URLs
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  if (appUrl) {
    try {
      const url = new URL(appUrl);
      origins.push(url.origin);
    } catch {
      origins.push(appUrl.trim());
    }
  }

  // Parse Vercel deployment URLs if present
  if (process.env.VERCEL_URL) {
    origins.push(`https://${process.env.VERCEL_URL}`);
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    origins.push(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`);
  }

  // In non-production or development, include localhost and loopback interfaces
  if (process.env.NODE_ENV !== "production") {
    origins.push("http://localhost:*");
    origins.push("http://127.0.0.1:*");
    origins.push("https://localhost:*");
  }

  return origins;
}

/**
 * Checks whether an incoming origin header is permitted.
 */
export function isOriginAllowed(
  origin: string | null | undefined,
  options?: CorsOptions
): boolean {
  if (!origin) {
    // Requests with no origin (e.g. server-side, curl, same-origin, PayPal webhooks)
    return true;
  }

  const customAllowed = options?.allowedOrigins;

  if (typeof customAllowed === "boolean") {
    return customAllowed;
  }

  if (typeof customAllowed === "function") {
    return customAllowed(origin);
  }

  let patterns: (string | RegExp)[] = [];

  if (customAllowed) {
    if (Array.isArray(customAllowed)) {
      patterns = customAllowed;
    } else {
      patterns = [customAllowed];
    }
  } else {
    patterns = getDefaultAllowedOrigins();
  }

  // If no patterns are defined in production and nothing configured, fall back to localhost if dev or deny
  if (patterns.length === 0) {
    return process.env.NODE_ENV !== "production";
  }

  for (const pattern of patterns) {
    if (matchOriginPattern(pattern, origin)) {
      return true;
    }
  }

  return false;
}

/**
 * Safely extracts the 'origin' header from a Request, NextRequest, or headers map.
 */
function extractOrigin(
  request?:
    | Request
    | NextRequest
    | { headers?: Headers | Record<string, string | null | undefined> }
    | null
): string | null {
  if (!request || !request.headers) return null;

  if (typeof (request.headers as Headers).get === "function") {
    return (request.headers as Headers).get("origin");
  }

  const headers = request.headers as Record<string, string | null | undefined>;
  return headers["origin"] || headers["Origin"] || null;
}

/**
 * Generates CORS headers based on request and configuration.
 */
export function getCorsHeaders(
  request?:
    | Request
    | NextRequest
    | { headers?: Headers | Record<string, string | null | undefined> }
    | null,
  options?: CorsOptions
): Record<string, string> {
  const origin = extractOrigin(request);
  const credentials = options?.credentials ?? true;
  const methods = Array.isArray(options?.allowedMethods)
    ? options.allowedMethods.join(", ")
    : options?.allowedMethods || DEFAULT_METHODS.join(", ");
  const headers = Array.isArray(options?.allowedHeaders)
    ? options.allowedHeaders.join(", ")
    : options?.allowedHeaders || DEFAULT_HEADERS.join(", ");
  const exposed = Array.isArray(options?.exposedHeaders)
    ? options.exposedHeaders.join(", ")
    : options?.exposedHeaders || DEFAULT_EXPOSED_HEADERS.join(", ");
  const maxAge = options?.maxAge ?? 86400;

  const corsHeaders: Record<string, string> = {
    "Access-Control-Allow-Methods": methods,
    "Access-Control-Allow-Headers": headers,
    "Access-Control-Expose-Headers": exposed,
    "Access-Control-Max-Age": maxAge.toString(),
  };

  const allowed = isOriginAllowed(origin, options);

  if (allowed) {
    if (origin) {
      corsHeaders["Access-Control-Allow-Origin"] = origin;
      corsHeaders["Vary"] = "Origin";
    } else if (!credentials) {
      corsHeaders["Access-Control-Allow-Origin"] = "*";
    }
  }

  if (credentials) {
    corsHeaders["Access-Control-Allow-Credentials"] = "true";
  }

  return corsHeaders;
}

/**
 * Creates an HTTP 204 No Content preflight response for OPTIONS requests.
 */
export function createPreflightResponse(
  request?: Request | NextRequest | null,
  options?: CorsOptions
): NextResponse {
  const headers = getCorsHeaders(request, options);
  return new NextResponse(null, {
    status: 204,
    headers,
  });
}

/**
 * Injects CORS headers into an existing Response or NextResponse.
 */
export function applyCorsHeaders<T extends Response | NextResponse>(
  response: T,
  request?: Request | NextRequest | null,
  options?: CorsOptions
): T {
  const corsHeaders = getCorsHeaders(request, options);
  for (const [key, value] of Object.entries(corsHeaders)) {
    response.headers.set(key, value);
  }
  return response;
}

/**
 * CORS helper function:
 * - If request is OPTIONS, returns a 204 Preflight response.
 * - If response is provided, attaches CORS headers and returns it.
 * - Otherwise returns null.
 */
export function cors(
  request: Request | NextRequest,
  response?: NextResponse,
  options?: CorsOptions
): NextResponse | null {
  if (request.method === "OPTIONS") {
    return createPreflightResponse(request, options);
  }

  if (response) {
    return applyCorsHeaders(response, request, options);
  }

  return null;
}

/**
 * Higher-order Route Handler wrapper for Next.js App Router API routes.
 *
 * Example:
 * ```ts
 * export const GET = withCors(async (req) => {
 *   return NextResponse.json({ ok: true });
 * });
 *
 * export const OPTIONS = withCors(async () => createPreflightResponse());
 * ```
 */
export function withCors<T extends (req: NextRequest, ...args: any[]) => Promise<Response | NextResponse>>(
  handler: T,
  options?: CorsOptions
): (req: NextRequest, ...args: Parameters<T> extends [any, ...infer Rest] ? Rest : any[]) => Promise<Response | NextResponse> {
  return async (req: NextRequest, ...args: any[]) => {
    if (req.method === "OPTIONS") {
      return createPreflightResponse(req, options);
    }

    try {
      const res = await handler(req, ...args);
      return applyCorsHeaders(res, req, options);
    } catch (err) {
      const errRes = NextResponse.json(
        { error: err instanceof Error ? err.message : "Internal Server Error" },
        { status: 500 }
      );
      return applyCorsHeaders(errRes, req, options);
    }
  };
}

/**
 * Lightweight middleware utility for Next.js middleware.ts.
 */
export function corsMiddleware(
  request: NextRequest,
  options?: CorsOptions
): NextResponse | null {
  if (request.method === "OPTIONS") {
    return createPreflightResponse(request, options);
  }

  const origin = request.headers.get("origin");
  if (origin && !isOriginAllowed(origin, options)) {
    return new NextResponse(JSON.stringify({ error: "CORS origin denied" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  return null;
}

