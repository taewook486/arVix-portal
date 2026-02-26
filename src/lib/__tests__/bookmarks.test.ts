import { describe, it, expect, beforeEach } from '@jest/globals';
import { addBookmark, removeBookmark, isBookmarked, getBookmarks } from '../bookmarks';

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

Object.defineProperty(global, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
});

// Mock crypto.randomUUID
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: jest.fn(() => 'mock-uuid-1234'),
  },
  writable: true,
});

describe('Bookmarks Library', () => {
  beforeEach(() => {
    mockLocalStorage.getItem.mockClear();
    mockLocalStorage.setItem.mockClear();
    mockLocalStorage.removeItem.mockClear();
  });

  describe('addBookmark', () => {
    it('should add a bookmark to localStorage', async () => {
      const mockPaper = {
        arxivId: '2301.00001',
        sourceId: '2301.00001',
        source: 'arxiv' as const,
        title: 'Test Paper',
        authors: ['Author 1', 'Author 2'],
        abstract: 'Test abstract',
        categories: ['cs.AI'],
        publishedAt: '2023-01-01',
        pdfUrl: 'https://example.com/paper.pdf',
      };

      await addBookmark(mockPaper);

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'arxiv-portal-bookmarks',
        expect.stringContaining('2301.00001')
      );
    });
  });

  describe('removeBookmark', () => {
    it('should remove a bookmark from localStorage', async () => {
      // Create a mock bookmark that matches the Bookmark interface (snake_case for source_id)
      const existingBookmarks = [
        {
          id: '1',
          arxiv_id: '2301.00001',
          source_id: '2301.00001',
          source: 'arxiv' as const,
          title: 'Test Paper',
          authors: ['Author 1'],
          abstract: 'Test abstract',
          categories: ['cs.AI'],
          published_at: '2023-01-01',
          pdf_url: 'https://example.com/paper.pdf',
          source_url: 'https://arxiv.org/abs/2301.00001',
          ai_summary: null,
          created_at: '2023-01-01',
        },
      ];

      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(existingBookmarks));

      await removeBookmark('arxiv', '2301.00001');

      // Verify setItem was called with updated bookmarks array (empty after removal)
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'arxiv-portal-bookmarks',
        JSON.stringify([])
      );
    });

    it('should return false when bookmark not found', async () => {
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify([]));

      const result = await removeBookmark('arxiv', '2301.00001');

      expect(result).toBe(false);
      expect(mockLocalStorage.setItem).not.toHaveBeenCalled();
    });
  });

  describe('isBookmarked', () => {
    it('should return true if paper is bookmarked', async () => {
      // Create a mock bookmark that matches the Bookmark interface (snake_case for source_id)
      const existingBookmarks = [
        {
          id: '1',
          arxiv_id: '2301.00001',
          source_id: '2301.00001',
          source: 'arxiv' as const,
          title: 'Test Paper',
          authors: ['Author 1'],
          abstract: 'Test abstract',
          categories: ['cs.AI'],
          published_at: '2023-01-01',
          pdf_url: 'https://example.com/paper.pdf',
          source_url: 'https://arxiv.org/abs/2301.00001',
          ai_summary: null,
          created_at: '2023-01-01',
        },
      ];

      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(existingBookmarks));

      const result = await isBookmarked('arxiv', '2301.00001');
      expect(result).toBe(true);
    });

    it('should return false if paper is not bookmarked', async () => {
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify([]));

      const result = await isBookmarked('arxiv', '2301.00001');
      expect(result).toBe(false);
    });
  });

  describe('getBookmarks', () => {
    it('should return all bookmarks from localStorage', async () => {
      const existingBookmarks = [
        {
          id: '1',
          arxiv_id: '2301.00001',
          source_id: '2301.00001',
          source: 'arxiv' as const,
          title: 'Test Paper',
          authors: ['Author 1'],
          abstract: 'Test abstract',
          categories: ['cs.AI'],
          published_at: '2023-01-01',
          pdf_url: 'https://example.com/paper.pdf',
          source_url: 'https://arxiv.org/abs/2301.00001',
          ai_summary: null,
          created_at: '2023-01-01',
        },
      ];

      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(existingBookmarks));

      const result = await getBookmarks();
      expect(result).toHaveLength(1);
      expect(result[0].arxiv_id).toBe('2301.00001');
    });

    it('should return empty array when no bookmarks exist', async () => {
      mockLocalStorage.getItem.mockReturnValue(null);

      const result = await getBookmarks();
      expect(result).toEqual([]);
    });
  });
});
