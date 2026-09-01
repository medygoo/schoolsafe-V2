# SchoolSafe V2 — Aura Blue Workspace

## Identity

Aura Blue est la direction visuelle de l'espace de travail SchoolSafe V2 : un centre de pilotage scolaire calme, autoritaire et moderne, construit autour d'un bleu marine uni enrichi d'accents dorés et de cartes blanches épurées.

## Principles

- **Couleurs unies dans l'espace de travail** ; exception documentée : les en-têtes de sept modules métier utilisent un dégradé d'identité de domaine, avec `--ss-gradient-module` comme base commune. Toute nouvelle surface reste unie par défaut.
- **Le bleu porte l'autorité** : héros, sidebar, panneau de périmètre et en-têtes de modules en bleu marine.
- **L'or est un accent de marque** : labels, icônes de validation et détails de statut uniquement.
- **Les cartes blanches portent le contenu** : fond gris froid, cartes blanches, ombres douces, bords arrondis généreux.
- **Le patrimoine visuel historique reste intact** : écran d'accueil bleu, cube, portraits, Safe Assistant et écrans d'authentification ne sont pas modifiés.

## Palette

| Rôle | Valeur | Usage |
|------|--------|-------|
| Bleu marine | `#1e3a8a` | Héros, sidebar, panneau latéral |
| Bleu primaire | `#2563eb` | Boutons actifs, liens |
| Bleu vif | `#3b82f6` | Survols, icônes secondaires |
| Bleu clair | `#dbeafe` | Fonds d'en-tête de branches |
| Or | `#fbbf24` | Accents de marque, labels |
| Gris froid | `#f8fafc` | Fond de workspace |
| Gris ardoise | `#64748b` | Texte secondaire |
| Blanc | `#ffffff` | Cartes, surfaces de contenu |

## Typography

- Stack système administratif : `"Segoe UI", Roboto, -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif`.
- Titres : gras 800, interlignage serré.
- Corps : 16 px (token `--ss-text-base`), gris ardoise `#475569`.
- Labels et micro-texte : 11-12 px minimum, majuscules, espacement large.

## Components

### Hero
- Fond `#1e3a8a` uni.
- Label doré `#fbbf24` sur fond blanc semi-transparent.
- Titre blanc, 30 px, gras 800.
- CTA blanc, texte bleu marine.
- Grille de 10 indicateurs translucides.

### Cartes de priorité (today-item)
- Fond bleu uni selon la tuile (4 teintes de la famille bleue).
- Texte blanc.
- Icône dans un cercle carré blanc semi-transparent.
- Ombre douce et léger soulèvement au survol.

### Branches
- Carte blanche, bordure grise.
- En-tête avec fond bleu très clair (`--branch-bg`).
- Icône colorée selon la branche dans un disque blanc.
- Boutons d'action blancs, survol avec fond teinté et ombre de focus.

### Panneau latéral d'accès
- Fond `#1e3a8a` uni.
- Label doré.
- Pastilles de branches blanches semi-transparentes.
- Badge "Accès autorisé" blanc translucide.

### Informations communes
- Carte blanche avec 4 sous-cartes sur fond gris clair.
- Icônes bleues unifiées.

## Spacing & Elevation

- Rayons : 8 px (petits), 14 px (cartes), 18 px (sections), 26 px (grandes surfaces).
- Ombres : offsets faibles, blur large, opacité 4-8 %.
- Gouttières : 18-26 px entre les sections.

## Responsive

- Desktop : sidebar fixe, grille 3 colonnes.
- Tablette : grille 2 colonnes.
- Mobile : sidebar repliée derrière le cube, colonne unique, hero en pleine largeur.
- Paliers de référence : 480 / 640 / 768 / 1024 / 1280 px. Les modules historiques peuvent conserver temporairement des paliers intermédiaires jusqu'à leur harmonisation.

## Motion

- Transitions courtes (180 ms) sur les états interactifs.
- Soulèvement de 2-3 px au survol des cartes.
- Focus anneau bleu clair de 3 px.
- Aucune animation d'entrée agressive ; l'interface reste utilisable immédiatement.

## Distribution locale

- Le Card Studio utilise Baloo 2 et Nunito Sans depuis `app/assets/fonts/`, sans appel à Google Fonts.
- Les dépendances QRCode.js et html2canvas sont distribuées localement avec leurs licences et empreintes dans `app/vendor/THIRD_PARTY_NOTICES.md`.
- Les icônes PWA 192 px, 512 px et 512 px maskable sont déclarées dans le manifeste.
