import { prisma } from '@/lib/prisma';
import { estimateCostCents } from './cost-estimator';
import type { AIResponse } from './provider';

interface TrackAICallOptions {
  taskType: 'ocr' | 'categorize' | 'summarize';
  userId?: string;
  entityType?: string;
  entityId?: string;
}

/**
 * Wrap an AI call to track usage, timing, and cost.
 * Tracking failures never break the actual AI call.
 */
export async function trackAICall<T extends AIResponse>(
  options: TrackAICallOptions,
  fn: () => Promise<T>,
): Promise<T> {
  const start = Date.now();
  let response: T;
  let errorCode: string | undefined;
  let success = true;

  try {
    response = await fn();
  } catch (error) {
    success = false;
    errorCode = error instanceof Error ? error.name : 'UNKNOWN';
    // Log failure, then re-throw
    logUsage(options, {
      durationMs: Date.now() - start,
      success: false,
      errorCode,
      provider: 'unknown',
      model: 'unknown',
      inputTokens: 0,
      outputTokens: 0,
    });
    throw error;
  }

  const durationMs = Date.now() - start;
  logUsage(options, {
    durationMs,
    success: true,
    provider: response.provider,
    model: response.model,
    inputTokens: response.inputTokens,
    outputTokens: response.outputTokens,
  });

  return response;
}

function logUsage(
  options: TrackAICallOptions,
  data: {
    durationMs: number;
    success: boolean;
    errorCode?: string;
    provider: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
  },
): void {
  // Fire-and-forget - never let DB write failures affect the caller
  prisma.aIUsageLog
    .create({
      data: {
        userId: options.userId,
        taskType: options.taskType,
        provider: data.provider,
        model: data.model,
        inputTokens: data.inputTokens,
        outputTokens: data.outputTokens,
        estimatedCostCents: estimateCostCents(
          data.provider,
          data.model,
          data.inputTokens,
          data.outputTokens,
        ),
        entityType: options.entityType,
        entityId: options.entityId,
        durationMs: data.durationMs,
        success: data.success,
        errorCode: data.errorCode,
      },
    })
    .catch((err) => {
      console.error('Failed to log AI usage:', err);
    });
}
