import Link from "next/link";

export default function WhitepaperPage() {
  return (
    <main style={{ minHeight: "100vh", background: "#f5f7fb", padding: "32px", color: "#111827" }}>
      <section style={{ maxWidth: "900px", margin: "0 auto", background: "#fff", border: "1px solid #e5e7eb", padding: "28px" }}>
        <h1 style={{ margin: 0, fontSize: "34px", fontWeight: 800 }}>Whitepaper</h1>
        <p style={{ color: "#4b5563" }}>
          DocVerify architecture summary: verifiable certificate issuance, privacy-aware storage, and trustable public
          verification workflows.
        </p>
        <ul>
          <li>Issuance and revocation lifecycle</li>
          <li>On-chain anchors with off-chain protected metadata</li>
          <li>Public verification and auditability</li>
        </ul>
        <p>
          <Link href="/">Back to Home</Link>
        </p>
      </section>
    </main>
  );
}
