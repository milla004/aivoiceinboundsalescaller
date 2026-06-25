// =============================================================================
// Knowledge base helpers (server-only): chunk text and embed it via Gemini.
//
// We call the Gemini REST embeddings endpoint directly (the dashboard has no
// @google/genai dependency). MUST match the agent's embeddings.ts: same model
// (gemini-embedding-001) and dimensionality (768), or similarity is meaningless.
// =============================================================================
import 'server-only';

export const EMBEDDING_MODEL = 'gemini-embedding-001';
export const EMBEDDING_DIM = 768;

const MAX_CHUNK_CHARS = 1200;

/**
 * Split text into reasonably sized chunks on paragraph/sentence boundaries.
 * Keeps chunks under ~1200 chars so each embeds well and reads back cleanly.
 */
export function chunkText(text: string, maxChars = MAX_CHUNK_CHARS): string[] {
  const clean = text.replace(/\r\n/g, '\n').trim();
  if (!clean) return [];

  // Prefer paragraph breaks, then accumulate until the size limit.
  const paragraphs = clean.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = '';

  const flush = () => {
    if (current.trim()) chunks.push(current.trim());
    current = '';
  };

  for (const para of paragraphs) {
    if (para.length > maxChars) {
      // Paragraph too big: split on sentences.
      flush();
      const sentences = para.split(/(?<=[.!?])\s+/);
      for (const s of sentences) {
        if ((current + ' ' + s).length > maxChars) flush();
        current = current ? `${current} ${s}` : s;
      }
      flush();
    } else if ((current + '\n\n' + para).length > maxChars) {
      flush();
      current = para;
    } else {
      current = current ? `${current}\n\n${para}` : para;
    }
  }
  flush();
  return chunks;
}

/**
 * Embed an array of text chunks via Gemini. Returns one vector per input,
 * in order. Throws on API error so the caller can return a 5xx.
 */
export async function embedChunks(
  chunks: string[],
  taskType: 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY' = 'RETRIEVAL_DOCUMENT',
): Promise<number[][]> {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error('Missing GOOGLE_API_KEY');
  if (!chunks.length) return [];

  // Use batch embedContents to embed all chunks in one request.
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:batchEmbedContents?key=${apiKey}`;
  const body = {
    requests: chunks.map((text) => ({
      model: `models/${EMBEDDING_MODEL}`,
      content: { parts: [{ text }] },
      taskType,
      outputDimensionality: EMBEDDING_DIM,
    })),
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Embedding request failed (${res.status}): ${detail.slice(0, 300)}`);
  }
  const data = (await res.json()) as { embeddings?: { values: number[] }[] };
  const vectors = data.embeddings?.map((e) => e.values) ?? [];
  if (vectors.length !== chunks.length) {
    throw new Error(`Embedding count mismatch: got ${vectors.length}, expected ${chunks.length}`);
  }
  return vectors;
}
