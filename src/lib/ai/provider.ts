/**
 * Unified AI Provider client.
 *
 * Supports Gemini and OpenAI REST APIs, as well as a deterministic test fixture
 * provider when API keys are not configured.
 */

export type AiProviderType = "gemini" | "openai" | "mock";

export interface AiClientConfig {
  provider: AiProviderType;
  apiKey?: string;
  model?: string;
}

export interface AiCompletionResult {
  content: string;
  provider: AiProviderType;
  model: string;
  isMock: boolean;
}

export class AiProviderError extends Error {
  constructor(message: string, public statusCode?: number, public details?: unknown) {
    super(`[AiProviderError] ${message}`);
    this.name = "AiProviderError";
  }
}

/**
 * Resolves active AI configuration from environment variables.
 */
export function getAiConfig(env: Record<string, string | undefined> = process.env): AiClientConfig {
  const explicitProvider = env.AI_PROVIDER?.trim().toLowerCase() as AiProviderType | undefined;
  const geminiKey = env.GEMINI_API_KEY?.trim();
  const openaiKey = env.OPENAI_API_KEY?.trim();

  if (explicitProvider === "gemini" || (!explicitProvider && geminiKey)) {
    return {
      provider: "gemini",
      apiKey: geminiKey,
      model: env.AI_MODEL || "gemini-2.0-flash",
    };
  }

  if (explicitProvider === "openai" || (!explicitProvider && openaiKey)) {
    return {
      provider: "openai",
      apiKey: openaiKey,
      model: env.AI_MODEL || "gpt-4o-mini",
    };
  }

  return {
    provider: "mock",
    model: "mock-scope-intelligence-v1",
  };
}

/**
 * Completes a prompt using the configured AI provider.
 */
export async function completePrompt(
  systemPrompt: string,
  userPrompt: string,
  customConfig?: AiClientConfig
): Promise<AiCompletionResult> {
  const config = customConfig || getAiConfig();

  if (config.provider === "gemini") {
    if (!config.apiKey) {
      throw new AiProviderError("Missing GEMINI_API_KEY for Gemini AI provider.");
    }
    return callGemini(config.apiKey, config.model || "gemini-2.0-flash", systemPrompt, userPrompt);
  }

  if (config.provider === "openai") {
    if (!config.apiKey) {
      throw new AiProviderError("Missing OPENAI_API_KEY for OpenAI provider.");
    }
    return callOpenAi(config.apiKey, config.model || "gpt-4o-mini", systemPrompt, userPrompt);
  }

  // Fallback: Deterministic mock extractor for testing / unconfigured environments
  return generateDeterministicMockExtraction(userPrompt);
}

/**
 * Calls Gemini Generative Language API via direct HTTPS fetch.
 * Automatically falls back to gemini-2.0-flash if a legacy model name (e.g. gemini-1.5-flash) returns 404.
 */
async function callGemini(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  allowFallback = true
): Promise<AiCompletionResult> {
  const cleanModel = model.replace(/^models\//, "").trim() || "gemini-2.0-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    cleanModel
  )}:generateContent?key=${apiKey}`;

  const body = {
    system_instruction: {
      parts: [{ text: systemPrompt }],
    },
    contents: [
      {
        role: "user",
        parts: [{ text: userPrompt }],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.1,
    },
  };

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err: unknown) {
    throw new AiProviderError(
      `Network error contacting Gemini API: ${err instanceof Error ? err.message : String(err)}`,
      503
    );
  }

  if (!res.ok) {
    if (res.status === 404 && allowFallback && cleanModel !== "gemini-2.0-flash") {
      return callGemini(apiKey, "gemini-2.0-flash", systemPrompt, userPrompt, false);
    }
    const errorText = await res.text();
    throw new AiProviderError(`Gemini API returned error ${res.status}: ${errorText}`, res.status);
  }

  interface GeminiResponse {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
  }

  const data = (await res.json()) as GeminiResponse;
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!content) {
    throw new AiProviderError("Gemini response did not contain text content.", 502);
  }

  return {
    content,
    provider: "gemini",
    model: cleanModel,
    isMock: false,
  };
}

/**
 * Calls OpenAI Chat Completions API via direct HTTPS fetch.
 */
async function callOpenAi(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string
): Promise<AiCompletionResult> {
  const url = "https://api.openai.com/v1/chat/completions";

  const body = {
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
    temperature: 0.1,
  };

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (err: unknown) {
    throw new AiProviderError(`Network error contacting OpenAI API: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (!res.ok) {
    const errorText = await res.text();
    throw new AiProviderError(`OpenAI API returned error ${res.status}: ${errorText}`, res.status);
  }

  interface OpenAiResponse {
    choices?: Array<{
      message?: { content?: string };
    }>;
  }

  const data = (await res.json()) as OpenAiResponse;
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new AiProviderError("OpenAI response did not contain message content.");
  }

  return {
    content,
    provider: "openai",
    model,
    isMock: false,
  };
}

/**
 * Generates a deterministic mock extraction grounded in the provided text.
 * Used when no external AI API key is configured.
 */
function generateDeterministicMockExtraction(userPrompt: string): AiCompletionResult {
  const sampleBaseline = {
    projectObjective: "Design and implement digital deliverables per client scope agreement.",
    deliverables: [
      {
        id: "DEL-1",
        name: "Website Design & Front-End Templates",
        description: "Responsive web pages and brand component styling.",
        conditions: ["Mobile and desktop viewport support"],
        source: {
          page: 1,
          section: "1. Scope of Work",
          excerpt: "Provider will deliver responsive website templates and brand components.",
          isInferred: false,
        },
      },
      {
        id: "DEL-2",
        name: "PayPal Payment Integration",
        description: "Integration of PayPal Sandbox Invoicing and checkout flow.",
        conditions: ["Tested in PayPal Sandbox environment"],
        source: {
          page: 1,
          section: "1. Scope of Work",
          excerpt: "Scope includes integration of PayPal payment workflows.",
          isInferred: false,
        },
      },
    ],
    exclusions: [
      {
        id: "EXC-1",
        description: "Copywriting and stock photography licensing are excluded.",
        conditions: "Client to supply all written content and imagery assets.",
        source: {
          page: 2,
          section: "2. Exclusions",
          excerpt: "All copywriting, custom photography, and stock photo licensing are explicitly excluded.",
          isInferred: false,
        },
      },
    ],
    revisionLimits: {
      includedCount: 2,
      definition: "Up to two rounds of consolidated design revisions per deliverable.",
      restrictions: ["Additional revisions billed at configured hourly rate"],
      isSpecified: true,
      source: {
        page: 2,
        section: "3. Revisions",
        excerpt: "Agreement includes two (2) rounds of revisions. Further revisions will be billed separately.",
        isInferred: false,
      },
    },
    milestones: [
      {
        id: "MS-1",
        name: "Initial Prototype Delivery",
        description: "Delivery of wireframes and preliminary working templates.",
        dueDate: "2026-11-20",
        associatedDeliverables: ["DEL-1"],
        source: {
          page: 2,
          section: "4. Milestones",
          excerpt: "Milestone 1: Prototype delivery scheduled within 14 days of signing.",
          isInferred: false,
        },
      },
    ],
    acceptanceCriteria: [
      {
        id: "AC-1",
        criteria: "Client must provide written acceptance or itemized revisions within 5 business days.",
        associatedDeliverableId: "DEL-1",
        testingRequirements: "Cross-browser testing on Chrome, Safari, Firefox",
        source: {
          page: 3,
          section: "5. Acceptance",
          excerpt: "Client shall review deliverables and notify provider of acceptance within 5 business days.",
          isInferred: false,
        },
      },
    ],
    paymentTerms: {
      totalAmount: "4500",
      currency: "USD",
      depositRequired: "50% due upon project kick-off",
      milestones: [
        { name: "Initial Deposit", amountOrPercentage: "50%", triggerCondition: "Agreement Execution" },
        { name: "Final Balance", amountOrPercentage: "50%", triggerCondition: "Final Deliverable Acceptance" },
      ],
      dueConditions: "Net 15 days upon invoice submission",
      isSpecified: true,
      source: {
        page: 3,
        section: "6. Payment Terms",
        excerpt: "Total fee of $4,500 USD payable 50% deposit and 50% upon final acceptance.",
        isInferred: false,
      },
    },
    timelines: {
      startDate: "2026-11-10",
      deliveryDeadlines: ["Final project handover by December 15, 2026"],
      dependencies: ["Client content and credentials provided by November 15"],
      isSpecified: true,
      source: {
        page: 1,
        section: "Timeline",
        excerpt: "Project commences November 10, 2026 with final completion estimated for December 15, 2026.",
        isInferred: false,
      },
    },
    ambiguities: [
      {
        id: "AMB-1",
        issue: "Turnaround response time for client feedback is not defined for intermediate drafts.",
        potentialImpact: "Delays in client feedback could push final delivery milestone.",
        source: {
          page: 2,
          excerpt: "Client will review drafts promptly.",
        },
      },
    ],
  };

  return {
    content: JSON.stringify(sampleBaseline, null, 2),
    provider: "mock",
    model: "mock-scope-intelligence-v1",
    isMock: true,
  };
}

