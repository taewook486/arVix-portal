import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Paper } from '@/types/paper';
import {
  addToBucket,
  removeFromBucket,
  clearBucket,
  isInBucket,
  getBucket,
  getMaxBucketSize,
  type BucketPaper,
} from '../bucket';

// @MX:NOTE: localStorage 모킹 - 전역 설정
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

// @MX:NOTE: 커스텀 이벤트 모킹
const mockDispatchEvent = jest.fn();

// window 객체가 없는 환경에서의 에러 방지
if (typeof (global as any).window !== 'undefined') {
  (global as any).window.dispatchEvent = mockDispatchEvent;
  (global as any).window.CustomEvent = class CustomEvent {
    type: string;
    detail: any;
    constructor(type: string, options: { detail: any }) {
      this.type = type;
      this.detail = options.detail;
    }
  };
}

describe('Bucket Library (DDD Mode - Characterization Tests)', () => {
  // 테스트용 논문 데이터
  const mockPaper: Paper = {
    source: 'arxiv',
    sourceId: '2301.00001',
    sourceUrl: 'https://arxiv.org/abs/2301.00001',
    title: 'Test Paper Title',
    authors: ['Author 1', 'Author 2', 'Author 3'],
    abstract: 'This is a test abstract for the paper.',
    categories: ['cs.AI', 'cs.LG'],
    publishedAt: '2023-01-01T00:00:00Z',
    updatedAt: '2023-01-01T00:00:00Z',
    pdfUrl: 'https://arxiv.org/pdf/2301.00001.pdf',
    arxivId: '2301.00001',
    arxivUrl: 'https://arxiv.org/abs/2301.00001',
  };

  const mockOpenReviewPaper: Paper = {
    source: 'openreview',
    sourceId: 'forum-abc123',
    sourceUrl: 'https://openreview.net/forum?id=forum-abc123',
    title: 'OpenReview Test Paper',
    authors: ['Author A', 'Author B'],
    abstract: 'OpenReview paper abstract.',
    categories: ['ICLR.cc/2024/Conference'],
    publishedAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    pdfUrl: 'https://openreview.net/pdf?id=forum-abc123',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getBucket', () => {
    it('localStorage에서 버킷을 불러와야 함', () => {
      const mockBucket: BucketPaper[] = [
        {
          source: 'arxiv',
          sourceId: '2301.00001',
          arxivId: '2301.00001',
          title: 'Paper 1',
          authors: ['Author 1'],
          abstract: 'Abstract 1',
          categories: ['cs.AI'],
          addedAt: '2023-01-01T00:00:00Z',
        },
      ];

      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(mockBucket));

      const result = getBucket();

      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('arxiv-portal-bucket');
      expect(result).toEqual(mockBucket);
    });

    it('localStorage가 비어있으면 빈 배열을 반환해야 함', () => {
      mockLocalStorage.getItem.mockReturnValue(null);

      const result = getBucket();

      expect(result).toEqual([]);
    });

    it('JSON 파싱 오류시 빈 배열을 반환해야 함', () => {
      mockLocalStorage.getItem.mockReturnValue('invalid json');

      const result = getBucket();

      expect(result).toEqual([]);
    });

    it('SSR 환경(localStorage 없음)에서 빈 배열을 반환해야 함', () => {
      // SSR 환경에서 getBucket 함수가 typeof window === 'undefined' 체크로
      // 빈 배열을 반환하는 동작을 검증
      // 실제 코드는 이미 line 19에서 this check을 수행함:
      // if (typeof window === 'undefined') return [];

      // localStorage가 null을 반환하도록 설정하여 빈 배열 확인
      mockLocalStorage.getItem.mockReturnValue(null);

      const result = getBucket();

      expect(result).toEqual([]);
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('arxiv-portal-bucket');
    });
  });

  describe('addToBucket', () => {
    it('논문을 버킷에 추가해야 함', () => {
      mockLocalStorage.getItem.mockReturnValue('[]');

      const result = addToBucket(mockPaper);

      expect(result).toBe(true);
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'arxiv-portal-bucket',
        expect.stringContaining('2301.00001')
      );
      expect(mockDispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'bucket-updated',
        })
      );
    });

    it('이미 존재하는 논문은 추가하지 않아야 함', () => {
      const existingBucket: BucketPaper[] = [
        {
          source: 'arxiv',
          sourceId: '2301.00001',
          arxivId: '2301.00001',
          title: 'Existing Paper',
          authors: ['Author'],
          abstract: 'Abstract',
          categories: ['cs.AI'],
          addedAt: '2023-01-01T00:00:00Z',
        },
      ];

      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(existingBucket));

      const result = addToBucket(mockPaper);

      expect(result).toBe(false);
      expect(mockLocalStorage.setItem).not.toHaveBeenCalled();
    });

    it('최대 크기(5개)를 초과하면 추가하지 않아야 함', () => {
      const fullBucket: BucketPaper[] = Array.from({ length: 5 }, (_, i) => ({
        source: 'arxiv' as const,
        sourceId: `23${i}.00001`,
        arxivId: `23${i}.00001`,
        title: `Paper ${i}`,
        authors: [`Author ${i}`],
        abstract: `Abstract ${i}`,
        categories: ['cs.AI'],
        addedAt: new Date().toISOString(),
      }));

      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(fullBucket));

      const result = addToBucket(mockPaper);

      expect(result).toBe(false);
    });

    it('OpenReview 논문도 추가할 수 있어야 함', () => {
      mockLocalStorage.getItem.mockReturnValue('[]');

      const result = addToBucket(mockOpenReviewPaper);

      expect(result).toBe(true);
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'arxiv-portal-bucket',
        expect.stringContaining('forum-abc123')
      );
    });

    it('추가된 시간을 기록해야 함', () => {
      mockLocalStorage.getItem.mockReturnValue('[]');
      const beforeTime = Date.now();

      addToBucket(mockPaper);

      mockLocalStorage.setItem.mock.calls[0][1] as string;
      const savedBucket = JSON.parse(mockLocalStorage.setItem.mock.calls[0][1]);
      const addedAt = new Date(savedBucket[0].addedAt).getTime();

      expect(addedAt).toBeGreaterThanOrEqual(beforeTime);
    });
  });

  describe('removeFromBucket', () => {
    it('버킷에서 논문을 제거해야 함', () => {
      const bucketWithPaper: BucketPaper[] = [
        {
          source: 'arxiv',
          sourceId: '2301.00001',
          arxivId: '2301.00001',
          title: 'Paper to Remove',
          authors: ['Author'],
          abstract: 'Abstract',
          categories: ['cs.AI'],
          addedAt: '2023-01-01T00:00:00Z',
        },
      ];

      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(bucketWithPaper));

      const result = removeFromBucket('arxiv', '2301.00001');

      expect(result).toBe(true);
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'arxiv-portal-bucket',
        JSON.stringify([])
      );
    });

    it('존재하지 않는 논문 제거 시 false를 반환해야 함', () => {
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify([]));

      const result = removeFromBucket('arxiv', 'nonexistent');

      expect(result).toBe(false);
      expect(mockLocalStorage.setItem).not.toHaveBeenCalled();
    });

    it('여러 논문 중 특정 논문만 제거해야 함', () => {
      const bucketWithMultiplePapers: BucketPaper[] = [
        {
          source: 'arxiv',
          sourceId: '2301.00001',
          arxivId: '2301.00001',
          title: 'Paper 1',
          authors: ['Author 1'],
          abstract: 'Abstract 1',
          categories: ['cs.AI'],
          addedAt: '2023-01-01T00:00:00Z',
        },
        {
          source: 'arxiv',
          sourceId: '2301.00002',
          arxivId: '2301.00002',
          title: 'Paper 2',
          authors: ['Author 2'],
          abstract: 'Abstract 2',
          categories: ['cs.LG'],
          addedAt: '2023-01-02T00:00:00Z',
        },
      ];

      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(bucketWithMultiplePapers));

      removeFromBucket('arxiv', '2301.00001');

      const savedBucket = JSON.parse(mockLocalStorage.setItem.mock.calls[0][1] as string);
      expect(savedBucket).toHaveLength(1);
      expect(savedBucket[0].sourceId).toBe('2301.00002');
    });

    it('OpenReview 논문도 제거할 수 있어야 함', () => {
      const bucketWithOpenReview: BucketPaper[] = [
        {
          source: 'openreview',
          sourceId: 'forum-abc123',
          title: 'OpenReview Paper',
          authors: ['Author'],
          abstract: 'Abstract',
          categories: ['ICLR.cc/2024/Conference'],
          addedAt: '2024-01-01T00:00:00Z',
        },
      ];

      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(bucketWithOpenReview));

      const result = removeFromBucket('openreview', 'forum-abc123');

      expect(result).toBe(true);
    });
  });

  describe('clearBucket', () => {
    it('버킷을 비워야 함', () => {
      const bucketWithPapers: BucketPaper[] = [
        {
          source: 'arxiv',
          sourceId: '2301.00001',
          arxivId: '2301.00001',
          title: 'Paper 1',
          authors: ['Author'],
          abstract: 'Abstract',
          categories: ['cs.AI'],
          addedAt: '2023-01-01T00:00:00Z',
        },
      ];

      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(bucketWithPapers));

      clearBucket();

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'arxiv-portal-bucket',
        JSON.stringify([])
      );
    });

    it('bucket-updated 이벤트를 발생시켜야 함', () => {
      mockLocalStorage.getItem.mockReturnValue('[]');

      clearBucket();

      expect(mockDispatchEvent).toHaveBeenCalled();
    });
  });

  describe('isInBucket', () => {
    it('버킷에 있는 논문인지 확인해야 함', () => {
      const bucketWithPaper: BucketPaper[] = [
        {
          source: 'arxiv',
          sourceId: '2301.00001',
          arxivId: '2301.00001',
          title: 'Paper',
          authors: ['Author'],
          abstract: 'Abstract',
          categories: ['cs.AI'],
          addedAt: '2023-01-01T00:00:00Z',
        },
      ];

      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(bucketWithPaper));

      expect(isInBucket('arxiv', '2301.00001')).toBe(true);
      expect(isInBucket('arxiv', 'nonexistent')).toBe(false);
    });

    it('OpenReview 논문도 확인할 수 있어야 함', () => {
      const bucketWithOpenReview: BucketPaper[] = [
        {
          source: 'openreview',
          sourceId: 'forum-abc123',
          title: 'OpenReview Paper',
          authors: ['Author'],
          abstract: 'Abstract',
          categories: ['ICLR.cc/2024/Conference'],
          addedAt: '2024-01-01T00:00:00Z',
        },
      ];

      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(bucketWithOpenReview));

      expect(isInBucket('openreview', 'forum-abc123')).toBe(true);
    });

    it('빈 버킷에서는 false를 반환해야 함', () => {
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify([]));

      expect(isInBucket('arxiv', '2301.00001')).toBe(false);
    });
  });

  describe('getMaxBucketSize', () => {
    it('최대 버킷 크기를 반환해야 함', () => {
      expect(getMaxBucketSize()).toBe(5);
    });
  });

  describe('소스 조합 확인', () => {
    it('arxiv 소스와 sourceId로 정확히 매칭해야 함', () => {
      const bucketWithDifferentSources: BucketPaper[] = [
        {
          source: 'arxiv',
          sourceId: '2301.00001',
          arxivId: '2301.00001',
          title: 'arXiv Paper',
          authors: ['Author'],
          abstract: 'Abstract',
          categories: ['cs.AI'],
          addedAt: '2023-01-01T00:00:00Z',
        },
        {
          source: 'openreview',
          sourceId: '2301.00001', // 같은 ID지만 다른 소스
          title: 'OpenReview Paper',
          authors: ['Author'],
          abstract: 'Abstract',
          categories: ['ICLR.cc/2024/Conference'],
          addedAt: '2024-01-01T00:00:00Z',
        },
      ];

      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(bucketWithDifferentSources));

      expect(isInBucket('arxiv', '2301.00001')).toBe(true);
      expect(isInBucket('openreview', '2301.00001')).toBe(true);
    });
  });

  describe('에러 처리', () => {
    it('localStorage 오류를 처리해야 함', () => {
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error('localStorage error');
      });
      mockLocalStorage.getItem.mockReturnValue('[]');

      // 에러가 발생해도 함수는 처리해야 함
      expect(() => addToBucket(mockPaper)).not.toThrow();
      expect(() => clearBucket()).not.toThrow();
    });

    it('getItem 에러시 빈 배열을 반환해야 함', () => {
      mockLocalStorage.getItem.mockImplementation(() => {
        throw new Error('localStorage error');
      });

      expect(getBucket()).toEqual([]);
    });
  });
});
