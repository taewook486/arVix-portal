import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getPaperCache, saveTranslation } from '@/lib/db';

const apiKey = process.env.OPENAI_API_KEY || '';
const baseURL = process.env.OPENAI_BASE_URL;

if (!apiKey) {
  console.error('OPENAI_API_KEY가 설정되지 않았습니다.');
}

const openai = new OpenAI({
  apiKey,
  baseURL,
});

const MODELS = ['glm-5', 'glm-4.7', 'glm-4.7-Flash'] as const;

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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, arxivId, source } = body;

    if (!text) {
      return NextResponse.json({ error: '번역할 텍스트가 필요합니다' }, { status: 400 });
    }

    // 캐시된 번역이 있는지 확인
    if (arxivId) {
      const cache = await getPaperCache(arxivId);
      if (cache?.translation) {
        return NextResponse.json({ translation: cache.translation, cached: true });
      }
    }

    if (!apiKey) {
      return NextResponse.json({ error: 'API 키가 설정되지 않았습니다' }, { status: 500 });
    }

    const prompt = `다음 영어 논문 초록을 한국어로 번역해주세요.

번역 규칙:
  원문의 문장 구조와 단락 형식을 그대로 유지
  추가적인 꾸밈이나 마크다운 서식 없이 순수 텍스트로 번역
  학술 용어는 적절히 번역하되, 필요한 경우 영어 원문을 괄호 안에 병기
  자연스러운 한국어로 번역

원문:
${text}

한국어 번역:`;

    const result = await tryModels(MODELS, async (model) => {
      return await openai.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
      });
    });

    const translatedText = result.choices[0]?.message?.content?.trim() || '';

    // 번역 결과 캐시에 저장
    if (arxivId) {
      if (source && source !== 'arxiv') {
        await saveTranslation(source, arxivId, translatedText);
      } else {
        await saveTranslation(arxivId, translatedText);
      }
    }

    return NextResponse.json({ translation: translatedText, cached: false });
  } catch (error) {
    console.error('번역 오류:', error);
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
    return NextResponse.json(
      { error: `번역 중 오류가 발생했습니다: ${errorMessage}` },
      { status: 500 }
    );
  }
}
