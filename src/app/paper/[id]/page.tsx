'use client';

import { useState, useEffect, use, useCallback } from 'react';
import Link from 'next/link';
import { Paper } from '@/types/paper';
import AIAnalysis from '@/components/AIAnalysis';
import PaperInfo from './_components/PaperInfo';
import AbstractSection from './_components/AbstractSection';
import InfographicSection from './_components/InfographicSection';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function PaperDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const [paper, setPaper] = useState<Paper | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPaper = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const decodedId = decodeURIComponent(id);
      let source = 'arxiv';
      let paperId = decodedId;

      if (decodedId.includes(':')) {
        [source, paperId] = decodedId.split(':', 2);
      }

      const response = await fetch(`/api/papers?action=get&source=${source}&id=${encodeURIComponent(paperId)}`);

      if (!response.ok) {
        throw new Error('논문을 찾을 수 없습니다');
      }

      const data = await response.json();
      setPaper(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '논문을 불러오는 중 오류가 발생했습니다');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadPaper();
  }, [loadPaper]);

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-3/4" />
          <div className="h-4 bg-gray-100 rounded w-1/2" />
          <div className="flex gap-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-6 bg-blue-100 rounded w-16" />
            ))}
          </div>
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-4 bg-gray-100 rounded w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !paper) {
    return (
      <div className="max-w-4xl mx-auto text-center py-12">
        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <h2 className="mt-4 text-xl font-semibold text-gray-900">{error || '논문을 찾을 수 없습니다'}</h2>
        <Link href="/" className="mt-4 inline-block text-blue-600 hover:text-blue-700">
          홈으로 돌아가기
        </Link>
      </div>
    );
  }

  const paperArxivId = paper.arxivId || paper.sourceId;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* 뒤로가기 */}
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        검색으로 돌아가기
      </Link>

      <PaperInfo paper={paper} />

      <AbstractSection
        abstract={paper.abstract}
        arxivId={paperArxivId}
        source={paper.source}
      />

      <AIAnalysis
        title={paper.title}
        abstract={paper.abstract}
        arxivId={paperArxivId}
        source={paper.source}
      />

      <InfographicSection
        title={paper.title}
        abstract={paper.abstract}
        categories={paper.categories}
        authors={paper.authors}
        arxivId={paperArxivId}
        source={paper.source}
      />
    </div>
  );
}
