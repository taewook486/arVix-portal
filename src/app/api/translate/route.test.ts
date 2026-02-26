import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { POST } from './route';
import { NextRequest } from 'next/server';
import { getPaperCache, saveTranslation } from '@/lib/db';
import { tryGLMModels } from '@/lib/glm';
import { glmClient } from '@/lib/glm';
import { toAppError, createErrorResponse } from '@/lib/errors';

// @MX:NOTE: 의존성 모킹
jest.mock('@/lib/db');
jest.mock('@/lib/glm');
jest.mock('@/lib/errors');

// Mock NextResponse
jest.mock('next/server', () => {
  const originalModule = jest.requireActual('next/server');
  return {
    ...originalModule,
    NextResponse: {
      json: jest.fn((body: any, init?: any) => ({
        status: init?.status || 200,
        body,
      })),
    },
  };
});

import { NextResponse } from 'next/server';

describe('Translate API Route (DDD Mode - Characterization Tests)', () => {
  const mockJsonSpy = jest.spyOn(NextResponse, 'json');

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.OPENAI_API_KEY = 'test-api-key';

    // 기본 GLM 응답 모킹
    (tryGLMModels as jest.Mock).mockResolvedValue({
      choices: [
        {
          message: {
            content: '번역된 텍스트',
          },
        },
      ],
    });

    (toAppError as jest.Mock).mockReturnValue({
      statusCode: 500,
      message: 'Internal server error',
    });
    (createErrorResponse as jest.Mock).mockReturnValue({
      error: 'Internal server error',
    });
  });

  describe('POST 요청 처리', () => {
    const validRequestBody = {
      text: 'This is an English abstract that needs to be translated.',
      arxivId: '2301.00001',
      source: 'arxiv',
    };

    it('유효한 요청 본문으로 번역을 수행해야 함', async () => {
      (getPaperCache as jest.Mock).mockResolvedValue(null);

      const request = {
        json: async () => validRequestBody,
      } as unknown as NextRequest;

      await POST(request);

      expect(tryGLMModels).toHaveBeenCalledWith(expect.any(Function));
      expect(glmClient.chat.completions.create).toHaveBeenCalled();
    });

    it('번역 결과를 반환해야 함', async () => {
      (getPaperCache as jest.Mock).mockResolvedValue(null);
      (tryGLMModels as jest.Mock).mockResolvedValue({
        choices: [
          {
            message: { content: '이것은 번역된 한국어 텍스트입니다.' },
          },
        ],
      });

      const request = {
        json: async () => validRequestBody,
      } as unknown as NextRequest;

      await POST(request);

      expect(mockJsonSpy).toHaveBeenCalledWith(
        {
          translation: '이것은 번역된 한국어 텍스트입니다.',
          cached: false,
        },
        { status: 200 }
      );
    });

    it('캐시된 번역이 있으면 캐시를 반환해야 함', async () => {
      const cachedTranslation = '캐시된 번역 결과';

      (getPaperCache as jest.Mock).mockResolvedValue({
        translation: cachedTranslation,
      });

      const request = {
        json: async () => validRequestBody,
      } as unknown as NextRequest;

      await POST(request);

      expect(tryGLMModels).not.toHaveBeenCalled();
      expect(mockJsonSpy).toHaveBeenCalledWith(
        {
          translation: cachedTranslation,
          cached: true,
        },
        { status: 200 }
      );
    });

    it('번역 결과를 캐시에 저장해야 함', async () => {
      (getPaperCache as jest.Mock).mockResolvedValue(null);
      (saveTranslation as jest.Mock).mockResolvedValue(true);

      const request = {
        json: async () => validRequestBody,
      } as unknown as NextRequest;

      await POST(request);

      expect(saveTranslation).toHaveBeenCalledWith(
        'arxiv',
        '2301.00001',
        '번역된 텍스트'
      );
    });
  });

  describe('요청 유효성 검사', () => {
    it('text가 없으면 400 에러를 반환해야 함', async () => {
      const invalidBody = {
        text: '',
        arxivId: '2301.00001',
      };

      const request = {
        json: async () => invalidBody,
      } as unknown as NextRequest;

      await POST(request);

      expect(mockJsonSpy).toHaveBeenCalledWith(
        { error: '번역할 텍스트가 필요합니다' },
        { status: 400 }
      );
    });

    it('text가 undefined면 400 에러를 반환해야 함', async () => {
      const invalidBody = {
        arxivId: '2301.00001',
      };

      const request = {
        json: async () => invalidBody,
      } as unknown as NextRequest;

      await POST(request);

      expect(mockJsonSpy).toHaveBeenCalledWith(
        { error: '번역할 텍스트가 필요합니다' },
        { status: 400 }
      );
    });
  });

  describe('API 키 확인', () => {
    it('OPENAI_API_KEY가 없으면 500 에러를 반환해야 함', async () => {
      delete process.env.OPENAI_API_KEY;

      const validBody = {
        text: 'Text to translate',
        arxivId: '2301.00001',
      };

      (getPaperCache as jest.Mock).mockResolvedValue(null);

      const request = {
        json: async () => validBody,
      } as unknown as NextRequest;

      await POST(request);

      expect(mockJsonSpy).toHaveBeenCalledWith(
        { error: 'API 키가 설정되지 않았습니다.' },
        { status: 500 }
      );

      // 환경 변수 복구
      process.env.OPENAI_API_KEY = 'test-api-key';
    });
  });

  describe('프롬프트 구성', () => {
    it('올바른 번역 프롬프트를 사용해야 함', async () => {
      (getPaperCache as jest.Mock).mockResolvedValue(null);

      const requestBody = {
        text: 'Deep learning is a subset of machine learning.',
        arxivId: '2301.00001',
      };

      const request = {
        json: async () => requestBody,
      } as unknown as NextRequest;

      await POST(request);

      expect(glmClient.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'user',
              content: expect.stringContaining('한국어로 번역해주세요'),
            }),
          ]),
        })
      );
    });

    it('temperature 0.7을 사용해야 함', async () => {
      (getPaperCache as jest.Mock).mockResolvedValue(null);

      const request = {
        json: async () => validRequestBody,
      } as unknown as NextRequest;

      await POST(request);

      expect(glmClient.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.7,
        })
      );
    });
  });

  describe('소스 처리', () => {
    it('arxiv 소스일 때 arxivId로 저장해야 함', async () => {
      const arxivBody = {
        text: 'Text to translate',
        arxivId: '2301.00001',
        source: 'arxiv',
      };

      (getPaperCache as jest.Mock).mockResolvedValue(null);
      (saveTranslation as jest.Mock).mockResolvedValue(true);

      const request = {
        json: async () => arxivBody,
      } as unknown as NextRequest;

      await POST(request);

      expect(saveTranslation).toHaveBeenCalledWith('2301.00001', '번역된 텍스트');
    });

    it('openreview 소스일 때 source와 arxivId로 저장해야 함', async () => {
      const openReviewBody = {
        text: 'Text to translate',
        arxivId: 'forum-abc123',
        source: 'openreview',
      };

      (getPaperCache as jest.Mock).mockResolvedValue(null);
      (saveTranslation as jest.Mock).mockResolvedValue(true);

      const request = {
        json: async () => openReviewBody,
      } as unknown as NextRequest;

      await POST(request);

      expect(saveTranslation).toHaveBeenCalledWith('openreview', 'forum-abc123', '번역된 텍스트');
    });

    it('source가 arxiv가 아니고 source 파라미터가 있으면 해당 source를 사용해야 함', async () => {
      const otherSourceBody = {
        text: 'Text to translate',
        arxivId: 'id123',
        source: 'openreview',
      };

      (getPaperCache as jest.Mock).mockResolvedValue(null);
      (saveTranslation as jest.Mock).mockResolvedValue(true);

      const request = {
        json: async () => otherSourceBody,
      } as unknown as NextRequest;

      await POST(request);

      expect(saveTranslation).toHaveBeenCalledWith('openreview', 'id123', '번역된 텍스트');
    });
  });

  describe('번역 텍스트 처리', () => {
    it('번역 결과 앞뒤 공백을 제거해야 함', async () => {
      (getPaperCache as jest.Mock).mockResolvedValue(null);
      (tryGLMModels as jest.Mock).mockResolvedValue({
        choices: [
          {
            message: { content: '  번역된 텍스트  ' },
          },
        ],
      });

      const request = {
        json: async () => validRequestBody,
      } as unknown as NextRequest;

      await POST(request);

      expect(mockJsonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          translation: '번역된 텍스트',
        }),
        { status: 200 }
      );
    });

    it('빈 번역 결과를 처리해야 함', async () => {
      (getPaperCache as jest.Mock).mockResolvedValue(null);
      (tryGLMModels as jest.Mock).mockResolvedValue({
        choices: [
          {
            message: { content: '' },
          },
        ],
      });

      const request = {
        json: async () => validRequestBody,
      } as unknown as NextRequest;

      await POST(request);

      expect(mockJsonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          translation: '',
        }),
        { status: 200 }
      );
    });

    it('content가 null인 경우를 처리해야 함', async () => {
      (getPaperCache as jest.Mock).mockResolvedValue(null);
      (tryGLMModels as jest.Mock).mockResolvedValue({
        choices: [
          {
            message: { content: null },
          },
        ],
      });

      const request = {
        json: async () => validRequestBody,
      } as unknown as NextRequest;

      await POST(request);

      expect(mockJsonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          translation: '',
        }),
        { status: 200 }
      );
    });
  });

  describe('캐시 확인', () => {
    it('arxivId가 있으면 캐시를 확인해야 함', async () => {
      const bodyWithId = {
        text: 'Text to translate',
        arxivId: '2301.00001',
      };

      (getPaperCache as jest.Mock).mockResolvedValue({
        translation: 'cached translation',
      });

      const request = {
        json: async () => bodyWithId,
      } as unknown as NextRequest;

      await POST(request);

      expect(getPaperCache).toHaveBeenCalledWith('2301.00001');
    });

    it('arxivId가 없으면 캐시를 확인하지 않아야 함', async () => {
      const bodyWithoutId = {
        text: 'Text to translate',
      };

      (getPaperCache as jest.Mock).mockResolvedValue(null);

      const request = {
        json: async () => bodyWithoutId,
      } as unknown as NextRequest;

      await POST(request);

      expect(getPaperCache).not.toHaveBeenCalled();
    });

    it('캐시히트가 있어도 번역을 수행하지 않아야 함', async () => {
      (getPaperCache as jest.Mock).mockResolvedValue({
        translation: 'cached translation',
      });

      const request = {
        json: async () => validRequestBody,
      } as unknown as NextRequest;

      await POST(request);

      expect(tryGLMModels).not.toHaveBeenCalled();
    });
  });

  describe('에러 처리', () => {
    it('번역 실패 시 에러를 반환해야 함', async () => {
      (getPaperCache as jest.Mock).mockResolvedValue(null);
      (tryGLMModels as jest.Mock).mockRejectedValue(new Error('Translation API error'));

      const request = {
        json: async () => validRequestBody,
      } as unknown as NextRequest;

      await POST(request);

      expect(toAppError).toHaveBeenCalled();
      expect(mockJsonSpy).toHaveBeenCalledWith(
        { error: 'Internal server error' },
        { status: 500 }
      );
    });

    it('JSON 파싱 오류를 처리해야 함', async () => {
      const request = {
        json: async () => {
          throw new Error('Invalid JSON');
        },
      } as unknown as NextRequest;

      await expect(POST(request)).rejects.toThrow('Invalid JSON');
    });

    it('캐시 저장 실패가 번역 반환을 막지 않아야 함', async () => {
      (getPaperCache as jest.Mock).mockResolvedValue(null);
      (saveTranslation as jest.Mock).mockRejectedValue(new Error('DB error'));

      const request = {
        json: async () => validRequestBody,
      } as unknown as NextRequest;

      await POST(request);

      // 저장 실패에도 번역 결과는 반환해야 함
      expect(mockJsonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          translation: expect.any(String),
          cached: false,
        }),
        { status: 200 }
      );
    });
  });
});
