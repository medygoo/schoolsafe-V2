# Aperçu local permanent de SchoolSafe V2 — Plan d’implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Installer la maquette validée dans `app` et fournir un démarrage local fiable sur `127.0.0.1:4175`.

**Architecture:** `app` devient la source permanente des fichiers statiques et du serveur HTTP local. Un lanceur PowerShell résout Node, empêche une seconde instance et attend l’écoute du port; un contrôle séparé donne un diagnostic sans modifier l’application.

**Tech Stack:** HTML/CSS/JavaScript, Node.js natif, PowerShell, `node:test`, Playwright pour les suites QA existantes.

## Global Constraints

- Écoute locale uniquement sur `127.0.0.1`.
- Port par défaut exact : `4175`.
- Aucun accès ou changement VPS, Supabase, base, RLS, migration, secret, sauvegarde ou production.
- Le sous-système de cartes et le comportement fonctionnel de la maquette restent inchangés.
- Aucun commit n’est possible tant que le dossier n’est pas initialisé comme dépôt Git.

---

### Task 1: Contrat de permanence et intégration

**Files:**
- Create: `tests/qa-permanent-preview.cjs`
- Replace: `app/README.md`
- Copy: `app/index.html`, `app/app.js`, `app/i18n.js`, `app/styles.css`, `app/server.mjs`, médias, bibliothèques locales, PWA et suites QA

**Interfaces:**
- Consumes: maquette validée du 14 août 2026.
- Produces: application autonome servie depuis le dossier officiel `app`.

- [ ] **Step 1: Write the failing test**

Créer un test `node:test` qui exige les fichiers permanents, confirme l’écoute locale et le port par défaut 4175, puis démarre `server.mjs` sur un port de test et lit `index.html` par HTTP.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/qa-permanent-preview.cjs`

Expected: FAIL parce que `app/index.html` et les lanceurs n’existent pas encore.

- [ ] **Step 3: Copy the validated application**

Copier uniquement les sources, médias, documentation embarquée et scripts QA. Exclure les journaux, résultats QA et répertoires temporaires.

- [ ] **Step 4: Set the permanent default port**

Dans `app/server.mjs`, utiliser exactement :

```js
const port = Number(process.env.PORT || 4175);
```

- [ ] **Step 5: Run the contract test**

Run: `node --test tests/qa-permanent-preview.cjs`

Expected at this checkpoint: seul le contrat des lanceurs reste en échec.

### Task 2: Lanceur et contrôle de disponibilité

**Files:**
- Create: `app/start-schoolsafe.ps1`
- Create: `app/check-schoolsafe.ps1`
- Modify: `app/README.md`
- Test: `tests/qa-permanent-preview.cjs`

**Interfaces:**
- Consumes: `app/server.mjs`, Node fourni par Codex ou `node` dans le PATH.
- Produces: lancement idempotent, PID local, journaux locaux et diagnostic du port 4175.

- [ ] **Step 1: Extend the failing contract test**

Vérifier que les scripts utilisent `127.0.0.1`, `4175`, le serveur du dossier `app`, un PID local et qu’ils ne contiennent aucune URL distante.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/qa-permanent-preview.cjs`

Expected: FAIL avec `start-schoolsafe.ps1` absent.

- [ ] **Step 3: Implement the minimal launcher**

Le lanceur résout Node, détecte un port déjà occupé, démarre `server.mjs` dans une fenêtre masquée, écrit les journaux et le PID sous le dossier temporaire Windows `SchoolSafeV2`, puis attend au maximum 10 secondes.

- [ ] **Step 4: Implement the health check**

Le contrôle utilise `Get-NetTCPConnection` pour retourner code 0 lorsque 4175 écoute et code 1 sinon, sans arrêter ni modifier aucun processus.

- [ ] **Step 5: Document operation**

Documenter les commandes de démarrage, de contrôle et d’arrêt du PID enregistré, ainsi que l’URL locale.

- [ ] **Step 6: Run contract and launch checks**

Run: `node --test tests/qa-permanent-preview.cjs`

Run: `powershell -ExecutionPolicy Bypass -File app/start-schoolsafe.ps1`

Run: `powershell -ExecutionPolicy Bypass -File app/check-schoolsafe.ps1`

Expected: PASS et port 4175 en écoute.

### Task 3: Régression fonctionnelle

**Files:**
- Verify: `app/qa-smoke.cjs`
- Verify: `app/qa-pwa.cjs`
- Verify: `app/qa-i18n.cjs`

**Interfaces:**
- Consumes: `SCHOOLSAFE_URL=http://127.0.0.1:4175/` et Playwright fourni par le runtime.
- Produces: preuve que l’intégration n’a pas modifié les parcours existants.

- [ ] **Step 1: Run smoke QA**

Run: `node app/qa-smoke.cjs`

Expected: PASS.

- [ ] **Step 2: Run PWA QA**

Run: `node app/qa-pwa.cjs`

Expected: PASS.

- [ ] **Step 3: Run bilingual QA**

Run: `node app/qa-i18n.cjs`

Expected: PASS.

- [ ] **Step 4: Verify final listener and source path**

Run: `netstat -ano | findstr :4175`

Expected: `127.0.0.1:4175 LISTENING`; le processus doit avoir été lancé avec `app/server.mjs`.
