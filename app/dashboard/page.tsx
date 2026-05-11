"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { getApiBaseUrl } from "../lib/api-base";

const API_BASE_URL = getApiBaseUrl();

type Certificate = {
  certUuid: string;
  orgId?: string;
  certType: string;
  issueDate: string;
  status: string;
  identifierMasked: string;
  ipfsCid?: string | null;
  manifestUri?: string | null;
};

type OrgReviewItem = {
  orgId: string;
  name: string;
  city: string;
  sector: string;
  orgType: string;
  status: string;
  voteSummary: { approvals: number; denials: number; total: number };
};
type OrgStatusItem = {
  orgId: string;
  name: string;
  city: string;
  sector: string;
  orgType: string;
  status: string;
  adminEmail: string | null;
  chainTxHash: string | null;
  certificateCount: number;
  accessState: string;
  accessReason: string | null;
  coolOffUntil: string | null;
  voteSummary?: {
    approvals: number;
    denials: number;
    total: number;
    requiredMajority: number;
    eligibleVoterCount: number;
  };
};

type VoteHistoryItem = {
  orgId: string;
  orgName: string;
  finalStatus: string;
  yourDecision: "approve" | "deny";
  reason: string;
  decidedAt: string;
};

type OrgMe = {
  orgId: string;
  name: string;
  city: string;
  orgType: string;
  sector: string;
  domain: string;
  status: string;
  reviewReason: string | null;
  chainTxHash: string | null;
  accessState: string;
  accessReason: string | null;
  coolOffUntil: string | null;
};

type OrgRegistrationVoteSummary = {
  approvals: number;
  denials: number;
  total: number;
  requiredMajority: number;
  eligibleVoterCount: number;
};

export default function DashboardPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [role, setRole] = useState("");
  const [orgId, setOrgId] = useState("");
  const [submittedItems, setSubmittedItems] = useState<Certificate[]>([]);
  const [incomingItems, setIncomingItems] = useState<OrgReviewItem[]>([]);
  const [voteHistory, setVoteHistory] = useState<VoteHistoryItem[]>([]);
  const [pendingOrgs, setPendingOrgs] = useState<OrgStatusItem[]>([]);
  const [approvedOrgs, setApprovedOrgs] = useState<OrgStatusItem[]>([]);
  const [rejectedOrgs, setRejectedOrgs] = useState<OrgStatusItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [verifyResult, setVerifyResult] = useState<string>("");
  const [isMobile, setIsMobile] = useState(false);
  const [submittedFilter, setSubmittedFilter] = useState<"all" | "verified" | "revoked">("all");
  const [myOrg, setMyOrg] = useState<{ org: OrgMe; voteSummary: OrgRegistrationVoteSummary } | null>(null);

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

  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth < 900);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  async function loadMyOrg() {
    if (!token || role !== "org_admin") return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/orgs/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) return;
      const data = (await response.json()) as { org: OrgMe; voteSummary: OrgRegistrationVoteSummary };
      setMyOrg(data);
    } catch {
      /* ignore */
    }
  }

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
      setSubmittedItems(data.items || []);
    } catch {
      setNotice("Backend unreachable.");
    } finally {
      setLoading(false);
    }
  }

  async function loadReviewWorkflows() {
    if (!token || role !== "org_admin") return;
    try {
      const [incomingResponse, historyResponse, pendingResponse, approvedResponse, rejectedResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/api/orgs/review/incoming`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${API_BASE_URL}/api/orgs/review/history`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${API_BASE_URL}/api/orgs/review/pending`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${API_BASE_URL}/api/orgs/review/approved`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${API_BASE_URL}/api/orgs/review/rejected`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      const incomingData = await incomingResponse.json();
      const historyData = await historyResponse.json();
      const pendingData = await pendingResponse.json();
      const approvedData = await approvedResponse.json();
      const rejectedData = await rejectedResponse.json();
      if (incomingResponse.ok) setIncomingItems(incomingData.items || []);
      if (historyResponse.ok) setVoteHistory(historyData.items || []);
      if (pendingResponse.ok) setPendingOrgs(pendingData.items || []);
      if (approvedResponse.ok) setApprovedOrgs(approvedData.items || []);
      if (rejectedResponse.ok) setRejectedOrgs(rejectedData.items || []);
    } catch {
      setNotice("Could not load org registration workflows.");
    }
  }

  useEffect(() => {
    void loadCertificates();
    void loadReviewWorkflows();
    void loadMyOrg();
  }, [token, role]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!token) return;
    const interval = window.setInterval(() => {
      void loadCertificates();
      void loadReviewWorkflows();
      void loadMyOrg();
    }, 15000);
    return () => window.clearInterval(interval);
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
        const msg =
          typeof data?.message === "string"
            ? data.message
            : typeof data?.error === "string"
              ? data.error
              : "Issue failed. Check input values, org approval, and IPFS (run infra:up or set IPFS_PINATA_JWT).";
        setNotice(msg);
        return;
      }
      setNotice(`Certificate issued: ${data.certUuid}`);
      setIssueForm((prev) => ({ ...prev, identifierValue: "", holderName: "", holderDob: "" }));
      await Promise.all([loadCertificates(), loadReviewWorkflows(), loadMyOrg()]);
    } catch {
      setNotice("Issue failed due to network/backend error.");
    }
  }

  async function submitVote(orgIdToReview: string, decision: "approve" | "deny") {
    if (!token) return;
    const reason = window.prompt(`Why do you ${decision} this organization?`, "");
    if (!reason || reason.trim().length < 3) {
      setNotice("Vote reason must be at least 3 characters.");
      return;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/api/orgs/${orgIdToReview}/vote`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ decision, reason: reason.trim() })
      });
      const data = await response.json();
      if (!response.ok) {
        setNotice("Vote failed. This organization may already be decided or you have already voted.");
        return;
      }
      setNotice(`Vote saved. Org status: ${data.status}. Approvals ${data.voteSummary.approvals}/${data.voteSummary.requiredMajority}.`);
      await Promise.all([loadCertificates(), loadReviewWorkflows(), loadMyOrg()]);
    } catch {
      setNotice("Vote failed due to network/backend error.");
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
      const digestShort =
        typeof data.manifestDigest === "string" && data.manifestDigest.length >= 16
          ? `${data.manifestDigest.slice(0, 8)}…${data.manifestDigest.slice(-6)}`
          : "N/A";
      const ipfsLine = data.ipfsCid ? ` | IPFS: ${data.ipfsCid}` : "";
      setVerifyResult(
        `Status: ${data.status} | Org: ${data.orgId} | Type: ${data.certType} | Tx: ${data.txHash || "N/A"} | Manifest: ${digestShort}${ipfsLine}`
      );
    } catch {
      setVerifyResult("Verification failed.");
    }
  }

  const title = useMemo(() => (role === "super_admin" ? "Super Admin Dashboard" : "Organization Dashboard"), [role]);
  const activeOrgId = orgId || "Not linked";
  const filteredSubmittedItems =
    submittedFilter === "all" ? submittedItems : submittedItems.filter((item) => item.status === submittedFilter);

  const issuanceBlocked =
    role === "org_admin" &&
    (!myOrg ||
      myOrg.org.status !== "approved" ||
      myOrg.org.accessState === "blocked" ||
      myOrg.org.accessState === "cooloff");

  const orgAwaitingVotes = role === "org_admin" && myOrg?.org.status === "pending_review";

  function statusColor(status: string) {
    if (status === "verified") return { bg: "#dcfce7", text: "#166534" };
    if (status === "pending_approval") return { bg: "#e0e7ff", text: "#3730a3" };
    if (status === "denied") return { bg: "#ffe4e6", text: "#9f1239" };
    if (status === "revoked") return { bg: "#fee2e2", text: "#991b1b" };
    return { bg: "#e5e7eb", text: "#111827" };
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#05070d",
        padding: isMobile ? "12px" : "28px",
        color: "#e2e8f0"
      }}
    >
      <div style={{ maxWidth: "1320px", margin: "0 auto", display: "grid", gap: "16px" }}>
        <section
          style={{
            background: "#0b1323",
            border: "3px solid #f8fafc",
            borderRadius: "0px",
            padding: "24px 26px",
            boxShadow: "12px 12px 0 #1e293b"
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexDirection: isMobile ? "column" : "row", alignItems: "flex-end" }}>
            <div>
              <p style={{ margin: 0, fontSize: "10px", letterSpacing: "0.28em", textTransform: "uppercase", color: "#94a3b8", fontWeight: 700 }}>
                Verification Control Layer
              </p>
              <h1 style={{ margin: "6px 0 0", fontSize: isMobile ? "28px" : "52px", fontWeight: 800, letterSpacing: "-0.04em", fontFamily: "Space Grotesk, Inter, sans-serif" }}>
                {title}.
              </h1>
              <p style={{ margin: "8px 0 0", color: "#cbd5e1" }}>
                New organizations need majority approval from the network before they can issue. Each certificate manifest is pinned to IPFS before it is stored.
              </p>
            </div>
            <div style={{ alignSelf: isMobile ? "flex-start" : "center", display: "grid", gap: "8px", textAlign: isMobile ? "left" : "right" }}>
              {orgAwaitingVotes ? (
                <div
                  style={{
                    padding: "10px 12px",
                    borderRadius: "0px",
                    background: "#422006",
                    border: "1px solid #fbbf24",
                    fontSize: "12px",
                    color: "#fef3c7",
                    fontWeight: 600,
                    maxWidth: "420px"
                  }}
                >
                  Pending network verification: your organization needs enough approval votes from other approved orgs (and the super-admin node) before you can issue certificates.{" "}
                  {myOrg
                    ? `Votes ${myOrg.voteSummary.approvals}/${myOrg.voteSummary.requiredMajority} approvals (eligible voters: ${myOrg.voteSummary.eligibleVoterCount}).`
                    : ""}
                </div>
              ) : null}
              <div style={{ padding: "10px 12px", borderRadius: "0px", background: "#0f172a", border: "1px solid #334155", fontSize: "11px", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.2em", fontWeight: 700 }}>
                Active Org: <span style={{ color: "#e2e8f0" }}>{activeOrgId}</span>
              </div>
            </div>
          </div>
          {role === "org_admin" ? (
            <div style={{ marginTop: "12px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button
                onClick={() => setSubmittedFilter("all")}
                style={{
                  padding: "8px 12px",
                  border: "1px solid rgba(117,124,125,0.3)",
                  background: submittedFilter === "all" ? "#e5e7eb" : "#f2f4f4",
                  color: "#2d3435",
                  fontSize: "11px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.16em"
                }}
              >
                All Submitted: {submittedItems.length}
              </button>
              <button
                onClick={() => void loadReviewWorkflows()}
                style={{
                  padding: "8px 12px",
                  border: "1px solid rgba(22,101,52,0.35)",
                  background: "#ecfdf3",
                  color: "#166534",
                  fontSize: "11px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.16em"
                }}
              >
                Incoming Pending: {incomingItems.length}
              </button>
            </div>
          ) : null}
        </section>

        <section style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "2fr 1.15fr", gap: "16px" }}>
          {role !== "super_admin" ? (
            <article style={{ background: "#0b1220", border: "3px solid #f8fafc", borderRadius: "0px", padding: "22px 22px", boxShadow: "12px 12px 0 #1e293b" }}>
              <p style={{ margin: "0 0 6px", fontSize: "10px", letterSpacing: "0.28em", textTransform: "uppercase", color: "#94a3b8", fontWeight: 700 }}>Issuance Console</p>
              <h2 style={{ margin: "0 0 14px", fontSize: "32px", fontFamily: "Space Grotesk, Inter, sans-serif", letterSpacing: "-0.03em" }}>Issue Certificate</h2>
              {issuanceBlocked ? (
                <p style={{ margin: 0, color: "#94a3b8", fontSize: "14px", lineHeight: 1.6 }}>
                  {!myOrg
                    ? "Loading organization status…"
                    : myOrg.org.status === "pending_review"
                      ? "Issuance is disabled until your organization receives enough approval votes from the network."
                      : myOrg.org.accessState === "blocked"
                        ? "This organization is blocked and cannot issue certificates."
                        : myOrg.org.accessState === "cooloff"
                          ? "This organization is in a cool-off period and cannot issue certificates."
                          : "You cannot issue certificates with the current organization state."}
                </p>
              ) : (
                <form onSubmit={onIssue} style={{ display: "grid", gap: "10px", gridTemplateColumns: isMobile ? "1fr" : "repeat(2,minmax(0,1fr))" }}>
                  <input value={issueForm.certType} onChange={(e) => setIssueForm((p) => ({ ...p, certType: e.target.value }))} placeholder="Certificate Type" required style={{ padding: "12px", border: "2px solid #f8fafc", borderRadius: "0px", background: "#05070d", color: "#e2e8f0" }} />
                  <input value={issueForm.identifierValue} onChange={(e) => setIssueForm((p) => ({ ...p, identifierValue: e.target.value }))} placeholder="Identifier Value" required style={{ padding: "12px", border: "2px solid #f8fafc", borderRadius: "0px", background: "#05070d", color: "#e2e8f0" }} />
                  <input value={issueForm.holderName} onChange={(e) => setIssueForm((p) => ({ ...p, holderName: e.target.value }))} placeholder="Holder Name" required style={{ padding: "12px", border: "2px solid #f8fafc", borderRadius: "0px", background: "#05070d", color: "#e2e8f0" }} />
                  <input type="date" value={issueForm.holderDob} onChange={(e) => setIssueForm((p) => ({ ...p, holderDob: e.target.value }))} placeholder="Holder DOB (YYYY-MM-DD)" required style={{ padding: "12px", border: "2px solid #f8fafc", borderRadius: "0px", background: "#05070d", color: "#e2e8f0" }} />
                  <input type="date" value={issueForm.issueDate} onChange={(e) => setIssueForm((p) => ({ ...p, issueDate: e.target.value }))} required style={{ padding: "12px", border: "2px solid #f8fafc", borderRadius: "0px", background: "#05070d", color: "#e2e8f0" }} />
                  <button type="submit" style={{ padding: "12px 14px", background: "#f8fafc", color: "#020617", border: "2px solid #f8fafc", borderRadius: "0px", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.2em", fontSize: "11px" }}>
                    Issue Certificate
                  </button>
                </form>
              )}
            </article>
          ) : (
            <article style={{ background: "#0b1220", border: "3px solid #f8fafc", borderRadius: "0px", padding: "22px 22px", boxShadow: "12px 12px 0 #1e293b" }}>
              <p style={{ margin: "0 0 6px", fontSize: "10px", letterSpacing: "0.28em", textTransform: "uppercase", color: "#94a3b8", fontWeight: 700 }}>Super Admin</p>
              <h2 style={{ margin: "0 0 10px", fontSize: "28px", fontFamily: "Space Grotesk, Inter, sans-serif", letterSpacing: "-0.03em" }}>Organization tools</h2>
              <p style={{ margin: 0, color: "#cbd5e1", fontSize: "14px", lineHeight: 1.5 }}>
                Certificate issuance is limited to approved organization accounts. Registration approvals now run through org-majority voting.
              </p>
            </article>
          )}

          <article style={{ background: "#0b1220", border: "3px solid #f8fafc", borderRadius: "0px", padding: "22px 22px", boxShadow: "12px 12px 0 #1e293b" }}>
            <p style={{ margin: "0 0 6px", fontSize: "10px", letterSpacing: "0.28em", textTransform: "uppercase", color: "#94a3b8", fontWeight: 700 }}>Verification Probe</p>
            <h2 style={{ margin: "0 0 14px", fontSize: "32px", fontFamily: "Space Grotesk, Inter, sans-serif", letterSpacing: "-0.03em" }}>Verify by UUID</h2>
            <form onSubmit={onVerifyByUuid} style={{ display: "flex", gap: "8px", flexDirection: "column" }}>
              <input value={verifyUuid} onChange={(e) => setVerifyUuid(e.target.value)} placeholder="Enter certificate UUID" style={{ padding: "12px", border: "2px solid #f8fafc", borderRadius: "0px", background: "#05070d", color: "#e2e8f0" }} />
              <button type="submit" style={{ padding: "12px 14px", background: "#f8fafc", color: "#020617", border: "2px solid #f8fafc", borderRadius: "0px", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.2em", fontSize: "11px" }}>
                Verify Certificate
              </button>
            </form>
            {verifyResult ? (
              <p style={{ marginTop: "12px", color: "#e2e8f0", fontSize: "13px", lineHeight: 1.5, background: "#0f172a", padding: "10px 12px", borderRadius: "0px", border: "1px solid #334155" }}>
                {verifyResult}
              </p>
            ) : null}
          </article>
        </section>

        <section style={{ background: "#0b1220", border: "3px solid #f8fafc", borderRadius: "0px", padding: "22px 22px", boxShadow: "12px 12px 0 #1e293b" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: isMobile ? "stretch" : "center", flexDirection: isMobile ? "column" : "row", gap: isMobile ? "10px" : 0 }}>
            <div>
              <p style={{ margin: "0 0 4px", fontSize: "10px", letterSpacing: "0.28em", textTransform: "uppercase", color: "#94a3b8", fontWeight: 700 }}>Ledger Index</p>
              <h2 style={{ margin: 0, fontSize: "32px", fontFamily: "Space Grotesk, Inter, sans-serif", letterSpacing: "-0.03em" }}>
                {role === "super_admin" ? "All Certificates" : "Your Certificate Status"}
              </h2>
            </div>
            <button onClick={() => void Promise.all([loadCertificates(), loadReviewWorkflows(), loadMyOrg()])} style={{ padding: "10px 12px", border: "2px solid #f8fafc", background: "#05070d", color: "#f8fafc", borderRadius: "0px", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.2em", fontSize: "10px" }}>
              Refresh
            </button>
          </div>
          {loading ? <p style={{ color: "#cbd5e1" }}>Loading certificates...</p> : null}
          {role === "org_admin" || role === "super_admin" ? (
            <div style={{ marginTop: "10px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button onClick={() => setSubmittedFilter("all")} style={{ padding: "7px 10px", border: "1px solid rgba(117,124,125,0.3)", background: submittedFilter === "all" ? "#e5e7eb" : "#fff", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.14em", fontWeight: 700 }}>All</button>
              <button onClick={() => setSubmittedFilter("verified")} style={{ padding: "7px 10px", border: "1px solid rgba(22,101,52,0.35)", background: submittedFilter === "verified" ? "#dcfce7" : "#fff", color: "#166534", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.14em", fontWeight: 700 }}>Verified</button>
              <button onClick={() => setSubmittedFilter("revoked")} style={{ padding: "7px 10px", border: "1px solid rgba(153,27,27,0.35)", background: submittedFilter === "revoked" ? "#fee2e2" : "#fff", color: "#991b1b", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.14em", fontWeight: 700 }}>Revoked</button>
            </div>
          ) : null}
          {!loading && filteredSubmittedItems.length === 0 ? <p style={{ color: "#cbd5e1" }}>No certificates for this filter.</p> : null}
          {!loading && filteredSubmittedItems.length > 0 ? (
            <div style={{ overflowX: "auto", marginTop: "10px" }}>
              <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
                <thead>
                  <tr style={{ background: "#0f172a" }}>
                    <th style={{ textAlign: "left", padding: "10px", borderTop: "1px solid rgba(117,124,125,0.2)", borderBottom: "1px solid rgba(117,124,125,0.2)", fontSize: "10px", color: "#596061", textTransform: "uppercase", letterSpacing: "0.2em" }}>UUID</th>
                    {role === "super_admin" ? (
                      <th style={{ textAlign: "left", padding: "10px", borderTop: "1px solid rgba(117,124,125,0.2)", borderBottom: "1px solid rgba(117,124,125,0.2)", fontSize: "10px", color: "#596061", textTransform: "uppercase", letterSpacing: "0.2em" }}>Org</th>
                    ) : null}
                    <th style={{ textAlign: "left", padding: "10px", borderTop: "1px solid rgba(117,124,125,0.2)", borderBottom: "1px solid rgba(117,124,125,0.2)", fontSize: "10px", color: "#596061", textTransform: "uppercase", letterSpacing: "0.2em" }}>Type</th>
                    <th style={{ textAlign: "left", padding: "10px", borderTop: "1px solid rgba(117,124,125,0.2)", borderBottom: "1px solid rgba(117,124,125,0.2)", fontSize: "10px", color: "#596061", textTransform: "uppercase", letterSpacing: "0.2em" }}>Issue Date</th>
                    <th style={{ textAlign: "left", padding: "10px", borderTop: "1px solid rgba(117,124,125,0.2)", borderBottom: "1px solid rgba(117,124,125,0.2)", fontSize: "10px", color: "#596061", textTransform: "uppercase", letterSpacing: "0.2em" }}>Status</th>
                    <th style={{ textAlign: "left", padding: "10px", borderTop: "1px solid rgba(117,124,125,0.2)", borderBottom: "1px solid rgba(117,124,125,0.2)", fontSize: "10px", color: "#596061", textTransform: "uppercase", letterSpacing: "0.2em" }}>IPFS</th>
                    <th style={{ textAlign: "left", padding: "10px", borderTop: "1px solid rgba(117,124,125,0.2)", borderBottom: "1px solid rgba(117,124,125,0.2)", fontSize: "10px", color: "#596061", textTransform: "uppercase", letterSpacing: "0.2em" }}>Identifier</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSubmittedItems.map((item) => {
                    const badge = statusColor(item.status);
                    return (
                      <tr key={item.certUuid}>
                        <td style={{ padding: "10px", borderBottom: "1px solid rgba(117,124,125,0.12)", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: "12px" }}>
                          {item.certUuid.slice(0, 8)}...{item.certUuid.slice(-6)}
                        </td>
                        {role === "super_admin" ? (
                          <td style={{ padding: "10px", borderBottom: "1px solid rgba(117,124,125,0.12)" }}>{item.orgId ?? "—"}</td>
                        ) : null}
                        <td style={{ padding: "10px", borderBottom: "1px solid rgba(117,124,125,0.12)" }}>{item.certType}</td>
                        <td style={{ padding: "10px", borderBottom: "1px solid rgba(117,124,125,0.12)" }}>{item.issueDate}</td>
                        <td style={{ padding: "10px", borderBottom: "1px solid rgba(117,124,125,0.12)" }}>
                          <span style={{ background: badge.bg, color: badge.text, borderRadius: "999px", padding: "4px 10px", fontSize: "10px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.14em" }}>
                            {item.status}
                          </span>
                        </td>
                        <td style={{ padding: "10px", borderBottom: "1px solid rgba(117,124,125,0.12)" }}>
                          {item.manifestUri ? (
                            <a href={item.manifestUri} target="_blank" rel="noreferrer" style={{ color: "#38bdf8", fontSize: "11px" }}>
                              {item.ipfsCid ? `${String(item.ipfsCid).slice(0, 10)}…` : "Open"}
                            </a>
                          ) : (
                            <span style={{ color: "#64748b", fontSize: "11px" }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: "10px", borderBottom: "1px solid rgba(117,124,125,0.12)" }}>{item.identifierMasked}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
          {notice ? <p style={{ marginTop: "10px", color: "#e2e8f0" }}>{notice}</p> : null}
        </section>

        {role === "org_admin" ? (
          <section style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3,minmax(0,1fr))", gap: "16px" }}>
            {[
              { title: "Awaiting network votes", items: pendingOrgs, tone: "#e0e7ff", text: "#3730a3" },
              { title: "Approved organizations", items: approvedOrgs, tone: "#dcfce7", text: "#166534" },
              { title: "Rejected organizations", items: rejectedOrgs, tone: "#ffe4e6", text: "#9f1239" }
            ].map((bucket) => (
              <article key={bucket.title} style={{ background: "#0b1220", border: "3px solid #f8fafc", borderRadius: "0px", padding: "22px 22px", boxShadow: "12px 12px 0 #1e293b" }}>
                <h2 style={{ margin: "0 0 12px", fontSize: "24px", fontFamily: "Space Grotesk, Inter, sans-serif", letterSpacing: "-0.03em" }}>{bucket.title}</h2>
                {bucket.items.length === 0 ? <p style={{ color: "#cbd5e1" }}>No organizations.</p> : null}
                <div style={{ display: "grid", gap: "10px" }}>
                  {bucket.items.map((item) => {
                    const canVote = incomingItems.some((x) => x.orgId === item.orgId);
                    return (
                      <div key={item.orgId} style={{ border: "1px solid #334155", padding: "12px", background: "#0f172a" }}>
                        <p style={{ margin: "0 0 6px", fontSize: "12px", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>Reg ID: {item.orgId}</p>
                        <p style={{ margin: "0 0 6px", color: "#cbd5e1", fontSize: "12px" }}>{item.name} | {item.city} | {item.orgType} | {item.sector}</p>
                        <p style={{ margin: "0 0 6px", color: "#cbd5e1", fontSize: "12px" }}>Admin: {item.adminEmail ?? "N/A"} | Certs: {item.certificateCount}</p>
                        <p style={{ margin: "0 0 6px", color: "#cbd5e1", fontSize: "12px" }}>
                          Registration:{" "}
                          {item.status === "pending_review"
                            ? `Pending verification (${item.voteSummary?.approvals ?? 0}/${item.voteSummary?.requiredMajority ?? "?"} approvals, ${item.voteSummary?.denials ?? 0} denials)`
                            : item.status === "approved"
                              ? "Approved by network majority"
                              : "Rejected"}
                        </p>
                        <p style={{ margin: "0 0 6px", color: "#cbd5e1", fontSize: "12px" }}>
                          On-chain org registry tx: {item.chainTxHash ? `${item.chainTxHash.slice(0, 12)}…` : item.status === "approved" ? "Pending worker" : "N/A until approved"}
                        </p>
                        <p style={{ margin: "0 0 6px", color: bucket.text, background: bucket.tone, display: "inline-block", padding: "3px 8px", fontSize: "10px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em" }}>
                          Access: {item.accessState}
                        </p>
                        {canVote ? (
                          <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                            <button onClick={() => void submitVote(item.orgId, "approve")} style={{ padding: "8px 10px", background: "#166534", color: "#fff", border: "none", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.16em", fontWeight: 700 }}>Approve</button>
                            <button onClick={() => void submitVote(item.orgId, "deny")} style={{ padding: "8px 10px", background: "#9f1239", color: "#fff", border: "none", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.16em", fontWeight: 700 }}>Deny</button>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </article>
            ))}
          </section>
        ) : null}
      </div>
    </main>
  );
}

