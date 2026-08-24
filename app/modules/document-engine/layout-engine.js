// app/modules/document-engine/layout-engine.js
// Page dimensions, header, footer and pagination.

export const MM_TO_PT = 2.83465;

export const LAYOUTS = Object.freeze({
  A4_PORTRAIT: {
    name: "a4-portrait",
    dimensions: { width: 210 * MM_TO_PT, height: 297 * MM_TO_PT, unit: "pt" },
    margins: { top: 15 * MM_TO_PT, right: 15 * MM_TO_PT, bottom: 20 * MM_TO_PT, left: 15 * MM_TO_PT },
  },
  A4_LANDSCAPE: {
    name: "a4-landscape",
    dimensions: { width: 297 * MM_TO_PT, height: 210 * MM_TO_PT, unit: "pt" },
    margins: { top: 15 * MM_TO_PT, right: 15 * MM_TO_PT, bottom: 20 * MM_TO_PT, left: 15 * MM_TO_PT },
  },
  A5_PORTRAIT: {
    name: "a5-portrait",
    dimensions: { width: 148 * MM_TO_PT, height: 210 * MM_TO_PT, unit: "pt" },
    margins: { top: 12 * MM_TO_PT, right: 12 * MM_TO_PT, bottom: 15 * MM_TO_PT, left: 12 * MM_TO_PT },
  },
  A5_RECEIPT: {
    name: "a5-receipt",
    dimensions: { width: 148 * MM_TO_PT, height: 210 * MM_TO_PT, unit: "pt" },
    margins: { top: 10 * MM_TO_PT, right: 10 * MM_TO_PT, bottom: 12 * MM_TO_PT, left: 10 * MM_TO_PT },
  },
  A4_TWO_UP_A5: {
    name: "a4-two-up-a5",
    dimensions: { width: 210 * MM_TO_PT, height: 297 * MM_TO_PT, unit: "pt" },
    margins: { top: 10 * MM_TO_PT, right: 10 * MM_TO_PT, bottom: 10 * MM_TO_PT, left: 10 * MM_TO_PT },
    isTwoUp: true,
  },
  STUDENT_CARD_HORIZONTAL: {
    name: "student-card-horizontal",
    dimensions: { width: 86 * MM_TO_PT, height: 54 * MM_TO_PT, unit: "pt" },
    margins: { top: 3 * MM_TO_PT, right: 3 * MM_TO_PT, bottom: 3 * MM_TO_PT, left: 3 * MM_TO_PT },
  },
  STUDENT_BADGE_VERTICAL: {
    name: "student-badge-vertical",
    dimensions: { width: 54 * MM_TO_PT, height: 86 * MM_TO_PT, unit: "pt" },
    margins: { top: 3 * MM_TO_PT, right: 3 * MM_TO_PT, bottom: 3 * MM_TO_PT, left: 3 * MM_TO_PT },
  },
});

export function createLayoutEngine(options = {}) {
  const defaultLayoutName = options.defaultLayout || LAYOUTS.A4_PORTRAIT.name;

  return {
    /**
     * @param {string} layoutName
     * @returns {import("./render-context.js").LayoutContext}
     */
    getLayout(layoutName) {
      const key = Object.keys(LAYOUTS).find((k) => LAYOUTS[k].name === (layoutName || defaultLayoutName));
      const layout = key ? LAYOUTS[key] : LAYOUTS.A4_PORTRAIT;
      return { ...layout };
    },

    getDimensions(layoutName) {
      return this.getLayout(layoutName).dimensions;
    },

    /**
     * @param {import("./render-context.js").RenderContext} ctx
     * @param {import("./contracts.js").DocumentModel} model
     */
    applyHeader(ctx, model) {
      const dims = ctx.getDimensions();
      const primary = model.school.primaryColor || "#071a3d";
      const rgb = hexToRgb(primary);
      const h = 28 * MM_TO_PT;

      ctx.drawRect(0, 0, dims.width, h, { fill: rgb });

      // School name
      ctx.drawText(model.school.name, 15 * MM_TO_PT, 11 * MM_TO_PT, {
        fontSize: 16,
        fontStyle: "bold",
        color: "#ffffff",
        maxWidth: dims.width - 30 * MM_TO_PT,
      });

      // Contact line
      const parts = [model.school.address, model.school.city, model.school.phone, model.school.email].filter(Boolean);
      ctx.drawText(parts.join(" · "), 15 * MM_TO_PT, 16 * MM_TO_PT, {
        fontSize: 8,
        color: "#ffffff",
        maxWidth: dims.width - 30 * MM_TO_PT,
      });
    },

    /**
     * @param {import("./render-context.js").RenderContext} ctx
     * @param {import("./contracts.js").DocumentModel} model
     */
    applyFooter(ctx, model) {
      const dims = ctx.getDimensions();
      const footerY = dims.height - 12 * MM_TO_PT;

      ctx.drawLine(15 * MM_TO_PT, footerY - 2 * MM_TO_PT, dims.width - 15 * MM_TO_PT, footerY - 2 * MM_TO_PT, { color: "#cccccc" });

      const parts = [model.school.name, model.school.address, model.school.city, model.school.phone, model.school.email].filter(Boolean);
      ctx.drawText(parts.join(" · "), dims.width / 2, footerY, {
        fontSize: 8,
        align: "center",
        maxWidth: dims.width - 30 * MM_TO_PT,
      });

      const generatedAt = model.meta.generatedAt || model.meta.createdAt;
      ctx.drawText(`Document généré par SchoolSafe — ${formatDate(generatedAt, model.meta.locale)}`, dims.width / 2, footerY + 5 * MM_TO_PT, {
        fontSize: 7,
        align: "center",
        color: "#888888",
        maxWidth: dims.width - 30 * MM_TO_PT,
      });
    },

    /**
     * @param {import("./render-context.js").RenderContext} ctx
     * @param {import("./contracts.js").DocumentModel} model
     * @param {{page:number, totalPages:number}} pagination
     */
    applyPageNumber(ctx, model, pagination) {
      const dims = ctx.getDimensions();
      const footerY = dims.height - 12 * MM_TO_PT;
      ctx.drawText(`Page ${pagination.page} / ${pagination.totalPages}`, dims.width - 15 * MM_TO_PT, footerY + 4 * MM_TO_PT, {
        fontSize: 8,
        align: "right",
      });
    },
  };
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

function formatDate(isoString, locale) {
  const d = new Date(isoString);
  return new Intl.DateTimeFormat(locale || "fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
}
