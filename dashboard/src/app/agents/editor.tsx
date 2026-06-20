"use client";

import { useState } from "react";
import type { AgentProfile, FaqItem } from "@/lib/types";
import { Card, Badge } from "@/components/ui";

// Gemini Live preset voices (the limited set — this is the tradeoff you accepted).
const GEMINI_VOICES = ["Puck", "Charon", "Kore", "Fenrir", "Aoede"];

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

          <Field label="Voice" hint="Gemini Live preset voices">
            <div className="flex flex-wrap gap-2">
              {GEMINI_VOICES.map((v) => (
                <button
                  key={v}
                  onClick={() => update("voice", v)}
                  className={`rounded-full px-3 py-1 text-sm border ${
                    draft.voice === v ? "border-blue-500 bg-blue-50 text-blue-700" : "border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                  }`}
                >
                  {v}
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
