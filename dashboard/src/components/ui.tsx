import { ReactNode } from "react";

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        {subtitle && <p className="text-sm text-neutral-500 mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border border-neutral-200 bg-white p-5 ${className}`}>
      {children}
    </div>
  );
}

type Tone = "neutral" | "good" | "warn" | "bad";

const TONE: Record<Tone, string> = {
  neutral: "text-neutral-900",
  good: "text-green-600",
  warn: "text-amber-600",
  bad: "text-red-600",
};

export function Stat({
  label, value, hint, tone = "neutral",
}: { label: string; value: string; hint?: string; tone?: Tone }) {
  return (
    <Card>
      <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</div>
      <div className={`mt-2 text-2xl font-semibold ${TONE[tone]}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-neutral-400">{hint}</div>}
    </Card>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone }) {
  const map: Record<Tone, string> = {
    neutral: "bg-neutral-100 text-neutral-700",
    good: "bg-green-100 text-green-700",
    warn: "bg-amber-100 text-amber-700",
    bad: "bg-red-100 text-red-700",
  };
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${map[tone]}`}>{children}</span>;
}

export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <Card className="text-center py-10">
      <div className="text-sm font-medium text-neutral-700">{title}</div>
      {body && <div className="text-xs text-neutral-500 mt-1">{body}</div>}
    </Card>
  );
}

export function ConfigBanner() {
  return (
    <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      Supabase isn&apos;t configured yet. Copy <code className="font-mono">.env.example</code> to{" "}
      <code className="font-mono">dashboard/.env.local</code>, add your keys, and run the schema in{" "}
      <code className="font-mono">supabase/schema.sql</code>. The UI runs now with empty data.
    </div>
  );
}
