import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

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

export async function POST(request: NextRequest) {
  try {
    const { title, abstract, categories } = await request.json();

    if (!title || !abstract) {
      return NextResponse.json(
        { error: '논문 제목과 초록이 필요합니다' },
        { status: 400 }
      );
    }

    const prompt = `You are an academic search query optimizer. Based on the following research paper information, generate an optimal search query to find similar papers on arXiv.

Title: ${title}

Abstract: ${abstract.slice(0, 1000)}

Categories: ${categories?.join(', ') || 'Not specified'}

Instructions:
1. Extract the core research topic and methodology
2. Identify key technical terms and concepts
3. Generate a concise English search query (3-7 keywords/phrases)
4. Focus on finding papers with similar research direction or methodology
5. Do NOT include author names or specific model names unless they are fundamental concepts

Respond with ONLY the search query, nothing else. Example format:
transformer attention mechanism natural language processing`;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY가 설정되지 않았습니다' },
        { status: 500 }
      );
    }

    const result = await tryModels(MODELS, async (model) => {
      return await openai.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
      });
    });

    const searchQuery = result.choices[0]?.message?.content?.trim() || '';

    if (!searchQuery) {
      return NextResponse.json(
        { error: '검색어 생성에 실패했습니다' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      searchQuery,
      originalTitle: title,
    });
  } catch (error) {
    console.error('유사 논문 검색어 생성 오류:', error);
    return NextResponse.json(
      { error: '검색어 생성 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
