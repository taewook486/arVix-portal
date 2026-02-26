import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { Paper } from '@/types/paper';

// Create mock functions at module level
const mockQuery = jest.fn();
const mockRelease = jest.fn();
const mockConnect = jest.fn(() => ({
  query: mockQuery,
  release: mockRelease,
}));

const mockPool = {
  connect: mockConnect,
};

// Set up default behaviors
mockConnect.mockResolvedValue({
  query: mockQuery,
  release: mockRelease,
});
mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });

// Mock pg module
jest.mock('pg', () => ({
  Pool: jest.fn(() => mockPool),
}));

describe('Database Library (DDD Mode - Characterization Tests)', () => {
  // Import db module after mock is set up
  const dbModule = require('../db');

  const {
    initDatabase,
    addBookmark,
    removeBookmark,
    isBookmarked,
    getBookmarks,
    saveTranslation,
    saveAnalysis,
    saveInfographicUrl,
    initPaperCacheTable,
    getPaperCache,
  } = dbModule;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mock behaviors to defaults
    mockConnect.mockResolvedValue({
      query: mockQuery,
      release: mockRelease,
    });
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('initDatabase', () => {
    it('should create bookmarks table if not exists', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await initDatabase();

      expect(mockConnect).toHaveBeenCalled();
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS bookmarks')
      );
      expect(mockRelease).toHaveBeenCalled();
    });

    it('should add source and source_id columns if not exist', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await initDatabase();

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('ADD COLUMN source TEXT DEFAULT')
      );
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('ADD COLUMN source_id TEXT')
      );
    });

    it('should create unique index on source and source_id', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await initDatabase();

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('CREATE UNIQUE INDEX idx_bookmarks_source_id')
      );
    });

    it('should handle connection errors gracefully', async () => {
      mockConnect.mockRejectedValue(new Error('Connection failed'));

      await expect(initDatabase()).rejects.toThrow('Connection failed');
    });
  });

  describe('addBookmark', () => {
    const mockPaper: Paper = {
      source: 'arxiv',
      sourceId: '2301.00001',
      sourceUrl: 'https://arxiv.org/abs/2301.00001',
      title: 'Test Paper',
      authors: ['Author 1', 'Author 2'],
      abstract: 'Test abstract',
      categories: ['cs.AI'],
      publishedAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z',
      pdfUrl: 'https://arxiv.org/pdf/2301.00001.pdf',
      arxivId: '2301.00001',
      arxivUrl: 'https://arxiv.org/abs/2301.00001',
    };

    it('should insert bookmark and return result', async () => {
      const mockBookmark = {
        id: 'mock-uuid-123',
        source: 'arxiv',
        source_id: '2301.00001',
        title: 'Test Paper',
        authors: ['Author 1', 'Author 2'],
        abstract: 'Test abstract',
        categories: ['cs.AI'],
        published_at: '2023-01-01T00:00:00Z',
        pdf_url: 'https://arxiv.org/pdf/2301.00001.pdf',
        ai_summary: null,
        created_at: '2023-01-01T00:00:00Z',
      };
      mockQuery.mockResolvedValue({ rows: [mockBookmark], rowCount: 1 });

      const result = await addBookmark(mockPaper);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO bookmarks'),
        expect.arrayContaining([
          'arxiv',
          '2301.00001',
          '2301.00001',
          'Test Paper',
        ])
      );
      expect(result).toEqual(mockBookmark);
    });

    it('should return null on conflict (duplicate)', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });

      const result = await addBookmark(mockPaper);

      expect(result).toBeNull();
    });

    it('should return null on database error', async () => {
      mockQuery.mockRejectedValue(new Error('Database error'));

      const result = await addBookmark(mockPaper);

      expect(result).toBeNull();
    });

    it('should handle aiSummary parameter', async () => {
      const mockBookmark = {
        id: 'mock-uuid-123',
        source: 'arxiv',
        source_id: '2301.00001',
        title: 'Test Paper',
        ai_summary: 'AI generated summary',
      };
      mockQuery.mockResolvedValue({ rows: [mockBookmark], rowCount: 1 });

      const result = await addBookmark(mockPaper, 'AI generated summary');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['AI generated summary'])
      );
      expect(result?.ai_summary).toBe('AI generated summary');
    });
  });

  describe('removeBookmark', () => {
    it('should remove bookmark by source and sourceId', async () => {
      mockQuery.mockResolvedValue({ rowCount: 1 });

      const result = await removeBookmark('arxiv', '2301.00001');

      expect(mockQuery).toHaveBeenCalledWith(
        'DELETE FROM bookmarks WHERE source = $1 AND source_id = $2',
        ['arxiv', '2301.00001']
      );
      expect(result).toBe(true);
    });

    it('should remove bookmark by arxivId (backward compatibility)', async () => {
      mockQuery.mockResolvedValue({ rowCount: 1 });

      const result = await removeBookmark('2301.00001');

      expect(mockQuery).toHaveBeenCalledWith(
        'DELETE FROM bookmarks WHERE arxiv_id = $1 OR (source = $2 AND source_id = $1)',
        ['2301.00001', 'arxiv']
      );
      expect(result).toBe(true);
    });

    it('should return false when bookmark not found', async () => {
      mockQuery.mockResolvedValue({ rowCount: 0 });

      const result = await removeBookmark('arxiv', 'nonexistent');

      expect(result).toBe(false);
    });

    it('should return false on database error', async () => {
      mockQuery.mockRejectedValue(new Error('Database error'));

      const result = await removeBookmark('arxiv', '2301.00001');

      expect(result).toBe(false);
    });
  });

  describe('isBookmarked', () => {
    it('should return true when bookmark exists', async () => {
      mockQuery.mockResolvedValue({ rows: [{ id: 'mock-id' }], rowCount: 1 });

      const result = await isBookmarked('arxiv', '2301.00001');

      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT id FROM bookmarks WHERE source = $1 AND source_id = $2',
        ['arxiv', '2301.00001']
      );
      expect(result).toBe(true);
    });

    it('should return false when bookmark does not exist', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });

      const result = await isBookmarked('arxiv', 'nonexistent');

      expect(result).toBe(false);
    });

    it('should check by arxivId (backward compatibility)', async () => {
      mockQuery.mockResolvedValue({ rows: [{ id: 'mock-id' }], rowCount: 1 });

      const result = await isBookmarked('2301.00001');

      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT id FROM bookmarks WHERE arxiv_id = $1 OR (source = $2 AND source_id = $1)',
        ['2301.00001', 'arxiv']
      );
      expect(result).toBe(true);
    });

    it('should return false on database error', async () => {
      mockQuery.mockRejectedValue(new Error('Database error'));

      const result = await isBookmarked('arxiv', '2301.00001');

      expect(result).toBe(false);
    });
  });

  describe('getBookmarks', () => {
    it('should return all bookmarks ordered by created_at DESC', async () => {
      const mockBookmarks = [
        { id: '2', title: 'Newer Paper', created_at: '2023-01-02' },
        { id: '1', title: 'Older Paper', created_at: '2023-01-01' },
      ];
      mockQuery.mockResolvedValue({ rows: mockBookmarks });

      const result = await getBookmarks();

      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM bookmarks ORDER BY created_at DESC'
      );
      expect(result).toEqual(mockBookmarks);
    });

    it('should return empty array on database error', async () => {
      mockQuery.mockRejectedValue(new Error('Database error'));

      const result = await getBookmarks();

      expect(result).toEqual([]);
    });
  });

  describe('initPaperCacheTable', () => {
    it('should create paper_cache table if not exists', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await initPaperCacheTable();

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS paper_cache')
      );
    });

    it('should add source and source_id columns to paper_cache if not exist', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await initPaperCacheTable();

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('ADD COLUMN source TEXT DEFAULT')
      );
    });

    it('should create unique constraint on source and source_id', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await initPaperCacheTable();

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('ADD CONSTRAINT unique_paper_cache_source_id')
      );
    });
  });

  describe('saveTranslation', () => {
    it('should save translation by source and sourceId', async () => {
      mockQuery.mockResolvedValue({ rowCount: 1 });

      const result = await saveTranslation('arxiv', '2301.00001', '번역된 요약');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO paper_cache'),
        expect.arrayContaining(['arxiv', '2301.00001', '번역된 요약'])
      );
      expect(result).toBe(true);
    });

    it('should save translation by arxivId (backward compatibility)', async () => {
      mockQuery.mockResolvedValue({ rowCount: 1 });

      const result = await saveTranslation('2301.00001', '번역된 요약');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO paper_cache'),
        expect.arrayContaining(['arxiv', '2301.00001', '번역된 요약'])
      );
      expect(result).toBe(true);
    });

    it('should return false on database error', async () => {
      mockQuery.mockRejectedValue(new Error('Database error'));

      const result = await saveTranslation('arxiv', '2301.00001', '번역된 요약');

      expect(result).toBe(false);
    });
  });

  describe('saveAnalysis', () => {
    const mockAnalysis = {
      summary: '요약',
      keyPoints: ['키 포인트 1', '키 포인트 2'],
      methodology: '방법론',
      contributions: ['기여 1'],
      limitations: ['한계 1'],
    };

    it('should save analysis by source and sourceId', async () => {
      mockQuery.mockResolvedValue({ rowCount: 1 });

      const result = await saveAnalysis('arxiv', '2301.00001', mockAnalysis);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO paper_cache'),
        expect.arrayContaining([
          'arxiv',
          '2301.00001',
          JSON.stringify(mockAnalysis),
        ])
      );
      expect(result).toBe(true);
    });

    it('should save analysis by arxivId (backward compatibility)', async () => {
      mockQuery.mockResolvedValue({ rowCount: 1 });

      const result = await saveAnalysis('2301.00001', mockAnalysis);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO paper_cache'),
        expect.arrayContaining([
          'arxiv',
          '2301.00001',
          JSON.stringify(mockAnalysis),
        ])
      );
      expect(result).toBe(true);
    });

    it('should return false on database error', async () => {
      mockQuery.mockRejectedValue(new Error('Database error'));

      const result = await saveAnalysis('arxiv', '2301.00001', mockAnalysis);

      expect(result).toBe(false);
    });
  });

  describe('saveInfographicUrl', () => {
    it('should save infographic URL by source and sourceId', async () => {
      mockQuery.mockResolvedValue({ rowCount: 1 });

      const result = await saveInfographicUrl('arxiv', '2301.00001', 'https://example.com/infographic.png');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO paper_cache'),
        expect.arrayContaining(['arxiv', '2301.00001', 'https://example.com/infographic.png'])
      );
      expect(result).toBe(true);
    });

    it('should save infographic URL by arxivId (backward compatibility)', async () => {
      mockQuery.mockResolvedValue({ rowCount: 1 });

      const result = await saveInfographicUrl('2301.00001', 'https://example.com/infographic.png');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO paper_cache'),
        expect.arrayContaining(['arxiv', '2301.00001', 'https://example.com/infographic.png'])
      );
      expect(result).toBe(true);
    });

    it('should return false on database error', async () => {
      mockQuery.mockRejectedValue(new Error('Database error'));

      const result = await saveInfographicUrl('arxiv', '2301.00001', 'https://example.com/infographic.png');

      expect(result).toBe(false);
    });
  });

  describe('getPaperCache', () => {
    const mockCache = {
      id: 'cache-id',
      source: 'arxiv',
      source_id: '2301.00001',
      translation: '번역된 텍스트',
      analysis: null,
      infographic_url: null,
      created_at: '2023-01-01',
    };

    it('should get paper cache by source and sourceId', async () => {
      mockQuery.mockResolvedValue({ rows: [mockCache] });

      const result = await getPaperCache('arxiv', '2301.00001');

      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM paper_cache WHERE source = $1 AND source_id = $2',
        ['arxiv', '2301.00001']
      );
      expect(result).toEqual(mockCache);
    });

    it('should get paper cache by arxivId (backward compatibility)', async () => {
      mockQuery.mockResolvedValue({ rows: [mockCache] });

      const result = await getPaperCache('2301.00001');

      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM paper_cache WHERE arxiv_id = $1 OR source_id = $1',
        ['2301.00001']
      );
      expect(result).toEqual(mockCache);
    });

    it('should return null when cache not found', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await getPaperCache('arxiv', 'nonexistent');

      expect(result).toBeNull();
    });

    it('should return null on database error', async () => {
      mockQuery.mockRejectedValue(new Error('Database error'));

      const result = await getPaperCache('arxiv', '2301.00001');

      expect(result).toBeNull();
    });
  });
});
