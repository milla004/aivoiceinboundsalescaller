import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GoogleGenAI, Modality, type LiveServerMessage, type Session } from "@google/genai";

// GET /api/voice-sample?voice=Puck
// Plays a short sample synthesized by the SAME live model used on calls
// (gemini-3.1-flash-live-preview by default, overridable via GEMINI_MODEL), so
// the preview matches what the caller will actually hear. We open a Live API
// session, send a user turn instructing the model to read the sample line
// verbatim (this sidesteps the model's "cannot speak first" limitation),
// collect the streamed PCM, wrap it in a WAV header, and cache per voice+model.

// Live audio output is signed 16-bit PCM, mono, 24 kHz.
const SAMPLE_RATE = 24000;
const SAMPLE_LINE = "Hi there, thanks for calling. This is how I'll sound on your calls.";
const LIVE_MODEL = process.env.GEMINI_MODEL || "gemini-3.1-flash-live-preview";
const TURN_TIMEOUT_MS = 15000;

const VOICES = new Set([
  "Zephyr", "Puck", "Charon", "Kore", "Fenrir", "Leda", "Orus", "Aoede",
  "Callirrhoe", "Autonoe", "Enceladus", "Iapetus", "Umbriel", "Algieba",
  "Despina", "Erinome", "Algenib", "Rasalgethi", "Laomedeia", "Achernar",
  "Alnilam", "Schedar", "Gacrux", "Pulcherrima", "Achird", "Zubenelgenubi",
  "Vindemiatrix", "Sadachbia", "Sadaltager", "Sulafat",
]);

const CACHE_DIR = join(tmpdir(), "voice-sample-cache");

function pcmToWav(pcm: Buffer, sampleRate: number): Buffer {
  const channels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * channels * bitsPerSample) / 8;
  const blockAlign = (channels * bitsPerSample) / 8;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

/**
 * Synthesize the sample line via a Live API session in `voice`. Collects the
 * streamed PCM chunks until the turn completes (or times out). Returns the raw
 * PCM bytes, or an error message.
 */
async function synthesizeLive(voice: string): Promise<{ pcm?: Buffer; error?: string }> {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) return { error: "GOOGLE_API_KEY not set on the dashboard." };

  const ai = new GoogleGenAI({ apiKey });
  const chunks: Buffer[] = [];
  let session: Session | null = null;

  try {
    const done = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Live session timed out")), TURN_TIMEOUT_MS);
      ai.live
        .connect({
          model: LIVE_MODEL,
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } },
            },
            systemInstruction:
              "You are a voice sample generator. When asked, read the provided line exactly, " +
              "once, in a warm natural tone. Do not add anything else.",
          },
          callbacks: {
            onopen: () => {
              // Send a user turn so the model responds (it cannot speak first).
              session?.sendClientContent({
                turns: [{ role: "user", parts: [{ text: `Say exactly: "${SAMPLE_LINE}"` }] }],
                turnComplete: true,
              });
            },
            onmessage: (msg: LiveServerMessage) => {
              const b64 = msg.data;
              if (b64) chunks.push(Buffer.from(b64, "base64"));
              if (msg.serverContent?.turnComplete) {
                clearTimeout(timer);
                resolve();
              }
            },
            onerror: (e: ErrorEvent) => {
              clearTimeout(timer);
              reject(new Error(e.message || "Live session error"));
            },
            onclose: () => {
              clearTimeout(timer);
              resolve();
            },
          },
        })
        .then((s) => {
          session = s;
        })
        .catch(reject);
    });

    await done;
    (session as Session | null)?.close();

    if (!chunks.length) return { error: "Live model returned no audio." };
    return { pcm: Buffer.concat(chunks) };
  } catch (e) {
    try { (session as Session | null)?.close(); } catch { /* ignore */ }
    return { error: e instanceof Error ? e.message : "Live synthesis failed" };
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const voice = searchParams.get("voice") ?? "";
  if (!VOICES.has(voice)) {
    return Response.json({ error: "Unknown voice" }, { status: 400 });
  }
  if (!process.env.GOOGLE_API_KEY) {
    return Response.json({ error: "GOOGLE_API_KEY not set" }, { status: 503 });
  }

  // Cache key includes the model so switching models regenerates samples.
  const key = createHash("sha256")
    .update(`${LIVE_MODEL}|${voice}|${SAMPLE_LINE}`)
    .digest("hex")
    .slice(0, 24);
  const file = join(CACHE_DIR, `${key}.wav`);

  try {
    const cached = await readFile(file);
    return new Response(new Uint8Array(cached), {
      headers: { "Content-Type": "audio/wav", "Cache-Control": "public, max-age=86400" },
    });
  } catch {
    // miss — synthesize
  }

  const result = await synthesizeLive(voice);
  if (result.error || !result.pcm) {
    return Response.json({ error: result.error ?? "Synthesis failed" }, { status: 502 });
  }
  const wav = pcmToWav(result.pcm, SAMPLE_RATE);

  try {
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(file, wav);
  } catch {
    // non-fatal
  }

  return new Response(new Uint8Array(wav), {
    headers: { "Content-Type": "audio/wav", "Cache-Control": "public, max-age=86400" },
  });
}
