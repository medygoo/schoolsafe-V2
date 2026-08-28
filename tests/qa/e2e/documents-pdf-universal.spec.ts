import { test, expect } from "@playwright/test";

test.describe("J2 — PDF universel", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/index.html");
  });

  test("sélectionne automatiquement A4 portrait, paysage et A5", async ({ page }) => {
    const layouts = await page.evaluate(async () => {
      const { selectUniversalLayout } = await import("/modules/document-engine/index.js");
      return {
        report: selectUniversalLayout({ kind: "report", columnCount: 2 }),
        table: selectUniversalLayout({ kind: "table", columnCount: 7 }),
        receipt: selectUniversalLayout({ kind: "receipt", columnCount: 2 }),
      };
    });

    expect(layouts).toEqual({
      report: "a4-portrait",
      table: "a4-landscape",
      receipt: "a5-receipt",
    });
  });

  test("rend un registre multipage avec identités, métadonnées et aperçu", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const textLog: string[] = [];
      const imageLog: string[] = [];

      class FakeDoc {
        pages = 1;
        currentPage = 1;
        internal = { getNumberOfPages: () => this.pages };
        constructor(public options: any = {}) {}
        setFillColor() {}
        setDrawColor() {}
        setTextColor() {}
        setFontSize() {}
        setFont() {}
        setLineDash() {}
        rect() {}
        line() {}
        text(value: string) { textLog.push(String(value)); }
        addImage(value: string) { imageLog.push(String(value)); }
        addPage() { this.pages += 1; this.currentPage = this.pages; }
        setPage(pageNumber: number) { this.currentPage = pageNumber; }
        setProperties() {}
        output() { return new Blob(["pdf"], { type: "application/pdf" }); }
      }

      (window as any).jspdf = { jsPDF: FakeDoc };
      const originalCreateObjectUrl = URL.createObjectURL;
      URL.createObjectURL = () => "blob://universal-pdf";

      try {
        const {
          createFrontendRenderer,
          createLayoutEngine,
          createUniversalDocumentTemplate,
          DOCUMENT_AUTHORITY_LEVELS,
          DOCUMENT_FORMATS,
        } = await import("/modules/document-engine/index.js");

        const template = createUniversalDocumentTemplate({
          type: "operations-register",
          label: "Registre des opérations",
          sourceModule: "accounting",
          kind: "register",
          permissions: ["reports.financial.read"],
          columns: Array.from({ length: 7 }, (_, index) => ({ header: `Colonne ${index + 1}`, width: 95 })),
        });
        const renderer = createFrontendRenderer({ layoutEngine: createLayoutEngine() });
        const model = {
          meta: {
            documentType: "operations-register",
            documentLabel: "Registre des opérations",
            reference: "REG-2026-001",
            version: 1,
            status: "draft",
            sensitivity: "confidential",
            authority: DOCUMENT_AUTHORITY_LEVELS.PREVIEW,
            generatedBy: "frontend",
            generatedAt: "2026-08-28T12:00:00.000Z",
            createdAt: "2026-08-28T12:00:00.000Z",
            locale: "fr-FR",
            formats: [DOCUMENT_FORMATS.PDF],
            layout: template.info.defaultLayout,
            author: { id: "u1", name: "A. Test", role: "accountant" },
          },
          school: {
            name: "École Pilote",
            logoUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z7yQAAAAASUVORK5CYII=",
            phone: "+243 999 000 111",
            email: "contact@ecole.test",
            website: "https://ecole.test",
            address: "12 avenue de la Paix",
            city: "Kinshasa",
            primaryColor: "#071a3d",
            documentFooter: "Former, protéger, réussir",
          },
          schoolsafe: {
            name: "SchoolSafe",
            website: "https://schoolsafe.app",
            documentFooter: "Solution SchoolSafe",
            legalMention: "Document généré par SchoolSafe",
          },
          content: {
            title: "Registre des opérations",
            rows: Array.from({ length: 90 }, (_, row) => Array.from({ length: 7 }, (_, col) => `${row + 1}-${col + 1}`)),
          },
          _template: template,
        };

        const output = await renderer.render(model as any, DOCUMENT_FORMATS.PDF);
        return { output, textLog, imageLog };
      } finally {
        URL.createObjectURL = originalCreateObjectUrl;
      }
    });

    expect(result.output.layout).toBe("a4-landscape");
    expect(result.output.dimensions.width).toBeGreaterThan(result.output.dimensions.height);
    expect(result.output.pages).toBeGreaterThan(1);
    expect(result.imageLog).toContain("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z7yQAAAAASUVORK5CYII=");

    const renderedText = result.textLog.join(" | ");
    for (const expected of [
      "École Pilote",
      "+243 999 000 111",
      "contact@ecole.test",
      "https://ecole.test",
      "Former, protéger, réussir",
      "SchoolSafe",
      "REG-2026-001",
      "Registre des opérations",
      "BROUILLON",
      "CONFIDENTIEL",
      `Page 1 / ${result.output.pages}`,
      `Page ${result.output.pages} / ${result.output.pages}`,
    ]) {
      expect(renderedText).toContain(expected);
    }
    expect(renderedText).not.toContain("OFFICIEL");
  });

  test("annonce honnêtement le faux XLSX historique", async ({ page }) => {
    const note = await page.evaluate(async () => {
      const { createFrontendRenderer, createLayoutEngine, DOCUMENT_FORMATS } = await import("/modules/document-engine/index.js");
      const renderer = createFrontendRenderer({ layoutEngine: createLayoutEngine() });
      const model = {
        meta: {
          documentType: "table-test", reference: "DRAFT", version: 1, locale: "fr-FR",
          formats: [DOCUMENT_FORMATS.PDF, DOCUMENT_FORMATS.XLSX], author: { name: "Test" },
        },
        content: { rows: [["A"]] },
        _schema: { columns: [{ header: "Valeur" }] },
      };
      const output = await renderer.render(model as any, DOCUMENT_FORMATS.XLSX);
      return output.note;
    });

    expect(note).toContain("placeholder");
    expect(note).toContain("real Excel");
  });
});
