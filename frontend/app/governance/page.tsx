import Link from "next/link";

export default function GovernancePage() {
  return (
    <main style={{ minHeight: "100vh", background: "#f5f7fb", padding: "32px", color: "#111827" }}>
      <section style={{ maxWidth: "900px", margin: "0 auto", background: "#fff", border: "1px solid #e5e7eb", padding: "28px" }}>
        <h1 style={{ margin: 0, fontSize: "34px", fontWeight: 800 }}>Governance</h1>
        <p style={{ color: "#4b5563" }}>
          Governance defines trust policies, reviewer controls, and operational decision workflows for the verification
          ecosystem.
        </p>
        <ul>
          <li>Approval and rejection policy model</li>
          <li>Role-based administration responsibilities</li>
          <li>Audit and change-management controls</li>
        </ul>
        <p>
          <Link href="/">Back to Home</Link>
        </p>
      </section>
    </main>
  );
}
