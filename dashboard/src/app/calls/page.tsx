import { getCalls, isConfigured } from "@/lib/data";
import { PageHeader, Card, Badge, ConfigBanner, EmptyState } from "@/components/ui";
import type { CallOutcome } from "@/lib/types";

export const dynamic = "force-dynamic";

const OUTCOME_TONE: Record<CallOutcome, "neutral" | "good" | "warn" | "bad"> = {
  in_progress: "neutral",
  sale: "good",
  no_sale: "neutral",
  callback: "warn",
  voicemail: "neutral",
  abandoned: "bad",
  transferred_human: "warn",
  error: "bad",
};

function fmtDuration(sec: number | null) {
  if (!sec) return "—";
  return `${Math.floor(sec / 60)}m ${sec % 60}s`;
}

export default async function CallsPage() {
  const calls = await getCalls(300);

  return (
    <div>
      <PageHeader title="Call Logs" subtitle="Every inbound call with outcome, step reached, and transcript." />
      {!isConfigured() && <ConfigBanner />}

      {calls.length === 0 ? (
        <EmptyState title="No calls yet" body="Calls appear here once your Telnyx number routes to the agent." />
      ) : (
        <Card className="p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-3 font-medium">Started</th>
                <th className="px-4 py-3 font-medium">Outcome</th>
                <th className="px-4 py-3 font-medium">Step</th>
                <th className="px-4 py-3 font-medium">Duration</th>
                <th className="px-4 py-3 font-medium">Code</th>
                <th className="px-4 py-3 font-medium">Test</th>
              </tr>
            </thead>
            <tbody>
              {calls.map((c) => (
                <tr key={c.id} className="border-t border-neutral-100 hover:bg-neutral-50">
                  <td className="px-4 py-3 text-neutral-500 text-xs">{new Date(c.started_at).toLocaleString()}</td>
                  <td className="px-4 py-3"><Badge tone={OUTCOME_TONE[c.outcome]}>{c.outcome.replace("_", " ")}</Badge></td>
                  <td className="px-4 py-3 text-neutral-600">{c.reached_step ? `${c.reached_step}/10` : "—"}</td>
                  <td className="px-4 py-3 text-neutral-600">{fmtDuration(c.duration_seconds)}</td>
                  <td className="px-4 py-3 text-neutral-600">{c.discount_code ?? "—"}</td>
                  <td className="px-4 py-3">{c.is_test && <Badge tone="warn">test</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
