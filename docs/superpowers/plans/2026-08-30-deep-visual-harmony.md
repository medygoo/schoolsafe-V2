# Deep Visual Harmony Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harmoniser profondément les surfaces frontend B à L dans trois commits post-M8, puis re-geler la baseline.

**Architecture:** Trois feuilles CSS de finition, chargées après `domain-identity.css`, partagent le même contrat de variables et restent scopées à leurs domaines. Une suite Playwright ouvre les vraies sous-fonctions et contrôle styles calculés, cibles tactiles, overflow, thèmes et statuts universels.

**Tech Stack:** HTML/CSS SchoolSafe, JavaScript frontend existant, Playwright TypeScript, scripts QA Node.

**Spec:** `docs/superpowers/specs/2026-08-30-deep-visual-harmony-design.md`

## Global Constraints

- Branche unique : `work/phase-m-frontend-freeze`, depuis `b7c18eabdd50468b784c4970e2cdea7d8399f760`.
- Aucun reset, revert, rebase, amend, force-push, merge ou PR.
- Aucun backend, permission, API, SQL/RLS, Worker, Supabase ou Jaspe 3D.
- Ne pas modifier `shared/permissions.json`, `app/modules/core/access.js`, `app/modules/cards/`, Splash, Guardian ou les calculs Executive KPI.
- Conserver les couleurs sémantiques universelles et le Design System SchoolSafe.

---

### Task 1: École, Parent et Pédagogie

**Files:**
- Create: `app/styles/modules/deep-school-harmony.css`
- Create: `tests/qa/e2e/frontend-deep-visual-harmony.spec.ts`
- Modify: `app/index.html`
- Create: `docs/superpowers/specs/2026-08-30-deep-visual-harmony-design.md`
- Create: `docs/superpowers/plans/2026-08-30-deep-visual-harmony.md`

**Interfaces:**
- Produces: variables CSS `--harmony-accent`, `--harmony-accent-2`, `--harmony-soft`, `--harmony-line`, `--harmony-ring` sur les racines École, Parent et Pédagogie.
- Consumes: jetons `--ss-domain-ecole*`, `--ss-domain-parent*`, `--ss-domain-pedagogie*`, composants `.ss-*` existants.

- [ ] **Step 1: Écrire les assertions Playwright en échec**

Ajouter les cas École, Parent et Pédagogie qui ouvrent une sous-fonction réelle et attendent le contrat CSS, une carte/formulaire/tableau teinté, des contrôles de 44 px et aucun remplacement de `.ss-badge--success`/`.ss-badge--danger`.

- [ ] **Step 2: Vérifier l’échec RED**

Run: `$env:PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH='C:\Program Files\Google\Chrome\Application\chrome.exe'; npx playwright test tests/qa/e2e/frontend-deep-visual-harmony.spec.ts --project=chromium-desktop`

Expected: FAIL parce que `deep-school-harmony.css` et `--harmony-accent` n’existent pas.

- [ ] **Step 3: Implémenter la feuille CSS minimale**

Ajouter les variables scopées, les finitions cartes/KPI/formulaires/tableaux/focus/modale, les cibles de 44 px, les wrappers scrollables et le lien CSS après `domain-identity.css`.

- [ ] **Step 4: Vérifier GREEN et les régressions ciblées**

Run: `$env:PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH='C:\Program Files\Google\Chrome\Application\chrome.exe'; npx playwright test tests/qa/e2e/frontend-deep-visual-harmony.spec.ts tests/qa/e2e/frontend-domain-identities.spec.ts tests/qa/e2e/frontend-subfeature-harmony.spec.ts --project=chromium-desktop`

- [ ] **Step 5: Commit, push, égalité distante et rapport Issue #23**

Commit: `fix(frontend): deepen school pedagogy and parent visual harmony`

### Task 2: Opérations, Finance et Personnel

**Files:**
- Create: `app/styles/modules/deep-operations-harmony.css`
- Modify: `app/index.html`
- Modify: `tests/qa/e2e/frontend-deep-visual-harmony.spec.ts`

**Interfaces:**
- Produces: même contrat CSS sur Sécurité, Finance, Comptabilité, RH et Stock.
- Consumes: jetons de domaine existants et composants métier existants.

- [ ] **Step 1: Étendre le test avec les cinq domaines et observer RED**

Ouvrir scanner/sécurité, situation Finance, journal Comptabilité, personnel RH et catalogue Stock ; attendre accent calculé, cartes, formulaires, tableaux et focus.

- [ ] **Step 2: Implémenter `deep-operations-harmony.css` et son lien HTML**

Appliquer le contrat partagé sans recolorer les états sémantiques.

- [ ] **Step 3: Vérifier la suite profonde et les smokes F/G/H/I**

Run: `$env:PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH='C:\Program Files\Google\Chrome\Application\chrome.exe'; npx playwright test tests/qa/e2e/frontend-deep-visual-harmony.spec.ts tests/qa/e2e/guard-security-operations.spec.ts tests/qa/e2e/finance-dashboard.spec.ts tests/qa/e2e/accounting-dashboard.spec.ts tests/qa/e2e/hr-dashboard.spec.ts tests/qa/e2e/inventory-dashboard.spec.ts --project=chromium-desktop`

- [ ] **Step 4: Commit, push, égalité distante et rapport Issue #23**

Commit: `fix(frontend): deepen operations finance and people visual harmony`

### Task 3: Documents, Communication, Administration et Jaspe

**Files:**
- Create: `app/styles/modules/deep-governance-harmony.css`
- Modify: `app/index.html`
- Modify: `tests/qa/e2e/frontend-deep-visual-harmony.spec.ts`

**Interfaces:**
- Produces: même contrat CSS sur Documents, Communication, Administration et les cartes Jaspe logicielles.
- Consumes: jetons `--ss-domain-documents*`, `--ss-domain-communication*`, `--ss-domain-administration*`, `--ss-domain-jaspe*`.

- [ ] **Step 1: Étendre le test avec les quatre domaines et observer RED**

Ouvrir Centre de documents, Messages, Paramètres/permissions et cartes Jaspe ; attendre les composants profonds et vérifier l’absence de formats 3D.

- [ ] **Step 2: Implémenter `deep-governance-harmony.css` et son lien HTML**

Appliquer le contrat partagé aux cartes, formulaires, filtres, tables, limites et focus, sans toucher Safe/Guardian 2D.

- [ ] **Step 3: Vérifier la suite profonde et les smokes J/K/L/Jaspe**

Run: `$env:PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH='C:\Program Files\Google\Chrome\Application\chrome.exe'; npx playwright test tests/qa/e2e/frontend-deep-visual-harmony.spec.ts tests/qa/e2e/documents-center.spec.ts tests/qa/e2e/communication-dashboard.spec.ts tests/qa/e2e/administration-dashboard.spec.ts tests/qa/e2e/administration-jaspe-qa.spec.ts --project=chromium-desktop`

- [ ] **Step 4: Commit, push, égalité distante et rapport Issue #23**

Commit: `fix(frontend): deepen documents communication and admin visual harmony`

### Task 4: QA globale et re-gel

**Files:**
- Modify: `tests/qa/e2e/frontend-final-freeze.spec.ts`

**Interfaces:**
- Produces: contrat final M8 mis à jour avec la suite profonde et les trois feuilles CSS.
- Consumes: tous les artefacts des tâches 1 à 3.

- [ ] **Step 1: Ajouter l’assertion de re-gel et observer RED**

Exiger `frontend-deep-visual-harmony.spec.ts` dans `PHASE_SPECS` et la présence des trois feuilles CSS chargées après `domain-identity.css`.

- [ ] **Step 2: Finaliser le verrou et exécuter toute la matrice demandée**

Run: `node app/qa-smoke.cjs; node app/qa-dashboard.cjs; node app/qa-pwa.cjs; node app/qa-i18n.cjs; node app/qa-visual-typography.cjs`

Run: `$env:PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH='C:\Program Files\Google\Chrome\Application\chrome.exe'; npx playwright test tests/qa/e2e/frontend-domain-identities.spec.ts tests/qa/e2e/frontend-subfeature-harmony.spec.ts tests/qa/e2e/frontend-executive-kpi.spec.ts tests/qa/e2e/frontend-final-security.spec.ts tests/qa/e2e/frontend-deep-visual-harmony.spec.ts tests/qa/e2e/frontend-final-freeze.spec.ts`

- [ ] **Step 3: Contrôler visuellement 390/834/1440, clair/bleu nuit, et produire des captures représentatives**

Vérifier absence d’overflow, modales bornées, tables scrollables, texte lisible et cibles de 44 px sur les surfaces représentatives des trois groupes.

- [ ] **Step 4: Commit, push, égalité distante et rapport final Issue #23**

Commit: `chore(frontend): re-freeze baseline after deep visual harmony`
