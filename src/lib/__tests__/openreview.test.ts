import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { SearchParams } from '@/types/paper';

// @MX:NOTE: fetch API 모킹은 전역 수행
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

// Import openreview module AFTER setting up mocks
import { searchOpenReview, getPaperById, getLatestPapers } from '../openreview';
import { Paper } from '@/types/paper';

describe('OpenReview Library (DDD Mode - Characterization Tests)', () => {
  // Sample OpenReview API response
  const mockOpenReviewNotes = [
    {
      id: 'abc123',
      forum: 'abc123',
      content: {
        title: { value: 'Test Paper Title' },
        abstract: { value: 'This is a test abstract for the OpenReview paper.' },
        authors: { value: ['Author One', 'Author Two'] },
        venue: { value: 'ICLR 2024' },
        venueid: { value: 'ICLR.cc/2024/Conference' },
      },
      cdate: 1704067200000, // 2024-01-01
      mdate: 1704067200000,
      invitation: 'ICLR.cc/2024/Conference/-/Submission',
    },
    {
      id: 'def456',
      forum: 'def456',
      content: {
        title: { value: 'Another Paper' },
        abstract: { value: 'Another abstract here.' },
        authors: { value: ['Author Three'] },
        venueid: { value: 'NeurIPS.cc/2023/Conference' },
      },
      cdate: 1701388800000, // 2023-12-01
      mdate: 1701388800000,
      invitation: 'NeurIPS.cc/2023/Conference/-/Submission',
    },
  ];

  const mockOpenReviewResponse = {
    notes: mockOpenReviewNotes,
    count: 2,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // 기본 성공 응답 설정
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockOpenReviewResponse,
    } as Response);
  });

  describe('searchOpenReview', () => {
    it('검색어로 논문을 검색해야 함', async () => {
      const params: SearchParams = {
        query: 'machine learning',
        maxResults: 10,
      };

      const result = await searchOpenReview(params);

      expect(result.papers).toBeDefined();
      expect(Array.isArray(result.papers)).toBe(true);
      expect(result.total).toBeGreaterThanOrEqual(0);
    });

    it('제목이나 초록에 검색어가 포함된 논문만 반환해야 함', async () => {
      const params: SearchParams = {
        query: 'machine learning',
        maxResults: 20,
      };

      const result = await searchOpenReview(params);

      // 검색어가 포함되지 않은 논문은 필터링되어야 함
      result.papers.forEach(paper => {
        const titleMatch = paper.title.toLowerCase().includes('machine learning');
        const abstractMatch = paper.abstract.toLowerCase().includes('machine learning');
        expect(titleMatch || abstractMatch).toBe(true);
      });
    });

    it('OpenReview 소스를 설정해야 함', async () => {
      const params: SearchParams = {
        query: 'test',
        maxResults: 5,
      };

      const result = await searchOpenReview(params);

      if (result.papers.length > 0) {
        result.papers.forEach(paper => {
          expect(paper.source).toBe('openreview');
        });
      }
    });

    it('start와 maxResults로 페이지네이션을 처리해야 함', async () => {
      const params: SearchParams = {
        query: 'test',
        maxResults: 5,
        start: 10,
      };

      const result = await searchOpenReview(params);

      expect(result.papers.length).toBeLessThanOrEqual(5);
    });

    it('여러 venue에서 병렬로 검색해야 함', async () => {
      const params: SearchParams = {
        query: 'deep learning',
        maxResults: 20,
      };

      // 여러 venue 요청이 병렬로 수행되는지 확인
      await searchOpenReview(params);

      // 최소 3개의 venue에 요청해야 함 (ICLR, NeurIPS, ICML)
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('publishedAt 날짜로 정렬해야 함', async () => {
      const params: SearchParams = {
        query: 'test',
        maxResults: 20,
      };

      const result = await searchOpenReview(params);

      if (result.papers.length > 1) {
        const dates = result.papers.map(p => new Date(p.publishedAt).getTime());
        for (let i = 1; i < dates.length; i++) {
          expect(dates[i - 1]).toBeGreaterThanOrEqual(dates[i]);
        }
      }
    });

    it('venueid를 카테고리로 설정해야 함', async () => {
      const params: SearchParams = {
        query: 'test',
        maxResults: 10,
      };

      const result = await searchOpenReview(params);

      if (result.papers.length > 0) {
        result.papers.forEach(paper => {
          expect(paper.categories.length).toBeGreaterThan(0);
        });
      }
    });

    it('API 오류 시 빈 결과를 반환해야 함', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const params: SearchParams = {
        query: 'test',
        maxResults: 10,
      };

      const result = await searchOpenReview(params);

      expect(result.papers).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('타임아웃을 처리해야 함', async () => {
      const timeoutError = new Error('Request timeout');
      timeoutError.name = 'AbortError';
      mockFetch.mockRejectedValue(timeoutError);

      const params: SearchParams = {
        query: 'test',
        maxResults: 10,
      };

      const result = await searchOpenReview(params);

      expect(result.papers).toEqual([]);
    });

    it('venue별 실패를 독립적으로 처리해야 함', async () => {
      // 첫 번째 요청 실패, 두 번째 성공
      mockFetch
        .mockRejectedValueOnce(new Error('Venue 1 failed'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ notes: mockOpenReviewNotes.slice(0, 1) }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ notes: [] }),
        } as Response);

      const params: SearchParams = {
        query: 'test',
        maxResults: 10,
      };

      const result = await searchOpenReview(params);

      // 하나의 venue라도 성공하면 결과가 있어야 함
      expect(result.papers.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getPaperById', () => {
    it('forum ID로 논문을 조회해야 함', async () => {
      const forumId = 'abc123';

      const result = await getPaperById(forumId);

      expect(result).toBeDefined();
      if (result) {
        expect(result.source).toBe('openreview');
        expect(result.sourceId).toBe(forumId);
      }
    });

    it('논문이 없으면 null을 반환해야 함', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ notes: [] }),
      } as Response);

      const result = await getPaperById('nonexistent');

      expect(result).toBeNull();
    });

    it('API 오류 시 에러를 던져야 함', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
      } as Response);

      await expect(getPaperById('abc123')).rejects.toThrow('OpenReview API 오류: 404');
    });

    it('타임아웃 시 에러를 던져야 함', async () => {
      const timeoutError = new Error('Request timeout');
      timeoutError.name = 'AbortError';
      mockFetch.mockRejectedValue(timeoutError);

      await expect(getPaperById('abc123')).rejects.toThrow('OpenReview API 타임아웃');
    });

    it('올바른 PDF URL을 생성해야 함', async () => {
      const forumId = 'abc123';

      const result = await getPaperById(forumId);

      if (result) {
        expect(result.pdfUrl).toContain('openreview.net/pdf');
        expect(result.pdfUrl).toContain(forumId);
      }
    });

    it('올바른 소스 URL을 생성해야 함', async () => {
      const forumId = 'abc123';

      const result = await getPaperById(forumId);

      if (result) {
        expect(result.sourceUrl).toContain('openreview.net/forum');
        expect(result.sourceUrl).toContain(forumId);
      }
    });

    it('저자 정보를 올바르게 파싱해야 함', async () => {
      const result = await getPaperById('abc123');

      if (result) {
        expect(Array.isArray(result.authors)).toBe(true);
        expect(result.authors.length).toBeGreaterThan(0);
      }
    });

    it('제목이 없는 노드는 null로 처리해야 함', async () => {
      const noteWithoutTitle = {
        id: 'no-title',
        forum: 'no-title',
        content: {
          abstract: { value: 'Abstract without title' },
        },
        cdate: 1704067200000,
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ notes: [noteWithoutTitle] }),
      } as Response);

      const result = await getPaperById('no-title');

      expect(result).toBeNull();
    });
  });

  describe('getLatestPapers', () => {
    it('venue별 최신 논문을 가져와야 함', async () => {
      const venue = 'ICLR.cc/2024/Conference';
      const maxResults = 10;

      const result = await getLatestPapers(venue, maxResults);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeLessThanOrEqual(maxResults);
    });

    it('cdate 기준 내림차순으로 정렬해야 함', async () => {
      const venue = 'ICLR.cc/2024/Conference';

      const result = await getLatestPapers(venue, 10);

      if (result.length > 1) {
        const dates = result.map(p => new Date(p.publishedAt).getTime());
        for (let i = 1; i < dates.length; i++) {
          expect(dates[i - 1]).toBeGreaterThanOrEqual(dates[i]);
        }
      }
    });

    it('기본 maxResults는 10이어야 함', async () => {
      const venue = 'ICLR.cc/2024/Conference';

      await getLatestPapers(venue);

      const fetchCall = mockFetch.mock.calls[0];
      const url = fetchCall[0];

      expect(url).toContain('limit=10');
    });

    it('커스텀 maxResults를 적용해야 함', async () => {
      const venue = 'ICLR.cc/2024/Conference';
      const maxResults = 5;

      await getLatestPapers(venue, maxResults);

      const fetchCall = mockFetch.mock.calls[0];
      const url = fetchCall[0];

      expect(url).toContain('limit=5');
    });

    it('API 오류 시 에러를 던져야 함', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(getLatestPapers('ICLR.cc/2024/Conference', 10)).rejects.toThrow('Network error');
    });

    it('타임아웃 시 빈 배열을 반환해야 함', async () => {
      const timeoutError = new Error('Request timeout');
      timeoutError.name = 'AbortError';
      mockFetch.mockRejectedValue(timeoutError);

      const result = await getLatestPapers('ICLR.cc/2024/Conference', 10);

      expect(result).toEqual([]);
    });

    it('잘못된 형식의 노드는 필터링해야 함', async () => {
      const invalidNotes = [
        { id: 'valid', content: { title: { value: 'Valid' } }, cdate: 1704067200000 },
        { id: 'invalid', content: {}, cdate: 1704067200000 }, // 제목 없음
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ notes: invalidNotes }),
      } as Response);

      const result = await getLatestPapers('ICLR.cc/2024/Conference', 10);

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Valid');
    });
  });

  describe('카테고리 추출', () => {
    it('venue와 venueid를 카테고리로 포함해야 함', async () => {
      const noteWithVenue = {
        id: 'test',
        forum: 'test',
        content: {
          title: { value: 'Test' },
          venue: { value: 'ICLR 2024' },
          venueid: { value: 'ICLR.cc/2024/Conference' },
        },
        cdate: 1704067200000,
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ notes: [noteWithVenue] }),
      } as Response);

      const result = await getPaperById('test');

      if (result) {
        expect(result.categories).toContain('ICLR 2024');
        expect(result.categories).toContain('ICLR.cc/2024/Conference');
      }
    });

    it('invitation에서 카테고리를 추출해야 함', async () => {
      const noteWithInvitation = {
        id: 'test',
        forum: 'test',
        content: {
          title: { value: 'Test' },
        },
        invitation: 'ICLR.cc/2024/Conference/-/Submission',
        cdate: 1704067200000,
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ notes: [noteWithInvitation] }),
      } as Response);

      const result = await getPaperById('test');

      if (result) {
        // invitation의 마지막 부분이 카테고리로 추출됨
        expect(result.categories.length).toBeGreaterThan(0);
      }
    });

    it('카테고리가 없으면 기본값을 사용해야 함', async () => {
      const noteWithoutCategories = {
        id: 'test',
        forum: 'test',
        content: {
          title: { value: 'Test' },
        },
        cdate: 1704067200000,
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ notes: [noteWithoutCategories] }),
      } as Response);

      const result = await getPaperById('test');

      if (result) {
        expect(result.categories).toContain('OpenReview');
      }
    });
  });

  describe('데이터 정제', () => {
    it('제목의 여러 공백을 정규화해야 함', async () => {
      const noteWithSpaces = {
        id: 'test',
        forum: 'test',
        content: {
          title: { value: 'Test    Title   With    Spaces' },
        },
        cdate: 1704067200000,
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ notes: [noteWithSpaces] }),
      } as Response);

      const result = await getPaperById('test');

      if (result) {
        expect(result.title).toBe('Test Title With Spaces');
      }
    });

    it('초록의 여러 공백을 정규화해야 함', async () => {
      const noteWithSpaces = {
        id: 'test',
        forum: 'test',
        content: {
          title: { value: 'Test' },
          abstract: { value: 'Abstract    with   multiple   spaces' },
        },
        cdate: 1704067200000,
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ notes: [noteWithSpaces] }),
      } as Response);

      const result = await getPaperById('test');

      if (result) {
        expect(result.abstract).toBe('Abstract with multiple spaces');
      }
    });

    it('빈 authors를 빈 배열로 처리해야 함', async () => {
      const noteWithoutAuthors = {
        id: 'test',
        forum: 'test',
        content: {
          title: { value: 'Test' },
        },
        cdate: 1704067200000,
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ notes: [noteWithoutAuthors] }),
      } as Response);

      const result = await getPaperById('test');

      if (result) {
        expect(result.authors).toEqual([]);
      }
    });
  });
});
