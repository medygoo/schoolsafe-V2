// tests/document-engine/receipt-engine-test.mjs
// DOC-04 — Tests du reçu de paiement A5 dans le Document Engine.

import { strict as assert } from "assert";
import {
  createDocumentEngine,
  createDocumentRequest,
  createAccessGate,
  createDocumentDataResolver,
  createSchoolSafeIdentityProvider,
  createTemplateRegistry,
  createLayoutEngine,
  createFrontendRenderer,
  registerDefaultTemplates,
  DOCUMENT_ACTIONS,
  DOCUMENT_FORMATS,
  DOCUMENT_SENSITIVITY_LEVELS,
  DOCUMENT_AUTHORITY_LEVELS,
  isJsonSerializable,
  validateDocumentModel,
} from "../../app/modules/document-engine/index.js";

// --- Minimal browser mocks for Node environment ---

class FakeDoc {
  constructor(format = "a4") {
    this.pages = 1;
    this.props = {};
    this.fillColor = [0, 0, 0];
    this.drawColor = [0, 0, 0];
    this.textColor = [0, 0, 0];
    this.fontSize = 10;
    this.fontStyle = "normal";
    this.format = format;
    this.width = format === "a5" ? 148 * 2.83465 : 210 * 2.83465;
    this.height = format === "a5" ? 210 * 2.83465 : 297 * 2.83465;
  }
  internal = { getNumberOfPages: () => this.pages };
  setFillColor(r, g, b) { this.fillColor = [r, g, b]; }
  setDrawColor(r, g, b) { this.drawColor = [r, g, b]; }
  setTextColor(r, g, b) { this.textColor = [r, g, b]; }
  setFontSize(size) { this.fontSize = size; }
  setFont(family, style) { this.fontStyle = style; }
  setLineDash(dashArray, dashPhase) { /* no-op */ }
  rect(x, y, w, h, mode) { /* no-op */ }
  text(str, x, y, opts) { /* no-op */ }
  line(x1, y1, x2, y2) { /* no-op */ }
  addImage(src, format, x, y, w, h) { /* no-op */ }
  addPage() { this.pages++; }
  setPage(n) { /* no-op */ }
  setProperties(props) { this.props = { ...this.props, ...props }; }
  output(type) {
    if (type === "blob") return { size: 12345, type: "application/pdf" };
    return "";
  }
}

global.window = {
  jspdf: {
    jsPDF: class extends FakeDoc {
      constructor(opts = {}) {
        super(opts.format === [148 * 2.83465, 210 * 2.83465] ? "a5" : "a4");
      }
    },
  },
};

global.document = {
  createElement(tag) {
    if (tag === "canvas") {
      return {
        getContext() {
          return {
            scale() {},
            fillRect() {},
            fillText() {},
            save() {},
            restore() {},
            translate() {},
            rotate() {},
          };
        },
        toDataURL() { return "data:image/png;base64,iVBORw0KGgo="; },
        toBlob(cb) { cb({ size: 5678, type: "image/png" }); },
      };
    }
    return {};
  },
};

global.QRCode = {
  toCanvas(canvas, text, opts, cb) { cb(null); },
};

global.URL = {
  createObjectURL(blob) { return `blob://fake-${Date.now()}`; },
};

global.Blob = class FakeBlob {
  constructor(parts, opts) {
    this.parts = parts;
    this.opts = opts;
    this.size = parts.join("").length;
  }
};

const permissions = [
  { code: "finance.receipt.read", label: "Lire les reçus", scope: "own_children" },
  { code: "finance.report.read", label: "Lire les rapports financiers", scope: "school" },
];

const schoolSafeIdentity = {
  name: "SchoolSafe",
  website: "https://schoolsafe.app",
  email: "contact@schoolsafe.app",
};

global.fetch = async (url) => {
  if (url.includes("permissions.json")) {
    return { ok: true, json: async () => permissions };
  }
  if (url.includes("schoolsafe-identity.json")) {
    return { ok: true, json: async () => schoolSafeIdentity };
  }
  return { ok: false, status: 404 };
};

// --- Helpers ---

function makeEngine() {
  const accessGate = createAccessGate({ adminRole: "admin" });
  const schoolIdentityProvider = {
    async load() {
      return {
        name: "École Pilote",
        legalName: "École Pilote SARL",
        address: "12 Av. de la Paix",
        city: "Kinshasa",
        phone: "+243 999 999 999",
        email: "ecole@example.com",
        primaryColor: "#071a3d",
        accentColor: "#e9a515",
        currency: "USD",
        activeAcademicYear: { id: "ay-2026", label: "2025-2026" },
      };
    },
  };
  const schoolSafeIdentityProvider = createSchoolSafeIdentityProvider();
  const dataResolver = createDocumentDataResolver({
    schoolIdentityProvider,
    schoolSafeIdentityProvider,
    contextResolvers: {
      finance: (context) => context,
    },
  });
  const templateRegistry = createTemplateRegistry();
  registerDefaultTemplates(templateRegistry);
  const layoutEngine = createLayoutEngine();
  const renderer = createFrontendRenderer({ layoutEngine });

  return createDocumentEngine({ accessGate, dataResolver, templateRegistry, layoutEngine, renderer });
}

// --- Tests ---

async function runTests() {
  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`✅ ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ ${name}: ${err.message}`);
      failed++;
    }
  }

  await test("Receipt template is registered", async () => {
    const registry = createTemplateRegistry();
    registerDefaultTemplates(registry);
    const info = registry.getInfo("receipt");
    assert.equal(info.type, "receipt");
    assert.equal(info.sourceModule, "finance");
    assert.equal(info.defaultLayout, "a5-receipt");
    assert.ok(info.supportedFormats.includes("pdf"));
  });

  await test("Admin can generate receipt", async () => {
    const engine = makeEngine();
    const request = createDocumentRequest({
      documentType: "receipt",
      sourceModule: "finance",
      action: DOCUMENT_ACTIONS.DOWNLOAD,
      formats: [DOCUMENT_FORMATS.PDF],
      requestedBy: { userId: "u1", role: "admin", schoolId: "s1" },
      context: makeReceiptContext(),
    });
    const result = await engine.generate(request);
    assert.equal(result.ok, true, result.error);
  });

  await test("Parent without permission is denied", async () => {
    const engine = makeEngine();
    const request = createDocumentRequest({
      documentType: "receipt",
      sourceModule: "finance",
      action: DOCUMENT_ACTIONS.DOWNLOAD,
      formats: [DOCUMENT_FORMATS.PDF],
      requestedBy: { userId: "u2", role: "parent", schoolId: "s1", permissions: [] },
      context: makeReceiptContext(),
    });
    const result = await engine.generate(request);
    assert.equal(result.ok, false);
    assert.ok(result.error.includes("Missing permission"));
  });

  await test("Parent with finance.receipt.read can generate own receipt", async () => {
    const engine = makeEngine();
    const request = createDocumentRequest({
      documentType: "receipt",
      sourceModule: "finance",
      action: DOCUMENT_ACTIONS.DOWNLOAD,
      formats: [DOCUMENT_FORMATS.PDF],
      requestedBy: { userId: "u3", role: "parent", schoolId: "s1", permissions: ["finance.receipt.read"] },
      context: makeReceiptContext(),
    });
    const result = await engine.generate(request);
    assert.equal(result.ok, true, result.error);
  });

  await test("Receipt DocumentModel is JSON-serializable", async () => {
    const engine = makeEngine();
    const request = createDocumentRequest({
      documentType: "receipt",
      sourceModule: "finance",
      action: DOCUMENT_ACTIONS.DOWNLOAD,
      formats: [DOCUMENT_FORMATS.PDF],
      requestedBy: { userId: "u1", role: "admin", schoolId: "s1" },
      context: makeReceiptContext(),
    });
    const result = await engine.generate(request);
    assert.equal(result.ok, true);
    assert.ok(isJsonSerializable(result.model));
    const validation = validateDocumentModel(result.model);
    assert.equal(validation.valid, true);
  });

  await test("Receipt sensitivity is confidential", async () => {
    const engine = makeEngine();
    const request = createDocumentRequest({
      documentType: "receipt",
      sourceModule: "finance",
      action: DOCUMENT_ACTIONS.DOWNLOAD,
      formats: [DOCUMENT_FORMATS.PDF],
      requestedBy: { userId: "u1", role: "admin", schoolId: "s1" },
      context: makeReceiptContext(),
    });
    const result = await engine.generate(request);
    assert.equal(result.model.meta.sensitivity, DOCUMENT_SENSITIVITY_LEVELS.CONFIDENTIAL);
    assert.equal(result.model.meta.authority, DOCUMENT_AUTHORITY_LEVELS.PREVIEW);
  });

  await test("Legacy renderReceipt export still exists", async () => {
    const { renderReceipt } = await import("../../app/modules/document-engine/templates/receipt-template.js");
    assert.equal(typeof renderReceipt, "function");
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

function makeReceiptContext() {
  return {
    student: { firstName: "Jean", lastName: "Muluba", matricule: "MAT-001", className: "3ème A" },
    feeLabel: "Frais scolaires",
    period: "Première tranche",
    amountExpected: 150000,
    amountPaid: 75000,
    remaining: 75000,
    currency: "CDF",
    paymentMode: "Espèces",
    reference: "Première tranche",
    paidAt: "2026-08-21T10:30:00Z",
    cashierName: "Mme K",
    verificationCode: "VERIF-123456",
  };
}

runTests();
