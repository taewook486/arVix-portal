import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getPaperCache, saveInfographicUrl } from '@/lib/db';

const MERMAID_STYLE = `
Mermaid 다이어그램 스타일 가이드:
- flowchart, graph, mindmap 중 적절한 형식 선택
- 노드 스타일: fill:#f9f,stroke:#333,stroke-width:2px (연한 보라색)
- 중요 노드: fill:#bbf,stroke:#333,stroke-width:2px (연한 파란색)
- 강조 노드: fill:#ff9,stroke:#333,stroke-width:3px (노란색)
- 화살표 스타일: 기본 화살표 사용
- 서브그래프를 사용하여 논리적 그룹화
- 한국어 텍스트 사용
`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, summary, keyPoints, methodology, arxivId, source, forceRegenerate } = body;

    if (!title || !summary || !keyPoints) {
      return NextResponse.json(
        { error: '제목, 요약, 핵심 포인트가 필요합니다' },
        { status: 400 }
      );
    }

    // 캐시된 인포그래픽이 있는지 확인 (forceRegenerate가 true면 스킵)
    if (arxivId && !forceRegenerate) {
      const cache = await getPaperCache(arxivId);
      if (cache?.infographic_url) {
        // 캐시된 URL이 Mermaid 코드 형식인지 확인
        const mermaidCode = cache.infographic_url.startsWith('mermaid:')
          ? cache.infographic_url.replace('mermaid:', '')
          : null;

        if (mermaidCode) {
          return NextResponse.json({
            success: true,
            mermaidCode,
            cached: true,
          });
        }
      }
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY가 설정되지 않았습니다' },
        { status: 500 }
      );
    }

    // 핵심 포인트를 문자열로 변환
    const keyPointsText = keyPoints.map((point: string) => `• ${point}`).join('\n');

    const prompt = `다음 논문 내용을 시각화하는 Mermaid 다이어그램 코드를 생성해주세요.

${MERMAID_STYLE}

논문 정보:
제목: ${title}

요약: ${summary}

핵심 포인트:
${keyPointsText}

방법론: ${methodology || '정보 없음'}

다이어그램 구성 요구사항:
1. 논문의 핵심 구조를 flowchart TD (Top-Down) 또는 LR (Left-Right)로 표현
2. 제목을 최상단 노드로 배치하고 강조 스타일 적용
3. 핵심 포인트들을 주요 노드로 표현하고 논리적 순서로 연결
4. 방법론이 있다면 서브그래프로 구분하여 표현
5. 주요 결과물이나 결론을 하단에 배치
6. 복잡한 내용은 mindmap 형식도 고려

출력 형식:
- Mermaid 코드만 출력 (백틱 제외)
- 유효한 Mermaid 문법 사용
- 한국어 텍스트 포함
- 실제 줄바꿈으로 출력

Mermaid 문법 참고: https://mermaid.js.org/syntax/flowchart.html`;

    // Gemini API 호출
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text().trim();

    // 백틱 블록 제거 (```mermaid 또는 ```)
    text = text.replace(/```mermaid\n?/gi, '');
    text = text.replace(/```\n?/g, '');

    const mermaidCode = text.trim();

    if (!mermaidCode) {
      return NextResponse.json(
        { error: 'Mermaid 코드 생성에 실패했습니다' },
        { status: 500 }
      );
    }

    // DB에 Mermaid 코드 저장 (나중에 사용 가능하도록)
    if (arxivId) {
      const codeToStore = `mermaid:${mermaidCode}`;

      // DB에 저장
      if (source && source !== 'arxiv') {
        await saveInfographicUrl(source, arxivId, codeToStore);
      } else {
        await saveInfographicUrl(arxivId, codeToStore);
      }
    }

    return NextResponse.json({
      success: true,
      mermaidCode,
      cached: false,
    });
  } catch (error) {
    console.error('Mermaid 다이어그램 생성 오류:', error);
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
    return NextResponse.json(
      { error: `Mermaid 다이어그램 생성 중 오류: ${errorMessage}` },
      { status: 500 }
    );
  }
}
