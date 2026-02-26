/**
 * arXiv API Route Tests
 * /api/arxiv 엔드포인트 통합 테스트
 */

import { GET } from './route';

// Mock dependencies
jest.mock('@/lib/arxiv', () => ({
  searchArxiv: jest.fn(),
  getPaperById: jest.fn(),
  getLatestPapers: jest.fn(),
}));

jest.mock('@/lib/search', () => ({
  enhanceSearchQuery: jest.fn(),
}));

import {
  searchArxiv,
  getPaperById,
  getLatestPapers,
} from '@/lib/arxiv';

import { enhanceSearchQuery } from '@/lib/search';

// Mock 타입 단언
const mockSearchArxiv = searchArxiv as jest.MockedFunction<typeof searchArxiv>;
const mockGetPaperById = getPaperById as jest.MockedFunction<typeof getPaperById>;
const mockGetLatestPapers = getLatestPapers as jest.MockedFunction<typeof getLatestPapers>;
const mockEnhanceSearchQuery = enhanceSearchQuery as jest.MockedFunction<typeof enhanceSearchQuery>;

// 테스트용 더미 데이터
const mockArxivPaper = {
  source: 'arxiv' as const,
  sourceId: '2301.00001',
  sourceUrl: 'https://arxiv.org/abs/2301.00001',
  title: 'Attention Is All You Need',
  authors: ['Ashish Vaswani', 'Noam Shazeer', 'Niki Parmar'],
  abstract: 'The dominant sequence transduction models...',
  categories: ['cs.AI', 'cs.CL'],
  publishedAt: '2023-01-01T00:00:00Z',
  updatedAt: '2023-01-01T00:00:00Z',
  pdfUrl: 'https://arxiv.org/pdf/2301.00001.pdf',
  arxivId: '2301.00001',
  arxivUrl: 'https://arxiv.org/abs/2301.00001',
};

const mockArxivPapers = [mockArxivPaper];

/**
 * Mock NextRequest 생성 헬퍼 함수
 * NextRequest는 네이티브 Web API를 사용하므로 Jest에서 직접 생성할 수 없습니다.
 * 대신 필요한 프로퍼티만 가진 mock 객체를 생성합니다.
 */
function createMockNextRequest(url: string, options?: { method?: string; body?: any }): any {
  const urlObj = new URL(url);
  return {
    url,
    nextUrl: {
      searchParams: urlObj.searchParams,
      href: url,
      origin: urlObj.origin,
      pathname: urlObj.pathname,
      search: urlObj.search,
    },
    method: options?.method || 'GET',
    json: async () => options?.body || {},
    text: async () => JSON.stringify(options?.body || {}),
    headers: new Headers(),
  };
}

describe('GET /api/arxiv', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('action=search - 검색 기능 (기본)', () => {
    it('검색어가 없으면 400 에러를 반환해야 함', async () => {
      const request = createMockNextRequest('http://localhost:3000/api/arxiv');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({ error: '검색어가 필요합니다' });
    });

    it('기본 검색이 정상 작동해야 함', async () => {
      // enhanceSearchQuery는 기본적으로 호출됨 (enhance 파라미터가 없으면 true)
      mockEnhanceSearchQuery.mockResolvedValueOnce({
        originalQuery: 'transformer',
        englishKeywords: ['transformer'],
        searchQuery: 'transformer',
      });

      mockSearchArxiv.mockResolvedValueOnce({
        papers: mockArxivPapers,
        total: 1,
      });

      const request = createMockNextRequest(
        'http://localhost:3000/api/arxiv?query=transformer'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.papers).toHaveLength(1);
      expect(data.papers[0].title).toBe('Attention Is All You Need');
      expect(data.total).toBe(1);
      expect(mockSearchArxiv).toHaveBeenCalledWith({
        query: 'transformer',
        category: undefined,
        maxResults: 20,
        start: 0,
        dateRange: undefined,
      });
    });

    it('카테고리 필터링이 적용되어야 함', async () => {
      mockEnhanceSearchQuery.mockResolvedValueOnce({
        originalQuery: 'neural networks',
        englishKeywords: ['neural', 'networks'],
        searchQuery: 'neural networks',
      });

      mockSearchArxiv.mockResolvedValueOnce({
        papers: mockArxivPapers,
        total: 1,
      });

      const request = createMockNextRequest(
        'http://localhost:3000/api/arxiv?query=neural+networks&category=cs.AI'
      );

      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(mockSearchArxiv).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'cs.AI',
        })
      );
    });

    it('maxResults 파라미터가 적용되어야 함', async () => {
      mockEnhanceSearchQuery.mockResolvedValueOnce({
        originalQuery: 'test',
        englishKeywords: ['test'],
        searchQuery: 'test',
      });

      mockSearchArxiv.mockResolvedValueOnce({
        papers: mockArxivPapers,
        total: 1,
      });

      const request = createMockNextRequest(
        'http://localhost:3000/api/arxiv?query=test&maxResults=50'
      );

      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(mockSearchArxiv).toHaveBeenCalledWith(
        expect.objectContaining({
          maxResults: 50,
        })
      );
    });

    it('start 파라미터가 적용되어야 함', async () => {
      mockEnhanceSearchQuery.mockResolvedValueOnce({
        originalQuery: 'test',
        englishKeywords: ['test'],
        searchQuery: 'test',
      });

      mockSearchArxiv.mockResolvedValueOnce({
        papers: mockArxivPapers,
        total: 100,
      });

      const request = createMockNextRequest(
        'http://localhost:3000/api/arxiv?query=test&start=20'
      );

      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(mockSearchArxiv).toHaveBeenCalledWith(
        expect.objectContaining({
          start: 20,
        })
      );
    });
  });

  describe('검색어 향상(enhance) 기능', () => {
    it('AI 검색어 향상이 적용되어야 함', async () => {
      mockEnhanceSearchQuery.mockResolvedValueOnce({
        originalQuery: '딥러닝 이미지 분류',
        englishKeywords: ['deep learning', 'image classification', 'CNN'],
        searchQuery: 'deep learning OR image classification',
        suggestedCategory: 'cs.CV',
      });

      mockSearchArxiv.mockResolvedValueOnce({
        papers: mockArxivPapers,
        total: 1,
      });

      const request = createMockNextRequest(
        'http://localhost:3000/api/arxiv?query=딥러닝+이미지+분류'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockEnhanceSearchQuery).toHaveBeenCalledWith('딥러닝 이미지 분류');
      expect(mockSearchArxiv).toHaveBeenCalledWith({
        query: 'deep learning OR image classification',
        category: 'cs.CV',
        maxResults: 20,
        start: 0,
        dateRange: undefined,
      });
      expect(data.enhanced).not.toBeNull();
      expect(data.enhanced.originalQuery).toBe('딥러닝 이미지 분류');
      expect(data.enhanced.optimizedQuery).toBe('deep learning OR image classification');
    });

    it('enhance=false 시 검색어 향상이 비활성화되어야 함', async () => {
      mockSearchArxiv.mockResolvedValueOnce({
        papers: mockArxivPapers,
        total: 1,
      });

      const request = createMockNextRequest(
        'http://localhost:3000/api/arxiv?query=test&enhance=false'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockEnhanceSearchQuery).not.toHaveBeenCalled();
      expect(mockSearchArxiv).toHaveBeenCalledWith({
        query: 'test',
        category: undefined,
        maxResults: 20,
        start: 0,
        dateRange: undefined,
      });
      expect(data.enhanced).toBeNull();
    });

    it('날짜 필터가 포함된 향상 검색어가 적용되어야 함', async () => {
      mockEnhanceSearchQuery.mockResolvedValueOnce({
        originalQuery: '최신 AI 논문',
        englishKeywords: ['AI', 'artificial intelligence'],
        searchQuery: 'artificial intelligence',
        suggestedCategory: 'cs.AI',
        dateFilter: {
          startDate: '20230101',
          endDate: '20230131',
          description: '2023년 1월',
        },
      });

      mockSearchArxiv.mockResolvedValueOnce({
        papers: mockArxivPapers,
        total: 1,
      });

      const request = createMockNextRequest(
        'http://localhost:3000/api/arxiv?query=최신+AI+논문'
      );

      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(mockSearchArxiv).toHaveBeenCalledWith({
        query: 'artificial intelligence',
        category: 'cs.AI',
        maxResults: 20,
        start: 0,
        dateRange: {
          startDate: '20230101',
          endDate: '20230131',
        },
      });
    });

    it('enhance API 실패 시 500 에러를 반환해야 함', async () => {
      mockEnhanceSearchQuery.mockRejectedValueOnce(new Error('AI API error'));

      const request = createMockNextRequest(
        'http://localhost:3000/api/arxiv?query=test+query'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('arXiv API 호출 중 오류가 발생했습니다');
    });
  });

  describe('action=get - 특정 논문 조회', () => {
    it('ID가 없으면 400 에러를 반환해야 함', async () => {
      const request = createMockNextRequest(
        'http://localhost:3000/api/arxiv?action=get'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({ error: 'ID가 필요합니다' });
    });

    it('논문을 성공적으로 조회해야 함', async () => {
      mockGetPaperById.mockResolvedValueOnce(mockArxivPaper);

      const request = createMockNextRequest(
        'http://localhost:3000/api/arxiv?action=get&id=2301.00001'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.source).toBe('arxiv');
      expect(data.arxivId).toBe('2301.00001');
      expect(data.title).toBe('Attention Is All You Need');
      expect(mockGetPaperById).toHaveBeenCalledWith('2301.00001');
    });

    it('논문을 찾을 수 없으면 404를 반환해야 함', async () => {
      mockGetPaperById.mockResolvedValueOnce(null);

      const request = createMockNextRequest(
        'http://localhost:3000/api/arxiv?action=get&id=9999.99999'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data).toEqual({ error: '논문을 찾을 수 없습니다' });
    });
  });

  describe('action=latest - 최신 논문 조회', () => {
    it('최신 논문을 조회해야 함', async () => {
      mockGetLatestPapers.mockResolvedValueOnce(mockArxivPapers);

      const request = createMockNextRequest(
        'http://localhost:3000/api/arxiv?action=latest&category=cs.AI&maxResults=10'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.papers).toHaveLength(1);
      expect(data.total).toBe(1);
      expect(mockGetLatestPapers).toHaveBeenCalledWith('cs.AI', 10);
    });

    it('기본 카테고리(cs.AI)가 적용되어야 함', async () => {
      mockGetLatestPapers.mockResolvedValueOnce([]);

      const request = createMockNextRequest(
        'http://localhost:3000/api/arxiv?action=latest'
      );

      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(mockGetLatestPapers).toHaveBeenCalledWith('cs.AI', 10);
    });

    it('기본 maxResults=10이 적용되어야 함', async () => {
      mockGetLatestPapers.mockResolvedValueOnce([]);

      const request = createMockNextRequest(
        'http://localhost:3000/api/arxiv?action=latest&category=cs.LG'
      );

      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(mockGetLatestPapers).toHaveBeenCalledWith('cs.LG', 10);
    });
  });

  describe('에러 처리', () => {
    it('arXiv API 오류 시 500 에러를 반환해야 함', async () => {
      mockEnhanceSearchQuery.mockResolvedValueOnce({
        originalQuery: 'test',
        englishKeywords: ['test'],
        searchQuery: 'test',
      });

      mockSearchArxiv.mockRejectedValueOnce(new Error('arXiv API error'));

      const request = createMockNextRequest(
        'http://localhost:3000/api/arxiv?query=test'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('arXiv API 호출 중 오류가 발생했습니다');
    });

    it('특정 논문 조회 중 오류 발생 시 500 에러를 반환해야 함', async () => {
      mockGetPaperById.mockRejectedValueOnce(new Error('Network error'));

      const request = createMockNextRequest(
        'http://localhost:3000/api/arxiv?action=get&id=123'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('arXiv API 호출 중 오류가 발생했습니다');
    });
  });
});
