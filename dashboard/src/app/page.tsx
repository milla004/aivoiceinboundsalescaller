import { getCalls, getOrders, getCampaigns, isConfigured } from "@/lib/data";
import { computeKpis } from "@/lib/kpis";
import { centsToUsd } from "@/lib/money";
import { PageHeader, Stat, ConfigBanner, Card } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [calls, orders, campaigns] = await Promise.all([
    getCalls(1000),
    getOrders(2000),
    getCampaigns(),
  ]);

  const adCostCents = campaigns.reduce((s, c) => s + (c.ad_cost_cents ?? 0), 0);
  const circulation = campaigns.reduce((s, c) => s + (c.circulation ?? 0), 0);
  const k = computeKpis({ calls, orders, adCostCents, circulation });

  // tone helpers per Caleb's benchmarks
  const convTone = k.conversionRatePct >= 40 ? "good" : k.conversionRatePct >= 30 ? "warn" : "bad";
  const aovTone =
    k.avgOrderValueCents >= 18000 && k.avgOrderValueCents <= 20000 ? "good"
      : k.avgOrderValueCents > 20000 ? "warn" : k.avgOrderValueCents >= 16000 ? "good" : "neutral";
  const abandonTone = k.abandonRatePct <= 10 ? "good" : "bad";
  const declineTone = k.declineRatePct < 10 ? "good" : "bad";
  const cbTone = k.chargebackRatePct < 1 ? "good" : "bad";
  const refundTone = k.refundRatePct >= 7 && k.refundRatePct <= 12 ? "good" : k.refundRatePct > 12 ? "bad" : "neutral";
  const merTone = k.mer >= 3.2 ? "good" : k.mer >= 1.8 ? "warn" : "bad";

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Live KPIs — benchmarks from Caleb O'Dowd's call-center method" />
      {!isConfigured() && <ConfigBanner />}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Calls received" value={String(k.callsReceived)} />
        <Stat label="Conversion rate" value={`${k.conversionRatePct.toFixed(1)}%`} hint="target 30–40%" tone={convTone} />
        <Stat label="Avg order value" value={centsToUsd(k.avgOrderValueCents)} hint="sweet spot ~$180" tone={aovTone} />
        <Stat label="Total sales" value={centsToUsd(k.totalSalesCents)} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
        <Stat label="Upsell take rate" value={`${k.upsellTakeRatePct.toFixed(1)}%`} hint="+Plus / continuity" />
        <Stat label="Abandon rate" value={`${k.abandonRatePct.toFixed(1)}%`} hint="keep < 10%" tone={abandonTone} />
        <Stat label="Decline rate" value={`${k.declineRatePct.toFixed(1)}%`} hint="keep < 10%" tone={declineTone} />
        <Stat label="Chargeback rate" value={`${k.chargebackRatePct.toFixed(2)}%`} hint="must stay < 1%" tone={cbTone} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
        <Stat label="Refund rate" value={`${k.refundRatePct.toFixed(1)}%`} hint="healthy 7–12%" tone={refundTone} />
        <Stat label="MER" value={`${k.mer.toFixed(2)}×`} hint="target 3.2× · breakthrough 6×" tone={merTone} />
        <Stat label="Calls / 1k circ" value={k.callsPerThousand.toFixed(2)} hint="strong ≥ 0.5 (1 per 2k)" />
        <Stat label="Avg call length" value={`${Math.floor(k.avgCallDurationSec / 60)}m ${k.avgCallDurationSec % 60}s`} hint="typical 8–12 min" />
      </div>

      <Card className="mt-6">
        <div className="text-sm font-medium mb-1">How these are calculated</div>
        <p className="text-xs text-neutral-500 leading-relaxed">
          MER = total paid sales ÷ total campaign ad cost. Conversion = sales ÷ calls answered.
          AOV = total sales ÷ front-end orders. Test calls/orders are excluded from every metric.
          Add campaigns with circulation and ad cost to populate MER and calls-per-thousand.
        </p>
      </Card>
    </div>
  );
}
