"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback } from "react";

interface CampaignOption {
  id: string;
  name: string;
}

// A filter bar (date range + campaign + code) that pushes its state into the
// URL searchParams. Server pages read those params and query filtered data.
export function FilterBar({
  campaigns,
  showCode = true,
}: {
  campaigns: CampaignOption[];
  showCode?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const setParam = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      router.push(`${pathname}?${next.toString()}`);
    },
    [params, pathname, router]
  );

  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  const campaignId = params.get("campaignId") ?? "";
  const code = params.get("code") ?? "";
  const hasAny = from || to || campaignId || code;

  return (
    <div className="flex flex-wrap items-end gap-3 mb-4">
      <label className="flex flex-col text-xs text-neutral-500">
        From
        <input
          type="date"
          value={from}
          onChange={(e) => setParam("from", e.target.value)}
          className="filter-input"
        />
      </label>
      <label className="flex flex-col text-xs text-neutral-500">
        To
        <input
          type="date"
          value={to}
          onChange={(e) => setParam("to", e.target.value)}
          className="filter-input"
        />
      </label>
      <label className="flex flex-col text-xs text-neutral-500">
        Campaign
        <select
          value={campaignId}
          onChange={(e) => setParam("campaignId", e.target.value)}
          className="filter-input"
        >
          <option value="">All campaigns</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      {showCode && (
        <label className="flex flex-col text-xs text-neutral-500">
          Tracking code
          <input
            type="text"
            value={code}
            placeholder="e.g. SAVE20"
            onChange={(e) => setParam("code", e.target.value)}
            className="filter-input"
          />
        </label>
      )}
      {hasAny && (
        <button
          onClick={() => router.push(pathname)}
          className="text-xs text-blue-600 hover:underline pb-2"
        >
          Clear
        </button>
      )}

      <style>{`
        .filter-input { margin-top: 0.25rem; border: 1px solid #e5e5e5; border-radius: 0.5rem; padding: 0.4rem 0.6rem; font-size: 0.875rem; background: white; color: #171717; }
        .filter-input:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 1px #3b82f6; }
      `}</style>
    </div>
  );
}
