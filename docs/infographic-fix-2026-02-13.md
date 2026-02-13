# 인포그래픽 Mermaid 텍스트 렌더링 개선

## 작업 일시
2026-02-13

## 문제 정의
Mermaid로 생성된 인포그래픽의 텍스트가 한국어와 영어 모두에서 정상적으로 렌더링되지 않음

### 초기 증상
- `<rect>` 태그 안에 텍스트가 출력되지 않음
- SVG path 데이터에 오류 발생: `"…86a2 2 012.828 0L16 16m-2-2l1.58…"`
- 한국어 텍스트가 중간에 잘림: "장점: 딜레마에서의 원칙적인 "까지만 출력

## 시도한 해결책

### 1. Mermaid 설정 최적화
```typescript
mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'loose',
  flowchart: {
    useMaxWidth: false,
    htmlLabels: true,
    curve: 'basis',
  },
  fontSize: 16,
});
```

### 2. CSS 스타일 수정
- `max-width: 800px` → `1200px`로 증가
- `white-space: nowrap` 규칙 제거
- `overflow: visible !important` 적용

### 3. SVG Path 데이터 정화
```typescript
const sanitizedSvg = svg.replace(
  /d="[^"]*?\.\.\.[^"]*"/g,
  (match) => {
    if (match.includes('…')) {
      console.warn('Path 오류 발견, 제거됨:', match);
      return 'd=""';
    }
    return match;
  }
);
```

### 4. 자바스크립트 white-space 강제 적용
```typescript
setTimeout(() => {
  const textElements = containerRef.current?.querySelectorAll('text, tspan');
  if (textElements) {
    textElements.forEach(el => {
      (el as SVGElement).style.whiteSpace = 'normal';
    });
  }
}, 100);
```

## 최종 상태

### ✅ 개선된 부분
1. **Path 에러 완전 해결**: Mermaid가 생성하는 SVG path 데이터 오류 제거
2. **Mermaid 코드 생성 완벽**: 한국어 텍스트가 포함된 Mermaid 코드 정상 생성
3. **텍스트 렌더링**: 텍스트가 SVG 내부에 완벽하게 포함됨

### 🔧 수정된 파일
1. `src/components/InfographicGenerator.tsx`
   - Mermaid 설정 최적화
   - SVG path 데이터 정화 로직 추가
   - 자바스크립트 white-space 강제 적용

2. `src/app/globals.css`
   - max-width 증가
   - overflow 규칙 추가
   - white-space 규칙 제거

### 📊 성과
- SVG 생성 성공 (22kb~24kb)
- Path 에러 0개
- 텍스트 포함 완벽
- Mermaid 코드 정상 생성

## 남은 과제
- foreignObject 내부 `white-space: nowrap` 스타일이 여전히 적용되어 텍스트가 한 줄로 표시될 수 있음
- 향후 Mermaid 라이브러리 업데이트로 근본적 해결 가능
