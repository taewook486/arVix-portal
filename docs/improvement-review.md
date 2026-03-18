# arVix-portal 코드 개선 검토 보고서

> 작성일: 2026-03-18  
> 대상: arVix-portal 전체 코드베이스  
> 분류: 보안 > 안정성 > 성능 > 구조 순 우선순위

---

## 🔴 P0 — 보안 (즉시 수정 권장)

### 1. 미소유 Google Analytics 트래킹 ID — 사용자 데이터 유출

**파일**: `src/app/layout.tsx:11`

```typescript
const GA_TRACKING_ID = "G-6XV29BG0KR";  // ← 본인이 발급한 ID가 아님
```

**문제**: 발급자가 불분명한 GA 트래킹 ID가 코드에 하드코딩되어 있어, 사이트 방문자의 행동 데이터(페이지뷰, 검색어, 체류시간 등)가 **알 수 없는 제3자의 Google Analytics 계정**으로 전송됨.

**관련 코드** (`layout.tsx:36-47`, `GoogleAnalytics.tsx`):
```typescript
// layout.tsx — <head> 내부에서 GA 스크립트 로드
<Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_TRACKING_ID}`} strategy="afterInteractive" />
<Script id="google-analytics" strategy="afterInteractive">
  {`
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', '${GA_TRACKING_ID}');
  `}
</Script>
// ...
<GoogleAnalytics />  // 추가 GA 컴포넌트도 로드됨
```

**개선안**: GA 관련 코드 전체 제거 또는 본인 ID로 교체

```typescript
// 옵션 A: GA 완전 제거 (layout.tsx에서 아래 삭제)
// - GA_TRACKING_ID 상수
// - <Script> 2개 (gtag 로드 + 설정)
// - <GoogleAnalytics /> 컴포넌트
// - GoogleAnalytics import

// 옵션 B: 본인 GA ID로 교체 후 환경변수화
const GA_TRACKING_ID = process.env.NEXT_PUBLIC_GA_TRACKING_ID;
// .env.local에 NEXT_PUBLIC_GA_TRACKING_ID=G-본인ID 추가
// GA_TRACKING_ID가 없으면 스크립트 미로드하도록 조건 처리
```

---

### 2. SSL 인증서 검증 비활성화

**파일**: `src/lib/db.ts:4-9`

```typescript
// 현재
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') || process.env.DATABASE_URL?.includes('127.0.0.1')
    ? false
    : { rejectUnauthorized: false },  // ← MITM 공격에 노출
});
```

**문제**: `rejectUnauthorized: false`는 Man-in-the-Middle 공격에 취약. 프로덕션에서 DB 자격증명이 탈취될 수 있음.

**개선안**:
```typescript
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') || process.env.DATABASE_URL?.includes('127.0.0.1')
    ? false
    : { rejectUnauthorized: true },  // 프로덕션에서는 인증서 검증 필수
});
```
Supabase/Neon 등 클라우드 DB는 유효한 SSL 인증서를 제공하므로 `true`로 설정해도 정상 동작함. 커스텀 CA 필요 시 `ca` 옵션으로 인증서 지정.

---

### 2. Mermaid XSS 취약점 (securityLevel + innerHTML)

**파일**: `src/app/paper/[id]/page.tsx`

```typescript
// line 43: 보안 수준 느슨하게 설정
mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'loose',  // ← XSS 허용
  // ...
});

// line 241: innerHTML 직접 주입
infographicContainerRef.current.innerHTML = svg;

// line 290-294: 에러 시에도 innerHTML로 사용자 입력(diagramCode) 직접 삽입
infographicContainerRef.current.innerHTML = `
  <div class="...">
    <pre class="...">${diagramCode}</pre>  // ← diagramCode는 AI 생성이지만 escape 없음
  </div>
`;
```

**문제**:
- `securityLevel: 'loose'`는 Mermaid 다이어그램 내 `<script>` 태그 실행 허용
- `innerHTML`로 AI 생성 콘텐츠를 escape 없이 삽입 → XSS 가능성
- AI 생성 Mermaid 코드에 악의적 HTML이 포함될 경우 브라우저에서 실행됨

**개선안**:
```typescript
// 1. securityLevel을 strict로 변경
mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'strict',  // HTML 태그 실행 차단
  // ...
});

// 2. 에러 fallback에서 텍스트 escape
function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (m) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[m] || m));
}

// 에러 시
infographicContainerRef.current.innerHTML = `
  <div class="p-4 bg-red-50 border border-red-200 rounded-lg">
    <p class="text-sm text-red-700 font-medium mb-2">다이어그램 렌더링 실패</p>
    <pre class="text-xs bg-gray-100 p-3 rounded overflow-auto max-h-64">${escapeHtml(diagramCode)}</pre>
  </div>
`;
```

---

### 3. API Rate Limiting 부재

**파일**: 전체 `src/app/api/` 디렉토리

**문제**: 모든 API 라우트에 Rate Limiting이 없음. 특히 아래 엔드포인트는 외부 유료 AI API를 호출하므로 비용 폭발 위험:

| 엔드포인트 | 호출 대상 | 위험도 |
|-----------|----------|--------|
| `POST /api/analyze` | GLM (OpenAI 호환) | 높음 |
| `POST /api/translate` | GLM (OpenAI 호환) | 높음 |
| `POST /api/infographic` | GLM (OpenAI 호환) | 높음 |
| `POST /api/similar-search` | GLM (OpenAI 호환) | 높음 |
| `POST /api/compare` | Gemini API | 높음 |
| `GET /api/arxiv` | GLM (검색 최적화) | 중간 |

**개선안**: Next.js middleware에서 IP 기반 Rate Limiting 적용:

```typescript
// src/middleware.ts
import { NextRequest, NextResponse } from 'next/server';

const rateLimit = new Map<string, { count: number; resetTime: number }>();

const RATE_LIMIT = {
  '/api/analyze': { maxRequests: 10, windowMs: 60_000 },
  '/api/translate': { maxRequests: 20, windowMs: 60_000 },
  '/api/infographic': { maxRequests: 5, windowMs: 60_000 },
  '/api/similar-search': { maxRequests: 10, windowMs: 60_000 },
  '/api/compare': { maxRequests: 5, windowMs: 60_000 },
} as const;

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const config = Object.entries(RATE_LIMIT).find(([path]) => pathname.startsWith(path));

  if (!config) return NextResponse.next();

  const [, { maxRequests, windowMs }] = config;
  const ip = request.headers.get('x-forwarded-for') || 'unknown';
  const key = `${ip}:${pathname}`;
  const now = Date.now();

  const entry = rateLimit.get(key);
  if (!entry || now > entry.resetTime) {
    rateLimit.set(key, { count: 1, resetTime: now + windowMs });
    return NextResponse.next();
  }

  if (entry.count >= maxRequests) {
    return NextResponse.json(
      { error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((entry.resetTime - now) / 1000)) } }
    );
  }

  entry.count++;
  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
```

> **참고**: 프로덕션에서는 Vercel의 Edge Config나 Upstash Redis 기반 Rate Limiting을 권장.

---

### 4. next.config.ts 보안 헤더 미설정

**파일**: `next.config.ts` (현재 빈 설정)

```typescript
// 현재
const nextConfig: NextConfig = {
  /* config options here */
};
```

**개선안**:
```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self'",
              "connect-src 'self' https://www.google-analytics.com",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
```

---

## 🟠 P1 — 안정성 (1주 내 수정 권장)

### 6. 에러가 조용히 삼켜지는 패턴 (Silent Error Swallowing)

**파일**: `src/lib/db.ts` — 7개 함수에서 에러 무시

에러가 발생해도 `null`, `false`, `[]`만 반환하여 원인 추적이 불가능한 패턴:

```typescript
// ❌ 현재 패턴 — 7개 함수 모두 동일
export async function addBookmark(paper: Paper, aiSummary?: string): Promise<Bookmark | null> {
  const client = await pool.connect();
  try {
    // ...
  } catch {          // ← 에러 객체 안 받음
    return null;      // ← 왜 실패했는지 알 수 없음
  } finally {
    client.release();
  }
}
```

**영향받는 함수들**:
| 함수 | 라인 | 반환값 |
|------|------|--------|
| `addBookmark` | 112 | `null` |
| `removeBookmark` | 137 | `false` |
| `getBookmarks` | 152 | `[]` |
| `isBookmarked` | 176 | `false` |
| `getBookmarkByArxivId` | 192 | `null` |
| `updateAISummary` | 217 | `false` |
| `getPaperCache` | 307 | `null` |

**개선안**: 프로젝트에 이미 `logError` 유틸리티가 존재하므로 활용:
```typescript
import { logError } from '@/lib/errors';

export async function addBookmark(paper: Paper, aiSummary?: string): Promise<Bookmark | null> {
  const client = await pool.connect();
  try {
    // ...
  } catch (error) {
    logError('db.addBookmark', error);  // 에러 로깅
    return null;
  } finally {
    client.release();
  }
}
```

---

### 7. 에러 응답 형식 불일치

**문제**: 프로젝트에 `errors.ts`로 표준화된 에러 시스템이 있지만, 9개 API 라우트 중 3개만 사용:

| 라우트 | 에러 시스템 사용 | 응답 형식 |
|--------|----------------|-----------|
| `analyze/route.ts` | ✅ `createErrorResponse` | `{ success: false, error: { code, message } }` |
| `translate/route.ts` | ✅ `createErrorResponse` | `{ success: false, error: { code, message } }` |
| `infographic/route.ts` | ✅ `createErrorResponse` | `{ success: false, error: { code, message } }` |
| `papers/route.ts` | ❌ 직접 반환 | `{ error: '문자열' }` |
| `bookmarks/route.ts` | ❌ 직접 반환 | `{ error: '문자열' }` |
| `paper-cache/route.ts` | ❌ 직접 반환 | `{ error: '문자열' }` |
| `arxiv/route.ts` | ❌ 직접 반환 | `{ error: '문자열' }` |
| `similar-search/route.ts` | ❌ 직접 반환 | `{ error: '문자열' }` |
| `compare/route.ts` | ❌ 직접 반환 | `{ error: '문자열' }` |

**추가 발견**: `errors.ts`에 `withErrorHandler` 래퍼 함수가 정의되어 있지만 **어디에서도 사용되지 않음**:
```typescript
// src/lib/errors.ts:170-186 — 미사용 코드
export function withErrorHandler<T extends NextRequest>(
  handler: (request: T) => Promise<NextResponse>,
  context: string = 'API'
): (request: T) => Promise<NextResponse> {
  return async (request: T): Promise<NextResponse> => {
    try {
      return await handler(request);
    } catch (error) {
      logError(context, error);
      const appError = toAppError(error);
      return NextResponse.json(createErrorResponse(appError), { status: appError.statusCode });
    }
  };
}
```

**개선안**: 미사용 라우트에 `withErrorHandler` 적용:

```typescript
// 예: src/app/api/bookmarks/route.ts
import { withErrorHandler } from '@/lib/errors';

export const GET = withErrorHandler(async (request: NextRequest) => {
  // try/catch 없이 비즈니스 로직만 작성
  const searchParams = request.nextUrl.searchParams;
  // ...
  return NextResponse.json(bookmarks);
}, 'Bookmarks GET');
```

---

### 8. 환경변수 검증 부재

**문제**: 필수 환경변수 누락 시 런타임에서야 에러 발생. 앱 시작 시 즉시 실패(fail fast)하지 않음.

**현재 상태**:
| 파일 | 환경변수 | 검증 방식 |
|------|---------|----------|
| `db.ts:5` | `DATABASE_URL` | 없음 (undefined면 pg가 런타임 에러) |
| `glm.ts:14` | `OPENAI_API_KEY` | `console.warn`만 출력 |
| `glm.ts:15` | `OPENAI_BASE_URL` | 없음 |
| `compare/route.ts:4` | `GEMINI_API_KEY` | 없음 (빈 문자열로 초기화) |
| `layout.tsx` | GA 트래킹 ID | 하드코딩 (P0-1 참조) |

**개선안**: Zod로 서버 사이드 환경변수 검증 스키마 추가 (이미 Zod 의존성 있음):

```typescript
// src/lib/env.ts
import { z } from 'zod';

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY is required'),
  OPENAI_BASE_URL: z.string().url().optional(),
  GEMINI_API_KEY: z.string().min(1, 'GEMINI_API_KEY is required'),
});

const clientEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  NEXT_PUBLIC_GA_TRACKING_ID: z.string().optional(),
});

export const serverEnv = serverEnvSchema.parse(process.env);
export const clientEnv = clientEnvSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_GA_TRACKING_ID: process.env.NEXT_PUBLIC_GA_TRACKING_ID,
});
```

각 모듈에서 `process.env` 직접 접근 대신 `serverEnv.DATABASE_URL` 사용.

---

### 9. 중복된 코드 (tryModels, OpenAI 클라이언트)

**문제**: 동일한 로직이 3곳에 별도로 구현되어 있음:

| 파일 | 중복 내용 | 라인 |
|------|----------|------|
| `src/lib/glm.ts` | `tryModels`, `GLM_MODELS`, `glmClient` | 22-86 |
| `src/lib/ai.ts` | `tryModels` (별도 구현), `MODELS`, `getOpenAIClient()` 매 호출 | 16-38 |
| `src/app/api/similar-search/route.ts` | `tryModels` (3번째 복사), `MODELS`, `openai` 인스턴스 | 4-35 |

**구체적 차이**:
```typescript
// glm.ts — 모듈 레벨 싱글턴 (효율적)
export const glmClient = new OpenAI({ apiKey, baseURL });

// ai.ts — 매 함수 호출마다 새 인스턴스 (비효율)
function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY || '';
  const baseURL = process.env.OPENAI_BASE_URL;
  return new OpenAI({ apiKey, baseURL });  // 매번 생성
}

// similar-search/route.ts — 파일 레벨 별도 인스턴스 + tryModels 복붙
const openai = new OpenAI({ apiKey, baseURL });
async function tryModels<T>(...) { ... }  // glm.ts와 동일 로직
```

**개선안**: `ai.ts`와 `similar-search/route.ts`에서 `glm.ts`의 공유 유틸 사용:

```typescript
// src/lib/ai.ts — 개선
import { glmClient, tryGLMModels } from '@/lib/glm';

export async function analyzePaper(title: string, abstract: string): Promise<AIAnalysis> {
  // getOpenAIClient() 제거, glmClient 사용
  const result = await tryGLMModels(async (model) => {
    return await glmClient.chat.completions.create({ model, messages: [...], temperature: 0.7 });
  });
  // ...
}
```

```typescript
// src/app/api/similar-search/route.ts — 개선
import { glmClient, tryGLMModels } from '@/lib/glm';
// ↑ 파일 내 OpenAI 인스턴스, MODELS, tryModels 함수 모두 제거

export async function POST(request: NextRequest) {
  // ...
  const result = await tryGLMModels(async (model) => {
    return await glmClient.chat.completions.create({ model, messages: [...] });
  });
  // ...
}
```

---

### 10. DB 함수에서 매번 pool.connect() 사용

**파일**: `src/lib/db.ts` — 모든 함수

**문제**: 트랜잭션이 필요 없는 단순 쿼리에서도 매번 `pool.connect()` → `client.release()` 패턴 사용:

```typescript
// 현재 — 모든 함수에서 반복
export async function getBookmarks(): Promise<Bookmark[]> {
  const client = await pool.connect();  // connection pool에서 꺼냄
  try {
    const result = await client.query('SELECT * FROM bookmarks ORDER BY created_at DESC');
    return result.rows;
  } catch {
    return [];
  } finally {
    client.release();  // 다시 반납
  }
}
```

**개선안**: 단순 쿼리는 `pool.query()` 직접 사용 (내부적으로 connect/release 자동 처리):

```typescript
// 개선 — 단순 쿼리
export async function getBookmarks(): Promise<Bookmark[]> {
  try {
    const result = await pool.query('SELECT * FROM bookmarks ORDER BY created_at DESC');
    return result.rows;
  } catch (error) {
    logError('db.getBookmarks', error);
    return [];
  }
}

// 트랜잭션 필요 시에만 pool.connect() 사용
export async function complexOperation() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // 여러 쿼리 ...
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
```

**영향**: `initDatabase()`, `initPaperCacheTable()` (여러 DDL 실행)만 `pool.connect()` 유지, 나머지 10개 함수는 `pool.query()`로 변환 가능.

---

## 🟡 P2 — 성능 (2주 내 검토 권장)

### 11. 메인 페이지 전체가 Client Component

**파일**: `src/app/page.tsx:1`

```typescript
'use client';  // ← 전체 페이지가 CSR
```

**문제**: Next.js App Router의 SSR/SSG 이점을 전혀 활용하지 못함. 헤더, 카테고리 필터 등 정적 요소까지 클라이언트에서 렌더링.

**개선 방향**: 페이지를 Server/Client로 분리:
```
page.tsx (Server Component)
├── 헤더 섹션 (정적 — Server)
├── SearchSection.tsx ('use client' — 검색 상호작용)
│   ├── SearchBar.tsx
│   └── CategoryFilter.tsx
└── PaperList.tsx ('use client' — 결과 표시)
```

---

### 12. paper/[id]/page.tsx — 705줄 단일 컴포넌트

**파일**: `src/app/paper/[id]/page.tsx` — 705줄

**문제**: 번역, 인포그래픽, 유사 논문, AI 분석, 논문 상세정보가 모두 하나의 컴포넌트에 있음. 유지보수 어렵고 리렌더링 범위가 넓음.

**개선안**: 기능별 컴포넌트로 분리:
```
paper/[id]/page.tsx (~100줄, 데이터 로드 + 레이아웃)
├── PaperInfo.tsx (제목, 저자, 카테고리, 링크)
├── AbstractSection.tsx (초록 + 번역 토글)
├── AIAnalysis.tsx (이미 존재)
└── InfographicSection.tsx (Mermaid 다이어그램)
```

---

### 13. Mermaid 정적 import (~2MB 번들)

**파일**: `src/app/paper/[id]/page.tsx:11`

```typescript
import mermaid from 'mermaid';  // ← ~2MB 번들에 포함
```

**개선안**: dynamic import로 필요 시에만 로드:
```typescript
// 컴포넌트 내부에서
useEffect(() => {
  let mounted = true;
  import('mermaid').then((mod) => {
    if (mounted) {
      mod.default.initialize({ ... });
    }
  });
  return () => { mounted = false; };
}, []);
```

---

### 14. PaperCard에 React.memo 미적용

**파일**: `src/components/PaperCard.tsx`

**문제**: `PaperList`에서 20개 이상 렌더링되는 카드 컴포넌트인데, 검색어 입력이나 카테고리 변경 시 모든 카드가 불필요하게 리렌더링됨.

**개선안**:
```typescript
import { memo } from 'react';

function PaperCard({ paper }: PaperCardProps) {
  // ...
}

export default memo(PaperCard);
```

---

### 15. formatDate 중복 정의

**파일**: 2곳에 동일 함수 별도 정의

```typescript
// src/components/PaperCard.tsx:46-53
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' });
};

// src/app/paper/[id]/page.tsx:303-310
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
};
```

**개선안**: `src/lib/utils.ts` 또는 `src/lib/format.ts`로 통합:
```typescript
export function formatDate(dateString: string, style: 'short' | 'long' = 'short'): string {
  return new Date(dateString).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: style === 'short' ? 'short' : 'long',
    day: 'numeric',
  });
}
```

---

## 📋 체크리스트 요약

| # | 항목 | 우선순위 | 난이도 | 예상 소요 |
|---|------|---------|--------|----------|
| 1 | 미소유 GA ID 제거/교체 | P0 | 쉬움 | 10분 |
| 2 | SSL 인증서 검증 활성화 | P0 | 쉬움 | 5분 |
| 3 | Mermaid XSS 수정 | P0 | 보통 | 30분 |
| 4 | Rate Limiting 추가 | P0 | 보통 | 1시간 |
| 5 | 보안 헤더 설정 | P0 | 쉬움 | 15분 |
| 6 | Silent catch 에러 로깅 추가 | P1 | 쉬움 | 30분 |
| 7 | 에러 응답 형식 통일 | P1 | 보통 | 1시간 |
| 8 | 환경변수 Zod 검증 | P1 | 보통 | 30분 |
| 9 | tryModels/OpenAI 클라이언트 통합 | P1 | 쉬움 | 30분 |
| 10 | pool.query() 전환 | P1 | 쉬움 | 30분 |
| 11 | 메인 페이지 Server/Client 분리 | P2 | 높음 | 2시간 |
| 12 | paper/[id] 컴포넌트 분리 | P2 | 높음 | 2시간 |
| 13 | Mermaid dynamic import | P2 | 쉬움 | 15분 |
| 14 | PaperCard memo 적용 | P2 | 쉬움 | 5분 |
| 15 | formatDate 유틸 통합 | P2 | 쉬움 | 10분 |

---

## 향후 검토 고려 사항 (이 문서 범위 밖)

- **다크모드**: CSS 변수는 정의되어 있으나 컴포넌트에서 미사용
- **접근성(a11y)**: aria-label, aria-live, 키보드 내비게이션 보강
- **API 라우트 테스트**: 현재 전무 — 비즈니스 로직 검증 격차
- **README 업데이트**: "Next.js 14" → "Next.js 16" 수정
- **인라인 DDL/마이그레이션**: `initDatabase()` 등 → 정식 마이그레이션 도구 전환
