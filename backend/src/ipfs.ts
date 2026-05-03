/**
 * Optional IPFS upload: set IPFS_PINATA_JWT (Pinata) or IPFS_KUBO_API_URL (local Kubo).
 * If neither is configured, upload returns null and the API still succeeds with manifestDigest only.
 */

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

export async function uploadJsonToIpfs(payload: unknown, filename: string): Promise<IpfsPinResult | null> {
  const pinataJwt = process.env.IPFS_PINATA_JWT?.trim();
  if (pinataJwt) {
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
    if (!res.ok) return null;
    const data = (await res.json()) as { IpfsHash?: string };
    return data.IpfsHash ? { cid: data.IpfsHash } : null;
  }

  const kuboBase = process.env.IPFS_KUBO_API_URL?.trim().replace(/\/$/, "");
  if (kuboBase) {
    const body = JSON.stringify(payload);
    const form = new FormData();
    form.append("file", new Blob([body], { type: "application/json" }), filename);
    const res = await fetch(`${kuboBase}/api/v0/add?pin=true`, { method: "POST", body: form });
    if (!res.ok) return null;
    const hash = parseKuboAddResponse(await res.text());
    return hash ? { cid: hash } : null;
  }

  return null;
}
