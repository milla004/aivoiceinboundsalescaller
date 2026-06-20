// =============================================================================
// Money helpers — all money stored as integer cents to avoid float drift.
// =============================================================================
export function centsToUsd(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export function usdToCents(usd: number): number {
  return Math.round(usd * 100);
}

export function pct(numerator: number, denominator: number): number {
  if (!denominator) return 0;
  return (numerator / denominator) * 100;
}
