// app/modules/document-engine/qr-block.js
import { MM_TO_PT } from "./print-layout.js";

/**
 * @param {import("jspdf").jsPDF} doc
 * @param {string} text
 * @param {number} x
 * @param {number} y
 * @param {number} size in mm
 */
export function renderQRBlock(doc, text, x, y, size = 20) {
  if (typeof QRCode === "undefined") return y;

  const canvas = document.createElement("canvas");
  // eslint-disable-next-line no-undef
  QRCode.toCanvas(canvas, text, { width: Math.round(size * MM_TO_PT * 2), margin: 1 }, (err) => {
    if (err) return;
  });

  const dataUrl = canvas.toDataURL("image/png");
  doc.addImage(dataUrl, "PNG", x, y, size * MM_TO_PT, size * MM_TO_PT);
}
