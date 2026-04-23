"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@docverify.local");
  const [password, setPassword] = useState("Admin@12345");
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
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at 20% 0%, rgba(109, 35, 249, 0.15) 0%, rgba(245, 247, 251, 0) 35%), linear-gradient(180deg, #f7f8fc 0%, #eef1f6 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "28px"
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: "980px",
          background: "#fff",
          border: "1px solid #e6eaf1",
          boxShadow: "0 30px 80px rgba(30, 41, 59, 0.12)",
          borderRadius: "18px",
          overflow: "hidden",
          display: "grid",
          gridTemplateColumns: "1.1fr 1fr"
        }}
      >
        <aside
          style={{
            background:
              "linear-gradient(160deg, rgba(17,24,39,1) 0%, rgba(36,47,66,1) 60%, rgba(109,35,249,0.95) 100%)",
            color: "#f8fafc",
            padding: "42px 36px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between"
          }}
        >
          <div>
            <p style={{ margin: 0, fontSize: "12px", letterSpacing: "0.2em", textTransform: "uppercase", opacity: 0.75 }}>
              VERIFY_LEDGER
            </p>
            <h2 style={{ margin: "18px 0 12px", fontSize: "34px", lineHeight: 1.05, fontWeight: 800 }}>
              Welcome back.
            </h2>
            <p style={{ margin: 0, color: "rgba(241,245,249,0.85)", lineHeight: 1.5 }}>
              Securely sign in to manage organizations, approve onboarding, and issue verifiable certificates.
            </p>
          </div>
          <div style={{ display: "grid", gap: "8px", fontSize: "13px", color: "rgba(241,245,249,0.85)" }}>
            <span>End-to-end verification workflows</span>
            <span>Role-based platform access</span>
            <span>Privacy-aware public verification</span>
          </div>
        </aside>

        <div style={{ padding: "40px 34px" }}>
          <h1 style={{ margin: "0 0 8px", fontSize: "30px", fontWeight: 800, letterSpacing: "-0.02em" }}>Login</h1>
          <p style={{ margin: "0 0 22px", color: "#4b5563" }}>Access your DocVerify workspace.</p>

          <form onSubmit={onSubmit} style={{ display: "grid", gap: "12px" }}>
            <label style={{ display: "grid", gap: "6px", fontSize: "13px", fontWeight: 600 }}>
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{
                  border: "1px solid #d1d5db",
                  padding: "12px 14px",
                  fontSize: "14px",
                  borderRadius: "10px",
                  outline: "none"
                }}
              />
            </label>

            <label style={{ display: "grid", gap: "6px", fontSize: "13px", fontWeight: 600 }}>
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{
                  border: "1px solid #d1d5db",
                  padding: "12px 14px",
                  fontSize: "14px",
                  borderRadius: "10px",
                  outline: "none"
                }}
              />
            </label>

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: "8px",
                border: "none",
                background: "linear-gradient(90deg, #111827 0%, #243042 100%)",
                color: "#fff",
                padding: "13px 14px",
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.72 : 1,
                borderRadius: "10px"
              }}
            >
              {loading ? "Logging In..." : "Login"}
            </button>
          </form>

          {message ? (
            <p
              style={{
                color: "#065f46",
                marginTop: "14px",
                fontSize: "14px",
                background: "#ecfdf5",
                border: "1px solid #86efac",
                padding: "10px 12px",
                borderRadius: "10px"
              }}
            >
              {message}
            </p>
          ) : null}
          {error ? (
            <p
              style={{
                color: "#b91c1c",
                marginTop: "14px",
                fontSize: "14px",
                background: "#fef2f2",
                border: "1px solid #fca5a5",
                padding: "10px 12px",
                borderRadius: "10px"
              }}
            >
              {error}
            </p>
          ) : null}

          <p style={{ marginTop: "16px", fontSize: "13px", color: "#4b5563" }}>
            New organization? <Link href="/signup">Sign up</Link>
          </p>
          <p style={{ marginTop: "8px", fontSize: "13px" }}>
            <Link href="/">Back to home</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
