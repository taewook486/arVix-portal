'use client';

import { useState, useEffect, useCallback } from 'react';
import MarkdownView from '@/components/MarkdownView';

interface AbstractSectionProps {
  abstract: string;
  arxivId: string;
  source?: string;
}

export default function AbstractSection({ abstract, arxivId, source }: AbstractSectionProps) {
  const [translation, setTranslation] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [showOriginal, setShowOriginal] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load cached translation
  const loadCachedTranslation = useCallback(async () => {
    try {
      const response = await fetch(`/api/paper-cache?arxivId=${encodeURIComponent(arxivId)}`);
      if (response.ok) {
        const cache = await response.json();
        if (cache.translation) {
          setTranslation(cache.translation);
        }
      }
    } catch (err) {
      console.error('번역 캐시 로드 오류:', err);
    }
  }, [arxivId]);

  useEffect(() => {
    loadCachedTranslation();
  }, [loadCachedTranslation]);

  const translateAbstract = async () => {
    if (translation) {
      setShowOriginal(false);
      return;
    }

    setIsTranslating(true);
    setError(null);

    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: abstract, arxivId, source }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error?.message || '번역 요청 실패';
        throw new Error(errorMessage);
      }

      const data = await response.json();
      setTranslation(data.translation);
      setShowOriginal(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '번역 중 오류가 발생했습니다';
      console.error('번역 오류:', err);
      setError(errorMessage);
    } finally {
      setIsTranslating(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-gray-900">
          초록 {showOriginal ? '(Abstract)' : '(한국어 번역)'}
        </h2>
        <div className="flex items-center gap-2">
          {translation && (
            <div className="flex rounded-lg overflow-hidden border border-gray-200">
              <button
                onClick={() => setShowOriginal(true)}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  showOriginal
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                원문
              </button>
              <button
                onClick={() => setShowOriginal(false)}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  !showOriginal
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                한국어
              </button>
            </div>
          )}
          {!translation && (
            <button
              onClick={translateAbstract}
              disabled={isTranslating}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
            >
              {isTranslating ? (
                <>
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  번역 중...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                  </svg>
                  한국어로 번역
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {error && (
        <p className="mb-3 text-sm text-red-600">{error}</p>
      )}

      {isTranslating ? (
        <div className="py-8 text-center">
          <svg className="animate-spin w-8 h-8 text-blue-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p className="text-gray-600">GLM AI가 번역 중입니다...</p>
        </div>
      ) : showOriginal ? (
        <p className="text-gray-700 leading-relaxed whitespace-pre-line">{abstract}</p>
      ) : (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-100">
          <MarkdownView content={translation || ''} />
        </div>
      )}
    </div>
  );
}
