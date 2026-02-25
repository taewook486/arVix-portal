import { NextRequest, NextResponse } from 'next/server';
import { analyzePaper, generateQuickSummary } from '@/lib/ai';
import { getPaperCache, saveAnalysis } from '@/lib/db';
import { analyzeRequestSchema } from '@/lib/schemas';
import { toAppError, logError, createErrorResponse } from '@/lib/errors';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request body
    const validationResult = analyzeRequestSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: '잘못된 요청 파라미터', issues: validationResult.error.issues },
        { status: 400 }
      );
    }

    const { title, abstract, arxivId, source, mode } = validationResult.data;

    if (!abstract) {
      return NextResponse.json({ error: '초록이 필요합니다' }, { status: 400 });
    }

    if (mode === 'summary') {
      // 빠른 요약만
      const summary = await generateQuickSummary(abstract);
      return NextResponse.json({ summary });
    }

    // 전체 분석 - 캐시 확인
    if (arxivId) {
      const cache = await getPaperCache(arxivId);
      if (cache?.analysis) {
        return NextResponse.json({ ...cache.analysis, cached: true });
      }
    }

    if (!title) {
      return NextResponse.json({ error: '제목이 필요합니다' }, { status: 400 });
    }

    const analysis = await analyzePaper(title, abstract);

    // 분석 결과 캐시에 저장
    if (arxivId && analysis) {
      if (source && source !== 'arxiv') {
        await saveAnalysis(source, arxivId, analysis);
      } else {
        await saveAnalysis(arxivId, analysis);
      }
    }

    return NextResponse.json({ ...analysis, cached: false });
  } catch (error) {
    logError('Analyze API', error);
    const appError = toAppError(error);
    return NextResponse.json(createErrorResponse(appError), { status: appError.statusCode });
  }
}
