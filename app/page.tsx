export default function Home() {
  return (
    <main style={{ minHeight: "100vh", background: "#f5f7fb", padding: "32px", color: "#111827" }}>
      <section style={{ maxWidth: "900px", margin: "0 auto", background: "#fff", border: "1px solid #e5e7eb", padding: "28px" }}>
        <h1 style={{ margin: 0, fontSize: "34px", fontWeight: 800 }}>DocVerify</h1>
        <p style={{ color: "#4b5563" }}>
          Issue, approve, and verify certificates against live backend and blockchain-connected workflows.
        </p>
        <ul>
          <li><a href="/certificate-verification">Certificate verification</a></li>
          <li><a href="/signup">Organization signup</a></li>
          <li><a href="/login">Login</a></li>
          <li><a href="/dashboard">Dashboard</a></li>
        </ul>
      </section>
    </main>
  );
}
