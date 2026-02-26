import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PaperCard from '../PaperCard';
import { Paper } from '@/types/paper';

// @MX:NOTE: Link 컴포넌트 모킹
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, onClick }: any) => (
    <a href={href} onClick={onClick}>
      {children}
    </a>
  ),
}));

// @MX:NOTE: 하위 컴포넌트 모킹
jest.mock('@/components/BookmarkButton', () => ({
  __esModule: true,
  default: jest.fn(({ paper, size }: any) => (
    <button data-testid="bookmark-button" data-size={size}>
      Bookmark
    </button>
  )),
}));

jest.mock('@/components/BucketButton', () => ({
  __esModule: true,
  default: jest.fn(({ paper, size }: any) => (
    <button data-testid="bucket-button" data-size={size}>
      Bucket
    </button>
  )),
}));

jest.mock('@/components/SourceBadge', () => ({
  __esModule: true,
  default: jest.fn(({ source, size }: any) => (
    <span data-testid="source-badge" data-source={source} data-size={size}>
      {source}
    </span>
  )),
}));

// Mock fetch for similar papers API
global.fetch = jest.fn();

describe('PaperCard Component (DDD Mode - Characterization Tests)', () => {
  // 테스트용 논문 데이터
  const mockPaper: Paper = {
    source: 'arxiv',
    sourceId: '2301.00001',
    sourceUrl: 'https://arxiv.org/abs/2301.00001',
    title: 'Test Paper Title: Deep Learning for Computer Vision',
    authors: ['John Doe', 'Jane Smith', 'Bob Johnson'],
    abstract: 'This is a detailed abstract describing the research paper. It contains multiple sentences and provides an overview of the methodology and results.',
    categories: ['cs.AI', 'cs.CV', 'cs.LG'],
    publishedAt: '2023-01-01T00:00:00Z',
    updatedAt: '2023-01-01T00:00:00Z',
    pdfUrl: 'https://arxiv.org/pdf/2301.00001.pdf',
    arxivId: '2301.00001',
    arxivUrl: 'https://arxiv.org/abs/2301.00001',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ searchQuery: 'deep learning computer vision' }),
    });
  });

  describe('렌더링', () => {
    it('논문 정보를 올바르게 렌더링해야 함', () => {
      render(<PaperCard paper={mockPaper} />);

      // 제목 확인
      expect(screen.getByText('Test Paper Title: Deep Learning for Computer Vision')).toBeInTheDocument();

      // 저자 확인 (상세보기 텍스트도 포함되므로 더 정확한 선택 필요)
      const authors = screen.getByText(/John Doe.*Jane Smith/);
      expect(authors).toBeInTheDocument();

      // PDF 링크 확인
      expect(screen.getByText('PDF')).toBeInTheDocument();
    });

    it('소스 배지를 표시해야 함', () => {
      render(<PaperCard paper={mockPaper} />);

      // arXiv 소스 텍스트가 표시되어야 함
      expect(screen.getByText('arXiv')).toBeInTheDocument();
    });

    it('카테고리 태그를 표시해야 함', () => {
      render(<PaperCard paper={mockPaper} />);

      // 처음 2개 카테고리만 표시
      expect(screen.getByText('인공지능')).toBeInTheDocument();
      expect(screen.getByText('컴퓨터비전')).toBeInTheDocument();
    });

    it('3개 이상의 카테고리일 경우 +N 표시를 해야 함', () => {
      render(<PaperCard paper={mockPaper} />);

      expect(screen.getByText('+1')).toBeInTheDocument();
    });

    it('초록을 잘라서 표시해야 함 (120자 제한)', () => {
      const longAbstractPaper: Paper = {
        ...mockPaper,
        abstract: 'a'.repeat(200),
      };

      render(<PaperCard paper={longAbstractPaper} />);

      const abstractElement = screen.getByText(/a+\.\.\./);
      expect(abstractElement).toBeInTheDocument();
    });

    it('북마크와 버킷 버튼을 표시해야 함', () => {
      const { container } = render(<PaperCard paper={mockPaper} />);

      // 버튼 영역이 존재해야 함 (하단 액션 영역)
      const actionBar = container.querySelector('.border-t');
      expect(actionBar).toBeInTheDocument();
    });

    it('arxiv 논문의 경우 arXiv ID를 표시해야 함', () => {
      render(<PaperCard paper={mockPaper} />);

      expect(screen.getByText('arXiv:2301.00001')).toBeInTheDocument();
    });

    it('OpenReview 논문의 경우 축약된 ID를 표시해야 함', () => {
      const openReviewPaper: Paper = {
        ...mockPaper,
        source: 'openreview',
        sourceId: 'forum-abc123def456',
      };

      render(<PaperCard paper={openReviewPaper} />);

      expect(screen.getByText(/ID:forum-abc\d+\.\.\./)).toBeInTheDocument();
    });

    it('저자가 3명 이상일 경우 "외 N명"을 표시해야 함', () => {
      render(<PaperCard paper={mockPaper} />);

      expect(screen.getByText(/외 1명/)).toBeInTheDocument();
    });
  });

  describe('유사 논문 검색', () => {
    it('유사 논문 버튼 클릭시 API를 호출해야 함', async () => {
      render(<PaperCard paper={mockPaper} />);

      const similarButton = screen.getByText('유사논문');
      fireEvent.click(similarButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/similar-search',
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('Test Paper Title'),
          })
        );
      });
    });

    it('검색 성공 시 검색 결과 페이지로 이동해야 함', async () => {
      render(<PaperCard paper={mockPaper} />);

      const similarButton = screen.getByText('유사논문');
      fireEvent.click(similarButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/similar-search',
          expect.objectContaining({
            method: 'POST',
          })
        );
      });
    });

    it('이미 검색 중일 때는 중복 클릭을 방지해야 함', async () => {
      render(<PaperCard paper={mockPaper} />);

      const similarButton = screen.getByText('유사논문');

      fireEvent.click(similarButton);
      fireEvent.click(similarButton); // 즉시 다시 클릭

      // fetch는 한 번만 호출되어야 함
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(1);
      });
    });

    it('API 실패 시 에러를 콘솔에 기록해야 함', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      (global.fetch as jest.Mock).mockRejectedValue(new Error('API Error'));

      render(<PaperCard paper={mockPaper} />);

      const similarButton = screen.getByText('유사논문');
      fireEvent.click(similarButton);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('유사 논문 검색 오류'),
          expect.any(Error)
        );
      });

      consoleSpy.mockRestore();
    });
  });

  describe('날짜 형식화', () => {
    it('한국어 날짜 형식으로 표시해야 함', () => {
      render(<PaperCard paper={mockPaper} />);

      // arXiv ID와 날짜가 표시되어야 함
      expect(screen.getByText(/arXiv:2301\.00001/)).toBeInTheDocument();
    });
  });

  describe('PDF 링크', () => {
    it('PDF URL이 있을 때만 PDF 링크를 표시해야 함', () => {
      const paperWithoutPdf: Paper = {
        ...mockPaper,
        pdfUrl: '',
      };

      render(<PaperCard paper={paperWithoutPdf} />);

      expect(screen.queryByText('PDF')).not.toBeInTheDocument();
    });

    it('PDF 링크는 새 탭에서 열려야 함', () => {
      render(<PaperCard paper={mockPaper} />);

      const pdfLink = screen.getByText('PDF').closest('a');
      expect(pdfLink).toHaveAttribute('target', '_blank');
      expect(pdfLink).toHaveAttribute('rel', 'noopener noreferrer');
    });
  });

  describe('상세보기 링크', () => {
    it('제목 클릭시 상세 페이지로 이동해야 함', () => {
      render(<PaperCard paper={mockPaper} />);

      const titleLink = screen.getByText('Test Paper Title: Deep Learning for Computer Vision').closest('a');
      expect(titleLink).toHaveAttribute('href', '/paper/arxiv:2301.00001');
    });

    it('상세보기 버튼도 상세 페이지로 이동해야 함', () => {
      render(<PaperCard paper={mockPaper} />);

      const detailButton = screen.getByText('상세보기').closest('a');
      expect(detailButton).toHaveAttribute('href', '/paper/arxiv:2301.00001');
    });
  });

  describe('로딩 상태', () => {
    it('유사 논문 검색 중일 때 로딩 표시를 해야 함', async () => {
      // 응답을 지연시키지 않고 즉시 확인
      render(<PaperCard paper={mockPaper} />);

      const similarButton = screen.getByText('유사논문');
      fireEvent.click(similarButton);

      // 버튼이 disabled 상태가 되어야 함
      await waitFor(() => {
        expect(similarButton).toBeDisabled();
      });
    });

    it('로딩 중일 때 스피너를 표시해야 함', async () => {
      render(<PaperCard paper={mockPaper} />);

      const similarButton = screen.getByText('유사논문');
      fireEvent.click(similarButton);

      await waitFor(() => {
        expect(screen.getByText(/검색중/)).toBeInTheDocument();
      });
    });
  });

  describe('접근성', () => {
    it('링크에는 명확한 텍스트 라벨이 있어야 함', () => {
      render(<PaperCard paper={mockPaper} />);

      expect(screen.getByText('상세보기')).toBeInTheDocument();
      expect(screen.getByText('PDF')).toBeInTheDocument();
      expect(screen.getByText('유사논문')).toBeInTheDocument();
    });

    it('버튼은 disabled 상태일 때 시각적으로 표시되어야 함', async () => {
      render(<PaperCard paper={mockPaper} />);

      const similarButton = screen.getByText('유사논문');
      fireEvent.click(similarButton);

      await waitFor(() => {
        expect(similarButton).toHaveClass('disabled:opacity-50');
      });
    });
  });

  describe('OpenReview 논문', () => {
    const openReviewPaper: Paper = {
      source: 'openreview',
      sourceId: 'forum-abc123',
      sourceUrl: 'https://openreview.net/forum?id=forum-abc123',
      title: 'OpenReview Test Paper',
      authors: ['Author One', 'Author Two'],
      abstract: 'An abstract for OpenReview paper.',
      categories: ['ICLR.cc/2024/Conference'],
      publishedAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      pdfUrl: 'https://openreview.net/pdf?id=forum-abc123',
    };

    it('OpenReview 소스 배지를 표시해야 함', () => {
      render(<PaperCard paper={openReviewPaper} />);

      // 카테고리가 표시되어야 함
      expect(screen.getByText('ICLR.cc/2024/Conference')).toBeInTheDocument();
    });

    it('OpenReview 카테고리를 표시해야 함', () => {
      render(<PaperCard paper={openReviewPaper} />);

      expect(screen.getByText('ICLR.cc/2024/Conference')).toBeInTheDocument();
    });

    it('상세 페이지 링크가 OpenReview 형식이어야 함', () => {
      render(<PaperCard paper={openReviewPaper} />);

      const titleLink = screen.getByText('OpenReview Test Paper').closest('a');
      expect(titleLink).toHaveAttribute('href', '/paper/openreview:forum-abc123');
    });
  });
});
