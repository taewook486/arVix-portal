import { NextRequest, NextResponse } from 'next/server';
import { glmClient, tryGLMModels } from '@/lib/glm';
import { withErrorHandler } from '@/lib/errors';

export const POST = withErrorHandler(async (request: NextRequest) => {
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

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: 'OPENAI_API_KEY가 설정되지 않았습니다' },
      { status: 500 }
    );
  }

  const result = await tryGLMModels(async (model) => {
    return await glmClient.chat.completions.create({
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
}, 'Similar Search');
