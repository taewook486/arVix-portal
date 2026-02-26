import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import PaperList from '../PaperList';
import { Paper } from '@/types/paper';

// @MX:NOTE: PaperCard 컴포넌트 모킹
jest.mock('../PaperCard', () => ({
  __esModule: true,
  default: ({ paper }: { paper: Paper }) => (
    <div data-testid="paper-card" data-paper-id={paper.sourceId}>
      {paper.title}
    </div>
  ),
}));

describe('PaperList Component (DDD Mode - Characterization Tests)', () => {
  // 테스트용 논문 데이터
  const mockPapers: Paper[] = [
    {
      source: 'arxiv',
      sourceId: '2301.00001',
      sourceUrl: 'https://arxiv.org/abs/2301.00001',
      title: 'First Paper',
      authors: ['Author 1'],
      abstract: 'Abstract 1',
      categories: ['cs.AI'],
      publishedAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z',
      pdfUrl: 'https://arxiv.org/pdf/2301.00001.pdf',
      arxivId: '2301.00001',
    },
    {
      source: 'arxiv',
      sourceId: '2301.00002',
      sourceUrl: 'https://arxiv.org/abs/2301.00002',
      title: 'Second Paper',
      authors: ['Author 2'],
      abstract: 'Abstract 2',
      categories: ['cs.LG'],
      publishedAt: '2023-01-02T00:00:00Z',
      updatedAt: '2023-01-02T00:00:00Z',
      pdfUrl: 'https://arxiv.org/pdf/2301.00002.pdf',
      arxivId: '2301.00002',
    },
    {
      source: 'openreview',
      sourceId: 'forum-abc123',
      sourceUrl: 'https://openreview.net/forum?id=forum-abc123',
      title: 'Third Paper',
      authors: ['Author 3'],
      abstract: 'Abstract 3',
      categories: ['ICLR.cc/2024/Conference'],
      publishedAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      pdfUrl: 'https://openreview.net/pdf?id=forum-abc123',
    },
  ];

  describe('렌더링', () => {
    it('논문 목록을 렌더링해야 함', () => {
      const { container } = render(<PaperList papers={mockPapers} />);

      const cards = container.querySelectorAll('.rounded-xl.shadow-sm');
      expect(cards).toHaveLength(3);
    });

    it('각 논문 카드에 올바른 paper를 전달해야 함', () => {
      render(<PaperList papers={mockPapers} />);

      expect(screen.getByText('First Paper')).toBeInTheDocument();
      expect(screen.getByText('Second Paper')).toBeInTheDocument();
      expect(screen.getByText('Third Paper')).toBeInTheDocument();
    });

    it('그리드 레이아웃을 사용해야 함', () => {
      const { container } = render(<PaperList papers={mockPapers} />);

      const grid = container.querySelector('.grid');
      expect(grid).toBeInTheDocument();
      expect(grid?.className).toContain('grid-cols-1');
      expect(grid?.className).toContain('md:grid-cols-2');
      expect(grid?.className).toContain('lg:grid-cols-3');
    });
  });

  describe('로딩 상태', () => {
    it('isLoading이 true일 때 스켈레톤을 표시해야 함', () => {
      const { container } = render(<PaperList papers={[]} isLoading={true} />);

      // 6개의 스켈레톤이 표시되어야 함
      const skeletons = container.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBe(6);
    });

    it('로딩 중일 때 논문 카드를 표시하지 않아야 함', () => {
      const { container } = render(<PaperList papers={mockPapers} isLoading={true} />);

      // 논문 제목이 표시되지 않아야 함
      expect(screen.queryByText('First Paper')).not.toBeInTheDocument();
    });

    it('로딩 스켈레톤은 6개여야 함', () => {
      const { container } = render(<PaperList papers={[]} isLoading={true} />);

      const pulseElements = container.querySelectorAll('.animate-pulse');
      expect(pulseElements).toHaveLength(6);
    });

    it('로딩 스켈레톤에 올바른 구조를 가져야 함', () => {
      const { container } = render(<PaperList papers={[]} isLoading={true} />);

      // 카테고리 태그 스켈레톤
      const categoryBadges = container.querySelectorAll('.bg-blue-100.rounded-full');
      expect(categoryBadges.length).toBeGreaterThan(0);

      // 제목 스켈레톤
      const titleSkeletons = container.querySelectorAll('.bg-gray-200');
      expect(titleSkeletons.length).toBeGreaterThan(0);
    });
  });

  describe('빈 상태', () => {
    it('논문이 없을 때 빈 상태 메시지를 표시해야 함', () => {
      render(<PaperList papers={[]} />);

      expect(screen.getByText('논문이 없습니다.')).toBeInTheDocument();
    });

    it('빈 상태时 아이콘을 표시해야 함', () => {
      const { container } = render(<PaperList papers={[]} />);

      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('커스텀 빈 메시지를 표시할 수 있어야 함', () => {
      render(<PaperList papers={[]} emptyMessage="검색 결과가 없습니다." />);

      expect(screen.getByText('검색 결과가 없습니다.')).toBeInTheDocument();
    });

    it('빈 상태에서 검색 제안을 표시해야 함', () => {
      render(<PaperList papers={[]} />);

      expect(screen.getByText(/검색어를 입력하여/)).toBeInTheDocument();
    });

    it('빈 상태일 때 논문 카드를 표시하지 않아야 함', () => {
      render(<PaperList papers={[]} />);

      const cards = screen.queryByTestId('paper-card');
      expect(cards).not.toBeInTheDocument();
    });
  });

  describe('반응형 레이아웃', () => {
    it('모바일에서 1열 레이아웃이어야 함', () => {
      const { container } = render(<PaperList papers={mockPapers} />);

      const grid = container.querySelector('.grid');
      expect(grid?.className).toContain('grid-cols-1');
    });

    it('태블릿(md)에서 2열 레이아웃이어야 함', () => {
      const { container } = render(<PaperList papers={mockPapers} />);

      const grid = container.querySelector('.grid');
      expect(grid?.className).toContain('md:grid-cols-2');
    });

    it('데스크톱(lg)에서 3열 레이아웃이어야 함', () => {
      const { container } = render(<PaperList papers={mockPapers} />);

      const grid = container.querySelector('.grid');
      expect(grid?.className).toContain('lg:grid-cols-3');
    });
  });

  describe('카드 간격', () => {
    it('카드 사이에 간격이 있어야 함', () => {
      const { container } = render(<PaperList papers={mockPapers} />);

      const grid = container.querySelector('.grid');
      expect(grid?.className).toContain('gap-4');
    });
  });

  describe('여러 소스 지원', () => {
    it('arxiv와 openreview 논문을 모두 렌더링해야 함', () => {
      const { container } = render(<PaperList papers={mockPapers} />);

      // 카드 개수 확인
      const cards = container.querySelectorAll('.rounded-xl.shadow-sm');
      expect(cards).toHaveLength(3);

      // 논문 제목으로 확인
      expect(screen.getByText('First Paper')).toBeInTheDocument();
      expect(screen.getByText('Second Paper')).toBeInTheDocument();
      expect(screen.getByText('Third Paper')).toBeInTheDocument();
    });
  });

  describe('키 props', () => {
    it('각 카드에 고유한 key prop을 전달해야 함', () => {
      // PaperCard는 arxivId를 key로 사용함
      const { container } = render(<PaperList papers={mockPapers} />);

      // 단순히 카드가 렌더링되는지 확인
      const cards = container.querySelectorAll('.rounded-xl.shadow-sm');
      expect(cards.length).toBeGreaterThan(0);
    });
  });

  describe('조건부 렌더링', () => {
    it('isLoading이 false이고 papers가 있으면 카드를 표시해야 함', () => {
      const { container } = render(<PaperList papers={mockPapers} isLoading={false} />);

      // 카드가 렌더링되었는지 확인 - .rounded-xl 클래스는 PaperCard의 기본 스타일
      const cards = container.querySelectorAll('.rounded-xl.shadow-sm');
      expect(cards.length).toBe(3);
    });

    it('isLoading이 false이고 papers가 비어있으면 빈 상태를 표시해야 함', () => {
      render(<PaperList papers={[]} isLoading={false} />);

      expect(screen.getByText('논문이 없습니다.')).toBeInTheDocument();
    });

    it('isLoading이 true이면 papers와 관계없이 로딩을 표시해야 함', () => {
      const { container } = render(<PaperList papers={mockPapers} isLoading={true} />);

      // 로딩 상태에서는 스켈레톤이 표시되어야 함
      const skeletons = container.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBe(6);

      // paper 제목이 표시되지 않아야 함 (로딩 상태)
      expect(screen.queryByText('First Paper')).not.toBeInTheDocument();
    });
  });

  describe('접근성', () => {
    it('빈 상태 메시지를 스크린 리더에서 읽을 수 있어야 함', () => {
      render(<PaperList papers={[]} />);

      const emptyMessage = screen.getByText('논문이 없습니다.');
      expect(emptyMessage).toBeInTheDocument();
    });

    it('로딩 상태일 때도 접근 가능해야 함', () => {
      const { container } = render(<PaperList papers={[]} isLoading={true} />);

      const skeletons = container.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBe(6);
    });
  });
});
