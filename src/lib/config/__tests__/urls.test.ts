import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getPublicAppUrl, getPublicReviewUrl } from "../urls";

describe("Application URL Resolver (src/lib/config/urls.ts)", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("resolves to NEXT_PUBLIC_APP_URL when configured", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://accordly.vercel.app";

    const appUrl = getPublicAppUrl("https://render-backend.onrender.com");
    expect(appUrl).toBe("https://accordly.vercel.app");

    const { reviewPath, reviewUrl } = getPublicReviewUrl("abc-123", "https://render-backend.onrender.com");
    expect(reviewPath).toBe("/review/abc-123");
    expect(reviewUrl).toBe("https://accordly.vercel.app/review/abc-123");
  });

  it("strips trailing slashes and subpaths from NEXT_PUBLIC_APP_URL", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://accordly.vercel.app/some/subpath/";

    const appUrl = getPublicAppUrl();
    expect(appUrl).toBe("https://accordly.vercel.app");

    const { reviewUrl } = getPublicReviewUrl("token-xyz");
    expect(reviewUrl).toBe("https://accordly.vercel.app/review/token-xyz");
  });

  it("falls back to requestOrigin when NEXT_PUBLIC_APP_URL is not set", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.APP_URL;

    const appUrl = getPublicAppUrl("https://preview-123.vercel.app");
    expect(appUrl).toBe("https://preview-123.vercel.app");

    const { reviewUrl } = getPublicReviewUrl("tok-999", "https://preview-123.vercel.app");
    expect(reviewUrl).toBe("https://preview-123.vercel.app/review/tok-999");
  });

  it("falls back to localhost:3000 when neither env nor requestOrigin are provided", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.APP_URL;

    const appUrl = getPublicAppUrl();
    expect(appUrl).toBe("http://localhost:3000");

    const { reviewUrl } = getPublicReviewUrl("tok-local");
    expect(reviewUrl).toBe("http://localhost:3000/review/tok-local");
  });

  it("properly encodes tokens in URL path", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://accordly.vercel.app";
    const { reviewUrl } = getPublicReviewUrl("token with spaces");
    expect(reviewUrl).toBe("https://accordly.vercel.app/review/token%20with%20spaces");
  });
});

