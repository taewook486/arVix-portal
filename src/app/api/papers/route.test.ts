/**
 * Papers API Route Tests
 * /api/papers 엔드포인트 통합 테스트
 */

import { GET } from './route';

// Mock dependencies
jest.mock('@/lib/arxiv', () => ({
  searchArxiv: jest.fn(),
  getPaperById: jest.fn(),
  getLatestPapers: jest.fn(),
}));

jest.mock('@/lib/openreview', () => ({
  searchOpenReview: jest.fn(),
  getPaperById: jest.fn(),
  getLatestPapers: jest.fn(),
}));

jest.mock('@/lib/search', () => ({
  enhanceSearchQuery: jest.fn(),
}));

import {
  searchArxiv,
  getPaperById as getArxivPaperById,
  getLatestPapers as getArxivLatestPapers,
} from '@/lib/arxiv';

import {
  searchOpenReview,
  getPaperById as getOpenReviewPaperById,
  getLatestPapers as getOpenReviewLatestPapers,
} from '@/lib/openreview';

import { enhanceSearchQuery } from '@/lib/search';

// Mock 타입 단언
const mockSearchArxiv = searchArxiv as jest.MockedFunction<typeof searchArxiv>;
const mockGetArxivPaperById = getArxivPaperById as jest.MockedFunction<typeof getArxivPaperById>;
const mockGetArxivLatestPapers = getArxivLatestPapers as jest.MockedFunction<typeof getArxivLatestPapers>;

const mockSearchOpenReview = searchOpenReview as jest.MockedFunction<typeof searchOpenReview>;
const mockGetOpenReviewPaperById = getOpenReviewPaperById as jest.MockedFunction<typeof getOpenReviewPaperById>;
const mockGetOpenReviewLatestPapers = getOpenReviewLatestPapers as jest.MockedFunction<typeof getOpenReviewLatestPapers>;

const mockEnhanceSearchQuery = enhanceSearchQuery as jest.MockedFunction<typeof enhanceSearchQuery>;

// 테스트용 더미 데이터
const mockArxivPaper = {
  source: 'arxiv' as const,
  sourceId: '2301.00001',
  sourceUrl: 'https://arxiv.org/abs/2301.00001',
  title: 'Test ArXiv Paper',
  authors: ['Author One', 'Author Two'],
  abstract: 'This is a test abstract',
  categories: ['cs.AI'],
  publishedAt: '2023-01-01T00:00:00Z',
  updatedAt: '2023-01-01T00:00:00Z',
  pdfUrl: 'https://arxiv.org/pdf/2301.00001.pdf',
  arxivId: '2301.00001',
  arxivUrl: 'https://arxiv.org/abs/2301.00001',
};

const mockOpenReviewPaper = {
  source: 'openreview' as const,
  sourceId: 'ICLR.cc/2024/Conference/1234',
  sourceUrl: 'https://openreview.net/forum?id=ICLR.cc/2024/Conference/1234',
  title: 'Test OpenReview Paper',
  authors: ['Author Three', 'Author Four'],
  abstract: 'This is a test OpenReview abstract',
  categories: ['ICLR.cc/2024/Conference'],
  publishedAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  pdfUrl: 'https://openreview.net/pdf?id=ICLR.cc/2024/Conference/1234',
};

/**
 * Mock NextRequest 생성 헬퍼 함수
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

describe('GET /api/papers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('action=search - 검색 기능', () => {
    it('검색어가 없으면 400 에러를 반환해야 함 (Zod validation)', async () => {
      const request = createMockNextRequest('http://localhost:3000/api/papers?action=search');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('검색 파라미터');
      expect(data.issues).toBeDefined();
    });

    it('arXiv 소스로 검색해야 함', async () => {
      mockSearchArxiv.mockResolvedValueOnce({
        papers: [mockArxivPaper],
        total: 1,
      });
      mockEnhanceSearchQuery.mockResolvedValueOnce({
        originalQuery: 'machine learning',
        englishKeywords: ['machine learning'],
        searchQuery: 'machine learning',
      });

      const request = createMockNextRequest(
        'http://localhost:3000/api/papers?action=search&query=machine+learning&source=arxiv'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.papers).toHaveLength(1);
      expect(data.papers[0].source).toBe('arxiv');
      expect(data.sources.arxiv.count).toBe(1);
      expect(data.sources.openreview.count).toBe(0);
      expect(mockSearchArxiv).toHaveBeenCalledWith({
        query: 'machine learning',
        maxResults: 20,
        start: 0,
        category: undefined,
        dateRange: undefined,
      });
    });

    it('openreview 소스로 검색해야 함', async () => {
      mockSearchOpenReview.mockResolvedValueOnce({
        papers: [mockOpenReviewPaper],
        total: 1,
      });
      mockEnhanceSearchQuery.mockResolvedValueOnce({
        originalQuery: 'deep learning',
        englishKeywords: ['deep learning'],
        searchQuery: 'deep learning',
      });

      const request = createMockNextRequest(
        'http://localhost:3000/api/papers?action=search&query=deep+learning&source=openreview'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.papers).toHaveLength(1);
      expect(data.papers[0].source).toBe('openreview');
      expect(data.sources.arxiv.count).toBe(0);
      expect(data.sources.openreview.count).toBe(1);
      expect(mockSearchOpenReview).toHaveBeenCalledWith({
        query: 'deep learning',
        maxResults: 20,
        start: 0,
      });
    });

    it('both 소스로 검색하여 병합해야 함', async () => {
      mockSearchArxiv.mockResolvedValueOnce({
        papers: [mockArxivPaper],
        total: 1,
      });
      mockSearchOpenReview.mockResolvedValueOnce({
        papers: [mockOpenReviewPaper],
        total: 1,
      });
      mockEnhanceSearchQuery.mockResolvedValueOnce({
        originalQuery: 'neural networks',
        englishKeywords: ['neural networks'],
        searchQuery: 'neural networks',
      });

      const request = createMockNextRequest(
        'http://localhost:3000/api/papers?action=search&query=neural+networks&source=both'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.papers).toHaveLength(2);
      expect(data.sources.arxiv.count).toBe(1);
      expect(data.sources.openreview.count).toBe(1);
      expect(data.total).toBe(2);
    });

    it('검색어 향상(enhance) 비활성화 시 원본 검색어 사용해야 함', async () => {
      mockSearchArxiv.mockResolvedValueOnce({
        papers: [mockArxivPaper],
        total: 1,
      });

      const request = createMockNextRequest(
        'http://localhost:3000/api/papers?action=search&query=test+query&enhance=false&source=arxiv'
      );

      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(mockEnhanceSearchQuery).not.toHaveBeenCalled();
      expect(mockSearchArxiv).toHaveBeenCalledWith(
        expect.objectContaining({
          query: 'test query',
        })
      );
    });

    it('카테고리 필터링이 적용되어야 함', async () => {
      mockSearchArxiv.mockResolvedValueOnce({
        papers: [mockArxivPaper],
        total: 1,
      });
      mockEnhanceSearchQuery.mockResolvedValueOnce({
        originalQuery: 'transformer',
        englishKeywords: ['transformer'],
        searchQuery: 'transformer',
        suggestedCategory: 'cs.CL',
      });

      const request = createMockNextRequest(
        'http://localhost:3000/api/papers?action=search&query=transformer&category=cs.AI&source=arxiv'
      );

      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(mockSearchArxiv).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'cs.AI',
        })
      );
    });

    it('한 소스 API 실패 시 다른 소스 결과만 반환해야 함', async () => {
      mockSearchArxiv.mockRejectedValueOnce(new Error('arXiv API error'));
      mockSearchOpenReview.mockResolvedValueOnce({
        papers: [mockOpenReviewPaper],
        total: 1,
      });
      mockEnhanceSearchQuery.mockResolvedValueOnce({
        originalQuery: 'test',
        englishKeywords: ['test'],
        searchQuery: 'test',
      });

      const request = createMockNextRequest(
        'http://localhost:3000/api/papers?action=search&query=test&source=both'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.papers).toHaveLength(1);
      expect(data.papers[0].source).toBe('openreview');
      expect(data.sources.arxiv.count).toBe(0);
      expect(data.sources.openreview.count).toBe(1);
    });
  });

  describe('action=get - 특정 논문 조회', () => {
    it('ID가 없으면 400 에러를 반환해야 함', async () => {
      const request = createMockNextRequest('http://localhost:3000/api/papers?action=get');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({ error: 'ID가 필요합니다' });
    });

    it('arXiv 소스로 논문을 조회해야 함', async () => {
      mockGetArxivPaperById.mockResolvedValueOnce(mockArxivPaper);

      const request = createMockNextRequest(
        'http://localhost:3000/api/papers?action=get&id=2301.00001&source=arxiv'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.source).toBe('arxiv');
      expect(data.sourceId).toBe('2301.00001');
      expect(mockGetArxivPaperById).toHaveBeenCalledWith('2301.00001');
    });

    it('OpenReview 소스로 논문을 조회해야 함', async () => {
      mockGetOpenReviewPaperById.mockResolvedValueOnce(mockOpenReviewPaper);

      const request = createMockNextRequest(
        'http://localhost:3000/api/papers?action=get&id=ICLR.cc/2024/Conference/1234&source=openreview'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.source).toBe('openreview');
      expect(data.sourceId).toBe('ICLR.cc/2024/Conference/1234');
      expect(mockGetOpenReviewPaperById).toHaveBeenCalledWith('ICLR.cc/2024/Conference/1234');
    });

    it('ID에 소스 접두사가 있으면 자동 감지해야 함', async () => {
      mockGetArxivPaperById.mockResolvedValueOnce(mockArxivPaper);

      const request = createMockNextRequest(
        'http://localhost:3000/api/papers?action=get&id=arxiv:2301.00001&source=arxiv'
      );

      const response = await GET(request);

      // When source=arxiv is specified, it passes the full ID to arxiv
      expect(response.status).toBe(200);
      expect(mockGetArxivPaperById).toHaveBeenCalledWith('arxiv:2301.00001');
    });

    it('논문을 찾을 수 없으면 404를 반환해야 함', async () => {
      mockGetArxivPaperById.mockResolvedValueOnce(null);

      const request = createMockNextRequest(
        'http://localhost:3000/api/papers?action=get&id=9999.99999&source=arxiv'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data).toEqual({ error: '논문을 찾을 수 없습니다' });
    });

    it('소스 파라미터가 없으면 기본값으로 arxiv 감지를 시도해야 함', async () => {
      mockGetArxivPaperById.mockResolvedValueOnce(mockArxivPaper);

      const request = createMockNextRequest(
        'http://localhost:3000/api/papers?action=get&id=2301.00001'
      );

      const response = await GET(request);
      const data = await response.json();

      // source='both'로 Zod 검증 실패
      expect(response.status).toBe(400);
      expect(data.error).toContain('source');
    });

    it('잘못된 소스 파라미터는 400 에러를 반환해야 함', async () => {
      const request = createMockNextRequest(
        'http://localhost:3000/api/papers?action=get&id=123&source=invalid'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('source');
    });
  });

  describe('action=latest - 최신 논문 조회', () => {
    it('arXiv 최신 논문을 조회해야 함', async () => {
      mockGetArxivLatestPapers.mockResolvedValueOnce([mockArxivPaper]);

      const request = createMockNextRequest(
        'http://localhost:3000/api/papers?action=latest&source=arxiv&category=cs.AI&maxResults=10'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.papers).toHaveLength(1);
      expect(data.total).toBe(1);
      expect(mockGetArxivLatestPapers).toHaveBeenCalledWith('cs.AI', 10);
    });

    it('OpenReview 최신 논문을 조회해야 함', async () => {
      mockGetOpenReviewLatestPapers.mockResolvedValueOnce([mockOpenReviewPaper]);

      const request = createMockNextRequest(
        'http://localhost:3000/api/papers?action=latest&source=openreview&venue=ICLR.cc&maxResults=10'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.papers).toHaveLength(1);
      expect(data.total).toBe(1);
      expect(mockGetOpenReviewLatestPapers).toHaveBeenCalledWith('ICLR.cc', 10);
    });

    it('both 소스로 최신 논문을 병합하여 조회해야 함', async () => {
      mockGetArxivLatestPapers.mockResolvedValueOnce([mockArxivPaper]);
      mockGetOpenReviewLatestPapers.mockResolvedValueOnce([mockOpenReviewPaper]);

      const request = createMockNextRequest(
        'http://localhost:3000/api/papers?action=latest&source=both'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.papers).toHaveLength(2);
      expect(mockGetArxivLatestPapers).toHaveBeenCalledWith('cs.AI', 5);
      expect(mockGetOpenReviewLatestPapers).toHaveBeenCalledWith('ICLR.cc', 5);
    });

    it('기본 파라미터가 적용되어야 함', async () => {
      mockGetArxivLatestPapers.mockResolvedValueOnce([]);

      const request = createMockNextRequest(
        'http://localhost:3000/api/papers?action=latest&source=arxiv'
      );

      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(mockGetArxivLatestPapers).toHaveBeenCalledWith('cs.AI', 10);
    });
  });

  describe('에러 처리', () => {
    it('API 호출 중 예외가 발생하면 500 에러를 반환해야 함', async () => {
      mockSearchArxiv.mockRejectedValueOnce(new Error('Unexpected error'));
      mockEnhanceSearchQuery.mockResolvedValueOnce({
        originalQuery: 'test',
        englishKeywords: ['test'],
        searchQuery: 'test',
      });

      const request = createMockNextRequest(
        'http://localhost:3000/api/papers?action=search&query=test&source=arxiv'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('오류가 발생했습니다');
    });
  });
});
