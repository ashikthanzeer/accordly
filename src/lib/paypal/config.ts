/**
 * PayPal server-side configuration and validation.
 *
 * Enforces separation between Sandbox and Live environments, validates required credentials,
 * and ensures secrets are never accessed on the client.
 */

export type PayPalEnvironment = "sandbox" | "live";

export interface PayPalConfig {
  env: PayPalEnvironment;
  clientId: string;
  clientSecret: string;
  webhookId?: string;
  baseUrl: string;
}

export class PayPalConfigError extends Error {
  constructor(message: string) {
    super(`[PayPalConfigError] ${message}`);
    this.name = "PayPalConfigError";
  }
}

/**
 * Returns whether PayPal credentials are fully populated in the environment.
 */
export function isPayPalConfigured(
  envSource: Record<string, string | undefined> = process.env
): boolean {
  const clientId = envSource.PAYPAL_CLIENT_ID?.trim();
  const clientSecret = envSource.PAYPAL_CLIENT_SECRET?.trim();
  return Boolean(clientId && clientSecret);
}

/**
 * Retrieves and validates the server-side PayPal configuration.
 * Throws PayPalConfigError if required variables are missing or misconfigured.
 */
export function getPayPalConfig(
  envSource: Record<string, string | undefined> = process.env
): PayPalConfig {
  // Prevent execution in browser environments
  if (typeof window !== "undefined") {
    throw new PayPalConfigError(
      "PayPal configuration must never be accessed in client-side code."
    );
  }

  const rawEnv = (envSource.PAYPAL_ENV || "sandbox").trim().toLowerCase();
  if (rawEnv !== "sandbox" && rawEnv !== "live") {
    throw new PayPalConfigError(
      `Invalid PAYPAL_ENV: "${rawEnv}". Must be either "sandbox" or "live".`
    );
  }
  const env: PayPalEnvironment = rawEnv;

  const clientId = envSource.PAYPAL_CLIENT_ID?.trim();
  if (!clientId) {
    throw new PayPalConfigError(
      "Missing required PAYPAL_CLIENT_ID environment variable."
    );
  }

  const clientSecret = envSource.PAYPAL_CLIENT_SECRET?.trim();
  if (!clientSecret) {
    throw new PayPalConfigError(
      "Missing required PAYPAL_CLIENT_SECRET environment variable."
    );
  }

  const defaultBaseUrl =
    env === "sandbox"
      ? "https://api-m.sandbox.paypal.com"
      : "https://api-m.paypal.com";

  let baseUrl = envSource.PAYPAL_BASE_URL?.trim() || defaultBaseUrl;
  // Normalize trailing slashes
  baseUrl = baseUrl.replace(/\/+$/, "");

  // Prevent dangerous environment mismatches
  if (env === "sandbox" && baseUrl.includes("api-m.paypal.com") && !baseUrl.includes("sandbox")) {
    throw new PayPalConfigError(
      "PAYPAL_ENV is set to 'sandbox' but PAYPAL_BASE_URL points to live PayPal API. Keep Sandbox and Live configurations strictly separate."
    );
  }

  if (env === "live" && baseUrl.includes("sandbox")) {
    throw new PayPalConfigError(
      "PAYPAL_ENV is set to 'live' but PAYPAL_BASE_URL points to PayPal Sandbox. Keep Sandbox and Live configurations strictly separate."
    );
  }

  const webhookId = envSource.PAYPAL_WEBHOOK_ID?.trim() || undefined;

  return {
    env,
    clientId,
    clientSecret,
    webhookId,
    baseUrl,
  };
}

