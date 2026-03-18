import { AIAnalysis } from '@/types/paper';
import { glmClient, tryGLMModels } from '@/lib/glm';

export async function analyzePaper(title: string, abstract: string): Promise<AIAnalysis> {
  const apiKey = process.env.OPENAI_API_KEY || '';
  if (!apiKey) {
    console.error('OPENAI_API_KEY가 설정되지 않았습니다.');
    throw new Error('API 키가 설정되지 않았습니다.');
  }

  const prompt = `당신은 학술 논문 분석 전문가입니다. 다음 논문의 제목과 초록을 분석하여 JSON 형식으로 응답해주세요.

제목: ${title}

초록: ${abstract}

다음 형식의 JSON으로 응답해주세요 (마크다운 코드 블록 없이 순수 JSON만):
{
  "summary": "논문의 핵심 내용을 2-3문장으로 요약 (한국어)",
  "keyPoints": ["핵심 포인트 1", "핵심 포인트 2", "핵심 포인트 3"],
  "methodology": "사용된 방법론 간략히 설명 (한국어)",
  "contributions": ["주요 기여 1", "주요 기여 2"],
  "limitations": ["한계점 또는 향후 연구 방향 1", "한계점 또는 향후 연구 방향 2"]
}`;

  try {
    const result = await tryGLMModels(async (model) => {
      return await glmClient.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
      });
    });

    const text = result.choices[0]?.message?.content || '';

    // JSON 파싱 시도
    const cleanedText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const analysis: AIAnalysis = JSON.parse(cleanedText);

    return analysis;
  } catch (error) {
    console.error('AI 분석 오류 상세:', error);
    throw error;
  }
}

export async function generateQuickSummary(abstract: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY || '';
  if (!apiKey) {
    throw new Error('API 키가 설정되지 않았습니다.');
  }

  const prompt = `다음 논문 초록을 한국어로 2-3문장으로 간결하게 요약해주세요:

${abstract}

요약:`;

  try {
    const result = await tryGLMModels(async (model) => {
      return await glmClient.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
      });
    });

    return result.choices[0]?.message?.content?.trim() || '';
  } catch (error) {
    console.error('요약 생성 오류:', error);
    throw error;
  }
}
