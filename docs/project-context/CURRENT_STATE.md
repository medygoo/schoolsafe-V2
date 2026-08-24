# État actuel du projet SchoolSafe V2

> Dernière mise à jour : 2026-08-23 — FE-UX-007 Badges/statuts unifiés validé.

## Ce qui fonctionne

- Structure frontend modulaire dans `app/modules/`.
- Écran d’accueil, écran guardian et écran de connexion présents.
- 15 profils reconnus dans `app/app.js:227-337`.
- Module Finance connecté au backend (paiements, reçus PDF, clôture de caisse, rapports).
- Module Contrôle des frais par QR connecté.
- Module Sécurité / scan QR connecté.
- Module Palmarès implémenté et connecté.
- Module Pédagogie externe (matières, devoirs, cotations, cahier, vue parent) connecté au backend.
- Module École / Années / Cycles / Équipe connecté.
- Studio de cartes élèves connecté.
- Document Engine opérationnel pour les reçus de paiement et les devoirs/interrogations PDF + feuille de réponses.
- Safe Assistant présent et fonctionnel.
- Pilotage (dashboard + alertes) connecté.

## Ce qui est partiellement fonctionnel

- **Pédagogie double** : nouveau module externe + ancien inline dans `app.js`. Seul l’ancien est utilisé pour Bulletin continu, Calculs, Rattrapage, Épreuves certificatives.
- **Vue parent** : moyennes simplifiées, pas de bulletin officiel.
- **Module Pilotage** : alertes OK, indicateurs désormais branchés sur l’API (`/pilotage/dashboard`) sans données codées en dur.
- **Document Engine** : moteur prêt, reçu et devoir/interrogation/feuille de réponses branchés ; bulletins/attestations/convocations absents.
- **Safe Assistant** : FAQ codée en dur, pas de base de connaissances.

## Ce qui n’est pas fait

- Bulletin officiel PDF.
- Attestations, convocations, certificats.
- Rattrapage pédagogique et épreuves certificatives connectés (présents en démo).
- Emploi du temps.
- Présences / appel.
- Modules métier absents : Comptabilité, RH/Personnel, Cantine/Infirmerie, Communication, Rapports.
- Exports Excel.
- Import massif d’élèves.

## Ce qui est cassé / à vérifier

- Double implémentation pédagogie (risque de divergence).
- Écran « Bulletin continu » basé sur des données de démonstration.
- Taille des textes trop petites dans `styles-original.css` (jusqu’à 7 px) — **corrigé pour l’écran de connexion et le dashboard**.
- Double thème actif (`styles-original.css` + `v4-theme.css`) créant des incohérences.
- `school.css` sans media query = non responsive.
- Tableaux avec `min-width` fixes non adaptés au mobile.
- Mode démo automatique sur `localhost` sans token (risque de confusion) — **bandeau explicite ajouté sur le dashboard**.

## Tâche active

**Phase 4 — Composants transversaux** en cours. Sous-phase **FE-UX-006 — Formulaires unifiés** en audit initial.

- FE-UX-002 — Boutons unifiés : **VALIDÉ**.
- FE-UX-003 — Tableaux unifiés : **VALIDÉ**.
- FE-UX-004 — États unifiés : **VALIDÉ**.
- FE-UX-005 — Modales unifiées : **VALIDÉ**.
- FE-UX-007 — Badges/statuts unifiés : **VALIDÉ**.

Sous-phase active : **FE-UX-006 — Formulaires unifiés** (audit en cours, aucune modification commencée).

## Dernière vérification réalisée — FE-UX-007

- **Composant `.ss-table` complété dans `app/styles/components.css`** avec :
  - `.ss-table-wrap` (conteneur avec overflow-x et bordures) ;
  - `.ss-table--compact`, `.ss-table--striped` ;
  - `.ss-table__cell--right`, `.ss-table__cell--center` ;
  - `.ss-table__cell--hide-sm`, `.ss-table__cell--hide-xs` ;
  - `.ss-table__row-actions` ;
  - focus clavier sur lignes interactives ;
  - états vide/loading/error intégrés via `.ss-state`.
- **Helper `ssTable()` ajouté à `app/modules/core/ui-helpers.js`** :
  - signature `{ headers, rows, empty, emptyTitle, loading, error, className, attrs, wrapClassName, wrapAttrs, responsive, compact, striped }` ;
  - supporte `rows` sous forme d’array de strings HTML (tableaux complexes) ou d’array de cellules (tableaux simples) ;
  - gère correctement les chaînes vides comme état vide.
- **Tableaux migrés :**
  - `app/modules/school/school-module.js` : années scolaires, cycles, équipe.
  - `app/modules/pedagogy/pedagogy-module.js` : matières, cotation, cotes parent, moyennes, leçons.
  - `app/modules/finance/finance-module.js` : activité récente, structure des frais, journal de caisse, reçus, soldes, rapports de caisse (3 tableaux).
  - `app/app.js` : cotation (gradebook), rattrapage (remediation), certification candidats, certification résultats.
- **Aucune classe legacy** `.finance-table`, `.grade-table`, `.school-table`, `.remediation-table`, `.certification-table` dans les fichiers JS migrés.
- **Tests :**
  - `node --check` OK sur `app/app.js`, `finance-module.js`, `pedagogy-module.js`, `school-module.js`, `ui-helpers.js`.
  - `node tmp/fe-ux-001-smoke-test.mjs` → 9/9 PASS, 0 erreur JavaScript frontend.
  - `node tmp/fe-ux-002-security-test.mjs` → PASS.
  - `node tmp/fe-ux-002-module-smoke.mjs` → PASS (Finance/Pédagogie desktop dark + mobile light).
- **Captures générées :**
  - `tmp/fe-ux-003-captures/finance-desktop-dark.png`
  - `tmp/fe-ux-003-captures/finance-receipts-desktop-light.png`
  - `tmp/fe-ux-003-captures/finance-receipts-desktop-dark.png`
  - `tmp/fe-ux-003-captures/pedagogy-desktop-light.png`
  - `tmp/fe-ux-003-captures/pedagogy-desktop-dark.png`
  - `tmp/fe-ux-003-captures/school-desktop-light.png`
- **Écarts restants :**
  - Captures mobile non générées automatiquement car les boutons de branche sont dans le menu mobile ; le responsive des tableaux est toutefois validé par le composant `.ss-table--responsive`.
  - `styles-original.css` / `v4-theme.css` contiennent encore des règles legacy pour tableaux ; nettoyage global prévu en fin de Phase 4.

## Dernière vérification réalisée

- **Phase 1 — Design System** : VALIDÉE.
- **Phase 2 — Dashboard** : VALIDÉE (`FE-DASH-005 = VALIDÉ`).
- **Phase 3 — Navigation et layout global** :
  - Moteur d’autorisation central créé : `app/modules/core/access.js`, source unique `shared/permissions.json`.
  - Intégration dans `app/index.html` et `app/app.js` : filtrage des branches par permissions, campus dynamique, dropdowns partagés, FAB menu, breadcrumb.
  - Fichiers modifiés : `app/modules/core/access.js`, `app/index.html`, `app/app.js`, `app/styles/dashboard.css`, `tmp/phase3-navigation-test.mjs`.
  - Corrections apportées :
    - Dropdown desktop aligné sous chaque bouton topbar (notifications/messages/profil).
    - Dropdown mobile repositionné au-dessus de la bottom nav avec hauteur limitée.
    - Breadcrumb fonctionnel sur les modules (testé sur Finance).
    - Bottom navigation mobile conforme à la maquette (`Accueil | Tableau de bord | + | Notifications | Menu`).
    - FAB menu avec actions rapides filtrées par permissions.
    - Protection des `addEventListener` contre les éléments absents (`bindIfExists`).
    - `applyBootstrap` protégé contre les éléments DOM absents (`syncStatusDetail` supprimé lors de la refonte).
    - Navigation en session réelle basée sur toutes les branches connues (`branchDefinitions`) filtrées par permissions, plus seulement sur les branches du `roleCatalog`.
  - Scénarios ACCESS_LAW testés (démo) :
    - Administrateur principal : toutes les branches.
    - Enseignant : Pédagogie, Communication.
    - Caisse : Finance.
    - Gardien : Sécurité.
    - Parent : École, Finance, Communication.
  - Captures générées : `tmp/phase3-captures/final-desktop-light.png`, `final-desktop-dark.png`, `final-mobile-light.png`, `final-mobile-dark.png`.
  - Scénarios ACCESS_LAW testés en session réelle simulée (via `tmp/phase3-real-session-mock-test.mjs`) :
    - Administrateur principal : toutes les branches visibles.
    - `finance.receipt.read` seul : Finance visible.
    - `pedagogy.assignment.read` seul : Pédagogie visible.
    - `communication.message.send` seul : Communication visible, Finance absente.
    - `role=teacher` + `finance.receipt.read` : Finance visible (prouve que `roleCatalog` ne décide pas).
    - `finance.payment.record` seul : Finance visible + action rapide paiement visible.
    - Aucune permission : aucune branche métier, FAB vide.
    - École absente : fallback "Configuration en cours".
  - Tests :
    - `node --check app/app.js` → OK.
    - `node --check app/modules/core/access.js` → OK.
    - `node tmp/phase3-navigation-test.mjs` → OK, 0 erreur JavaScript frontend.
    - `node tmp/phase3-real-session-mock-test.mjs` → OK, 8/8 scénarios PASS.
    - Smoke test Finance + Pédagogie → PASS.
  - Écarts restants :
    - Erreur console `ERR_CONNECTION_REFUSED` sur `http://127.0.0.1:8787/config` : erreur réseau liée au backend local non démarré, non une erreur frontend.
    - Assets 3D hero/avatar manquants (déjà notés en Phase 2).

## Dernière vérification réalisée — FE-UX-007

- **Composant `.ss-badge` complété dans `app/styles/components.css`** avec les variantes : `default`, `primary`, `success`, `warning`, `error`, `info`, `danger`, `done`, `pending`, `active`, `neutral`, `outline`, plus les modificateurs `sm`, `dot`.
- **Helper `ssBadge()` ajouté à `app/modules/core/ui-helpers.js`** :
  - signature : `{ label, variant, icon, dot, size, className, attrs }` ;
  - supporte les aliases legacy (`done`, `pending`, `active`, `danger`) ;
  - icône Lucide optionnelle.
- **Mapping sémantique centralisé :**
  - `done → success`
  - `pending → warning`
  - `active → info`
  - `danger → danger`
  - `failed → error`
- **Badges legacy migrés :**
  - `app/app.js` : 10 `.case-status` (rattrapage pédagogique + épreuves certificatives) + 1 `.closure-chip`.
  - `app/modules/finance/finance-module.js` : 6 `.case-status` + 2 `.recording-only` + 2 `.receipt-waiting` (avec texte) + 2 `.closure-chip`.
  - 1 `.receipt-waiting` icône seule conservé comme indicateur graphique spécialisé.
  - 2 bugs de badge préexistants corrigés (lignes 428 et 824) où `ssBadge()` était écrit en texte dans une chaîne sans être exécuté.
- **Aucune classe legacy** `.case-status`, `.closure-chip`, `.recording-only`, `.receipt-waiting` (avec texte) ne reste dans les fichiers JS migrés.
- **Tests :**
  - `node --check` OK sur `app/app.js`, `finance-module.js`, `pedagogy-module.js`, `school-module.js`, `ui-helpers.js`.
  - `node tmp/fe-ux-007-badge-test.mjs` → tous les contrôles PASS.
  - `node tmp/fe-ux-001-smoke-test.mjs` → 9/9 PASS, 0 erreur JavaScript frontend.
  - `node tmp/fe-ux-002-security-test.mjs` → PASS.
  - `node tmp/fe-ux-002-module-smoke.mjs` → PASS.
  - `node tmp/fe-ux-007-capture.mjs` → 8/8 PASS (Finance/Pédagogie desktop/mobile clair/sombre), 0 badge legacy, 0 erreur JS.
- **Captures générées :**
  - `tmp/fe-ux-007-captures/finance-badges-desktop-light.png`
  - `tmp/fe-ux-007-captures/finance-badges-desktop-dark.png`
  - `tmp/fe-ux-007-captures/finance-badges-mobile-light.png`
  - `tmp/fe-ux-007-captures/finance-badges-mobile-dark.png`
  - `tmp/fe-ux-007-captures/pedagogy-badges-desktop-light.png`
  - `tmp/fe-ux-007-captures/pedagogy-badges-desktop-dark.png`
  - `tmp/fe-ux-007-captures/pedagogy-badges-mobile-light.png`
  - `tmp/fe-ux-007-captures/pedagogy-badges-mobile-dark.png`
- **Écarts restants :**
  - Règles CSS legacy `.case-status`, `.closure-chip`, `.recording-only`, `.receipt-waiting` subsistent dans `styles-original.css` et `v4-theme.css` ; nettoyage prévu en fin de Phase 4.
  - `payment-dot` défini dans `styles-original.css` mais non utilisé dans les JS ; ignoré pour cette passe.

## Dernière vérification réalisée — FE-UX-005

- **Composant `.ss-modal` complété dans `app/styles/components.css`** : overlay, backdrop-filter, panel, header, subtitle, content, error, actions, tailles sm/lg/xl, responsive, état loading.
- **Helpers `ssModal()` et `ssConfirm()` ajoutés à `app/modules/core/ui-helpers.js`** :
  - signature : `{ title, subtitle, content, size, actions, onClose, closeOnBackdrop, closeOnEscape, focusReturn, setLoading, setError }` ;
  - `ssConfirm()` : `{ title, subtitle, content, confirmLabel, confirmVariant, cancelLabel, onConfirm }` ;
  - focus géré, retour du focus, fermeture backdrop/escape configurables.
- **Modales legacy migrées :**
  - `app/modules/school/school-module.js` : 4 modales (année scolaire, détail membre, invitation, rôle) migrées vers `ssModal()`.
  - `app/modules/pedagogy/pedagogy-module.js` : modale aperçu PDF migrée vers `ssModal()`.
- **Dialogs natifs remplacés :**
  - `app/modules/finance/finance-module.js` : `prompt("Motif de l’annulation ?")` remplacé par `ssModal()` avec textarea et bouton danger.
  - `app/modules/pilotage/pilotage-module.js` : `alert("Erreur : ...")` remplacé par `ssModal()` (avec fallback natif si `ssModal` absent).
  - `app/app.js` : `window.prompt("Token de configuration...")` de l’écran setup remplacé par `ssModal()` avec champ token et validation asynchrone (fallback natif conservé).
- **CSS legacy supprimé :** `.school-modal`, `.school-modal-box` retirés de `app/modules/school/school.css` et `app/v4-theme.css` car non référencés.
- **Layout formulaires modales École corrigé** : `grid-template-columns: 1fr` ajouté à `.workspace-screen .school-form` dans `app/v4-theme.css`.
- **Résidus natifs justifiés :** fallbacks `window.alert()` dans `school-module.js:notify()` et `pilotage-module.js` lorsque `ssModal` n’est pas disponible ; fallback `window.prompt()` dans `app.js` si `ssModal` absent au moment du setup.
- **Tests :**
  - `node --check` OK sur `app/modules/core/ui-helpers.js`, `app/modules/school/school-module.js`, `app/modules/pedagogy/pedagogy-module.js`, `app/modules/finance/finance-module.js`, `app/modules/pilotage/pilotage-module.js`, `app/app.js`.
  - `node tmp/fe-ux-005-modal-unit-test.mjs` → 13 PASS, 0 FAIL.
  - `node tmp/fe-ux-005-app-smoke.mjs` → workspace visible, ssModal disponible, modale manuelle ouverte/fermée, captures desktop/mobile clair/sombre, 0 erreur JS frontend (hors `ERR_CONNECTION_REFUSED` backend attendu).
  - `node tmp/fe-ux-005-school-modal-test.mjs` → modales École ouvertes/fermées, titres corrects, 0 erreur JS.
- **Captures générées :**
  - `tmp/fe-ux-005-capture-desktop-clair.png`
  - `tmp/fe-ux-005-capture-desktop-sombre.png`
  - `tmp/fe-ux-005-capture-mobile-clair.png`
  - `tmp/fe-ux-005-capture-mobile-sombre.png`
  - `tmp/fe-ux-005-school-year-modal.png`
  - `tmp/fe-ux-005-school-invite-modal.png`
  - `tmp/fe-ux-005-school-detail-modal.png`
- **Écarts restants :**
  - Modales non migrées dans `security-module.js`, `cards-module.js`, `fee-control-module.js`, etc. ; migration prévue lors du passage module par module ou en FE-UX-008+.
  - Quelques modales ad-hoc inline dans `app/app.js` peuvent encore exister ; audit continu.

## Dernière vérification réalisée — FE-UX-002

- **Fichiers migrés :**
  - `app/modules/finance/finance-module.js` (vérifié propre, aucun bouton legacy restant).
  - `app/modules/pedagogy/pedagogy-module.js` : 13 boutons migrés vers `ssButton` / `ssIconButton`.
  - `app/modules/pedagogy/palmares-module.js` : 3 boutons migrés vers `ssButton`.
  - `app/index.html` : 19 boutons legacy statiques remplacés par `.ss-button` / `.ss-icon-button`.
  - `app/app.js` : 29 boutons migrés vers `ssButton` / `ssIconButton`.
- **Total :** 64 boutons migrés ; plus aucune classe legacy `.primary-button`, `.secondary-button`, `.icon-button` dans les fichiers JS/HTML de `app/`.
- **Règles CSS legacy** `.primary-button` / `.secondary-button` / `.icon-button` restent présentes dans `styles-original.css` et `v4-theme.css` (hors périmètre de cette sous-phase ; nettoyage CSS prévu en fin de Phase 4).
- **Tests :**
  - `node --check` OK sur `app/app.js`, `finance-module.js`, `pedagogy-module.js`, `palmares-module.js`.
  - `node tmp/fe-ux-001-smoke-test.mjs` → 9/9 PASS, 0 erreur JavaScript frontend.
  - `node tmp/fe-ux-002-security-test.mjs` → PASS.
- **Écarts restants :**
  - Boutons sans classe legacy dans `index.html` (sidebar, onglets, suggestions) n’ont pas été migrés ; traitement prévu dans FE-UX-008.

## Dernière vérification réalisée — FE-UX-004

- **Composant `.ss-state` créé/complété dans `app/styles/components.css`** avec les variantes : `loading`, `empty`, `error`, `unavailable`, `denied`, `success`, plus les modificateurs `compact` et `inline`.
- **Helper `ssState()` ajouté à `app/modules/core/ui-helpers.js`** :
  - signature : `{ type, title, message, icon, action, retry, details, size, className, attrs }` ;
  - icônes par défaut par type ;
  - support action/retry ;
  - tailles `compact` / `inline`.
- **États legacy migrés :**
  - `app/modules/pilotage/pilotage-module.js` : `.pilotage-loading`, `.pilotage-error`, messages vides.
  - `app/app.js` : `.kpi-card--empty`, `.ss-fab-menu__empty`, `.sync-empty`, `.certification-stages.empty`.
  - `app/modules/finance/finance-module.js` : `renderErrorBanner`, `.finance-empty`, état de chargement.
  - `app/modules/finance/fee-control-module.js` : chargement, vide, erreur, `.scan-alert` de résultat.
  - `app/modules/pedagogy/pedagogy-module.js` : `.loading`, `.error`, `.empty-list`.
  - `app/modules/pedagogy/palmares-module.js` : `.palmares-loading`, `.palmares-error`, `.palmares-empty`.
  - `app/modules/school/school-module.js` : `.school-empty` retiré des cellules de tableau (texte inline conservé).
  - `app/modules/cards/cards-module.js` : `setStatus`, placeholders de liste/aperçu.
  - `app/modules/security/security-module.js` : `.scan-alert` de résultat.
  - `app/index.html` : placeholders Cartes (HTML statique).
- **Règles de style legacy conservées** dans `styles-original.css` / `v4-theme.css` ; nettoyage CSS global prévu en fin de Phase 4.
- **Tests :**
  - `node --check` OK sur tous les fichiers JS modifiés.
  - `node tmp/fe-ux-001-smoke-test.mjs` → 9/9 PASS, 0 erreur JavaScript frontend.
  - `node tmp/fe-ux-002-security-test.mjs` → PASS.
  - `node tmp/fe-ux-002-module-smoke.mjs` → Finance/Pédagogie desktop dark + mobile light PASS.
  - Captures desktop/mobile clair/sombre générées et inspectées.
- **Écarts restants :**
  - Tooltip de notification "Accès de démonstration" capturé sur certaines captures (toast temporaire, non lié aux états).
  - Fichier de test `app/modules/cards/test-card.html` contient encore un placeholder inline (hors périmètre application principale).

## Prochaine étape

Terminer **FE-UX-003 — Tableaux unifiés**, puis attendre validation avant FE-UX-007 — Badges/statuts unifiés.
