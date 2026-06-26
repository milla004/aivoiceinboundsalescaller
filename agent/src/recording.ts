// =============================================================================
// Call recording via LiveKit Egress -> your own S3/GCS bucket.
//
// We start an audio-only room-composite egress when the call begins and stop it
// on shutdown. The recording is written to the bucket configured via the
// EGRESS_S3_* env vars (GCS works through the S3-compatible endpoint). The
// resulting object key is saved to calls.recording_url so the dashboard can
// play it back via a signed URL.
//
// Recording is entirely optional: if EGRESS_S3_* aren't configured, every
// function here no-ops and calls proceed normally.
// =============================================================================
import {
  EgressClient,
  EncodedFileOutput,
  EncodedFileType,
  S3Upload,
} from 'livekit-server-sdk';
import { config } from './config.js';

let _client: EgressClient | null = null;
function client(): EgressClient | null {
  if (!config.hasEgress) return null;
  if (!_client) {
    _client = new EgressClient(
      config.livekitUrl,
      config.livekitApiKey || undefined,
      config.livekitApiSecret || undefined,
    );
  }
  return _client;
}

export interface RecordingHandle {
  egressId: string;
  filepath: string;
}

/**
 * Begin recording the room's audio to S3/GCS. Returns a handle with the egress
 * id and the object key it will write to, or null if recording is disabled or
 * the start call fails (non-fatal — the call continues without a recording).
 */
export async function startRecording(
  roomName: string,
  callId: string | null,
): Promise<RecordingHandle | null> {
  const c = client();
  if (!c) return null;

  // Deterministic key so we know the path without waiting for completion.
  const filepath = `calls/${callId ?? roomName}.ogg`;
  try {
    const output = new EncodedFileOutput({
      fileType: EncodedFileType.OGG,
      filepath,
      output: {
        case: 's3',
        value: new S3Upload({
          accessKey: config.egress.accessKey,
          secret: config.egress.secret,
          bucket: config.egress.bucket,
          region: config.egress.region || undefined,
          endpoint: config.egress.endpoint || undefined,
        }),
      },
    });

    const info = await c.startRoomCompositeEgress(roomName, output, { audioOnly: true });
    console.log(`[recording] started egress ${info.egressId} -> ${filepath}`);
    return { egressId: info.egressId, filepath };
  } catch (err) {
    console.error('[recording] startRecording failed', err);
    return null;
  }
}

/** Stop a running egress. Best-effort; logs and swallows errors. */
export async function stopRecording(egressId: string): Promise<void> {
  const c = client();
  if (!c) return;
  try {
    await c.stopEgress(egressId);
    console.log(`[recording] stopped egress ${egressId}`);
  } catch (err) {
    console.error('[recording] stopRecording failed', err);
  }
}
