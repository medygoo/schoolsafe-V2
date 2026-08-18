// app/modules/document-engine/templates/receipt-template.js
// jsPDF is loaded globally via app/jspdf.umd.min.js as window.jspdf.jsPDF
import {
  A4_WIDTH_PT,
  HALF_A4_HEIGHT_PT,
  MM_TO_PT,
  MARGINS,
  formatDate,
} from "../print-layout.js";
import { renderDocumentHeader } from "../document-header.js";
import { renderDocumentFooter } from "../document-footer.js";
import { renderStudentIdentityBlock } from "../identity-blocks.js";
import { renderPaymentBlock } from "../payment-block.js";
import { renderSignatureBlock } from "../signature-block.js";
import { renderQRBlock } from "../qr-block.js";

/**
 * @param {import("../school-identity-provider.js").SchoolIdentity} identity
 * @param {object} payment
 * @param {string} receiptNumber
 * @param {{copyFor?:string}} [options]
 * @returns {Promise<import("jspdf").jsPDF>}
 */
export async function renderReceipt(identity, payment, receiptNumber, options = {}) {
  const jsPDF = window.jspdf && window.jspdf.jsPDF;
  if (!jsPDF) throw new Error("jsPDF not loaded");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const generatedAt = new Date();

  async function drawReceipt(yOffset, copyLabel) {
    // Header
    const headerBottom = await renderDocumentHeader(doc, identity, "REÇU DE PAIEMENT", copyLabel, yOffset);

    // Receipt metadata
    const metaX = A4_WIDTH_PT - MARGINS.right;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);
    doc.text(`N° ${receiptNumber}`, metaX, headerBottom - 8 * MM_TO_PT, { align: "right" });
    doc.text(`Date : ${formatDate(generatedAt)}`, metaX, headerBottom - 4 * MM_TO_PT, { align: "right" });
    if (identity.activeAcademicYear) {
      doc.text(`Année scolaire : ${identity.activeAcademicYear.label}`, metaX, headerBottom, { align: "right" });
    }

    // Student block
    let y = headerBottom + 10 * MM_TO_PT;
    renderStudentIdentityBlock(doc, payment.student, MARGINS.left, y);

    // Payment block
    const payY = renderPaymentBlock(doc, payment, A4_WIDTH_PT / 2, y, A4_WIDTH_PT / 2 - MARGINS.right);

    // QR / verification
    const qrY = Math.max(payY, y + 35 * MM_TO_PT);
    if (payment.verificationCode) {
      await renderQRBlock(doc, payment.verificationCode, A4_WIDTH_PT - 28 * MM_TO_PT, qrY, 18);
      doc.setFontSize(7);
      doc.setTextColor(100, 100, 100);
      doc.text(`Vérification : ${payment.verificationCode}`, A4_WIDTH_PT - 28 * MM_TO_PT, qrY + 20 * MM_TO_PT);
    }

    // Signature block
    const sigY = qrY + 8 * MM_TO_PT;
    renderSignatureBlock(doc, ["Caisse", "Parent / Payeur"], MARGINS.left, sigY, A4_WIDTH_PT / 2 - MARGINS.left);

    // Footer
    renderDocumentFooter(doc, identity, { page: 1, totalPages: 1, generatedAt, yOffset });
  }

  // First copy
  await drawReceipt(0, options.copyFor || "Exemplaire établissement");

  // Cut line
  doc.setDrawColor(180, 180, 180);
  doc.setLineDash([3, 3], 0);
  doc.line(MARGINS.left, HALF_A4_HEIGHT_PT, A4_WIDTH_PT - MARGINS.right, HALF_A4_HEIGHT_PT);
  doc.setLineDash([], 0);

  // Second copy on the same A4, below the cut line.
  await drawReceipt(HALF_A4_HEIGHT_PT, "Exemplaire parent / payeur");

  return doc;
}
