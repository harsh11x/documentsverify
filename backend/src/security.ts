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

/** Deterministic JSON for hashing (sorted object keys, stable arrays). */
export function canonicalJsonStringify(value: unknown): string {
  if (value === undefined) return "null";
  if (value === null) return "null";
  const t = typeof value;
  if (t === "number" || t === "boolean") return JSON.stringify(value);
  if (t === "string") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((v) => canonicalJsonStringify(v)).join(",")}]`;
  }
  if (t === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    const parts = keys
      .filter((k) => obj[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${canonicalJsonStringify(obj[k])}`);
    return `{${parts.join(",")}}`;
  }
  return JSON.stringify(value);
}

export function sha256HexUtf8(input: string): string {
  return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}
