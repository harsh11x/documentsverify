import PDFDocument from "pdfkit";
import QRCode from "qrcode";

export type CertificatePdfInput = {
  orgName: string;
  certType: string;
  holderName: string;
  issueDate: string;
  certUuid: string;
  certHashHex: string;
  verificationAbsoluteUrl: string;
};

/** Branded A4 PDF with verification QR and integrity hash (no raw PII on chain; PDF is org-issued artifact). */
export async function buildCertificatePresentationPdf(input: CertificatePdfInput): Promise<Buffer> {
  const qrPng = await QRCode.toBuffer(input.verificationAbsoluteUrl, { type: "png", margin: 1, width: 168 });

  return await new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({
      size: "A4",
      margin: 44,
      info: { Title: "DocVerifyBlock Certificate", Author: "DocVerifyBlock", Subject: input.certType }
    });
    doc.on("data", (c) => chunks.push(c as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const w = doc.page.width;
    doc.rect(0, 0, w, 112).fill("#05070d");
    doc.fillColor("#f8fafc").fontSize(20).text("DocVerifyBlock", 44, 32, { width: w - 88, align: "center" });
    doc.fontSize(10).fillColor("#94a3b8").text("Tamper-evident credential record", 44, 62, { width: w - 88, align: "center" });

    let y = 132;
    doc.fillColor("#0f172a").fontSize(18).text("Certificate of Record", 44, y, { width: w - 88, align: "center" });
    y += 36;
    doc.fontSize(11).fillColor("#475569").text(input.orgName, 44, y, { width: w - 88, align: "center" });
    y += 40;

    doc.font("Helvetica").fontSize(11).fillColor("#334155").text("This is to certify that", 44, y);
    y += 20;
    doc.font("Helvetica-Bold").fontSize(15).fillColor("#020617").text(input.holderName, 44, y, { width: w - 88 });
    y += 30;
    doc.font("Helvetica").fontSize(11).fillColor("#334155").text("has been issued the following registered credential:", 44, y, {
      width: w - 88 - 180
    });
    doc.image(qrPng, w - 44 - 156, y - 8, { width: 156, height: 156 });
    y += 28;
    doc.font("Helvetica-Bold").fontSize(12).fillColor("#0f172a").text(input.certType, 44, y, { width: w - 88 - 180 });
    y += 36;
    doc.font("Helvetica").fontSize(10).fillColor("#475569").text(`Issue date: ${input.issueDate}`, 44, y);
    y += 18;
    doc.font("Courier").fontSize(8).fillColor("#64748b").text(`Certificate UUID: ${input.certUuid}`, 44, y, { width: w - 88 });
    y += 14;
    doc.text(`Stable record hash (SHA-256): ${input.certHashHex}`, 44, y, { width: w - 88 });
    y += 28;
    doc.font("Helvetica").fontSize(9).fillColor("#64748b").text(
      "Verify online: the QR resolves to public verification (personal data redacted on the web).",
      44,
      y,
      { width: w - 88 - 40 }
    );

    doc.end();
  });
}
