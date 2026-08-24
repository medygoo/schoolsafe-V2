# DOC-02 — Implémentation du squelette du Document Engine frontend

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Construire le moteur documentaire commun frontend défini dans le spec DOC-01, sans migrer de document existant et sans backend.

**Architecture:** Architecture modulaire ES6 dans `app/modules/document-engine/` : contrats sérialisables JSON → AccessGate → resolver de données → modèle normalisé → registre de templates → RenderContext abstrait → LayoutEngine → FrontendRenderer (adaptateur jsPDF). Le cœur reste indépendant de jsPDF.

**Tech Stack:** JavaScript ES6 modules, jsPDF uniquement dans l’adaptateur, QRCode.js disponible globalement, pas de backend.

**Spec:** `docs/superpowers/specs/2026-08-21-document-engine-design.md`

## Global Constraints

- Frontend uniquement ; aucun backend, aucune migration, aucune commande Supabase.
- Aucun `ServerRenderer` maintenant.
- Ne pas migrer le reçu, le bulletin ni le devoir.
- Ne pas construire le Centre de documents complet.
- Respecter `ACCESS_LAW.md`.
- Utiliser uniquement les permissions de `shared/permissions.json`.
- Cœur JSON-sérialisable et indépendant de jsPDF.
- jsPDF uniquement dans l’adaptateur frontend de rendu.
- PDF disponible pour tout document exportable ; Excel/CSV/PNG complémentaires.

---

## File Structure

| File | Responsibility |
|------|---------------|
| `app/modules/document-engine/contracts.js` | Types/constantes : `DocumentRequest`, `DocumentModel`, `DocumentStatus`, `DocumentOrigin`, `DocumentSensitivity`, `DocumentAuthority`, `DocumentAction`, `DocumentFormat`. |
| `app/modules/document-engine/access-gate.js` | `checkDocumentAccess(request, templateInfo)` : vérifie ACCESS_LAW via `shared/permissions.json`. |
| `app/modules/document-engine/schoolsafe-identity-provider.js` | Fournit l’identité SchoolSafe centralisée. |
| `app/modules/document-engine/document-data-resolver.js` | `resolve(request)` : construit le `DocumentModel` avec snapshots école/SchoolSafe/contexte. |
| `app/modules/document-engine/template-registry.js` | `TemplateRegistry` : enregistrement, récupération, liste filtrée des templates. |
| `app/modules/document-engine/render-context.js` | Abstraction `RenderContext` / `DrawingSurface` indépendante de jsPDF. |
| `app/modules/document-engine/layout-engine.js` | `LayoutEngine` : dimensions, header/footer, pagination. |
| `app/modules/document-engine/file-policy.js` | Helpers : nom de fichier, référence, version, dates, monnaie, nombres, pagination. |
| `app/modules/document-engine/frontend-renderer.js` | `FrontendRenderer` : orchestre template + layout + adaptateur de format. |
| `app/modules/document-engine/adapters/jspdf-render-context.js` | Implémentation de `RenderContext` avec jsPDF. |
| `app/modules/document-engine/document-engine.js` | Facade `DocumentEngine` : point d’entrée unique. |
| `app/modules/document-engine/index.js` | Ré-exporte le moteur et ses contrats. |
| `tests/document-engine/skeleton-test.mjs` | Tests du moteur avec données factices non sensibles. |

---

## Task 1: Contracts

**Files:**
- Create: `app/modules/document-engine/contracts.js`

**Interfaces:**
- Produces : constantes et types documentaires.

**Steps:**
- [ ] Définir `DOCUMENT_ACTIONS`, `DOCUMENT_FORMATS`, `DOCUMENT_STATUSES`, `DOCUMENT_ORIGINS`, `DOCUMENT_SENSITIVITY_LEVELS`, `DOCUMENT_AUTHORITY_LEVELS`.
- [ ] Exporter les helpers `createDocumentRequest`, `createDocumentModel`, `isSerializableDocumentModel`.

---

## Task 2: SchoolSafe identity provider

**Files:**
- Create: `app/modules/document-engine/schoolsafe-identity-provider.js`
- Create: `shared/schoolsafe-identity.json`

**Interfaces:**
- Produces : `createSchoolSafeIdentityProvider()` → `{ async load() }`

**Steps:**
- [ ] Créer `shared/schoolsafe-identity.json` avec nom, logo, site, e-mail, mentions officielles.
- [ ] Créer le provider qui charge ce fichier.

---

## Task 3: AccessGate

**Files:**
- Create: `app/modules/document-engine/access-gate.js`
- Read: `shared/permissions.json`

**Interfaces:**
- Consumes : `DocumentRequest`, `TemplateInfo`
- Produces : `checkDocumentAccess(request, templateInfo)` → `{ allowed, permission, scope, reason }`

**Steps:**
- [ ] Charger `shared/permissions.json`.
- [ ] Administrateur principal → allow.
- [ ] Sinon deny par défaut, vérifier permission et scope.
- [ ] Logger localement les refus importants.

---

## Task 4: DocumentDataResolver

**Files:**
- Create: `app/modules/document-engine/document-data-resolver.js`
- Read: `app/modules/document-engine/school-identity-provider.js`

**Interfaces:**
- Consumes : `DocumentRequest`, `SchoolIdentityProvider`, `SchoolSafeIdentityProvider`
- Produces : `createDocumentDataResolver(deps)` → `{ async resolve(request) }`

**Steps:**
- [ ] Résoudre identité école via provider existant.
- [ ] Résoudre identité SchoolSafe.
- [ ] Créer snapshots avec `snapshotAt` ISO.
- [ ] Récupérer données contextuelles via un resolver injecté par module.
- [ ] Normaliser en `DocumentModel`.

---

## Task 5: TemplateRegistry

**Files:**
- Create: `app/modules/document-engine/template-registry.js`

**Interfaces:**
- Produces : `createTemplateRegistry()` → `{ register, get, getInfo, list }`

**Steps:**
- [ ] Stocker les templates par `type`.
- [ ] Valider qu’un template a un `info` et une implémentation.
- [ ] Lister avec filtres optionnels.

---

## Task 6: RenderContext abstraction

**Files:**
- Create: `app/modules/document-engine/render-context.js`

**Interfaces:**
- Produces : interface `RenderContext` avec méthodes de dessin abstraites.

**Steps:**
- [ ] Définir les méthodes : `getDimensions`, `drawRect`, `drawText`, `drawImage`, `drawQR`, `drawLine`, `drawTable`, `addPage`, `setPage`, `setTitle`, `setAuthor`.
- [ ] Aucune référence à jsPDF.

---

## Task 7: LayoutEngine

**Files:**
- Create: `app/modules/document-engine/layout-engine.js`

**Interfaces:**
- Consumes : `RenderContext`, `DocumentModel`
- Produces : `createLayoutEngine()` → `{ getDimensions, applyHeader, applyFooter, applyPageNumber }`

**Steps:**
- [ ] Définir les layouts prédéfinis avec dimensions en points.
- [ ] Implémenter header/footer avec identité école/SchoolSafe.
- [ ] Pagination localisée.

---

## Task 8: File policy helpers

**Files:**
- Create: `app/modules/document-engine/file-policy.js`

**Interfaces:**
- Produces : `buildFilename`, `buildReference`, `formatDate`, `formatCurrency`, `formatNumber`, `formatPageNumber`.

**Steps:**
- [ ] Conventions de nommage fixes.
- [ ] Helpers de formatage centralisés.

---

## Task 9: jsPDF adapter

**Files:**
- Create: `app/modules/document-engine/adapters/jspdf-render-context.js`

**Interfaces:**
- Consumes : `RenderContext` interface
- Produces : `createJspdfRenderContext(doc, layout)` implémentant `RenderContext`

**Steps:**
- [ ] Implémenter chaque méthode avec jsPDF.
- [ ] Gestion des images, QR, tableaux, pages.

---

## Task 10: FrontendRenderer

**Files:**
- Create: `app/modules/document-engine/frontend-renderer.js`

**Interfaces:**
- Consumes : `DocumentModel`, `TemplateRegistry`, `LayoutEngine`, `RenderContext` adapter
- Produces : `createFrontendRenderer(deps)` → `{ async render(model, format) }`

**Steps:**
- [ ] Choisir l’adaptateur selon le format (PDF → jsPDF, PNG → canvas, XLSX/CSV → déclaratif).
- [ ] Appliquer layout.
- [ ] Déléguer au template programmatique ou déclaratif.
- [ ] Appliquer watermarks selon `authority`/`sensitivity`/`generatedBy`.
- [ ] Retourner `DocumentOutput` avec blob et filename.

---

## Task 11: DocumentEngine facade

**Files:**
- Create: `app/modules/document-engine/document-engine.js`
- Modify: `app/modules/document-engine/index.js`

**Interfaces:**
- Consumes : tous les composants précédents
- Produces : `createDocumentEngine(deps)` → `{ async generate(request) }`

**Steps:**
- [ ] Ordonnancer : AccessGate → Resolver → TemplateRegistry → Renderer.
- [ ] Gérer les erreurs avec messages clairs.
- [ ] Ré-exporter depuis `index.js`.

---

## Task 12: Dummy templates for testing

**Files:**
- Create: `tests/document-engine/dummy-templates.js`

**Interfaces:**
- Produces : templates factices `dummy-receipt`, `dummy-list`, `dummy-card`.

**Steps:**
- [ ] Créer un template programmatique simple (reçu-like).
- [ ] Créer un template déclaratif simple (liste).
- [ ] Créer un template programmatique carte/photo/QR.

---

## Task 13: Skeleton tests

**Files:**
- Create: `tests/document-engine/skeleton-test.mjs`

**Steps:**
- [ ] Créer un moteur avec providers factices.
- [ ] Tester AccessGate allow/deny.
- [ ] Tester résolution de DocumentModel avec snapshots.
- [ ] Tester génération PDF pour plusieurs types fictifs.
- [ ] Vérifier JSON-sérialisabilité de `DocumentRequest` et `DocumentModel`.
- [ ] Vérifier que `DocumentRequest` sans permission explicite est refusé.
- [ ] Vérifier watermarks preview.

---

## Task 14: Memory project update

**Files:**
- Modify: `docs/project-context/CURRENT_STATE.md`
- Modify: `docs/project-context/INDEX.md`
- Modify: `docs/project-context/SESSION_LOG.md`
- Modify: `docs/project-context/FRONTEND_MASTER_PLAN.md`

**Steps:**
- [ ] Marquer `FE-DOC-000` / DOC-02 en cours puis terminé.
- [ ] Documenter les fichiers créés.
- [ ] Noter les écarts éventuels.
