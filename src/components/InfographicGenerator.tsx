'use client';

import { useState, useEffect, useRef } from 'react';

interface InfographicGeneratorProps {
  title: string;
  summary: string;
  keyPoints: string[];
  methodology: string;
  mermaidCode?: string; // Optional prop for pre-existing mermaid code
}

export default function InfographicGenerator({
  title,
  summary,
  keyPoints,
  methodology,
  mermaidCode: initialMermaidCode,
}: InfographicGeneratorProps) {
  const [mermaidCode, setMermaidCode] = useState<string | null>(initialMermaidCode || null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mermaidInitialized = useRef(false);

  // useEffect를 사용하여 state 업데이트 후 DOM이 준비되면 실행
  useEffect(() => {
    console.log('=== useEffect triggered, mermaidCode:', !!mermaidCode, 'containerRef:', !!containerRef.current);

    if (!mermaidCode || !containerRef.current) {
      console.log('조건 불충족, 렌더링 건너뜀');
      return;
    }

    const renderDiagram = async () => {
      try {
        console.log('Mermaid 다이어그램 렌더링 시작...');
        const mermaidModule = await import('mermaid');
        const mermaid = mermaidModule.default;

        // Initialize mermaid only once
        if (!mermaidInitialized.current) {
          console.log('Mermaid 초기화 중...');
          mermaid.initialize({
            startOnLoad: false,
            theme: 'default',
            securityLevel: 'loose',
            logLevel: 'error',
          });
          mermaidInitialized.current = true;
        }

        // Clear container
        if (containerRef.current) {
          containerRef.current.innerHTML = '';
        }

        // Create unique ID
        const id = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        console.log('Mermaid 렌더링 ID:', id, '코드 길이:', mermaidCode.length);

        // Render mermaid code
        const { svg } = await mermaid.render(id, mermaidCode);
        console.log('SVG 렌더링 성공, 길이:', svg.length);

        // Set SVG content
        if (containerRef.current) {
          containerRef.current.innerHTML = svg;
          console.log('SVG가 컨테이너에 삽입됨');
        }
      } catch (err) {
        console.error('Mermaid 렌더링 에러:', err);
        const errorMessage = err instanceof Error ? err.message : '알 수 없는 오류';
        setError(`다이어그램 렌더링 실패: ${errorMessage}\n\nMermaid 코드:\n${mermaidCode}`);
      }
    };

    // Small delay to ensure DOM is ready
    const timeoutId = setTimeout(() => {
      console.log('지연 후 렌더링 함수 호출');
      renderDiagram();
    }, 150);

    return () => {
      console.log('useEffect cleanup - 타이머 취소');
      clearTimeout(timeoutId);
    };
  }, [mermaidCode]);

  const generateInfographic = async () => {
    console.log('=== generateInfographic 함수 시작 ===');
    setIsLoading(true);
    setError(null);

    // Clear existing content - DOM만 지우고 상태는 유지
    if (containerRef.current) {
      containerRef.current.innerHTML = '';
    }

    try {
      console.log('API 요청 시작...');
      const response = await fetch('/api/infographic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, summary, keyPoints, methodology }),
      });

      console.log('API 응답 수신:', response.status);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '인포그래픽 생성 실패');
      }

      if (data.success && data.mermaidCode) {
        console.log('mermaidCode 설정 완료, 길이:', data.mermaidCode.length);
        setMermaidCode(data.mermaidCode);
        console.log('상태 업데이트 완료 - useEffect 트리거 예상');
      } else {
        throw new Error('다이어그램 생성에 실패했습니다');
      }
    } catch (err) {
      console.error('인포그래픽 생성 에러:', err);
      setError(err instanceof Error ? err.message : '알 수 없는 오류');
    } finally {
      console.log('=== generateInfographic 함수 종료, isLoading=false ===');
      setIsLoading(false);
    }
  };

  const downloadImage = () => {
    if (!containerRef.current) return;

    const svgElement = containerRef.current.querySelector('svg');
    if (!svgElement) return;

    const svgData = new XMLSerializer().serializeToString(svgElement);
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `infographic-${Date.now()}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-gradient-to-r from-amber-50 to-yellow-50 rounded-lg p-6 border border-amber-200">
      <div className="flex items-center gap-3 mb-4">
        <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">인포그래픽 생성</h3>
          <p className="text-sm text-gray-600">AI가 논문 내용을 시각화합니다</p>
        </div>
      </div>

      {/* 생성 버튼 항상 표시 (로딩 중일 때만 비활성화) */}
      <button
        onClick={generateInfographic}
        disabled={isLoading}
        className="w-full px-4 py-3 bg-amber-500 text-white font-medium rounded-lg hover:bg-amber-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <>
            <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            생성 중...
          </>
        ) : (
          <>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            {mermaidCode ? '인포그래픽 다시 만들기' : '인포그래픽 만들기'}
          </>
        )}
      </button>

      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700 whitespace-pre-wrap">{error}</p>
        </div>
      )}

      {/* 컨테이너 항상 렌더링 */}
      <div
        ref={containerRef}
        className="relative mt-4 rounded-lg overflow-auto border border-gray-200 bg-white p-4"
        style={{ minHeight: mermaidCode ? '300px' : '0', maxHeight: '2000px' }}
      />

      {/* 다이어그램이 있을 때만 다운로드/재생성 버튼 표시 */}
      {mermaidCode && (
        <div className="mt-4 flex gap-3">
          <button
            onClick={downloadImage}
            className="flex-1 px-4 py-2 bg-amber-500 text-white font-medium rounded-lg hover:bg-amber-600 transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            다운로드
          </button>
        </div>
      )}
    </div>
  );
}