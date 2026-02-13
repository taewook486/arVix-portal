'use client';

import { useState, useEffect, useRef } from 'react';
import DOMPurify from 'dompurify';

interface InfographicGeneratorProps {
  title: string;
  summary: string;
  keyPoints: string[];
  methodology?: string;
  mermaidCode?: string;
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

  // DEBUG: 실제 mermaidCode 출력
  useEffect(() => {
    if (mermaidCode) {
      console.log('=== Mermaid Code ===');
      console.log(mermaidCode);
      console.log('==================');
    }
  }, [mermaidCode]);

  // Mermaid 초기화 및 렌더링
  useEffect(() => {
    if (!mermaidCode || !containerRef.current) {
      return;
    }

    const renderDiagram = async () => {
      try {
        console.log('1. Mermaid 모듈 로드 시작...');

        const mermaidModule = await import('mermaid');
        const mermaid = mermaidModule.default;

        if (!mermaidInitialized.current) {
          console.log('3. Mermaid 초기화 시작...');

          mermaid.initialize({
            startOnLoad: false,
            theme: 'default',
            securityLevel: 'loose',
            // 한국어 텍스트 렌더링 최적화
            flowchart: {
              useMaxWidth: false,
              htmlLabels: true,
              curve: 'basis',
            },
            logLevel: 'error',
            fontSize: 16,
          });

          mermaidInitialized.current = true;

          console.log('4. Mermaid 초기화 완료');
        }

        console.log('5. 다이어그램 렌더링 시작...');
        console.log('레더링할 코드:', mermaidCode);

        const uniqueId = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        console.log('생성된 ID:', uniqueId);

        const { svg } = await mermaid.render(uniqueId, mermaidCode);

        console.log('6. SVG 생성 완료');
        console.log('SVG 길이:', svg.length);

        // SVG path 데이터 정화: warning만 출력하고 정상 path는 그대로 사용
        const sanitizedSvg = svg.replace(
          /d="[^"]*"/g,
          (match) => {
            const pathData = match.substring(3, match.length - 1); // 따옴표 사이의 데이터 추출

            // path 데이터가 너무 길면 warning 출력 (Mermaid 버그 가능성)
            if (pathData.length > 200) {
              console.warn('긴 path 데이터 발견 (Mermaid 버그 가능성):', pathData.substring(0, 50) + '...');
              return 'd=""'; // 제거하지 않음! warning만 출력
            }

            return match; // 정상 path는 그대로 사용
          }
        );

        console.log('7. SVG 정화 완료');

        if (containerRef.current) {
          // SVG를 wrapper로 감싸서 크기 조정
          const wrappedSvg = `
            <div class="mermaid-wrapper" style="width: 100%; max-width: 1200px; overflow-x: auto;">
              ${sanitizedSvg}
            </div>
          `;
          containerRef.current.innerHTML = wrappedSvg;

          console.log('8. DOM 주입 완료');

          // ✅ foreignObject div 직접 조작으로 텍스트 줄바꿈 해결
          setTimeout(() => {
            const foreignObjects = containerRef.current?.querySelectorAll('.mermaid-wrapper foreignObject div');

            if (foreignObjects && foreignObjects.length > 0) {
              foreignObjects.forEach((div) => {
                (div as HTMLDivElement).style.whiteSpace = 'normal';
                (div as HTMLDivElement).style.maxWidth = 'none';
                (div as HTMLDivElement).style.wordBreak = 'break-word';
                (div as HTMLDivElement).style.overflowWrap = 'break-word';
                (div as HTMLDivElement).style.height = 'auto';
                (div as HTMLDivElement).style.overflow = 'visible';
                (div as HTMLDivElement).style.width = 'auto';
              });

              console.log('✅ foreignObject 스타일 적용 완료:', foreignObjects.length, '개 요소');
            } else {
              console.warn('⚠️ foreignObject div를 찾지 못함');
            }
          }, 100);
        }
      } catch (err) {
        console.error('Mermaid 렌더링 에러:', err);
        console.error('에러 상세:', JSON.stringify(err, null, 2));
      }
    };

    // DOM이 준비되면 실행 (약간 지연)
    const timeoutId = setTimeout(() => {
      console.log('타이머 시작 - 300ms 지연 후 렌더링 실행');
      renderDiagram();
    }, 300);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [mermaidCode]);

  const generateInfographic = async () => {
    setIsLoading(true);
    setError(null);

    // Clear existing content
    if (containerRef.current) {
      containerRef.current.innerHTML = '';
    }

    try {
      const response = await fetch('/api/infographic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, summary, keyPoints, methodology }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '인포그래픽 생성 실패');
      }

      if (data.success && data.mermaidCode) {
        console.log('=== API 응답 받은 Mermaid 코드 ===');
        console.log(data.mermaidCode);
        console.log('===================');
        setMermaidCode(data.mermaidCode);
      } else {
        throw new Error('다이어그램 생성에 실패했습니다');
      }
    } catch (err) {
      console.error('인포그래픽 생성 오류:', err);
      setError(err instanceof Error ? err.message : '알 수 없는 오류');
    } finally {
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
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <svg
          className="w-6 h-6 text-amber-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16l4.586-4.586a2 2 012.828 0L16 16m-2-2l1.586a1.586 0L20 14m-2-2l1.586a1.586 0L14 12H0c0 4.0 4.0l-1.586-2z"
          />
        </svg>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">인포그래픽 생성</h3>
          <p className="text-sm text-gray-600">AI가 논문 내용을 시각화합니다</p>
        </div>
      </div>

      {/* Generate Button */}
      <button
        onClick={generateInfographic}
        disabled={isLoading}
        className="w-full px-4 py-3 bg-amber-500 text-white font-medium rounded-lg hover:bg-amber-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <>
            <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 018-8V0H6z" />
            </svg>
            생성 중...
          </>
        ) : (
          <>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15.232 5.232l3.536m-2.036A18…"
              />
            </svg>
            인포그래픽 생성
          </>
        )}
      </button>

      {/* Error Display */}
      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700 whitespace-pre-wrap">{error}</p>
        </div>
      )}

      {/* SVG Container with wrapper for size control */}
      <div
        ref={containerRef}
        className="mt-4 rounded-lg border border-gray-200 bg-white p-4 mermaid-container"
        style={{
          minHeight: mermaidCode ? '300px' : '0',
        }}
      />
    </div>
  );
}
