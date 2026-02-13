# 2026-02-13: 인포그래픽 및 API 수정 작업 로그

## 작업 개요

GLM 모델 통합 및 Mermaid 인포그래픽 기능 개선 작업

## 수정된 파일 목록

### API Routes
- `src/app/api/similar-search/route.ts` - Google Generative AI SDK에서 OpenAI SDK(GLM)로 변경
- `src/app/api/infographic/route.ts` - Mermaid 다이어그램 생성 API (GLM-5 사용)

### 컴포넌트
- `src/app/paper/[id]/page.tsx` - 인포그래픽 렌더링 및 SVG 내보내기 기능 추가
- `src/components/InfographicGenerator.tsx` - 인포그래픽 생성 컴포넌트 개선

### 스타일
- `src/app/globals.css` - Mermaid 다이어그램 텍스트 잘림 방지 스타일 추가

## 주요 변경 사항

### 1. Similar Search API 수정

**문제**: `POST /api/similar-search` 500 에러
**원인**: Google Generative AI SDK 사용으로 환경 변수 불일치
**해결**: OpenAI SDK로 변경하여 GLM 모델 사용

```typescript
// 변경 전: Google Generative AI SDK
import { GoogleGenerativeAI } from '@google/generative-ai';
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// 변경 후: OpenAI SDK (GLM 호환)
import OpenAI from 'openai';
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
  baseURL: process.env.OPENAI_BASE_URL,
});
```

### 2. SVG 보기 기능 추가

**기능**: 생성된 인포그래픽을 새 창에서 볼 수 있는 버튼 추가

```typescript
// 새 창에서 보기 버튼
<button
  onClick={() => svgDataUrl && window.open(svgDataUrl, '_blank')}
  disabled={!svgDataUrl}
>
  새 창에서 보기
</button>
```

### 3. Mermaid 설정 최적화

**문제**: mindmap 원형 노드에서 긴 텍스트가 잘림
**해결**: Mermaid 초기화 설정 조정

```typescript
mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'loose',
  themeVariables: {
    fontSize: '14px',        // 16px에서 축소
    fontFamily: 'Arial, sans-serif',
    maxTextWidth: 500,       // 추가
  },
  mindmap: {
    padding: 15,             // 추가
    useMaxWidth: true,       // 추가
  },
});
```

### 4. SVG 인라인 스타일 추가

새 창에서도 동일한 스타일로 렌더링되도록 SVG에 인라인 스타일 주입

```typescript
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
```

### 5. 글로벌 CSS 스타일 추가

```css
/* Mermaid Diagram Styles */
.mermaid {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
}

.mermaid svg {
  max-width: 100%;
  height: auto;
  overflow: visible !important;
}

/* Fix text truncation in mindmap nodes */
.mermaid .mindmapNode,
.mermaid .node,
.mermaid g.node rect,
.mermaid g.node polygon,
.mermaid g.node circle,
.mermaid g.node path {
  overflow: visible !important;
}

/* Ensure text in nodes is not clipped */
.mermaid .mindmapNode text,
.mermaid g.node text,
.mermaid span {
  overflow: visible !important;
  text-overflow: clip !important;
  white-space: normal !important;
}

.mermaid-container {
  overflow: visible !important;
  width: 100%;
}

.mermaid text {
  line-height: 1.4;
}
```

## 사용자 피드백 및 결정

### mindmap vs graph TD
- **요청**: "가운데 만들어진 원에 들어가는 글자가 짤리는데? 그냥 사각형으로 바꾸는게 좋겠다"
- **구현**: mindmap → graph TD (사각형 노드)로 변경
- **피드백**: "바꾸기 전으로 돌려줘. 더 이해하기 어렵게 되었어"
- **결정**: mindmap 형식 유지, 텍스트 표시 개선으로 해결

## 기술 스택

- **AI 모델**: GLM-5, GLM-4.7, GLM-4.7-Flash (순차적 fallback)
- **API SDK**: OpenAI SDK (Zhipu AI GLM 호환)
- **시각화**: Mermaid.js (mindmap 형식)
- **프레임워크**: Next.js 16.1.5 with Turbopack
- **데이터베이스**: PostgreSQL (SSL 설정)

## 배포 환경

- **호스팅**: Vercel
- **데이터베이스**: Supabase PostgreSQL
- **AI API**: Zhipu AI (https://api.z.ai/api/coding/paas/v4)

## 알려진 제한 사항

- mindmap 원형 노드에서 매우 긴 텍스트는 여전히 잘릴 수 있음
- fontSize 축소(14px), maxTextWidth, padding 설정으로 partly 해결
- 사용자는 mindmap 형식을 선호하여 사각형 노드로 변경하지 않음

## 환경 변수 설정 (2026-02-14)

### 로컬 개발 환경 (.env.local)

**문제**: `OPENAI_API_KEY`가 설정되지 않아 AI 분석 기능 작동하지 않음
**해결**: Zhipu AI GLM Coding Plan용 환경 변수 설정

```env
OPENAI_API_KEY="d0298e340b9b40c790a9e6c7160b367c.LCdGc3DPrg7Gh30J"
OPENAI_BASE_URL="https://api.z.ai/api/coding/paas/v4/"
```

**변경 사항**:
- 일반 GLM API 엔드포인트(`https://open.bigmodel.cn/api/paas/v4/`) 아닌 Coding Plan 전용 엔드포인트 사용
- Zhipu AI 문서 참고: https://docs.z.ai
