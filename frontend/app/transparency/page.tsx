import Link from "next/link";

export default function TransparencyPage() {
  return (
    <main style={{ minHeight: "100vh", background: "#f5f7fb", padding: "32px", color: "#111827" }}>
      <section style={{ maxWidth: "900px", margin: "0 auto", background: "#fff", border: "1px solid #e5e7eb", padding: "28px" }}>
        <h1 style={{ margin: 0, fontSize: "34px", fontWeight: 800 }}>Transparency</h1>
        <p style={{ color: "#4b5563" }}>
          We publish system behavior, verification guarantees, and operational principles for accountable credential
          verification.
        </p>
        <ul>
          <li>Verification status semantics</li>
          <li>Revocation handling and audit trace</li>
          <li>Security and privacy commitments</li>
        </ul>
        <p>
          <Link href="/">Back to Home</Link>
        </p>
      </section>
    </main>
  );
}
