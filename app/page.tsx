/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { getApiBaseUrl } from "./lib/api-base";

const API_BASE_URL = getApiBaseUrl();

type VerifyResponse = {
  status: string;
  certUuid: string;
  orgId: string;
  certType: string;
  issueDate: string;
  txHash: string;
  certHash: string;
  manifestDigest: string;
  ipfsCid: string | null;
  manifestUri: string | null;
};

function short(value: string, head = 8, tail = 8) {
  if (!value) return "N/A";
  if (value.length <= head + tail + 3) return value;
  return `${value.slice(0, head)}...${value.slice(-tail)}`;
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<VerifyResponse | null>(null);

  const verifyUrl = useMemo(() => {
    if (!result?.certUuid || typeof window === "undefined") return "";
    return `${window.location.origin}/verify/${result.certUuid}`;
  }, [result]);

  async function onVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/public/verify/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim() })
      });
      const data = await response.json();
      if (!response.ok) {
        setError(response.status === 404 ? "Certificate not found. Check hash or certificate ID." : "Verification failed.");
        return;
      }
      setResult(data);
    } catch {
      setError("Backend unreachable right now.");
    } finally {
      setLoading(false);
    }
  }

  const qrSrc = verifyUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=10&data=${encodeURIComponent(verifyUrl)}`
    : "";

  return (
    <main style={{ minHeight: "100vh", background: "#05070d", padding: "26px 20px 48px" }}>
      <header
        style={{
          maxWidth: "1080px",
          margin: "0 auto 18px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          border: "3px solid #f8fafc",
          padding: "12px 14px",
          background: "#0b1220",
          boxShadow: "10px 10px 0 #1e293b"
        }}
      >
        <strong style={{ letterSpacing: "0.1em", textTransform: "uppercase" }}>DocVerify</strong>
        <div style={{ display: "flex", gap: "8px" }}>
          <Link href="/login" style={{ padding: "8px 10px", border: "2px solid #f8fafc", textDecoration: "none", fontWeight: 800 }}>
            Login
          </Link>
          <Link href="/signup" style={{ padding: "8px 10px", border: "2px solid #f8fafc", textDecoration: "none", fontWeight: 800 }}>
            Org Signup
          </Link>
        </div>
      </header>

      <section style={{ maxWidth: "1080px", margin: "0 auto", background: "#0b1220", border: "3px solid #f8fafc", padding: "38px", boxShadow: "14px 14px 0 #1e293b" }}>
        <p style={{ margin: 0, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.18em", fontSize: "11px" }}>
          blockchain certificate verification
        </p>
        <h1 style={{ margin: "12px 0 10px", fontSize: "46px", fontWeight: 900, color: "#f8fafc", letterSpacing: "-0.03em" }}>
          DocVerify
        </h1>
        <p style={{ marginTop: 0, color: "#cbd5e1", maxWidth: "700px", lineHeight: 1.6 }}>
          Enter any certificate identifier to instantly retrieve the verified certificate template with hash, digest, and QR details.
        </p>
        <form onSubmit={onVerify} style={{ display: "grid", gap: "10px", marginTop: "18px" }}>
          <label style={{ color: "#cbd5e1", fontSize: "13px", textTransform: "uppercase", letterSpacing: "0.1em" }}>
            Enter certificate hash / certificate ID / tx hash
          </label>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. UUID, cert hash, tx hash"
              required
              style={{ flex: "1 1 420px", minWidth: "280px", padding: "12px", border: "2px solid #f8fafc", background: "#05070d", color: "#f8fafc" }}
            />
            <button
              type="submit"
              disabled={loading}
              style={{ padding: "12px 16px", border: "2px solid #f8fafc", background: "#f8fafc", color: "#020617", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.08em", cursor: loading ? "not-allowed" : "pointer" }}
            >
              {loading ? "Verifying..." : "Verify now"}
            </button>
          </div>
        </form>
        {error ? <p style={{ color: "#fda4af", marginTop: "12px", marginBottom: 0 }}>{error}</p> : null}
      </section>

      {result ? (
        <section
          style={{
            maxWidth: "1080px",
            margin: "20px auto 0",
            background: "#0b1220",
            border: "3px solid #f8fafc",
            padding: "26px",
            boxShadow: "14px 14px 0 #1e293b",
            display: "grid",
            gridTemplateColumns: "minmax(260px, 300px) 1fr",
            gap: "18px"
          }}
        >
          <div style={{ border: "2px solid #f8fafc", padding: "12px", background: "#05070d" }}>
            <img src={qrSrc} alt="Certificate verification QR" style={{ width: "100%", display: "block" }} />
          </div>
          <div>
            <h2 style={{ marginTop: 0, marginBottom: "10px" }}>Verified Certificate Template</h2>
            <div style={{ display: "grid", gap: "8px", color: "#dbe4ef", fontSize: "14px" }}>
              <div><strong>Status:</strong> {result.status}</div>
              <div><strong>Certificate ID:</strong> {result.certUuid}</div>
              <div><strong>Organization:</strong> {result.orgId}</div>
              <div><strong>Type:</strong> {result.certType}</div>
              <div><strong>Issue Date:</strong> {result.issueDate}</div>
              <div><strong>Certificate Hash:</strong> {short(result.certHash, 14, 14)}</div>
              <div><strong>TX Hash:</strong> {short(result.txHash, 14, 14)}</div>
              <div><strong>Manifest Digest:</strong> {short(result.manifestDigest, 14, 14)}</div>
              <div><strong>IPFS CID:</strong> {result.ipfsCid || "N/A"}</div>
            </div>
            <div style={{ display: "flex", gap: "8px", marginTop: "14px", flexWrap: "wrap" }}>
              <Link href={`/verify/${result.certUuid}`} style={{ padding: "10px 12px", border: "2px solid #f8fafc", textDecoration: "none", fontWeight: 800 }}>
                Open public page
              </Link>
              {result.manifestUri ? (
                <a href={result.manifestUri} target="_blank" rel="noreferrer" style={{ padding: "10px 12px", border: "2px solid #f8fafc", textDecoration: "none", fontWeight: 800 }}>
                  Open manifest
                </a>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      <section style={{ maxWidth: "1080px", margin: "20px auto 0" }}>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <Link href="/certificate-verification" style={{ padding: "11px 14px", background: "#0b1220", border: "2px solid #f8fafc", color: "#f8fafc", textDecoration: "none", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em" }}>Advanced verify page</Link>
          <Link href="/dashboard" style={{ padding: "11px 14px", background: "#0b1220", border: "2px solid #f8fafc", color: "#f8fafc", textDecoration: "none", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em" }}>Dashboard</Link>
        </div>
      </section>
    </main>
  );
}
