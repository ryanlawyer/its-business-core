import { getSettings, SystemSettings } from '@/lib/settings';

export interface AITextRequest {
  system?: string;
  prompt: string;
  maxTokens?: number;
}

export interface AIVisionRequest {
  system?: string;
  prompt: string;
  imageData: string; // base64
  mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' | 'application/pdf';
  maxTokens?: number;
}

export interface AIResponse {
  text: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
  provider: string;
}

export interface AIProvider {
  readonly name: string;
  complete(request: AITextRequest): Promise<AIResponse>;
  vision(request: AIVisionRequest): Promise<AIResponse>;
  testConnection(): Promise<{ success: boolean; message: string }>;
}

export class AINotConfiguredError extends Error {
  constructor(message = 'AI provider is not configured. Please configure an AI provider in Admin Settings.') {
    super(message);
    this.name = 'AINotConfiguredError';
  }
}

export function getProviderName(settings: SystemSettings['ai']): string {
  return settings?.provider || 'none';
}

let _cachedProvider: AIProvider | null = null;
let _cachedProviderKey = '';

function getProviderCacheKey(ai: SystemSettings['ai']): string {
  switch (ai.provider) {
    case 'anthropic':
      return `anthropic:${ai.anthropic.apiKey}:${ai.anthropic.model}`;
    case 'openai':
      return `openai:${ai.openai.apiKey}:${ai.openai.model}`;
    case 'openrouter':
      return `openrouter:${ai.openrouter.apiKey}:${ai.openrouter.model}`;
    case 'ollama':
      return `ollama:${ai.ollama.baseUrl}:${ai.ollama.model}`;
    case 'custom':
      return `custom:${ai.custom.baseUrl}:${ai.custom.apiKey}:${ai.custom.model}`;
    default:
      return 'none';
  }
}

/**
 * Detect effective provider when settings.ai.provider is 'none'.
 * Provides backward compatibility for deployments that had an API key
 * configured before the multi-provider expansion.
 */
export function detectEffectiveProvider(ai: SystemSettings['ai']): SystemSettings['ai']['provider'] {
  if (ai?.provider && ai.provider !== 'none') return ai.provider;

  // Check for Anthropic API key (env var or saved in settings)
  if (ai?.anthropic?.apiKey || process.env.ANTHROPIC_API_KEY) return 'anthropic';

  return 'none';
}

export async function getAIProvider(): Promise<AIProvider> {
  const settings = getSettings();
  const ai = settings.ai;

  const effectiveProvider = detectEffectiveProvider(ai);
  if (!ai || effectiveProvider === 'none') {
    throw new AINotConfiguredError();
  }

  // Use effective provider for cache key and adapter selection
  const aiForCache = { ...ai, provider: effectiveProvider };
  const cacheKey = getProviderCacheKey(aiForCache);
  if (_cachedProvider && _cachedProviderKey === cacheKey) {
    return _cachedProvider;
  }

  let provider: AIProvider;

  switch (effectiveProvider) {
    case 'anthropic': {
      const { AnthropicAdapter } = await import('./adapters/anthropic');
      const apiKey = ai.anthropic?.apiKey || process.env.ANTHROPIC_API_KEY || '';
      const model = ai.anthropic?.model || 'claude-sonnet-4-5-20250929';
      provider = new AnthropicAdapter(apiKey, model);
      break;
    }
    case 'openai': {
      const { OpenAICompatibleAdapter } = await import('./adapters/openai-compatible');
      provider = new OpenAICompatibleAdapter({
        name: 'openai',
        apiKey: ai.openai.apiKey,
        baseURL: 'https://api.openai.com/v1',
        model: ai.openai.model,
      });
      break;
    }
    case 'openrouter': {
      const { OpenAICompatibleAdapter } = await import('./adapters/openai-compatible');
      provider = new OpenAICompatibleAdapter({
        name: 'openrouter',
        apiKey: ai.openrouter.apiKey,
        baseURL: 'https://openrouter.ai/api/v1',
        model: ai.openrouter.model,
      });
      break;
    }
    case 'ollama': {
      const { OpenAICompatibleAdapter } = await import('./adapters/openai-compatible');
      provider = new OpenAICompatibleAdapter({
        name: 'ollama',
        apiKey: 'ollama', // Ollama doesn't need a key but SDK requires non-empty string
        baseURL: `${ai.ollama.baseUrl}/v1`,
        model: ai.ollama.model,
      });
      break;
    }
    case 'custom': {
      const { OpenAICompatibleAdapter } = await import('./adapters/openai-compatible');
      provider = new OpenAICompatibleAdapter({
        name: 'custom',
        apiKey: ai.custom.apiKey || 'none',
        baseURL: ai.custom.baseUrl,
        model: ai.custom.model,
      });
      break;
    }
    default:
      throw new AINotConfiguredError();
  }

  _cachedProvider = provider;
  _cachedProviderKey = cacheKey;
  return provider;
}
