export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#05070d",
        padding: "48px 20px"
      }}
    >
      <section
        style={{
          maxWidth: "1080px",
          margin: "0 auto",
          background: "#0b1220",
          border: "3px solid #e2e8f0",
          padding: "38px",
          boxShadow: "14px 14px 0 #1e293b"
        }}
      >
        <p style={{ margin: 0, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.18em", fontSize: "11px" }}>
          blockchain certificate verification
        </p>
        <h1 style={{ margin: "12px 0 10px", fontSize: "46px", fontWeight: 900, color: "#f8fafc", letterSpacing: "-0.03em" }}>
          DocVerify
        </h1>
        <p style={{ marginTop: 0, color: "#cbd5e1", maxWidth: "700px", lineHeight: 1.6 }}>
          Production-ready issuance, decentralized approvals, and privacy-safe certificate verification with live backend and chain flows.
        </p>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "26px" }}>
          <a href="/certificate-verification" style={{ padding: "11px 14px", background: "#f8fafc", border: "2px solid #f8fafc", color: "#020617", textDecoration: "none", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em" }}>Verify certificate</a>
          <a href="/signup" style={{ padding: "11px 14px", background: "#0b1220", border: "2px solid #f8fafc", color: "#f8fafc", textDecoration: "none", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em" }}>Organization signup</a>
          <a href="/login" style={{ padding: "11px 14px", background: "#0b1220", border: "2px solid #f8fafc", color: "#f8fafc", textDecoration: "none", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em" }}>Login</a>
          <a href="/dashboard" style={{ padding: "11px 14px", background: "#0b1220", border: "2px solid #f8fafc", color: "#f8fafc", textDecoration: "none", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em" }}>Dashboard</a>
        </div>
      </section>
    </main>
  );
}
