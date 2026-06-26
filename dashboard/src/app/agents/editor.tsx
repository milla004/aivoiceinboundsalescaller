"use client";

import { useState, useEffect, useCallback } from "react";
import type { AgentProfile, FaqItem } from "@/lib/types";
import { Card, Badge } from "@/components/ui";

interface KnowledgeDoc {
  source_id: string;
  title: string;
  chunks: number;
  chars: number;
  created_at: string;
}

// All 30 Gemini Live named voices (the full set the realtime model supports).
const GEMINI_VOICES = [
  "Zephyr", "Puck", "Charon", "Kore", "Fenrir", "Leda", "Orus", "Aoede",
  "Callirrhoe", "Autonoe", "Enceladus", "Iapetus", "Umbriel", "Algieba",
  "Despina", "Erinome", "Algenib", "Rasalgethi", "Laomedeia", "Achernar",
  "Alnilam", "Schedar", "Gacrux", "Pulcherrima", "Achird", "Zubenelgenubi",
  "Vindemiatrix", "Sadachbia", "Sadaltager", "Sulafat",
];

// Gemini 3.1 thinking levels. 'minimal' is shown as "No thinking".
const THINKING_LEVELS: { value: "minimal" | "low" | "medium" | "high"; label: string }[] = [
  { value: "minimal", label: "No thinking" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

export function AgentEditor({ profiles }: { profiles: AgentProfile[] }) {
  const [selectedId, setSelectedId] = useState(profiles[0]?.id ?? "");
  const selected = profiles.find((p) => p.id === selectedId) ?? profiles[0];

  const [draft, setDraft] = useState<AgentProfile | null>(selected ?? null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function pick(id: string) {
    setSelectedId(id);
    setDraft(profiles.find((p) => p.id === id) ?? null);
    setMsg(null);
  }

  function update<K extends keyof AgentProfile>(key: K, value: AgentProfile[K]) {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/agent-profiles/${draft.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draft.name,
          system_prompt: draft.system_prompt,
          voice: draft.voice,
          thinking_level: draft.thinking_level,
          greeting: draft.greeting,
          faq: draft.faq,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Save failed");
      setMsg("Saved.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (!draft) return null;

  const faq: FaqItem[] = Array.isArray(draft.faq) ? draft.faq : [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-4">
      {/* Profile list */}
      <div className="flex flex-col gap-1">
        {profiles.map((p) => (
          <button
            key={p.id}
            onClick={() => pick(p.id)}
            className={`text-left rounded-md px-3 py-2 text-sm ${
              p.id === selectedId ? "bg-blue-50 text-blue-700 font-medium" : "hover:bg-neutral-100 text-neutral-700"
            }`}
          >
            {p.name}
            {p.is_default && <span className="ml-1 text-xs text-neutral-400">(default)</span>}
          </button>
        ))}
      </div>

      {/* Editor */}
      <Card>
        <div className="space-y-5">
          <Field label="Profile name">
            <input
              className="input"
              value={draft.name}
              onChange={(e) => update("name", e.target.value)}
            />
          </Field>

          <Field label="Voice" hint="Gemini Live voice — the greeting is also synthesized in this voice. Tap ▶ to preview.">
            <VoicePicker selected={draft.voice} onSelect={(v) => update("voice", v)} />
          </Field>

          <Field label="Thinking level" hint="How much the model reasons before replying. Higher = smarter but slower to respond.">
            <div className="flex flex-wrap gap-2">
              {THINKING_LEVELS.map((t) => (
                <button
                  key={t.value}
                  onClick={() => update("thinking_level", t.value)}
                  className={`rounded-full px-3 py-1 text-sm border ${
                    draft.thinking_level === t.value ? "border-blue-500 bg-blue-50 text-blue-700" : "border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Opening greeting" hint="Include recording notice + bot disclosure (required in some US states)">
            <textarea
              className="input min-h-20"
              value={draft.greeting}
              onChange={(e) => update("greeting", e.target.value)}
            />
          </Field>

          <Field label="System prompt" hint="The full persona + sales instructions. US compliance rules are auto-appended at runtime.">
            <textarea
              className="input min-h-72 font-mono text-xs"
              value={draft.system_prompt}
              onChange={(e) => update("system_prompt", e.target.value)}
            />
          </Field>

          <Field label="FAQ knowledge base" hint="Verbatim answers the agent must not deviate from.">
            <FaqEditor faq={faq} onChange={(f) => update("faq", f)} />
          </Field>

          <Field
            label="Knowledge base (RAG)"
            hint="Paste longer reference material (ingredients, policies, company info). The agent searches this during calls instead of you cramming it into the prompt."
          >
            <KnowledgeManager profileId={draft.id} />
          </Field>

          <div className="flex items-center gap-3 pt-2 border-t border-neutral-100">
            <button
              onClick={save}
              disabled={saving}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save profile"}
            </button>
            {msg && <span className="text-sm text-neutral-500">{msg}</span>}
            <span className="ml-auto"><Badge>{draft.compliance_ruleset}</Badge></span>
          </div>
        </div>
      </Card>

      <style>{`
        .input { width: 100%; border: 1px solid #e5e5e5; border-radius: 0.5rem; padding: 0.5rem 0.75rem; font-size: 0.875rem; background: white; }
        .input:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 1px #3b82f6; }
      `}</style>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-neutral-700">{label}</label>
      {hint && <p className="text-xs text-neutral-400 mb-1.5">{hint}</p>}
      {children}
    </div>
  );
}

function FaqEditor({ faq, onChange }: { faq: FaqItem[]; onChange: (f: FaqItem[]) => void }) {
  return (
    <div className="space-y-2">
      {faq.map((item, i) => (
        <div key={i} className="flex gap-2 items-start">
          <input
            className="input flex-1"
            placeholder="Question"
            value={item.q}
            onChange={(e) => onChange(faq.map((f, j) => (j === i ? { ...f, q: e.target.value } : f)))}
          />
          <input
            className="input flex-[2]"
            placeholder="Verbatim answer"
            value={item.a}
            onChange={(e) => onChange(faq.map((f, j) => (j === i ? { ...f, a: e.target.value } : f)))}
          />
          <button
            onClick={() => onChange(faq.filter((_, j) => j !== i))}
            className="text-neutral-400 hover:text-red-500 px-2 py-2 text-sm"
          >
            ✕
          </button>
        </div>
      ))}
      <button
        onClick={() => onChange([...faq, { q: "", a: "" }])}
        className="text-sm text-blue-600 hover:underline"
      >
        + Add FAQ
      </button>
    </div>
  );
}

function VoicePicker({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (v: string) => void;
}) {
  // Which voice is currently loading/playing a preview.
  const [playing, setPlaying] = useState<string | null>(null);
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function preview(v: string) {
    // Stop anything already playing.
    if (audio) {
      audio.pause();
      setAudio(null);
    }
    setErr(null);
    setPlaying(v);
    try {
      const res = await fetch(`/api/voice-sample?voice=${encodeURIComponent(v)}`);
      const type = res.headers.get("content-type") ?? "";
      if (!res.ok || !type.includes("audio")) {
        // Surface the real server error instead of failing silently.
        let msg = `Preview failed (${res.status})`;
        try {
          const body = await res.json();
          if (body?.error) msg = body.error;
        } catch { /* not json */ }
        setErr(msg);
        setPlaying(null);
        return;
      }
      const blob = await res.blob();
      const el = new Audio(URL.createObjectURL(blob));
      el.onended = () => setPlaying(null);
      el.onerror = () => {
        setErr("Browser could not play the audio.");
        setPlaying(null);
      };
      setAudio(el);
      await el.play();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Preview failed");
      setPlaying(null);
    }
  }

  return (
    <div>
    <div className="flex flex-wrap gap-2">
      {GEMINI_VOICES.map((v) => {
        const isSelected = selected === v;
        return (
          <span
            key={v}
            className={`inline-flex items-center rounded-full border text-sm overflow-hidden ${
              isSelected ? "border-blue-500 bg-blue-50" : "border-neutral-200 hover:bg-neutral-50"
            }`}
          >
            <button
              type="button"
              onClick={() => preview(v)}
              title={`Preview ${v}`}
              className={`pl-2.5 pr-1 py-1 ${isSelected ? "text-blue-700" : "text-neutral-400 hover:text-neutral-700"}`}
            >
              {playing === v ? "♪" : "▶"}
            </button>
            <button
              type="button"
              onClick={() => onSelect(v)}
              className={`pr-3 pl-1 py-1 ${isSelected ? "text-blue-700 font-medium" : "text-neutral-600"}`}
            >
              {v}
            </button>
          </span>
        );
      })}
    </div>
    {err && <p className="text-xs text-red-500 mt-2">{err}</p>}
    </div>
  );
}

function KnowledgeManager({ profileId }: { profileId: string }) {
  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/knowledge?agent_profile_id=${profileId}`);
      if (res.ok) {
        const data = await res.json();
        setDocs(data.documents ?? []);
      }
    } catch {
      /* non-fatal */
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  // Reload whenever the selected profile changes.
  useEffect(() => {
    setTitle("");
    setContent("");
    setMsg(null);
    void load();
  }, [load]);

  async function add() {
    if (!content.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent_profile_id: profileId, title, content }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Ingest failed");
      setMsg(`Added "${title || "(untitled)"}" — ${data.chunks} chunk(s).`);
      setTitle("");
      setContent("");
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Ingest failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove(sourceId: string) {
    setMsg(null);
    try {
      const res = await fetch(`/api/knowledge/${sourceId}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error ?? "Delete failed");
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Delete failed");
    }
  }

  return (
    <div className="space-y-3">
      {/* Existing documents */}
      {loading ? (
        <p className="text-xs text-neutral-400">Loading…</p>
      ) : docs.length === 0 ? (
        <p className="text-xs text-neutral-400">No knowledge added yet.</p>
      ) : (
        <ul className="divide-y divide-neutral-100 border border-neutral-200 rounded-md">
          {docs.map((d) => (
            <li key={d.source_id} className="flex items-center justify-between px-3 py-2 text-sm">
              <span className="text-neutral-700">
                {d.title}
                <span className="ml-2 text-xs text-neutral-400">
                  {d.chunks} chunk{d.chunks === 1 ? "" : "s"} · {d.chars.toLocaleString()} chars
                </span>
              </span>
              <button
                onClick={() => remove(d.source_id)}
                className="text-neutral-400 hover:text-red-500 text-xs px-2 py-1"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Add new */}
      <input
        className="input"
        placeholder="Document title (e.g. Ingredient sheet)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <textarea
        className="input min-h-32"
        placeholder="Paste reference text here. It will be chunked and embedded for semantic search."
        value={content}
        onChange={(e) => setContent(e.target.value)}
      />
      <div className="flex items-center gap-3">
        <button
          onClick={add}
          disabled={busy || !content.trim()}
          className="rounded-md bg-neutral-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-900 disabled:opacity-50"
        >
          {busy ? "Adding…" : "Add to knowledge base"}
        </button>
        {msg && <span className="text-xs text-neutral-500">{msg}</span>}
      </div>
    </div>
  );
}

