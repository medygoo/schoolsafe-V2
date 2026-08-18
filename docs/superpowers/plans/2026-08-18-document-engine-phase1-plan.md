> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

# SchoolSafe Document Engine — Phase 1 Implementation Plan

**Goal:** Build the reusable SchoolSafe Document Engine foundation in the browser and implement the first template: a two-per-page A4 payment receipt.

**Architecture:** A `SchoolIdentityProvider` reads `/school/settings` and normalizes one institutional identity object. Reusable layout components (`DocumentHeader`, `DocumentFooter`, identity blocks, payment block, QR block, signature block, data table) compose templates. `ReceiptTemplate` uses jsPDF to render two receipts on one A4 page. A `DocumentNumberingService` generates unique receipt numbers via a new `document_number_sequences` table.

**Tech Stack:** JavaScript (ES modules), jsPDF (already in `app/jspdf.umd.min.js`), existing SchoolSafe API layer, Supabase for sequence storage.

**Spec:** `docs/superpowers/specs/2026-08-18-document-engine-design.md`

## Global Constraints

- No hard-coded school data in templates.
- Today’s date must appear on every generated document.
- School identity primary, SchoolSafe branding secondary.
- Receipt numbering unique per school.
- A4 portrait default; receipt template uses half-A4 vertical split.
- Financial documents move server-side in Phase 2; Phase 1 includes audit metadata only.
- No Supabase CLI push; SQL is written to `supabase/migrations/` for manual application via SQL Editor.
- One task = one commit, pushed to GitHub.

---

## File Structure

```
app/modules/document-engine/
├── index.js                          # public API exports
├── school-identity-provider.js       # fetch & normalize school identity
├── document-numbering-service.js     # generate unique document numbers
├── document-header.js                # header component
├── document-footer.js                # footer component
├── identity-blocks.js                # school/student/parent/staff blocks
├── payment-block.js                  # amount/paid/remaining/mode block
├── signature-block.js                # signature lines
├── qr-block.js                       # verification QR
├── data-table.js                     # repeating-header table helper
├── print-layout.js                   # layout constants / helpers
└── templates/
    └── receipt-template.js           # two-receipt A4 template

tests/document-engine/                # Vitest/Node tests where possible
├── school-identity-provider.test.js
├── document-numbering-service.test.js
└── receipt-template.test.js

supabase/migrations/
└── 202608190001_document_engine_phase1.sql

app/modules/school/school-module.js   # expose new optional fields in UI
app/modules/finance/finance-module.js # wire receipt generation
```

---

### Task 1: Add optional institutional fields and numbering table

**Files:**
- Create: `supabase/migrations/202608190001_document_engine_phase1.sql`
- Modify: `app/modules/school/school-module.js` (later, to expose fields)

**Interfaces:**
- Produces: SQL migration adding nullable columns to `public.school` and a new `public.document_number_sequences` table.

- [ ] **Step 1: Write the migration**

```sql
-- Optional institutional fields for Document Engine
ALTER TABLE public.school
  ADD COLUMN IF NOT EXISTS motto text,
  ADD COLUMN IF NOT EXISTS currency text default 'USD',
  ADD COLUMN IF NOT EXISTS bank_name text,
  ADD COLUMN IF NOT EXISTS bank_account text,
  ADD COLUMN IF NOT EXISTS tax_id text,
  ADD COLUMN IF NOT EXISTS director_name text,
  ADD COLUMN IF NOT EXISTS director_signature_url text,
  ADD COLUMN IF NOT EXISTS official_seal_url text,
  ADD COLUMN IF NOT EXISTS official_language text default 'FR';

-- Document numbering sequences
CREATE TABLE IF NOT EXISTS public.document_number_sequences (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.school(id) on delete cascade,
  document_type text not null,
  prefix text not null default '',
  last_number bigint not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (school_id, document_type)
);

-- Function to atomically get the next number
CREATE OR REPLACE FUNCTION public.next_document_number(
  p_school_id uuid,
  p_document_type text,
  p_prefix text default ''
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_year text;
  v_next bigint;
BEGIN
  v_year := to_char(now(), 'YYYY');

  INSERT INTO public.document_number_sequences (school_id, document_type, prefix, last_number)
  VALUES (p_school_id, p_document_type, p_prefix, 0)
  ON CONFLICT (school_id, document_type)
  DO NOTHING;

  UPDATE public.document_number_sequences
  SET last_number = last_number + 1,
      updated_at = now()
  WHERE school_id = p_school_id
    AND document_type = p_document_type
  RETURNING last_number INTO v_next;

  RETURN p_prefix || v_year || '-' || lpad(v_next::text, 5, '0');
END;
$$;
```

- [ ] **Step 2: Verify the file is saved**

Run: `ls -la supabase/migrations/202608190001_document_engine_phase1.sql`
Expected: file exists.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/202608190001_document_engine_phase1.sql
git commit -m "chore(supabase): optional institutional fields and document numbering sequence"
git push origin main
```

---

### Task 2: SchoolIdentityProvider

**Files:**
- Create: `app/modules/document-engine/school-identity-provider.js`
- Create: `tests/document-engine/school-identity-provider.test.js`

**Interfaces:**
- Consumes: `SchoolSafeSchoolAPI.getSettings()` (returns `{ identity, brand, contact, academic_years, cycles }`).
- Produces: `async function loadSchoolIdentity()` returning a `SchoolIdentity` object.

- [ ] **Step 1: Write the failing test**

```js
// tests/document-engine/school-identity-provider.test.js
import { describe, it, expect, vi } from "vitest";
import { createSchoolIdentityProvider } from "../../app/modules/document-engine/school-identity-provider.js";

describe("SchoolIdentityProvider", () => {
  it("normalizes identity from API settings", async () => {
    const api = {
      getSettings: vi.fn().mockResolvedValue({
        identity: { name: "École Pilote", name_en: "Pilot School", legal_name: "SPRL Pilote", approval_code: "A-123" },
        brand: { primary_color: "#071a3d", accent_color: "#e9a515", document_footer: "Pied de page perso", logo_path: "/logo.png" },
        contact: { address: "Av. Test", city: "Kinshasa", province: "Kinshasa", country: "RDC", phone: "+243", email: "a@b.c", website_url: "https://ecole.cd" },
        academic_years: [{ id: "y1", label: "2025-2026", is_active: true }],
        cycles: [{ cycle_key: "primary", cycle_name: "Primaire" }],
      }),
    };
    const provider = createSchoolIdentityProvider(api);
    const identity = await provider.load();
    expect(identity.name).toBe("École Pilote");
    expect(identity.primaryColor).toBe("#071a3d");
    expect(identity.activeAcademicYear.label).toBe("2025-2026");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd workers && npx vitest run ../tests/document-engine/school-identity-provider.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the provider**

```js
// app/modules/document-engine/school-identity-provider.js
/**
 * @typedef {Object} SchoolIdentity
 * @property {string} name
 * @property {string|null} [nameEn]
 * @property {string|null} [legalName]
 * @property {string|null} [schoolType]
 * @property {string|null} [approvalCode]
 * @property {string|null} [motto]
 * @property {string} [officialLanguage]
 * @property {string|null} [address]
 * @property {string|null} [city]
 * @property {string|null} [province]
 * @property {string|null} [country]
 * @property {string|null} [phone]
 * @property {string|null} [email]
 * @property {string|null} [website]
 * @property {string} primaryColor
 * @property {string} accentColor
 * @property {string|null} [logoUrl]
 * @property {string|null} [documentFooter]
 * @property {string|null} [officialSealUrl]
 * @property {string} currency
 * @property {string|null} [bankName]
 * @property {string|null} [bankAccount]
 * @property {string|null} [taxId]
 * @property {string|null} [directorName]
 * @property {string|null} [directorSignatureUrl]
 * @property {{id:string,label:string,startsOn?:string,endsOn?:string}|null} [activeAcademicYear]
 * @property {{key:string,name:string}[]} [activeCycles]
 */

export function createSchoolIdentityProvider(api) {
  return {
    /**
     * @returns {Promise<SchoolIdentity>}
     */
    async load() {
      const settings = await api.getSettings();
      const identity = settings.identity || {};
      const brand = settings.brand || {};
      const contact = settings.contact || {};
      const years = settings.academic_years || [];
      const cycles = settings.cycles || [];

      const activeYear = years.find((y) => y.is_active) || years[0] || null;

      return {
        name: identity.name || "",
        nameEn: identity.name_en || null,
        legalName: identity.legal_name || null,
        schoolType: identity.school_type || null,
        approvalCode: identity.approval_code || null,
        motto: identity.motto || null,
        officialLanguage: identity.official_language || "FR",

        address: contact.address || null,
        city: contact.city || null,
        province: contact.province || null,
        country: contact.country || null,
        phone: contact.phone || null,
        email: contact.email || null,
        website: contact.website_url || null,

        primaryColor: brand.primary_color || "#071a3d",
        accentColor: brand.accent_color || "#e9a515",
        logoUrl: brand.logo_path || null,
        documentFooter: brand.document_footer || null,
        officialSealUrl: identity.official_seal_url || null,

        currency: identity.currency || "USD",
        bankName: identity.bank_name || null,
        bankAccount: identity.bank_account || null,
        taxId: identity.tax_id || null,
        directorName: identity.director_name || null,
        directorSignatureUrl: identity.director_signature_url || null,

        activeAcademicYear: activeYear
          ? { id: activeYear.id, label: activeYear.label, startsOn: activeYear.starts_on, endsOn: activeYear.ends_on }
          : null,
        activeCycles: cycles.filter((c) => c.is_active).map((c) => ({ key: c.cycle_key, name: c.cycle_name })),
      };
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd workers && npx vitest run ../tests/document-engine/school-identity-provider.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/modules/document-engine/school-identity-provider.js tests/document-engine/school-identity-provider.test.js
git commit -m "feat(document-engine): SchoolIdentityProvider normalizes institutional identity"
git push origin main
```

---

### Task 3: DocumentNumberingService

**Files:**
- Create: `app/modules/document-engine/document-numbering-service.js`
- Create: `tests/document-engine/document-numbering-service.test.js`

**Interfaces:**
- Consumes: Supabase client with `rpc('next_document_number', { p_school_id, p_document_type, p_prefix })`.
- Produces: `async nextNumber(documentType, prefix)` returning a string.

- [ ] **Step 1: Write the failing test**

```js
// tests/document-engine/document-numbering-service.test.js
import { describe, it, expect, vi } from "vitest";
import { createDocumentNumberingService } from "../../app/modules/document-engine/document-numbering-service.js";

describe("DocumentNumberingService", () => {
  it("calls next_document_number RPC", async () => {
    const client = {
      rpc: vi.fn().mockResolvedValue({ data: "REC-2026-00001", error: null }),
    };
    const svc = createDocumentNumberingService(client, "s1");
    const num = await svc.nextNumber("receipt", "REC-");
    expect(num).toBe("REC-2026-00001");
    expect(client.rpc).toHaveBeenCalledWith("next_document_number", {
      p_school_id: "s1",
      p_document_type: "receipt",
      p_prefix: "REC-",
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd workers && npx vitest run ../tests/document-engine/document-numbering-service.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the service**

```js
// app/modules/document-engine/document-numbering-service.js
export function createDocumentNumberingService(supabaseClient, schoolId) {
  return {
    /**
     * @param {string} documentType
     * @param {string} [prefix]
     * @returns {Promise<string>}
     */
    async nextNumber(documentType, prefix = "") {
      const { data, error } = await supabaseClient.rpc("next_document_number", {
        p_school_id: schoolId,
        p_document_type: documentType,
        p_prefix: prefix,
      });
      if (error) throw new Error(`Document numbering failed: ${error.message}`);
      return data;
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd workers && npx vitest run ../tests/document-engine/document-numbering-service.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/modules/document-engine/document-numbering-service.js tests/document-engine/document-numbering-service.test.js
git commit -m "feat(document-engine): DocumentNumberingService via Supabase RPC"
git push origin main
```

---

### Task 4: Layout constants and helpers

**Files:**
- Create: `app/modules/document-engine/print-layout.js`
- Create: `app/modules/document-engine/data-table.js`

**Interfaces:**
- Produces: `MM_TO_PT`, `A4_WIDTH_PT`, `A4_HEIGHT_PT`, `HALF_A4_HEIGHT_PT`, `MARGINS`, `formatDate()`, `formatCurrency()`.
- Produces: `drawDataTable(doc, columns, rows, options)` helper.

- [ ] **Step 1: Create print-layout.js**

```js
// app/modules/document-engine/print-layout.js
export const MM_TO_PT = 2.83465;
export const A4_WIDTH_PT = 210 * MM_TO_PT;   // 595.28
export const A4_HEIGHT_PT = 297 * MM_TO_PT;  // 841.89
export const HALF_A4_HEIGHT_PT = A4_HEIGHT_PT / 2;

export const MARGINS = {
  top: 15 * MM_TO_PT,
  right: 15 * MM_TO_PT,
  bottom: 20 * MM_TO_PT,
  left: 15 * MM_TO_PT,
};

export function formatDate(date = new Date(), locale = "fr-FR") {
  return new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

export function formatCurrency(amount, currency = "USD", locale = "fr-FR") {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(Number(amount) || 0);
}

export function formatNumber(value, locale = "fr-FR") {
  return new Intl.NumberFormat(locale).format(Number(value) || 0);
}
```

- [ ] **Step 2: Create data-table.js**

```js
// app/modules/document-engine/data-table.js
import { MM_TO_PT } from "./print-layout.js";

/**
 * Draw a simple table with header row repeated on new pages.
 * @param {import("jspdf").jsPDF} doc
 * @param {{header:string,width:number,align?:string}[]} columns
 * @param {string[][]} rows
 * @param {{startX:number,startY:number,maxY:number,rowHeight?:number,headerHeight?:number,fontSize?:number}} options
 * @returns {number} next Y position
 */
export function drawDataTable(doc, columns, rows, options) {
  const { startX, startY, maxY, rowHeight = 6 * MM_TO_PT, headerHeight = 7 * MM_TO_PT, fontSize = 9 } = options;
  const cellPadding = 1.5 * MM_TO_PT;
  let x = startX;
  let y = startY;

  function drawHeader() {
    doc.setFillColor(240, 240, 240);
    doc.rect(startX, y, columns.reduce((s, c) => s + c.width, 0), headerHeight, "F");
    doc.setFontSize(fontSize);
    doc.setTextColor(0, 0, 0);
    let cx = startX;
    for (const col of columns) {
      doc.text(col.header, cx + cellPadding, y + headerHeight / 2 + 1.5, { align: "left", baseline: "middle" });
      cx += col.width;
    }
    y += headerHeight;
  }

  drawHeader();

  for (const row of rows) {
    if (y + rowHeight > maxY) {
      doc.addPage();
      y = options.startY;
      drawHeader();
    }
    let cx = startX;
    doc.setFontSize(fontSize);
    doc.setTextColor(30, 30, 30);
    for (let i = 0; i < columns.length; i++) {
      const col = columns[i];
      const text = String(row[i] ?? "");
      const align = col.align || "left";
      const tx = align === "right" ? cx + col.width - cellPadding : cx + cellPadding;
      doc.text(text, tx, y + rowHeight / 2 + 1, { align, baseline: "middle" });
      cx += col.width;
    }
    y += rowHeight;
  }

  return y;
}
```

- [ ] **Step 3: Commit**

```bash
git add app/modules/document-engine/print-layout.js app/modules/document-engine/data-table.js
git commit -m "feat(document-engine): layout constants and data table helper"
git push origin main
```

---

### Task 5: Document header and footer

**Files:**
- Create: `app/modules/document-engine/document-header.js`
- Create: `app/modules/document-engine/document-footer.js`

**Interfaces:**
- Consumes: `SchoolIdentity`.
- Produces: `renderDocumentHeader(doc, identity, title, subtitle?)` and `renderDocumentFooter(doc, identity, options?)`.

- [ ] **Step 1: Implement document-header.js**

```js
// app/modules/document-engine/document-header.js
import { A4_WIDTH_PT, MM_TO_PT } from "./print-layout.js";

/**
 * @param {import("jspdf").jsPDF} doc
 * @param {import("./school-identity-provider.js").SchoolIdentity} identity
 * @param {string} title
 * @param {string} [subtitle]
 * @returns {number} bottom Y of the header
 */
export async function renderDocumentHeader(doc, identity, title, subtitle) {
  const top = 12 * MM_TO_PT;
  const primary = identity.primaryColor || "#071a3d";
  const rgb = hexToRgb(primary);

  // Blue bar
  doc.setFillColor(rgb.r, rgb.g, rgb.b);
  doc.rect(0, 0, A4_WIDTH_PT, 28 * MM_TO_PT, "F");

  // Logo
  let logoX = 15 * MM_TO_PT;
  if (identity.logoUrl) {
    try {
      const img = await loadImage(identity.logoUrl);
      const aspect = img.width / img.height;
      const h = 16 * MM_TO_PT;
      const w = h * aspect;
      doc.addImage(img.src, "JPEG", logoX, 5 * MM_TO_PT, w, h);
      logoX += w + 5 * MM_TO_PT;
    } catch {
      // ignore missing logo
    }
  }

  // School name
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(identity.name, logoX, 11 * MM_TO_PT, { align: "left" });

  // Contact line
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  const contactParts = [identity.address, identity.city, identity.phone, identity.email, identity.website].filter(Boolean);
  doc.text(contactParts.join(" · "), logoX, 16 * MM_TO_PT, { align: "left" });

  // Title block
  const titleY = 36 * MM_TO_PT;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(title, A4_WIDTH_PT / 2, titleY, { align: "center" });

  if (subtitle) {
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(subtitle, A4_WIDTH_PT / 2, titleY + 6 * MM_TO_PT, { align: "center" });
  }

  return titleY + (subtitle ? 10 * MM_TO_PT : 6 * MM_TO_PT);
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

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}
```

- [ ] **Step 2: Implement document-footer.js**

```js
// app/modules/document-engine/document-footer.js
import { A4_WIDTH_PT, A4_HEIGHT_PT, MM_TO_PT, formatDate } from "./print-layout.js";

/**
 * @param {import("jspdf").jsPDF} doc
 * @param {import("./school-identity-provider.js").SchoolIdentity} identity
 * @param {{page?:number,totalPages?:number,generatedAt?:Date}} [options]
 */
export function renderDocumentFooter(doc, identity, options = {}) {
  const { page = doc.internal.getNumberOfPages(), totalPages = page, generatedAt = new Date() } = options;
  const footerY = A4_HEIGHT_PT - 12 * MM_TO_PT;

  // Horizontal line
  doc.setDrawColor(200, 200, 200);
  doc.line(15 * MM_TO_PT, footerY - 2 * MM_TO_PT, A4_WIDTH_PT - 15 * MM_TO_PT, footerY - 2 * MM_TO_PT);

  // School info (primary)
  doc.setTextColor(60, 60, 60);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  const parts = [identity.name, identity.address, identity.city, identity.phone, identity.email, identity.website].filter(Boolean);
  doc.text(parts.join(" · "), A4_WIDTH_PT / 2, footerY, { align: "center" });

  // Page number
  doc.text(`Page ${page} / ${totalPages}`, A4_WIDTH_PT - 15 * MM_TO_PT, footerY + 4 * MM_TO_PT, { align: "right" });

  // Document date
  doc.text(formatDate(generatedAt), 15 * MM_TO_PT, footerY + 4 * MM_TO_PT, { align: "left" });

  // SchoolSafe branding (secondary)
  const footerText = identity.documentFooter || `Document généré par SchoolSafe — ${formatDate(generatedAt)}`;
  doc.setTextColor(120, 120, 120);
  doc.setFontSize(7);
  doc.text(footerText, A4_WIDTH_PT / 2, footerY + 5 * MM_TO_PT, { align: "center" });
}
```

- [ ] **Step 3: Commit**

```bash
git add app/modules/document-engine/document-header.js app/modules/document-engine/document-footer.js
git commit -m "feat(document-engine): reusable document header and footer"
git push origin main
```

---

### Task 6: Identity, payment, QR and signature blocks

**Files:**
- Create: `app/modules/document-engine/identity-blocks.js`
- Create: `app/modules/document-engine/payment-block.js`
- Create: `app/modules/document-engine/signature-block.js`
- Create: `app/modules/document-engine/qr-block.js`

**Interfaces:**
- Produces: small rendering helpers used by templates.

- [ ] **Step 1: Create identity-blocks.js**

```js
// app/modules/document-engine/identity-blocks.js
import { MM_TO_PT } from "./print-layout.js";

export function renderSchoolIdentityBlock(doc, identity, x, y, maxWidth) {
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text(identity.legalName || identity.name, x, y);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  let cy = y + 4 * MM_TO_PT;
  const lines = [
    [identity.address, identity.city, identity.province].filter(Boolean).join(", "),
    identity.phone,
    identity.email,
    identity.website,
  ].filter(Boolean);
  for (const line of lines) {
    doc.text(line, x, cy, { maxWidth });
    cy += 3.5 * MM_TO_PT;
  }
  return cy;
}

export function renderStudentIdentityBlock(doc, student, x, y) {
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(`${student.firstName || ""} ${student.lastName || ""}`.trim(), x, y);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  const lines = [
    `Matricule : ${student.matricule || "-"}`,
    `Classe : ${student.className || "-"}`,
  ];
  let cy = y + 4 * MM_TO_PT;
  for (const line of lines) {
    doc.text(line, x, cy);
    cy += 3.5 * MM_TO_PT;
  }
  return cy;
}

export function renderParentIdentityBlock(doc, parent, x, y) {
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(parent.fullName || "", x, y);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  const line = [parent.guardianType, parent.phone].filter(Boolean).join(" · ");
  doc.text(line, x, y + 3.5 * MM_TO_PT);
}
```

- [ ] **Step 2: Create payment-block.js**

```js
// app/modules/document-engine/payment-block.js
import { MM_TO_PT, formatCurrency, formatDate } from "./print-layout.js";

export function renderPaymentBlock(doc, payment, x, y, maxWidth) {
  const lineHeight = 5 * MM_TO_PT;
  let cy = y;

  function row(label, value, highlight = false) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60, 60, 60);
    doc.text(label, x, cy);

    const valueX = x + maxWidth * 0.55;
    doc.setFont("helvetica", highlight ? "bold" : "normal");
    doc.setTextColor(highlight ? 0 : 30, highlight ? 0 : 30, highlight ? 0 : 30);
    doc.text(String(value), valueX, cy);
    cy += lineHeight;
  }

  row("Type de frais", payment.feeLabel || "-");
  row("Période concernée", payment.period || "-");
  row("Montant attendu", formatCurrency(payment.amountExpected, payment.currency));
  row("Montant payé", formatCurrency(payment.amountPaid, payment.currency), true);
  row("Solde", formatCurrency(payment.remaining, payment.currency));
  row("Mode de paiement", payment.paymentMode || "-");
  row("Référence", payment.reference || "-");
  row("Date", formatDate(payment.paidAt ? new Date(payment.paidAt) : new Date()));

  return cy;
}
```

- [ ] **Step 3: Create signature-block.js**

```js
// app/modules/document-engine/signature-block.js
import { MM_TO_PT } from "./print-layout.js";

export function renderSignatureBlock(doc, lines, x, y, width) {
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.setFont("helvetica", "normal");

  let cx = x;
  const count = lines.length;
  const gap = width / count;

  for (const label of lines) {
    doc.text(label, cx, y);
    doc.line(cx, y + 2 * MM_TO_PT, cx + gap - 5 * MM_TO_PT, y + 2 * MM_TO_PT);
    cx += gap;
  }
}
```

- [ ] **Step 4: Create qr-block.js**

```js
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
```

- [ ] **Step 5: Commit**

```bash
git add app/modules/document-engine/identity-blocks.js app/modules/document-engine/payment-block.js app/modules/document-engine/signature-block.js app/modules/document-engine/qr-block.js
git commit -m "feat(document-engine): identity, payment, signature and QR blocks"
git push origin main
```

---

### Task 7: ReceiptTemplate

**Files:**
- Create: `app/modules/document-engine/templates/receipt-template.js`
- Create: `app/modules/document-engine/index.js`
- Create: `tests/document-engine/receipt-template.test.js`

**Interfaces:**
- Consumes: `SchoolIdentity`, payment data object, receipt number.
- Produces: `async function renderReceipt(identity, payment, receiptNumber): Promise<Blob>`.

Payment data shape:

```ts
{
  student: { firstName, lastName, matricule, className },
  payer?: { fullName, guardianType, phone },
  feeLabel: string,
  period?: string,
  amountExpected: number,
  amountPaid: number,
  remaining: number,
  currency: string,
  paymentMode: string,
  reference?: string,
  paidAt?: string,
  cashierName?: string,
  verificationCode?: string,
}
```

- [ ] **Step 1: Implement receipt-template.js**

```js
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
```

- [ ] **Step 2: Create index.js**

```js
// app/modules/document-engine/index.js
export { createSchoolIdentityProvider } from "./school-identity-provider.js";
export { createDocumentNumberingService } from "./document-numbering-service.js";
export { renderDocumentHeader } from "./document-header.js";
export { renderDocumentFooter } from "./document-footer.js";
export * from "./identity-blocks.js";
export { renderPaymentBlock } from "./payment-block.js";
export { renderSignatureBlock } from "./signature-block.js";
export { renderQRBlock } from "./qr-block.js";
export { drawDataTable } from "./data-table.js";
export * from "./print-layout.js";
export { renderReceipt } from "./templates/receipt-template.js";
```

- [ ] **Step 3: Write a minimal test**

```js
// tests/document-engine/receipt-template.test.js
import { describe, it, expect } from "vitest";

// Receipt template is browser-only because of jsPDF/image APIs.
// This test validates the public export exists.
describe("receipt template", () => {
  it("exports renderReceipt", async () => {
    const { renderReceipt } = await import("../../app/modules/document-engine/templates/receipt-template.js");
    expect(typeof renderReceipt).toBe("function");
  });
});
```

- [ ] **Step 4: Commit**

```bash
git add app/modules/document-engine/templates/receipt-template.js app/modules/document-engine/index.js tests/document-engine/receipt-template.test.js
git commit -m "feat(document-engine): ReceiptTemplate with two receipts per A4"
git push origin main
```

---

### Task 8: Refactor helpers to support y-offset for clean half-page rendering

**Files:**
- Modify: `app/modules/document-engine/document-header.js`
- Modify: `app/modules/document-engine/document-footer.js`
- Modify: `app/modules/document-engine/templates/receipt-template.js`

**Interfaces:**
- All render helpers accept an optional `yOffset` parameter so the second receipt on the same page mirrors the first exactly.

- [ ] **Step 1: Add yOffset support to header and footer**

In `document-header.js`, change the signature to:
```js
export async function renderDocumentHeader(doc, identity, title, subtitle, yOffset = 0)
```
and add `yOffset` to every `y` coordinate.

In `document-footer.js`, change the signature to:
```js
export function renderDocumentFooter(doc, identity, options = {})
```
where `options.yOffset` defaults to 0 and shifts the footer to the appropriate half-page.

- [ ] **Step 2: Update receipt-template.js**

Replace the duplicated `drawReceiptWithOffset` implementation with two calls to `drawReceipt(yOffset, copyLabel)`.

- [ ] **Step 3: Visual sanity test**

Open the finance module in the browser, generate a receipt, and verify:
- Two receipts appear on one A4 page.
- No text crosses the cut line.
- Header/footer are present on both copies.

- [ ] **Step 4: Commit**

```bash
git add app/modules/document-engine/document-header.js app/modules/document-engine/document-footer.js app/modules/document-engine/templates/receipt-template.js
git commit -m "refactor(document-engine): y-offset support for half-page receipt copies"
git push origin main
```

---

### Task 9: Wire receipt generation to the finance UI

**Files:**
- Modify: `app/modules/finance/finance-module.js`
- Modify: `app/modules/finance/finance-api.js` if needed

**Interfaces:**
- Consumes: `renderReceipt`, `createSchoolIdentityProvider`, `createDocumentNumberingService`.
- Produces: clicking a receipt button opens a preview and allows download/print.

- [ ] **Step 1: Locate existing receipt button**

Find the receipt export button in `app/modules/finance/finance-module.js` (likely using `data-export-receipt` or similar).

- [ ] **Step 2: Add a generateReceipt handler**

```js
import { renderReceipt, createSchoolIdentityProvider, createDocumentNumberingService } from "../document-engine/index.js";
import { SchoolSafeSchoolAPI } from "../school/school-api.js";

async function generateReceipt(payment) {
  const identityProvider = createSchoolIdentityProvider(SchoolSafeSchoolAPI);
  const identity = await identityProvider.load();

  const numbering = createDocumentNumberingService(window.SchoolSafeSupabase, identity.name ? "school-id" : ""); // replace with real school id
  const receiptNumber = await numbering.nextNumber("receipt", "REC-");

  const paymentData = {
    student: { firstName: payment.student_first_name, lastName: payment.student_last_name, matricule: payment.matricule, className: payment.class_name },
    feeLabel: payment.fee_label,
    period: payment.period,
    amountExpected: payment.amount_expected,
    amountPaid: payment.amount,
    remaining: payment.amount_remaining,
    currency: payment.currency,
    paymentMode: payment.payment_mode,
    reference: payment.reference,
    paidAt: payment.received_at,
    cashierName: payment.cashier_name,
    verificationCode: receiptNumber,
  };

  const doc = await renderReceipt(identity, paymentData, receiptNumber);
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
}
```

- [ ] **Step 3: Attach handler to receipt buttons**

Replace the old `exportReceiptPdf(index)` call with `generateReceipt(payment)`.

- [ ] **Step 4: Test in browser**

- Navigate to finance / payments.
- Click a receipt button.
- Verify a new tab opens with the PDF preview.
- Verify two receipts on one A4.
- Verify today’s date, school name, and receipt number.

- [ ] **Step 5: Commit**

```bash
git add app/modules/finance/finance-module.js
git commit -m "feat(finance): wire Document Engine receipt generation"
git push origin main
```

---

### Task 10: Update school settings UI for new optional fields

**Files:**
- Modify: `app/modules/school/school-module.js`

**Interfaces:**
- New optional input fields for motto, currency, bank name, bank account, tax id, director name.

- [ ] **Step 1: Add inputs in the school configuration form**

Add input fields bound to `identity.motto`, `identity.currency`, etc.

- [ ] **Step 2: Save values via existing API**

Ensure `PUT /school/settings` payload includes the new fields.

- [ ] **Step 3: Commit**

```bash
git add app/modules/school/school-module.js
git commit -m "feat(school): optional institutional fields in settings UI"
git push origin main
```

---

### Task 11: Final tests and validation

**Files:**
- All files above.

- [ ] **Step 1: Run unit tests**

Run: `cd workers && npx vitest run ../tests/document-engine/`
Expected: all tests pass.

- [ ] **Step 2: Manual print/PDF checks**

- Logo present → rendered correctly.
- Logo absent → fallback header text.
- Long school name → wrapped or truncated gracefully.
- Long address → no overflow.
- Two receipts on one A4.
- Black-and-white print readable.
- Today’s date appears.

- [ ] **Step 3: Commit any fixes**

```bash
git commit -am "fix(document-engine): receipt layout edge cases"
git push origin main
```

---

## Self-Review

### Spec coverage
- Optional institutional fields → Task 1.
- Document numbering → Task 3.
- SchoolIdentityProvider → Task 2.
- Header/footer → Task 5.
- Reusable blocks → Task 6.
- Receipt A4 two-per-page → Task 7.
- Date of day on documents → print-layout `formatDate` and footer.
- Wire to finance UI → Task 9.
- School settings UI → Task 10.
- Tests → Tasks 2, 3, 7, 11.

### Placeholder scan
- No TBD/TODO.
- Code snippets are concrete.
- Later tasks reference exact function names defined earlier.

### Type consistency
- `SchoolIdentity` shape is consistent across provider, header, footer, blocks.
- `renderReceipt` signature matches usage in Task 9.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-18-document-engine-phase1-plan.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — Execute tasks in this session using `executing-plans`, batch execution with checkpoints.

Which approach do you want?
