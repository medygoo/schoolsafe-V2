// app/modules/document-engine/templates/receipt-template.js
// jsPDF is loaded globally via app/jspdf.umd.min.js as window.jspdf.jsPDF
import {
  A4_WIDTH_PT,
  A4_HEIGHT_PT,
  HALF_A4_HEIGHT_PT,
  MM_TO_PT,
  MARGINS,
  formatCurrency,
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

  function drawReceipt(yOffset, copyLabel) {
    // Header
    const headerBottom = renderDocumentHeader(doc, identity, "REÇU DE PAIEMENT", copyLabel);

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
      renderQRBlock(doc, payment.verificationCode, A4_WIDTH_PT - 28 * MM_TO_PT, qrY, 18);
      doc.setFontSize(7);
      doc.setTextColor(100, 100, 100);
      doc.text(`Vérification : ${payment.verificationCode}`, A4_WIDTH_PT - 28 * MM_TO_PT, qrY + 20 * MM_TO_PT);
    }

    // Signature block
    const sigY = qrY + 8 * MM_TO_PT;
    renderSignatureBlock(doc, ["Caisse", "Parent / Payeur"], MARGINS.left, sigY, A4_WIDTH_PT / 2 - MARGINS.left);

    // Footer
    renderDocumentFooter(doc, identity, { page: 1, totalPages: 1, generatedAt });
  }

  // First copy
  drawReceipt(0, options.copyFor || "Exemplaire établissement");

  // Cut line
  doc.setDrawColor(180, 180, 180);
  doc.setLineDash([3, 3], 0);
  doc.line(MARGINS.left, HALF_A4_HEIGHT_PT, A4_WIDTH_PT - MARGINS.right, HALF_A4_HEIGHT_PT);
  doc.setLineDash([], 0);

  // Second copy on the same A4, below the cut line.
  // Phase 1 uses an explicit offset renderer; Task 8 will refactor helpers to accept yOffset natively.

  await drawReceiptWithOffset(doc, identity, payment, receiptNumber, generatedAt, HALF_A4_HEIGHT_PT, "Exemplaire parent / payeur");

  return doc;
}

async function drawReceiptWithOffset(doc, identity, payment, receiptNumber, generatedAt, yOffset, copyLabel) {
  // Simplified second-copy render: reuse blocks but shifted.
  // For robustness, refactor renderDocumentHeader/footer/blocks to accept a yOffset.
  // Phase 1 shortcut: draw a minimal second copy using direct coordinates.

  const top = yOffset + 12 * MM_TO_PT;
  const primary = identity.primaryColor || "#071a3d";
  const rgb = hexToRgb(primary);

  doc.setFillColor(rgb.r, rgb.g, rgb.b);
  doc.rect(0, yOffset, A4_WIDTH_PT, 28 * MM_TO_PT, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(identity.name, 15 * MM_TO_PT, top - 1 * MM_TO_PT);

  doc.setFontSize(18);
  doc.setTextColor(0, 0, 0);
  doc.text("REÇU DE PAIEMENT", A4_WIDTH_PT / 2, yOffset + 36 * MM_TO_PT, { align: "center" });
  doc.setFontSize(10);
  doc.text(copyLabel, A4_WIDTH_PT / 2, yOffset + 41 * MM_TO_PT, { align: "center" });

  const metaX = A4_WIDTH_PT - MARGINS.right;
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text(`N° ${receiptNumber}`, metaX, yOffset + 28 * MM_TO_PT, { align: "right" });
  doc.text(`Date : ${formatDate(generatedAt)}`, metaX, yOffset + 32 * MM_TO_PT, { align: "right" });

  const y = yOffset + 50 * MM_TO_PT;
  renderStudentIdentityBlock(doc, payment.student, MARGINS.left, y);
  renderPaymentBlock(doc, payment, A4_WIDTH_PT / 2, y, A4_WIDTH_PT / 2 - MARGINS.right);

  renderSignatureBlock(doc, ["Caisse", "Parent / Payeur"], MARGINS.left, yOffset + 110 * MM_TO_PT, A4_WIDTH_PT / 2 - MARGINS.left);

  // Footer for second copy
  const footerY = yOffset + HALF_A4_HEIGHT_PT - 12 * MM_TO_PT;
  doc.setDrawColor(200, 200, 200);
  doc.line(MARGINS.left, footerY - 2 * MM_TO_PT, A4_WIDTH_PT - MARGINS.right, footerY - 2 * MM_TO_PT);
  doc.setFontSize(8);
  doc.setTextColor(60, 60, 60);
  doc.text(identity.name, A4_WIDTH_PT / 2, footerY, { align: "center" });
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.text(`Document généré par SchoolSafe — ${formatDate(generatedAt)}`, A4_WIDTH_PT / 2, footerY + 5 * MM_TO_PT, { align: "center" });
}

function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  const bigint = parseInt(clean, 16);
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255,
  };
}
