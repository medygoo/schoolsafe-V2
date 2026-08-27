# Phase B Frontend Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete SchoolSafe Phase B frontend lots B6-FE through B9-FE with shared academic structure, a central student dossier, card preparation, and final QA.

**Architecture:** Add focused browser modules under `app/modules/school/`, wired through the existing School module and current demo access context. Reuse B1-B5 components and the Card Studio without adding server behavior.

**Tech Stack:** Vanilla browser JavaScript, CSS, Playwright, Node static server.

**Spec:** `docs/superpowers/specs/2026-08-27-phase-b-frontend-completion-design.md`

## Global Constraints

- Frontend only; no backend, SQL, migration, RLS, Supabase, API, or Worker changes.
- Access_Law is `Utilisateur → Rôle → Permission → Portée → Exception → DENY par défaut`.
- Explicit DENY always wins; no hard-coded Admin bypass.
- Draft students remain non-operational.
- Responsive at 390, 834, and 1440 pixels in light and dark themes.
- Exactly one commit and push for each of B6, B7, B8, and B9.

---

### Task 1: B6-FE academic structure

**Files:**
- Create: `app/modules/school/academic-structure-demo.js`
- Create: `app/styles/modules/academic-structure.css`
- Create: `tests/qa/e2e/academic-structure.spec.ts`
- Modify: `app/index.html`
- Modify: `app/app.js`
- Modify: `app/modules/school/school-module.js`
- Modify: `app/modules/school/student-lifecycle-demo.js`

**Interfaces:**
- Produces: `window.SchoolSafeAcademicStructure` with `getYears()`, `getLevels()`, `getClasses()`, `canRead(user)`, `canManage(user)`, `render(options)`, and `bind(options)`.
- Consumes: `window.SchoolSafeAccess.canAccess`, the active demo user, and existing UI helpers.

- [ ] Write Playwright cases asserting four year states, generic levels/classes, shared B5 class/year options, local-only preparation, and scope/DENY behavior.
- [ ] Run `npx playwright test tests/qa/e2e/academic-structure.spec.ts --project=chromium-desktop` and confirm failure because the Structure tab does not exist.
- [ ] Implement the shared structure module, styles, tab wiring, and B5 adapter.
- [ ] Re-run the targeted test and B1-B5 smoke files until all pass.
- [ ] Run responsive light/dark screenshots at 390/834/1440, commit as `feat(school-ui): add academic years levels and classes flow`, push, verify remote SHA, and report Issue #23.

### Task 2: B7-FE central student dossier

**Files:**
- Create: `app/modules/school/student-dossier-demo.js`
- Create: `app/styles/modules/student-dossier.css`
- Create: `tests/qa/e2e/student-dossier.spec.ts`
- Modify: `app/index.html`
- Modify: `app/modules/school/school-module.js`

**Interfaces:**
- Produces: `window.SchoolSafeStudentDossier.open(student, user)` and permission-filtered section descriptors.
- Consumes: B1-B6 student data and the existing family, verification, pickup, and lifecycle modules.

- [ ] Write failing Playwright cases for the professional header, twelve permission-filtered destinations, future-state copy, mobile navigation, and draft blocking.
- [ ] Run the B7 test and confirm the missing central dossier failure.
- [ ] Implement the dossier shell and route existing student consultation through it.
- [ ] Run B7 targeted tests plus B1-B6 smoke and responsive light/dark checks.
- [ ] Commit as `feat(students-ui): add central transversal student dossier`, push, verify remote SHA, and report Issue #23.

### Task 3: B8-FE student card preparation

**Files:**
- Create: `app/modules/school/student-card-preparation-demo.js`
- Create: `app/styles/modules/student-card-preparation.css`
- Create: `tests/qa/e2e/student-card-preparation.spec.ts`
- Modify: `app/index.html`
- Modify: `app/app.js`
- Modify: `app/modules/school/student-dossier-demo.js`

**Interfaces:**
- Produces: `window.SchoolSafeStudentCardPreparation.render(student, user)` and `statusFor(student)`.
- Consumes: shared structure data and compatible Card Studio visual assets.

- [ ] Write failing Playwright cases for draft unavailability, active checklist/status, preview fields, permission denial, and disabled BACKEND_LATER transmission.
- [ ] Run the B8 test and confirm failure because the card preparation section is missing.
- [ ] Implement the preview and eligibility flow without print, PDF download, API, or real transmission.
- [ ] Run B8 targeted tests plus B1-B7 smoke and responsive light/dark checks.
- [ ] Commit as `feat(students-ui): add student card preparation flow`, push, verify remote SHA, and report Issue #23.

### Task 4: B9-FE final Phase B QA

**Files:**
- Create: `tests/qa/e2e/students-phase-b.spec.ts`
- Modify only B1-B8 frontend files where a reproduced QA defect requires correction.

**Interfaces:**
- Consumes: all Phase B UI modules and demo profiles.
- Produces: one grouped regression matrix for Access_Law, draft isolation, responsive layout, and themes.

- [ ] Write regression cases covering Admin, parent `own_children`, teacher `assigned_classes`, guardian, and no-permission profiles.
- [ ] Run the grouped Phase B frontend suite and record any failing behavior before correcting it.
- [ ] Correct only reproduced frontend defects, rerunning each failing test after its minimal fix.
- [ ] Run the complete Phase B targeted suite and final 390/834/1440 light/dark visual checks.
- [ ] Commit as `fix(students-ui): finalize phase b frontend qa`, push, verify remote SHA, publish the final Issue #23 report, and stop before Phase C.
