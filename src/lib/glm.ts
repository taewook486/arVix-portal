/**
 * GLM API Client Utility
 *
 * Centralized GLM (OpenAI-compatible) API client with model fallback support.
 * Reduces duplication across API routes.
 */

import OpenAI from 'openai';

// ============================================================================
// Configuration
// ============================================================================

const apiKey = process.env.OPENAI_API_KEY || '';
const baseURL = process.env.OPENAI_BASE_URL;

if (!apiKey) {
  console.warn('[GLM] OPENAI_API_KEY not configured');
}

// Available models in fallback order (highest quality first)
export const GLM_MODELS = ['glm-5', 'glm-4.7', 'glm-4.7-Flash'] as const;
export type GLMModel = (typeof GLM_MODELS)[number];

// ============================================================================
// OpenAI Client
// ============================================================================

export const glmClient = new OpenAI({
  apiKey,
  baseURL,
});

// ============================================================================
// Model Fallback Utility
// ============================================================================

interface ModelAttemptError {
  model: string;
  error: unknown;
}

/**
 * Try models in order until one succeeds.
 * Throws with detailed error if all models fail.
 *
 * @param models - Array of model names to try (in order)
 * @param fn - Async function to call with each model
 * @returns Result from first successful model
 * @throws Error with details of all failed attempts
 */
export async function tryModels<T>(
  models: readonly string[],
  fn: (model: string) => Promise<T>
): Promise<T> {
  const errors: ModelAttemptError[] = [];

  for (const model of models) {
    try {
      console.log(`[GLM] Trying model: ${model}`);
      return await fn(model);
    } catch (error) {
      console.error(`[GLM] Model ${model} failed:`, error);
      errors.push({ model, error });
    }
  }

  // All models failed - throw with details
  const errorDetails = errors
    .map((e) => {
      const errorMsg = e.error instanceof Error ? e.error.message : String(e.error);
      return `- ${e.model}: ${errorMsg}`;
    })
    .join('\n');

  throw new Error(`All GLM models failed:\n${errorDetails}`);
}

/**
 * Default tryModels using configured GLM models.
 */
export async function tryGLMModels<T>(
  fn: (model: string) => Promise<T>
): Promise<T> {
  return tryModels(GLM_MODELS, fn);
}

// ============================================================================
// Chat Completion Helper
// ============================================================================

import type { ChatCompletionMessageParam, ChatCompletionCreateParams } from 'openai/resources/chat/completions';

export interface ChatCompletionOptions {
  messages: ChatCompletionMessageParam[];
  temperature?: number;
  maxTokens?: number;
  model?: GLMModel;
}

/**
 * Create chat completion with automatic model fallback.
 */
export async function createChatCompletion({
  messages,
  temperature = 0.7,
  maxTokens,
  model: preferredModel,
}: ChatCompletionOptions): Promise<OpenAI.Chat.Completions.ChatCompletion> {
  const models = preferredModel
    ? [preferredModel, ...GLM_MODELS.filter((m) => m !== preferredModel)]
    : GLM_MODELS;

  return tryModels(models, async (model) => {
    const params: ChatCompletionCreateParams = {
      model,
      messages,
      temperature,
    };

    if (maxTokens) {
      params.max_tokens = maxTokens;
    }

    return await glmClient.chat.completions.create(params);
  });
}

// ============================================================================
// Streaming Chat Completion Helper (for future use)
// ============================================================================

export async function* createStreamingChatCompletion(
  messages: ChatCompletionMessageParam[],
  temperature: number = 0.7
): AsyncGenerator<string, void, unknown> {
  const errors: ModelAttemptError[] = [];

  for (const model of GLM_MODELS) {
    try {
      console.log(`[GLM] Trying streaming model: ${model}`);
      const stream = await glmClient.chat.completions.create({
        model,
        messages,
        temperature,
        stream: true,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          yield content;
        }
      }

      return; // Success
    } catch (error) {
      console.error(`[GLM] Streaming model ${model} failed:`, error);
      errors.push({ model, error });
    }
  }

  // All models failed
  const errorDetails = errors
    .map((e) => `- ${e.model}: ${e.error}`)
    .join('\n');
  throw new Error(`All GLM streaming models failed:\n${errorDetails}`);
}
