'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, Suspense } from 'react';

const GA_TRACKING_ID = 'G-6XV29BG0KR';

declare global {
  interface Window {
    gtag: (command: string, ...args: unknown[]) => void;
  }
}

function AnalyticsTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (typeof window.gtag !== 'undefined') {
      const url = pathname + (searchParams.toString() ? `?${searchParams.toString()}` : '');

      // 페이지뷰 전송
      window.gtag('config', GA_TRACKING_ID, {
        page_path: url,
        page_title: document.title,
      });
    }
  }, [pathname, searchParams]);

  return null;
}

export default function GoogleAnalytics() {
  return (
    <Suspense fallback={null}>
      <AnalyticsTracker />
    </Suspense>
  );
}

// 커스텀 이벤트 추적 함수
export function trackEvent(action: string, category: string, label?: string, value?: number) {
  if (typeof window.gtag !== 'undefined') {
    window.gtag('event', action, {
      event_category: category,
      event_label: label,
      value: value,
    });
  }
}
