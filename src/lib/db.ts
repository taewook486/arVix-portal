import { Pool } from 'pg';
import { Bookmark, Paper, PaperSource } from '@/types/paper';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

export interface PaperCache {
  id: string;
  source: string;
  source_id: string;
  arxiv_id?: string;
  translation: string | null;
  translated_at: string | null;
  analysis: {
    summary: string;
    keyPoints: string[];
    methodology: string;
    contributions: string[];
    limitations: string[];
  } | null;
  analyzed_at: string | null;
  infographic_url: string | null;
  infographic_created_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function initDatabase() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS bookmarks (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        arxiv_id TEXT,
        source TEXT DEFAULT 'arxiv',
        source_id TEXT,
        title TEXT NOT NULL,
        authors TEXT[] NOT NULL,
        abstract TEXT,
        categories TEXT[],
        published_at TIMESTAMP,
        pdf_url TEXT,
        ai_summary TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookmarks' AND column_name='source') THEN
          ALTER TABLE bookmarks ADD COLUMN source TEXT DEFAULT 'arxiv';
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookmarks' AND column_name='source_id') THEN
          ALTER TABLE bookmarks ADD COLUMN source_id TEXT;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookmarks' AND column_name='arxiv_id' AND is_nullable='NO') THEN
          ALTER TABLE bookmarks ALTER COLUMN arxiv_id DROP NOT NULL;
        END IF;
      END $$;
    `);

    await client.query(`
      UPDATE bookmarks SET source_id = arxiv_id WHERE source_id IS NULL AND arxiv_id IS NOT NULL;
    `);

    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_bookmarks_source_id') THEN
          CREATE UNIQUE INDEX idx_bookmarks_source_id ON bookmarks(source, source_id) WHERE source_id IS NOT NULL;
        END IF;
      END $$;
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_bookmarks_created_at ON bookmarks(created_at DESC);
    `);
  } finally {
    client.release();
  }
}

export async function addBookmark(paper: Paper, aiSummary?: string): Promise<Bookmark | null> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO bookmarks (source, source_id, arxiv_id, title, authors, abstract, categories, published_at, pdf_url, ai_summary)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (source, source_id) DO NOTHING
       RETURNING *`,
      [
        paper.source,
        paper.sourceId,
        paper.arxivId || null,
        paper.title,
        paper.authors,
        paper.abstract,
        paper.categories,
        paper.publishedAt,
        paper.pdfUrl,
        aiSummary || null,
      ]
    );
    return result.rows[0] || null;
  } catch (error) {
    return null;
  } finally {
    client.release();
  }
}

export async function removeBookmark(source: PaperSource, sourceId: string): Promise<boolean>;
export async function removeBookmark(arxivId: string): Promise<boolean>;
export async function removeBookmark(sourceOrArxivId: PaperSource | string, sourceId?: string): Promise<boolean> {
  const client = await pool.connect();
  try {
    let query: string;
    let params: string[];

    if (sourceId) {
      query = 'DELETE FROM bookmarks WHERE source = $1 AND source_id = $2';
      params = [sourceOrArxivId as string, sourceId];
    } else {
      query = 'DELETE FROM bookmarks WHERE arxiv_id = $1 OR (source = $2 AND source_id = $1)';
      params = [sourceOrArxivId as string, 'arxiv'];
    }

    const result = await client.query(query, params);
    return (result.rowCount ?? 0) > 0;
  } catch (error) {
    return false;
  } finally {
    client.release();
  }
}

export async function getBookmarks(): Promise<Bookmark[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT * FROM bookmarks ORDER BY created_at DESC'
    );
    return result.rows;
  } catch (error) {
    return [];
  } finally {
    client.release();
  }
}

export async function isBookmarked(source: PaperSource, sourceId: string): Promise<boolean>;
export async function isBookmarked(arxivId: string): Promise<boolean>;
export async function isBookmarked(sourceOrArxivId: PaperSource | string, sourceId?: string): Promise<boolean> {
  const client = await pool.connect();
  try {
    let query: string;
    let params: string[];

    if (sourceId) {
      query = 'SELECT id FROM bookmarks WHERE source = $1 AND source_id = $2';
      params = [sourceOrArxivId as string, sourceId];
    } else {
      query = 'SELECT id FROM bookmarks WHERE arxiv_id = $1 OR (source = $2 AND source_id = $1)';
      params = [sourceOrArxivId as string, 'arxiv'];
    }

    const result = await client.query(query, params);
    return result.rows.length > 0;
  } catch (error) {
    return false;
  } finally {
    client.release();
  }
}

export async function getBookmarkByArxivId(arxivId: string): Promise<Bookmark | null> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT * FROM bookmarks WHERE arxiv_id = $1 OR (source = $2 AND source_id = $1)',
      [arxivId, 'arxiv']
    );
    return result.rows[0] || null;
  } catch (error) {
    return null;
  } finally {
    client.release();
  }
}

export async function updateAISummary(source: PaperSource, sourceId: string, aiSummary: string): Promise<boolean>;
export async function updateAISummary(arxivId: string, aiSummary: string): Promise<boolean>;
export async function updateAISummary(sourceOrArxivId: PaperSource | string, sourceIdOrSummary: string, aiSummary?: string): Promise<boolean> {
  const client = await pool.connect();
  try {
    let query: string;
    let params: string[];

    if (aiSummary !== undefined) {
      query = 'UPDATE bookmarks SET ai_summary = $1 WHERE source = $2 AND source_id = $3';
      params = [aiSummary, sourceOrArxivId as string, sourceIdOrSummary];
    } else {
      query = 'UPDATE bookmarks SET ai_summary = $1 WHERE arxiv_id = $2';
      params = [sourceIdOrSummary, sourceOrArxivId as string];
    }

    const result = await client.query(query, params);
    return (result.rowCount ?? 0) > 0;
  } catch (error) {
    return false;
  } finally {
    client.release();
  }
}

export async function initPaperCacheTable() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS paper_cache (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        arxiv_id TEXT,
        source TEXT DEFAULT 'arxiv',
        source_id TEXT,
        translation TEXT,
        translated_at TIMESTAMP,
        analysis JSONB,
        analyzed_at TIMESTAMP,
        infographic_url TEXT,
        infographic_created_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='paper_cache' AND column_name='source') THEN
          ALTER TABLE paper_cache ADD COLUMN source TEXT DEFAULT 'arxiv';
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='paper_cache' AND column_name='source_id') THEN
          ALTER TABLE paper_cache ADD COLUMN source_id TEXT;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='paper_cache' AND column_name='arxiv_id' AND is_nullable='NO') THEN
          ALTER TABLE paper_cache ALTER COLUMN arxiv_id DROP NOT NULL;
        END IF;
      END $$;
    `);

    await client.query(`
      UPDATE paper_cache SET source_id = arxiv_id WHERE source_id IS NULL AND arxiv_id IS NOT NULL;
    `);

    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_paper_cache_source_id') THEN
          CREATE UNIQUE INDEX idx_paper_cache_source_id ON paper_cache(source, source_id) WHERE source_id IS NOT NULL;
        END IF;
      END $$;
    `);
  } finally {
    client.release();
  }
}

export async function getPaperCache(source: PaperSource, sourceId: string): Promise<PaperCache | null>;
export async function getPaperCache(arxivId: string): Promise<PaperCache | null>;
export async function getPaperCache(sourceOrArxivId: PaperSource | string, sourceId?: string): Promise<PaperCache | null> {
  const client = await pool.connect();
  try {
    let query: string;
    let params: string[];

    if (sourceId) {
      query = 'SELECT * FROM paper_cache WHERE source = $1 AND source_id = $2';
      params = [sourceOrArxivId as string, sourceId];
    } else {
      query = 'SELECT * FROM paper_cache WHERE arxiv_id = $1 OR source_id = $1';
      params = [sourceOrArxivId as string];
    }

    const result = await client.query(query, params);
    return result.rows[0] || null;
  } catch (error) {
    return null;
  } finally {
    client.release();
  }
}

export async function saveTranslation(source: PaperSource, sourceId: string, translation: string): Promise<boolean>;
export async function saveTranslation(arxivId: string, translation: string): Promise<boolean>;
export async function saveTranslation(sourceOrArxivId: PaperSource | string, sourceIdOrTranslation: string, translation?: string): Promise<boolean> {
  const client = await pool.connect();
  try {
    if (translation !== undefined) {
      await client.query(
        `INSERT INTO paper_cache (source, source_id, translation, translated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (source, source_id)
         DO UPDATE SET translation = $3, translated_at = NOW()`,
        [sourceOrArxivId, sourceIdOrTranslation, translation]
      );
    } else {
      await client.query(
        `INSERT INTO paper_cache (source, source_id, arxiv_id, translation, translated_at)
         VALUES ($1, $2, $2, $3, NOW())
         ON CONFLICT (source, source_id)
         DO UPDATE SET translation = $3, translated_at = NOW()`,
        ['arxiv', sourceOrArxivId, sourceIdOrTranslation]
      );
    }
    return true;
  } catch (error) {
    return false;
  } finally {
    client.release();
  }
}

export async function saveAnalysis(
  source: PaperSource,
  sourceId: string,
  analysis: { summary: string; keyPoints: string[]; methodology: string; contributions: string[]; limitations: string[] }
): Promise<boolean>;
export async function saveAnalysis(
  arxivId: string,
  analysis: { summary: string; keyPoints: string[]; methodology: string; contributions: string[]; limitations: string[] }
): Promise<boolean>;
export async function saveAnalysis(
  sourceOrArxivId: PaperSource | string,
  sourceIdOrAnalysis: string | { summary: string; keyPoints: string[]; methodology: string; contributions: string[]; limitations: string[] },
  analysis?: { summary: string; keyPoints: string[]; methodology: string; contributions: string[]; limitations: string[] }
): Promise<boolean> {
  const client = await pool.connect();
  try {
    if (analysis !== undefined) {
      await client.query(
        `INSERT INTO paper_cache (source, source_id, analysis, analyzed_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (source, source_id)
         DO UPDATE SET analysis = $3, analyzed_at = NOW()`,
        [sourceOrArxivId, sourceIdOrAnalysis, JSON.stringify(analysis)]
      );
    } else {
      await client.query(
        `INSERT INTO paper_cache (source, source_id, arxiv_id, analysis, analyzed_at)
         VALUES ($1, $2, $2, $3, NOW())
         ON CONFLICT (source, source_id)
         DO UPDATE SET analysis = $3, analyzed_at = NOW()`,
        ['arxiv', sourceOrArxivId, JSON.stringify(sourceIdOrAnalysis)]
      );
    }
    return true;
  } catch (error) {
    return false;
  } finally {
    client.release();
  }
}

export async function saveInfographicUrl(source: PaperSource, sourceId: string, url: string): Promise<boolean>;
export async function saveInfographicUrl(arxivId: string, url: string): Promise<boolean>;
export async function saveInfographicUrl(sourceOrArxivId: PaperSource | string, sourceIdOrUrl: string, url?: string): Promise<boolean> {
  const client = await pool.connect();
  try {
    if (url !== undefined) {
      await client.query(
        `INSERT INTO paper_cache (source, source_id, infographic_url, infographic_created_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (source, source_id)
         DO UPDATE SET infographic_url = $3, infographic_created_at = NOW()`,
        [sourceOrArxivId, sourceIdOrUrl, url]
      );
    } else {
      await client.query(
        `INSERT INTO paper_cache (source, source_id, arxiv_id, infographic_url, infographic_created_at)
         VALUES ($1, $2, $2, $3, NOW())
         ON CONFLICT (source, source_id)
         DO UPDATE SET infographic_url = $3, infographic_created_at = NOW()`,
        ['arxiv', sourceOrArxivId, sourceIdOrUrl]
      );
    }
    return true;
  } catch (error) {
    return false;
  } finally {
    client.release();
  }
}
