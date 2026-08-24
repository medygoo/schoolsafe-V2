// tests/document-engine/skeleton-test.mjs
// Skeleton tests for the SchoolSafe Document Engine.

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
  isJsonSerializable,
  validateDocumentModel,
  DOCUMENT_ACTIONS,
  DOCUMENT_FORMATS,
  DOCUMENT_ORIGINS,
  DOCUMENT_SENSITIVITY_LEVELS,
  DOCUMENT_AUTHORITY_LEVELS,
} from "../../app/modules/document-engine/index.js";

import {
  dummyReceiptTemplate,
  dummyCardTemplate,
  dummyListTemplate,
} from "./dummy-templates.js";

// --- Minimal browser mocks for Node environment ---

class FakeDoc {
  constructor() {
    this.pages = 1;
    this.props = {};
    this.fillColor = [0, 0, 0];
    this.drawColor = [0, 0, 0];
    this.textColor = [0, 0, 0];
    this.fontSize = 10;
    this.fontStyle = "normal";
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
    jsPDF: class extends FakeDoc {},
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

// Mock fetch for permissions and SchoolSafe identity
const permissions = [
  { code: "finance.receipt.read", label: "Lire les reçus", scope: "own_children" },
  { code: "finance.report.read", label: "Lire les rapports financiers", scope: "school" },
  { code: "security.card.create", label: "Créer une carte", scope: "school" },
];

const schoolSafeIdentity = {
  name: "SchoolSafe",
  nameFr: "SchoolSafe",
  nameEn: "SchoolSafe",
  logoUrl: null,
  website: "https://schoolsafe.app",
  email: "contact@schoolsafe.app",
  supportEmail: "support@schoolsafe.app",
  documentFooter: "Solution SchoolSafe",
  legalMention: "Document généré par SchoolSafe",
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

function makeEngine({ contextResolvers = {} } = {}) {
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
    contextResolvers,
  });
  const templateRegistry = createTemplateRegistry();
  templateRegistry.register(dummyReceiptTemplate.info, dummyReceiptTemplate);
  templateRegistry.register(dummyCardTemplate.info, dummyCardTemplate);
  templateRegistry.register(dummyListTemplate.info, dummyListTemplate);
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

  await test("AccessGate allows admin", async () => {
    const engine = makeEngine();
    const request = createDocumentRequest({
      documentType: "dummy-receipt",
      sourceModule: "finance",
      action: DOCUMENT_ACTIONS.DOWNLOAD,
      formats: [DOCUMENT_FORMATS.PDF],
      requestedBy: { userId: "u1", role: "admin", schoolId: "s1" },
    });
    const result = await engine.generate(request);
    assert.equal(result.ok, true, result.error);
  });

  await test("AccessGate denies user without permission", async () => {
    const engine = makeEngine();
    const request = createDocumentRequest({
      documentType: "dummy-receipt",
      sourceModule: "finance",
      action: DOCUMENT_ACTIONS.DOWNLOAD,
      formats: [DOCUMENT_FORMATS.PDF],
      requestedBy: { userId: "u2", role: "parent", schoolId: "s1", permissions: [] },
    });
    const result = await engine.generate(request);
    assert.equal(result.ok, false);
    assert.ok(result.error.includes("Missing permission"));
  });

  await test("AccessGate allows user with correct permission", async () => {
    const engine = makeEngine();
    const request = createDocumentRequest({
      documentType: "dummy-receipt",
      sourceModule: "finance",
      action: DOCUMENT_ACTIONS.DOWNLOAD,
      formats: [DOCUMENT_FORMATS.PDF],
      requestedBy: { userId: "u3", role: "cashier", schoolId: "s1", permissions: ["finance.receipt.read"] },
    });
    const result = await engine.generate(request);
    assert.equal(result.ok, true, result.error);
  });

  await test("DocumentModel is JSON-serializable", async () => {
    const engine = makeEngine();
    const request = createDocumentRequest({
      documentType: "dummy-receipt",
      sourceModule: "finance",
      action: DOCUMENT_ACTIONS.DOWNLOAD,
      formats: [DOCUMENT_FORMATS.PDF],
      origin: DOCUMENT_ORIGINS.GENERATED,
      requestedBy: { userId: "u1", role: "admin", schoolId: "s1" },
      context: { payment: { amountPaid: 100, paidAt: "2026-08-21" } },
    });
    const result = await engine.generate(request);
    assert.equal(result.ok, true);
    assert.ok(isJsonSerializable(result.model));
    const validation = validateDocumentModel(result.model);
    assert.equal(validation.valid, true);
  });

  await test("Snapshots are frozen at generation time", async () => {
    const engine = makeEngine();
    const request = createDocumentRequest({
      documentType: "dummy-receipt",
      sourceModule: "finance",
      action: DOCUMENT_ACTIONS.DOWNLOAD,
      formats: [DOCUMENT_FORMATS.PDF],
      requestedBy: { userId: "u1", role: "admin", schoolId: "s1" },
    });
    const result = await engine.generate(request);
    assert.ok(result.model.school.snapshotAt);
    assert.ok(result.model.schoolsafe.snapshotAt);
    assert.equal(result.model.meta.authority, DOCUMENT_AUTHORITY_LEVELS.PREVIEW);
  });

  await test("PDF output is produced for receipt", async () => {
    const engine = makeEngine();
    const request = createDocumentRequest({
      documentType: "dummy-receipt",
      sourceModule: "finance",
      action: DOCUMENT_ACTIONS.DOWNLOAD,
      formats: [DOCUMENT_FORMATS.PDF],
      requestedBy: { userId: "u1", role: "admin", schoolId: "s1" },
      context: {
        payment: { amountPaid: 150, paidAt: "2026-08-21", verificationCode: "VERIF-123" },
        student: { firstName: "Jean", lastName: "Muluba" },
      },
    });
    const result = await engine.generate(request);
    assert.equal(result.ok, true);
    assert.ok(result.outputs.pdf);
    assert.equal(result.outputs.pdf.format, "pdf");
    assert.ok(result.outputs.pdf.filename.includes("dummy-receipt"));
  });

  await test("Card template supports PNG output", async () => {
    const engine = makeEngine();
    const request = createDocumentRequest({
      documentType: "dummy-card",
      sourceModule: "security",
      action: DOCUMENT_ACTIONS.DOWNLOAD,
      formats: [DOCUMENT_FORMATS.PNG],
      requestedBy: { userId: "u1", role: "admin", schoolId: "s1" },
      context: {
        student: { firstName: "Amina", lastName: "Kabongo", matricule: "MAT-001", className: "3ème A" },
      },
    });
    const result = await engine.generate(request);
    assert.equal(result.ok, true);
    assert.ok(result.outputs.png);
    assert.equal(result.outputs.png.format, "png");
  });

  await test("List template supports CSV output", async () => {
    const engine = makeEngine({
      contextResolvers: {
        finance: () => ({
          rows: [
            ["REC-001", "Jean Muluba", "150", "Cash"],
            ["REC-002", "Amina Kabongo", "200", "Bank"],
          ],
        }),
      },
    });
    const request = createDocumentRequest({
      documentType: "dummy-list",
      sourceModule: "finance",
      action: DOCUMENT_ACTIONS.DOWNLOAD,
      formats: [DOCUMENT_FORMATS.CSV],
      requestedBy: { userId: "u1", role: "admin", schoolId: "s1" },
    });
    const result = await engine.generate(request);
    assert.equal(result.ok, true);
    assert.ok(result.outputs.csv);
    assert.equal(result.outputs.csv.format, "csv");
  });

  await test("Composed origin is supported", async () => {
    const engine = makeEngine();
    const request = createDocumentRequest({
      documentType: "dummy-receipt",
      sourceModule: "finance",
      action: DOCUMENT_ACTIONS.DOWNLOAD,
      formats: [DOCUMENT_FORMATS.PDF],
      origin: DOCUMENT_ORIGINS.COMPOSED,
      sourceArtifacts: ["upload-photo-abc", "text-input-def"],
      requestedBy: { userId: "u1", role: "admin", schoolId: "s1" },
    });
    const result = await engine.generate(request);
    assert.equal(result.ok, true);
    assert.equal(result.model.meta.origin, "composed");
    assert.deepEqual(result.model.meta.sourceArtifacts, ["upload-photo-abc", "text-input-def"]);
  });

  await test("Sensitivity inferred for financial document", async () => {
    const engine = makeEngine();
    const request = createDocumentRequest({
      documentType: "dummy-receipt",
      sourceModule: "finance",
      action: DOCUMENT_ACTIONS.DOWNLOAD,
      formats: [DOCUMENT_FORMATS.PDF],
      requestedBy: { userId: "u1", role: "admin", schoolId: "s1" },
    });
    const result = await engine.generate(request);
    assert.equal(result.model.meta.sensitivity, DOCUMENT_SENSITIVITY_LEVELS.CONFIDENTIAL);
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
