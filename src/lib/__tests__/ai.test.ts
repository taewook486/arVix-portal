import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// @MX:NOTE: OpenAI 모듈 모킹은 모듈 로드 전에 수행
jest.mock('openai');

// 모킹된 OpenAI 모듈에서 타입 가져오기
import OpenAI from 'openai';
import { analyzePaper, generateQuickSummary } from '../ai';
import { AIAnalysis } from '@/types/paper';

// 모킹된 chat.completions.create 메서드 타입 정의
const mockCreate = jest.fn();
const mockChatCompletions = {
  create: mockCreate,
};

// OpenAI 생성자 모킹
jest.mocked(OpenAI).mockImplementation(() => ({
  chat: {
    completions: mockChatCompletions,
  },
}) as any);

describe('AI Library (DDD Mode - Characterization Tests)', () => {
  // 환경 변수 모킹
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, OPENAI_API_KEY: 'test-api-key' };

    // 기본 성공 응답 설정
    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            role: 'assistant',
            content: JSON.stringify({
              summary: '논문 요약 테스트',
              keyPoints: ['키 포인트 1', '키 포인트 2', '키 포인트 3'],
              methodology: '사용된 방법론',
              contributions: ['기여 1', '기여 2'],
              limitations: ['한계 1', '한계 2'],
            }),
          },
        },
      ],
    });
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('analyzePaper', () => {
    const mockTitle = 'Test Paper Title';
    const mockAbstract = 'This is a test abstract for the paper.';

    it('논문 제목과 초록으로 분석을 생성해야 함', async () => {
      const mockAnalysis: AIAnalysis = {
        summary: '논문의 핵심 내용을 2-3문장으로 요약',
        keyPoints: ['핵심 포인트 1', '핵심 포인트 2', '핵심 포인트 3'],
        methodology: '사용된 방법론 간략히 설명',
        contributions: ['주요 기여 1', '주요 기여 2'],
        limitations: ['한계점 또는 향후 연구 방향 1', '한계점 또는 향후 연구 방향 2'],
      };

      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify(mockAnalysis),
            },
          },
        ],
      });

      const result = await analyzePaper(mockTitle, mockAbstract);

      expect(result).toEqual(mockAnalysis);
      expect(mockCreate).toHaveBeenCalledWith({
        model: 'glm-5',
        messages: [
          {
            role: 'user',
            content: expect.stringContaining(mockTitle),
          },
        ],
        temperature: 0.7,
      });
    });

    it('마크다운 코드 블록이 포함된 응답을 처리해야 함', async () => {
      // 마크다운 코드 블록이 포함된 JSON 응답 시뮬레이션
      const jsonContent = JSON.stringify({
        summary: '요약',
        keyPoints: ['포인트 1'],
        methodology: '방법론',
        contributions: ['기여'],
        limitations: ['한계'],
      });
      const analysisWithMarkdown = `\`\`\`json\n${jsonContent}\n\`\`\``;

      mockCreate.mockResolvedValue({
        choices: [
          {
            message: { content: analysisWithMarkdown },
          },
        ],
      });

      const result = await analyzePaper(mockTitle, mockAbstract);

      expect(result.summary).toBe('요약');
      expect(result.keyPoints).toEqual(['포인트 1']);
    });

    it('모델 실패시 폴백해야 함', async () => {
      mockCreate
        .mockRejectedValueOnce(new Error('glm-5 failed'))
        .mockRejectedValueOnce(new Error('glm-4.7 failed'))
        .mockResolvedValueOnce({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  summary: '폴백 성공',
                  keyPoints: [],
                  methodology: '',
                  contributions: [],
                  limitations: [],
                }),
              },
            },
          ],
        });

      const result = await analyzePaper(mockTitle, mockAbstract);

      expect(mockCreate).toHaveBeenCalledTimes(3);
      expect(result.summary).toBe('폴백 성공');
    });

    it('API 키가 없으면 에러를 반환해야 함', async () => {
      process.env.OPENAI_API_KEY = '';

      await expect(analyzePaper(mockTitle, mockAbstract)).rejects.toThrow('API 키가 설정되지 않았습니다.');
    });

    it('모든 모델 실패시 상세 에러를 반환해야 함', async () => {
      mockCreate.mockRejectedValue(new Error('All models failed'));

      await expect(analyzePaper(mockTitle, mockAbstract)).rejects.toThrow('All models failed');
    });

    it('JSON 파싱 오류를 처리해야 함', async () => {
      mockCreate.mockResolvedValue({
        choices: [
          {
            message: { content: 'Invalid JSON response' },
          },
        ],
      });

      await expect(analyzePaper(mockTitle, mockAbstract)).rejects.toThrow();
    });
  });

  describe('generateQuickSummary', () => {
    const mockAbstract = 'This is a detailed abstract that needs to be summarized briefly in Korean.';

    it('초록을 한국어로 요약해야 함', async () => {
      const expectedSummary = '이 논문은 딥러닝 모델을 제안합니다.';

      mockCreate.mockResolvedValue({
        choices: [
          {
            message: { content: expectedSummary },
          },
        ],
      });

      const result = await generateQuickSummary(mockAbstract);

      expect(result).toBe(expectedSummary);
      expect(mockCreate).toHaveBeenCalledWith({
        model: 'glm-5',
        messages: [
          {
            role: 'user',
            content: expect.stringContaining('한국어로 2-3문장으로 간결하게 요약'),
          },
        ],
        temperature: 0.7,
      });
    });

    it('빈 응답을 처리해야 함', async () => {
      mockCreate.mockResolvedValue({
        choices: [
          {
            message: { content: null },
          },
        ],
      });

      const result = await generateQuickSummary(mockAbstract);

      expect(result).toBe('');
    });

    it('API 키가 없으면 에러를 반환해야 함', async () => {
      process.env.OPENAI_API_KEY = '';

      await expect(generateQuickSummary(mockAbstract)).rejects.toThrow('API 키가 설정되지 않았습니다.');
    });

    it('트리밍된 응답을 반환해야 함', async () => {
      const untrimmedSummary = '  요약 내용입니다.  ';
      const expectedSummary = '요약 내용입니다.';

      mockCreate.mockResolvedValue({
        choices: [
          {
            message: { content: untrimmedSummary },
          },
        ],
      });

      const result = await generateQuickSummary(mockAbstract);

      expect(result).toBe(expectedSummary);
    });
  });

  describe('에러 처리', () => {
    it('네트워크 에러를 적절히 처리해야 함', async () => {
      mockCreate.mockRejectedValue(new Error('Network error'));

      await expect(analyzePaper('Title', 'Abstract')).rejects.toThrow('Network error');
    });

    it('타임아웃 에러를 적절히 처리해야 함', async () => {
      const timeoutError = new Error('Request timeout');
      timeoutError.name = 'AbortError';
      mockCreate.mockRejectedValue(timeoutError);

      await expect(analyzePaper('Title', 'Abstract')).rejects.toThrow('Request timeout');
    });
  });
});
