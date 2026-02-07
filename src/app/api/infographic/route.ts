import { NextRequest, NextResponse } from 'next/server';
import { getPaperCache, saveInfographicUrl } from '@/lib/db';

const MERMAID_STYLE = `
Mermaid 다이어그램 스타일 가이드:
- flowchart TD (Top-Down) 또는 LR (Left-Right) 형식 사용
- 노드 스타일은 직접 지정: NodeName["텍스트"]
- 화살표: A --> B
- 서브그래프: subgraph 그룹이름 end

중요: classDef와 클래스 사용만 허용
- classDef importantNode fill:#ff9,stroke:#333,stroke-width:3px
- class Node1,Node2 importantNode

금지 문법:
- 노드 텍스트 뒤에 ::: 스타일 사용 금지
- 복잡한 스타일 표기법 지양
- 특수 문자가 포함된 텍스트는 따옴표로 감싸기

한국어 텍스트 사용: 텍스트에 특수문자가 있으면 큰따옴표(" ") 사용
예: A["AgenticPay 프레임워크 구성"]
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
            mermaidCode: mermaidCode,
            cached: true,
          });
        }
      }
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY가 설정되지 않았습니다' },
        { status: 500 }
      );
    }

    // Debug logging
    console.log('=== Environment Variables Debug ===');
    console.log('OPENAI_API_KEY exists:', !!process.env.OPENAI_API_KEY);
    console.log('OPENAI_API_KEY length:', process.env.OPENAI_API_KEY?.length || 0);
    console.log('OPENAI_API_KEY prefix:', process.env.OPENAI_API_KEY?.substring(0, 10) || 'N/A');
    console.log('OPENAI_BASE_URL:', process.env.OPENAI_BASE_URL);
    console.log('=====================================');

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
1. flowchart TD (Top-Down) 형식 사용
2. 제목을 최상단 노드로 배치
3. 핵심 포인트들을 주요 노드로 표현하고 논리적 순서로 연결
4. 방법론이 있다면 서브그래프로 구분하여 표현
5. 주요 결과물이나 결론을 하단에 배치

유효한 Mermaid 문법 예시:
\`\`\`
flowchart TD
    A["논문 제목"]:::important
    B["핵심 개념 1"] --> C["핵심 개념 2"]
    C --> D["결론"]

    classDef importantNode fill:#ff9,stroke:#333,stroke-width:3px
    class A importantNode
\`\`\`

출력 형식:
- Mermaid 코드만 출력 (백틱 코드 블록 제외)
- flowchart TD로 시작
- classDef는 코드 하단에 한 번만 정의
- 특수문자가 있는 텍스트는 반드시 따옴표로 감싸기
- 실제 줄바꿈으로 출력`;

    // z.ai API 호출 (OpenAI 호환)
    const response = await fetch(`${process.env.OPENAI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'GLM-4.7',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('z.ai API 오류:', errorText);
      return NextResponse.json(
        { error: 'Mermaid 코드 생성에 실패했습니다' },
        { status: 500 }
      );
    }

    const data = await response.json();
    let text = data.choices[0].message.content?.trim() || '';

    // 백틱 블록 제거 (```mermaid 또는 ```)
    text = text.replace(/```mermaid\n?/gi, '');
    text = text.replace(/```\n?/g, '');

    // 불필요한 텍스트 제거 (AI가 추가한 설명 등)
    text = text.replace(/^Here's the mermaid code:?$/im, '');
    text = text.replace(/^다음은 Mermaid 코드입니다:?$/im, '');
    text = text.replace(/^Mermaid code:?$/im, '');

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
      mermaidCode: mermaidCode,
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
