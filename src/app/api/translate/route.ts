import { NextRequest, NextResponse } from 'next/server';
import { getPaperCache, saveTranslation } from '@/lib/db';
import { translateRequestSchema } from '@/lib/schemas';
import { toAppError, logError, createErrorResponse } from '@/lib/errors';
import { tryGLMModels, glmClient } from '@/lib/glm';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request body
    const validationResult = translateRequestSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: '잘못된 요청 파라미터', issues: validationResult.error.issues },
        { status: 400 }
      );
    }

    const { text, arxivId, source } = validationResult.data;

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

    if (!process.env.OPENAI_API_KEY) {
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

    const result = await tryGLMModels(async (model) => {
      return await glmClient.chat.completions.create({
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
    logError('Translate API', error);
    const appError = toAppError(error);
    return NextResponse.json(createErrorResponse(appError), { status: appError.statusCode });
  }
}
