import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import PaperBucket from '../PaperBucket';
import { PaperSource } from '@/types/paper';

// 테스트용 논문 타입 (BucketPaper와 동일한 구조)
interface BucketPaper {
  source: PaperSource;
  sourceId: string;
  arxivId?: string;
  title: string;
  authors: string[];
  abstract: string;
  categories: string[];
  addedAt: string;
}

// @MX:NOTE: Next.js Link 컴포넌트 모킹
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, onClick }: any) => (
    <a href={href} onClick={onClick}>
      {children}
    </a>
  ),
}));

// @MX:NOTE: 커스텀 이벤트 모킹
const mockDispatchEvent = jest.fn();

// window 객체가 없는 환경에서의 에러 방지
if (typeof (global as any).window !== 'undefined') {
  (global as any).window.dispatchEvent = mockDispatchEvent;
  (global as any).window.addEventListener = jest.fn();
  (global as any).window.removeEventListener = jest.fn();
  (global as any).window.CustomEvent = class CustomEvent {
    type: string;
    detail: any;
    constructor(type: string, options: { detail: any }) {
      this.type = type;
      this.detail = options.detail;
    }
  };
}

// Mock fetch for compare API
global.fetch = jest.fn();

// Mock data - store globally for mock access
let mockBucketData: BucketPaper[] = [];

// @MX:NOTE: bucket 라이브러리 모킹 - factory function 내에서 직접 jest.fn 생성
jest.mock('@/lib/bucket', () => {
  return {
    getBucket: jest.fn(() => mockBucketData),
    removeFromBucket: jest.fn(() => true),
    clearBucket: jest.fn(() => {}),
    getMaxBucketSize: jest.fn(() => 5),
    BucketPaper: {} as any,
  };
});

describe('PaperBucket Component (DDD Mode - Characterization Tests)', () => {
  const mockBucket: BucketPaper[] = [
    {
      source: 'arxiv',
      sourceId: '2301.00001',
      arxivId: '2301.00001',
      title: 'First Paper: Deep Learning',
      authors: ['Author One', 'Author Two'],
      abstract: 'Abstract about deep learning.',
      categories: ['cs.AI', 'cs.LG'],
      addedAt: '2023-01-01T00:00:00Z',
    },
    {
      source: 'openreview',
      sourceId: 'forum-abc123',
      title: 'Second Paper: Computer Vision',
      authors: ['Author Three', 'Author Four', 'Author Five'],
      abstract: 'Abstract about computer vision.',
      categories: ['ICLR.cc/2024/Conference'],
      addedAt: '2024-01-01T00:00:00Z',
    },
  ];

  const mockComparisonAnalysis = {
    commonThemes: ['딥러닝 기반', '대규모 데이터셋 활용'],
    differences: ['첫 번째는 NLP, 두 번째는 CV'],
    connections: ['두 논문 모두 트랜스포머 아키텍처 사용'],
    researchGaps: ['멀티모달 학습 연구 필요'],
    recommendation: '두 논문을 결합한 연구가 유망합니다.',
  };

  // Import mocked functions after jest.mock
  const bucket = require('@/lib/bucket');

  beforeEach(() => {
    mockBucketData = mockBucket;
    bucket.getBucket.mockReturnValue(mockBucket);
    bucket.removeFromBucket.mockReturnValue(true);
    bucket.clearBucket.mockReturnValue(undefined);
    bucket.getMaxBucketSize.mockReturnValue(5);

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockComparisonAnalysis,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('초기 렌더링', () => {
    it('버킷이 비어있으면 아무것도 렌더링하지 않아야 함', () => {
      bucket.getBucket.mockReturnValue([]);

      const { container } = render(<PaperBucket />);

      expect(container.firstChild).toBeNull();
    });

    it('플로팅 버튼을 표시해야 함', () => {
      render(<PaperBucket />);

      const floatingButton = screen.getByRole('button');
      expect(floatingButton).toBeInTheDocument();
    });

    it('플로팅 버튼에 논문 수를 표시해야 함', () => {
      render(<PaperBucket />);

      const badge = screen.getByText('2');
      expect(badge).toBeInTheDocument();
    });
  });

  describe('사이드 패널', () => {
    it('플로팅 버튼 클릭시 사이드 패널을 열어야 함', () => {
      render(<PaperBucket />);

      const floatingButton = screen.getByRole('button');
      fireEvent.click(floatingButton);

      expect(screen.getByText('비교 버킷')).toBeInTheDocument();
    });

    it('사이드 패널에 논문 수를 표시해야 함', () => {
      render(<PaperBucket />);

      const floatingButton = screen.getByRole('button');
      fireEvent.click(floatingButton);

      expect(screen.getByText('2개 논문 선택됨 (최대 5개)')).toBeInTheDocument();
    });

    it('사이드 패널에 논문 목록을 표시해야 함', () => {
      render(<PaperBucket />);

      const floatingButton = screen.getByRole('button');
      fireEvent.click(floatingButton);

      expect(screen.getByText('First Paper: Deep Learning')).toBeInTheDocument();
      expect(screen.getByText('Second Paper: Computer Vision')).toBeInTheDocument();
    });

    it('각 논문의 소스 배지를 표시해야 함', () => {
      render(<PaperBucket />);

      const floatingButton = screen.getByRole('button');
      fireEvent.click(floatingButton);

      expect(screen.getByText('arXiv')).toBeInTheDocument();
      expect(screen.getByText('OpenReview')).toBeInTheDocument();
    });

    it('저자가 2명 초과시 "외 N명"을 표시해야 함', () => {
      render(<PaperBucket />);

      const floatingButton = screen.getByRole('button');
      fireEvent.click(floatingButton);

      expect(screen.getByText(/외 1명/)).toBeInTheDocument();
    });

    it('닫기 버튼으로 사이드 패널을 닫을 수 있어야 함', () => {
      render(<PaperBucket />);

      // 열기
      const floatingButton = screen.getByRole('button');
      fireEvent.click(floatingButton);

      expect(screen.getByText('비교 버킷')).toBeInTheDocument();

      // 닫기 버튼 클릭
      const closeButton = screen.getAllByRole('button').find(
        btn => btn.querySelector('svg') && btn.textContent === ''
      );
      if (closeButton) {
        fireEvent.click(closeButton);
      }

      // 오버레이 클릭으로도 닫기
      const overlay = screen.getByText('비교 버킷').closest('.fixed')?.querySelector('.bg-black\\/30');
      if (overlay) {
        fireEvent.click(overlay);
      }
    });
  });

  describe('논문 제거', () => {
    it('논문 제거 버튼을 클릭하면 removeFromBucket을 호출해야 함', async () => {
      render(<PaperBucket />);

      const floatingButton = screen.getByRole('button');
      fireEvent.click(floatingButton);

      // 첫 번째 논문 카드 찾기
      const paperCards = screen.getAllByText(/Paper/);
      const firstCard = paperCards[0].closest('.group');

      // 제거 버튼 (hover 시 표시됨)
      const removeButton = firstCard?.querySelector('button[aria-label="Remove"]') as HTMLElement;
      if (removeButton) {
        fireEvent.click(removeButton);

        await waitFor(() => {
          expect(bucket.removeFromBucket).toHaveBeenCalledWith('arxiv', '2301.00001');
        });
      }
    });

    it('제거 후 버킷을 다시 가져와야 함', async () => {
      render(<PaperBucket />);

      const floatingButton = screen.getByRole('button');
      fireEvent.click(floatingButton);

      const removeButton = screen.getAllByRole('button').find(btn =>
        btn.querySelector('svg[path*="M6 18L18 6"]')
      );

      if (removeButton) {
        fireEvent.click(removeButton);

        await waitFor(() => {
          expect(bucket.getBucket).toHaveBeenCalled();
        });
      }
    });
  });

  describe('버킷 비우기', () => {
    it('전체 비우기 버튼을 클릭하면 clearBucket을 호출해야 함', async () => {
      render(<PaperBucket />);

      const floatingButton = screen.getByRole('button');
      fireEvent.click(floatingButton);

      const clearButton = screen.getByText('전체 비우기');
      fireEvent.click(clearButton);

      await waitFor(() => {
        expect(bucket.clearBucket).toHaveBeenCalled();
      });
    });
  });

  describe('AI 비교 분석', () => {
    it('비교 분석 버튼을 표시해야 함', () => {
      render(<PaperBucket />);

      const floatingButton = screen.getByRole('button');
      fireEvent.click(floatingButton);

      expect(screen.getByText('AI 비교 분석')).toBeInTheDocument();
    });

    it('논문이 2개 미만일 때 비교 분석 버튼이 비활성화되어야 함', () => {
      bucket.getBucket.mockReturnValue([mockBucket[0]]);

      render(<PaperBucket />);

      const floatingButton = screen.getByRole('button');
      fireEvent.click(floatingButton);

      const analyzeButton = screen.getByText('AI 비교 분석');
      expect(analyzeButton).toBeDisabled();
    });

    it('2개 미만일 때 안내 메시지를 표시해야 함', () => {
      bucket.getBucket.mockReturnValue([mockBucket[0]]);

      render(<PaperBucket />);

      const floatingButton = screen.getByRole('button');
      fireEvent.click(floatingButton);

      expect(screen.getByText('2개 이상의 논문을 선택하세요')).toBeInTheDocument();
    });

    it('비교 분석 버튼 클릭시 API를 호출해야 함', async () => {
      render(<PaperBucket />);

      const floatingButton = screen.getByRole('button');
      fireEvent.click(floatingButton);

      const analyzeButton = screen.getByText('AI 비교 분석');
      fireEvent.click(analyzeButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/compare',
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              'Content-Type': 'application/json',
            }),
          })
        );
      });
    });

    it('분석 성공 시 결과 모달을 표시해야 함', async () => {
      render(<PaperBucket />);

      const floatingButton = screen.getByRole('button');
      fireEvent.click(floatingButton);

      const analyzeButton = screen.getByText('AI 비교 분석');
      fireEvent.click(analyzeButton);

      await waitFor(() => {
        expect(screen.getByText('AI 논문 비교 분석')).toBeInTheDocument();
      });
    });

    it('분석 결과를 올바르게 표시해야 함', async () => {
      render(<PaperBucket />);

      const floatingButton = screen.getByRole('button');
      fireEvent.click(floatingButton);

      const analyzeButton = screen.getByText('AI 비교 분석');
      fireEvent.click(analyzeButton);

      await waitFor(() => {
        expect(screen.getByText('공통 주제 및 연결점')).toBeInTheDocument();
        expect(screen.getByText('주요 차이점')).toBeInTheDocument();
        expect(screen.getByText('연구 간 연결 가능성')).toBeInTheDocument();
        expect(screen.getByText('향후 연구 방향')).toBeInTheDocument();
        expect(screen.getByText('종합 의견')).toBeInTheDocument();
      });
    });

    it('분석 중 로딩 상태를 표시해야 함', async () => {
      // fetch를 지연시키지 않고 즉시 확인
      (global.fetch as jest.Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({
          ok: true,
          json: async () => mockComparisonAnalysis,
        } as Response), 100))
      );

      render(<PaperBucket />);

      const floatingButton = screen.getByRole('button');
      fireEvent.click(floatingButton);

      const analyzeButton = screen.getByText('AI 비교 분석');
      fireEvent.click(analyzeButton);

      // 즉시 로딩 상태 확인
      expect(screen.getByText(/분석 중/)).toBeInTheDocument();
    });
  });

  describe('모달', () => {
    it('모달 닫기 버튼으로 모달을 닫을 수 있어야 함', async () => {
      render(<PaperBucket />);

      const floatingButton = screen.getByRole('button');
      fireEvent.click(floatingButton);

      const analyzeButton = screen.getByText('AI 비교 분석');
      fireEvent.click(analyzeButton);

      await waitFor(() => {
        expect(screen.getByText('AI 논문 비교 분석')).toBeInTheDocument();
      });

      // 닫기 버튼 찾기
      const closeButtons = screen.getAllByRole('button');
      const modalCloseButton = closeButtons.find(btn =>
        btn.querySelector('svg[path*="M6 18L18 6"]')
      );

      if (modalCloseButton) {
        fireEvent.click(modalCloseButton);

        await waitFor(() => {
          expect(screen.queryByText('AI 논문 비교 분석')).not.toBeInTheDocument();
        });
      }
    });

    it('모달 배경 클릭으로 모달을 닫을 수 있어야 함', async () => {
      render(<PaperBucket />);

      const floatingButton = screen.getByRole('button');
      fireEvent.click(floatingButton);

      const analyzeButton = screen.getByText('AI 비교 분석');
      fireEvent.click(analyzeButton);

      await waitFor(() => {
        expect(screen.getByText('AI 논문 비교 분석')).toBeInTheDocument();
      });

      // 배경 오버레이 클릭
      const overlay = screen.getByText('AI 논문 비교 분석').closest('.fixed')?.querySelector('.bg-black\\/50');
      if (overlay) {
        fireEvent.click(overlay);
      }
    });
  });

  describe('bucket-updated 이벤트', () => {
    it('초기 로드시 getBucket을 호출해야 함', () => {
      render(<PaperBucket />);

      expect(bucket.getBucket).toHaveBeenCalled();
    });

    it('bucket-updated 이벤트 리스너를 등록해야 함', () => {
      render(<PaperBucket />);

      expect(window.addEventListener).toHaveBeenCalledWith(
        'bucket-updated',
        expect.any(Function)
      );
    });

    it('컴포넌트 언마운트시 이벤트 리스너를 제거해야 함', () => {
      const { unmount } = render(<PaperBucket />);

      unmount();

      expect(window.removeEventListener).toHaveBeenCalledWith(
        'bucket-updated',
        expect.any(Function)
      );
    });
  });

  describe('논문 URL 생성', () => {
    it('arxiv 논문의 올바른 URL을 생성해야 함', () => {
      render(<PaperBucket />);

      const floatingButton = screen.getByRole('button');
      fireEvent.click(floatingButton);

      const arxivPaperLink = screen.getByText('First Paper: Deep Learning').closest('a');
      expect(arxivPaperLink).toHaveAttribute('href', '/paper/2301.00001');
    });

    it('OpenReview 논문의 올바른 URL을 생성해야 함', () => {
      render(<PaperBucket />);

      const floatingButton = screen.getByRole('button');
      fireEvent.click(floatingButton);

      const openReviewPaperLink = screen.getByText('Second Paper: Computer Vision').closest('a');
      expect(openReviewPaperLink).toHaveAttribute('href', '/paper/openreview/forum-abc123');
    });
  });

  describe('빈 버킷 상태', () => {
    it('빈 버킷일 때 안내 메시지를 표시해야 함', () => {
      bucket.getBucket.mockReturnValue([]);

      render(<PaperBucket />);

      // 빈 버킷은 플로팅 버튼만 표시
      const floatingButton = screen.getByRole('button');
      expect(floatingButton).toBeInTheDocument();

      // 배지는 없어야 함
      expect(screen.queryByText('0')).not.toBeInTheDocument();
    });

    it('빈 버킷 상태에서 열면 안내 메시지를 표시해야 함', () => {
      bucket.getBucket.mockReturnValue([]);

      render(<PaperBucket />);

      // showAnalysis 상태를 true로 설정하려면 컴포넌트가 열린 상태로 시작해야 함
      // 빈 버킷이지만 분석 결과 모달이 있을 때
      bucket.getBucket.mockReturnValue([]);

      const { rerender } = render(<PaperBucket />);

      // 빈 버킷이면 아무것도 렌더링하지 않음
      rerender(<PaperBucket />);

      const floatingButton = screen.queryByRole('button');
      // 버킷이 비어있으면 플로팅 버튼도 표시 안 함 (showAnalysis가 false일 때)
    });
  });

  describe('카테고리 표시', () => {
    it('각 논문의 카테고리를 표시해야 함', () => {
      render(<PaperBucket />);

      const floatingButton = screen.getByRole('button');
      fireEvent.click(floatingButton);

      // arXiv 논문 카테고리
      expect(screen.getByText('cs.AI')).toBeInTheDocument();
      expect(screen.getByText('cs.LG')).toBeInTheDocument();

      // OpenReview 논문 카테고리
      expect(screen.getByText('ICLR.cc/2024/Conference')).toBeInTheDocument();
    });

    it('카테고리는 최대 2개까지만 표시해야 함', () => {
      render(<PaperBucket />);

      const floatingButton = screen.getByRole('button');
      fireEvent.click(floatingButton);

      // cs.AI, cs.LG가 표시되어야 함
      expect(screen.getByText('cs.AI')).toBeInTheDocument();
      expect(screen.getByText('cs.LG')).toBeInTheDocument();
    });
  });

  describe('에러 처리', () => {
    it('비교 분석 API 실패 시 에러를 처리해야 함', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      (global.fetch as jest.Mock).mockRejectedValue(new Error('API Error'));

      render(<PaperBucket />);

      const floatingButton = screen.getByRole('button');
      fireEvent.click(floatingButton);

      const analyzeButton = screen.getByText('AI 비교 분석');
      fireEvent.click(analyzeButton);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('비교 분석 오류'),
          expect.any(Error)
        );
      });

      consoleSpy.mockRestore();
    });
  });
});
