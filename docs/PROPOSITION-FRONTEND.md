# SchoolSafe V2 — Proposition de refonte Frontend

> **Statut : PROPOSITION UNIQUEMENT.** Aucune modification n'a été apportée à l'application.
> Ce document synthétise le diagnostic complet du frontend et propose des solutions, alternatives et pistes de design.
> Date : 1er septembre 2026 · Basé sur 4 diagnostics détaillés (voir annexes).

***

## 1. Synthèse exécutive

SchoolSafe V2 est une PWA en JavaScript vanilla ambitieuse : ~67 000 lignes tu dans `app/modules` + `app/styles`, 17 modules métier, un moteur d'autorisation conforme à la règle verrouillée (Rôle → Permission → Portée → Exception), un design system moderne et tokenisé, un service worker solide.

**Le verdict : les fondations sont bonnes, mais l'application est aujourd'hui un hybride démo/production avec des failles de sécurité réelles et une architecture qui ne passera pas l'échelle.**

Les 5 sujets qui comptent vraiment :

| # | Sujet                                                                                            | Gravité     |
| - | ------------------------------------------------------------------------------------------------ | ----------- |
| 1 | Token JWT en clair dans `localStorage` + aucune CSP                                              | 🔴 Critique |
| 2 | Backend indisponible → bascule silencieuse en mode démo « Administrateur » sans authentification | 🔴 Critique |
| 3 | 7 modules métier branchés en production sans aucun backend (mur « BACKEND\_LATER »)              | 🟠 Majeur   |
| 4 | \~3,9 Mo chargés au démarrage, \~76 requêtes, aucun bundling/minification                        | 🟠 Majeur   |
| 5 | CSS : tokens fantômes, thème sombre troué, code mort contre des fichiers supprimés               | 🟠 Majeur   |

***

## 2. Ce qu'il faut PRÉSERVER (les points forts)

Avant toute refonte, ces acquis sont précieux et doivent rester intacts :

1. **`modules/core/access.js`** — le moteur d'autorisation unique (DENY prioritaire, portées, exceptions, aucun bypass). C'est la colonne vertébrale de la conformité AGENTS.md. **Ne pas réécrire.**
2. **`shared/permissions.json`** — le catalogue canonique des 60 permissions typées avec portées.
3. **Le design tokens system** (`styles/design-tokens.css`, 387 lignes) : palette, alias sémantiques, thème sombre complet, couleurs par domaine métier. Discipline rare (24 `!important` sur 19 269 lignes).
4. **Le service worker** (network-first navigations, cache-first assets, precache dynamique, purge) et **offline-sync.js** (file IndexedDB à 7 niveaux de priorité métier).
5. **Le harnais QA** (21 scripts Playwright : smoke, PWA, i18n, finance complet, typographie).
6. **L'accessibilité** : touch targets 44 px, `:focus-visible`, `prefers-reduced-motion`, aria.
7. **L'échappement HTML quasi systématique** dans les modules (994 usages sur 24 fichiers).
8. **Le lazy loading réel de Jaspe 3D** (three.js + GLB chargés uniquement à la demande) — le modèle à généraliser.

***

## 3. Problèmes et solutions proposées

### 3.1 Sécurité (priorité absolue)

| Problème                                                                                            | Preuve                         | Solution proposée                                                                                                                                                                                         |
| --------------------------------------------------------------------------------------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Token JWT sérialisé dans `localStorage` malgré `persistSession: false`                              | `app.js:140-143, 57`           | **Session en mémoire uniquement** + refresh token côté Worker (cookie `HttpOnly; Secure; SameSite=Strict`). Court terme : ne stocker que le profil (sans token), re-authentifier au reload via le Worker. |
| Aucune Content-Security-Policy (0 occurrence dans le workspace)                                     | `index.html`, `server.mjs`     | Ajouter CSP : `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:` + SRI sur tout CDN restant.                                                                 |
| Échec de connexion → `enterDemo()` ouvre le workspace **Administrateur** sans authentification      | `app.js:3276-3287`             | Séparer nettement : page d'erreur « backend indisponible » en mode live ; le mode démo devient un choix explicite et visuellement marqué (bannière permanente « MODE DÉMO »).                             |
| Sélecteur `demoRole` permet d'endosser 15 profils                                                   | `index.html:228-244`           | Le mode démo ne doit jamais être compilé dans le build de production (flag d'environnement).                                                                                                              |
| `./shared/permissions.json` renvoie 404 silencieuse → `getPermissionScope` retourne toujours `null` | `access.js:215-228`            | Copier/servir `permissions.json` dans `app/` au build, et échouer **bruyamment** (fail-closed) si le catalogue est introuvable.                                                                           |
| XSS résiduel : `person.scope` non échappé injecté dans `innerHTML`                                  | `app.js:2948, 2927, 2288`      | Un seul helper d'échappement canonique (il en existe 3 copies : `escapeMarkup`, `esc`, `escapeHtml`) + règle QA automatisée qui rejette tout `innerHTML` avec interpolation non échappée.                 |
| CDN qrcodejs/html2canvas sans SRI, jamais cachés par le SW                                          | `index.html:65-66`, `sw.js:81` | Vendorer ces libs localement (comme lucide/jspdf) → sécurité + hors-ligne.                                                                                                                                |

> ⚠️ Rappel verrou AGENTS.md : l'enforcement réel doit vivre dans le Worker (`workers/src/middleware/permission.ts` existe déjà) et dans les RLS Supabase. Le frontend ne fait que masquer. L'audit `audit_events` doit être vérifié côté Worker (hors périmètre de ce diagnostic).

### 3.2 Architecture & code

| Problème                                                                                                                                                 | Preuve                                 | Solution proposée                                                                                                                                                                                       |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 7 modules sans backend affichent des fixtures en démo et un mur « BACKEND\_LATER » en live                                                               | `hr-demo.js:98-99`, etc.               | **Décision produit** : soit connecter (ordre conseillé : Parent → Communication → HR), soit masquer ces modules du build live jusqu'à branchement. Ne jamais laisser un utilisateur réel face à un mur. |
| `pedagogy-module.js` contourne le moteur d'accès (`if (user.role === "admin") return true`, DENY ignoré)                                                 | `pedagogy-module.js:142, 62-64`        | Refaire passer pedagogy par `SchoolSafeAccess` comme les 15 autres modules. C'est une violation directe du verrou AGENTS.md.                                                                            |
| Monolithe `app.js` de 3 819 lignes (IIFE unique, `renderWorkspace` \~200 lignes)                                                                         | `app.js`                               | Découpage progressif en modules ES : `core/session.js`, `core/router.js`, `core/screens.js`… Sans framework.                                                                                            |
| Pas de router URL : 5 écrans basculés par classe `active`, navigation par chaînes de `if`                                                                | `app.js:3011-3027, 2824-2845`          | Mini-routeur hash (`#/finance/receipts`) : deep-linking, bouton retour, partage de liens. \~80 lignes suffisent.                                                                                        |
| État global via ~17 namespaces `window.SchoolSafe*` + mutations croisées                                                                                 | `app.js:969-977`                       | Un store minimal (état + abonnés, ~50 lignes) ; les modules s'abonnent au lieu de lire `window`.                                                                                                        |
| ~40 scripts chargés en eager, 2 systèmes de modules coexistants (IIFE/globals vs `type="module"`)                                                        | `index.html:63-112`                    | Standardiser sur ES modules + point d'entrée unique avec imports dynamiques par écran.                                                                                                                  |
| Code mort : panneau sync inaccessible (`#syncStatusButton` absent du HTML), menu FAB jamais ouvrable, badges en dur, bloc « Anciens éléments conservés » | `app.js:893-962`, `index.html:544-559` | Passage de nettoyage ciblé (liste complète dans le rapport d'architecture).                                                                                                                             |
| i18n par correspondance exacte de chaînes FR (\~465 paires) : renommer un libellé casse la traduction silencieusement                                    | `i18n.js:12-478`                       | Migrer vers des clés stables (`t('finance.receipts.title')`) avec fallback FR — migration scriptable.                                                                                                   |
| 24 copies locales d'`escapeMarkup`, session-parsing ×7, `isDemoMode` ×3                                                                                  | rapport modules                        | Mutualiser dans `core/ui-helpers.js` (existe déjà, adoption inégale : finance 178 usages vs guard-security 0).                                                                                          |
| Fixtures démo incohérentes (« Lucas Martin » à 450 000 CDF dans finance vs 180 000 dans parent-portal)                                                   | rapport modules                        | Une seule source de fixtures partagée `demo/fixtures.js`.                                                                                                                                               |

### 3.3 Performance

| Problème                                                            | Mesure                           | Solution proposée                                                                                                                                                 |
| ------------------------------------------------------------------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| \~3,9 Mo au 1er chargement, \~76 requêtes HTTP, JS/CSS non minifiés | 2,75 Mo JS + 563 Ko CSS + images | **Étape 1 sans framework** : esbuild (déjà dans les devDependencies !) → bundle unique minifié par écran + code-splitting. Gain estimé : −60 % de poids au login. |
| jspdf (357 Ko) + lucide (349 Ko) chargés à l'écran de login         | `index.html:63-64`               | `import()` dynamique au premier usage (le pattern Jaspe 3D existe déjà). −700 Ko immédiat.                                                                        |
| 35 feuilles CSS liées en `<head>` bloquant                          | `index.html:29-62`               | Bundler le CSS (tokens + base eager, modules en lazy).                                                                                                            |
| `schoolsafe-hero-reference.png` 1,7 Mo non référencé ; GLB 7 Mo     | `app/`                           | Supprimer l'image morte ; compresser le GLB (Draco/meshopt → \~2 Mo) ou proposer une version allégée.                                                             |
| Icône PWA unique `sizes: "any"` (réservé aux SVG)                   | `manifest.webmanifest`           | Générer 192×192 et 512×512 explicites + maskable → installabilité Chrome.                                                                                         |
| Version de cache SW manuelle (`frontend-m7`)                        | `sw.js:2`                        | Injection automatique du hash de build.                                                                                                                           |

### 3.4 CSS / Design system

| Problème                                                                                                      | Preuve                                                           | Solution proposée                                                                                               |
| ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Tokens fantômes (`--ss-amber-*`, `--ss-primary` utilisés, jamais définis)                                     | `school.css:253-440`, `administration.css:6`                     | Audit des variables : script qui liste les `var(--*)` non définies → compléter ou corriger `design-tokens.css`. |
| Collision de namespace `--ss-*` (cards.css définit ses propres `--ss-*` navy ≠ système)                       | `cards.css:6`                                                    | Renommer le scope cards en `--cards-*`.                                                                         |
| Thème sombre troué : 475 hex en dur hors tokens                                                               | `communication.css` (51), `entry.css` (49), `cards.css` intégral | Plan de tokenisation par module, en commençant par cards/communication/entry.                                   |
| Code mort : overrides contre `styles-original.css` supprimé ; `.today-item` généré sans style                 | `dashboard.css:8-21`, `app.js:2344`                              | Nettoyage + test visuel QA existant (`qa-visual-typography.cjs`).                                               |
| Contrastes WCAG limites : `--ss-text-muted #94a3b8`/blanc ≈ 2,9:1 ; micro-texte 9-10 px                       | design-tokens                                                    | Ajuster `--ss-text-muted` vers `#64748b` (≈ 4,6:1) ; plancher de 11-12 px pour les micro-labels.                |
| DESIGN.md désynchronisé (interdit les dégradés utilisés par 7 modules ; 22 breakpoints réels vs 5 documentés) | DESIGN.md                                                        | Mettre à jour DESIGN.md pour refléter la réalité — c'est la doc qui doit s'aligner, pas le code.                |
| Google Fonts externe dans cards.css                                                                           | `cards.css:2`                                                    | Self-héberger la police (PWA offline).                                                                          |

***

## 4. Alternatives d'architecture (choix stratégique)

Trois voies, par ordre de risque croissant. **Recommandation : Option A, en gardant B comme horizon.**

### Option A — Vanilla modernisé (recommandée, 2-4 semaines)

Garder la stack actuelle, ajouter uniquement :

* **esbuild** (déjà présent) : bundling, minification, code-splitting par écran.

* Mini-routeur hash + mini-store maison (\~150 lignes au total).

* Standardisation ES modules partout (fin des IIFE/globals).

* `import()` dynamique pour jspdf/lucide/QR (pattern Jaspe 3D généralisé).

**Avantages** : zéro réécriture, le moteur `access.js` et les modules restent tels quels, risque minimal, gains massifs de performance.
**Inconvénients** : pas de réactivité déclarative ; la discipline reste manuelle.

### Option B — Web Components + Lit (horizon 3-6 mois)

Migration progressive : chaque écran devient un custom element (`<ss-finance>`…), Lit (\~5 Ko) pour la réactivité et les templates sécurisés (échappement automatique → fin du risque XSS structurel).
**Avantages** : natif navigateur (pas de lock-in framework), encapsulation réelle des styles (fin des collisions `--ss-*`), templates sûrs par construction.
**Inconvénients** : réécriture module par module ; courbe d'apprentissage.

### Option C — Framework SPA (React/Vue/Svelte) — déconseillée maintenant

Réécriture complète. Le coût (67 000 lignes, harnais QA à porter, PWA à recâbler) n'est justifié que si l'équipe grandit fortement. À reconsidérer après la stabilisation du backend.

***

## 5. Alternatives de DESIGN (3 directions)

Le style actuel — flat premium « Aura Blue » (gris froid `#f8fafc`, cartes blanches, bleu marine `#1e3a8a` + or `#fbbf24`, ombres douces, glassmorphism légère) — est moderne au centre, hétérogène en périphérie. Trois directions possibles :

### Direction 1 — « Aura Blue raffiné » (évolution, risque minimal)

Conserver l'identité actuelle, corriger les trous :

* Thème sombre complété (tokeniser les 475 hex restants).

* Contrastes WCAG AA partout ; plancher typographique 11-12 px.

* Un seul système d'accents par domaine (fusionner les 3 conventions parallèles).

* Motion design léger : transitions 150-200 ms sur changements d'écran (respectant `prefers-reduced-motion`).

*Pour qui : continuité, pas de dépaysement des utilisateurs.*

### Direction 2 — « Éducation chaleureuse » (différenciation émotionnelle)

Une app scolaire consultée par des parents et des enfants peut gagner en chaleur :

* Palette adoucie : fond crème `#faf8f5`, primaire bleu-vert profond, accents terracotta/corail, succès sauge.

* Coins plus arrondis (16-20 px), illustrations (les PNG patrimoine existants deviennent des héros de section, optimisés en WebP/AVIF −80 % de poids).

* Typographie plus expressive pour les titres (self-hostée), corps 16 px maintenu.

* Mode « enfant » optionnel pour les écrans élèves/parents (plus gros, plus coloré, pictogrammes).

*Pour qui : image de marque distinctive, adoption parents/élèves.*

### Direction 3 — « Cockpit data-dense » (orientation pilotage)

Pour les administrateurs et la direction : style Linear/Notion/Stripe Dashboard :

* Densité accrue (corps 13-14 px sur les écrans admin uniquement), tableaux puissants (tri, filtres persistants, densité commutable).

* Sidebar compacte avec commandes clavier (palette `Ctrl+K`), navigation clavier complète.

* Gris neutres, un seul accent par domaine, dataviz sobre et systématique (sparklines dans les cartes KPI).

* Thème sombre traité comme produit de première classe.

*Pour qui : usage quotidien intensif par le personnel administratif et financier.*

> **Proposition de combinaison** : Direction 1 comme socle immédiat + Direction 3 pour les écrans admin/finance/pilotage + Direction 2 pour les portails parent/élève. Le design tokens system actuel (couleurs par domaine déjà déclinées) rend cette hybridation naturelle.

***

## 6. Plan de mise en œuvre proposé (sans toucher aux verrous)

| Phase                                             | Contenu                                                                                                                                                   | Durée estimée | Dépendances                         |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ----------------------------------- |
| **0 — Sécurité** (à faire avant tout déploiement) | CSP + SRI, token hors localStorage, fail-closed permissions.json, bannière mode démo explicite, vendorer les CDN, pedagogy repasse par `SchoolSafeAccess` | 3-5 jours     | Coordination Worker (refresh token) |
| **1 — Fondations**                                | esbuild + code-splitting, lazy jspdf/lucide, mini-routeur, nettoyage code mort, icônes PWA, image morte supprimée                                         | 1-2 semaines  | Aucune                              |
| **2 — Cohérence**                                 | Helpers mutualisés, fixtures unifiées, tokens fantômes + collisions CSS, thème sombre complété, DESIGN.md resynchronisé                                   | 1-2 semaines  | Phase 1                             |
| **3 — Produit**                                   | Décision modules sans backend (connecter ou masquer), i18n par clés, stratégie de conflits offline-sync, GLB compressé                                    | 2-4 semaines  | Backend/Worker                      |
| **4 — Design** (parallélisable)                   | Direction 1 socle + déclinaisons 2/3 par audience                                                                                                         | 2-3 semaines  | Phase 2                             |

**Règles intangibles pendant toute refonte** : `core/access.js` et `shared/permissions.json` ne sont pas réécrits ; tout changement d'autorisation reste audité via `audit_events` ; le verrou AGENTS.md s'applique à chaque nouvel écran.

***

## 7. Annexes — rapports de diagnostic détaillés

* \[Diagnostic architecture]\(C:\Users\PC\Documents\SchoolSafe V2\diagnostic-frontend-architecture.md) — bootstrap, état, routing, PWA, i18n, dettes (preuves fichier:ligne)

* \[Diagnostic design system]\(C:\Users\PC\Documents\SchoolSafe V2\analysis\diagnostic-design-frontend.md) — tokens, cohérence CSS, accessibilité, poids des assets

* \[Diagnostic modules métier]\(C:\Users\PC\Documents\SchoolSafe V2\docs\diagnostic-modules-frontend.md) — inventaire des 17 modules, demo vs prod, XSS, duplication

* Diagnostic sécurité/perf/PWA — intégré dans les sections 3.1 et 3.3 ci-dessus

***

*Document de proposition — aucune ligne de l'application n'a été modifiée.*
