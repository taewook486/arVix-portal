import { Suspense } from 'react';
import HomeContent from '@/components/HomeContent';

export const metadata = {
  title: 'arXiv 논문 포털',
  description: 'AI 연구 논문을 검색하고, 분석하고, 관리하세요',
};

function HomeLoading() {
  return (
    <>
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-gray-200 rounded"></div>
          <div className="h-8 bg-gray-200 rounded w-3/4"></div>
        </div>
      </div>
    </>
  );
}

export default function Home() {
  return (
    <div className="space-y-6">
      {/* 서버 렌더링 — 정적 헤더 */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">arXiv 논문 포털</h1>
        <p className="text-gray-600">AI 연구 논문을 검색하고, 분석하고, 관리하세요</p>
      </div>

      {/* 클라이언트 경계 — useSearchParams 래핑용 Suspense */}
      <Suspense fallback={<HomeLoading />}>
        <HomeContent />
      </Suspense>
    </div>
  );
}
