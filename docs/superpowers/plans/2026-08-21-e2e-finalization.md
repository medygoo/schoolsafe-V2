# Finalisation E2E SchoolSafe V2 — Plan d’exécution

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline execution with user validation checkpoints).

**Goal:** Nettoyer le code, revalider Palmarès et Clôture de caisse via le dashboard E2E, puis produire le rapport final des écarts.

**Architecture:** Le frontend atteint maintenant le dashboard Administrateur Principal après correction du CORS backend. Le travail restant est du nettoyage, de la validation fonctionnelle ciblée et de la rédaction de rapport.

**Tech Stack:** JavaScript vanilla (frontend), Node/TypeScript/Fastify (backend), Playwright (E2E), Supabase Cloud SCHOOLSAFE-FIN.

**Spec:** Dernière demande utilisateur — finaliser validation E2E étape par étape avec validation humaine à chaque étape.

## Global Constraints

- Aucun `git push`, aucun déploiement.
- Aucune commande destructive sur Supabase Cloud (`db reset`, `db push`, migration, suppression de données).
- Aucune suppression de fonctionnalité existante.
- Conserver Safe Assistant intact (visuel + fonctionnel).
- Conserver le cube, les deux premiers écrans et l’identité Aura Blue.
- Le backend distant SCHOOLSAFE-FIN reste la source de vérité.

---

### Task 1 : Retirer les logs temporaires de debug de `app/app.js`

**Files:**
- Modify: `app/app.js`

**Interfaces:**
- Consumes: logs de traçage ajoutés précédemment autour du login (`[login] …`).
- Produces: fichier `app/app.js` sans logs de debug, comportement de connexion inchangé.

- [ ] **Step 1.1 : Lire les zones modifiées**
  - Lire `app/app.js` autour des lignes 149-156 (`callBootstrap`), 2050-2080 (login submit), 1831 (showScreen), 205-208 (enterLiveSession).

- [ ] **Step 1.2 : Supprimer les `console.log` temporaires**
  - Retirer tous les `console.log("[login] …")` et `console.log("[login] showScreen: …")`.
  - Conserver le comportement fonctionnel (appels à `callBootstrap`, `applyBootstrap`, `enterLiveSession`, `showScreen`).

- [ ] **Step 1.3 : Vérifier syntaxe**
  - Run: `node --check app/app.js`
  - Expected: aucune erreur.

- [ ] **Step 1.4 : Relancer smoke test E2E rapide**
  - Run: `node tmp/e2e-smoke.test.mjs`
  - Expected: login réussi, dashboard atteint, `Logged in detected: true`.

- [ ] **Step 1.5 : Marquer comme terminé et demander validation utilisateur**

---

### Task 2 : Revalider Palmarès et Clôture de caisse via le dashboard E2E

**Files:**
- Read: `app/modules/pedagogy/palmares-module.js`, `app/modules/finance/finance-module.js`
- Modify (si nécessaire): `tmp/e2e-smoke.test.mjs` pour ajouter des vérifications ciblées.

**Interfaces:**
- Consumes: session admin bootstrapée, routes backend `POST /finance/cash-register/close`, `GET /pedagogy/rankings`, `POST /pedagogy/rankings/compute`.
- Produces: confirmation visuelle/E2E que les modules Finance (clôture) et Palmarès répondent correctement.

- [ ] **Step 2.1 : Identifier les points d’entrée UI**
  - Vérifier les IDs/buttons qui ouvrent Palmarès et Clôture de caisse dans `app/index.html` et `app/app.js`.

- [ ] **Step 2.2 : Vérifier les appels API backend**
  - Confirmer que `POST /finance/cash-register/close` renvoie 200.
  - Confirmer que `GET /pedagogy/rankings?month=2026-08` renvoie 200 (liste vide attendue sans données).
  - Confirmer que `POST /pedagogy/rankings/compute` renvoie 400 « Aucune évaluation » sans données (comportement attendu).

- [ ] **Step 2.3 : Étendre le test E2E pour cliquer sur Finance → Clôture et Pédagogie → Palmarès**
  - Ajouter des étapes Playwright qui, depuis le dashboard admin, ouvrent le module Finance, vérifient la présence du bouton/section Clôture de caisse, puis ouvrent Palmarès et vérifient son affichage.
  - Capturer des screenshots : `tmp/finance-closure.png`, `tmp/palmares-view.png`.

- [ ] **Step 2.4 : Exécuter le test E2E étendu**
  - Run: `node tmp/e2e-smoke.test.mjs`
  - Expected: dashboard atteint, captures Palmarès et Finance générées, aucune erreur console/API.

- [ ] **Step 2.5 : Marquer comme terminé et demander validation utilisateur**

---

### Task 3 : Produire le rapport final de validation

**Files:**
- Create: `tmp/QA_FINAL_REPORT.md` (rapport temporaire, pas de commit Git).

**Interfaces:**
- Consumes: résultats des Tasks 1 et 2, état du backend, état des migrations sur SCHOOLSAFE-FIN, captures d’écran.
- Produces: rapport final lisible avec ce qui passe, ce qui dépend de données, écarts restants.

- [ ] **Step 3.1 : Collecter l’état actuel**
  - Backend : CORS corrigé, endpoints `/health`, `/config`, `/session/bootstrap`, `/finance/cash-register/close`, `/pedagogy/rankings` opérationnels.
  - Supabase Cloud : migrations C1-C6 et Palmarès appliquées, permissions admin synchronisées.
  - Frontend : atteint le dashboard admin, Safe Assistant non bloquant.

- [ ] **Step 3.2 : Rédiger le rapport**
  - Section 1 : Résumé exécutif.
  - Section 2 : Ce qui est validé (avec preuves : statuts HTTP, captures, logs).
  - Section 3 : Ce qui dépend de données de test réelles (élèves, notes, paiements) et ne peut être pleinement validé sans seed.
  - Section 4 : Écarts restants mineurs (bugs UI, messages, comportements à vérifier en intégration réelle).
  - Section 5 : Recommandations pour la suite (seed de test, tests par profil non-admin, validation RLS réelle).

- [ ] **Step 3.3 : Lire le rapport pour vérification**
  - Run: `cat tmp/QA_FINAL_REPORT.md | head -n 50`
  - Expected: structure complète, chiffres cohérents.

- [ ] **Step 3.4 : Marquer comme terminé et demander validation utilisateur**

---

## Self-Review

- **Spec coverage:** les trois objectifs (nettoyage, revalidation Palmarès/Clôture, rapport) sont couverts.
- **Placeholder scan:** aucun TBD/TODO ; les commandes et fichiers sont explicites.
- **Type consistency:** les noms de routes et de fichiers correspondent au codebase actuel.
