import Anthropic from '@anthropic-ai/sdk';
import type { AIProvider, AITextRequest, AIVisionRequest, AIResponse } from '../provider';

export class AnthropicAdapter implements AIProvider {
  readonly name = 'anthropic';
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model: string) {
    const key = apiKey || process.env.ANTHROPIC_API_KEY;
    if (!key) {
      throw new Error('Anthropic API key is required');
    }
    this.client = new Anthropic({ apiKey: key });
    this.model = model || 'claude-sonnet-4-5-20250929';
  }

  async complete(request: AITextRequest): Promise<AIResponse> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: request.maxTokens || 1024,
      system: request.system || undefined,
      messages: [{ role: 'user', content: request.prompt }],
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');

    return {
      text,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      model: this.model,
      provider: this.name,
    };
  }

  async vision(request: AIVisionRequest): Promise<AIResponse> {
    const isPdf = request.mediaType === 'application/pdf';

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let content: any[];
    if (isPdf) {
      content = [
        {
          type: 'document' as const,
          source: {
            type: 'base64' as const,
            media_type: 'application/pdf' as const,
            data: request.imageData,
          },
        },
        { type: 'text' as const, text: request.prompt },
      ];
    } else {
      content = [
        {
          type: 'image' as const,
          source: {
            type: 'base64' as const,
            media_type: request.mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
            data: request.imageData,
          },
        },
        { type: 'text' as const, text: request.prompt },
      ];
    }

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: request.maxTokens || 1024,
      system: request.system || undefined,
      messages: [{ role: 'user', content }],
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');

    return {
      text,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      model: this.model,
      provider: this.name,
    };
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Say "ok"' }],
      });
      const text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('');
      return { success: true, message: `Connected to Anthropic (${this.model}). Response: ${text}` };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error connecting to Anthropic',
      };
    }
  }
}
