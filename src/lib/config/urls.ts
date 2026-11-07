/**
 * Centralized Application URL and Review Link Resolver.
 *
 * Ensures that client-facing review URLs strictly resolve to the public Vercel frontend
 * (via NEXT_PUBLIC_APP_URL) rather than the Render backend server origin.
 */

/**
 * Returns the sanitized base URL for the client-facing application.
 *
 * Precedence:
 * 1. NEXT_PUBLIC_APP_URL or APP_URL (validated absolute HTTP/HTTPS URL)
 * 2. requestOrigin (fallback during local development or SSR)
 * 3. http://localhost:3000 (safe local development default)
 */
export function getPublicAppUrl(requestOrigin?: string | null): string {
  const envUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL)?.trim();

  if (envUrl) {
    try {
      const parsed = new URL(envUrl);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        // Return protocol + host (without trailing slash or subpaths)
        return parsed.origin;
      }
    } catch {
      // Invalid URL format in environment variable
      console.warn(
        `[URL Config] NEXT_PUBLIC_APP_URL is not a valid absolute URL: "${envUrl}".`
      );
    }
  }

  if (requestOrigin) {
    try {
      const parsed = new URL(requestOrigin);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        return parsed.origin;
      }
    } catch {
      // Invalid requestOrigin
    }
  }

  if (process.env.NODE_ENV === "production") {
    console.warn(
      "[URL Config] WARNING: NEXT_PUBLIC_APP_URL is not set in production. Falling back to http://localhost:3000."
    );
  }

  return "http://localhost:3000";
}

/**
 * Builds the full client review URL for a given review token.
 * Example: https://accordly.vercel.app/review/tok_12345
 */
export function getPublicReviewUrl(
  token: string,
  requestOrigin?: string | null
): { reviewPath: string; reviewUrl: string } {
  const cleanToken = encodeURIComponent(token.trim());
  const reviewPath = `/review/${cleanToken}`;
  const baseAppUrl = getPublicAppUrl(requestOrigin);
  const reviewUrl = `${baseAppUrl}${reviewPath}`;

  return { reviewPath, reviewUrl };
}

