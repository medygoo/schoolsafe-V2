# Frontend Master Plan — SchoolSafe V2

> Statuts autorisés : `À ANALYSER` | `À FAIRE` | `EN COURS` | `À TESTER` | `VALIDÉ` | `BLOQUÉ`

## Gestion globale du frontend

| ID | Nom | Objectif | Écrans / Composants | État | Problèmes connus | Améliorations prévues | Critères de validation |
|----|-----|----------|---------------------|------|------------------|----------------------|------------------------|
| FE-GLOBAL-001 | Structure modulaire | Organiser le frontend en modules réutilisables | `app/modules/*` | `VALIDÉ` | — | — | Chaque module a son API, son module et son CSS si besoin. |
| FE-GLOBAL-002 | Thème visuel Aura Blue / Design System | Appliquer l’identité visuelle cohérente | `app/styles/design-tokens.css`, `app/styles/components.css`, `app/styles/dashboard.css` | `VALIDÉ` | `styles-original.css` et `v4-theme.css` coexistent encore ; le dashboard utilise désormais les tokens `--ss-*` | Migrer progressivement les autres modules au Design System lors des phases suivantes | Tokens `--ss-*` stables, thème clair/sombre fonctionnel, aucun écran dégradé. |
| FE-GLOBAL-003 | Responsive | Fonctionner sur desktop, tablette, mobile | Dashboard : `app/styles/dashboard.css` ; autres écrans : à faire | `EN COURS` | Dashboard responsive validé sur 390/768/1366/1440/1920 px ; `school.css` et tableaux fixes restent à corriger | Appliquer le responsive Design System aux autres modules par fonctionnalité | Tests sur 320 px, 768 px, 1440 px pour chaque module. |
| FE-GLOBAL-004 | Tailles de texte | Garantir une lisibilité professionnelle | Dashboard : corrigé ; autres écrans : à faire | `EN COURS` | Dashboard : textes ≥ 14 px fonctionnels, corps ≥ 16 px ; `styles-original.css` reste utilisé ailleurs | Migrer chaque module au Design System `--ss-*` | Audit typographique passé par module. |
| FE-GLOBAL-005 | États vide / chargement / erreur | Ne jamais laisser l’utilisateur sans retour | Dashboard : `renderProfileOverview` ; autres écrans : à faire | `EN COURS` | Dashboard : états loading/real/empty/unavailable/error implémentés ; autres modules à auditer | Composant d’état réutilisable `.ss-state-*` | Chaque écran a ses états explicites. |
| FE-GLOBAL-006 | Données fictives | Séparer données réelles et démonstration | Tous les écrans | `À FAIRE` | Soldes, cotes, bulletins, palmarès en démo affichés comme réels | Bandeau démo + états indisponibles | Aucune donnée de démo affichée comme réelle. |
| FE-GLOBAL-007 | Mode démo | Gérer explicitement la démonstration | `app.js`, modules | `À FAIRE` | Bascule auto sur `localhost` sans token | Flag explicite `?demo=1` ou env var | Le mode démo est visible et contrôlé. |
| FE-GLOBAL-008 | Navigation cohérente | Uniformiser menus, onglets, sidebars | `app.js`, `index.html`, `app/modules/core/access.js` | `VALIDÉ` | Drawer mobile + cartes denses corrigés en Phase 3 | Appliquer la navigation commune à tous les futurs modules | Zone cliquable ≥ 44 px, navigation fluide sur tous les écrans. |
| FE-GLOBAL-009 | Accessibilité | Respecter WCAG 2.1 AA | Tous les écrans | `À FAIRE` | Contrastes < 4.5:1, textes trop petits | Audit contraste + focus | Pas d’échec WCAG critique. |
| FE-GLOBAL-010 | Nettoyage console | Retirer les logs de debug | Modules JS | `À FAIRE` | `console.warn/error` dans Finance, Cartes, SW | Supprimer ou garder en mode debug uniquement | Console propre en production. |

## Module Authentification / Profils

| ID | Nom | Objectif | Écrans / Composants | État | Problèmes connus | Améliorations prévues | Critères de validation |
|----|-----|----------|---------------------|------|------------------|----------------------|------------------------|
| FE-AUTH-001 | Écran d’accueil | Présenter SchoolSafe | `#splash`, `#guardian` | `VALIDÉ` | — | — | Affichage stable, CTA visible. |
| FE-AUTH-002 | Connexion | Authentifier l’utilisateur | `#auth` | `VALIDÉ` | Superposition Safe Assistant / formulaire corrigée | Body classes `screen-*`, padding mobile augmenté | Bouton « Se connecter » visible et cliquable sur desktop/mobile. |
| FE-AUTH-003 | Sélecteur de profil | Permettre le changement de profil | `schoolSafeShow('...')`, 15 rôles | `VALIDÉ` | — | — | Tous les profils accessibles. |
| FE-AUTH-004 | Setup école | Configurer l’école au premier lancement | `#setup` | `À ANALYSER` | — | — | Wizard fonctionnel, validation des champs. |

## Module Dashboard / Pilotage

| ID | Nom | Objectif | Écrans / Composants | État | Problèmes connus | Améliorations prévues | Critères de validation |
|----|-----|----------|---------------------|------|------------------|----------------------|------------------------|
| FE-DASH-001 | Indicateurs de rôle | Afficher les KPI du profil connecté | `renderProfileOverview`, `pilotage-module.js` | `VALIDÉ` | — | — | Indicateurs lisibles, source claire, aucun chiffre fictif. |
| FE-DASH-002 | Alertes | Afficher/ack/résoudre les alertes | `pilotage-module.js` | `VALIDÉ` | — | — | Alertes fonctionnelles. |
| FE-DASH-003 | Branches métier | Accéder aux modules autorisés | `workspaceBranches`, `workspaceNav` | `VALIDÉ` | Branches définies par `roleCatalog` ; filtre administration par permissions | Vérification complète par permissions en phase backend | Branches cliquables, permissions visibles, adaptées au profil. |
| FE-DASH-004 | Informations communes | Afficher actualités/annonces | `universalInformation` | `VALIDÉ` | Contenu générique sans données chiffrées | Connecter source réelle en phase backend | Contenu lisible, sans prétention d’actualité. |
| FE-DASH-005 | Refonte Dashboard Phase 2 | Appliquer le Design System au dashboard existant | `app/styles/dashboard.css`, `app/index.html`, `app/app.js` | `VALIDÉ` | Écarts d’assets : illustration hero 3D et avatar Jaspe 3D non disponibles ; 9 modules affichés au lieu de 8 dans la maquette (catalogue réel) | Migrer progressivement les autres modules au Design System | Captures desktop/mobile clair/sombre conformes aux maquettes ; Safe Assistant ne chevauche pas ; bottom nav fonctionnelle ; KPI vides structurels ; hero et grille modules ajustés ; aucune donnée fictive présentée comme réelle ; console propre. |

## Navigation et layout global

| ID | Nom | Objectif | Écrans / Composants | État | Problèmes connus | Améliorations prévues | Critères de validation |
|----|-----|----------|---------------------|------|------------------|----------------------|------------------------|
| FE-NAV-001 | Moteur d’autorisation central | Interroger `shared/permissions.json` depuis tous les modules | `app/modules/core/access.js` | `VALIDÉ` | — | Étendre aux conditions et exceptions complexes | `canAccess`, `canAccessAny`, `isBranchVisible` fonctionnels. |
| FE-NAV-002 | Sidebar desktop | Navigation latérale filtrée par permissions | `app/index.html`, `app/styles/dashboard.css` | `VALIDÉ` | Anciennement limitée aux branches du `roleCatalog` en session réelle — corrigé | Repli possible sur très petit écran | Toutes les branches autorisées visibles, indépendamment du rôle nominal. |
| FE-NAV-003 | Topbar | Recherche, notifications, messages, campus, profil | `app/index.html`, `app/app.js`, `app/styles/dashboard.css` | `VALIDÉ` | Données notifications/messages vides en démo | Connecter backend en phase 2 | Composants visibles, dropdowns alignés. |
| FE-NAV-004 | Bottom navigation mobile | Navigation principale mobile conforme à la maquette | `app/index.html`, `app/styles/dashboard.css` | `VALIDÉ` | — | — | `Accueil | Tableau de bord | + | Notifications | Menu`. |
| FE-NAV-005 | FAB menu | Actions rapides filtrées par permissions | `app/app.js`, `app/styles/dashboard.css` | `VALIDÉ` | — | — | S’ouvre/ferme, actions cliquables. |
| FE-NAV-006 | Breadcrumb | Fil d’Ariane dans les modules | `app/index.html`, `app/app.js`, `app/styles/dashboard.css` | `VALIDÉ` | — | — | Affiché dans les modules, retour dashboard. |

## Phase 4 — Composants transversaux

Objectif : uniformiser les composants communs (boutons, champs, selects, formulaires, cartes, panneaux, listes, tableaux, badges, modales, états, pagination, etc.) avec le Design System `--ss-*`, sans refaire les fonctionnalités métier.

| ID | Nom | Objectif | Fichiers cibles | État | Problèmes connus | Améliorations prévues | Critères de validation |
|----|-----|----------|-----------------|------|------------------|----------------------|------------------------|
| FE-UX-001 | Couper les conflits CSS legacy | Retirer/isoler `v4-theme.css` et `styles-original.css` de la chaîne de chargement | `app/styles.css`, `app/index.html` | `VALIDÉ` | `v4-theme.css` est un second DS complet `--ab-*` qui court-circuite `--ss-*` | `v4-theme.css` retiré du chargement par défaut ; filet temporaire `?legacy=1` pour comparaison ; `styles-original.css` conservé pour splash/auth/setup | Aucun conflit visuel sur les écrans migrés. |
| FE-UX-002 | Boutons unifiés | Remplacer `.primary-button`, `.secondary-button`, `.icon-button` par `.ss-button` / `.ss-icon-button` | `app/app.js`, `app/modules/finance/finance-module.js`, `app/modules/pedagogy/pedagogy-module.js`, `app/modules/pedagogy/palmares-module.js`, `app/index.html` | `VALIDÉ` | Règles CSS legacy `.primary-button` / `.secondary-button` / `.icon-button` restent dans `styles-original.css` et `v4-theme.css` ; nettoyage prévu en fin de Phase 4 | Composant `.ss-button` avec variantes déjà prêt | Aucune classe legacy dans les JS/HTML de `app/` ; tous les boutons passent par `ssButton()` / `ssIconButton()` ou portent directement `.ss-button*` ; 0 erreur JS. |
| FE-UX-003 | Tableaux unifiés | Remplacer `.finance-table`, `.grade-table`, `.school-table`, etc. par `.ss-table` | `app/styles/components.css`, `app/modules/core/ui-helpers.js`, `app/modules/finance/finance-module.js`, `app/modules/pedagogy/pedagogy-module.js`, `app/modules/school/school-module.js`, `app/app.js` | `VALIDÉ` | Règles CSS legacy de tableaux subsistent dans `styles-original.css` / `v4-theme.css` ; nettoyage prévu en fin de Phase 4 | Composant `.ss-table` du DS + wrapper `.ss-table-wrap` + helper `ssTable()` | Tous les tableaux des modules métier utilisent `.ss-table` ; responsive clair/sombre ; 0 erreur JS. |
| FE-UX-004 | États unifiés | Remplacer `.pilotage-loading`, `.finance-empty`, `.school-empty` par `.ss-state` | `app/modules/core/ui-helpers.js`, `app/styles/components.css`, modules métier | `VALIDÉ` | Règles CSS legacy d’états subsistent dans `styles-original.css` / `v4-theme.css` ; nettoyage prévu en fin de Phase 4 | Helper `ssState()` + composant `.ss-state` avec variants `loading`, `empty`, `error`, `unavailable`, `denied`, `success` | Tous les états vide/chargement/erreur/indisponible/refus/success utilisent `.ss-state` ; 0 erreur JS. |
| FE-UX-005 | Modales unifiées | Remplacer `.school-modal`, overlays maison et dialogs natifs par `.ss-modal` | `app/modules/core/ui-helpers.js`, `app/styles/components.css`, `school-module.js`, `pedagogy-module.js`, `finance-module.js`, `pilotage-module.js`, `app.js` | `VALIDÉ` | Quelques modales ad-hoc dans `security-module.js`, `cards-module.js`, etc. restent à migrer module par module | `.ss-modal-overlay` + `.ss-modal` du DS + helpers `ssModal()` / `ssConfirm()` | Modales cohérentes, focus géré, dialogs natifs remplacés, 0 erreur JS. |
| FE-UX-006 | Formulaires unifiés | Remplacer `.school-form`, `.finance-fee-form`, etc. par `.ss-input`, `.ss-select`, `.ss-field`, `.ss-form-grid` | Modules métier | `EN COURS — AUDIT` | Styles de formulaire propres à chaque module | Grille `.ss-form-grid` et champs DS | Formulaires lisibles, accessibles, cohérents ; logique métier conservée. |
| FE-UX-007 | Badges unifiés | Remplacer `.case-status`, `.pedagogy-badge`, `.payment-state` par `.ss-badge` | `app/styles/components.css`, `app/modules/core/ui-helpers.js`, `app/app.js`, `app/modules/finance/finance-module.js`, `app/modules/pedagogy/pedagogy-module.js`, `app/modules/school/school-module.js` | `VALIDÉ` | Règles CSS legacy subsistent dans `styles-original.css` / `v4-theme.css` ; nettoyage prévu en fin de Phase 4 | `.ss-badge` avec variantes sémantiques + aliases legacy | Tous les statuts utilisent `.ss-badge` ; mapping `done→success`, `pending→warning`, `active→info` ; 0 erreur JS. |
| FE-UX-008 | Tabs / Onglets | Créer `.ss-tabs` pour remplacer `.school-tabs`, `.pedagogy-tabs`, etc. | `components.css`, modules | `À FAIRE` | Onglets réinventés par module | Composant `.ss-tabs` réutilisable | Onglets cohérents sur tous les écrans. |
| FE-UX-009 | Toast / notifications | Créer `.ss-toast` et un gestionnaire centralisé | `app/app.js` | `À FAIRE` | `notify()` ad-hoc, pas de file d’attente | Composant toast avec file et durée | Notifications cohérentes, non bloquantes. |
| FE-UX-010 | Pagination | Créer `.ss-pagination` pour les listes longues | `components.css`, modules | `À FAIRE` | Aucune pagination existante | Composant pagination réutilisable | Listes longues paginées ou scroll infinie documenté. |
| FE-UX-011 | Toolbar / filter bar | Créer `.ss-toolbar` pour actions et filtres de liste | Modules métier | `À FAIRE` | Chaque module réinvente sa barre d’actions | Composant toolbar réutilisable | Barres d’actions cohérentes. |
| FE-UX-012 | Skeleton | Créer `.ss-skeleton` pour les états de chargement structurés | `components.css`, modules | `À FAIRE` | Seul `.kpi-card--empty` existe | Composant skeleton pour cartes/listes | Chargement professionnel sans flash. |
| FE-UX-013 | Avatar | Créer `.ss-avatar` | `components.css`, modules | `À FAIRE` | `.student-avatar` legacy | Composant avatar avec fallback | Avatars cohérents. |
| FE-UX-014 | File upload | Créer `.ss-file-upload` / dropzone | Modules métier | `À FAIRE` | Inputs file basiques | Composant upload avec aperçu | Uploads cohérents. |
| FE-UX-015 | Toggle / Checkbox / Radio | Créer `.ss-toggle`, `.ss-checkbox`, `.ss-radio` | `components.css`, modules | `À FAIRE` | Switches locaux | Composants formulaire cohérents | Contrôles cohérents clair/sombre. |
| FE-UX-016 | Breadcrumb DS | Déplacer le breadcrumb dans `components.css` | `app/styles/components.css` | `À FAIRE` | Breadcrumb seulement dans `dashboard.css` | Composant `.ss-breadcrumb` réutilisable | Breadcrumb disponible pour tous les modules. |

## Module Finance

| ID | Nom | Objectif | Écrans / Composants | État | Problèmes connus | Améliorations prévues | Critères de validation |
|----|-----|----------|---------------------|------|------------------|----------------------|------------------------|
| FE-FIN-001 | Vue financière KPI | Encaissements, soldes, journée | `finance-module.js:286-349` | `À TESTER` | `loaded=true` même en erreur ; données démo injectées | État d’erreur/indisponible clair | KPI réels ou message explicite. |
| FE-FIN-002 | Structure des frais | CRUD structure des frais | `finance-module.js:409-419` | `À TESTER` | CRUD basique | Édition inline améliorée | Structure lisible et modifiable. |
| FE-FIN-003 | Encaissements | Saisie paiement | `finance-module.js:420-438` | `VALIDÉ` | — | — | Paiements créés/listés sans régression. |
| FE-FIN-004 | Reçus PDF | Générer les reçus | `document-engine/templates/receipt-template.js` | `VALIDÉ` | — | — | PDF conforme, numérotation correcte. |
| FE-FIN-005 | Soldes / impayés | Vue situation familiale | `finance-module.js:453-464` | `À TESTER` | Mode démo injecte soldes | État indisponible | Soldes réels ou message explicite. |
| FE-FIN-006 | Rapports de caisse + clôture | Clôturer la caisse journalière | `finance-module.js:467-485`, `:827-904` | `VALIDÉ` | — | — | Clôture fonctionnelle. |
| FE-FIN-007 | Vue famille parent | Voir la situation de ses enfants | `finance-module.js:488-503` | `À FAIRE` | Données hardcodées “Mme Sophie Martin” | Connecter API parent | Situation réelle ou message explicite. |
| FE-FIN-008 | Export Excel | Exporter données financières | — | `ABSENT` | Mentionné dans le catalogue | Spécifier besoin | — |
| FE-FIN-009 | Dépenses / recettes | Saisir dépenses et recettes | — | `ABSENT` | Données démo injectées | Spécifier besoin | — |

## Module Contrôle des frais

| ID | Nom | Objectif | Écrans / Composants | État | Problèmes connus | Améliorations prévues | Critères de validation |
|----|-----|----------|---------------------|------|------------------|----------------------|------------------------|
| FE-FEE-001 | Campagnes publiées | Lister les campagnes | `fee-control-module.js:62-94` | `VALIDÉ` | — | — | Liste fonctionnelle. |
| FE-FEE-002 | Scan QR élève | Vérifier le paiement via QR | `fee-control-module.js:96-152` | `VALIDÉ` | — | — | Scan + résultat ok/partial/unpaid. |
| FE-FEE-003 | Création de campagne | Créer une campagne de contrôle | — | `ABSENT` | API existe mais pas d’UI | Ajouter écran de création | CRUD campagne fonctionnel. |

## Module Palmarès

| ID | Nom | Objectif | Écrans / Composants | État | Problèmes connus | Améliorations prévues | Critères de validation |
|----|-----|----------|---------------------|------|------------------|----------------------|------------------------|
| FE-PALM-001 | Top 10 classe / école | Afficher le classement mensuel | `palmares-module.js` | `VALIDÉ` | — | — | Top 10 visible, podium valorisé. |
| FE-PALM-002 | Étoiles parent | Encourager un élève | `palmares-module.js` | `VALIDÉ` | — | — | Une étoile par parent/élève/mois. |
| FE-PALM-003 | Historique mensuel | Consulter les palmarès passés | `palmares-module.js` | `À TESTER` | — | — | Navigation entre mois fonctionnelle. |
| FE-PALM-004 | Photos élèves | Afficher la photo officielle | `palmares-module.js` | `À TESTER` | Fallback sur logo si pas de photo | Gérer fallback propre | Photo ou avatar visible. |

## Module Pédagogie — version externe

| ID | Nom | Objectif | Écrans / Composants | État | Problèmes connus | Améliorations prévues | Critères de validation |
|----|-----|----------|---------------------|------|------------------|----------------------|------------------------|
| FE-PED-001 | Matières | CRUD matières | `pedagogy-module.js:305-318` | `VALIDÉ` | — | — | CRUD fonctionnel. |
| FE-PED-002 | Devoirs | Créer/publier des devoirs | `pedagogy-module.js:321-358` | `VALIDÉ` | — | — | Publication et cotations liées. |
| FE-PED-002B | Devoir PDF | Générer le sujet PDF avec identité école/SchoolSafe | `document-engine/templates/assignment-template.js`, `pedagogy-module.js:428-431` | `VALIDÉ` | Watermark corrigé | — | Aperçu, téléchargement, impression fonctionnels ; pagination automatique. |
| FE-PED-002C | Feuille de réponses PDF | Générer la feuille de réponses vierge | `document-engine/templates/answer-sheet-template.js`, `pedagogy-module.js:431` | `VALIDÉ` | — | — | Champs élève, lignes de réponse, identité école/SchoolSafe. |
| FE-PED-002D | Import devoir PDF/photo | Conserver l’original uploadé avec aperçu | `pedagogy-module.js:456, 898-910` | `VALIDÉ` | En mode réel l’upload ne part pas au backend | Implémenter upload backend (BE-DOC-009) | Aperçu du fichier original en mode démo. |
| FE-PED-003 | Cotations | Saisir et publier les notes | `pedagogy-module.js:361-391` | `VALIDÉ` | — | — | Notes publiées avec audit. |
| FE-PED-004 | Cahier de préparation | Planifier les leçons | `pedagogy-module.js:427-443` | `VALIDÉ` | — | — | CRUD fonctionnel. |
| FE-PED-005 | Vue parent | Voir les résultats de ses enfants | `pedagogy-module.js:393-425` | `À TESTER` | Affichage simplifié, pas de bulletin | Améliorer lisibilité | Parent voit ses enfants et leurs notes. |
| FE-PED-006 | Affectations enseignants | Gérer qui enseigne quoi | — | `ABSENT` | API chargée mais pas d’UI | Ajouter écran | Affectations CRUD. |

## Module Pédagogie — version inline (app.js)

| ID | Nom | Objectif | Écrans / Composants | État | Problèmes connus | Améliorations prévues | Critères de validation |
|----|-----|----------|---------------------|------|------------------|----------------------|------------------------|
| FE-PED-100 | Devois legacy | Composer/publier devoirs | `app.js:699-716` | `À FAIRE` | Données fictives, non connectées | Migrer vers module externe ou supprimer | Fonctionnel ou supprimé. |
| FE-PED-101 | Cotations legacy | Saisir/publier notes | `app.js:716-726` | `À FAIRE` | Données fictives, queue offline locale | Migrer vers module externe | Fonctionnel ou supprimé. |
| FE-PED-102 | Calculs et coefficients | Configurer règles de moyennes | `app.js:733-736` | `À FAIRE` | Local uniquement | Connecter config école | Règles persistées. |
| FE-PED-103 | Bulletin continu | Afficher bulletin officiel | `app.js:737-748` | `À FAIRE` | Données de démonstration, pas de PDF | Remplacer par vrai bulletin via Document Engine | Bulletin réel, générable en PDF. |
| FE-PED-104 | Vue parent legacy | Voir résultats enfants | `app.js:751-776` | `À FAIRE` | Données fictives | Migrer vers module externe | Réel ou supprimé. |
| FE-PED-105 | Rattrapage pédagogique | Suivi remédiations | `app.js:782-838` | `À FAIRE` | Données de démo | Spécifier puis connecter | Flux fonctionnel. |
| FE-PED-106 | Épreuves certificatives | Gérer ENAFEP/TENASOSP/EXETAT | `app.js:875-936` | `À FAIRE` | Données fictives | Hors périmètre v2 sauf décision | — |

## Module Sécurité / QR

| ID | Nom | Objectif | Écrans / Composants | État | Problèmes connus | Améliorations prévues | Critères de validation |
|----|-----|----------|---------------------|------|------------------|----------------------|------------------------|
| FE-SEC-001 | Scan QR manuel | Saisir un code QR | `security-module.js` | `VALIDÉ` | — | — | Scan fonctionnel. |
| FE-SEC-002 | Scan caméra | Scanner via caméra | `security-module.js` | `À TESTER` | `BarcodeDetector` peu supporté | Fallback ZXing ou manuel | Scan caméra fonctionnel. |
| FE-SEC-003 | Entrée / sortie / incident | Enregistrer un passage | `security-module.js` | `VALIDÉ` | — | — | États clairs. |
| FE-SEC-004 | Affichage élève + autorisés | Voir infos et alertes | `security-module.js` | `VALIDÉ` | — | — | Affichage complet. |
| FE-SEC-005 | Historique des passages | Voir les scans récents | — | `ABSENT` | API existe, pas d’UI | Ajouter écran historique | Historique fonctionnel. |
| FE-SEC-006 | Lockdown | Verrouiller l’accès | — | `ABSENT` | API existe, pas de bouton | Ajouter bouton + confirmation | Lockdown fonctionnel. |

## Module École / Admin

| ID | Nom | Objectif | Écrans / Composants | État | Problèmes connus | Améliorations prévues | Critères de validation |
|----|-----|----------|---------------------|------|------------------|----------------------|------------------------|
| FE-SCH-001 | Identité de l’école | Gérer l’identité | `school-module.js` | `VALIDÉ` | — | — | Champs institutionnels éditables. |
| FE-SCH-002 | Années scolaires | CRUD années + activation | `school-module.js` | `VALIDÉ` | — | — | CRUD fonctionnel. |
| FE-SCH-003 | Cycles | Activer/désactiver cycles | `school-module.js` | `VALIDÉ` | — | — | Gestion fonctionnelle. |
| FE-SCH-004 | Équipe | Liste, invitation, rôles | `school-module.js` | `VALIDÉ` | — | — | Gestion fonctionnelle. |
| FE-SCH-005 | Classes / élèves | Voir élèves par classe | — | `ABSENT` | API existe, pas d’écran | Ajouter écran | Liste fonctionnelle. |
| FE-SCH-006 | Parents / tuteurs | Gérer les responsables | — | `ABSENT` | Mentionné, non implémenté | Spécifier besoin | — |
| FE-SCH-007 | Console rôles et accès | Gérer permissions | `app.js` | `À TESTER` | `staffSamples` fictifs | Connecter vrais staff/permissions | Permissions visibles, non sécurité frontend. |

## Module Cartes

| ID | Nom | Objectif | Écrans / Composants | État | Problèmes connus | Améliorations prévues | Critères de validation |
|----|-----|----------|---------------------|------|------------------|----------------------|------------------------|
| FE-CARD-001 | Sélection classe + élèves | Choisir les cartes à générer | `cards-module.js` | `VALIDÉ` | — | — | Sélection fonctionnelle. |
| FE-CARD-002 | Aperçu recto/verso | Prévisualiser la carte | `cards-module.js` | `VALIDÉ` | — | — | Aperçu fidèle. |
| FE-CARD-003 | Impression batch | Demander l’impression | `cards-module.js` | `VALIDÉ` | — | — | Requête d’impression envoyée. |
| FE-CARD-004 | Styles patrimoine | Choisir fond/style | `cards-module.js` | `VALIDÉ` | — | — | Styles appliqués. |

## Module Documents

| ID | Nom | Objectif | Écrans / Composants | État | Problèmes connus | Améliorations prévues | Critères de validation |
|----|-----|----------|---------------------|------|------------------|----------------------|------------------------|
| FE-DOC-000 | Moteur documentaire DOC-01 | Définir l’architecture transversale | `docs/superpowers/specs/2026-08-21-document-engine-design.md` | `VALIDÉ` | — | — | Spec validé. |
| FE-DOC-001 | Reçus | Générer reçus de paiement | `document-engine/templates/receipt-template.js` | `VALIDÉ` | — | — | PDF correct. |
| FE-DOC-002 | Bulletins | Générer bulletins PDF | `BulletinTemplate` (non créé) | `À FAIRE` | Template absent | Créer `BulletinTemplate` | Bulletin PDF conforme. |
| FE-DOC-003 | Attestations | Générer attestations PDF | `AttestationTemplate` (non créé) | `À FAIRE` | Template absent | Créer `AttestationTemplate` | Attestation PDF conforme. |
| FE-DOC-004 | Convocations | Générer convocations PDF | `ConvocationTemplate` (non créé) | `À FAIRE` | Template absent | Créer `ConvocationTemplate` | Convocation PDF conforme. |
| FE-DOC-005 | Devoirs PDF | Générer sujet de devoir | `app.js:1332-1393` (inline jsPDF) | `À FAIRE` | Pas dans Document Engine | Migrer vers `AssignmentTemplate` | PDF devoir conforme. |
| FE-DOC-006 | Certifications PDF | Générer documents examens | `app.js:1233-1305` (inline jsPDF) | `À FAIRE` | Pas dans Document Engine | Décider périmètre | — |

## Safe Assistant

| ID | Nom | Objectif | Écrans / Composants | État | Problèmes connus | Améliorations prévues | Critères de validation |
|----|-----|----------|---------------------|------|------------------|----------------------|------------------------|
| FE-SAFE-001 | Assistant flottant | Aider l’utilisateur | `safe-assistant.js` | `VALIDÉ` | Superposition UI corrigée | z-index réduit à 100, repositionné sur `.screen-auth` | Toujours visible, ne bloque jamais les CTA. |
| FE-SAFE-002 | FAQ | Répondre aux questions courantes | `safe-assistant.js` | `À TESTER` | FAQ codée en dur (8 questions) | Connecter base de connaissances | Réponses à jour. |
| FE-SAFE-003 | Onboarding | Guider nouvel utilisateur | `safe-assistant.js` | `VALIDÉ` | Étapes fixes | Configurable par école | Onboarding complet. |

## Modules métier absents

| ID | Nom | Objectif | Écrans / Composants | État | Problèmes connus | Améliorations prévues | Critères de validation |
|----|-----|----------|---------------------|------|------------------|----------------------|------------------------|
| FE-ABSENT-001 | Comptabilité | Plan comptable, journal, SYSCOHADA | — | `ABSENT` | Branche accountant dans `roleCatalog` | Spécifier besoin | — |
| FE-ABSENT-002 | RH / Personnel | Contrats, paie, présences | — | `ABSENT` | Branche hr dans `roleCatalog` | Spécifier besoin | — |
| FE-ABSENT-003 | Cantine | Menus, présences repas | — | `ABSENT` | Branche canteen dans `roleCatalog` | Spécifier besoin | — |
| FE-ABSENT-004 | Infirmerie | Consultations, allergies | — | `ABSENT` | Branche nurse dans `roleCatalog` | Spécifier besoin | — |
| FE-ABSENT-005 | Communication | Messages, annonces, site public | — | `ABSENT` | Branche communication dans `roleCatalog` | Spécifier besoin | — |
| FE-ABSENT-006 | Rapports et audit | Rapports opérationnels | — | `ABSENT` | Branche reports dans `roleCatalog` | Spécifier besoin | — |
| FE-ABSENT-007 | Emploi du temps | Planning cours | — | `ABSENT` | Mentionné dans branches | Spécifier besoin | — |
| FE-ABSENT-008 | Présences / appel | Appel élèves | — | `ABSENT` | Mentionné dans branches | Spécifier besoin | — |
| FE-ABSENT-009 | Imports massifs | Importer élèves/personnel | — | `ABSENT` | Mentionné | Spécifier besoin | — |
| FE-ABSENT-010 | Exports Excel | Exporter listes et rapports | — | `ABSENT` | Mentionné | Spécifier besoin | — |
