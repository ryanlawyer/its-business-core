// Per-token pricing in USD (per million tokens)
// These are best-effort estimates and may become outdated
const PRICING: Record<string, { input: number; output: number }> = {
  // Anthropic models (per million tokens)
  'claude-sonnet-4-5-20250929': { input: 3.0, output: 15.0 },
  'claude-opus-4-20250514': { input: 15.0, output: 75.0 },
  'claude-sonnet-4-20250514': { input: 3.0, output: 15.0 },
  'claude-haiku-4-5-20251001': { input: 0.80, output: 4.0 },
  // OpenAI models
  'gpt-4o': { input: 2.5, output: 10.0 },
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  'gpt-4-turbo': { input: 10.0, output: 30.0 },
};

// Local models are free
const FREE_PROVIDERS = new Set(['ollama', 'custom']);

/**
 * Estimate cost in cents for a given AI call
 */
export function estimateCostCents(
  provider: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  if (FREE_PROVIDERS.has(provider)) {
    return 0;
  }

  const pricing = PRICING[model];
  if (!pricing) {
    return 0; // Unknown model, can't estimate
  }

  // Convert from per-million to actual cost, then to cents
  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  const totalCents = (inputCost + outputCost) * 100;

  return Math.round(totalCents);
}
