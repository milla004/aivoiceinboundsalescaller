import { getAgentProfiles, isConfigured } from "@/lib/data";
import { PageHeader, ConfigBanner, EmptyState } from "@/components/ui";
import { AgentEditor } from "./editor";

export const dynamic = "force-dynamic";

export default async function AgentsPage() {
  const profiles = await getAgentProfiles();

  return (
    <div>
      <PageHeader
        title="Agent Profiles"
        subtitle="Personas the agent can use on inbound calls. Edit the prompt and pick a voice."
      />
      {!isConfigured() && <ConfigBanner />}

      {profiles.length === 0 && isConfigured() ? (
        <EmptyState title="No agent profiles" body="Run supabase/schema.sql — it seeds a Global Default profile." />
      ) : (
        <AgentEditor profiles={profiles} />
      )}
    </div>
  );
}
