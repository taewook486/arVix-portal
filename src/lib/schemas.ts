import { z } from 'zod';

// Paper source types
export const paperSourceSchema = z.enum(['arxiv', 'openreview']);

// Common paper schema
export const paperSchema = z.object({
  arxivId: z.string().optional(),
  sourceId: z.string(),
  source: paperSourceSchema,
  title: z.string().min(1),
  authors: z.array(z.string()).min(1),
  abstract: z.string().optional(),
  categories: z.array(z.string()).optional(),
  publishedAt: z.string().optional(),
  pdfUrl: z.string().url().optional(),
  sourceUrl: z.string().url().optional(),
});

// Search API schema
export const searchPapersQuerySchema = z.object({
  query: z.string().min(1),
  source: z.enum(['arxiv', 'openreview', 'both']).default('both'),
  category: z.string().optional(),
  maxResults: z.coerce.number().int().min(1).max(100).default(20),
  start: z.coerce.number().int().min(0).default(0),
});

export const getPaperParamsSchema = z.object({
  action: z.literal('get'),
  source: paperSourceSchema,
  id: z.string().min(1),
});

// Translate API schema
export const translateRequestSchema = z.object({
  text: z.string().min(1).max(10000),
  arxivId: z.string().optional(),
  source: paperSourceSchema.optional(),
});

// Analyze API schema
export const analyzeRequestSchema = z.object({
  title: z.string().min(1).max(500),
  abstract: z.string().min(1).max(5000),
  arxivId: z.string().optional(),
  source: paperSourceSchema.optional(),
  mode: z.enum(['summary', 'full']).default('full'),
});

// Infographic API schema
export const infographicRequestSchema = z.object({
  title: z.string().min(1).max(500),
  summary: z.string().min(1).max(2000),
  keyPoints: z.array(z.string().max(200)).max(10),
  methodology: z.string().max(1000).optional(),
  arxivId: z.string().optional(),
  source: paperSourceSchema.optional(),
  forceRegenerate: z.boolean().default(false),
});

// Bookmark API schema
export const bookmarkRemoveSchema = z.object({
  source: paperSourceSchema,
  sourceId: z.string().min(1),
});

// Type exports
export type SearchPapersQuery = z.infer<typeof searchPapersQuerySchema>;
export type TranslateRequest = z.infer<typeof translateRequestSchema>;
export type AnalyzeRequest = z.infer<typeof analyzeRequestSchema>;
export type InfographicRequest = z.infer<typeof infographicRequestSchema>;
export type BookmarkRemove = z.infer<typeof bookmarkRemoveSchema>;
