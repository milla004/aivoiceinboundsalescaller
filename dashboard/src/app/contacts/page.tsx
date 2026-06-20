import Link from "next/link";
import { getContacts, isConfigured } from "@/lib/data";
import { PageHeader, Card, Badge, ConfigBanner, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ContactsPage() {
  const contacts = await getContacts();

  return (
    <div>
      <PageHeader title="CRM" subtitle="Every caller — prospects and clients. Captured before the pitch, per Step 1." />
      {!isConfigured() && <ConfigBanner />}

      {contacts.length === 0 ? (
        <EmptyState title="No contacts yet" body="Contacts are created automatically when calls come in." />
      ) : (
        <Card className="p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Flags</th>
                <th className="px-4 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => {
                const declined = Boolean((c.flags as Record<string, unknown>)?.card_declined);
                return (
                  <tr key={c.id} className="border-t border-neutral-100 hover:bg-neutral-50">
                    <td className="px-4 py-3">
                      <Link href={`/contacts/${c.id}`} className="font-medium text-blue-600 hover:underline">
                        {[c.first_name, c.last_name].filter(Boolean).join(" ") || "Unknown"}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={c.type === "client" ? "good" : "neutral"}>{c.type}</Badge>
                    </td>
                    <td className="px-4 py-3 text-neutral-600">{c.phone_e164 ?? "—"}</td>
                    <td className="px-4 py-3">
                      {declined && <Badge tone="bad">card declined</Badge>}
                    </td>
                    <td className="px-4 py-3 text-neutral-400 text-xs">
                      {new Date(c.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
