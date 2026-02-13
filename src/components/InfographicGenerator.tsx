'use client';

import { useState, useEffect, useRef } from 'react';
import mermaid from 'mermaid';

interface InfographicGeneratorProps {
  title: string;
  summary: string;
  keyPoints: string[];
  methodology: string;
  arxivId?: string;
  source?: string;
}

export default function InfographicGenerator({
  title,
  summary,
  keyPoints,
  methodology,
  arxivId,
  source,
}: InfographicGeneratorProps) {
  const [diagramCode, setDiagramCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [svgDataUrl, setSvgDataUrl] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize Mermaid
  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'default',
      securityLevel: 'loose',
      // Add custom font size for better Korean text rendering
      themeVariables: {
        fontSize: '14px',
        fontFamily: 'Arial, sans-serif',
        maxTextWidth: 500,
      },
      mindmap: {
        padding: 15,
        useMaxWidth: true,
      },
    });
  }, []);

  // Load cached diagram on mount
  useEffect(() => {
    const loadCachedDiagram = async () => {
      if (!arxivId) return;

      try {
        const response = await fetch(`/api/infographic?arxivId=${arxivId}`);
        if (response.ok) {
          const data = await response.json();
          if (data.diagramCode) {
            setDiagramCode(data.diagramCode);
          }
        }
      } catch (err) {
        console.error('Cached diagram load error:', err);
      }
    };

    loadCachedDiagram();
  }, [arxivId]);

  // Render Mermaid diagram when code changes
  useEffect(() => {
    const renderDiagram = async () => {
      if (!diagramCode || !containerRef.current) {
        console.log('[InfographicGenerator] Skip rendering: diagramCode=', !!diagramCode, 'containerRef=', !!containerRef.current);
        return;
      }

      try {
        console.log('[InfographicGenerator] Starting Mermaid render...');
        const id = `mermaid-${Date.now()}`;
        console.log('[InfographicGenerator] Mermaid code length:', diagramCode.length);
        console.log('[InfographicGenerator] Mermaid code preview:', diagramCode.substring(0, 100) + '...');

        const { svg } = await mermaid.render(id, diagramCode);
        console.log('[InfographicGenerator] Mermaid render completed, SVG length:', svg.length);

        if (containerRef.current) {
          containerRef.current.innerHTML = svg;
          // Extract SVG for download
          const svgElement = containerRef.current.querySelector('svg');
          if (svgElement) {
            // Add inline styles to SVG for proper display in new window
            const styleElement = document.createElement('style');
            styleElement.textContent = `
              text {
                font-family: Arial, sans-serif !important;
                font-size: 16px !important;
                line-height: 1.4 !important;
                overflow: visible !important;
                text-overflow: clip !important;
                white-space: normal !important;
              }
              * {
                overflow: visible !important;
              }
              .node rect, .node circle, .node path, .node polygon, .foreignObject {
                overflow: visible !important;
              }
              g.node text, .nodeLabel {
                overflow: visible !important;
                text-overflow: clip !important;
                white-space: normal !important;
              }
              tspan {
                overflow: visible !important;
                white-space: normal !important;
              }
            `;
            svgElement.prepend(styleElement);

            // Ensure viewBox is set
            if (!svgElement.getAttribute('viewBox')) {
              const bbox = svgElement.getBBox();
              svgElement.setAttribute('viewBox', `${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}`);
            }

            const svgData = new XMLSerializer().serializeToString(svgElement);
            const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(svgBlob);
            setSvgDataUrl(url);
            console.log('[InfographicGenerator] SVG data URL created for download');
          }
        }
      } catch (err) {
        console.error('[InfographicGenerator] Mermaid render error:', err);
        // Show raw code as fallback
        if (containerRef.current) {
          containerRef.current.innerHTML = `
            <div class="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p class="text-sm text-red-700 font-medium mb-2">다이어그램 렌더링 실패 (Mermaid 문법 오류)</p>
              <pre class="text-xs bg-gray-100 p-3 rounded overflow-auto max-h-64">${diagramCode}</pre>
            </div>
          `;
        }
        setError('다이어그램 렌더링 중 오류가 발생했습니다: ' + (err instanceof Error ? err.message : String(err)));
      }
    };

    renderDiagram();
  }, [diagramCode]);

  const generateInfographic = async () => {
    console.log('[InfographicGenerator] Generate button clicked');
    console.log('[InfographicGenerator] Props:', { title, summary, keyPoints, methodology, arxivId, source });

    setIsLoading(true);
    setError(null);
    setDiagramCode(null);
    setSvgDataUrl(null);

    try {
      console.log('[InfographicGenerator] Sending API request...');
      const response = await fetch('/api/infographic', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          summary,
          keyPoints,
          methodology,
          arxivId,
          source,
        }),
      });

      console.log('[InfographicGenerator] Response status:', response.status);
      const data = await response.json();
      console.log('[InfographicGenerator] Response data:', data);

      if (!response.ok) {
        throw new Error(data.error || '다이어그램 생성 실패');
      }

      if (data.success && data.diagramCode) {
        console.log('[InfographicGenerator] Diagram code received, setting state...');
        setDiagramCode(data.diagramCode);
      } else {
        throw new Error('다이어그램 생성에 실패했습니다');
      }
    } catch (err) {
      console.error('[InfographicGenerator] Error:', err);
      setError(err instanceof Error ? err.message : '알 수 없는 오류');
    } finally {
      console.log('[InfographicGenerator] Setting isLoading to false');
      setIsLoading(false);
    }
  };

  const downloadDiagram = () => {
    if (!svgDataUrl) return;

    const link = document.createElement('a');
    link.href = svgDataUrl;
    link.download = `infographic-${Date.now()}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-gradient-to-r from-amber-50 to-yellow-50 rounded-lg p-6 border border-amber-200">
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
            d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
          />
        </svg>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">인포그래픽 생성</h3>
          <p className="text-sm text-gray-600">GLM-5 + Mermaid 다이어그램 생성</p>
        </div>
      </div>

      {!diagramCode && !isLoading && (
        <button
          onClick={generateInfographic}
          disabled={isLoading}
          className="w-full px-4 py-3 bg-amber-500 text-white font-medium rounded-lg hover:bg-amber-600 transition-colors flex items-center justify-center gap-2"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
            />
          </svg>
          인포그래픽 만들기
        </button>
      )}

      {isLoading && (
        <div className="text-center py-8">
          <div className="inline-flex items-center gap-3">
            <svg
              className="animate-spin w-6 h-6 text-amber-600"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span className="text-gray-700 font-medium">
              다이어그램 생성 중...
            </span>
          </div>
          <p className="mt-2 text-sm text-gray-500">
            GLM-5로 Mermaid mindmap 다이어그램을 생성 중입니다
          </p>
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{error}</p>
          <button
            onClick={generateInfographic}
            className="mt-2 text-sm text-red-600 hover:text-red-700 font-medium"
          >
            다시 시도
          </button>
        </div>
      )}

      {diagramCode && (
        <div className="mt-4">
          <div className="relative rounded-lg border border-gray-200 bg-white p-4" style={{ overflow: 'auto' }}>
            <div ref={containerRef} className="mermaid-container flex items-center justify-center min-h-[400px] p-4" style={{ minWidth: '600px' }} />
          </div>
          <div className="mt-4 flex gap-3">
            <button
              onClick={() => svgDataUrl && window.open(svgDataUrl, '_blank')}
              disabled={!svgDataUrl}
              className="px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              새 창에서 보기
            </button>
            <button
              onClick={downloadDiagram}
              className="flex-1 px-4 py-2 bg-amber-500 text-white font-medium rounded-lg hover:bg-amber-600 transition-colors flex items-center justify-center gap-2"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              다운로드 (SVG)
            </button>
            <button
              onClick={generateInfographic}
              className="px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors"
            >
              다시 생성
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
