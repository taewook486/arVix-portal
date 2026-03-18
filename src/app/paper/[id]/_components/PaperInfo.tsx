'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Paper, getCategoryName } from '@/types/paper';
import BookmarkButton from '@/components/BookmarkButton';
import SourceBadge from '@/components/SourceBadge';
import { formatDate } from '@/lib/format';

interface PaperInfoProps {
  paper: Paper;
}

export default function PaperInfo({ paper }: PaperInfoProps) {
  const router = useRouter();
  const [isFindingSimilar, setIsFindingSimilar] = useState(false);

  const findSimilarPapers = async () => {
    if (isFindingSimilar) return;

    setIsFindingSimilar(true);
    try {
      const response = await fetch('/api/similar-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: paper.title,
          abstract: paper.abstract,
          categories: paper.categories,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.searchQuery) {
          router.push(`/?q=${encodeURIComponent(data.searchQuery)}`);
        }
      }
    } catch (err) {
      console.error('유사 논문 검색 오류:', err);
    } finally {
      setIsFindingSimilar(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6 space-y-4">
      {/* 제목 및 북마크 */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <SourceBadge source={paper.source} size="md" />
            <span className="text-sm font-mono text-gray-400">
              {paper.source === 'arxiv' ? `arXiv:${paper.sourceId}` : `ID:${paper.sourceId}`}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 leading-tight">{paper.title}</h1>
        </div>
        <BookmarkButton paper={paper} size="lg" />
      </div>

      {/* 저자 */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 mb-1">저자</h2>
        <p className="text-gray-700">{paper.authors.join(', ')}</p>
      </div>

      {/* 날짜 */}
      <div className="flex gap-6 text-sm">
        <div>
          <span className="font-semibold text-gray-500">게시일: </span>
          <span className="text-gray-700">{formatDate(paper.publishedAt, 'long')}</span>
        </div>
        <div>
          <span className="font-semibold text-gray-500">수정일: </span>
          <span className="text-gray-700">{formatDate(paper.updatedAt, 'long')}</span>
        </div>
      </div>

      {/* 카테고리 */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 mb-2">카테고리</h2>
        <div className="flex flex-wrap gap-2">
          {paper.categories.map((category) => (
            <span
              key={category}
              className="px-3 py-1 text-sm font-medium bg-blue-50 text-blue-700 rounded-full"
              title={category}
            >
              {getCategoryName(category)}
            </span>
          ))}
        </div>
      </div>

      {/* 링크들 */}
      <div className="flex gap-4 pt-2">
        <a
          href={paper.pdfUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          PDF 다운로드
        </a>
        <a
          href={paper.arxivUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
            />
          </svg>
          arXiv에서 보기
        </a>
        <button
          onClick={findSimilarPapers}
          disabled={isFindingSimilar}
          className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isFindingSimilar ? (
            <>
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              검색 중...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16l2.879-2.879m0 0a3 3 0 104.243-4.242 3 3 0 00-4.243 4.242zM21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              유사 논문 찾기
            </>
          )}
        </button>
      </div>
    </div>
  );
}
