"use client";

import { FormEvent, useEffect, useState } from "react";
import { getApiBaseUrl } from "../lib/api-base";

const API_BASE_URL = getApiBaseUrl();

type Org = { orgId: string; name: string; orgType: "GOV" | "PVT" };

export default function CertificateVerificationPage() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [orgId, setOrgId] = useState("");
  const [identifierValue, setIdentifierValue] = useState("");
  const [result, setResult] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE_URL}/api/public/orgs`)
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled) setOrgs(data.items || []);
      })
      .catch(() => {
        if (!cancelled) setResult("Could not load approved organizations.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setResult("");
    try {
      const response = await fetch(`${API_BASE_URL}/api/public/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId,
          certType: "GENERAL",
          identifierValue
        })
      });
      const data = await response.json();
      if (!response.ok) {
        setResult(response.status === 404 ? "Certificate not found." : "Verification failed.");
        return;
      }
      setResult(
        `Verified: status=${data.status}, certUuid=${data.certUuid}, orgId=${data.orgId}, txHash=${data.txHash || "N/A"}`
      );
    } catch {
      setResult("Backend unreachable.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", background: "#f5f7fb", padding: "32px", color: "#111827" }}>
      <section style={{ maxWidth: "900px", margin: "0 auto", background: "#fff", border: "1px solid #e5e7eb", padding: "28px" }}>
        <h1 style={{ margin: 0, fontSize: "34px", fontWeight: 800 }}>Certificate Verification</h1>
        <p style={{ color: "#4b5563" }}>Verify certificates against approved organizations.</p>
        <form onSubmit={onSubmit} style={{ display: "grid", gap: "10px", maxWidth: "520px" }}>
          <select value={orgId} onChange={(e) => setOrgId(e.target.value)} required>
            <option value="">Select organization</option>
            {orgs.map((org) => (
              <option key={org.orgId} value={org.orgId}>
                {org.name} ({org.orgType})
              </option>
            ))}
          </select>
          <input
            value={identifierValue}
            onChange={(e) => setIdentifierValue(e.target.value)}
            placeholder="Certificate identifier"
            required
          />
          <button type="submit" disabled={loading}>
            {loading ? "Verifying..." : "Verify"}
          </button>
        </form>
        {result ? <p style={{ marginTop: "12px" }}>{result}</p> : null}
      </section>
    </main>
  );
}
