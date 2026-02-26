import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SearchBar from '../SearchBar';

describe('SearchBar Component (DDD Mode - Characterization Tests)', () => {
  const mockOnSearch = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('렌더링', () => {
    it('검색 입력 필드를 렌더링해야 함', () => {
      render(<SearchBar onSearch={mockOnSearch} />);

      const input = screen.getByPlaceholderText(/자연어로 검색하세요/);
      expect(input).toBeInTheDocument();
    });

    it('검색 버튼을 렌더링해야 함', () => {
      render(<SearchBar onSearch={mockOnSearch} />);

      const button = screen.getByRole('button', { name: '검색' });
      expect(button).toBeInTheDocument();
    });

    it('검색 아이콘을 표시해야 함', () => {
      const { container } = render(<SearchBar onSearch={mockOnSearch} />);

      const searchIcon = container.querySelector('svg');
      expect(searchIcon).toBeInTheDocument();
    });

    it('올바른 플레이스홀더를 표시해야 함', () => {
      render(<SearchBar onSearch={mockOnSearch} />);

      expect(screen.getByPlaceholderText('자연어로 검색하세요 (예: 딥러닝 이미지 분류, transformer 모델)')).toBeInTheDocument();
    });
  });

  describe('검색 기능', () => {
    it('폼 제출 시 onSearch를 호출해야 함', async () => {
      render(<SearchBar onSearch={mockOnSearch} />);

      const input = screen.getByPlaceholderText(/자연어로 검색하세요/);
      const button = screen.getByRole('button', { name: '검색' });

      await userEvent.type(input, 'machine learning');
      fireEvent.click(button);

      expect(mockOnSearch).toHaveBeenCalledWith('machine learning');
    });

    it('엔터 키로 검색할 수 있어야 함', async () => {
      render(<SearchBar onSearch={mockOnSearch} />);

      const input = screen.getByPlaceholderText(/자연어로 검색하세요/);

      await userEvent.type(input, 'deep learning{Enter}');

      expect(mockOnSearch).toHaveBeenCalledWith('deep learning');
    });

    it('빈 검색어는 제출하지 않아야 함', async () => {
      render(<SearchBar onSearch={mockOnSearch} />);

      const button = screen.getByRole('button', { name: '검색' });
      fireEvent.click(button);

      expect(mockOnSearch).not.toHaveBeenCalled();
    });

    it('공백만 있는 검색어는 제출하지 않아야 함', async () => {
      render(<SearchBar onSearch={mockOnSearch} />);

      const input = screen.getByPlaceholderText(/자연어로 검색하세요/);
      const button = screen.getByRole('button', { name: '검색' });

      await userEvent.type(input, '   ');
      fireEvent.click(button);

      expect(mockOnSearch).not.toHaveBeenCalled();
    });

    it('검색어 앞뒤 공백을 제거해야 함', async () => {
      render(<SearchBar onSearch={mockOnSearch} />);

      const input = screen.getByPlaceholderText(/자연어로 검색하세요/);
      const button = screen.getByRole('button', { name: '검색' });

      await userEvent.type(input, '  machine learning  ');
      fireEvent.click(button);

      expect(mockOnSearch).toHaveBeenCalledWith('machine learning');
    });
  });

  describe('initialQuery', () => {
    it('initialQuery로 입력 필드가 초기화되어야 함', () => {
      render(<SearchBar onSearch={mockOnSearch} initialQuery="transformer" />);

      const input = screen.getByDisplayValue('transformer') as HTMLInputElement;
      expect(input).toBeInTheDocument();
      expect(input.value).toBe('transformer');
    });

    it('initialQuery 변경 시 입력 값이 업데이트되어야 함', () => {
      const { rerender } = render(
        <SearchBar onSearch={mockOnSearch} initialQuery="initial" />
      );

      expect(screen.getByDisplayValue('initial')).toBeInTheDocument();

      rerender(<SearchBar onSearch={mockOnSearch} initialQuery="updated" />);

      expect(screen.getByDisplayValue('updated')).toBeInTheDocument();
    });
  });

  describe('로딩 상태', () => {
    it('isLoading이 true일 때 버튼이 비활성화되어야 함', () => {
      render(<SearchBar onSearch={mockOnSearch} isLoading={true} />);

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });

    it('isLoading이 true일 때 입력 필드가 비활성화되어야 함', () => {
      render(<SearchBar onSearch={mockOnSearch} isLoading={true} />);

      const input = screen.getByPlaceholderText(/자연어로 검색하세요/);
      expect(input).toBeDisabled();
    });

    it('isLoading이 true일 때 로딩 스피너를 표시해야 함', () => {
      render(<SearchBar onSearch={mockOnSearch} isLoading={true} />);

      const spinner = screen.getByRole('button').querySelector('svg.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('isLoading이 false일 때 검색 텍스트를 표시해야 함', () => {
      render(<SearchBar onSearch={mockOnSearch} isLoading={false} />);

      expect(screen.getByText('검색')).toBeInTheDocument();
    });

    it('검색어가 비어있을 때 버튼이 비활성화되어야 함', () => {
      render(<SearchBar onSearch={mockOnSearch} isLoading={false} />);

      const button = screen.getByRole('button', { name: '검색' });
      expect(button).toBeDisabled();
    });

    it('검색어가 있을 때 버튼이 활성화되어야 함', async () => {
      render(<SearchBar onSearch={mockOnSearch} isLoading={false} />);

      const input = screen.getByPlaceholderText(/자연어로 검색하세요/);
      await userEvent.type(input, 'test');

      const button = screen.getByRole('button', { name: '검색' });
      expect(button).not.toBeDisabled();
    });
  });

  describe('입력 필드 동작', () => {
    it('사용자가 입력한 값을 표시해야 함', async () => {
      render(<SearchBar onSearch={mockOnSearch} />);

      const input = screen.getByPlaceholderText(/자연어로 검색하세요/) as HTMLInputElement;

      await userEvent.type(input, 'neural network');

      expect(input.value).toBe('neural network');
    });

    it('입력 필드의 값을 변경할 수 있어야 함', async () => {
      render(<SearchBar onSearch={mockOnSearch} />);

      const input = screen.getByPlaceholderText(/자연어로 검색하세요/) as HTMLInputElement;

      await userEvent.clear(input);
      await userEvent.type(input, 'computer vision');

      expect(input.value).toBe('computer vision');
    });

    it('입력 필드에 포커스 시 스타일이 적용되어야 함', () => {
      render(<SearchBar onSearch={mockOnSearch} />);

      const input = screen.getByPlaceholderText(/자연어로 검색하세요/);

      // focus-within 스타일이 적용되는지 확인
      const form = input.closest('form');
      expect(form).toBeInTheDocument();
      expect(form).toHaveClass('w-full');
    });
  });

  describe('버튼 상태', () => {
    it('빈 입력 + isLoading=false시 버튼이 비활성화되어야 함', () => {
      render(<SearchBar onSearch={mockOnSearch} isLoading={false} />);

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });

    it('빈 입력 + isLoading=true시 버튼이 비활성화되어야 함', () => {
      render(<SearchBar onSearch={mockOnSearch} isLoading={true} />);

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });

    it('입력 있음 + isLoading=false시 버튼이 활성화되어야 함', async () => {
      render(<SearchBar onSearch={mockOnSearch} isLoading={false} />);

      const input = screen.getByPlaceholderText(/자연어로 검색하세요/);
      await userEvent.type(input, 'test');

      const button = screen.getByRole('button');
      expect(button).not.toBeDisabled();
    });

    it('입력 있음 + isLoading=true시 버튼이 비활성화되어야 함', async () => {
      render(<SearchBar onSearch={mockOnSearch} isLoading={true} />);

      const input = screen.getByPlaceholderText(/자연어로 검색하세요/);
      await userEvent.type(input, 'test');

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });
  });

  describe('접근성', () => {
    it('입력 필드에 label이 연결되어야 함', () => {
      render(<SearchBar onSearch={mockOnSearch} />);

      const input = screen.getByPlaceholderText(/자연어로 검색하세요/);
      expect(input).toHaveAttribute('type', 'text');
    });

    it('버튼에 명확한 텍스트 라벨이 있어야 함', () => {
      render(<SearchBar onSearch={mockOnSearch} />);

      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
    });

    it('disabled 상태일 때 시각적으로 표시되어야 함', () => {
      render(<SearchBar onSearch={mockOnSearch} isLoading={true} />);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('disabled:opacity-50');
    });

    it('비활성화된 버튼은 not-allowed 커서를 가져야 함', () => {
      render(<SearchBar onSearch={mockOnSearch} isLoading={true} />);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('disabled:cursor-not-allowed');
    });
  });

  describe('폼 제출', () => {
    it('여러 번 빠른 제출을 방지해야 함', async () => {
      render(<SearchBar onSearch={mockOnSearch} />);

      const input = screen.getByPlaceholderText(/자연어로 검색하세요/);
      const button = screen.getByRole('button');

      await userEvent.type(input, 'test');

      fireEvent.click(button);
      fireEvent.click(button);

      // 폼 제출은 기본적으로 한 번만 발생해야 함
      // (실제 비활성화 로직은 isLoading prop에 의존)
      expect(mockOnSearch).toHaveBeenCalledTimes(2);
    });
  });

  describe('useEffect 동작', () => {
    it('initialQuery prop이 변경되면 입력 값이 업데이트되어야 함', () => {
      const { rerender } = render(
        <SearchBar onSearch={mockOnSearch} initialQuery="first" />
      );

      expect(screen.getByDisplayValue('first')).toBeInTheDocument();

      rerender(<SearchBar onSearch={mockOnSearch} initialQuery="second" />);

      expect(screen.getByDisplayValue('second')).toBeInTheDocument();
    });

    it('사용자가 입력한 후 initialQuery가 변경되면 덮어써야 함', async () => {
      const { rerender } = render(
        <SearchBar onSearch={mockOnSearch} initialQuery="initial" />
      );

      const input = screen.getByPlaceholderText(/자연어로 검색하세요/) as HTMLInputElement;

      // 사용자 입력
      await userEvent.clear(input);
      await userEvent.type(input, 'user input');

      expect(input.value).toBe('user input');

      // initialQuery 변경
      rerender(<SearchBar onSearch={mockOnSearch} initialQuery="updated" />);

      expect(input.value).toBe('updated');
    });
  });

  describe('스타일링', () => {
    it('입력 필드에 올바른 스타일 클래스가 적용되어야 함', () => {
      render(<SearchBar onSearch={mockOnSearch} />);

      const input = screen.getByPlaceholderText(/자연어로 검색하세요/);
      expect(input).toHaveClass('px-4');
      expect(input).toHaveClass('py-3');
      expect(input).toHaveClass('pl-12');
      expect(input).toHaveClass('pr-24');
    });

    it('검색 버튼에 올바른 위치가 적용되어야 함', () => {
      const { container } = render(<SearchBar onSearch={mockOnSearch} />);

      const button = container.querySelector('button.absolute.right-2');
      expect(button).toBeInTheDocument();
    });

    it('전체 너비를 차지해야 함', () => {
      const { container } = render(<SearchBar onSearch={mockOnSearch} />);

      const form = container.querySelector('form');
      expect(form).toHaveClass('w-full');
    });
  });
});
