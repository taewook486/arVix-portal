import { NextResponse } from 'next/server';
import { initDatabase, initPaperCacheTable } from '@/lib/db';

export async function GET() {
  try {
    const results = {
      bookmarks: { success: false, error: null as string | null },
      paperCache: { success: false, error: null as string | null },
    };

    // Initialize bookmarks table
    try {
      await initDatabase();
      results.bookmarks.success = true;
    } catch (error) {
      results.bookmarks.error = error instanceof Error ? error.message : 'Unknown error';
    }

    // Initialize paper_cache table
    try {
      await initPaperCacheTable();
      results.paperCache.success = true;
    } catch (error) {
      results.paperCache.error = error instanceof Error ? error.message : 'Unknown error';
    }

    const allSuccess = results.bookmarks.success && results.paperCache.success;

    return NextResponse.json({
      success: allSuccess,
      message: allSuccess
        ? 'Database initialized successfully'
        : 'Database initialized with some errors',
      results,
    }, { status: allSuccess ? 200 : 207 });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: 'Failed to initialize database',
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
