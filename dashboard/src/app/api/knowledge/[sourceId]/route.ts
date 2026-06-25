import { NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { isConfigured } from "@/lib/data";

// DELETE: remove all chunks of one knowledge document (by source_id).
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ sourceId: string }> }
) {
  if (!isConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }
  const { sourceId } = await params;

  const { error } = await serviceClient()
    .from("knowledge_documents")
    .delete()
    .eq("source_id", sourceId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
