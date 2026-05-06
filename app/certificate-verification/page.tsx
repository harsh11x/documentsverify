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
    <main style={{ minHeight: "100vh", background: "#05070d", padding: "24px", color: "#e2e8f0" }}>
      <section style={{ maxWidth: "920px", margin: "0 auto", background: "#0b1220", border: "3px solid #f8fafc", padding: "30px", boxShadow: "12px 12px 0 #1e293b" }}>
        <h1 style={{ margin: 0, fontSize: "36px", fontWeight: 900, color: "#f8fafc" }}>Certificate Verification</h1>
        <p style={{ color: "#9fb0c5" }}>Verify certificates against approved organizations in real time.</p>
        <form onSubmit={onSubmit} style={{ display: "grid", gap: "10px", maxWidth: "560px" }}>
          <select value={orgId} onChange={(e) => setOrgId(e.target.value)} required style={{ padding: "12px", border: "2px solid #f8fafc", background: "#05070d", color: "#e2e8f0" }}>
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
            style={{ padding: "12px", border: "2px solid #f8fafc", background: "#05070d", color: "#e2e8f0" }}
          />
          <button type="submit" disabled={loading} style={{ padding: "12px", border: "2px solid #f8fafc", background: "#f8fafc", color: "#020617", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            {loading ? "Verifying..." : "Verify"}
          </button>
        </form>
        {result ? <p style={{ marginTop: "14px", color: "#cbd5e1" }}>{result}</p> : null}
      </section>
    </main>
  );
}
