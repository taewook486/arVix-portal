# 2026-02-09: 인포그래픽 디스플레이 수정

## 작업 개요
인포그래픽 생성 기능의 디스플레이 문제들을 수정

## 문제 사항

### 1. 인포그래픽 즉시 표시 안 됨
- **증상**: 생성 버튼을 누르면 생성은 되지만 새로고침 해야 보임
- **원인**: `page.tsx`에서 `data.imageUrl`만 체크하고 있었으나 API는 `data.mermaidCode`를 반환
- **해결**: `data.mermaidCode`를 먼저 체크하도록 로직 수정

### 2. SVG가 늘어나서 텍스트가 왜곡됨
- **증상**: SVG가 너무 넓게 늘어나고 텍스트가 왜곡됨
- **원인**: Mermaid가 `width="100%"` 속성을 추가
- **해결**: `svgElement.removeAttribute('width')`로 속성 제거

### 3. 긴 텍스트가 잘림
- **증상**: `"sGIT (SketchGit): 시각적 버전 제어 아키텍처"`가 `"sGIT (SketchGit): 시각적 버"`로 잘림
- **원인**: `foreignObject` 요소의 너비가 너무 작음 (~200px)
- **해결**: `foreignObject` width를 400으로 증가, 내부 div의 maxWidth도 400px로 수정

## 수정된 파일

### 1. src/app/paper/[id]/page.tsx
```typescript
// 수정 전
if (data.imageUrl) {
  setInfographicUrl(data.imageUrl);
}

// 수정 후
if (data.mermaidCode) {
  setInfographicUrl('mermaid:' + data.mermaidCode);
} else if (data.imageUrl) {
  setInfographicUrl(data.imageUrl);
}
```

### 2. src/components/InfographicGenerator.tsx
```typescript
// SVG width 속성 제거
svgElement.removeAttribute('width');
svgElement.style.display = 'block';
svgElement.style.maxWidth = 'none';

// foreignObject 너비 증가
const foreignObjects = containerRef.current.querySelectorAll('foreignObject');
foreignObjects.forEach((fo: Element) => {
  fo.setAttribute('width', '400');
  const div = fo.querySelector('div');
  if (div) {
    (div as HTMLElement).style.whiteSpace = 'normal';
    (div as HTMLElement).style.wordWrap = 'break-word';
    (div as HTMLElement).style.maxWidth = '400px';
  }
});
```

### 3. src/app/api/infographic/route.ts
- GLM-4.7 모델 유지
- 에러 로깅 강화

## 다음 작업
- 서버 시작 후 테스트
- 다양한 길이의 텍스트로 테스트
- 필요시 너비 추가 조정

## 상태
- ✅ 코드 수정 완료
- ⏳ 테스트 필요
