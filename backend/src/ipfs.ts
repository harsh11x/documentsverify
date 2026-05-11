/**
 * Pin JSON to IPFS via Pinata JWT or local Kubo HTTP API.
 * In Vitest (NODE_ENV=test) with no provider configured, returns a deterministic synthetic CID so unit tests run without a daemon.
 */

import crypto from "node:crypto";

export type IpfsPinResult = { cid: string };

function parseKuboAddResponse(text: string): string | null {
  const line = text.trim().split("\n").filter(Boolean)[0];
  if (!line) return null;
  try {
    const row = JSON.parse(line) as { Hash?: string };
    return row.Hash ?? null;
  } catch {
    return null;
  }
}

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

function syntheticTestCid(payload: unknown, filename: string): IpfsPinResult {
  const h = crypto.createHash("sha256").update(`${filename}:${JSON.stringify(payload)}`).digest("hex");
  return { cid: `Qm${h.slice(0, 44)}` };
}

export async function uploadJsonToIpfs(payload: unknown, filename: string): Promise<IpfsPinResult | null> {
  const pinataJwt = process.env.IPFS_PINATA_JWT?.trim();
  if (pinataJwt) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${pinataJwt}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            pinataContent: payload,
            pinataMetadata: { name: filename }
          })
        });
        if (!res.ok) {
          const errText = await res.text().catch(() => "");
          console.error(`[ipfs] Pinata pin failed status=${res.status} body=${errText.slice(0, 500)}`);
          if (attempt === 0) await sleep(400);
          continue;
        }
        const data = (await res.json()) as { IpfsHash?: string };
        if (data.IpfsHash) return { cid: data.IpfsHash };
      } catch (e) {
        console.error("[ipfs] Pinata request error", e);
        if (attempt === 0) await sleep(400);
      }
    }
    return null;
  }

  const kuboBase = process.env.IPFS_KUBO_API_URL?.trim().replace(/\/$/, "");
  if (kuboBase) {
    const body = JSON.stringify(payload);
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const form = new FormData();
        form.append("file", new Blob([body], { type: "application/json" }), filename);
        const res = await fetch(`${kuboBase}/api/v0/add?pin=true`, { method: "POST", body: form });
        if (!res.ok) {
          const errText = await res.text().catch(() => "");
          console.error(`[ipfs] Kubo add failed status=${res.status} body=${errText.slice(0, 500)}`);
          await sleep(500 * (attempt + 1));
          continue;
        }
        const hash = parseKuboAddResponse(await res.text());
        if (hash) return { cid: hash };
      } catch (e) {
        console.error("[ipfs] Kubo request error", e);
        await sleep(500 * (attempt + 1));
      }
    }
    return null;
  }

  if (process.env.NODE_ENV === "test") {
    return syntheticTestCid(payload, filename);
  }

  return null;
}
