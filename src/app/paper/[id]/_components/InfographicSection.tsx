'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type mermaidAPI from 'mermaid';

interface InfographicSectionProps {
  title: string;
  abstract: string;
  categories: string[];
  authors: string[];
  arxivId: string;
  source?: string;
}

export default function InfographicSection({
  title,
  abstract,
  categories,
  authors,
  arxivId,
  source,
}: InfographicSectionProps) {
  const [diagramCode, setDiagramCode] = useState<string | null>(null);
  const [svgDataUrl, setSvgDataUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const infographicContainerRef = useRef<HTMLDivElement>(null);
  const mermaidRef = useRef<typeof mermaidAPI | null>(null);

  // Initialize Mermaid (dynamic import)
  useEffect(() => {
    let mounted = true;
    import('mermaid').then((mod) => {
      if (mounted) {
        mermaidRef.current = mod.default;
        mod.default.initialize({
          startOnLoad: false,
          theme: 'default',
          securityLevel: 'strict',
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
      }
    });
    return () => { mounted = false; };
  }, []);

  // Load cached diagram
  const loadCachedDiagram = useCallback(async () => {
    try {
      const response = await fetch(`/api/paper-cache?arxivId=${encodeURIComponent(arxivId)}`);
      if (response.ok) {
        const cache = await response.json();
        if (cache.infographic_url) {
          setDiagramCode(cache.infographic_url);
        }
      }
    } catch (err) {
      console.error('인포그래픽 캐시 로드 오류:', err);
    }
  }, [arxivId]);

  useEffect(() => {
    loadCachedDiagram();
  }, [loadCachedDiagram]);

  const generateInfographic = async (forceRegenerate = false) => {
    if (isGenerating) return;
    if (!forceRegenerate && diagramCode) return;

    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch('/api/infographic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          summary: abstract.slice(0, 500),
          keyPoints: [categories.join(', '), `저자: ${authors.slice(0, 3).join(', ')}`],
          source,
          methodology: '',
          arxivId,
          forceRegenerate,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error?.message || '인포그래픽 생성 실패';
        throw new Error(errorMessage);
      }

      const data = await response.json();
      if (data.diagramCode) {
        setDiagramCode(data.diagramCode);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '인포그래픽 생성 중 오류가 발생했습니다';
      console.error('인포그래픽 생성 오류:', err);
      setError(errorMessage);
    } finally {
      setIsGenerating(false);
    }
  };

  // Render Mermaid diagram when code changes
  useEffect(() => {
    const renderDiagram = async () => {
      if (!diagramCode || !infographicContainerRef.current || !mermaidRef.current) return;

      try {
        const id = `mermaid-${Date.now()}`;
        const { svg } = await mermaidRef.current.render(id, diagramCode);

        if (infographicContainerRef.current) {
          infographicContainerRef.current.innerHTML = svg;
          const svgElement = infographicContainerRef.current.querySelector('svg');
          if (svgElement) {
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

            if (!svgElement.getAttribute('viewBox')) {
              const bbox = svgElement.getBBox();
              svgElement.setAttribute('viewBox', `${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}`);
            }

            const svgData = new XMLSerializer().serializeToString(svgElement);
            const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(svgBlob);
            setSvgDataUrl(url);
          }
        }
      } catch (err) {
        console.error('Mermaid render error:', err);
        if (infographicContainerRef.current) {
          const escaped = diagramCode
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
          infographicContainerRef.current.innerHTML = `
            <div class="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p class="text-sm text-red-700 font-medium mb-2">다이어그램 렌더링 실패 (Mermaid 문법 오류)</p>
              <pre class="text-xs bg-gray-100 p-3 rounded overflow-auto max-h-64">${escaped}</pre>
            </div>
          `;
        }
      }
    };

    renderDiagram();
  }, [diagramCode]);

  return (
    <div className="bg-gradient-to-r from-amber-50 to-yellow-50 rounded-lg p-6 border border-amber-200">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
            />
          </svg>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">인포그래픽</h3>
            <p className="text-sm text-gray-600">GLM-5 + Mermaid 다이어그램</p>
          </div>
        </div>
        {diagramCode && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => generateInfographic(true)}
              disabled={isGenerating}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
              title="인포그래픽 재생성"
            >
              <svg className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              재생성
            </button>
            {svgDataUrl && (
              <>
                <button
                  onClick={() => window.open(svgDataUrl, '_blank')}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  title="새 창에서 열기"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  새 창에서 보기
                </button>
                <a
                  href={svgDataUrl}
                  download={`infographic-${Date.now()}.svg`}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-amber-600 hover:text-amber-700 hover:bg-amber-100 rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  다운로드 (SVG)
                </a>
              </>
            )}
          </div>
        )}
      </div>

      {error && (
        <p className="mb-4 text-sm text-red-600">{error}</p>
      )}

      {diagramCode ? (
        <div className="relative rounded-lg border border-amber-200 bg-white p-4" style={{ overflow: 'auto' }}>
          {isGenerating && (
            <div className="absolute inset-0 bg-white/80 flex flex-col items-center justify-center z-10">
              <svg className="animate-spin w-10 h-10 text-amber-600 mb-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <p className="text-gray-700 font-medium">다이어그램 재생성 중...</p>
            </div>
          )}
          <div ref={infographicContainerRef} className="mermaid-container flex items-center justify-center min-h-[400px] p-4" style={{ minWidth: '600px' }} />
        </div>
      ) : (
        <div className="text-center py-10">
          {isGenerating ? (
            <>
              <svg className="animate-spin w-10 h-10 text-amber-600 mx-auto mb-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <p className="text-gray-700 font-medium mb-1">다이어그램 생성 중...</p>
              <p className="text-sm text-gray-500">GLM-5로 Mermaid mindmap 다이어그램을 생성 중입니다</p>
            </>
          ) : (
            <>
              <svg className="w-12 h-12 text-amber-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
              </svg>
              <p className="text-gray-600 mb-4">논문 내용을 시각화한 다이어그램을 생성할 수 있습니다</p>
              <button
                onClick={() => generateInfographic()}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-amber-500 text-white font-medium rounded-lg hover:bg-amber-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                다이어그램 생성
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
