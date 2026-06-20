// =============================================================================
// KPIs — Caleb O'Dowd's exact call-center & media metrics.
// Pure functions: pass in rows, get numbers. Test calls excluded by caller.
// =============================================================================
import type { Call, Order } from './types';
import { pct } from './money';

export interface KpiInputs {
  calls: Call[];
  orders: Order[];
  /** Campaign ad spend in cents, summed across the period. */
  adCostCents: number;
  /** Total newspaper circulation across campaigns in the period. */
  circulation: number;
}

export interface Kpis {
  callsReceived: number;
  callsAnswered: number;
  abandonRatePct: number;       // target < 10%
  conversionRatePct: number;    // target 30-40%
  avgOrderValueCents: number;   // sweet spot ~ $180 (18000c)
  upsellTakeRatePct: number;    // back_end orders / front_end orders
  declineRatePct: number;       // target < 10%
  refundRatePct: number;        // healthy 7-12%
  chargebackRatePct: number;    // must stay < 1%
  totalSalesCents: number;
  avgCallDurationSec: number;
  mer: number;                  // Media Efficiency Ratio = sales / ad cost
  callsPerThousand: number;     // CPT — strong ad >= 1 per 2000 circ
}

/** Benchmarks straight from Caleb's transcripts, for UI color-coding. */
export const BENCHMARKS = {
  abandonRatePct: { good: 10, dir: 'below' as const },
  conversionRatePct: { good: 30, great: 40, dir: 'above' as const },
  avgOrderValueCents: { good: 16000, great: 18000, ceiling: 20000, dir: 'above' as const },
  declineRatePct: { good: 10, dir: 'below' as const },
  refundRatePct: { low: 7, high: 12, dir: 'band' as const },
  chargebackRatePct: { good: 1, dir: 'below' as const },
  mer: { breakeven: 1.8, target: 3.2, breakthrough: 6, dir: 'above' as const },
  callsPerThousand: { working: 1 / 3000, strong: 1 / 2000, dir: 'above' as const },
};

export function computeKpis({ calls, orders, adCostCents, circulation }: KpiInputs): Kpis {
  const real = calls.filter((c) => !c.is_test);
  const realOrders = orders.filter((o) => !o.is_test);

  const callsReceived = real.length;
  const callsAnswered = real.filter((c) => c.outcome !== 'abandoned').length;
  const abandoned = real.filter((c) => c.outcome === 'abandoned').length;

  const sales = real.filter((c) => c.outcome === 'sale').length;

  const paid = realOrders.filter((o) => o.status === 'paid');
  const frontEnd = paid.filter((o) => o.kind === 'front_end');
  const backEnd = paid.filter((o) => o.kind === 'back_end');
  const declined = realOrders.filter((o) => o.status === 'declined');
  const refunded = realOrders.filter((o) => o.status === 'refunded');
  const chargebacks = realOrders.filter((o) => o.status === 'chargeback');

  const totalSalesCents = paid.reduce((s, o) => s + o.amount_cents, 0);
  // AOV = total sales / number of distinct front-end orders (a "sale").
  const avgOrderValueCents = frontEnd.length
    ? Math.round(totalSalesCents / frontEnd.length)
    : 0;

  const durations = real.map((c) => c.duration_seconds ?? 0).filter((d) => d > 0);
  const avgCallDurationSec = durations.length
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : 0;

  const attempted = paid.length + declined.length;

  return {
    callsReceived,
    callsAnswered,
    abandonRatePct: pct(abandoned, callsReceived),
    conversionRatePct: pct(sales, callsAnswered),
    avgOrderValueCents,
    upsellTakeRatePct: pct(backEnd.length, frontEnd.length),
    declineRatePct: pct(declined.length, attempted),
    refundRatePct: pct(refunded.length, paid.length),
    chargebackRatePct: pct(chargebacks.length, paid.length),
    totalSalesCents,
    avgCallDurationSec,
    mer: adCostCents ? totalSalesCents / adCostCents : 0,
    callsPerThousand: circulation ? callsReceived / (circulation / 1000) : 0,
  };
}
