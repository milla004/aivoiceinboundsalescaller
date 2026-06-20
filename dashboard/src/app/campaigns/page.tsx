import { getCampaigns, getAgentProfiles, isConfigured } from "@/lib/data";
import { PageHeader, Card, Badge, ConfigBanner, EmptyState } from "@/components/ui";
import { centsToUsd } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  const [campaigns, profiles] = await Promise.all([getCampaigns(), getAgentProfiles()]);
  const profileName = (id: string | null) => profiles.find((p) => p.id === id)?.name ?? "—";

  return (
    <div>
      <PageHeader
        title="Campaigns"
        subtitle="One per newspaper ad. Each gets a unique tracking number — Caleb tracks by number, not code."
      />
      {!isConfigured() && <ConfigBanner />}

      {campaigns.length === 0 ? (
        <EmptyState title="No campaigns yet" body="Create a campaign per ad to attribute calls and compute MER." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {campaigns.map((c) => (
            <Card key={c.id}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs text-neutral-500 mt-0.5">{c.product_name || "No product set"}</div>
                </div>
                <Badge tone={c.active ? "good" : "neutral"}>{c.active ? "active" : "paused"}</Badge>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-y-2 text-sm">
                <dt className="text-neutral-400">Agent</dt><dd>{profileName(c.agent_profile_id)}</dd>
                <dt className="text-neutral-400">Discount code</dt><dd>{c.discount_code ?? "—"}</dd>
                <dt className="text-neutral-400">Circulation</dt><dd>{c.circulation?.toLocaleString() ?? "—"}</dd>
                <dt className="text-neutral-400">Ad cost</dt><dd>{centsToUsd(c.ad_cost_cents)}</dd>
              </dl>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
