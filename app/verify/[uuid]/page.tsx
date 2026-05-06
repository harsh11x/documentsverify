import Link from "next/link";
import { getApiBaseUrl } from "../../lib/api-base";

export default async function VerifyByUuidPage({ params }: { params: { uuid: string } }) {
  const response = await fetch(`${getApiBaseUrl()}/api/public/verify/${params.uuid}`, { cache: "no-store" });
  const data = await response.json().catch(() => null);

  return (
    <main style={{ minHeight: "100vh", background: "#f5f7fb", padding: "32px", color: "#111827" }}>
      <section style={{ maxWidth: "900px", margin: "0 auto", background: "#fff", border: "1px solid #e5e7eb", padding: "28px" }}>
        <h1 style={{ margin: 0, fontSize: "34px", fontWeight: 800 }}>Certificate Verification Result</h1>
        {!response.ok ? (
          <p>Certificate not found.</p>
        ) : (
          <ul>
            <li>Status: {data?.status}</li>
            <li>Org: {data?.orgId}</li>
            <li>Type: {data?.certType}</li>
            <li>Issue Date: {data?.issueDate}</li>
            <li>Tx Hash: {data?.txHash || "N/A"}</li>
          </ul>
        )}
        <p>
          <Link href="/certificate-verification">Back to verification</Link>
        </p>
      </section>
    </main>
  );
}
