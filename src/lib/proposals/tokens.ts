/**
 * Cryptographic Token Generation & Hashing for Client Proposal Review Links.
 *
 * Uses native Node.js crypto to generate 32-byte secure random tokens.
 * Persists only the one-way SHA-256 digest in the database, preventing token leakage.
 */

import crypto from "crypto";

export interface GeneratedReviewToken {
  token: string; // Plaintext token (returned only once to caller)
  tokenHash: string; // SHA-256 hex digest to be stored in ChangeOrder.reviewTokenHash
  expiresAt: Date;
}

/**
 * Generates an unguessable 32-byte cryptographically secure random token
 * and its SHA-256 hash.
 */
export function generateSecureReviewToken(daysValid: number = 14): GeneratedReviewToken {
  if (daysValid <= 0) {
    throw new Error("Expiration duration must be at least 1 day.");
  }

  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashReviewToken(token);
  const expiresAt = calculateTokenExpiration(daysValid);

  return {
    token,
    tokenHash,
    expiresAt,
  };
}

/**
 * Computes the SHA-256 hex digest of a review token.
 */
export function hashReviewToken(token: string): string {
  if (!token || typeof token !== "string") {
    throw new Error("Token string is required for hashing.");
  }
  return crypto.createHash("sha256").update(token.trim()).digest("hex");
}

/**
 * Calculates a future expiration Date based on days validity.
 */
export function calculateTokenExpiration(daysValid: number = 14): Date {
  const ms = daysValid * 24 * 60 * 60 * 1000;
  return new Date(Date.now() + ms);
}

/**
 * Checks whether a given expiration date has elapsed.
 */
export function isTokenExpired(expiresAt: Date | string | null | undefined): boolean {
  if (!expiresAt) return true;
  const expiry = new Date(expiresAt);
  return expiry.getTime() <= Date.now();
}

/**
 * Validates a plaintext token against the stored SHA-256 hash and expiration timestamp.
 */
export function validateTokenAgainstHash(
  rawToken: string,
  storedHash: string | null | undefined,
  expiresAt: Date | string | null | undefined
): { isValid: boolean; error?: string } {
  if (!rawToken || !rawToken.trim()) {
    return { isValid: false, error: "Review token is missing." };
  }

  if (!storedHash) {
    return { isValid: false, error: "This review link is inactive or has been revoked." };
  }

  const calculatedHash = hashReviewToken(rawToken.trim());
  if (calculatedHash !== storedHash) {
    return { isValid: false, error: "Invalid review token." };
  }

  if (isTokenExpired(expiresAt)) {
    return { isValid: false, error: "This review link has expired." };
  }

  return { isValid: true };
}

