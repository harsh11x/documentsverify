import Link from "next/link";

export default function ContactPage() {
  return (
    <main style={{ minHeight: "100vh", background: "#f5f7fb", padding: "32px", color: "#111827" }}>
      <section style={{ maxWidth: "900px", margin: "0 auto", background: "#fff", border: "1px solid #e5e7eb", padding: "28px" }}>
        <h1 style={{ margin: 0, fontSize: "34px", fontWeight: 800 }}>Contact</h1>
        <p style={{ color: "#4b5563" }}>Reach out for platform onboarding, technical support, or partnership discussions.</p>
        <ul>
          <li>Email: support@docverify.local</li>
          <li>Ops Hours: Mon-Fri, 09:00-18:00 UTC</li>
          <li>Response SLA: within 1 business day</li>
        </ul>
        <p>
          <Link href="/">Back to Home</Link>
        </p>
      </section>
    </main>
  );
}
