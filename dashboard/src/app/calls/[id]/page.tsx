import { getCall, isConfigured } from "@/lib/data";
import { presignGetUrl } from "@/lib/s3";
import { PageHeader, Card, Badge, ConfigBanner } from "@/components/ui";
import { LiveListen } from "@/components/LiveListen";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { CallOutcome, TranscriptTurn } from "@/lib/types";

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

export default async function CallDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const call = await getCall(id);
  if (!call) notFound();

  // recording_url holds the object key; presign it for playback.
  const audioUrl = call.recording_url ? presignGetUrl(call.recording_url) : null;
  const transcript: TranscriptTurn[] = Array.isArray(call.transcript) ? call.transcript : [];

  return (
    <div>
      <PageHeader title="Call detail" subtitle={new Date(call.started_at).toLocaleString()} />
      {!isConfigured() && <ConfigBanner />}

      <Link href="/calls" className="text-sm text-blue-600 hover:underline">← Back to call logs</Link>

      {call.outcome === "in_progress" && call.livekit_room && (
        <Card className="mt-4">
          <div className="text-sm font-medium mb-2">This call is in progress</div>
          <LiveListen room={call.livekit_room} />
        </Card>
      )}

      <Card className="mt-4">
        <dl className="grid grid-cols-2 md:grid-cols-4 gap-y-3 text-sm">
          <div>
            <dt className="text-neutral-400 text-xs">Outcome</dt>
            <dd className="mt-0.5"><Badge tone={OUTCOME_TONE[call.outcome]}>{call.outcome.replace("_", " ")}</Badge></dd>
          </div>
          <div>
            <dt className="text-neutral-400 text-xs">Duration</dt>
            <dd className="mt-0.5">{fmtDuration(call.duration_seconds)}</dd>
          </div>
          <div>
            <dt className="text-neutral-400 text-xs">Step reached</dt>
            <dd className="mt-0.5">{call.reached_step ? `${call.reached_step}/10` : "—"}</dd>
          </div>
          <div>
            <dt className="text-neutral-400 text-xs">Tracking code</dt>
            <dd className="mt-0.5">{call.discount_code ?? "—"}</dd>
          </div>
        </dl>
      </Card>

      {/* Recording */}
      <Card className="mt-4">
        <div className="text-sm font-medium mb-2">Recording</div>
        {audioUrl ? (
          <audio controls src={audioUrl} className="w-full">
            Your browser does not support audio playback.
          </audio>
        ) : call.recording_url ? (
          <p className="text-xs text-neutral-500">
            A recording exists ({call.recording_url}) but storage credentials aren&apos;t configured
            on the dashboard, so it can&apos;t be played back here.
          </p>
        ) : (
          <p className="text-xs text-neutral-500">No recording for this call.</p>
        )}
      </Card>

      {/* Transcript */}
      <Card className="mt-4">
        <div className="text-sm font-medium mb-3">Transcript</div>
        {transcript.length === 0 ? (
          <p className="text-xs text-neutral-500">No transcript captured for this call.</p>
        ) : (
          <div className="space-y-3">
            {transcript.map((turn, i) => (
              <div key={i} className="flex gap-3">
                <span
                  className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full h-fit ${
                    turn.role === "agent"
                      ? "bg-blue-50 text-blue-700"
                      : turn.role === "caller"
                      ? "bg-neutral-100 text-neutral-700"
                      : "bg-amber-50 text-amber-700"
                  }`}
                >
                  {turn.role}
                </span>
                <p className="text-sm text-neutral-700 leading-relaxed">{turn.text}</p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
