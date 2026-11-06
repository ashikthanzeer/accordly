/**
 * Scope Baseline AI Extractor.
 *
 * Coordinates prompt generation, model invocation, and strict runtime Zod validation.
 */

import { buildScopeExtractionPrompt } from "./prompts";
import { completePrompt, type AiClientConfig } from "./provider";
import { ScopeBaselineSchema, type StructuredScopeBaseline } from "./schema";

export class ScopeExtractionError extends Error {
  constructor(message: string, public rawResponse?: string, public validationErrors?: unknown) {
    super(`[ScopeExtractionError] ${message}`);
    this.name = "ScopeExtractionError";
  }
}

export interface ScopeExtractionResult {
  baseline: StructuredScopeBaseline;
  provider: string;
  model: string;
  isMock: boolean;
  rawResponse: string;
}

/**
 * Strips code fencing or extra non-JSON markdown wrappers from model response.
 */
function cleanJsonOutput(raw: string): string {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.slice(3);
  }

  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3);
  }

  return cleaned.trim();
}

/**
 * Extracts a verified structured scope baseline from raw agreement text.
 */
export async function extractScopeBaseline(
  agreementText: string,
  customConfig?: AiClientConfig
): Promise<ScopeExtractionResult> {
  if (!agreementText || agreementText.trim().length < 20) {
    throw new ScopeExtractionError("Agreement text is too short or empty for scope extraction.");
  }

  const { systemPrompt, userPrompt } = buildScopeExtractionPrompt(agreementText);
  const completion = await completePrompt(systemPrompt, userPrompt, customConfig);

  const cleanedText = cleanJsonOutput(completion.content);

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(cleanedText);
  } catch (err: unknown) {
    throw new ScopeExtractionError(
      `Model response did not contain valid JSON: ${err instanceof Error ? err.message : String(err)}`,
      completion.content
    );
  }

  const parseResult = ScopeBaselineSchema.safeParse(parsedJson);

  if (!parseResult.success) {
    throw new ScopeExtractionError(
      `Extracted scope failed runtime schema validation: ${parseResult.error.message}`,
      completion.content,
      parseResult.error.format()
    );
  }

  return {
    baseline: parseResult.data,
    provider: completion.provider,
    model: completion.model,
    isMock: completion.isMock,
    rawResponse: completion.content,
  };
}

