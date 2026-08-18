# SchoolSafe Document Engine — Design Spec

**Date:** 2026-08-18  
**Goal:** Provide a single, reusable, institutional-grade document system for all SchoolSafe modules, starting with receipts and progressively migrating existing PDF generators.

---

## 1. Scope

### In scope
- A reusable client-side document engine (`app/modules/document-engine/`).
- A single institutional identity provider consumed by every document.
- Reusable layout components: header, footer, identity blocks, tables, signature blocks, QR blocks, payment blocks.
- Template registry with a first implementation: **ReceiptTemplate** (A4, two horizontal receipts).
- Optional institutional fields added to the school schema.
- Document numbering service for receipts and other numbered documents.
- Date-of-day handling on every generated document.
- Foundation for future templates (assignment, lesson plan, bulletin, etc.).

### Out of scope (Phase 1)
- Server-side PDF rendering. Planned for Phase 2 once R2 S3 credentials are available.
- Excel/CSV exports.
- Advanced watermarking beyond a discrete draft mark.
- Electronic signatures (placeholder blocks only until signature uploads exist).

---

## 2. Guiding principles

1. **One school identity, many documents.** All templates read the same `SchoolIdentity` object.
2. **Central change, global update.** Changing the school phone number updates every future document automatically.
3. **No hard-coded institution data.** The pilot school name/address must never be copied into templates.
4. **Progressive migration.** Existing `app/app.js` PDF code is refactored module by module, not rewritten in one shot.
5. **Security by default.** Financial documents move to backend generation in Phase 2; Phase 1 marks them with traceability metadata.
6. **Print-first design.** A4 portrait default, correct margins, readable fonts, black-and-white safe.

## 2.5 Authorization (locked rule)

The SchoolSafe global authorization model applies to the Document Engine:

```
Utilisateur → Rôle → Permission → Portée → Exception
```

- Every document action requires a **permission** (what the user can do) and a **scope** (on which data).
- Explicit `DENY` always overrides `ALLOW`.
- Examples:
  - `finance.receipts.view + scope=school` → staff can view all receipts.
  - `finance.receipts.view + scope=own_children` → parent can view receipts for their own children only.
- Authorization must be checked in three layers:
  1. **Frontend UI** — hide buttons/actions the user cannot perform.
  2. **Cloudflare Worker / API** — reject unauthorized requests.
  3. **Supabase RLS** — enforce data access at the database level.
- Every permission/scope/role change must be recorded in `public.audit_events`.
- For Phase 1, receipt generation must verify `finance.receipts.view` and the user’s scope over the target student before rendering.

---

## 3. Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ Data sources                                                    │
│  public.school  +  public.school_contacts                       │
│  + public.academic_years (active) + public.school_cycles        │
└─────────────────────────┬───────────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ SchoolIdentityProvider                                          │
│  Fetches /school/settings and normalizes a single object        │
│  used by every template.                                        │
└─────────────────────────┬───────────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ DocumentNumberingService                                        │
│  Generates unique, sequential document numbers per type.        │
│  Persists in a new public.document_number_sequences table.      │
└─────────────────────────┬───────────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ Document Engine (app/modules/document-engine/)                  │
│  Core building blocks:                                          │
│  • DocumentHeader                                               │
│  • DocumentFooter                                               │
│  • SchoolIdentityBlock                                          │
│  • StudentIdentityBlock                                         │
│  • ParentIdentityBlock                                          │
│  • StaffIdentityBlock                                           │
│  • PaymentBlock                                                 │
│  • QRBlock                                                      │
│  • SignatureBlock                                               │
│  • DocumentTitle                                                │
│  • DocumentMetadata                                             │
│  • DataTable (repeat header, avoid orphan rows)                 │
│  • PrintLayout (A4 portrait / landscape / half-A4)              │
└─────────────────────────┬───────────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ Templates                                                       │
│  Phase 1: ReceiptTemplate                                       │
│  Phase 2: AssignmentTemplate, LessonPlanTemplate                │
│  Phase 3: BulletinTemplate, AttestationTemplate, etc.           │
└─────────────────────────┬───────────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ Render / Export                                                 │
│  Phase 1: jsPDF in the browser                                  │
│  Phase 2: Cloudflare Worker + R2 for sensitive documents        │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Data model additions

### 4.1 Optional fields on `public.school`

All fields are nullable unless otherwise noted.

```sql
ALTER TABLE public.school ADD COLUMN IF NOT EXISTS motto text;
ALTER TABLE public.school ADD COLUMN IF NOT EXISTS currency text default 'USD';
ALTER TABLE public.school ADD COLUMN IF NOT EXISTS bank_name text;
ALTER TABLE public.school ADD COLUMN IF NOT EXISTS bank_account text;
ALTER TABLE public.school ADD COLUMN IF NOT EXISTS tax_id text;
ALTER TABLE public.school ADD COLUMN IF NOT EXISTS director_name text;
ALTER TABLE public.school ADD COLUMN IF NOT EXISTS director_signature_url text;
ALTER TABLE public.school ADD COLUMN IF NOT EXISTS official_seal_url text;
ALTER TABLE public.school ADD COLUMN IF NOT EXISTS official_language text default 'FR';
```

### 4.2 Document numbering sequences

```sql
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

-- Example: receipt number REC-2026-00042
```

### 4.3 Document registry (Phase 2)

```sql
CREATE TABLE IF NOT EXISTS public.documents (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.school(id) on delete cascade,
  document_type text not null,
  document_number text,
  entity_type text,
  entity_id uuid,
  language text,
  file_key text,
  file_url text,
  status text default 'generated',
  generated_by uuid references public.profiles(id),
  generated_at timestamptz default now(),
  metadata jsonb default '{}'::jsonb
);
```

---

## 5. SchoolIdentity object

Single normalized object used by every template.

```ts
type SchoolIdentity = {
  // Identity
  name: string;
  nameEn?: string | null;
  legalName?: string | null;
  schoolType?: string | null;
  approvalCode?: string | null;
  motto?: string | null;
  officialLanguage?: string;

  // Contact
  address?: string | null;
  city?: string | null;
  province?: string | null;
  country?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;

  // Branding
  primaryColor: string;
  accentColor: string;
  logoUrl?: string | null;
  documentFooter?: string | null;
  officialSealUrl?: string | null;

  // Administration
  currency: string;
  bankName?: string | null;
  bankAccount?: string | null;
  taxId?: string | null;
  directorName?: string | null;
  directorSignatureUrl?: string | null;

  // Context
  activeAcademicYear?: { id: string; label: string; startsOn: string; endsOn: string } | null;
  activeCycles: { key: string; name: string }[];
};
```

The provider joins `school`, `school_contacts`, the active `academic_year`, and active `school_cycles`.

---

## 6. Document Engine components

### 6.1 DocumentHeader

Variants:
- `institutional` — full logo + school name + contact block + document title.
- `compact` — smaller, for internal reports.

### 6.2 DocumentFooter

Always contains:
- School name, address, phone, email, website (when available).
- Page number (`Page X / Y`).
- Discreet SchoolSafe branding: “Document généré par SchoolSafe”.
- Custom `document_footer` text if configured.

Hierarchy: school identity is primary; SchoolSafe is secondary.

### 6.3 Identity blocks

- `SchoolIdentityBlock` — full identity block for official documents.
- `StudentIdentityBlock` — photo (when relevant), name, matricule, class.
- `ParentIdentityBlock` — name, relationship, phone.
- `StaffIdentityBlock` — name, role, contact.

### 6.4 PaymentBlock

Displays:
- Expected amount
- Paid amount
- Discount/reduction
- Remaining balance
- Currency
- Payment mode
- Transaction reference
- Cashier/agent name

Never recalculates amounts; it renders the authoritative source data.

### 6.5 QRBlock

Renders a verification QR code pointing to a safe, opaque identifier (not raw sensitive data).

### 6.6 SignatureBlock

Prints labeled signature lines:
- Établi par
- Vérifié par
- Validé par
- Direction
- Parent

No fake signatures or seals. If `director_signature_url` or `official_seal_url` is configured, they may be rendered.

### 6.7 DocumentMetadata

Includes on every document:
- Document type
- Document number (if numbered)
- Generation date (date of day)
- Academic year
- Generated by user
- Reference entity

### 6.8 DataTable

- Headers repeat on each page.
- Avoids row/page orphaning.
- Auto-scales column widths to A4 width.
- Works in black and white.

### 6.9 PrintLayout

- `A4_PORTRAIT` (default)
- `A4_LANDSCAPE`
- `HALF_A4` (two receipts on one A4, stacked vertically)

---

## 7. Templates

### 7.1 ReceiptTemplate (Phase 1)

**Layout:** A4 portrait, two equal horizontal receipts separated by a cut line.

**Fields per receipt:**
- School logo + name
- Title: “REÇU DE PAIEMENT”
- Receipt number
- Date (date of day)
- Academic year
- Student: name, matricule, class
- Payer/parent name (if available)
- Fee type
- Period concerned
- Expected amount
- Paid amount
- Currency
- Payment mode
- Transaction reference
- Remaining balance
- Cashier/agent name
- Signature/cachet space
- Verification QR or reference code
- Footer institutionnel + SchoolSafe

Both receipts share the same payment reference but may be labeled:
- “Exemplaire établissement”
- “Exemplaire parent / payeur”

**Numbering:** uses `DocumentNumberingService` with type `receipt`.

### 7.2 Future templates

- `AssignmentTemplate` — refactor existing `exportAssignmentPdf`.
- `LessonPlanTemplate` — requires richer `lesson_plans` schema.
- `BulletinTemplate`, `AttestationTemplate`, `ConvocationTemplate`, `ClassListTemplate`, `AttendanceReportTemplate`, `PayslipTemplate`, `SecurityReportTemplate`.

---

## 8. Document numbering

- Atomic increment via Supabase function `next_document_number(school_id, document_type, prefix)`.
- Format: `{prefix}{year}-{sequence}` (e.g. `REC-2026-00042`).
- Sequences stored in `public.document_number_sequences`.
- When a receipt is generated, `fee_payments.receipt_no` is populated and a row is written to `public.documents` (Phase 2) or logged in `audit_events` (Phase 1).

---

## 9. Rendering strategy

### Phase 1 — Browser jsPDF
- Extract existing jsPDF helpers from `app/app.js`.
- Build the engine in `app/modules/document-engine/`.
- Templates return a jsPDF document.
- Exporter returns `Blob` / data URL for preview, print, or download.

### Phase 2 — Cloudflare Worker + R2
- Once R2 S3 credentials are available, sensitive documents (receipts, attestations, bulletins) are rendered in the Worker.
- PDFs stored in R2 bucket `schoolsafe-v2-files/documents/{schoolId}/{type}/{number}.pdf`.
- `public.documents` registry tracks file key, generator, date, entity.
- Frontend gets a signed URL for preview/download.

---

## 10. Security & permissions

- Documents never embed secrets or internal IDs in QR codes.
- A user can only generate documents for entities they have permission to read.
- Financial documents must eventually be generated server-side to prevent tampering.
- Phase 1 includes `generated_by`, `generated_at`, and receipt number in `audit_events`.

---

## 11. Implementation phases

### Phase 1 — Foundation + Receipt
1. Add optional school fields to Supabase migration.
2. Add `document_number_sequences` table.
3. Create `SchoolIdentityProvider`.
4. Create Document Engine components.
5. Implement `ReceiptTemplate`.
6. Wire receipt generation to the finance/payment UI.
7. Tests: logo present/absent, long names, two-receipt layout, B&W print.

### Phase 2 — Pedagogy documents
1. Refactor `exportAssignmentPdf` into `AssignmentTemplate`.
2. Enrich `lesson_plans` schema and create `LessonPlanTemplate`.
3. Add `ClassListTemplate` and `AttendanceReportTemplate`.

### Phase 3 — Backend rendering
1. Implement Worker-side PDF generation once R2 S3 credentials are available.
2. Create `public.documents` registry.
3. Migrate receipts and sensitive documents to backend.

### Phase 4 — Migration of legacy documents
1. Port remaining templates from `analysis/zalavrai.html`.
2. Deprecate old `app/app.js` PDF block.

---

## 12. Files to create / modify

### New files
- `app/modules/document-engine/school-identity-provider.js`
- `app/modules/document-engine/document-header.js`
- `app/modules/document-engine/document-footer.js`
- `app/modules/document-engine/identity-blocks.js`
- `app/modules/document-engine/payment-block.js`
- `app/modules/document-engine/signature-block.js`
- `app/modules/document-engine/qr-block.js`
- `app/modules/document-engine/data-table.js`
- `app/modules/document-engine/print-layout.js`
- `app/modules/document-engine/templates/receipt-template.js`
- `app/modules/document-engine/document-numbering-service.js`
- `app/modules/document-engine/index.js`

### Modified files
- `supabase/migrations/` — add optional school fields + sequences table.
- `app/modules/school/school-module.js` — expose new optional fields in UI.
- `app/modules/finance/finance-module.js` — use ReceiptTemplate.
- `app/app.js` — gradually remove old PDF code as templates are migrated.

---

## 13. Acceptance criteria

- [ ] A receipt generated today always shows today’s date.
- [ ] Changing the school phone number in `/school/settings` updates the next receipt automatically.
- [ ] Two receipts fit on one A4 page without overlap.
- [ ] Receipts are numbered uniquely and sequentially.
- [ ] No hard-coded school data remains in the receipt template.
- [ ] Receipt renders correctly with and without a school logo.
- [ ] Footer shows school identity first, SchoolSafe second.
- [ ] Black-and-white print remains readable.
