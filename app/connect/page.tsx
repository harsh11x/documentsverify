import Link from "next/link";

export default function ConnectPage() {
  return (
    <main style={{ minHeight: "100vh", background: "#f5f7fb", padding: "32px", color: "#111827" }}>
      <section style={{ maxWidth: "900px", margin: "0 auto", background: "#fff", border: "1px solid #e5e7eb", padding: "28px" }}>
        <h1 style={{ margin: 0, fontSize: "34px", fontWeight: 800 }}>Connect</h1>
        <p style={{ color: "#4b5563" }}>
          Connect with ecosystem partners, technical contributors, and verification network participants.
        </p>
        <ul>
          <li>Partner onboarding</li>
          <li>Developer collaboration</li>
          <li>Institution integration support</li>
        </ul>
        <p>
          <Link href="/">Back to Home</Link>
        </p>
      </section>
    </main>
  );
}
