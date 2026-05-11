import Link from "next/link";
import { getApiBaseUrl } from "../../lib/api-base";

export default async function VerifyByUuidPage({ params }: { params: { uuid: string } }) {
  const response = await fetch(`${getApiBaseUrl()}/api/public/verify/${params.uuid}`, { cache: "no-store" });
  const data = await response.json().catch(() => null);

  return (
    <main style={{ minHeight: "100vh", background: "#05070d", padding: "24px", color: "#e2e8f0" }}>
      <section style={{ maxWidth: "900px", margin: "0 auto", background: "#0b1220", border: "3px solid #f8fafc", padding: "28px", boxShadow: "12px 12px 0 #1e293b" }}>
        <h1 style={{ margin: 0, fontSize: "34px", fontWeight: 800, color: "#f8fafc" }}>Certificate Verification Result</h1>
        {!response.ok ? (
          <p style={{ color: "#fda4af" }}>Certificate not found.</p>
        ) : (
          <ul style={{ color: "#cbd5e1", lineHeight: 1.8, listStyle: "none", padding: 0 }}>
            <li>Status: {data?.status}</li>
            <li>Org: {data?.orgId}</li>
            <li>Type: {data?.certType}</li>
            <li>Issue Date: {data?.issueDate}</li>
            <li>Tx Hash: {data?.txHash || "N/A"}</li>
            {typeof data?.manifestUri === "string" ? (
              <li>
                Manifest (IPFS):{" "}
                <a href={data.manifestUri} style={{ color: "#38bdf8" }} target="_blank" rel="noreferrer">
                  Open JSON
                </a>
              </li>
            ) : null}
            {typeof data?.presentationUri === "string" ? (
              <li>
                Branded certificate (PDF):{" "}
                <a href={data.presentationUri} style={{ color: "#a78bfa" }} target="_blank" rel="noreferrer">
                  Download / view
                </a>
              </li>
            ) : null}
          </ul>
        )}
        <p>
          <Link href="/certificate-verification">Back to verification</Link>
        </p>
      </section>
    </main>
  );
}
