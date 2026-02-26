import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { POST, GET } from './route';
import { NextRequest } from 'next/server';
import { getPaperCache, saveInfographicUrl } from '@/lib/db';
import { tryGLMModels } from '@/lib/glm';
import { glmClient } from '@/lib/glm';
import { toAppError, createErrorResponse, logError } from '@/lib/errors';

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

describe('Infographic API Route (DDD Mode - Characterization Tests)', () => {
  const mockJsonSpy = jest.spyOn(NextResponse, 'json');

  const mermaidCode = `mindmap
  root((Test Paper))
    요약
      요약 내용
    핵심 포인트
      첫번째 포인트
      두번째 포인트`;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.OPENAI_API_KEY = 'test-api-key';

    // 기본 GLM 응답 모킹
    (tryGLMModels as jest.Mock).mockResolvedValue({
      choices: [
        {
          message: {
            content: mermaidCode,
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

  describe('GET 요청 처리', () => {
    it('arxivId 파라미터로 캐시를 확인해야 함', async () => {
      const cachedUrl = 'cached-mermaid-code';

      (getPaperCache as jest.Mock).mockResolvedValue({
        infographic_url: cachedUrl,
      });

      const request = {
        nextUrl: {
          searchParams: new URLSearchParams({ arxivId: '2301.00001' }),
        },
      } as unknown as NextRequest;

      await GET(request);

      expect(getPaperCache).toHaveBeenCalledWith('2301.00001');
    });

    it('캐시된 인포그래픽을 반환해야 함', async () => {
      const cachedUrl = 'cached-mermaid-code';

      (getPaperCache as jest.Mock).mockResolvedValue({
        infographic_url: cachedUrl,
      });

      const request = {
        nextUrl: {
          searchParams: new URLSearchParams({ arxivId: '2301.00001' }),
        },
      } as unknown as NextRequest;

      await GET(request);

      expect(mockJsonSpy).toHaveBeenCalledWith(
        {
          success: true,
          diagramCode: cachedUrl,
          cached: true,
        },
        { status: 200 }
      );
    });

    it('캐시가 없으면 success: false를 반환해야 함', async () => {
      (getPaperCache as jest.Mock).mockResolvedValue({
        infographic_url: null,
      });

      const request = {
        nextUrl: {
          searchParams: new URLSearchParams({ arxivId: '2301.00001' }),
        },
      } as unknown as NextRequest;

      await GET(request);

      expect(mockJsonSpy).toHaveBeenCalledWith(
        { success: false, diagramCode: null },
        { status: 200 }
      );
    });

    it('arxivId 파라미터가 없으면 400 에러를 반환해야 함', async () => {
      const request = {
        nextUrl: {
          searchParams: new URLSearchParams(),
        },
      } as unknown as NextRequest;

      await GET(request);

      expect(mockJsonSpy).toHaveBeenCalledWith(
        { error: 'arxivId가 필요합니다' },
        { status: 400 }
      );
    });

    it('에러 발생 시 에러 응답을 반환해야 함', async () => {
      (getPaperCache as jest.Mock).mockRejectedValue(new Error('Database error'));

      const request = {
        nextUrl: {
          searchParams: new URLSearchParams({ arxivId: '2301.00001' }),
        },
      } as unknown as NextRequest;

      await GET(request);

      expect(logError).toHaveBeenCalledWith('Infographic GET', expect.any(Error));
      expect(mockJsonSpy).toHaveBeenCalledWith(
        { error: 'Internal server error' },
        { status: 500 }
      );
    });
  });

  describe('POST 요청 처리', () => {
    const validRequestBody = {
      title: 'Test Paper Title',
      summary: 'This is a summary of the paper.',
      keyPoints: ['Key point 1', 'Key point 2', 'Key point 3'],
      methodology: 'Deep learning approach',
      arxivId: '2301.00001',
      source: 'arxiv',
      forceRegenerate: false,
    };

    it('유효한 요청 본문으로 인포그래픽을 생성해야 함', async () => {
      (getPaperCache as jest.Mock).mockResolvedValue({
        infographic_url: null,
      });

      const request = {
        json: async () => validRequestBody,
      } as unknown as NextRequest;

      await POST(request);

      expect(tryGLMModels).toHaveBeenCalledWith(expect.any(Function));
      expect(glmClient.chat.completions.create).toHaveBeenCalled();
    });

    it('생성된 다이어그램 코드를 반환해야 함', async () => {
      (getPaperCache as jest.Mock).mockResolvedValue({
        infographic_url: null,
      });

      const request = {
        json: async () => validRequestBody,
      } as unknown as NextRequest;

      await POST(request);

      expect(mockJsonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          diagramCode: expect.stringContaining('mindmap'),
          type: 'mermaid',
          cached: false,
        }),
        { status: 200 }
      );
    });

    it('캐시된 인포그래픽이 있고 forceRegenerate가 false면 캐시를 반환해야 함', async () => {
      const cachedCode = 'cached-mindmap-code';

      (getPaperCache as jest.Mock).mockResolvedValue({
        infographic_url: cachedCode,
      });

      const request = {
        json: async () => validRequestBody,
      } as unknown as NextRequest;

      await POST(request);

      expect(tryGLMModels).not.toHaveBeenCalled();
      expect(mockJsonSpy).toHaveBeenCalledWith(
        {
          success: true,
          diagramCode: cachedCode,
          cached: true,
        },
        { status: 200 }
      );
    });

    it('forceRegenerate가 true면 새로 생성해야 함', async () => {
      (getPaperCache as jest.Mock).mockResolvedValue({
        infographic_url: 'cached-code',
      });

      const bodyWithForce = {
        ...validRequestBody,
        forceRegenerate: true,
      };

      const request = {
        json: async () => bodyWithForce,
      } as unknown as NextRequest;

      await POST(request);

      expect(tryGLMModels).toHaveBeenCalled();
      expect(mockJsonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          cached: false,
        }),
        { status: 200 }
      );
    });

    it('생성된 다이어그램 코드를 캐시에 저장해야 함', async () => {
      (getPaperCache as jest.Mock).mockResolvedValue(null);
      (saveInfographicUrl as jest.Mock).mockResolvedValue(true);

      const request = {
        json: async () => validRequestBody,
      } as unknown as NextRequest;

      await POST(request);

      expect(saveInfographicUrl).toHaveBeenCalledWith(
        'arxiv',
        '2301.00001',
        expect.stringContaining('mindmap')
      );
    });
  });

  describe('요청 유효성 검사', () => {
    it('title이 없으면 400 에러를 반환해야 함', async () => {
      const invalidBody = {
        title: '',
        summary: 'Summary',
        keyPoints: ['Point 1'],
      };

      const request = {
        json: async () => invalidBody,
      } as unknown as NextRequest;

      await POST(request);

      expect(mockJsonSpy).toHaveBeenCalledWith(
        { error: '제목, 요약, 핵심 포인트가 필요합니다' },
        { status: 400 }
      );
    });

    it('summary가 없으면 400 에러를 반환해야 함', async () => {
      const invalidBody = {
        title: 'Title',
        summary: '',
        keyPoints: ['Point 1'],
      };

      const request = {
        json: async () => invalidBody,
      } as unknown as NextRequest;

      await POST(request);

      expect(mockJsonSpy).toHaveBeenCalledWith(
        { error: '제목, 요약, 핵심 포인트가 필요합니다' },
        { status: 400 }
      );
    });

    it('keyPoints가 없으면 400 에러를 반환해야 함', async () => {
      const invalidBody = {
        title: 'Title',
        summary: 'Summary',
        keyPoints: [],
      };

      const request = {
        json: async () => invalidBody,
      } as unknown as NextRequest;

      await POST(request);

      expect(mockJsonSpy).toHaveBeenCalledWith(
        { error: '제목, 요약, 핵심 포인트가 필요합니다' },
        { status: 400 }
      );
    });

    it('keyPoints가 undefined면 400 에러를 반환해야 함', async () => {
      const invalidBody = {
        title: 'Title',
        summary: 'Summary',
      };

      const request = {
        json: async () => invalidBody,
      } as unknown as NextRequest;

      await POST(request);

      expect(mockJsonSpy).toHaveBeenCalledWith(
        { error: '제목, 요약, 핵심 포인트가 필요합니다' },
        { status: 400 }
      );
    });
  });

  describe('API 키 확인', () => {
    it('OPENAI_API_KEY가 없으면 500 에러를 반환해야 함', async () => {
      delete process.env.OPENAI_API_KEY;

      const validBody = {
        title: 'Title',
        summary: 'Summary',
        keyPoints: ['Point 1'],
        arxivId: '2301.00001',
      };

      (getPaperCache as jest.Mock).mockResolvedValue(null);

      const request = {
        json: async () => validBody,
      } as unknown as NextRequest;

      await POST(request);

      expect(mockJsonSpy).toHaveBeenCalledWith(
        { error: 'OPENAI_API_KEY가 설정되지 않았습니다.' },
        { status: 500 }
      );

      // 환경 변수 복구
      process.env.OPENAI_API_KEY = 'test-api-key';
    });
  });

  describe('프롬프트 구성', () => {
    it('올바른 Mermaid mindmap 프롬프트를 사용해야 함', async () => {
      (getPaperCache as jest.Mock).mockResolvedValue(null);

      const request = {
        json: async () => validRequestBody,
      } as unknown as NextRequest;

      await POST(request);

      expect(glmClient.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'user',
              content: expect.stringContaining('Mermaid mindmap 다이어그램으로 변환'),
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

  describe('다이어그램 코드 정제', () => {
    it('마크다운 코드 블록을 제거해야 함', async () => {
      (getPaperCache as jest.Mock).mockResolvedValue(null);

      const markdownCode = `\`\`\`mermaid
mindmap
  root((Test))
\`\`\``;

      (tryGLMModels as jest.Mock).mockResolvedValue({
        choices: [
          {
            message: { content: markdownCode },
          },
        ],
      });

      const request = {
        json: async () => validRequestBody,
      } as unknown as NextRequest;

      await POST(request);

      expect(mockJsonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          diagramCode: expect.not.stringMatching(/```/),
        }),
        { status: 200 }
      );
    });

    it('YAML 코드 블록도 제거해야 함', async () => {
      (getPaperCache as jest.Mock).mockResolvedValue(null);

      const yamlCode = `\`\`\`yaml
mindmap
  root((Test))
\`\`\``;

      (tryGLMModels as jest.Mock).mockResolvedValue({
        choices: [
          {
            message: { content: yamlCode },
          },
        ],
      });

      const request = {
        json: async () => validRequestBody,
      } as unknown as NextRequest;

      await POST(request);

      expect(mockJsonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          diagramCode: expect.not.stringMatching(/```/),
        }),
        { status: 200 }
      );
    });

    it('트리밍된 코드를 반환해야 함', async () => {
      (getPaperCache as jest.Mock).mockResolvedValue(null);

      const untrimmedCode = `  mindmap
  root((Test))
  `;

      (tryGLMModels as jest.Mock).mockResolvedValue({
        choices: [
          {
            message: { content: untrimmedCode },
          },
        ],
      });

      const request = {
        json: async () => validRequestBody,
      } as unknown as NextRequest;

      await POST(request);

      expect(mockJsonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          diagramCode: expect.stringMatching(/^mindmap\n/),
        }),
        { status: 200 }
      );
    });
  });

  describe('소스 처리', () => {
    it('arxiv 소스일 때 arxivId로 저장해야 함', async () => {
      const arxivBody = {
        title: 'Title',
        summary: 'Summary',
        keyPoints: ['Point 1'],
        arxivId: '2301.00001',
        source: 'arxiv',
      };

      (getPaperCache as jest.Mock).mockResolvedValue(null);
      (saveInfographicUrl as jest.Mock).mockResolvedValue(true);

      const request = {
        json: async () => arxivBody,
      } as unknown as NextRequest;

      await POST(request);

      expect(saveInfographicUrl).toHaveBeenCalledWith(
        '2301.00001',
        expect.any(String)
      );
    });

    it('openreview 소스일 때 source와 arxivId로 저장해야 함', async () => {
      const openReviewBody = {
        title: 'Title',
        summary: 'Summary',
        keyPoints: ['Point 1'],
        arxivId: 'forum-abc123',
        source: 'openreview',
      };

      (getPaperCache as jest.Mock).mockResolvedValue(null);
      (saveInfographicUrl as jest.Mock).mockResolvedValue(true);

      const request = {
        json: async () => openReviewBody,
      } as unknown as NextRequest;

      await POST(request);

      expect(saveInfographicUrl).toHaveBeenCalledWith(
        'openreview',
        'forum-abc123',
        expect.any(String)
      );
    });
  });

  describe('에러 처리', () => {
    it('인포그래픽 생성 실패 시 에러를 반환해야 함', async () => {
      (getPaperCache as jest.Mock).mockResolvedValue(null);
      (tryGLMModels as jest.Mock).mockRejectedValue(new Error('AI API error'));

      const request = {
        json: async () => validRequestBody,
      } as unknown as NextRequest;

      await POST(request);

      expect(logError).toHaveBeenCalledWith('Infographic POST', expect.any(Error));
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

    it('캐시 저장 실패가 다이어그램 반환을 막지 않아야 함', async () => {
      (getPaperCache as jest.Mock).mockResolvedValue(null);
      (saveInfographicUrl as jest.Mock).mockRejectedValue(new Error('DB error'));

      const request = {
        json: async () => validRequestBody,
      } as unknown as NextRequest;

      await POST(request);

      // 저장 실패에도 다이어그램은 반환해야 함
      expect(mockJsonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          diagramCode: expect.any(String),
        }),
        { status: 200 }
      );
    });
  });

  describe('핵심 포인트 처리', () => {
    it('핵심 포인트를 프롬프트에 포함해야 함', async () => {
      (getPaperCache as jest.Mock).mockResolvedValue(null);

      const bodyWithPoints = {
        title: 'Title',
        summary: 'Summary',
        keyPoints: ['Point 1', 'Point 2', 'Point 3'],
        arxivId: '2301.00001',
      };

      const request = {
        json: async () => bodyWithPoints,
      } as unknown as NextRequest;

      await POST(request);

      expect(glmClient.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.stringContaining('- Point 1'),
            }),
          ]),
        })
      );
    });
  });
});
