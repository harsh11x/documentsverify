import Link from "next/link";

export default function AdminHome() {
  const mainAppUrl = process.env.NEXT_PUBLIC_MAIN_APP_URL || "http://localhost:3000";
  return (
    <main style={{ minHeight: "100vh", background: "#f5f7fb", padding: "32px", color: "#111827" }}>
      <section style={{ maxWidth: "900px", margin: "0 auto", background: "#fff", border: "1px solid #e5e7eb", padding: "28px" }}>
        <h1 style={{ margin: 0, fontSize: "34px", fontWeight: 800 }}>Admin Panel</h1>
        <p style={{ color: "#4b5563" }}>
          Use the main application dashboard for live organization approval and certificate operations.
        </p>
        <p>
          <Link href={`${mainAppUrl}/dashboard`}>Open main dashboard</Link>
        </p>
      </section>
    </main>
  );
}
