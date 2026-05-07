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
  const [authNotice, setAuthNotice] = useState("");

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

  function onLaunchDashboard() {
    if (typeof window === "undefined") return;
    const token = localStorage.getItem("docverify_access_token");
    const role = localStorage.getItem("docverify_role");
    if (token && role === "org_admin") {
      window.location.href = "/dashboard";
      return;
    }
    setAuthNotice("Please login/signup as an organization first to access the dashboard.");
  }

  const qrSrc = verifyUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=10&data=${encodeURIComponent(verifyUrl)}`
    : "";

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at 0% 0%, rgba(56, 189, 248, 0.18), transparent 32%), radial-gradient(circle at 100% 0%, rgba(167, 139, 250, 0.14), transparent 34%), #05070d",
        padding: "24px 20px 60px"
      }}
    >
      <header
        style={{
          maxWidth: "1180px",
          margin: "0 auto 14px",
          borderRadius: "14px",
          border: "1px solid rgba(148,163,184,0.35)",
          background: "rgba(9,13,24,0.75)",
          backdropFilter: "blur(10px)",
          padding: "12px 16px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          boxShadow: "0 14px 50px rgba(0,0,0,0.45)"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: "10px", height: "10px", borderRadius: "999px", background: "#22d3ee" }} />
          <strong style={{ letterSpacing: "0.16em", textTransform: "uppercase", fontSize: "12px" }}>DocVerify</strong>
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <Link href="/login" style={{ padding: "8px 12px", borderRadius: "10px", border: "1px solid #334155", background: "#0b1220", textDecoration: "none", fontWeight: 700 }}>
            Login
          </Link>
          <Link href="/signup" style={{ padding: "8px 12px", borderRadius: "10px", border: "1px solid #334155", background: "#0b1220", textDecoration: "none", fontWeight: 700 }}>
            Org Signup
          </Link>
        </div>
      </header>

      <section
        style={{
          maxWidth: "1180px",
          margin: "0 auto",
          borderRadius: "18px",
          border: "1px solid rgba(148,163,184,0.4)",
          background: "linear-gradient(145deg, rgba(15,23,42,0.92), rgba(10,14,26,0.96))",
          boxShadow: "0 40px 90px rgba(0,0,0,0.55)",
          overflow: "hidden"
        }}
      >
        <div style={{ padding: "42px 34px 28px" }}>
          <p style={{ margin: 0, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.18em", fontSize: "11px" }}>
            trust infrastructure for credentials
          </p>
          <h1 style={{ margin: "12px 0 12px", fontSize: "54px", lineHeight: 1.02, fontWeight: 900, color: "#f8fafc", letterSpacing: "-0.04em", maxWidth: "860px" }}>
            Futuristic certificate verification for modern institutions
          </h1>
          <p style={{ marginTop: 0, color: "#cbd5e1", maxWidth: "860px", lineHeight: 1.7, fontSize: "16px" }}>
            Verify any certificate in seconds. DocVerify combines cryptographic integrity, decentralized validation, and privacy-safe records into one sleek verification surface for education, healthcare, governance, and enterprise compliance.
          </p>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "20px" }}>
            <button
              type="button"
              onClick={onLaunchDashboard}
              style={{ padding: "11px 14px", borderRadius: "10px", background: "#2563eb", color: "#fff", border: "none", fontWeight: 800, cursor: "pointer" }}
            >
              Launch Dashboard
            </button>
            <Link href="/certificate-verification" style={{ padding: "11px 14px", borderRadius: "10px", border: "1px solid #334155", background: "#0b1220", textDecoration: "none", fontWeight: 800 }}>Advanced Verify</Link>
          </div>
          {authNotice ? <p style={{ marginTop: "10px", color: "#fbbf24", fontSize: "14px" }}>{authNotice}</p> : null}
        </div>

        <div style={{ padding: "0 34px 30px" }}>
          <form onSubmit={onVerify} style={{ display: "grid", gap: "10px" }}>
            <label style={{ color: "#cbd5e1", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.12em" }}>
              Enter hash / certificate ID / tx hash
            </label>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. UUID, cert hash, tx hash"
                required
                style={{
                  flex: "1 1 460px",
                  minWidth: "280px",
                  padding: "14px 13px",
                  borderRadius: "11px",
                  border: "1px solid #334155",
                  background: "#05070d",
                  color: "#f8fafc"
                }}
              />
              <button
                type="submit"
                disabled={loading}
                style={{
                  padding: "14px 18px",
                  borderRadius: "11px",
                  border: "none",
                  background: "#f8fafc",
                  color: "#020617",
                  fontWeight: 900,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  cursor: loading ? "not-allowed" : "pointer"
                }}
              >
                {loading ? "Verifying..." : "Verify now"}
              </button>
            </div>
          </form>
          {error ? <p style={{ color: "#fda4af", marginTop: "12px", marginBottom: 0 }}>{error}</p> : null}
        </div>
      </section>

      <section style={{ maxWidth: "1180px", margin: "22px auto 0", display: "grid", gap: "12px", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        {[
          { title: "99.99% Verification Integrity", body: "Cryptographic hashes and chain-synced status ensure tamper-proof trust signals." },
          { title: "Privacy by Design", body: "PII remains encrypted or masked while proof and status stay globally verifiable." },
          { title: "Multi-Org Governance", body: "Decentralized peer approvals reduce single-point trust and improve audit confidence." },
          { title: "Instant Public Proof", body: "Shareable verification URLs and QR outputs are generated from live records." }
        ].map((item) => (
          <article key={item.title} style={{ borderRadius: "14px", border: "1px solid rgba(148,163,184,0.35)", background: "rgba(10,14,26,0.9)", padding: "16px" }}>
            <h3 style={{ marginTop: 0, marginBottom: "8px", color: "#f8fafc", fontSize: "18px" }}>{item.title}</h3>
            <p style={{ margin: 0, color: "#cbd5e1", lineHeight: 1.6, fontSize: "14px" }}>{item.body}</p>
          </article>
        ))}
      </section>

      {result ? (
        <section
          style={{
            maxWidth: "1180px",
            margin: "24px auto 0",
            background: "linear-gradient(145deg, rgba(15,23,42,0.93), rgba(10,14,26,0.96))",
            border: "1px solid rgba(148,163,184,0.4)",
            borderRadius: "18px",
            padding: "26px",
            boxShadow: "0 34px 80px rgba(0,0,0,0.52)",
            display: "grid",
            gridTemplateColumns: "minmax(240px, 290px) 1fr",
            gap: "18px"
          }}
        >
          <div style={{ border: "1px solid #334155", borderRadius: "12px", padding: "12px", background: "#05070d" }}>
            <img src={qrSrc} alt="Certificate verification QR" style={{ width: "100%", display: "block" }} />
          </div>
          <div>
            <h2 style={{ marginTop: 0, marginBottom: "10px", color: "#f8fafc" }}>Verified Certificate Template</h2>
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
              <Link href={`/verify/${result.certUuid}`} style={{ padding: "10px 12px", borderRadius: "10px", border: "1px solid #334155", textDecoration: "none", fontWeight: 700, background: "#0b1220" }}>
                Open public page
              </Link>
              {result.manifestUri ? (
                <a href={result.manifestUri} target="_blank" rel="noreferrer" style={{ padding: "10px 12px", borderRadius: "10px", border: "1px solid #334155", textDecoration: "none", fontWeight: 700, background: "#0b1220" }}>
                  Open manifest
                </a>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      <section style={{ maxWidth: "1180px", margin: "26px auto 0", display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "14px" }}>
        <article style={{ borderRadius: "14px", border: "1px solid rgba(148,163,184,0.35)", background: "rgba(10,14,26,0.9)", padding: "18px" }}>
          <p style={{ margin: 0, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.14em", fontSize: "11px" }}>How it works</p>
          <h3 style={{ margin: "8px 0 12px", fontSize: "24px", color: "#f8fafc" }}>Four-step zero-friction trust loop</h3>
          <ol style={{ margin: 0, paddingLeft: "20px", color: "#cbd5e1", lineHeight: 1.8 }}>
            <li>Organizations onboard and pass review workflow.</li>
            <li>Certificates are issued with encrypted off-chain PII.</li>
            <li>Consensus and chain callbacks finalize trust status.</li>
            <li>Public users verify in seconds using hash, ID, or QR.</li>
          </ol>
        </article>
        <article style={{ borderRadius: "14px", border: "1px solid rgba(148,163,184,0.35)", background: "rgba(10,14,26,0.9)", padding: "18px" }}>
          <p style={{ margin: 0, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.14em", fontSize: "11px" }}>Need advanced tools?</p>
          <h3 style={{ margin: "8px 0 12px", fontSize: "24px", color: "#f8fafc" }}>Admin and power-user entry points</h3>
          <div style={{ display: "grid", gap: "8px" }}>
            <Link href="/dashboard" style={{ padding: "10px 12px", borderRadius: "10px", border: "1px solid #334155", background: "#0b1220", textDecoration: "none", fontWeight: 700 }}>Open Dashboard</Link>
            <Link href="/certificate-verification" style={{ padding: "10px 12px", borderRadius: "10px", border: "1px solid #334155", background: "#0b1220", textDecoration: "none", fontWeight: 700 }}>Advanced Verification Page</Link>
            <Link href="/transparency" style={{ padding: "10px 12px", borderRadius: "10px", border: "1px solid #334155", background: "#0b1220", textDecoration: "none", fontWeight: 700 }}>Transparency & Trust Model</Link>
          </div>
        </article>
      </section>
    </main>
  );
}
