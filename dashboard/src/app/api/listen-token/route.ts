import { NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";

// POST /api/listen-token  { room: string }
// Mints a short-lived, subscribe-only token so a dashboard user can silently
// monitor an in-progress call. The listener cannot publish (hidden + muted),
// so neither the caller nor the agent is aware of them.
export async function POST(req: Request) {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const wsUrl = process.env.LIVEKIT_URL;
  if (!apiKey || !apiSecret || !wsUrl) {
    return NextResponse.json(
      { error: "LiveKit credentials not configured on the dashboard." },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const room = (body as { room?: string })?.room;
  if (!room) {
    return NextResponse.json({ error: "room required" }, { status: 400 });
  }

  const at = new AccessToken(apiKey, apiSecret, {
    identity: `listener-${Date.now()}`,
    name: "Dashboard listener",
    ttl: "1h",
  });
  at.addGrant({
    room,
    roomJoin: true,
    canSubscribe: true,
    canPublish: false,
    canPublishData: false,
    hidden: true, // don't show up in the participant list
  });

  const token = await at.toJwt();
  return NextResponse.json({ token, wsUrl });
}
