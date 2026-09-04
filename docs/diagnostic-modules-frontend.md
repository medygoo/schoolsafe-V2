# Diagnostic READ-ONLY — Modules métier frontend SchoolSafe V2

Périmètre : `app/modules/` (17 modules, ~70 fichiers JS, 20 877 lignes). Aucune modification effectuée.

---

## 1. Inventaire des modules

| Module | Fichiers JS principaux (lignes) | Rôle | Branché en prod ? | Données |
|---|---|---|---|---|
| finance | finance-module.js (2378), finance-api.js (107), fee-control-module.js (295) | Frais, paiements, caisse, rapports, contrôle de frais | Oui (index.html:72-77) | **Double** : API réelle `/finance/*` si session live ; fixtures en dur en mode démo |
| pedagogy | pedagogy-module.js (1088), pedagogy-api.js (108), palmares-module.js (437), palmares-api.js (78), teacher-pedagogy-demo.js (982) | Matières, devoirs, notes, palmarès, portail enseignant | Oui (index.html:83-86, 96) | pedagogy/palmares : API réelle ; teacher-pedagogy : **100 % mock local** |
| safe | safe-assistant.js (970), jaspe-governance.js (97), jaspe-capability-router.js (100) | Assistant Jaspe (FAQ, onboarding, gouvernance) | Oui (index.html:99-102) | FAQ/réponses en dur (contenu statique, par design) |
| school | school-module.js (893), school-api.js (129) + 6 fichiers *-demo.js (102-448) | École, élèves, personnel, structure académique | Oui (index.html:87-94) | school-module : **API réelle** ; les 6 demo : mocks locaux |
| core | access.js (255), ui-helpers.js (725) | Moteur d'autorisation + Design System ss-* | Oui (index.html:100, 111) | — |
| accounting | accounting-treasury-demo.js (531) | Comptabilité / trésorerie | Oui (index.html:74) | **100 % mock** ; mur « DONNÉES INDISPONIBLES » en session live |
| hr | hr-demo.js (569) | Personnel, contrats, absences, présences | Oui (index.html:75) | **100 % mock** ; idem |
| inventory | inventory-demo.js (409) | Inventaire | Oui (index.html:76) | **100 % mock** |
| communication | communication-demo.js (645) | Messages, annonces, convocations | Oui (index.html:104) | **100 % mock** (brouillons localStorage) |
| administration | administration-demo.js (574) | Rôles, permissions, exceptions, simulation Access_Law | Oui (index.html:103) | Lecture via school-api ; **mutations simulées en mémoire** |
| security | security-module.js (359), security-api.js (63), guard-security-demo.js (640) | Scan QR, récupérations, portail gardien | Oui (index.html:78-80, 97) | security-module : partiellement API ; guard : **100 % mock** |
| parent | parent-portal-demo.js (830) | Portail parent (notes, finances, sécurité enfant) | Oui (index.html:95) | **100 % mock** |
| cards | cards-module.js (383), card-renderer.js (284), assets/card-data.js (187) | Cartes élèves (aperçu, PNG) | Oui (index.html:71, **seul `type="module"`**) | Données cartes locales |
| pilotage | pilotage-module.js (131), pilotage-api.js (67) | Dashboards, alertes direction | Oui (index.html:81-82) | API réelle |
| document-center | document-center.js (289) + 5 fichiers (96-322) | Centre de documents | Oui (index.html:105-110) | Mixte, via document-engine |
| document-engine | 30 fichiers (12-335) | Moteur de templates de documents (ES modules) | Oui (import dynamique) | — |
| jaspe3d | jaspe3d-loader.js (109), jaspe3d-runtime.js (296) | Avatar 3D de Jaspe | Oui (index.html:98) | — |

---

## 2. « module » vs « demo » : le point clé

**Les fichiers `*-demo.js` sont du code de production.** Tous chargés par `app/index.html` (lignes 74-111) et rendus dans les vrais écrans par `app/app.js` : `SchoolSafeHrDemo.render("hrModule")` (app.js:2661), `SchoolSafeInventoryDemo` (2696), `SchoolSafeCommunication` (2734), `SchoolSafeAccountingTreasury` (2623), `SchoolSafeParentPortal` (app.js:476), `SchoolSafeTeacherPedagogy` (483), `SchoolSafeGuardSecurity` (491). Le suffixe « demo » est trompeur : ce sont les **seules implémentations UI** de ces domaines.

Fonctionnement réel :
- **Sans token de session** (mode démo, typiquement localhost) → affichage de **fixtures en dur** (élèves « Lucas Martin », « Ethan Leroy », reçus REC-2026-058x, personnel « Aline Kalala »…).
- **Avec session live** → la plupart affichent un mur d'honnêteté : `SESSION LIVE · DONNÉES INDISPONIBLES · BACKEND_LATER` (hr-demo.js:98-99, accounting-treasury-demo.js:414-421, guard-security-demo.js:538, parent-portal-demo.js:667). **HR, Comptabilité, Inventaire, Communication, Parent, Enseignant, Gardien sont donc non fonctionnels en session réelle** — aucun appel backend n'existe dans ces fichiers.
- Seuls finance, pedagogy, palmares, school, security (partiel), pilotage ont des clients API réels (`*-api.js` → `fetch` vers `http://127.0.0.1:8787`, `Authorization: Bearer <token>` lu dans `localStorage["schoolsafe-v2-session"]`).

Cas particulier finance : `financeState = isDemoMode() ? createDemoState() : createRealState()` (finance-module.js:243), évalué **une seule fois au chargement du script** ; `createDemoState()` embarque ~80 lignes de fixtures (élèves, frais, transactions, lignes 125-203).

---

## 3. Patterns communs

- **Rendu UI** : templates par concaténation de strings + `innerHTML` (112 occurrences dans 26 fichiers), puis `lucide.createIcons()`. Deux systèmes de modules coexistent : IIFE/globals `window.*` partout, sauf cards (`type="module"`) et document-engine (ES modules, import dynamique dans pedagogy-module.js:72).
- **Design System** : `core/ui-helpers.js` exporte `ssButton/ssTable/ssModal/ssConfirm/ssInput/ssField/ssBadge/ssState/ssEscapeHtml` (ui-helpers.js:713-724). Adoption très inégale : finance-module 178 usages, school-module 33, pedagogy-module 26, mais **hr-demo 5, accounting 2, inventory 1, guard-security 0** — ces modules ré-implémentent leurs propres composants.
- **Appels API** : clients `*-api.js` homogènes (fetch + Bearer + throw Error). Point positif.
- **Permissions** : moteur central `core/access.js` (canAccess, allowsScope, explicitDeny, isBranchVisible, exceptions ALLOW/DENY) alimenté par `shared/permissions.json`. Utilisé par finance (29 occurrences), school, hr, communication, administration, parent, guard, teacher-pedagogy, safe (filtrage des suggestions par branche, safe-assistant.js:68-80).
- **Brouillons** : pattern localStorage `schoolsafe-v2-*-drafts` répété dans ~8 modules.

---

## 4. Respect de la règle d'autorisation (AGENTS.md)

**Globalement respectée dans les modules récents** : masquage d'onglets/actions selon permission+portée (finance-module.js:853, 913-914, 1163 ; hr-demo.js:91-95 ; school-module.js:124-130 ; administration-demo.js:39-48), DENY explicite prioritaire (access.js:166-169), portées `own_children/assigned_classes/school` appliquées (school-module.js:114-122, communication-demo.js:53-60).

**Écarts constatés :**
1. **pedagogy-module.js contourne SchoolSafeAccess** : `getUserPermissions` fabrique des permissions admin (l.62-64), `hasPdfPermission` fait `if (user.role === "admin") return true` (l.142) — **ignore le DENY explicite**, en violation directe de la règle verrouillée.
2. **pedagogy-module.js:53-59** : `getCurrentUser()` retombe sur `{ id: "demo-user", role: "admin" }` si la session est illisible → droits admin par défaut.
3. **school-module.js:92-97** ré-implémente `explicitDeny` au lieu d'appeler `access.explicitDeny` (risque de divergence), et `scopeFor` (l.106) accepte un scope sans `permission` comme joker valable pour toute permission.
4. **Audit** : les simulations d'exceptions d'administration-demo sont explicitement éphémères (« ne modifie jamais la session réelle », l.351) ; les vraies mutations passent par school-api (`updateStaffRoles`). Aucune écriture `audit_events` visible côté frontend — **à vérifier côté Worker/Supabase** (hors périmètre de ce diagnostic).

---

## 5. Problèmes transverses par sévérité

### Haute
- **H1. Modules entiers non connectés au backend** (hr, accounting, inventory, communication, parent, teacher-pedagogy, guard-security) alors qu'ils sont branchés comme modules de production. Preuves : hr-demo.js:10-40 (fixtures STAFF/CONTRACTS/ABSENCES), accounting-treasury-demo.js:421 (mur live), parent-portal-demo.js:13-58 (CHILDREN en dur).
- **H2. Contournement du moteur d'autorisation dans pedagogy-module** (voir §4 écarts 1-2) : admin implicite + DENY ignoré (pedagogy-module.js:62-64, 142).
- **H3. Surface XSS structurelle** : 112 sinks `innerHTML` alimentés par concaténation, avec 24 copies locales de `escapeMarkup`/`escapeHtml` au lieu du `ssEscapeHtml` mutualisé. Les fichiers échantillonnés échappent correctement, mais administration-demo.js:35-37 **n'échappe pas l'apostrophe**, et la sécurité repose sur la discipline de chaque fichier.

### Moyenne
- **M1. Fixtures démo dupliquées et incohérentes** : le même persona « Lucas Martin » apparaît dans finance-module.js:135 (450 000 CDF attendus), parent-portal-demo.js:43 (« 180 000 CDF »), teacher-pedagogy-demo.js:30, fee-control-module.js:42-46 — montants et classes divergents entre modules.
- **M2. Duplication de helpers** : escapeMarkup ×24 ; parsing de session localStorage ×7 (finance-api.js:9-18, school-api.js:13-22, finance-module.js:104-111, pedagogy-module.js:53-59, safe-assistant.js:42-53…) ; `isDemoMode`/`hasValidSessionToken` ×3 ; helpers de drafts localStorage ×8 ; notifications hétérogènes (school-module.js:48-60 retombe sur `window.alert`, pedagogy-module.js:35-41 émet un CustomEvent `schoolsafe-toast`, finance utilise `SchoolSafeApp.notify`).
- **M3. Fonctions géantes** : ~393 lignes (finance-module, renderer), 240 (safe-assistant), 207 (pedagogy), 167 (school, parent) — templates HTML monolithiques difficiles à tester.
- **M4. Double système de modules** : cards en `type="module"`, document-engine en ES modules dynamiques, tout le reste en globals `window.SchoolSafe*` chargés par `defer` ; dépendances résolues par introspection défensive `typeof window.X === "function"` (finance-module.js:10-27).

### Basse
- **B1. Validation de formulaires ad hoc** : attribut `required` HTML + contrôles manuels dispersés (finance-module.js:631, 641 : Number.isFinite sur montants) ; pas de validateur mutualisé.
- **B2. Nommage trompeur** : les `*-demo.js` sont du code embarqué en prod ; « demo » décrit la donnée, pas le code.
- **B3. État figé au chargement** : `financeState` calculé une fois à l'évaluation du script (finance-module.js:243) ; un login post-chargement ne rebascule pas démo→réel sans rechargement de page.
- **B4. apiBase en dur** `http://127.0.0.1:8787` dans chaque client (finance-api.js:7, school-api.js:4, app.js:36) avec overrides hétérogènes (`window.schoolSafeApiBase` vs `window.schoolSafeBackendConfig`).

---

## 6. Cohérence UX entre modules

Les modules « récents » (finance, school, pedagogy, pilotage, security-module) convergent vers le Design System ss-* (badges, tables, modales, états vides `ssState`). Les modules « demo » (hr, accounting, inventory, guard, parent, communication) ont chacun leurs propres classes CSS et patterns de panneaux — visuellement harmonisés via `styles/modules/*.css`, mais markup et comportements (toasts, modales, formulaires) non mutualisés. Le marquage `BACKEND_LATER` est un bon pattern d'honnêteté, appliqué de façon uniforme dans les modules demo.

## 7. Recommandations priorisées

1. Brancher HR/Comptabilité/Inventaire/Communication/Parent/Teacher/Guard sur des endpoints réels, ou les masquer de la navigation tant que le backend n'existe pas (`isBranchVisible` les affiche dès que la permission est accordée).
2. Faire passer pedagogy-module par SchoolSafeAccess (supprimer les bypass `role === "admin"` et le fallback admin de `getCurrentUser`).
3. Mutualiser `escapeMarkup`, le parsing de session, `isDemoMode`, les drafts localStorage et `notify` dans `core/`.
4. Rendre l'audit `audit_events` vérifiable côté Worker (à contrôler dans un diagnostic backend).
5. Consolider les fixtures démo dans un fichier partagé unique (personas cohérents entre modules).
