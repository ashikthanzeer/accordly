/**
 * PayPal OAuth 2.0 Client Credentials authentication service.
 *
 * Handles server-side token acquisition, in-memory caching with expiry safety margin,
 * and sanitized error reporting to prevent credential leakage.
 */

import { getPayPalConfig, type PayPalConfig } from "./config";
import { PayPalApiError } from "./types";

interface CachedToken {
  accessToken: string;
  expiresAt: number; // epoch ms
  env: string;
  clientId: string;
  scope?: string;
}

let cachedToken: CachedToken | null = null;

// Default OAuth scopes required for Accordly's invoicing and webhook lifecycle
export const ACCORDLY_PAYPAL_SCOPES =
  "https://uri.paypal.com/services/invoicing https://uri.paypal.com/services/applications/webhooks";

// Refresh token 60 seconds before it officially expires
const EXPIRY_BUFFER_MS = 60 * 1000;

/**
 * Clears the in-memory token cache. Useful for tests or force-refreshing.
 */
export function clearPayPalTokenCache(): void {
  cachedToken = null;
}

export interface OAuthTokenResult {
  accessToken: string;
  scope?: string;
  expiresIn: number;
}

export interface GetTokenOptions {
  scope?: string;
}

/**
 * Obtains an OAuth 2.0 access token using the Client Credentials flow.
 * Caches valid tokens in memory until near expiry.
 */
export async function getPayPalTokenDetails(
  customConfig?: PayPalConfig,
  options?: GetTokenOptions
): Promise<OAuthTokenResult> {
  const config = customConfig || getPayPalConfig();
  const requestedScope = options?.scope ?? ACCORDLY_PAYPAL_SCOPES;

  const tokenUrl = `${config.baseUrl}/v1/oauth2/token`;
  const credentials = Buffer.from(
    `${config.clientId}:${config.clientSecret}`
  ).toString("base64");

  const bodyParams = new URLSearchParams();
  bodyParams.set("grant_type", "client_credentials");
  if (requestedScope) {
    bodyParams.set("scope", requestedScope);
  }

  let response: Response;
  try {
    response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Language": "en_US",
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: bodyParams.toString(),
    });
  } catch (err: unknown) {
    throw new PayPalApiError({
      message: `Network error while contacting PayPal OAuth endpoint: ${
        err instanceof Error ? err.message : String(err)
      }`,
      status: 0,
      statusText: "NetworkError",
    });
  }

  const debugId = response.headers.get("paypal-debug-id") || undefined;

  if (!response.ok) {
    let errorBody: unknown;
    try {
      errorBody = await response.json();
    } catch {
      errorBody = await response.text();
    }

    const errorDesc =
      typeof errorBody === "object" && errorBody !== null && "error_description" in errorBody
        ? String((errorBody as { error_description: unknown }).error_description)
        : typeof errorBody === "object" && errorBody !== null && "message" in errorBody
        ? String((errorBody as { message: unknown }).message)
        : response.statusText;

    throw new PayPalApiError({
      message: `Failed to obtain PayPal OAuth access token: ${errorDesc}`,
      status: response.status,
      statusText: response.statusText,
      paypalDebugId: debugId,
      details: errorBody,
    });
  }

  interface OAuthTokenResponse {
    scope?: string;
    access_token: string;
    token_type: string;
    app_id?: string;
    expires_in: number;
    nonce?: string;
  }

  const data = (await response.json()) as OAuthTokenResponse;

  if (!data.access_token) {
    throw new PayPalApiError({
      message: "PayPal OAuth response did not contain an access_token.",
      status: response.status,
      statusText: response.statusText,
      paypalDebugId: debugId,
      details: data,
    });
  }

  const expiresInSec = typeof data.expires_in === "number" ? data.expires_in : 3600;
  cachedToken = {
    accessToken: data.access_token,
    expiresAt: Date.now() + expiresInSec * 1000,
    env: config.env,
    clientId: config.clientId,
    scope: requestedScope,
  };

  return {
    accessToken: data.access_token,
    scope: data.scope,
    expiresIn: expiresInSec,
  };
}

/**
 * Obtains an OAuth 2.0 access token using the Client Credentials flow.
 * Caches valid tokens in memory until near expiry.
 */
export async function getPayPalAccessToken(
  customConfig?: PayPalConfig,
  options?: GetTokenOptions
): Promise<string> {
  const config = customConfig || getPayPalConfig();
  const requestedScope = options?.scope ?? ACCORDLY_PAYPAL_SCOPES;

  const now = Date.now();
  if (
    cachedToken &&
    cachedToken.env === config.env &&
    cachedToken.clientId === config.clientId &&
    cachedToken.scope === requestedScope &&
    now < cachedToken.expiresAt - EXPIRY_BUFFER_MS
  ) {
    return cachedToken.accessToken;
  }

  const details = await getPayPalTokenDetails(config, options);
  return details.accessToken;
}

