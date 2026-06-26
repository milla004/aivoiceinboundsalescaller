"use client";

import { useRef, useState } from "react";
import { Room, RoomEvent, RemoteTrack } from "livekit-client";

// A "Listen live" button for an in-progress call. Joins the LiveKit room as a
// hidden, subscribe-only participant and plays all audio tracks (caller +
// agent) so an operator can silently monitor the call.
export function LiveListen({ room: roomName }: { room: string }) {
  const [state, setState] = useState<"idle" | "connecting" | "live" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const roomRef = useRef<Room | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  async function start() {
    setState("connecting");
    setError(null);
    try {
      const res = await fetch("/api/listen-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room: roomName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not get token");

      const room = new Room();
      roomRef.current = room;

      room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
        if (track.kind === "audio") {
          const el = track.attach();
          el.autoplay = true;
          containerRef.current?.appendChild(el);
        }
      });
      room.on(RoomEvent.Disconnected, () => {
        setState("idle");
      });

      await room.connect(data.wsUrl, data.token);
      setState("live");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to connect");
      setState("error");
    }
  }

  async function stop() {
    await roomRef.current?.disconnect();
    roomRef.current = null;
    if (containerRef.current) containerRef.current.innerHTML = "";
    setState("idle");
  }

  return (
    <div className="flex items-center gap-3">
      {state === "live" ? (
        <button
          onClick={stop}
          className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
        >
          ■ Stop listening
        </button>
      ) : (
        <button
          onClick={start}
          disabled={state === "connecting"}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {state === "connecting" ? "Connecting…" : "🎧 Listen live"}
        </button>
      )}
      {state === "live" && <span className="text-xs text-green-600">● Live — monitoring silently</span>}
      {error && <span className="text-xs text-red-500">{error}</span>}
      <div ref={containerRef} className="hidden" />
    </div>
  );
}
