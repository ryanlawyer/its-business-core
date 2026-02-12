import OpenAI from 'openai';
import type { AIProvider, AITextRequest, AIVisionRequest, AIResponse } from '../provider';

interface OpenAICompatibleConfig {
  name: string;
  apiKey: string;
  baseURL: string;
  model: string;
}

export class OpenAICompatibleAdapter implements AIProvider {
  readonly name: string;
  private client: OpenAI;
  private model: string;

  constructor(config: OpenAICompatibleConfig) {
    this.name = config.name;
    this.model = config.model;
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
    });
  }

  async complete(request: AITextRequest): Promise<AIResponse> {
    const messages: OpenAI.ChatCompletionMessageParam[] = [];

    if (request.system) {
      messages.push({ role: 'system', content: request.system });
    }
    messages.push({ role: 'user', content: request.prompt });

    const response = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: request.maxTokens || 1024,
      messages,
    });

    const text = response.choices[0]?.message?.content || '';
    const usage = response.usage;

    return {
      text,
      inputTokens: usage?.prompt_tokens || 0,
      outputTokens: usage?.completion_tokens || 0,
      model: this.model,
      provider: this.name,
    };
  }

  async vision(request: AIVisionRequest): Promise<AIResponse> {
    const isPdf = request.mediaType === 'application/pdf';

    // OpenAI-compatible APIs don't support native PDF - convert to images first
    if (isPdf) {
      const imageData = await this.convertPdfToImage(request.imageData);
      return this.visionWithImage(request, imageData, 'image/png');
    }

    return this.visionWithImage(request, request.imageData, request.mediaType);
  }

  private async visionWithImage(
    request: AIVisionRequest,
    imageData: string,
    mediaType: string,
  ): Promise<AIResponse> {
    const messages: OpenAI.ChatCompletionMessageParam[] = [];

    if (request.system) {
      messages.push({ role: 'system', content: request.system });
    }

    messages.push({
      role: 'user',
      content: [
        {
          type: 'image_url',
          image_url: {
            url: `data:${mediaType};base64,${imageData}`,
          },
        },
        { type: 'text', text: request.prompt },
      ],
    });

    const response = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: request.maxTokens || 1024,
      messages,
    });

    const text = response.choices[0]?.message?.content || '';
    const usage = response.usage;

    return {
      text,
      inputTokens: usage?.prompt_tokens || 0,
      outputTokens: usage?.completion_tokens || 0,
      model: this.model,
      provider: this.name,
    };
  }

  private async convertPdfToImage(base64Pdf: string): Promise<string> {
    const { writeFile, readFile, mkdtemp } = await import('fs/promises');
    const { join } = await import('path');
    const { tmpdir } = await import('os');
    const { execFile } = await import('child_process');
    const { promisify } = await import('util');
    const execFileAsync = promisify(execFile);

    const tempDir = await mkdtemp(join(tmpdir(), 'pdf-convert-'));
    const pdfPath = join(tempDir, 'input.pdf');
    const outputPrefix = join(tempDir, 'output');

    try {
      const pdfBytes = Buffer.from(base64Pdf, 'base64');
      await writeFile(pdfPath, pdfBytes);

      // Use pdftoppm (poppler-utils) to convert first page to PNG
      await execFileAsync('pdftoppm', [
        '-png',
        '-r', '200',       // 200 DPI
        '-f', '1',          // first page
        '-l', '1',          // last page (only first)
        '-singlefile',      // don't add page number suffix
        pdfPath,
        outputPrefix,
      ]);

      const pngPath = `${outputPrefix}.png`;
      const imageBuffer = await readFile(pngPath);
      return imageBuffer.toString('base64');
    } catch {
      throw new Error(
        'PDF receipts cannot be processed with this AI provider because PDF-to-image conversion failed. ' +
        'Please upload an image file (JPEG or PNG) instead, or use Anthropic which supports PDFs natively.'
      );
    } finally {
      // Clean up temp files
      const { rm } = await import('fs/promises');
      await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Say "ok"' }],
      });
      const text = response.choices[0]?.message?.content || '';
      return { success: true, message: `Connected to ${this.name} (${this.model}). Response: ${text}` };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : `Unknown error connecting to ${this.name}`,
      };
    }
  }
}
