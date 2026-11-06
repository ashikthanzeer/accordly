import { describe, it, expect } from "vitest";
import {
  generateSecureReviewToken,
  hashReviewToken,
  calculateTokenExpiration,
  isTokenExpired,
  validateTokenAgainstHash,
} from "../tokens";
import crypto from "crypto";

describe("Review Token Cryptography & Verification", () => {
  it("generates 32-byte cryptographically secure random tokens with SHA-256 hash", () => {
    const res1 = generateSecureReviewToken(14);
    const res2 = generateSecureReviewToken(14);

    // 32 bytes in hex = 64 characters
    expect(res1.token).toHaveLength(64);
    expect(res2.token).toHaveLength(64);
    // Unpredictability: two generated tokens must not match
    expect(res1.token).not.toBe(res2.token);
    expect(res1.tokenHash).not.toBe(res2.tokenHash);

    // Verify SHA-256 match
    const expectedHash = crypto.createHash("sha256").update(res1.token).digest("hex");
    expect(res1.tokenHash).toBe(expectedHash);
  });

  it("calculates future expiration timestamps accurately", () => {
    const now = Date.now();
    const expiry7 = calculateTokenExpiration(7);
    const diffDays = (expiry7.getTime() - now) / (1000 * 60 * 60 * 24);
    expect(Math.round(diffDays)).toBe(7);
  });

  it("correctly identifies expired versus active tokens", () => {
    const pastDate = new Date(Date.now() - 10000);
    const futureDate = new Date(Date.now() + 100000);

    expect(isTokenExpired(pastDate)).toBe(true);
    expect(isTokenExpired(futureDate)).toBe(false);
    expect(isTokenExpired(null)).toBe(true);
    expect(isTokenExpired(undefined)).toBe(true);
  });

  it("validates valid tokens successfully", () => {
    const { token, tokenHash, expiresAt } = generateSecureReviewToken(14);
    const validation = validateTokenAgainstHash(token, tokenHash, expiresAt);
    expect(validation.isValid).toBe(true);
    expect(validation.error).toBeUndefined();
  });

  it("rejects token mismatch", () => {
    const { tokenHash, expiresAt } = generateSecureReviewToken(14);
    const wrongToken = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    const validation = validateTokenAgainstHash(wrongToken, tokenHash, expiresAt);
    expect(validation.isValid).toBe(false);
    expect(validation.error).toContain("Invalid review token");
  });

  it("rejects expired review tokens", () => {
    const { token, tokenHash } = generateSecureReviewToken(14);
    const expiredDate = new Date(Date.now() - 5000);
    const validation = validateTokenAgainstHash(token, tokenHash, expiredDate);
    expect(validation.isValid).toBe(false);
    expect(validation.error).toContain("expired");
  });

  it("rejects revoked review links where stored hash is null", () => {
    const validation = validateTokenAgainstHash("any-token", null, new Date(Date.now() + 10000));
    expect(validation.isValid).toBe(false);
    expect(validation.error).toContain("inactive or has been revoked");
  });
});

