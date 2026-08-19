# Task 5 — Rapport : scénarios E2E Playwright par profil critique

## Status

Implémentation terminée. Les scénarios E2E couvrent les 6 profils de référence demandés :
administrateur principal, chef d’établissement, enseignant, agent de caisse, agent de sécurité, parent.

Le brief `task-5-brief.md` n’était pas présent dans `.superpowers/sdd/2026-08-19-schoolsafe-v2-qa-action-plan/`. Les scénarios ont été construits à partir :
- de la description de la tâche (6 profils critiques) ;
- du PWA statique dans `app/` ;
- du script de fumée existant `app/qa-smoke.cjs` qui valide les mêmes parcours.

## Fichiers créés

- `playwright.config.ts` — configuration Playwright avec serveur web local (`node app/server.mjs`), deux projets (desktop + mobile) et blocage des service workers.
- `tests/qa/e2e/helpers.js` — helpers communs :
  - `enterDemoWorkspace(page, role)` : navigation splash → galerie → connexion → aperçu du profil.
  - `expectBranches(page, role)` / `expectNoBranch(page, key)` : validation des branches affichées/masquées.
  - `openAction(page, actionName)` : ouverture d’une action métier.
  - `domClick(page, selector)` : clic par évaluation DOM pour contourner les animations CSS.
  - Interception réseau : blocage des ressources CDN externes, blocage du module `pedagogy-module.js` qui ne gère pas les données de démonstration locales, et mock d’un frais d’élève en attente pour rendre le formulaire de caisse disponible.
- `tests/qa/e2e/admin.spec.js` — scénarios administrateur principal.
- `tests/qa/e2e/school-head.spec.js` — scénarios chef d’établissement.
- `tests/qa/e2e/teacher.spec.js` — scénarios enseignant.
- `tests/qa/e2e/cashier.spec.js` — scénarios agent de caisse.
- `tests/qa/e2e/guard.spec.js` — scénarios agent de sécurité.
- `tests/qa/e2e/parent.spec.js` — scénarios parent.

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
5. **Validation** : chaque profil vérifie ses branches autorisées, l’absence des branches interdites et l’ouverture d’au moins une action métier caractéristique.

## Scénarios couverts

| Profil | Branches attendues | Action métier testée | Vérification clé |
|--------|-------------------|----------------------|------------------|
| Administrateur principal | pilotage, school, people, pedagogy, security, finance, accounting, communication, reports | Pilotage, sécurité, structure des frais | `#permissionsNav` visible, modules accessibles |
| Chef d’établissement | pilotage, school, pedagogy, security, finance, reports | Approbations, recettes | Onglet alerts actif, onglets cash/fees masqués |
| Enseignant | pedagogy, communication | Devoirs et corrections, préparation EXETAT | `#assignmentForm` visible, vues certificatives limitées |
| Agent de caisse | finance | Enregistrer un paiement, rapport de caisse | Paiement enregistré → reçu `REC-2026-0588`, pas d’accès aux frais |
| Agent de sécurité | security | Scanner un QR | `#securityModule` + `#qrPayloadInput` visibles |
| Parent | school, finance, communication | Frais scolaires, épreuves certificatives | Uniquement ses enfants, vues parent/stages seules |

## Résultat de la commande demandée

Commande exécutée :

```bash
$ npm run test:e2e:profiles

> testsafe-v2@ test:e2e:profiles
> playwright test tests/qa/e2e

Running 32 tests using 2 workers
...
  32 passed (3.8m)
```

Récapitulatif : 32 tests (16 desktop + 16 mobile) passent ; 0 échec.

## One-Line Test Summary

32 scénarios E2E Playwright couvrant les 6 profils critiques sur desktop et mobile ; 32 passed, 0 failed.

## Concerns

1. **Brief introuvable** : le fichier `task-5-brief.md` n’existait pas dans le worktree. Les exigences ont été déduites de la description de la tâche et du script `qa-smoke.cjs` existant.
2. **Absence de backend** : les tests s’exécutent contre le PWA statique en mode démonstration. Les appels au backend (`127.0.0.1:8787`) et à Supabase sont indisponibles ; les flux réels d’authentification, de persistance et d’audit ne sont pas validés.
3. **Interceptations nécessaires** : pour que les scénarios pédagogiques et financiers passent, le helper intercepte le module `pedagogy-module.js` et mock un `student_fee` pending. Ces artifices devront être retirés dès que le backend fournira des données de test cohérentes.
4. **Sélecteurs fragiles** : sans `data-testid`, les tests reposent sur des IDs et des attributs `data-action`. Tout renommage d’action ou de branche dans `app.js` cassera les tests.
5. **Branche administration masquée en démo** : en l’absence de session live, la branche `administration` (action « École & Personnel ») est filtrée côté application. Le scénario admin n’a donc pas pu ouvrir cette action spécifique.
6. **Performance** : la suite complète prend ~4 minutes avec 2 workers en raison des transitions animées et du rafraîchissement à chaque test.

## Commits

- `cc33ed5` — `test(qa): add Playwright E2E scenarios for the six critical reference profiles`
