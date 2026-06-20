import Link from "next/link";
import { notFound } from "next/navigation";
import { getContact, getEventsForContact, getOrdersForContact } from "@/lib/data";
import { PageHeader, Card, Badge } from "@/components/ui";
import { centsToUsd } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const contact = await getContact(id);
  if (!contact) notFound();

  const [orders, events] = await Promise.all([
    getOrdersForContact(id),
    getEventsForContact(id),
  ]);

  const declined = Boolean((contact.flags as Record<string, unknown>)?.card_declined);
  const fullName = [contact.first_name, contact.last_name].filter(Boolean).join(" ") || "Unknown caller";

  return (
    <div>
      <PageHeader
        title={fullName}
        subtitle={contact.phone_e164 ?? undefined}
        action={<Link href="/contacts" className="text-sm text-blue-600 hover:underline">← All contacts</Link>}
      />

      <div className="flex gap-2 mb-6">
        <Badge tone={contact.type === "client" ? "good" : "neutral"}>{contact.type}</Badge>
        {declined && <Badge tone="bad">card declined</Badge>}
        {contact.tags.map((t) => <Badge key={t}>{t}</Badge>)}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <div className="text-sm font-medium mb-3">Contact details</div>
          <dl className="text-sm space-y-2">
            <Row label="Email" value={contact.email} />
            <Row label="Phone" value={contact.phone_e164} />
            <Row label="Address" value={[contact.address_line1, contact.address_line2, contact.city, contact.state, contact.postal_code].filter(Boolean).join(", ")} />
            <Row label="Probed fear" value={contact.probed_fear} />
            <Row label="Notes" value={contact.notes} />
          </dl>
        </Card>

        <Card>
          <div className="text-sm font-medium mb-3">Orders</div>
          {orders.length === 0 ? (
            <p className="text-sm text-neutral-500">No orders.</p>
          ) : (
            <ul className="text-sm space-y-2">
              {orders.map((o) => (
                <li key={o.id} className="flex items-center justify-between border-b border-neutral-100 pb-2">
                  <span>
                    <Badge tone={o.kind === "back_end" ? "good" : "neutral"}>{o.kind === "back_end" ? "back-end" : "front-end"}</Badge>{" "}
                    <span className="text-neutral-600">{o.tier ?? ""}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="font-medium">{centsToUsd(o.amount_cents)}</span>
                    <Badge tone={o.status === "paid" ? "good" : o.status === "declined" ? "bad" : "neutral"}>{o.status}</Badge>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="mt-4">
        <div className="text-sm font-medium mb-3">Activity / triggers</div>
        {events.length === 0 ? (
          <p className="text-sm text-neutral-500">No events.</p>
        ) : (
          <ul className="text-sm space-y-1">
            {events.map((e) => (
              <li key={e.id} className="flex items-center gap-3 text-neutral-600">
                <span className="text-xs text-neutral-400 w-36">{new Date(e.created_at).toLocaleString()}</span>
                <Badge tone={e.type === "card_declined" ? "bad" : e.type === "order_completed" ? "good" : "neutral"}>{e.type}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex gap-3">
      <dt className="w-28 shrink-0 text-neutral-400">{label}</dt>
      <dd className="text-neutral-800">{value || "—"}</dd>
    </div>
  );
}
