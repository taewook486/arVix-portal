/**
 * Bookmarks API Route Tests
 * /api/bookmarks 엔드포인트 통합 테스트
 */

import { GET, POST, DELETE } from './route';

// Mock dependencies
jest.mock('@/lib/db', () => ({
  getBookmarks: jest.fn(),
  addBookmark: jest.fn(),
  removeBookmark: jest.fn(),
  isBookmarked: jest.fn(),
  initDatabase: jest.fn(),
}));

import {
  getBookmarks,
  addBookmark,
  removeBookmark,
  isBookmarked,
  initDatabase,
} from '@/lib/db';

// Mock 타입 단언
const mockGetBookmarks = getBookmarks as jest.MockedFunction<typeof getBookmarks>;
const mockAddBookmark = addBookmark as jest.MockedFunction<typeof addBookmark>;
const mockRemoveBookmark = removeBookmark as jest.MockedFunction<typeof removeBookmark>;
const mockIsBookmarked = isBookmarked as jest.MockedFunction<typeof isBookmarked>;
const mockInitDatabase = initDatabase as jest.MockedFunction<typeof initDatabase>;

// 테스트용 더미 데이터
const mockPaper = {
  source: 'arxiv' as const,
  sourceId: '2301.00001',
  sourceUrl: 'https://arxiv.org/abs/2301.00001',
  title: 'Test Paper',
  authors: ['Author One', 'Author Two'],
  abstract: 'Test abstract',
  categories: ['cs.AI'],
  publishedAt: '2023-01-01T00:00:00Z',
  updatedAt: '2023-01-01T00:00:00Z',
  pdfUrl: 'https://arxiv.org/pdf/2301.00001.pdf',
  arxivId: '2301.00001',
  arxivUrl: 'https://arxiv.org/abs/2301.00001',
};

const mockBookmark = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  source: 'arxiv',
  source_id: '2301.00001',
  arxiv_id: '2301.00001',
  title: 'Test Paper',
  authors: ['Author One', 'Author Two'],
  abstract: 'Test abstract',
  categories: ['cs.AI'],
  published_at: '2023-01-01T00:00:00Z',
  pdf_url: 'https://arxiv.org/pdf/2301.00001.pdf',
  source_url: 'https://arxiv.org/abs/2301.00001',
  ai_summary: null,
  created_at: '2023-01-01T00:00:00Z',
};

const mockBookmarks = [mockBookmark];

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

describe('GET /api/bookmarks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockInitDatabase.mockResolvedValue(undefined);
  });

  describe('북마크 목록 조회', () => {
    it('전체 북마크 목록을 반환해야 함', async () => {
      mockGetBookmarks.mockResolvedValueOnce(mockBookmarks);

      const request = createMockNextRequest('http://localhost:3000/api/bookmarks');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockBookmarks);
      expect(mockGetBookmarks).toHaveBeenCalled();
    });

    it('빈 북마크 목록을 반환해야 함', async () => {
      mockGetBookmarks.mockResolvedValueOnce([]);

      const request = createMockNextRequest('http://localhost:3000/api/bookmarks');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual([]);
    });
  });

  describe('특정 논문 북마크 여부 확인', () => {
    it('source + sourceId로 북마크 여부를 확인해야 함', async () => {
      mockIsBookmarked.mockResolvedValueOnce(true);

      const request = createMockNextRequest(
        'http://localhost:3000/api/bookmarks?source=arxiv&sourceId=2301.00001'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ bookmarked: true });
      expect(mockIsBookmarked).toHaveBeenCalledWith('arxiv', '2301.00001');
    });

    it('북마크되지 않은 논문은 false를 반환해야 함', async () => {
      mockIsBookmarked.mockResolvedValueOnce(false);

      const request = createMockNextRequest(
        'http://localhost:3000/api/bookmarks?source=openreview&sourceId=ICLR.cc/2024/Conference/1234'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ bookmarked: false });
    });

    it('하위 호환성: arxivId 파라미터로도 확인해야 함', async () => {
      mockIsBookmarked.mockResolvedValueOnce(true);

      const request = createMockNextRequest(
        'http://localhost:3000/api/bookmarks?arxivId=2301.00001'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ bookmarked: true });
      expect(mockIsBookmarked).toHaveBeenCalledWith('2301.00001');
    });
  });

  describe('에러 처리', () => {
    it('DB 오류 발생 시 500 에러를 반환해야 함', async () => {
      mockGetBookmarks.mockRejectedValueOnce(new Error('Database error'));

      const request = createMockNextRequest('http://localhost:3000/api/bookmarks');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('북마크 조회 실패');
    });
  });
});

describe('POST /api/bookmarks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockInitDatabase.mockResolvedValue(undefined);
  });

  describe('북마크 추가', () => {
    it('북마크를 성공적으로 추가해야 함', async () => {
      mockAddBookmark.mockResolvedValueOnce(mockBookmark);

      const request = createMockNextRequest('http://localhost:3000/api/bookmarks', {
        method: 'POST',
        body: {
          paper: mockPaper,
          aiSummary: 'Test AI summary',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockBookmark);
      expect(mockAddBookmark).toHaveBeenCalledWith(mockPaper, 'Test AI summary');
    });

    it('AI 요약 없이 북마크를 추가할 수 있어야 함', async () => {
      mockAddBookmark.mockResolvedValueOnce(mockBookmark);

      const request = createMockNextRequest('http://localhost:3000/api/bookmarks', {
        method: 'POST',
        body: {
          paper: mockPaper,
        },
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(mockAddBookmark).toHaveBeenCalledWith(mockPaper, undefined);
    });

    it('OpenReview 논문 북마크도 추가할 수 있어야 함', async () => {
      const openreviewPaper = { ...mockPaper, source: 'openreview' as const, sourceId: 'ICLR.cc/2024/Conference/1234' };
      const openreviewBookmark = { ...mockBookmark, source: 'openreview', source_id: 'ICLR.cc/2024/Conference/1234' };

      mockAddBookmark.mockResolvedValueOnce(openreviewBookmark);

      const request = createMockNextRequest('http://localhost:3000/api/bookmarks', {
        method: 'POST',
        body: {
          paper: openreviewPaper,
        },
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(mockAddBookmark).toHaveBeenCalledWith(openreviewPaper, undefined);
    });
  });

  describe('유효성 검사', () => {
    it('논문 정보가 없으면 400 에러를 반환해야 함', async () => {
      const request = createMockNextRequest('http://localhost:3000/api/bookmarks', {
        method: 'POST',
        body: {},
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('논문 정보가 필요합니다');
    });

    it('sourceId가 없으면 400 에러를 반환해야 함', async () => {
      const invalidPaper = { ...mockPaper, sourceId: '' };

      const request = createMockNextRequest('http://localhost:3000/api/bookmarks', {
        method: 'POST',
        body: {
          paper: invalidPaper,
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('논문 정보가 필요합니다');
    });

    it('잘못된 JSON 형식이면 에러를 처리해야 함', async () => {
      const request = createMockNextRequest('http://localhost:3000/api/bookmarks', {
        method: 'POST',
        body: 'invalid json',
      });

      // json() 메서드가 에러를 던지도록 설정
      request.json = jest.fn().mockRejectedValueOnce(new Error('Invalid JSON'));

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('북마크 추가 실패');
    });
  });

  describe('에러 처리', () => {
    it('DB 오류 발생 시 500 에러를 반환해야 함', async () => {
      mockAddBookmark.mockRejectedValueOnce(new Error('Database error'));

      const request = createMockNextRequest('http://localhost:3000/api/bookmarks', {
        method: 'POST',
        body: {
          paper: mockPaper,
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('북마크 추가 실패');
    });

    it('추가 실패 시(null 반환) 500 에러를 반환해야 함', async () => {
      mockAddBookmark.mockResolvedValueOnce(null);

      const request = createMockNextRequest('http://localhost:3000/api/bookmarks', {
        method: 'POST',
        body: {
          paper: mockPaper,
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('북마크 추가 실패');
    });
  });
});

describe('DELETE /api/bookmarks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockInitDatabase.mockResolvedValue(undefined);
  });

  describe('북마크 삭제', () => {
    it('source + sourceId로 북마크를 삭제해야 함', async () => {
      mockRemoveBookmark.mockResolvedValueOnce(true);

      const request = createMockNextRequest(
        'http://localhost:3000/api/bookmarks?source=arxiv&sourceId=2301.00001'
      );

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ success: true });
      expect(mockRemoveBookmark).toHaveBeenCalledWith('arxiv', '2301.00001');
    });

    it('OpenReview 북마크도 삭제할 수 있어야 함', async () => {
      mockRemoveBookmark.mockResolvedValueOnce(true);

      const request = createMockNextRequest(
        'http://localhost:3000/api/bookmarks?source=openreview&sourceId=ICLR.cc/2024/Conference/1234'
      );

      const response = await DELETE(request);

      expect(response.status).toBe(200);
      expect(mockRemoveBookmark).toHaveBeenCalledWith('openreview', 'ICLR.cc/2024/Conference/1234');
    });

    it('하위 호환성: arxivId 파라미터로도 삭제할 수 있어야 함', async () => {
      mockRemoveBookmark.mockResolvedValueOnce(true);

      const request = createMockNextRequest(
        'http://localhost:3000/api/bookmarks?arxivId=2301.00001'
      );

      const response = await DELETE(request);

      expect(response.status).toBe(200);
      expect(mockRemoveBookmark).toHaveBeenCalledWith('2301.00001');
    });
  });

  describe('유효성 검사', () => {
    it('필수 파라미터가 없으면 400 에러를 반환해야 함', async () => {
      const request = createMockNextRequest(
        'http://localhost:3000/api/bookmarks'
      );

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('source와 sourceId 또는 arxivId가 필요합니다');
    });

    it('source만 있고 sourceId가 없으면 400 에러를 반환해야 함', async () => {
      const request = createMockNextRequest(
        'http://localhost:3000/api/bookmarks?source=arxiv'
      );

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('source와 sourceId 또는 arxivId가 필요합니다');
    });
  });

  describe('에러 처리', () => {
    it('삭제 실패 시 500 에러를 반환해야 함', async () => {
      mockRemoveBookmark.mockResolvedValueOnce(false);

      const request = createMockNextRequest(
        'http://localhost:3000/api/bookmarks?source=arxiv&sourceId=2301.00001'
      );

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('북마크 삭제 실패');
    });

    it('DB 오류 발생 시 500 에러를 반환해야 함', async () => {
      mockRemoveBookmark.mockRejectedValueOnce(new Error('Database error'));

      const request = createMockNextRequest(
        'http://localhost:3000/api/bookmarks?arxivId=2301.00001'
      );

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('북마크 삭제 실패');
    });
  });
});
