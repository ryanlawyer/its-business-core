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
    // Use pdf-lib to extract first page, then sharp to convert to image
    const { PDFDocument } = await import('pdf-lib');
    const sharp = (await import('sharp')).default;

    const pdfBytes = Buffer.from(base64Pdf, 'base64');
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const page = pdfDoc.getPages()[0];

    if (!page) {
      throw new Error('PDF has no pages');
    }

    // Create a new PDF with just the first page for conversion
    const singlePagePdf = await PDFDocument.create();
    const [copiedPage] = await singlePagePdf.copyPages(pdfDoc, [0]);
    singlePagePdf.addPage(copiedPage);
    const singlePageBytes = await singlePagePdf.save();

    // Use sharp to convert PDF to PNG
    // sharp can render PDF first page when built with poppler support
    // If that fails, we send the raw PDF bytes as a fallback rendered through sharp
    try {
      const imageBuffer = await sharp(Buffer.from(singlePageBytes), {
        density: 200, // DPI for PDF rendering
      })
        .png()
        .toBuffer();

      return imageBuffer.toString('base64');
    } catch {
      // Fallback: if sharp can't handle PDF, just use the raw data
      // Some providers can handle PDF directly via image_url
      return base64Pdf;
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
