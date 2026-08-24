// tests/document-engine/dummy-templates.js
// Fake templates for engine skeleton testing.

import { formatCurrency, formatDate } from "../../app/modules/document-engine/file-policy.js";

export const dummyReceiptTemplate = {
  info: {
    type: "dummy-receipt",
    label: "Reçu de test",
    sourceModule: "finance",
    nature: "DOCUMENT",
    defaultFormats: ["pdf"],
    supportedFormats: ["pdf"],
    defaultLayout: "a5-receipt",
    permissions: ["finance.receipt.read"],
    templateVersion: "1.0.0",
  },
  async render(ctx, model, layout) {
    const p = model.content.payment || {};
    const s = model.content.student || {};
    const x = layout.margins.left;
    let y = layout.contentTop || layout.margins.top + 40;

    ctx.drawText("REÇU DE PAIEMENT — TEST", x, y, { fontSize: 14, fontStyle: "bold" });
    y += 20;

    ctx.drawText(`Élève : ${s.firstName || ""} ${s.lastName || ""}`, x, y, { fontSize: 10 });
    y += 14;
    ctx.drawText(`Montant payé : ${formatCurrency(p.amountPaid, model.school.currency, model.meta.locale)}`, x, y, { fontSize: 10 });
    y += 14;
    ctx.drawText(`Date : ${formatDate(p.paidAt, model.meta.locale)}`, x, y, { fontSize: 10 });
    y += 14;

    if (p.verificationCode) {
      await ctx.drawQR(p.verificationCode, x, y, 18);
      ctx.drawText(`Vérification : ${p.verificationCode}`, x, y + 58, { fontSize: 7, color: "#666666" });
    }
  },
};

export const dummyCardTemplate = {
  info: {
    type: "dummy-card",
    label: "Carte élève de test",
    sourceModule: "security",
    nature: "CARTE/BADGE",
    defaultFormats: ["pdf", "png"],
    supportedFormats: ["pdf", "png"],
    defaultLayout: "student-card-horizontal",
    permissions: ["security.card.create"],
    templateVersion: "1.0.0",
  },
  async render(ctx, model, layout) {
    const s = model.content.student || {};
    const x = layout.margins.left;
    let y = layout.margins.top + 10;

    ctx.drawText(model.school.name, x, y, { fontSize: 8, fontStyle: "bold", color: model.school.primaryColor || "#071a3d" });
    y += 12;

    ctx.drawText(`${s.firstName || ""} ${s.lastName || ""}`, x, y, { fontSize: 10, fontStyle: "bold" });
    y += 12;
    ctx.drawText(`Matricule : ${s.matricule || "-"}`, x, y, { fontSize: 8 });
    y += 12;
    ctx.drawText(`Classe : ${s.className || "-"}`, x, y, { fontSize: 8 });
    y += 12;

    if (s.photoUrl) {
      await ctx.drawImage(s.photoUrl, x + 90, layout.margins.top + 6, 22, 28);
    }

    if (s.cardNumber) {
      await ctx.drawQR(`schoolsafe://card/${s.cardNumber}`, x, y, 12);
    }
  },
};

export const dummyListTemplate = {
  info: {
    type: "dummy-list",
    label: "Liste de test",
    sourceModule: "finance",
    nature: "REGISTRE/LISTE IMPRIMABLE",
    defaultFormats: ["pdf", "csv", "xlsx"],
    supportedFormats: ["pdf", "csv", "xlsx"],
    defaultLayout: "a4-portrait",
    permissions: ["finance.report.read"],
    templateVersion: "1.0.0",
  },
  schema: {
    title: "Journal de caisse — test",
    columns: [
      { header: "Reçu", width: 80, align: "left" },
      { header: "Élève", width: 150, align: "left" },
      { header: "Montant", width: 80, align: "right" },
      { header: "Mode", width: 80, align: "left" },
    ],
  },
};
