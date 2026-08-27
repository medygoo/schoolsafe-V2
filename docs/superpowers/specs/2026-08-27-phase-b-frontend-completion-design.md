# Phase B Frontend Completion Design

## Scope

Complete B6-FE through B9-FE on `work/phase-b-students` without changing the frozen backend, SQL, migrations, RLS, APIs, Workers, `main`, `work/fe-ux-006`, or PR #26. B1-FE through B5-FE remain the source flows and are reused rather than rebuilt.

## Architecture

The existing School module stays the entry point. Three focused browser modules extend it:

- `academic-structure-demo.js` owns one shared frontend catalog for academic years, levels, and classes. It exposes read helpers consumed by B5 and later student views and stores only local preparation drafts.
- `student-dossier-demo.js` composes the existing family, verification, pickup, and lifecycle capabilities into a permission-filtered central dossier.
- `student-card-preparation-demo.js` derives a preparation checklist and preview from the selected student and the shared academic structure. It never prints, downloads an official PDF, or contacts SchoolSafe Control.

Each module checks permission, scope, and explicit exceptions. Explicit DENY wins and no role name grants access. Draft students remain non-operational throughout.

## UI and states

B6 adds a Structure tab with year status cards, generic levels, class inventory, and authorized local preparation dialogs. B7 routes student consultation through a central dossier whose mobile navigation is a menu/grid rather than a horizontally scrolling tab strip. B8 adds a Card section with `NON PRÊTE`, `À VÉRIFIER`, `PRÊTE POUR TRANSMISSION`, and a disabled `BACKEND_LATER` transmission state. Missing future modules are honest previews, never fabricated official records.

All surfaces support light/dark themes and 390, 834, and 1440 pixel viewports without horizontal overflow.

## Access_Law

The frontend chain is `Utilisateur → Rôle → Permission → Portée → Exception → DENY par défaut`. Structure management requires `school.structure.manage` with `school` scope. Useful teacher structure reads require `school.class.read` with `assigned_classes`. Student dossier sections each declare their own permission. Card preparation requires `security.card.create` with `school` scope. Parent reads stay limited to `own_children`; teacher reads stay limited to assigned classes; guardian roles receive no implicit structure or card rights. Jaspe can explain missing information but cannot validate or transmit.

## Verification and delivery

Playwright behavior tests are written before implementation for each lot and include permission/scope/DENY, draft isolation, responsive light/dark checks, and short regression smoke runs. Each lot receives exactly one commit, push, remote SHA verification, and a concise Issue #23 report.
