# Diagnostic READ-ONLY — Design & couche visuelle du frontend SchoolSafe V2

**Date** : diagnostic du 2025 (session courante) · **Périmètre** : `app/` uniquement · **Aucune modification effectuée.**

---

## 1. Vue d'ensemble

| Indicateur | Valeur |
|---|---|
| Fichiers CSS chargés dans `app/index.html` | ~30 `<link>` (tous en `<head>`, bloquants, non minifiés) |
| Poids total CSS | **≈ 563 Ko / 19 269 lignes** (tous fichiers confondus) |
| Plus gros fichiers | `styles/modules/pedagogy.css` (83 Ko / 3 487 l.), `styles/dashboard.css` (74 Ko / 3 055 l.), `styles/components.css` (37 Ko / 1 428 l.), `styles/modules/parent-portal.css` (27 Ko) |
| `!important` total | **24** (très discipliné) |
| Couleurs hex en dur (hors design-tokens.css) | **475 occurrences**, dont 98× `#fff` |
| Assets images | 60 PNG « patrimoine » (6,8 Mo), logo 67 Ko, hero-reference 1,7 Mo (non référencé), 6 JPEG login (34–95 Ko), 1 GLB 3D **7,0 Mo** |
| Thème sombre | Oui, complet (`[data-theme="dark"]` + toggle `localStorage("ss-theme")`, `app.js:2580`) |

---

## 2. Système de design tokens

### Points forts
- `app/styles/design-tokens.css` (387 lignes) est **un vrai fichier source unique** : palette complète (navy 950→700, blue 900→50, gold, slate, + 7 familles sémantiques emerald/coral/violet/orange/cyan/pink), alias sémantiques (`--ss-bg-*`, `--ss-text-*`, `--ss-border-*`, `--ss-shadow-xs→xl`, `--ss-shadow-glow`), typographie (`--ss-text-xs→4xl`, poids, interlignages), espacements 4→64 px, rayons 8→24 px, transitions (120/180/280 ms + bounce), breakpoints documentés (640/768/1024/1280/1536), **et couleurs par domaine métier** (`--ss-domain-ecole`, `-parent`, `-pedagogie`, `-finance`…) déclinées en clair ET sombre (`design-tokens.css:290-387`).
- Thème sombre sérieux : surfaces, textes, bordures, états sémantiques et ombres tous redéfinis (`design-tokens.css:149-206`), avec anti-FOUC inline dans `index.html:12-20`.
- Usage massif et réel : `dashboard.css` = 915 `var(--ss-*)`, `pedagogy.css` = 1 182, `components.css` = 434. La majorité des modules récents est 100 % tokenisée (0 hex dans `auth.css`, `setup.css`, `pedagogy.css`, `finance.css`, `parent-portal.css`, `hr.css`…).
- Pont de compatibilité propre : `domain-identity.css:11-18` redéfinit les variables héritées (`--border-color`, `--surface-card`, `--text-muted`…) en alias des tokens `--ss-*`, ce qui sauve `inventory.css` (26 usages de variables legacy).

### Faiblesses
- **Trois systèmes de tokens coexistent** :
  1. `--ss-*` (officiel) ;
  2. Legacy sans préfixe dans `styles/screens/entry.css:1-21` (`--navy-950: #04112a`, `--gold-500: #e9a515`… valeurs **différentes** de leurs équivalents `--ss-*` — ex. `#e9a515` vs `--ss-gold-500: #f59e0b`) ;
  3. **Collision de namespace** dans `modules/cards/assets/cards.css:6` : `.ss-card-studio` redéfinit `--ss-navy: #2b3740` et `--ss-gold: #e8a91d` — même préfixe `--ss-` que le design system, valeurs incompatibles (gris ardoise au lieu de bleu marine). Scopé donc non destructeur, mais sémantiquement dangereux.
- Tokens référencés mais **jamais définis** : `--ss-amber-50/100/300/800/900`, `--ss-bg-brand-subtle` dans `styles/modules/school.css:253-440` ; `--ss-primary` (fallback `#245ee7`, proche mais ≠ `--ss-blue-600: #2563eb`) dans `styles/modules/administration.css:6`. Les fallbacks masquent le problème au runtime.
- Tokens typographie (`--ss-text-base: 16px`) contredits par `DESIGN.md` (« corps 13-14 px ») et par la couche patch `styles.css:63-80` qui force 14 px globalement — **le document de design, les tokens et le rendu réel divergent**.

---

## 3. Cohérence visuelle entre modules

### Points forts
- Une **architecture d'harmonisation volontaire et documentée** : `domain-identity.css` (accents `--domain-a/b/soft` par module), puis trois couches de « finition » `deep-school-harmony.css`, `deep-operations-harmony.css`, `deep-governance-harmony.css` (~850 lignes) qui appliquent le même pattern (hero, onglets, icônes KPI) avec seules les couleurs qui changent. Le commentaire de `domain-identity.css:1-8` explicite la référence de qualité (module Inventaire) généralisée partout.
- `finance.css` n'est pas un module de styles autonome mais une **couche de re-thémage** au-dessus de classes définies ailleurs (pédagogie/dashboard) — pattern override assumé, propre, 0 hex, 212 `var(--ss-*)`.
- Classes préfixées `.ss-` dans `components.css` pour éviter les conflits (boutons, icon-buttons 44 px, focus ring, sr-only).

### Problèmes
- **Duplication structurelle visible** : chaque module réécrit ses en-têtes de sections (`inventory.css:24-31` répète 7× le même bloc `header { display:flex; justify-content:space-between… }`), ses tabs et ses « boundary chips » ; `communication.css`, `inventory.css`, `administration.css` utilisent chacun leur propre variable d'accent locale (`--communication-accent`, `--inventory-accent`, `--ss-primary`) au lieu des `--ss-domain-*` — le système de domaines est donc utilisé de façon **inconstante** (3 conventions parallèles).
- `entry.css` (splash/entrée) : 0 `var(--ss-*)`, 49 hex en dur — patrimoine préservé volontairement (cf. DESIGN.md), mais c'est une île hors système.

---

## 4. Accessibilité

### Points forts
- **Touch targets 44 px** largement appliqués : `components.css` (11 mentions), `dashboard.css` (23), `pedagogy.css` (18), patch `styles.css:82-89` force `min-height: 44px` sur nav/breadcrumb/tabs/bottom-nav.
- Focus states : `:focus-visible` global dans `entry.css:35-38` (anneau bleu 3 px offset 2 px), `.ss-focus-ring` dans `components.css:21-24`, et 40+ occurrences réparties dans la plupart des modules.
- `prefers-reduced-motion` géré : `entry.css:306` et `pedagogy.css:3483` (`reduce`), plus les 3 fichiers harmony qui n'activent leurs animations que sous `no-preference` (approche correcte, progressive).
- `.ss-sr-only` présent (`components.css:9-19`) ; `lang="fr"`, `viewport-fit=cover`, `theme-color` dans `index.html`.

### Problèmes (sévérité moyenne)
- **Contrastes limite** :
  - `--ss-text-muted: #94a3b8` sur blanc ≈ **2,9:1** — sous le seuil WCAG AA 4,5:1 pour du texte (`design-tokens.css:102`).
  - Labels de section sidebar `rgba(255,255,255,0.5)` 12 px sur navy `#1e3a8a` ≈ **3,4:1** (`dashboard.css:118-125`).
  - Or `#fbbf24` ≈ 1,6:1 sur blanc — acceptable car DESIGN.md le réserve aux accents sur fond marine (≈ 7,9:1), mais `school.css`/`administration.css` utilisent des ambers en texte sur fonds clairs.
- **Micro-typographie** : `font-size: 9px` (×2), `10px` (×2), `11px`, `0.6rem` — hérité du principe DESIGN.md « micro-texte 9-11 px », illisible sur mobile et non conforme aux pratiques 2025.
- Responsive **desktop-first** (`max-width` partout, un seul `min-width: 769px`) et **breakpoints chaotiques** : 22 valeurs distinctes (768, 1100, 1024, 900, 720, 640, 620, 560, 520, 480, 460, 420…) alors que les tokens en documentent 5 — les tokens de breakpoints ne sont **pas réellement utilisés**.

---

## 5. Typographie

- Stack officielle : system-ui / Segoe UI (tokens `design-tokens.css:212`), aucune police custom chargée pour l'interface — rapide, cohérent, mais **générique** (rendu « admin Windows »).
- **Exception** : `modules/cards/assets/cards.css:2` importe **Baloo 2 + Nunito Sans depuis Google Fonts** (réseau externe, problématique pour une PWA offline et incohérent avec le système).
- Hiérarchie : titres extrabold 800 (héros 30 px), corps 14 px imposé par patch, labels uppercase letter-spacing 0,06–0,08 em — hiérarchie claire et constante.
- Échelle de tokens complète mais partiellement contournée par des tailles en dur (`px`) : 306 occurrences `px` dans `dashboard.css`, 233 dans `pedagogy.css`.

---

## 6. Thème clair / sombre

- Implémentation complète et élégante : attribut `data-theme`, persistance `localStorage`, respect de `prefers-color-scheme`, toggle (`app.js:2578-2583`), tokens sombres complets.
- **Failles de couverture** : les 475 hex en dur ne basculent pas (surtout `entry.css`, `communication.css` 51 hex, `administration.css` 25 hex, `cards.css` entièrement en dur, `invent
ory.css` hero `linear-gradient(135deg,#0f766e,#2563eb)` identique en sombre). Le thème sombre est donc **bon au centre (workspace, modules harmonisés), dégradé en périphérie** (splash, cartes élèves, communication).

---

## 7. Poids, organisation, cascade

- **30 feuilles chargées en `<head>`, toutes render-blocking, non concaténées/minifiées** (`index.html:29-62`) — 563 Ko bruts. Acceptable derrière un service worker (`sw.js` présent), lourd en première visite.
- Ordre de cascade logique : tokens → composants → entry → patch `styles.css` → dashboard → modules → screens → cartes → couches harmony/identity **en dernier** (les overrides gagnent).
- Spécificité maîtrisée : 24 `!important` seulement ; toutefois 4 d'entre eux (`dashboard.css:15-21`) servent à **neutraliser un `styles-original.css` qui n'existe plus** — code mort.
- `styles.css` racine (103 lignes) est un **patch correctif de lisibilité** (UI-VIS-01) qui force les tailles de police par-dessus tout : symptôme d'un design corrigé par surcouche plutôt qu'à la source.
- CSS mort probable : `.today-item` est généré par `app.js:2344` et ne reçoit que des overrides de taille (`styles.css:44-45`) ; **aucun style de base n'existe** dans les feuilles actuelles → la liste « workspaceToday » (`index.html:556`) se rend sans mise en forme dédiée.

---

## 8. Assets images

| Asset | Détail | Verdict |
|---|---|---|
| `modules/cards/assets/patrimoine/` | **60 PNG 220×220 RGBA**, 89–136 Ko chacun, **6,8 Mo** (animaux/minerais/oiseaux — art des cartes élèves à collectionner, `card-renderer.js:71`) | Correct en dimensions, lourd en poids ; conversion WebP ≈ -70 % |
| `schoolsafe-hero-reference.png` | 1024×1024, **1,7 Mo** | **Non référencé** dans index.html/app.js/sw.js/manifest → asset mort |
| `schoolsafe-logo.png` | 256×256, 67 Ko, utilisé partout (favicon, splash, sidebar, avatars par défaut) | Lourd pour un logo ; un SVG ou PNG 64/128 suffirait |
| `login-kid-1..6.jpg` | 640×545, 34–95 Ko | OK ; 4 des 6 utilisés dans la galerie d'entrée (`index.html:140-143`), 2 probablement en rotation auth |
| `assets/jaspe3d/jaspe-web-v2.glb` | **7,0 Mo**, modèle glTF binaire (assistant 3D « Jaspe », three.js vendored) | Très lourd ; à lazy-loader ou compresser (Draco/meshopt) |

---

## 9. Description factuelle du style visuel actuel

- **Direction** : « Aura Blue » (DESIGN.md) — centre de pilotage scolaire **flat premium** : fond gris froid `#f8fafc`, cartes blanches à rayons généreux (14–24 px), ombres douces type Tailwind (opacité 4–10 %), sidebar et héros bleu marine `#1e3a8a`, or `#fbbf24` en accent de marque uniquement.
- **Tendances présentes** : légère **glassmorphism** réservée aux écrans patrimoniaux (`backdrop-filter` dans `auth.css:110,210`, `entry.css`, `safe-assistant.css:82`) ; **dégradés navy→bleu→violet sur tous les en-têtes de modules** (`--ss-gradient-module`, utilisé dans 7 fichiers — **en contradiction avec la règle « pas de dégradé dans l'espace de travail » de DESIGN.md:9**, le document est en retard sur l'implémentation) ; usage moderne de `color-mix()` (`dashboard.css:523-528`) ; micro-interactions sobres (120–280 ms, soulèvement 1–3 px) ; icônes Lucide ; un assistant 3D (cube/GLB) comme élément de marque.
- **Écrans patrimoniaux distincts** : splash bleu nuit avec lignes tricolores (rouge/or/vert — clin d'œil RDC, `entry.css:103-105`), photos d'enfants en crossfade flouté sur l'auth, cartes élèves « Card Studio » à l'esthétique ludique (Baloo 2, arcs multicolores, tampon « duplicata ») très différente du workspace.
- **Verdict global** : design **moderne 2023-2025** dans le workspace (système de tokens sérieux, thème sombre, discipline CSS rare), mais **hétérogène** : 3 sous-systèmes visuels (workspace tokenisé / splash-auth patrimonial / card studio ludique) et une couche de patches correctifs qui trahit des corrections après coup.

---

## 10. Problèmes classés par sévérité

### Critique
1. **Asset 3D de 7 Mo + 563 Ko de CSS non minifiés + 30 feuilles bloquantes** : première visite très lourde pour une PWA censée fonctionner en contexte scolaire à connectivité faible. (`index.html:29-62`, `assets/jaspe3d/jaspe-web-v2.glb`)
2. **CSS mort / références fantômes** : overrides `!important` contre `styles-original.css` supprimé (`dashboard.css:8-21`) ; `.today-item` sans style de base (`app.js:2344`, `index.html:556`) ; `schoolsafe-hero-reference.png` (1,7 Mo) non référencé.

### Élevée
3. **Tokens référencés mais jamais définis** : `--ss-amber-*`, `--ss-bg-brand-subtle` (`school.css:253-440`), `--ss-primary` (`administration.css:6`) — rendu par fallbacks, divergence silencieuse du système.
4. **Thème sombre incomplet en périphérie** : hex en dur dans `communication.css` (51), `administration.css` (25), `entry.css` (49), `cards.css` (intégral), gradient hero `inventory.css:2`.
5. **Collision de namespace `--ss-*`** avec valeurs incompatibles dans `cards.css:6`.

### Moyenne
6. **Contrastes sous WCAG AA** : texte muted `#94a3b8`/blanc 2,9:1 ; labels sidebar `rgba(255,255,255,.5)`/navy 3,4:1 ; micro-texte 9–10 px.
7. **DESIGN.md désynchronisé** : interdit les dégradés (ligne 9) alors que tous les en-têtes de modules en utilisent ; annonce corps 13-14 px là où les tokens disent 16 px ; `today-item` documenté mais non stylé.
8. **Breakpoints non standardisés** : 22 valeurs `max-width` distinctes, desktop-first, tokens de breakpoints inutilisés.
9. **Duplication inter-modules** : 3 conventions d'accent parallèles (`--ss-domain-*`, variables locales `--*-accent`, couches harmony) ; blocs header/tabs répétés.
10. **Dépendance Google Fonts externe** (`cards.css:2`) incompatible avec l'ambition offline de la PWA.

### Faible
11. Deux systèmes de tokens dans `entry.css` (valeurs or/bleu différentes du système officiel) — patrimoine assumé mais non documenté comme tel dans le code.
12. Logo PNG 67 Ko utilisé comme avatar par défaut et favicon ; pas de version SVG.
13. `font-synthesis: none` et `overflow: hidden` global sur body (`entry.css:24,29`) — hérités du splash, à vérifier sur les écrans longs.

---

## 11. Points forts à préserver

1. Design tokens complets, sémantiques, **avec thème sombre et couleurs par domaine métier** — rare et bien exécuté.
2. Discipline CSS exceptionnelle : 24 `!important` sur 19 269 lignes, modules récents 100 % tokenisés.
3. Architecture d'harmonisation explicite (domain-identity + 3 couches deep-*) avec intention documentée.
4. Accessibilité prise au sérieux sur les fondamentaux : 44 px, focus-visible, reduced-motion, sr-only.
5. Identité de marque forte et cohérente : navy + or, patrimoine visuel (portraits d'enfants, lignes tricolores, cartes collectionnables) volontairement préservé.
