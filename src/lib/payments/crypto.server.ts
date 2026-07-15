// Server-only. AES-256-GCM using PAYMENT_CONFIG_KEY (base64 or hex, 32 bytes).
import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";

function key(): Buffer {
  const raw = process.env.PAYMENT_CONFIG_KEY;
  if (!raw) throw new Error("PAYMENT_CONFIG_KEY is not set");
  // Accept base64, hex, or arbitrary string — normalise to 32 bytes.
  let buf: Buffer;
  try {
    buf = Buffer.from(raw, "base64");
    if (buf.length !== 32) throw new Error("nope");
  } catch {
    buf = createHash("sha256").update(raw).digest();
  }
  if (buf.length !== 32) buf = createHash("sha256").update(raw).digest();
  return buf;
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([c.update(plaintext, "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), ct]).toString("base64");
}

export function decryptSecret(stored: string): string {
  const buf = Buffer.from(stored, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ct = buf.subarray(28);
  const d = createDecipheriv("aes-256-gcm", key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(ct), d.final()]).toString("utf8");
}
