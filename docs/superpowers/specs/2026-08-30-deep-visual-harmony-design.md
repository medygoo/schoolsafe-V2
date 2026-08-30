# Harmonisation visuelle profonde post-M8 — conception

## Objectif

Approfondir l’identité visuelle des douze domaines SchoolSafe jusqu’aux contenus métier sans modifier la structure des composants, les calculs Executive KPI, l’autorisation, les données ou le backend.

## Architecture CSS

Trois feuilles de finition sont chargées après `domain-identity.css` :

- `deep-school-harmony.css` couvre Élèves/Scolarité, Parent, Pédagogie et les parcours Sécurité liés à l’école ;
- `deep-operations-harmony.css` couvre Sécurité opérationnelle, Finance, Comptabilité, RH et Stock ;
- `deep-governance-harmony.css` couvre Documents, Communication, Administration et Jaspe logiciel.

Chaque racine de domaine expose le même contrat interne (`--harmony-accent`, `--harmony-accent-2`, `--harmony-soft`, `--harmony-line`, `--harmony-ring`). Les sélecteurs restent strictement scopés à cette racine et décorent les composants existants : en-têtes internes, cartes, KPI, formulaires, champs, boutons, tableaux, filtres, états informatifs, modales et focus clavier. Les rayons, espacements et composants restent ceux du Design System SchoolSafe.

## Sémantique et accessibilité

Les variantes universelles succès, erreur/refus, avertissement, indisponible et information ne sont jamais recolorées par une palette métier. Les boutons, onglets, champs et contrôles atteignent 44 px minimum. Les wrappers de tableaux absorbent leur propre défilement horizontal ; les modales restent bornées au viewport. Le focus utilise une bague visible dérivée de l’accent du domaine.

## Thèmes et responsive

Les variables de domaine existantes dans `design-tokens.css` fournissent automatiquement les valeurs clair et bleu nuit. La validation réelle couvre 390, 834 et 1440 px dans les deux thèmes, avec vérification d’overflow, de hauteur des cibles et de contraste lisible.

## Verrous

`shared/permissions.json`, `app/modules/core/access.js`, `app/modules/cards/`, Splash, Guardian et les calculs Executive KPI restent inchangés. Aucun JavaScript métier, backend, API, SQL/RLS, Worker, Supabase, format 3D ou dépendance n’est ajouté.

## Validation

`frontend-deep-visual-harmony.spec.ts` ouvre réellement des sous-fonctions représentatives, vérifie le contrat calculé, les composants profonds, les couleurs sémantiques, les thèmes et les trois largeurs. Le re-gel ajoute cette suite et les trois feuilles CSS au contrat M8, puis relance la matrice QA globale demandée.
