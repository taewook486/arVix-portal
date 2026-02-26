import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// @MX:NOTE: OpenAI 모듈 모킹은 모듈 로드 전에 수행
jest.mock('openai');

// Import after mocking
import { tryModels, tryGLMModels, createChatCompletion, GLM_MODELS } from '../glm';
import { mockCreate } from '../__mocks__/openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

describe('GLM Library (DDD Mode - Characterization Tests)', () => {
  // Mock chat completion response
  const mockChatCompletionResponse = {
    id: 'chatcmpl-test123',
    object: 'chat.completion' as const,
    created: Date.now(),
    model: 'glm-5',
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant' as const,
          content: 'Test response content',
        },
        finish_reason: 'stop' as const,
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // 기본 성공 응답 설정
    mockCreate.mockResolvedValue(mockChatCompletionResponse);
  });

  describe('tryModels', () => {
    it('should return result on first successful model', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');

      const result = await tryModels(['model-1', 'model-2'], mockFn);

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith('model-1');
    });

    it('should try next model if first fails', async () => {
      const mockFn = jest.fn()
        .mockRejectedValueOnce(new Error('Model 1 failed'))
        .mockResolvedValueOnce('success');

      const result = await tryModels(['model-1', 'model-2'], mockFn);

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(2);
      expect(mockFn).toHaveBeenNthCalledWith(1, 'model-1');
      expect(mockFn).toHaveBeenNthCalledWith(2, 'model-2');
    });

    it('should throw detailed error when all models fail', async () => {
      const mockFn = jest.fn()
        .mockRejectedValueOnce(new Error('Model 1 failed'))
        .mockRejectedValueOnce(new Error('Model 2 failed'))
        .mockRejectedValueOnce(new Error('Model 3 failed'));

      await expect(
        tryModels(['model-1', 'model-2', 'model-3'], mockFn)
      ).rejects.toThrow('All GLM models failed');

      expect(mockFn).toHaveBeenCalledTimes(3);
    });

    it('should include error details in thrown error', async () => {
      const mockFn = jest.fn()
        .mockRejectedValueOnce(new Error('Rate limit exceeded'))
        .mockRejectedValueOnce(new Error('Insufficient quota'))
        .mockRejectedValueOnce(new Error('Timeout'));

      await expect(
        tryModels(['model-1', 'model-2', 'model-3'], mockFn)
      ).rejects.toThrow('Rate limit exceeded');
    });
  });

  describe('tryGLMModels', () => {
    it('should use configured GLM_MODELS array', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');

      await tryGLMModels(mockFn);

      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith(GLM_MODELS[0]);
    });

    it('should fallback through all GLM models', async () => {
      const mockFn = jest.fn()
        .mockRejectedValueOnce(new Error('glm-5 failed'))
        .mockRejectedValueOnce(new Error('glm-4.7 failed'))
        .mockResolvedValueOnce('success');

      const result = await tryGLMModels(mockFn);

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(3);
      expect(mockFn).toHaveBeenNthCalledWith(1, 'glm-5');
      expect(mockFn).toHaveBeenNthCalledWith(2, 'glm-4.7');
      expect(mockFn).toHaveBeenNthCalledWith(3, 'glm-4.7-Flash');
    });

    it('should throw when all GLM models fail', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('All models unavailable'));

      await expect(tryGLMModels(mockFn)).rejects.toThrow('All GLM models failed');
    });
  });

  describe('createChatCompletion', () => {
    const mockMessages: ChatCompletionMessageParam[] = [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'Hello!' },
    ];

    it('should create chat completion with default parameters', async () => {
      const result = await createChatCompletion({ messages: mockMessages });

      expect(mockCreate).toHaveBeenCalledWith({
        model: GLM_MODELS[0],
        messages: mockMessages,
        temperature: 0.7,
      });
      expect(result).toEqual(mockChatCompletionResponse);
    });

    it('should use custom temperature', async () => {
      await createChatCompletion({
        messages: mockMessages,
        temperature: 0.5,
      });

      expect(mockCreate).toHaveBeenCalledWith({
        model: GLM_MODELS[0],
        messages: mockMessages,
        temperature: 0.5,
      });
    });

    it('should include maxTokens when provided', async () => {
      await createChatCompletion({
        messages: mockMessages,
        maxTokens: 1000,
      });

      expect(mockCreate).toHaveBeenCalledWith({
        model: GLM_MODELS[0],
        messages: mockMessages,
        temperature: 0.7,
        max_tokens: 1000,
      });
    });

    it('should use preferred model when specified', async () => {
      await createChatCompletion({
        messages: mockMessages,
        model: 'glm-4.7-Flash',
      });

      expect(mockCreate).toHaveBeenCalledWith({
        model: 'glm-4.7-Flash',
        messages: mockMessages,
        temperature: 0.7,
      });
    });

    it('should fallback to other models if preferred model fails', async () => {
      mockCreate
        .mockRejectedValueOnce(new Error('glm-4.7-Flash failed'))
        .mockResolvedValueOnce(mockChatCompletionResponse);

      const result = await createChatCompletion({
        messages: mockMessages,
        model: 'glm-4.7-Flash',
      });

      expect(mockCreate).toHaveBeenCalledTimes(2);
      expect(result).toEqual(mockChatCompletionResponse);
    });

    it('should fallback through all models on failure', async () => {
      mockCreate
        .mockRejectedValueOnce(new Error('glm-5 failed'))
        .mockRejectedValueOnce(new Error('glm-4.7 failed'))
        .mockResolvedValueOnce(mockChatCompletionResponse);

      const result = await createChatCompletion({
        messages: mockMessages,
      });

      expect(mockCreate).toHaveBeenCalledTimes(3);
      expect(result).toEqual(mockChatCompletionResponse);
    });

    it('should throw when all models fail', async () => {
      mockCreate.mockRejectedValue(new Error('All models failed'));

      await expect(
        createChatCompletion({ messages: mockMessages })
      ).rejects.toThrow('All GLM models failed');
    });

    it('should handle combined options', async () => {
      await createChatCompletion({
        messages: mockMessages,
        temperature: 0.3,
        maxTokens: 500,
        model: 'glm-4.7',
      });

      expect(mockCreate).toHaveBeenCalledWith({
        model: 'glm-4.7',
        messages: mockMessages,
        temperature: 0.3,
        max_tokens: 500,
      });
    });
  });

  describe('GLM_MODELS constant', () => {
    it('should export GLM_MODELS array', () => {
      expect(GLM_MODELS).toEqual(['glm-5', 'glm-4.7', 'glm-4.7-Flash']);
    });

    it('should have at least 3 models', () => {
      expect(GLM_MODELS.length).toBeGreaterThanOrEqual(3);
    });

    it('should have glm-5 as first model', () => {
      expect(GLM_MODELS[0]).toBe('glm-5');
    });
  });
});
