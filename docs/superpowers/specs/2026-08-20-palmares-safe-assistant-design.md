# Spec — Module Palmarès + Safe Assistant

**Date :** 2026-08-20  
**Statut :** Design approuvé en session, en attente de validation du spec écrit  
**Portée :** Backend + frontend vanilla JS de SchoolSafe V2

---

## 1. Contexte

SchoolSafe V2 dispose déjà des modules Finance, Pédagogie, Élèves, QR/Sécurité. Le menu “Palmarès” existe dans `app/app.js` mais n’a aucun rendu. Le kit visuel Safe Assistant existe sous `tmp/glb-inspect/safe_kit/` et `tmp/glb-inspect/safe2d/`.

## 2. Objectifs

1. **Module Palmarès** : classement automatique mensuel par classe et par école, basé sur les cotes publiées, avec photos existantes, étoiles d’encouragement par parent (unicité parent/élève/mois), et historique mensuel.
2. **Safe Assistant** : intégration du kit existant dans l’application vanilla JS.

Les deux modules doivent respecter le modèle d’autorisation :  
`USER → SCHOOL → ROLE → PERMISSION → SCOPE → CONDITION → EXCEPTION → AUDIT`.

---

## 3. Architecture générale

```
┌─────────────────────────────────────┐
│  Frontend (app/app.js + modules)    │
│  - Palmarès UI                      │
│  - Safe Assistant UI                │
└──────────────┬──────────────────────┘
               │ fetch / vanilla JS
┌──────────────▼──────────────────────┐
│  API Cloudflare / Node (server/)    │
│  - pedagogy/routes.ts               │
│    - rankings/service.ts            │
│    - rankings/routes.ts             │
└──────────────┬──────────────────────┘
               │ SQL / RLS
┌──────────────▼──────────────────────┐
│  Supabase (PostgreSQL + RLS)        │
│  - grades, assignments, students    │
│  - rankings, ranking_entries        │
│  - ranking_stars                    │
└─────────────────────────────────────┘
```

---

## 4. Backend Palmarès

### 4.1 Nouvelles tables

**`rankings`**
- `id` uuid PK
- `school_id` uuid → schools(id)
- `class_id` uuid → classes(id), NULL pour le top école
- `month` text (format `YYYY-MM`)
- `status` enum(`draft`, `published`)
- `computed_at` timestamptz
- `published_at` timestamptz NULL
- `computed_by_profile_id` uuid → profiles(id)
- `created_at`, `updated_at`

**`ranking_entries`**
- `id` uuid PK
- `ranking_id` uuid → rankings(id) ON DELETE CASCADE
- `student_id` uuid → students(id)
- `rank` int
- `monthly_average` numeric
- `metadata` jsonb (détails des cotes agrégées)

**`ranking_stars`**
- `id` uuid PK
- `ranking_id` uuid → rankings(id) ON DELETE CASCADE
- `student_id` uuid → students(id)
- `parent_profile_id` uuid → profiles(id)
- `created_at`
- Contrainte unique `(ranking_id, student_id, parent_profile_id)`

### 4.2 Service `server/src/pedagogy/rankings/service.ts`

Fonctions principales :

- `computeMonthlyRanking(schoolId: string, yearMonth: string, classId?: string)`
  - Filtre les `grades.status = 'published'` du mois.
  - Agrège par élève via les coefficients de `assignments`.
  - Calcule la moyenne mensuelle normalisée.
  - Classe les élèves (ordre décroissant).
  - Insère/maj `rankings` + `ranking_entries`.
  - Réutilise `computeStudentAverages` si pertinent.

- `publishRanking(rankingId: string)`
  - Passe `status` à `published`, fige les entrées.

- `addStar(rankingId, studentId, parentProfileId)`
- `removeStar(rankingId, studentId, parentProfileId)`
- `listStarsForRanking(rankingId)`

### 4.3 Routes `server/src/pedagogy/rankings/routes.ts`

| Méthode | Route | Permission | Description |
|---------|-------|------------|-------------|
| GET | `/api/pedagogy/rankings` | `palmarques.read` | Liste des palmarès visibles |
| GET | `/api/pedagogy/rankings/:id` | `palmarques.read` | Détail d’un palmarès |
| POST | `/api/pedagogy/rankings/compute` | `palmarques.manage` | Calcule un palmarès mensuel |
| POST | `/api/pedagogy/rankings/:id/publish` | `palmarques.manage` | Publie le palmarès |
| POST | `/api/pedagogy/rankings/:id/stars` | `palmarques.read` | Donne une étoile |
| DELETE | `/api/pedagogy/rankings/:id/stars/:studentId` | `palmarques.read` | Retire une étoile |

Intégration dans `server/src/pedagogy/routes.ts` via `fastify.register(..., { prefix: '/rankings' })`.

### 4.4 Sécurité backend

- Vérification de la permission avant chaque action.
- Vérification du scope : école, classes assignées, ou propres enfants.
- DENY explicite prioritaire sur ALLOW.
- Audit des opérations sensibles et des tentatives refusées importantes dans `public.audit_events`.

### 4.5 Supabase RLS

Politiques sur `rankings`, `ranking_entries`, `ranking_stars` :
- Admin école : lecture/écriture complète sur son `school_id`.
- Prof titulaire : lecture/écriture sur les classes auxquelles il est assigné.
- Parent : lecture uniquement du top école + du top de la classe de son enfant ; écriture uniquement de ses propres étoiles.

---

## 5. Frontend Palmarès

### 5.1 Nouveaux fichiers

- `app/modules/pedagogy/palmares-api.js` : encapsulation des appels API Palmarès.
- `app/modules/pedagogy/palmares-module.js` : rendu, interactions, mode démo.

### 5.2 Fonctionnalités d’affichage

- Sélecteur de mois / historique.
- Vue **Top 10 classe** (prof/admin : toutes les classes sélectionnables ; parent : seulement la classe de son enfant).
- Vue **Top 10 école**.
- Podium 🥇🥈🥉 pour les 3 premiers.
- Carte élève : photo officielle, nom, classe, rang, moyenne mensuelle.
- Bouton ⭐ Encourager pour les parents.
- Compteur d’étoiles par élève.

### 5.3 Réutilisation des données existantes

- Photo : `students.photo_path`, via la fonction de rendu photo déjà utilisée pour la carte/QR.
- Moyenne : logique existante dans `server/src/pedagogy/averages.ts`.
- Classes/élèves : modules Pédagogie et Élèves existants.

### 5.4 Mode démo

- En mode développement/test : données de démo clairement identifiées.
- En mode réel/production sans API : affichage explicite “Données indisponibles / connexion impossible”.
- Aucune opération financière ou de classement ne doit reposer sur des données de démo en production.

---

## 6. Safe Assistant

### 6.1 Assets

Copie de `tmp/glb-inspect/safe2d/` vers `app/safe2d/` :
- 12 poses PNG.
- FAQ et onboarding depuis `tmp/glb-inspect/safe_kit/`.

### 6.2 Nouveaux fichiers

- `app/modules/safe/safe-assistant.js` : assistant vanilla JS.
- `app/modules/safe/safe-assistant.css` : styles.

### 6.3 Fonctionnalités

- Bulle de dialogue avec le personnage Safe.
- FAQ intégrée.
- Onboarding au premier lancement.
- Sélecteur de pose.

### 6.4 Intégration

- Bouton flottant en bas à droite dans `app/index.html` et `app/app.js`.
- Entrée “Safe Assistant” dans le menu principal.

---

## 7. Permissions et profils

Permissions existantes à utiliser :
- `palmarques.read`
- `palmarques.manage`

Profils concernés :
- **Direction** : admin, accès complet.
- **Enseignant** : classes assignées.
- **Parent/Tuteur** : classe de son enfant + top école.
- **Caisse / Finance / Gardien** : pas d’accès Palmarès (sauf exception).

---

## 8. Tests

- **Backend** : tests unitaires et d’intégration vitest pour `service.ts` et `routes.ts`.
- **Frontend** : smoke test navigateur + tests visuels.
- **Sécurité** : vérification RLS par profil.

---

## 9. Fichiers modifiés ou créés

**Créés :**
- `supabase/migrations/YYYYMMDD_add_rankings_tables.sql`
- `server/src/pedagogy/rankings/service.ts`
- `server/src/pedagogy/rankings/routes.ts`
- `server/src/pedagogy/rankings/rankings.test.ts`
- `app/modules/pedagogy/palmares-api.js`
- `app/modules/pedagogy/palmares-module.js`
- `app/modules/safe/safe-assistant.js`
- `app/modules/safe/safe-assistant.css`
- `app/safe2d/` (assets copiés)

**Modifiés :**
- `server/src/pedagogy/routes.ts`
- `app/app.js`
- `app/index.html`

---

## 10. Critères d’acceptation

- [ ] Le Palmarès calcule automatiquement le Top 10 par classe et par école.
- [ ] Le parent ne voit que le top de la classe de son enfant et le top école.
- [ ] Les photos officielles sont réutilisées.
- [ ] Le parent peut donner une seule étoile par élève par palmarès mensuel.
- [ ] Les étoiles n’affectent pas le rang.
- [ ] L’historique mensuel est conservé.
- [ ] Les permissions, scopes, RLS et audit sont en place.
- [ ] Le Safe Assistant est accessible via bouton flottant et menu.
- [ ] Aucune régression dans Finance ni les autres modules.
