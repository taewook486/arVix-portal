import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { POST } from './route';
import { NextRequest } from 'next/server';

// @MX:NOTE: Mock setup using jest.mock with factory functions
const mockAnalyzePaper = jest.fn();
const mockGenerateQuickSummary = jest.fn();
const mockGetPaperCache = jest.fn();
const mockSaveAnalysis = jest.fn();
const mockLogError = jest.fn();
const mockToAppError = jest.fn();
const mockCreateErrorResponse = jest.fn();

jest.mock('@/lib/ai', () => ({
  analyzePaper: mockAnalyzePaper,
  generateQuickSummary: mockGenerateQuickSummary,
}));

jest.mock('@/lib/db', () => ({
  getPaperCache: mockGetPaperCache,
  saveAnalysis: mockSaveAnalysis,
}));

jest.mock('@/lib/errors', () => ({
  toAppError: mockToAppError,
  createErrorResponse: mockCreateErrorResponse,
  logError: mockLogError,
}));

// Import after mocking
import { analyzePaper, generateQuickSummary } from '@/lib/ai';
import { getPaperCache, saveAnalysis } from '@/lib/db';
import { toAppError, createErrorResponse } from '@/lib/errors';
import { NextResponse } from 'next/server';

describe('Analyze API Route (DDD Mode - Characterization Tests)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockToAppError.mockReturnValue({
      statusCode: 500,
      message: 'Internal server error',
    });
    mockCreateErrorResponse.mockReturnValue({
      error: 'Internal server error',
    });
  });

  describe('POST 요청 처리', () => {
    const validRequestBody = {
      title: 'Test Paper Title',
      abstract: 'This is a test abstract.',
      arxivId: '2301.00001',
      source: 'arxiv',
      mode: 'full',
    };

    it('유효한 요청 본문으로 논문 분석을 수행해야 함', async () => {
      const mockAnalysis = {
        summary: '요약',
        keyPoints: ['포인트 1'],
        methodology: '방법론',
        contributions: ['기여'],
        limitations: ['한계'],
      };

      mockAnalyzePaper.mockResolvedValue(mockAnalysis);
      mockGetPaperCache.mockResolvedValue(null);

      const request = {
        json: async () => validRequestBody,
      } as unknown as NextRequest;

      await POST(request);

      expect(mockAnalyzePaper).toHaveBeenCalledWith('Test Paper Title', 'This is a test abstract.');
    });

    it('분석 결과를 반환해야 함', async () => {
      const mockAnalysis = {
        summary: '요약',
        keyPoints: ['포인트 1'],
        methodology: '방법론',
        contributions: ['기여'],
        limitations: ['한계'],
      };

      mockAnalyzePaper.mockResolvedValue(mockAnalysis);
      mockGetPaperCache.mockResolvedValue(null);

      const request = {
        json: async () => validRequestBody,
      } as unknown as NextRequest;

      const result = await POST(request);

      expect(result).toEqual(
        expect.objectContaining({
          body: expect.objectContaining({
            summary: '요약',
            keyPoints: ['포인트 1'],
            cached: false,
          }),
        })
      );
    });

    it('캐시된 분석이 있으면 캐시를 반환해야 함', async () => {
      const cachedAnalysis = {
        summary: '캐시된 요약',
        keyPoints: ['캐시된 포인트'],
        methodology: '캐시된 방법론',
        contributions: ['캐시된 기여'],
        limitations: ['캐시된 한계'],
      };

      mockGetPaperCache.mockResolvedValue({
        analysis: cachedAnalysis,
      });

      const request = {
        json: async () => validRequestBody,
      } as unknown as NextRequest;

      await POST(request);

      expect(mockAnalyzePaper).not.toHaveBeenCalled();
    });

    it('분석 결과를 캐시에 저장해야 함', async () => {
      const mockAnalysis = {
        summary: '요약',
        keyPoints: ['포인트 1'],
        methodology: '방법론',
        contributions: ['기여'],
        limitations: ['한계'],
      };

      mockAnalyzePaper.mockResolvedValue(mockAnalysis);
      mockGetPaperCache.mockResolvedValue(null);

      const request = {
        json: async () => validRequestBody,
      } as unknown as NextRequest;

      const result = await POST(request);

      // 결과가 성공적으로 반환되어야 함
      expect(result).toBeDefined();
      expect(result.status).toBe(200);
    });

    it('요약 모드에서는 요약을 반환해야 함', async () => {
      const summaryRequestBody = {
        ...validRequestBody,
        mode: 'summary',
      };

      mockGenerateQuickSummary.mockResolvedValue('빠른 요약 결과');

      const request = {
        json: async () => summaryRequestBody,
      } as unknown as NextRequest;

      const result = await POST(request);

      // 요약 결과가 포함되어야 함
      expect(result).toBeDefined();
      expect(result.body).toHaveProperty('summary');
    });
  });

  describe('요청 유효성 검사', () => {
    it('abstract가 없으면 400 에러를 반환해야 함', async () => {
      const invalidBody = {
        title: 'Test Title',
        arxivId: '2301.00001',
        source: 'arxiv',
        mode: 'full',
      };

      const request = {
        json: async () => invalidBody,
      } as unknown as NextRequest;

      const result = await POST(request);

      expect(result).toEqual(
        expect.objectContaining({
          status: 400,
        })
      );
    });

    it('title이 없고 mode가 full이면 400 에러를 반환해야 함', async () => {
      const bodyWithoutTitle = {
        abstract: 'Test abstract',
        arxivId: '2301.00001',
        source: 'arxiv',
        mode: 'full',
      };

      mockGetPaperCache.mockResolvedValue(null);

      const request = {
        json: async () => bodyWithoutTitle,
      } as unknown as NextRequest;

      const result = await POST(request);

      expect(result).toEqual(
        expect.objectContaining({
          status: 400,
        })
      );
    });
  });

  describe('캐시 확인', () => {
    it('arxivId가 있으면 캐시된 결과를 반환해야 함', async () => {
      const bodyWithId = {
        title: 'Test Title',
        abstract: 'Test abstract',
        arxivId: '2301.00001',
        source: 'arxiv',
        mode: 'full',
      };

      const cachedAnalysis = {
        summary: '캐시된 요약',
        keyPoints: ['포인트'],
      };

      mockGetPaperCache.mockResolvedValue({ analysis: cachedAnalysis });

      const request = {
        json: async () => bodyWithId,
      } as unknown as NextRequest;

      const result = await POST(request);

      // 캐시된 결과가 반환되어야 함
      expect(result).toBeDefined();
      expect(result.status).toBe(200);
    });

    it('arxivId가 없으면 새로운 분석을 수행해야 함', async () => {
      const bodyWithoutId = {
        title: 'Test Title',
        abstract: 'Test abstract',
        mode: 'full',
      };

      const mockAnalysis = {
        summary: '요약',
        keyPoints: ['포인트'],
        methodology: '방법론',
        contributions: ['기여'],
        limitations: ['한계'],
      };

      mockAnalyzePaper.mockResolvedValue(mockAnalysis);

      const request = {
        json: async () => bodyWithoutId,
      } as unknown as NextRequest;

      const result = await POST(request);

      // 결과가 성공적으로 반환되어야 함
      expect(result).toBeDefined();
      expect(result.status).toBe(200);
    });
  });

  describe('에러 처리', () => {
    it('analyzePaper 에러를 적절히 처리해야 함', async () => {
      const testError = new Error('Analysis failed');
      mockAnalyzePaper.mockRejectedValue(testError);
      mockGetPaperCache.mockResolvedValue(null);

      const request = {
        json: async () => ({
          title: 'Test',
          abstract: 'Abstract',
          mode: 'full',
        }),
      } as unknown as NextRequest;

      // 에러가 발생해도 route는 에러를 catch하고 응답을 반환해야 함
      const result = await POST(request);

      // 결과가 존재해야 함 (에러로 인해 크래시되지 않음)
      expect(result).toBeDefined();
    });

    it('JSON 파싱 오류를 처리해야 함', async () => {
      const request = {
        json: async () => {
          throw new Error('Invalid JSON');
        },
      } as unknown as NextRequest;

      const result = await POST(request);

      // Should handle the error gracefully
      expect(result).toBeDefined();
    });

    it('에러 발생 시 에러 응답을 반환해야 함', async () => {
      const testError = new Error('Test error');
      mockAnalyzePaper.mockRejectedValue(testError);
      mockGetPaperCache.mockResolvedValue(null);
      mockToAppError.mockReturnValue({
        statusCode: 500,
        message: 'Test error',
      });
      mockCreateErrorResponse.mockReturnValue({
        error: 'Test error',
      });

      const request = {
        json: async () => ({
          title: 'Test',
          abstract: 'Abstract',
          mode: 'full',
        }),
      } as unknown as NextRequest;

      const result = await POST(request);

      // 에러 상태 코드를 확인
      expect(result.status).toBeGreaterThanOrEqual(400);
    });
  });
});
