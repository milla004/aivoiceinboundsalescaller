// =============================================================================
// Minimal S3 (SigV4) presigned GET URL generator — no AWS SDK dependency.
// Works with AWS S3 and S3-compatible endpoints (e.g. GCS interop). Reuses the
// same EGRESS_S3_* env vars the agent uses to write recordings.
// =============================================================================
import "server-only";
import { createHash, createHmac } from "node:crypto";

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac("sha256", key).update(data, "utf8").digest();
}
function sha256Hex(data: string): string {
  return createHash("sha256").update(data, "utf8").digest("hex");
}
function enc(s: string): string {
  // RFC3986 encoding, but keep path slashes.
  return encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

export function s3Configured(): boolean {
  return Boolean(
    process.env.EGRESS_S3_BUCKET &&
      process.env.EGRESS_S3_ACCESS_KEY &&
      process.env.EGRESS_S3_SECRET
  );
}

/**
 * Build a presigned GET URL valid for `expiresSeconds`. Returns null if S3
 * isn't configured. `key` is the object key (e.g. "calls/<id>.ogg").
 */
export function presignGetUrl(key: string, expiresSeconds = 3600): string | null {
  if (!s3Configured()) return null;

  const accessKey = process.env.EGRESS_S3_ACCESS_KEY!;
  const secret = process.env.EGRESS_S3_SECRET!;
  const bucket = process.env.EGRESS_S3_BUCKET!;
  const region = process.env.EGRESS_S3_REGION || "us-east-1";
  const endpoint = process.env.EGRESS_S3_ENDPOINT || "";

  // Host + base path. Default to AWS virtual-hosted style; for a custom
  // endpoint use path-style (endpoint/bucket/key) which GCS supports.
  let host: string;
  let canonicalUri: string;
  if (endpoint) {
    host = endpoint.replace(/^https?:\/\//, "").replace(/\/$/, "");
    canonicalUri = `/${bucket}/${key.split("/").map(enc).join("/")}`;
  } else {
    host = `${bucket}.s3.${region}.amazonaws.com`;
    canonicalUri = `/${key.split("/").map(enc).join("/")}`;
  }

  // SigV4 needs a timestamp; callers stamp via Date here (server runtime).
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, ""); // YYYYMMDDTHHMMSSZ
  const dateStamp = amzDate.slice(0, 8);

  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
  const params: Record<string, string> = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${accessKey}/${credentialScope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(expiresSeconds),
    "X-Amz-SignedHeaders": "host",
  };

  const canonicalQuery = Object.keys(params)
    .sort()
    .map((k) => `${enc(k)}=${enc(params[k])}`)
    .join("&");

  const canonicalHeaders = `host:${host}\n`;
  const canonicalRequest = [
    "GET",
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    "host",
    "UNSIGNED-PAYLOAD",
  ].join("\n");

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const kDate = hmac(`AWS4${secret}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, "s3");
  const kSigning = hmac(kService, "aws4_request");
  const signature = createHmac("sha256", kSigning).update(stringToSign, "utf8").digest("hex");

  const scheme = endpoint && endpoint.startsWith("http://") ? "http" : "https";
  return `${scheme}://${host}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}
