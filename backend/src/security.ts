import crypto from "node:crypto";

const MIN_KEY_BYTES = 32;

function getKeyMaterial(): Buffer {
  const key = process.env.AES_256_KEY;
  if (!key) {
    throw new Error("Missing AES_256_KEY");
  }
  const raw = Buffer.from(key, "utf8");
  if (raw.length < MIN_KEY_BYTES) {
    throw new Error("AES_256_KEY must be at least 32 characters");
  }
  return crypto.createHash("sha256").update(raw).digest();
}

export function encryptPII(plaintext: string): string {
  const iv = crypto.randomBytes(16);
  const key = getKeyMaterial();
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function stableCertHash(orgId: string, certType: string, identifierValue: string): string {
  return crypto
    .createHash("sha256")
    .update(`${orgId.trim().toLowerCase()}|${certType.trim().toLowerCase()}|${identifierValue.trim().toLowerCase()}`)
    .digest("hex");
}
