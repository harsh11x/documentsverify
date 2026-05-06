"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { getApiBaseUrl } from "../lib/api-base";

const API_BASE_URL = getApiBaseUrl();

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data?.error || "Login failed");
        return;
      }

      if (data?.accessToken) {
        localStorage.setItem("docverify_access_token", data.accessToken);
        localStorage.setItem("docverify_role", data.role || "");
        localStorage.setItem("docverify_org_id", data.orgId || "");
      }

      setMessage(`Logged in successfully as ${data?.role || "user"}.`);
      setTimeout(() => router.push("/dashboard"), 500);
    } catch {
      setError("Could not reach backend API.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", background: "#05070d", padding: "20px", display: "grid", placeItems: "center" }}>
      <section style={{ width: "100%", maxWidth: "460px", border: "3px solid #f8fafc", background: "#0b1220", padding: "28px", boxShadow: "12px 12px 0 #1e293b" }}>
        <p style={{ margin: 0, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.18em", fontSize: "11px" }}>
          secure access
        </p>
        <h1 style={{ margin: "10px 0 6px", color: "#f8fafc" }}>Login</h1>
        <p style={{ marginTop: 0, color: "#9fb0c5" }}>Access your DocVerify workspace.</p>
        <form onSubmit={onSubmit} style={{ display: "grid", gap: "10px" }}>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="Email" style={{ padding: "12px", border: "2px solid #f8fafc", background: "#05070d", color: "#e2e8f0" }} />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="Password" style={{ padding: "12px", border: "2px solid #f8fafc", background: "#05070d", color: "#e2e8f0" }} />
          <button type="submit" disabled={loading} style={{ padding: "12px", border: "2px solid #f8fafc", background: "#f8fafc", color: "#020617", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>
        {message ? <p style={{ color: "#4ade80", marginTop: "12px" }}>{message}</p> : null}
        {error ? <p style={{ color: "#fda4af", marginTop: "12px" }}>{error}</p> : null}
        <p style={{ marginTop: "14px", color: "#cbd5e1" }}>
          New organization? <Link href="/signup">Sign up</Link>
        </p>
        <p style={{ marginTop: "6px" }}>
          <Link href="/">Back to home</Link>
        </p>
      </section>
    </main>
  );
}
