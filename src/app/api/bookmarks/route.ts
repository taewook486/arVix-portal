import { NextRequest, NextResponse } from 'next/server';
import { PaperSource } from '@/types/paper';
import {
  getBookmarks,
  addBookmark,
  removeBookmark,
  isBookmarked,
  initDatabase,
} from '@/lib/db';
import { withErrorHandler } from '@/lib/errors';

// 앱 시작 시 테이블 초기화
let initialized = false;
async function ensureInitialized() {
  if (!initialized) {
    await initDatabase();
    initialized = true;
  }
}

// 북마크 목록 조회 또는 특정 논문 북마크 여부 확인
export const GET = withErrorHandler(async (request: NextRequest) => {
  await ensureInitialized();

  const searchParams = request.nextUrl.searchParams;
  const source = searchParams.get('source') as PaperSource | null;
  const sourceId = searchParams.get('sourceId');
  const arxivId = searchParams.get('arxivId'); // 하위 호환성

  if (source && sourceId) {
    // source + sourceId로 북마크 여부 확인
    const bookmarked = await isBookmarked(source, sourceId);
    return NextResponse.json({ bookmarked });
  }

  if (arxivId) {
    // 하위 호환성: arxivId만으로도 확인 가능
    const bookmarked = await isBookmarked(arxivId);
    return NextResponse.json({ bookmarked });
  }

  // 전체 북마크 목록 조회
  const bookmarks = await getBookmarks();
  return NextResponse.json(bookmarks);
}, 'Bookmarks GET');

// 북마크 추가
export const POST = withErrorHandler(async (request: NextRequest) => {
  await ensureInitialized();

  const body = await request.json();
  const { paper, aiSummary } = body;

  if (!paper || !paper.sourceId) {
    return NextResponse.json({ error: '논문 정보가 필요합니다' }, { status: 400 });
  }

  const bookmark = await addBookmark(paper, aiSummary);

  if (!bookmark) {
    return NextResponse.json({ error: '북마크 추가 실패' }, { status: 500 });
  }

  return NextResponse.json(bookmark);
}, 'Bookmarks POST');

// 북마크 삭제
export const DELETE = withErrorHandler(async (request: NextRequest) => {
  await ensureInitialized();

  const searchParams = request.nextUrl.searchParams;
  const source = searchParams.get('source') as PaperSource | null;
  const sourceId = searchParams.get('sourceId');
  const arxivId = searchParams.get('arxivId'); // 하위 호환성

  let success = false;

  if (source && sourceId) {
    success = await removeBookmark(source, sourceId);
  } else if (arxivId) {
    success = await removeBookmark(arxivId);
  } else {
    return NextResponse.json({ error: 'source와 sourceId 또는 arxivId가 필요합니다' }, { status: 400 });
  }

  if (!success) {
    return NextResponse.json({ error: '북마크 삭제 실패' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}, 'Bookmarks DELETE');
