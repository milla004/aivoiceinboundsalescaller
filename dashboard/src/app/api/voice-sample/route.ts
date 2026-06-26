import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// GET /api/voice-sample?voice=Puck
// Synthesizes a short sample line in the requested voice via Gemini TTS,
// wraps the raw PCM in a WAV header, caches it to disk, and serves audio/wav
// so the browser can play it. Lets you preview a voice before selecting it.

const TTS_MODEL = "gemini-2.5-flash-preview-tts";
const SAMPLE_RATE = 24000; // Gemini TTS native rate
const SAMPLE_LINE =
  "Hi there, thanks for calling. This is how I'll sound on your calls.";

// Allowed voices — keep in sync with the editor's voice list.
const VOICES = new Set([
  "Zephyr", "Puck", "Charon", "Kore", "Fenrir", "Leda", "Orus", "Aoede",
  "Callirrhoe", "Autonoe", "Enceladus", "Iapetus", "Umbriel", "Algieba",
  "Despina", "Erinome", "Algenib", "Rasalgethi", "Laomedeia", "Achernar",
  "Alnilam", "Schedar", "Gacrux", "Pulcherrima", "Achird", "Zubenelgenubi",
  "Vindemiatrix", "Sadachbia", "Sadaltager", "Sulafat",
]);

const CACHE_DIR = join(tmpdir(), "voice-sample-cache");

/** Wrap raw mono 16-bit PCM in a minimal WAV (RIFF) header. */
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
  header.writeUInt32LE(16, 16); // PCM chunk size
  header.writeUInt16LE(1, 20); // audio format = PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

async function synthesize(voice: string): Promise<Buffer | null> {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) return null;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${TTS_MODEL}:generateContent?key=${apiKey}`;
  const body = {
    contents: [{ parts: [{ text: SAMPLE_LINE }] }],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } },
      },
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { inlineData?: { data?: string } }[] } }[];
  };
  const b64 = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  return b64 ? Buffer.from(b64, "base64") : null;
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

  const key = createHash("sha256").update(`${voice}|${SAMPLE_LINE}`).digest("hex").slice(0, 24);
  const file = join(CACHE_DIR, `${key}.wav`);

  // Serve from cache if present.
  try {
    const cached = await readFile(file);
    return new Response(new Uint8Array(cached), {
      headers: { "Content-Type": "audio/wav", "Cache-Control": "public, max-age=86400" },
    });
  } catch {
    // miss — synthesize below
  }

  const pcm = await synthesize(voice);
  if (!pcm) {
    return Response.json({ error: "Synthesis failed" }, { status: 502 });
  }
  const wav = pcmToWav(pcm, SAMPLE_RATE);

  try {
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(file, wav);
  } catch {
    // non-fatal; still serve this response
  }

  return new Response(new Uint8Array(wav), {
    headers: { "Content-Type": "audio/wav", "Cache-Control": "public, max-age=86400" },
  });
}
