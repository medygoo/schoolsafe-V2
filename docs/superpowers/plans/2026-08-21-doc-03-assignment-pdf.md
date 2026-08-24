# DOC-03 — Devoir / Interrogation PDF

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implémenter le premier document pilote du nouveau Document Engine : le devoir / interrogation PDF, avec texte saisi, PDF importé et photo importée.

**Architecture:** Un template `assignment-template.js` et un template `answer-sheet-template.js` dans `app/modules/document-engine/templates/` sont appelés depuis `app/modules/pedagogy/pedagogy-module.js` via le `DocumentEngine` de DOC-02. Le module Pédagogie conserve son existant et ajoute un éditeur de questions + gestion d’uploads locaux.

**Tech Stack:** JavaScript ES6 modules, jsPDF via `JspdfRenderContext`, FileReader pour les uploads locaux, pas de backend.

**Spec:** `docs/superpowers/specs/2026-08-21-document-engine-design.md`

## Global Constraints

- Frontend uniquement ; aucun backend, aucune migration, aucune commande Supabase.
- Réutiliser exclusivement le Document Engine de DOC-02.
- Aucun générateur PDF parallèle dans `app.js`.
- PDF universel obligatoire ; Excel/CSV/PNG complémentaires (mais XLSX est placeholder, donc pas de bouton Excel fonctionnel).
- ACCESS_LAW : admin = full, autres = deny par défaut, permissions via `shared/permissions.json`.
- Conserver ce qui fonctionne déjà dans l’ancien système de devoirs.

---

## File Structure

| File | Responsibility |
|------|---------------|
| `app/modules/document-engine/templates/assignment-template.js` | Template programmatique du sujet de devoir PDF. |
| `app/modules/document-engine/templates/answer-sheet-template.js` | Template programmatique de la feuille de réponses PDF. |
| `app/modules/document-engine/index.js` | Enregistrer les nouveaux templates (via un registrar côté moteur ou module). |
| `app/modules/pedagogy/pedagogy-module.js` | Ajouter l’éditeur de questions, les uploads, les boutons Aperçu/Imprimer/Télécharger, appeler le Document Engine. |
| `app/modules/pedagogy/pedagogy-api.js` | (Lecture seule) comprendre les endpoints existants. |
| `tests/document-engine/assignment-pdf-test.mjs` | Tests du template avec données factices. |

---

## Task 1: Assignment PDF template

**Files:**
- Create: `app/modules/document-engine/templates/assignment-template.js`

**Interfaces:**
- Produces : `assignmentTemplate` avec `info` + `render(ctx, model, layout)`.

**Steps:**
- [ ] Définir `info` : type `assignment`, permissions `pedagogy.assignment.read` / `pedagogy.assignment.manage`, layout `a4-portrait`.
- [ ] `render` : header école, identité SchoolSafe secondaire, titre, matière, classe, enseignant, date, consignes, questions numérotées.
- [ ] Pagination automatique avec `addPage()`.
- [ ] Ne jamais forcer le texte à tenir sur une seule page.
- [ ] Watermark BROUILLON si `authority === "preview"`.

---

## Task 2: Answer sheet template

**Files:**
- Create: `app/modules/document-engine/templates/answer-sheet-template.js`

**Interfaces:**
- Produces : `answerSheetTemplate` avec `info` + `render(ctx, model, layout)`.

**Steps:**
- [ ] Header identité école + SchoolSafe.
- [ ] Champs : nom/prénom élève, classe, matière, titre du devoir, date.
- [ ] Une ou plusieurs pages de lignes d’écriture adaptées.
- [ ] Générer en tant que deuxième document ou document dérivé.

---

## Task 3: Register templates

**Files:**
- Modify: `app/modules/document-engine/index.js` ou créer `app/modules/document-engine/bootstrap-templates.js`

**Steps:**
- [ ] Créer une fonction `registerDefaultTemplates(registry)` qui enregistre `assignment` et `answer-sheet`.
- [ ] L’appeler au démarrage du moteur côté `pedagogy-module.js`.

---

## Task 4: Extend assignment composer UI

**Files:**
- Modify: `app/modules/pedagogy/pedagogy-module.js`

**Steps:**
- [ ] Ajouter un sélecteur de mode : "Texte SchoolSafe", "Importer un PDF", "Importer une photo".
- [ ] Mode texte : ajouter un éditeur de questions dynamique (texte, points, espace réponse).
- [ ] Mode PDF : input file `accept=".pdf"`.
- [ ] Mode photo : input file `accept="image/*"`.
- [ ] Afficher l’aperçu de l’upload (iframe pour PDF, img pour photo).
- [ ] Conserver les métadonnées du devoir existant.

---

## Task 5: Wire Document Engine in pedagogy module

**Files:**
- Modify: `app/modules/pedagogy/pedagogy-module.js`

**Steps:**
- [ ] Importer `createDocumentEngine`, `createDocumentRequest`, `createTemplateRegistry`, etc. depuis `document-engine/index.js`.
- [ ] Initialiser le moteur avec providers factices/ecole + SchoolSafe.
- [ ] Enregistrer les templates assignment et answer-sheet.
- [ ] Boutons "Aperçu PDF", "Télécharger PDF", "Imprimer" sur le détail d’un devoir.
- [ ] Construire le `DocumentRequest` avec `origin: "generated"` (texte) ou `"uploaded"` (PDF/photo).
- [ ] Pour PDF/photo importé : générer aussi un "wrapper PDF SchoolSafe" optionnel plus tard ; pour l’instant aperçu natif + métadonnées.

---

## Task 6: ACCESS_LAW integration

**Steps:**
- [ ] Vérifier `requestedBy.permissions` contient `pedagogy.assignment.read` ou `pedagogy.assignment.manage`.
- [ ] Admin full access.
- [ ] Parent/other → deny par défaut pour générer un devoir.

---

## Task 7: Tests

**Files:**
- Create: `tests/document-engine/assignment-pdf-test.mjs`

**Steps:**
- [ ] Mock browser globals.
- [ ] Créer un moteur avec les templates assignment/answer-sheet.
- [ ] Tester génération PDF sujet avec questions.
- [ ] Tester génération PDF feuille de réponses.
- [ ] Tester refus sans permission.
- [ ] Vérifier JSON-sérialisabilité.

---

## Task 8: Manual QA

**Steps:**
- [ ] Lancer le frontend local.
- [ ] Ouvrir module Pédagogie > Devoirs.
- [ ] Créer un devoir texte avec questions, générer PDF.
- [ ] Importer un PDF et vérifier aperçu.
- [ ] Importer une photo et vérifier aperçu.
- [ ] Vérifier responsive desktop/mobile.
- [ ] Vérifier états erreur/fichier invalide.

---

## Task 9: Memory project update

**Files:**
- Modify: `docs/project-context/CURRENT_STATE.md`, `INDEX.md`, `SESSION_LOG.md`, `FRONTEND_MASTER_PLAN.md`, `BACKEND_LATER.md`.

**Steps:**
- [ ] Marquer DOC-03 terminé/en validation.
- [ ] Mettre à jour `FE-DOC-005` dans `FRONTEND_MASTER_PLAN.md`.
- [ ] Enregistrer les besoins backend découverts.
