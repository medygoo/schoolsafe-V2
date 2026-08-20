# Task 5 — Rapport : scénarios E2E Playwright par profil critique

## Status

Implémentation terminée et revue corrigée. Les scénarios E2E couvrent les 6 profils de référence demandés :
administrateur principal, chef d’établissement, enseignant, agent de caisse, agent de sécurité, parent.

Le brief `task-5-brief.md` n’était pas présent dans `.superpowers/sdd/2026-08-19-schoolsafe-v2-qa-action-plan/`. Les scénarios ont été construits à partir :
- de la description de la tâche (6 profils critiques) ;
- du PWA statique dans `app/` ;
- du script de fumée existant `app/qa-smoke.cjs` qui valide les mêmes parcours.

## Fichiers créés / renommés

- `playwright.config.ts` — configuration Playwright avec serveur web local (`node app/server.mjs`), deux projets (desktop + mobile) et blocage des service workers.
- `tests/qa/e2e/helpers/index.ts` — helpers communs refactorés depuis `helpers.js` :
  - `enterDemoWorkspace(page, role)` : navigation splash → galerie → connexion → aperçu du profil.
  - `expectBranches(page, role)` / `expectNoBranch(page, key)` : validation des branches affichées/masquées.
  - `openAction(page, actionName)` : ouverture d’une action métier.
  - `openPermissionsConsole(page)` : ouverture de la console rôles et accès pour l’administrateur.
  - `domClick(page, selector)` : clic par évaluation DOM pour contourner les animations CSS.
  - Interception réseau : blocage des ressources CDN externes, blocage du module `pedagogy-module.js`, mock d’un frais d’élève en attente, et mocks de routes (`/pilotage/dashboard`, `/pilotage/alerts`, `/security/scan`, `/finance/student-fees` pending).
- `tests/qa/e2e/helpers/login.helper.ts` — nouveau helper dédié :
  - `login(page, email, password)` : remplit et soumet le formulaire de connexion.
- `tests/qa/e2e/administrateur.spec.ts` — scénarios administrateur principal (renommé depuis `admin.spec.js`).
- `tests/qa/e2e/chef-etablissement.spec.ts` — scénarios chef d’établissement (renommé depuis `school-head.spec.js`).
- `tests/qa/e2e/enseignant.spec.ts` — scénarios enseignant (renommé depuis `teacher.spec.js`).
- `tests/qa/e2e/agent-caisse.spec.ts` — scénarios agent de caisse (renommé depuis `cashier.spec.js`).
- `tests/qa/e2e/agent-securite.spec.ts` — scénarios agent de sécurité (renommé depuis `guard.spec.js`).
- `tests/qa/e2e/parent.spec.ts` — scénarios parent (renommé depuis `parent.spec.js`).

Les anciens fichiers `tests/qa/e2e/helpers.js` et les specs `.spec.js` en anglais ont été supprimés.

## Fichiers modifiés

- `package.json` — ajout de `@playwright/test` en devDependency et du script `test:e2e:profiles`.
- `package-lock.json` — mis à jour par `npm install`.

## Méthodologie

1. **Navigation** : chaque test démarre depuis `/`, traverse l’écran d’accueil animé, la galerie et le formulaire de connexion, puis sélectionne le profil dans la liste de démonstration `#demoRole`.
2. **Sélecteurs** : le PWA ne contient pas d’attributs `data-testid`. Les tests utilisent :
   - les IDs stables (`#workspace`, `#financeModule`, `#securityModule`, `#pedagogyModule`, `#pilotageModule`) ;
   - les attributs `data-action` des boutons de branche ;
   - les attributs `data-finance-tab`, `data-pedagogy-tab`, `data-cert-view`, `data-cert-exam`.
3. **Isolation** : chaque test ré-entre dans l’espace depuis le début ; aucun état partagé entre scénarios.
4. **Gestion de l’environnement** :
   - Le backend (`127.0.0.1:8787`) et Supabase local ne sont pas disponibles.
   - Le serveur de prévisualisation `app/server.mjs` démarre automatiquement via `webServer`.
   - Les appels CDN sont interceptés et avortés pour éviter les blocages au chargement.
   - Le module `modules/pedagogy/pedagogy-module.js` est intercepté et avorté afin d’utiliser le fallback `app.js`, qui dispose des données de démonstration locales (devoirs, certifications).
   - Un frais d’élève `pending` est mocké pour que le formulaire de paiement de la caisse apparaisse.
   - Les routes `/pilotage/dashboard`, `/pilotage/alerts` et `/security/scan` sont mockées pour valider les indicateurs et le résultat de scan sans backend.
5. **Validation** : chaque profil vérifie ses branches autorisées, l’absence des branches interdites et l’ouverture d’au moins une action métier caractéristique.

## Scénarios couverts

| Profil | Branches attendues | Action métier testée | Vérification clé |
|--------|-------------------|----------------------|------------------|
| Administrateur principal | pilotage, school, people, pedagogy, security, finance, accounting, communication, reports | Pilotage, sécurité, structure des frais, console rôles et accès | `#permissionsNav` visible, `#accessConsole` accessible, branche administration avancée masquée en mode démo documentée |
| Chef d’établissement | pilotage, school, pedagogy, security, finance, reports | Approbations, recettes, tableau de bord | Onglet alerts actif, onglets cash/fees masqués, indicateurs KPI visibles |
| Enseignant | pedagogy, communication | Devoirs et corrections, préparation EXETAT | `#assignmentForm` visible, liste des travaux assignés peuplée, vues certificatives limitées |
| Agent de caisse | finance | Enregistrer un paiement, rapport de caisse, émission de reçu | Paiement enregistré → reçu `REC-2026-0588`, pas d’accès aux frais, interface d’émission de reçu visible, bouton d’annulation documenté en mode démo |
| Agent de sécurité | security | Scanner un QR | `#securityModule` + `#qrPayloadInput` visibles, scan déclenché, résultat `ALLOWED` affiché |
| Parent | school, finance, communication | Frais scolaires, épreuves certificatives | Uniquement ses enfants dans le sélecteur, reçus mis à jour selon l’enfant choisi, enfant non autorisé absent |

## Résultat de la commande demandée

Commande exécutée :

```bash
$ npx playwright test tests/qa/e2e --timeout=60000 --workers=1 --reporter=list

Running 46 tests using 1 worker
...
  46 passed (6.2m)
```

Récapitulatif : 46 tests (23 desktop + 23 mobile) passent ; 0 échec.

## One-Line Test Summary

46 scénarios E2E Playwright couvrant les 6 profils critiques sur desktop et mobile ; 46 passed, 0 failed.

## Concerns

1. **Brief introuvable** : le fichier `task-5-brief.md` n’existait pas dans le worktree. Les exigences ont été déduites de la description de la tâche et du script `qa-smoke.cjs` existant.
2. **Absence de backend** : les tests s’exécutent contre le PWA statique en mode démonstration. Les appels au backend (`127.0.0.1:8787`) et à Supabase sont indisponibles ; les flux réels d’authentification, de persistance et d’audit ne sont pas validés.
3. **Interceptations nécessaires** : pour que les scénarios pédagogiques et financiers passent, le helper intercepte le module `pedagogy-module.js` et mock un `student_fee` pending. Ces artifices devront être retirés dès que le backend fournira des données de test cohérentes.
4. **Sélecteurs fragiles** : sans `data-testid`, les tests reposent sur des IDs et des attributs `data-action`. Tout renommage d’action ou de branche dans `app.js` cassera les tests.
5. **Branche administration masquée en démo** : en l’absence de session live, la branche `administration` (action « École & Personnel ») est filtrée côté application. Le scénario admin documente ce comportement.
6. **Performance** : la suite complète prend ~6 minutes avec 1 worker en raison des transitions animées et du rafraîchissement à chaque test.
7. **Mocks réseau** : les routes `/pilotage/dashboard`, `/pilotage/alerts`, `/security/scan` et `/finance/student-fees` sont mockées côté test. Elles doivent être supprimées ou alignées sur les vraies API lors de l’intégration backend.

## Commits

- `cc33ed5` — `test(qa): add Playwright E2E scenarios for the six critical reference profiles`
