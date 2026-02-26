import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { SearchParams } from '@/types/paper';

// @MX:NOTE: fetch API 모킹은 전역 수행
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

// @MX:NOTE: xml2js 모듈을 __mocks__/xml2js.ts로 모킹
jest.mock('xml2js');

// Import arxiv module AFTER setting up mocks
import { searchArxiv, getPaperById, getLatestPapers } from '../arxiv';
import { parseStringPromise } from 'xml2js';

// 타입 단언
const mockParseStringPromise = parseStringPromise as jest.Mock;

describe('arXiv Library (DDD Mode - Characterization Tests)', () => {
  // Sample parsed XML response matching xml2js output structure
  const mockParsedResponse = {
    feed: {
      entry: [
        {
          id: ['http://arxiv.org/abs/2301.00001v1'],
          title: ['Test Paper Title'],
          summary: ['This is a test abstract for the paper.'],
          author: [{ name: ['Test Author'] }, { name: ['Second Author'] }],
          published: ['2023-01-01T00:00:00Z'],
          updated: ['2023-01-01T00:00:00Z'],
          link: [
            { $: { href: 'https://arxiv.org/pdf/2301.00001v1.pdf', title: 'pdf', type: 'application/pdf' } },
            { $: { href: 'https://arxiv.org/abs/2301.00001v1' } },
          ],
          category: [
            { $: { term: 'cs.AI' } },
            { $: { term: 'cs.LG' } },
          ],
        },
      ],
      'opensearch:totalResults': [{ _: '100' }],
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock for parseStringPromise
    mockParseStringPromise.mockResolvedValue(mockParsedResponse);

    // Setup default mock for fetch
    mockFetch.mockResolvedValue({
      ok: true,
      text: async () => `<?xml version="1.0" encoding="UTF-8"?>
        <feed xmlns="http://www.w3.org/2005/Atom">
          <entry>
            <id>http://arxiv.org/abs/2301.00001v1</id>
            <title>Test Paper Title</title>
            <summary>This is a test abstract for the paper.</summary>
            <author><name>Test Author</name></author>
            <author><name>Second Author</name></author>
            <published>2023-01-01T00:00:00Z</published>
            <updated>2023-01-01T00:00:00Z</updated>
            <link href="https://arxiv.org/pdf/2301.00001v1.pdf" title="pdf" type="application/pdf"/>
            <category term="cs.AI"/>
            <category term="cs.LG"/>
          </entry>
        </feed>`,
    } as any);
  });

  describe('searchArxiv', () => {
    it('should construct correct search URL with query and maxResults', async () => {
      const params: SearchParams = {
        query: 'machine learning',
        maxResults: 10,
      };

      await searchArxiv(params);

      expect(mockFetch).toHaveBeenCalled();
      const fetchCall = mockFetch.mock.calls[0];
      const url = fetchCall[0];

      // Verify the URL contains expected query parameters
      expect(url).toContain('search_query=machine+learning');
      expect(url).toContain('max_results=10');
      expect(url).toContain('sortBy=submittedDate');
      expect(url).toContain('sortOrder=descending');
    });

    it('should include category filter in search query', async () => {
      const params: SearchParams = {
        query: 'machine learning',
        category: 'cs.AI',
        maxResults: 10,
      };

      await searchArxiv(params);

      const fetchCall = mockFetch.mock.calls[0];
      const url = fetchCall[0];

      expect(url).toContain('search_query=cat%3Acs.AI+AND+%28machine+learning%29');
    });

    it('should parse XML response and return papers', async () => {
      const params: SearchParams = {
        query: 'machine learning',
        maxResults: 10,
      };

      const result = await searchArxiv(params);

      expect(mockParseStringPromise).toHaveBeenCalled();
      expect(result.papers).toHaveLength(1);
      expect(result.papers[0]).toMatchObject({
        source: 'arxiv',
        sourceId: '2301.00001',
        title: 'Test Paper Title',
        authors: ['Test Author', 'Second Author'],
        categories: ['cs.AI', 'cs.LG'],
      });
      expect(result.total).toBe(100);
    });

    it('should handle date range filtering', async () => {
      const params: SearchParams = {
        query: 'machine learning',
        dateRange: {
          startDate: '20230101',
          endDate: '20231231',
        },
        maxResults: 10,
      };

      const result = await searchArxiv(params);

      const fetchCall = mockFetch.mock.calls[0];
      const url = fetchCall[0];

      expect(url).toContain('submittedDate%3A%5B202301010000+TO+202312312359%5D');
      expect(result.papers).toBeDefined();
    });

    it('should handle API error gracefully', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
      } as any);

      const params: SearchParams = {
        query: 'machine learning',
        maxResults: 10,
      };

      await expect(searchArxiv(params)).rejects.toThrow('arXiv API 오류: 500');
    });

    it('should return empty papers array when no entries found', async () => {
      mockParseStringPromise.mockResolvedValue({
        feed: {
          'opensearch:totalResults': [{ _: '0' }],
        },
      });

      const params: SearchParams = {
        query: 'nonexistent',
        maxResults: 10,
      };

      const result = await searchArxiv(params);

      expect(result.papers).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('getPaperById', () => {
    it('should construct correct lookup URL', async () => {
      await getPaperById('2301.00001');

      expect(mockFetch).toHaveBeenCalled();
      const fetchCall = mockFetch.mock.calls[0];
      const url = fetchCall[0];

      expect(url).toContain('id_list=2301.00001');
    });

    it('should parse XML response and return paper', async () => {
      const result = await getPaperById('2301.00001');

      expect(mockParseStringPromise).toHaveBeenCalled();
      expect(result).toMatchObject({
        source: 'arxiv',
        sourceId: '2301.00001',
        title: 'Test Paper Title',
        authors: ['Test Author', 'Second Author'],
      });
    });

    it('should return null when paper not found', async () => {
      mockParseStringPromise.mockResolvedValue({
        feed: {},
      });

      const result = await getPaperById('nonexistent');

      expect(result).toBeNull();
    });

    it('should handle API error gracefully', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
      } as any);

      await expect(getPaperById('2301.00001')).rejects.toThrow('arXiv API 오류: 404');
    });
  });

  describe('getLatestPapers', () => {
    it('should construct correct latest papers URL', async () => {
      await getLatestPapers('cs.AI', 5);

      expect(mockFetch).toHaveBeenCalled();
      const fetchCall = mockFetch.mock.calls[0];
      const url = fetchCall[0];

      expect(url).toContain('search_query=cat%3Acs.AI');
      expect(url).toContain('max_results=5');
      expect(url).toContain('sortBy=submittedDate');
      expect(url).toContain('sortOrder=descending');
    });

    it('should use default maxResults when not provided', async () => {
      await getLatestPapers('cs.AI');

      const fetchCall = mockFetch.mock.calls[0];
      const url = fetchCall[0];

      expect(url).toContain('max_results=10');
    });

    it('should parse XML response and return papers array', async () => {
      const result = await getLatestPapers('cs.AI', 5);

      expect(mockParseStringPromise).toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        source: 'arxiv',
        sourceId: '2301.00001',
        title: 'Test Paper Title',
      });
    });

    it('should return empty array when no papers found', async () => {
      mockParseStringPromise.mockResolvedValue({
        feed: {},
      });

      const result = await getLatestPapers('cs.AI', 5);

      expect(result).toEqual([]);
    });

    it('should handle API error gracefully', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
      } as any);

      await expect(getLatestPapers('cs.AI', 5)).rejects.toThrow('arXiv API 오류: 500');
    });
  });
});
