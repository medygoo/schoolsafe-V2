# Diagnostic READ-ONLY — Architecture frontend SchoolSafe V2

Perimetre : app/ (PWA vanilla JS). Aucune modification effectuee.

## 1. Demarrage, routing, ecrans

- Bootstrap : app/index.html charge en mode eager environ 40 scripts (lignes 63-112, tous defer sauf cards-module.js en type="module" ligne 71). Aucun lazy loading des modules metier : finance (2378 lignes), pedagogy, school, etc. sont tous telecharges et executes au premier chargement. Seul modules/jaspe3d/jaspe3d-loader.js:47 fait un import() dynamique de jaspe3d-runtime.js.
- Point d'entree : app/app.js est un IIFE unique de 3819 lignes (lignes 1-3819) ; le demarrage reel est restoreSession() a la ligne 3818.
- Routing : pas de router ni d'URL. 5 ecrans section.screen (splash, guardian, auth, setup, workspace) bascules par classe active via showScreen(name) (app.js:3011-3027), exposee globalement (window.schoolSafeShow, ligne 3027) et appelee en onclick inline (index.html:135).
- Navigation interne workspace : chaines de if par cle de branche — openModuleByBranch (app.js:2824-2845) et openActionByBranch (app.js:2847-2882). Les branches non implementees tombent sur notify("ouverture dans une prochaine etape") (lignes 2843-2844, 2881, 2388-2390).

## 2. Gestion de l'etat

- Pas de store. Etat = variables de closure de l'IIFE : currentSession, backendConfig, setupToken (app.js:35-39), currentDemoRole (app.js:747), pedagogyState (app.js:758), staffSamples (app.js:750), state du setup (app.js:3432).
- Reexposition globale systematique : Object.defineProperty(window, "currentDemoRole"/"currentSession") (app.js:748-749), window.schoolSafeDemoMode (lignes 602 et 2205), window.icons (3009), window.notify (3037), window.queueOfflineOperation (889), plus ~17 namespaces window.SchoolSafe* (Access, I18n, Sync, AppContext, FinanceModule, FinanceAPI, SchoolAPI, PilotageAPI, DocumentCenter, Cards, Jaspe3D, SafeAssistant...).
- Etat interne mutable expose entre modules : finance-module.js:2375 expose _state: financeState ; fee-control-module.js:293 expose _state() ; app.js:969-977 mute directement SchoolSafeFinanceModule._state (receiptSequence, statut de transaction) depuis le gestionnaire de sync — couplage fort, contournement de l'API du module.
- Persistance : localStorage (token schoolsafe-v2-session, langue, brouillon setup, theme ss-theme, last-sync) et IndexedDB (offline-sync.js, stores operations + audit).

## 3. Chargement des modules et communication

- Scripts classiques (IIFE + window.*) pour tout sauf cards-module.js (ESM). Ordre de chargement = ordre des balises script (index.html:71-112), sans garde de dependance (les modules testent window.SchoolSafeAccess && ... a l'usage).
- Communication : (a) globals window.SchoolSafe* lus a la demande ; (b) CustomEvents : schoolsafe:sync-state et schoolsafe:operation-synced (offline-sync.js:82,150), schoolsafe:language-change (i18n.js:551), safe:event (app.js:3045, consomme par safe-assistant.js:953), schoolsafe:pwa-ready (sw-register.js:12-16) ; (c) appels directs cross-module (SchoolSafeAppContext, app.js:419-462).
- Evenement orphelin : schoolsafe-toast est emis par pedagogy-module.js:39 et palmares-module.js:37 mais aucun listener n'existe dans le codebase — notifications perdues silencieusement.
- Cle dupliquee : SchoolSafeAppContext definit openDocuments deux fois (app.js:425 et app.js:456) ; la seconde ecrase la premiere.

## 4. Authentification et permissions (regle Role -> Permission -> Portee -> Exception)

- Login : Supabase signInWithPassword (email, ou telephone via /auth/lookup-phone), app.js:3272-3326. Config backend via GET /config sur apiBase code en dur : http://127.0.0.1:8787 (app.js:34, finance-api.js:7). Bootstrap /session/bootstrap (app.js:159-166) puis applyBootstrap (168-204) qui stocke permissions, scopes, deniedPermissions, permissionExceptions.
- Moteur d'autorisation central : modules/core/access.js (255 lignes) — canAccess, explicitDeny (DENY prioritaire, lignes 125-130 et 166-168), scopeFor/allowsScope (portees), exceptions ALLOW (132-136), commentaire explicite "aucun bypass admin" (162-165). Adoption reelle : ~15 modules appellent SchoolSafeAccess.canAccess/allowsScope/explicitDeny (finance, fee-control, hr, inventory, accounting, administration, communication, parent, teacher-pedagogy, guard-security, school/*, document-center, document-engine, safe-assistant).
- MAIS : en mode demo (sans token), renderWorkspace ignore filterBranches et affiche le roleCatalog statique (app.js:2297-2303). Les catalogues demo DEMO_PERMISSIONS_BY_ROLE et DEMO_ACCESS_CONTEXT_BY_ROLE sont codes en dur (app.js:227-374) — duplication complete du referentiel de permissions cense venir du backend.
- Incoherence de contexte : en session live, getCurrentUser() ecrase le role de session par currentDemoRole (app.js:377-382) — le selecteur de role de demonstration pilote le contexte passe a Access_Law.
- Catalogue de portees jamais charge : access.js:215 fetch ./shared/permissions.json, mais le dossier shared/ est a la racine du workspace, pas sous app/ — 404 silencieuse, permissionsCache = [] (224-227), getPermissionScope retourne toujours null.
- Masquage UI uniquement : cote frontend, la regle AGENTS.md est appliquee par affichage/masquage et gardes canAccess ; aucune verification Worker/API ou RLS n'est visible depuis ce perimetre (hors scope frontend, mais le frontend seul ne peut pas l'assurer).
- Console "Roles et acces" purement locale : savePermissions ne produit qu'une operation offline locale (app.js:3266-3270) sur des staffSamples fictifs (app.js:750-756) ; aucun evenement public.audit_events n'est emis (exigence AGENTS.md non couverte cote frontend).
- Token en clair : session (dont token) stockee en clair dans localStorage (app.js:142) alors que le client Supabase est configure persistSession: false (app.js:57) ; la case "Rester connecte sur cet appareil" (index.html:216) n'est lue nulle part dans le JS — controle mort et contradiction du modele de persistance.
- Fallback demo a l'echec de connexion : si le backend/config est indisponible, le submit du login appelle enterDemo() (app.js:3276-3287, 600-604) — ouverture du workspace en Administrateur principal sans authentification. Le selecteur demoRole (index.html:228-244) permet d'endosser 15 profils.

## 5. PWA / offline

- Service worker (sw.js, 98 lignes) : precache a l'install par parsing regex des src|href="./..." d'index.html (lignes 9-18), purge des anciens caches (35-54), networkFirst pour les navigations, cacheFirst pour le reste same-origin (78-83). Cache versionne schoolsafe-v2-frontend-m7 (ligne 2) — bump manuel requis.
- Trous offline : seules les ressources meme origine sont gerees (sw.js:81) ; les CDN qrcodejs et html2canvas (index.html:65-66) ne sont jamais caches — scan QR et capture de cartes casses hors ligne. Le .glb d'assets/jaspe3d n'est pas dans le precache (charge a la demande, non reference par un src|href).
- Double enregistrement du SW : sw-register.js:9-10 ET offline-sync.js:182-185 appellent tous deux navigator.serviceWorker.register("./sw.js").
- File offline (offline-sync.js, 210 lignes) : IndexedDB priorisee + audit local — propre. Mais processOperation exige un demoAdapter (ligne 140) ; app.js:995-1001 ne le fournit qu'en demo — en session live, toute operation reste pending indefiniment ("Le connecteur serveur n'est pas encore autorise ni configure.", ligne 140). Le statut demo-synced (ligne 143) confirme localement sans serveur.
- Panneau de synchronisation inaccessible : #syncStatusButton est reference dans app.js:893, 954, 961-962, 3227-3228 mais absent de index.html (0 occurrence) — renderSyncState sort immediatement (ligne 894), le panneau ne peut jamais s'ouvrir ; openSyncPanel() leverait une TypeError a la ligne 954 si declenche autrement.
- manifest.webmanifest minimaliste (une icone unique, purpose "any maskable" combine), start_url/scope corrects.
- server.mjs : serveur statique de dev, protection traversal correcte (ligne 24), nosniff present mais aucune CSP ni autre header de securite (32-36).

## 6. i18n

- i18n.js (599 lignes) : 2 langues (fr/en), dictionnaire FR->EN d'environ 465 paires par correspondance exacte de chaine (lignes 12-478), enToFr derive par inversion (480-483). MutationObserver retraduit le DOM ajoute dynamiquement (575-583) ; attributs aria-label/title/placeholder couverts (515-528) ; persistance localStorage (547-553).
- Fragilites : pas de cles stables — renommer un libelle francais casse sa traduction silencieusement (chaine non trouvee = francais conserve, translateText lignes 489-496, sans log) ; pas de pluriels ni d'interpolation ; les contenus generes en dur dans les modules (donnees demo) ne sont pas dans le dictionnaire. Un script qa-i18n.cjs existe.

## 7. Dettes techniques

- Monolithe : app.js 3819 lignes en un seul IIFE ; renderWorkspace ~200 lignes (2198-2593) melant rendu HTML, permissions, dropdowns, FAB, breadcrumb, theme ; roleCatalog statique ~230 lignes (630-859) ; finance-module.js 2378 lignes.
- innerHTML partout : 142 occurrences sur 27 fichiers. Les modules echappent via escapeHtml de ui-helpers.js:11-18 (994 occurrences d'echappement sur 24 fichiers) — correct. app.js a son propre escapeMarkup (860) ET un troisieme esc (3447) — triplication d'utilitaires.
- XSS residuel : app.js:2948 interpole person.scope non echappe dans policy.innerHTML, valeur alimentee par la saisie utilisateur (app.js:3262-3264) — injection HTML dans la console d'acces ; person.name non echappe a app.js:2927 ; label de role non echappe a app.js:2288 ; onclick inline index.html:135 (hostile a une future CSP).
- Accumulation d'ecouteurs : renderWorkspace (appele a chaque changement de role et chaque entree workspace) re-lie des ecouteurs sur des elements statiques sans garde : bottom nav (app.js:2462-2489), suggestions Jaspe (2434-2456) — handlers dupliques en cascade. D'autres elements sont proteges par des flags __ssBound (2552, 2567...) — pattern incoherent. workspaceBack est lie deux fois (3174 logout asynchrone + 2566-2572) — double execution.
- Fonctionnalites mortes : menu FAB (renderFabMenu 564-590, toggleFabMenu 592-598) jamais ouvrable — aucun data-bottom-nav="create" dans index.html (reference app.js:594, 2559) ; bloc "Anciens elements conserves pour compatibilite JS" (index.html:544-559) rendu mais cache ; cardsProtected.hidden re-assigne 9 fois dans app.js ; badges topbar en dur 3/2 (index.html:335, 338).
- Donnees fictives presentees comme reelles : "286 actuellement", "94 % aujourd'hui" (app.js:652, 679), KPI demo (2050-2079), eleves "Lucas Martin", "Mme Y" (750-855), date figee "14 aout 2026" (975), bulletin chiffre en dur (1147).
- Pollution du bundle de production : 15 fichiers *-demo.js charges par index.html (74-104) ; 15 scripts qa-*.cjs + qa-output/ a la racine d'app/ ; vendor/test-write.txt et vendor/write-test.txt (fichiers de test oublies) ; schoolsafe-hero-reference.png (1,7 Mo) non reference.
- Config en dur : apiBase = "http://127.0.0.1:8787" (app.js:34, finance-api.js:7) — HTTP, localhost, sans variable d'environnement.
- console.* : app.js:2587-2588, 3323, 3771, 3810 ; sw-register.js:5,20 ; access.js:225. Aucun console.log de debug oublie dans le code metier hors vendor.
- TODO/FIXME : aucun dans le code metier (uniquement dans vendor/three et vendor/supabase-sdk). Marqueurs recurrents BACKEND_LATER / DEMONSTRATION assumes dans l'UI (663 occurrences des termes demo/fictif sur 28 fichiers).

## 8. Points forts

- Moteur d'autorisation unique et discipline (core/access.js) : DENY explicite prioritaire, exceptions, portees, pas de bypass admin, adopte par ~15 modules — le verrou AGENTS.md est reellement cable cote frontend.
- Echappement quasi systematique dans les modules via ui-helpers.js (994 usages).
- SW correct : versionnement de cache, purge des anciens caches, strategies differenciees navigation/assets.
- File offline IndexedDB avec priorites metier et audit local (offline-sync.js).
- Lazy loading reel pour Jaspe 3D (import() dynamique, import map three).
- Harnais QA local consequent (15 scripts qa-*.cjs : smoke, PWA, i18n, finance...).
- Accessibilite presente : aria-*, roles, focus management dans les panneaux.
- i18n dynamique avec observer et persistance ; documents PDF FR/EN/bilingue geres.
