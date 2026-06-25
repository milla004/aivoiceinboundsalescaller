import { NextResponse } from "next/server";
import { z } from "zod";
import { serviceClient } from "@/lib/supabase";
import { isConfigured } from "@/lib/data";
import { chunkText, embedChunks, EMBEDDING_DIM } from "@/lib/knowledge";

// GET: list knowledge documents (grouped by source) for a profile.
// POST: ingest a new document (title + text) — chunk, embed, store.

const PostSchema = z.object({
  agent_profile_id: z.string().uuid(),
  title: z.string().max(200).optional(),
  content: z.string().min(1).max(100_000),
});

export async function GET(req: Request) {
  if (!isConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }
  const { searchParams } = new URL(req.url);
  const profileId = searchParams.get("agent_profile_id");
  if (!profileId) {
    return NextResponse.json({ error: "agent_profile_id required" }, { status: 400 });
  }

  const { data, error } = await serviceClient()
    .from("knowledge_documents")
    .select("id, source_id, title, content, chunk_index, created_at")
    .eq("agent_profile_id", profileId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Group chunks by source_id into one logical document each.
  const bySource = new Map<
    string,
    { source_id: string; title: string; chunks: number; chars: number; created_at: string }
  >();
  for (const row of data ?? []) {
    const existing = bySource.get(row.source_id);
    if (existing) {
      existing.chunks += 1;
      existing.chars += row.content?.length ?? 0;
    } else {
      bySource.set(row.source_id, {
        source_id: row.source_id,
        title: row.title || "(untitled)",
        chunks: 1,
        chars: row.content?.length ?? 0,
        created_at: row.created_at,
      });
    }
  }

  return NextResponse.json({ documents: Array.from(bySource.values()) });
}

export async function POST(req: Request) {
  if (!isConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }
  if (!process.env.GOOGLE_API_KEY) {
    return NextResponse.json(
      { error: "GOOGLE_API_KEY not set — cannot embed knowledge." },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = PostSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { agent_profile_id, title, content } = parsed.data;

  const chunks = chunkText(content);
  if (!chunks.length) {
    return NextResponse.json({ error: "No usable text to ingest" }, { status: 400 });
  }

  let vectors: number[][];
  try {
    vectors = await embedChunks(chunks, "RETRIEVAL_DOCUMENT");
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Embedding failed" },
      { status: 502 }
    );
  }

  // Sanity: every vector must be the expected dimension.
  if (vectors.some((v) => v.length !== EMBEDDING_DIM)) {
    return NextResponse.json(
      { error: `Embedding dimension mismatch (expected ${EMBEDDING_DIM})` },
      { status: 502 }
    );
  }

  // One source_id ties all chunks of this paste together.
  const source_id = crypto.randomUUID();
  const rows = chunks.map((chunk, i) => ({
    agent_profile_id,
    source_id,
    title: title?.trim() || "(untitled)",
    content: chunk,
    chunk_index: i,
    embedding: vectors[i],
  }));

  const { error } = await serviceClient().from("knowledge_documents").insert(rows);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, source_id, chunks: chunks.length });
}
