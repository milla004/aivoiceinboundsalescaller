// =============================================================================
// Text embeddings via Google Gemini (gemini-embedding-001).
//
// Used by the RAG knowledge base: documents are embedded at ingest time
// (in the dashboard) and the caller's question is embedded at runtime here so
// we can find the closest knowledge chunks. Both sides MUST use the same model
// and dimensionality (768) or similarity scores are meaningless.
// =============================================================================
import { GoogleGenAI } from '@google/genai';
import { config } from './config.js';

export const EMBEDDING_MODEL = 'gemini-embedding-001';
export const EMBEDDING_DIM = 768;

let client: GoogleGenAI | null = null;
function ai(): GoogleGenAI | null {
  if (!config.googleApiKey) return null;
  if (!client) client = new GoogleGenAI({ apiKey: config.googleApiKey });
  return client;
}

/**
 * Embed a single piece of text. `taskType` should be RETRIEVAL_QUERY when
 * embedding a question to search with, and RETRIEVAL_DOCUMENT when embedding
 * stored content. Returns null on failure so callers can degrade gracefully.
 */
export async function embedText(
  text: string,
  taskType: 'RETRIEVAL_QUERY' | 'RETRIEVAL_DOCUMENT' = 'RETRIEVAL_QUERY',
): Promise<number[] | null> {
  const c = ai();
  if (!c || !text?.trim()) return null;
  try {
    const res = await c.models.embedContent({
      model: EMBEDDING_MODEL,
      contents: [text],
      config: { taskType, outputDimensionality: EMBEDDING_DIM },
    });
    const values = res.embeddings?.[0]?.values;
    return values && values.length ? values : null;
  } catch (err) {
    console.error('[embeddings] embedText failed', err);
    return null;
  }
}
