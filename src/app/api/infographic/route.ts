import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getPaperCache, saveInfographicUrl } from '@/lib/db';

const apiKey = process.env.OPENAI_API_KEY || '';
const baseURL = process.env.OPENAI_BASE_URL;

const openai = new OpenAI({
  apiKey,
  baseURL,
});

// Available models in fallback order
const MODELS = ['glm-5', 'glm-4.7', 'glm-4.7-Flash'] as const;

// Helper function to try models in order
async function tryModels<T>(
  models: readonly string[],
  fn: (model: string) => Promise<T>
): Promise<T> {
  const errors: Array<{ model: string; error: unknown }> = [];

  for (const model of models) {
    try {
      console.log(`[AI] Trying model: ${model}`);
      return await fn(model);
    } catch (error) {
      console.error(`[AI] Model ${model} failed:`, error);
      errors.push({ model, error });
    }
  }

  throw new Error(
    `All models failed:\n${errors.map(e => `- ${e.model}: ${e.error}`).join('\n')}`
  );
}

// GET: 캐시된 인포그래픽 조회
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const arxivId = searchParams.get('arxivId');

  if (!arxivId) {
    return NextResponse.json({ error: 'arxivId가 필요합니다' }, { status: 400 });
  }

  try {
    const cache = await getPaperCache(arxivId);
    if (cache?.infographic_url) {
      return NextResponse.json({
        success: true,
        diagramCode: cache.infographic_url,
        cached: true,
      });
    }
    return NextResponse.json({ success: false, diagramCode: null });
  } catch (error) {
    console.error('캐시 조회 오류:', error);
    return NextResponse.json({ error: '캐시 조회 실패' }, { status: 500 });
  }
}

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
        return NextResponse.json({
          success: true,
          diagramCode: cache.infographic_url,
          cached: true,
        });
      }
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY가 설정되지 않았습니다' },
        { status: 500 }
      );
    }

    // 핵심 포인트를 문자열로 변환
    const keyPointsText = keyPoints.map((point: string) => `- ${point}`).join('\n');

    // GLM-5로 Mermaid 다이어그램 코드 생성
    const prompt = `당신은 학술 논문 시각화 전문가입니다. 다음 논문 내용을 Mermaid mindmap 다이어그램으로 변환해주세요.

논문 정보:
제목: ${title}

요약: ${summary}

핵심 포인트:
${keyPointsText}

방법론: ${methodology || '정보 없음'}

IMPORTANT - Mermaid mindmap 문법 규칙:
1. mindmap으로 시작
2. 루트 노드는 ((논문 제목))
3. 하위 레벨은 2칸 들여쓰기로 표시
4. 내용에 따옴표 사용 금지 - 그냥 텍스트만 작성
5. 각 줄 끝에 불필요한 공백 없음

정확한 출력 형식:
mindmap
  root((논문 제목))
    요약
      ::icon(fa fa-book)
      요약 내용
    핵심 포인트
      ::icon(fa fa-lightbulb)
      첫번째 포인트
      두번째 포인트
    방법론
      ::icon(fa fa-cogs)
      방법론 내용

위 형식을 정확히 따르세요. mindmap 다이어그램 코드만 출력:`;

    const result = await tryModels(MODELS, async (model) => {
      return await openai.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
      });
    });

    const mermaidCode = result.choices[0]?.message?.content?.trim() || '';

    // Clean up markdown code blocks if present
    let cleanedCode = mermaidCode
      .replace(/```mermaid\n?/g, '')
      .replace(/```\n?/g, '')
      .replace(/```yaml\n?/g, '')
      .trim();

    // Additional sanitization for Mermaid mindmap syntax
    // Remove quotes from content (Mermaid mindmap doesn't like them in leaf nodes)
    // Fix common syntax issues
    cleanedCode = cleanedCode
      // Remove quotes around content in leaf nodes
      .replace(/^(\s+)\[?"(.+)"\]$/gm, '$1$2')
      // Remove quotes around content with : prefix
      .replace(/^(\s+)\[?"(.+)"\]?\s*$/gm, '$1$2')
      // Fix common issues with parentheses
      .replace(/\(\(/g, '((')
      .replace(/\)\)/g, '))')
      // Remove trailing spaces
      .replace(/[ \t]+$/gm, '')
      // Ensure proper indentation (2 spaces per level)
      .split('\n')
      .map((line, index) => {
        if (index === 0) return line; // Keep first line as is
        if (line.trim().startsWith('root') || line.includes('((')) {
          return '  ' + line.trim();
        }
        const indent = line.search(/\S/);
        const normalizedIndent = Math.floor(indent / 2) * 2;
        return ' '.repeat(normalizedIndent) + line.trim();
      })
      .join('\n');

    console.log('[AI] Generated Mermaid code:', cleanedCode);

    // DB에 다이어그램 코드 저장
    if (arxivId && cleanedCode) {
      if (source && source !== 'arxiv') {
        await saveInfographicUrl(source, arxivId, cleanedCode);
      } else {
        await saveInfographicUrl(arxivId, cleanedCode);
      }
    }

    return NextResponse.json({
      success: true,
      diagramCode: cleanedCode,
      type: 'mermaid',
      cached: false,
    });
  } catch (error) {
    console.error('다이어그램 생성 오류:', error);
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
    return NextResponse.json(
      { error: `다이어그램 생성 중 오류: ${errorMessage}` },
      { status: 500 }
    );
  }
}
