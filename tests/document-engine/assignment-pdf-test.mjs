// tests/document-engine/assignment-pdf-test.mjs
// DOC-03 — Tests du moteur documentaire pour Devoir / Interrogation et feuille de réponses.

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
  DOCUMENT_ORIGINS,
  DOCUMENT_SENSITIVITY_LEVELS,
  DOCUMENT_AUTHORITY_LEVELS,
  isJsonSerializable,
  validateDocumentModel,
} from "../../app/modules/document-engine/index.js";

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

const permissions = [
  { code: "pedagogy.assignment.read", label: "Lire les devoirs", scope: "assigned_classes" },
  { code: "pedagogy.assignment.manage", label: "Gérer les devoirs", scope: "assigned_classes" },
];

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
  const accessGate = createAccessGate();
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
  registerDefaultTemplates(templateRegistry);
  const layoutEngine = createLayoutEngine();
  const renderer = createFrontendRenderer({ layoutEngine });

  return createDocumentEngine({ accessGate, dataResolver, templateRegistry, layoutEngine, renderer });
}

function assignmentUser(overrides = {}) {
  return {
    userId: "u1",
    role: "admin",
    schoolId: "s1",
    permissions: ["pedagogy.assignment.read"],
    scopes: [{ permission: "pedagogy.assignment.read", type: "assigned_classes" }],
    assignedClassIds: ["class-1a"],
    ...overrides,
  };
}

function makeAssignmentContext(overrides = {}) {
  return {
    classId: "class-1a",
    title: "Devoir de mathématiques",
    subjectName: "Mathématiques",
    className: "1re A",
    teacherName: "M. Dupont",
    dueDate: "2026-08-25",
    type: "homework",
    scaleLabel: "/20",
    coefficient: 1,
    instructions: "Répondre aux questions avec soin.",
    questions: [
      { text: "Calculer 2 + 2.", points: 2 },
      { text: "Développer (x + 1)².", points: 3, answerSpace: "8 lignes" },
    ],
    ...overrides,
  };
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

  await test("Assignment PDF is generated for admin with explicit grant", async () => {
    const engine = makeEngine();
    const request = createDocumentRequest({
      documentType: "assignment",
      sourceModule: "pedagogy",
      action: DOCUMENT_ACTIONS.DOWNLOAD,
      formats: [DOCUMENT_FORMATS.PDF],
      origin: DOCUMENT_ORIGINS.GENERATED,
      requestedBy: assignmentUser(),
      context: makeAssignmentContext(),
      locale: "fr-FR",
    });
    const result = await engine.generate(request);
    assert.equal(result.ok, true, result.error);
    assert.ok(result.outputs.pdf);
    assert.equal(result.outputs.pdf.format, "pdf");
    assert.ok(result.outputs.pdf.filename.includes("assignment_"));
    assert.equal(result.model.meta.documentType, "assignment");
  });

  await test("Answer sheet PDF is generated", async () => {
    const engine = makeEngine();
    const request = createDocumentRequest({
      documentType: "answer-sheet",
      sourceModule: "pedagogy",
      action: DOCUMENT_ACTIONS.DOWNLOAD,
      formats: [DOCUMENT_FORMATS.PDF],
      origin: DOCUMENT_ORIGINS.GENERATED,
      requestedBy: assignmentUser(),
      context: makeAssignmentContext({
        studentFirstName: "Lucas",
        studentLastName: "Martin",
      }),
      locale: "fr-FR",
    });
    const result = await engine.generate(request);
    assert.equal(result.ok, true, result.error);
    assert.ok(result.outputs.pdf);
    assert.ok(result.outputs.pdf.filename.includes("answer-sheet_"));
  });

  await test("Teacher with correct permission can generate assignment", async () => {
    const engine = makeEngine();
    const request = createDocumentRequest({
      documentType: "assignment",
      sourceModule: "pedagogy",
      action: DOCUMENT_ACTIONS.DOWNLOAD,
      formats: [DOCUMENT_FORMATS.PDF],
      requestedBy: {
        userId: "u2",
        role: "teacher",
        schoolId: "s1",
        permissions: ["pedagogy.assignment.read"],
        scopes: [{ permission: "pedagogy.assignment.read", type: "assigned_classes" }],
        assignedClassIds: ["class-1a"],
      },
      context: makeAssignmentContext(),
      locale: "fr-FR",
    });
    const result = await engine.generate(request);
    assert.equal(result.ok, true, result.error);
  });

  await test("Parent without permission is denied", async () => {
    const engine = makeEngine();
    const request = createDocumentRequest({
      documentType: "assignment",
      sourceModule: "pedagogy",
      action: DOCUMENT_ACTIONS.DOWNLOAD,
      formats: [DOCUMENT_FORMATS.PDF],
      requestedBy: {
        userId: "u3",
        role: "parent",
        schoolId: "s1",
        permissions: [],
      },
      context: makeAssignmentContext(),
      locale: "fr-FR",
    });
    const result = await engine.generate(request);
    assert.equal(result.ok, false);
    assert.ok(result.error.includes("Missing permission"));
  });

  await test("DocumentModel for assignment is JSON-serializable", async () => {
    const engine = makeEngine();
    const request = createDocumentRequest({
      documentType: "assignment",
      sourceModule: "pedagogy",
      action: DOCUMENT_ACTIONS.DOWNLOAD,
      formats: [DOCUMENT_FORMATS.PDF],
      origin: DOCUMENT_ORIGINS.GENERATED,
      requestedBy: assignmentUser(),
      context: makeAssignmentContext(),
      locale: "fr-FR",
    });
    const result = await engine.generate(request);
    assert.equal(result.ok, true);
    assert.ok(isJsonSerializable(result.model));
    const validation = validateDocumentModel(result.model);
    assert.equal(validation.valid, true);
  });

  await test("Snapshots and metadata are set", async () => {
    const engine = makeEngine();
    const request = createDocumentRequest({
      documentType: "assignment",
      sourceModule: "pedagogy",
      action: DOCUMENT_ACTIONS.DOWNLOAD,
      formats: [DOCUMENT_FORMATS.PDF],
      requestedBy: assignmentUser(),
      context: makeAssignmentContext(),
      locale: "fr-FR",
    });
    const result = await engine.generate(request);
    assert.ok(result.model.school.snapshotAt);
    assert.ok(result.model.schoolsafe.snapshotAt);
    assert.equal(result.model.meta.authority, DOCUMENT_AUTHORITY_LEVELS.PREVIEW);
    assert.equal(result.model.meta.sensitivity, DOCUMENT_SENSITIVITY_LEVELS.INTERNAL);
    assert.equal(result.model.meta.origin, DOCUMENT_ORIGINS.GENERATED);
  });

  await test("Composed origin is supported for assignments", async () => {
    const engine = makeEngine();
    const request = createDocumentRequest({
      documentType: "assignment",
      sourceModule: "pedagogy",
      action: DOCUMENT_ACTIONS.DOWNLOAD,
      formats: [DOCUMENT_FORMATS.PDF],
      origin: DOCUMENT_ORIGINS.COMPOSED,
      sourceArtifacts: ["upload-pdf-abc", "text-input-def"],
      requestedBy: assignmentUser(),
      context: makeAssignmentContext(),
      locale: "fr-FR",
    });
    const result = await engine.generate(request);
    assert.equal(result.ok, true);
    assert.equal(result.model.meta.origin, "composed");
    assert.deepEqual(result.model.meta.sourceArtifacts, ["upload-pdf-abc", "text-input-def"]);
  });

  await test("Assignment with many questions paginates", async () => {
    const engine = makeEngine();
    const questions = Array.from({ length: 40 }, (_, i) => ({
      text: `Question ${i + 1} avec un texte suffisamment long pour occuper de l'espace vertical sur la page A4.`,
      points: 1,
    }));
    const request = createDocumentRequest({
      documentType: "assignment",
      sourceModule: "pedagogy",
      action: DOCUMENT_ACTIONS.DOWNLOAD,
      formats: [DOCUMENT_FORMATS.PDF],
      requestedBy: assignmentUser(),
      context: makeAssignmentContext({ questions }),
      locale: "fr-FR",
    });
    const result = await engine.generate(request);
    assert.equal(result.ok, true);
    assert.ok(result.outputs.pdf);
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
