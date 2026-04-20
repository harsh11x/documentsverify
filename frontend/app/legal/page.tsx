import Link from "next/link";

export default function LegalPage() {
  return (
    <main style={{ minHeight: "100vh", background: "#f5f7fb", padding: "32px", color: "#111827" }}>
      <section style={{ maxWidth: "900px", margin: "0 auto", background: "#fff", border: "1px solid #e5e7eb", padding: "28px" }}>
        <h1 style={{ margin: 0, fontSize: "34px", fontWeight: 800 }}>Legal</h1>
        <p style={{ color: "#4b5563" }}>
          This page outlines usage terms, verification disclaimer boundaries, and privacy obligations for platform users.
        </p>
        <ul>
          <li>Terms of service and acceptable use</li>
          <li>Data retention and privacy controls</li>
          <li>Certificate verification liability scope</li>
        </ul>
        <p>
          <Link href="/">Back to Home</Link>
        </p>
      </section>
    </main>
  );
}
