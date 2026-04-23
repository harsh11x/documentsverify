"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

type Certificate = {
  certUuid: string;
  orgId: string;
  certType: string;
  issueDate: string;
  status: string;
  txHash: string;
  identifierMasked: string;
};

export default function DashboardPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [role, setRole] = useState("");
  const [orgId, setOrgId] = useState("");
  const [items, setItems] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [verifyResult, setVerifyResult] = useState<string>("");

  const [issueForm, setIssueForm] = useState({
    certType: "GENERAL",
    identifierValue: "",
    holderName: "",
    holderDob: "",
    issueDate: new Date().toISOString().slice(0, 10)
  });
  const [verifyUuid, setVerifyUuid] = useState("");

  useEffect(() => {
    const t = localStorage.getItem("docverify_access_token") || "";
    const r = localStorage.getItem("docverify_role") || "";
    const o = localStorage.getItem("docverify_org_id") || "";
    if (!t) {
      router.replace("/login");
      return;
    }
    setToken(t);
    setRole(r);
    setOrgId(o);
  }, [router]);

  async function loadCertificates() {
    if (!token) return;
    setLoading(true);
    try {
      const endpoint = role === "super_admin" ? "/api/certificates" : "/api/certificates/mine";
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok) {
        setNotice("Could not load certificates.");
        return;
      }
      setItems(data.items || []);
    } catch {
      setNotice("Backend unreachable.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadCertificates();
  }, [token, role]); // eslint-disable-line react-hooks/exhaustive-deps

  async function onIssue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    const currentOrgId = orgId || localStorage.getItem("docverify_org_id") || "";
    if (!currentOrgId) {
      setNotice("No organization context found for this account.");
      return;
    }
    setNotice("Issuing certificate...");
    try {
      const response = await fetch(`${API_BASE_URL}/api/certificates/issue`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          orgId: currentOrgId,
          branchId: "main-branch",
          certType: issueForm.certType,
          identifierType: "ID",
          identifierValue: issueForm.identifierValue,
          holderName: issueForm.holderName,
          holderDob: issueForm.holderDob,
          issueDate: issueForm.issueDate
        })
      });
      const data = await response.json();
      if (!response.ok) {
        setNotice("Issue failed. Check input values and permissions.");
        return;
      }
      setNotice(`Certificate issued: ${data.certUuid}`);
      setIssueForm((prev) => ({ ...prev, identifierValue: "", holderName: "", holderDob: "" }));
      await loadCertificates();
    } catch {
      setNotice("Issue failed due to network/backend error.");
    }
  }

  async function onVerifyByUuid(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!verifyUuid.trim()) return;
    setVerifyResult("Verifying...");
    try {
      const response = await fetch(`${API_BASE_URL}/api/public/verify/${verifyUuid.trim()}`);
      const data = await response.json();
      if (!response.ok) {
        setVerifyResult("Certificate not found.");
        return;
      }
      setVerifyResult(
        `Status: ${data.status} | Org: ${data.orgId} | Type: ${data.certType} | Tx: ${data.txHash || "N/A"}`
      );
    } catch {
      setVerifyResult("Verification failed.");
    }
  }

  const title = useMemo(() => (role === "super_admin" ? "Super Admin Dashboard" : "Organization Dashboard"), [role]);

  return (
    <main style={{ minHeight: "100vh", background: "#f3f5fa", padding: "24px", color: "#111827" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto", display: "grid", gap: "16px" }}>
        <section style={{ background: "#fff", border: "1px solid #e5e7eb", padding: "18px 20px" }}>
          <h1 style={{ margin: 0, fontSize: "28px", fontWeight: 800 }}>{title}</h1>
          <p style={{ margin: "6px 0 0", color: "#4b5563" }}>
            Manage uploaded certificates, issue new records, and verify public certificate status.
          </p>
        </section>

        <section style={{ background: "#fff", border: "1px solid #e5e7eb", padding: "18px 20px" }}>
          <h2 style={{ marginTop: 0 }}>Issue / Upload Certificate</h2>
          <form onSubmit={onIssue} style={{ display: "grid", gap: "10px", gridTemplateColumns: "repeat(2,minmax(0,1fr))" }}>
            <input
              value={issueForm.certType}
              onChange={(e) => setIssueForm((p) => ({ ...p, certType: e.target.value }))}
              placeholder="Certificate Type"
              required
              style={{ padding: "10px" }}
            />
            <input
              value={issueForm.identifierValue}
              onChange={(e) => setIssueForm((p) => ({ ...p, identifierValue: e.target.value }))}
              placeholder="Identifier Value"
              required
              style={{ padding: "10px" }}
            />
            <input
              value={issueForm.holderName}
              onChange={(e) => setIssueForm((p) => ({ ...p, holderName: e.target.value }))}
              placeholder="Holder Name"
              required
              style={{ padding: "10px" }}
            />
            <input
              value={issueForm.holderDob}
              onChange={(e) => setIssueForm((p) => ({ ...p, holderDob: e.target.value }))}
              placeholder="Holder DOB (YYYY-MM-DD)"
              required
              style={{ padding: "10px" }}
            />
            <input
              type="date"
              value={issueForm.issueDate}
              onChange={(e) => setIssueForm((p) => ({ ...p, issueDate: e.target.value }))}
              required
              style={{ padding: "10px" }}
            />
            <button type="submit" style={{ padding: "10px", background: "#111827", color: "#fff", border: "none" }}>
              Issue Certificate
            </button>
          </form>
        </section>

        <section style={{ background: "#fff", border: "1px solid #e5e7eb", padding: "18px 20px" }}>
          <h2 style={{ marginTop: 0 }}>Verify Certificate by UUID</h2>
          <form onSubmit={onVerifyByUuid} style={{ display: "flex", gap: "8px" }}>
            <input
              value={verifyUuid}
              onChange={(e) => setVerifyUuid(e.target.value)}
              placeholder="Enter certificate UUID"
              style={{ flex: 1, padding: "10px" }}
            />
            <button type="submit" style={{ padding: "10px 14px", background: "#111827", color: "#fff", border: "none" }}>
              Verify
            </button>
          </form>
          {verifyResult ? <p style={{ marginTop: "10px", color: "#374151" }}>{verifyResult}</p> : null}
        </section>

        <section style={{ background: "#fff", border: "1px solid #e5e7eb", padding: "18px 20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ marginTop: 0 }}>Stored Certificates</h2>
            <button onClick={() => void loadCertificates()} style={{ padding: "8px 12px" }}>
              Refresh
            </button>
          </div>
          {loading ? <p>Loading...</p> : null}
          {!loading && items.length === 0 ? <p>No certificates yet.</p> : null}
          {!loading && items.length > 0 ? (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    <th style={{ textAlign: "left", padding: "8px", border: "1px solid #e5e7eb" }}>UUID</th>
                    <th style={{ textAlign: "left", padding: "8px", border: "1px solid #e5e7eb" }}>Org</th>
                    <th style={{ textAlign: "left", padding: "8px", border: "1px solid #e5e7eb" }}>Type</th>
                    <th style={{ textAlign: "left", padding: "8px", border: "1px solid #e5e7eb" }}>Issue Date</th>
                    <th style={{ textAlign: "left", padding: "8px", border: "1px solid #e5e7eb" }}>Status</th>
                    <th style={{ textAlign: "left", padding: "8px", border: "1px solid #e5e7eb" }}>Identifier</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.certUuid}>
                      <td style={{ padding: "8px", border: "1px solid #e5e7eb", fontSize: "12px" }}>{item.certUuid}</td>
                      <td style={{ padding: "8px", border: "1px solid #e5e7eb" }}>{item.orgId}</td>
                      <td style={{ padding: "8px", border: "1px solid #e5e7eb" }}>{item.certType}</td>
                      <td style={{ padding: "8px", border: "1px solid #e5e7eb" }}>{item.issueDate}</td>
                      <td style={{ padding: "8px", border: "1px solid #e5e7eb" }}>{item.status}</td>
                      <td style={{ padding: "8px", border: "1px solid #e5e7eb" }}>{item.identifierMasked}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {notice ? <p style={{ marginTop: "10px", color: "#1f2937" }}>{notice}</p> : null}
        </section>
      </div>
    </main>
  );
}

