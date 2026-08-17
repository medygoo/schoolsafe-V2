# SchoolSafe V2 — Partie B : École & Personnel

## Objectif

Finaliser l’espace **admin principal** avec les onglets **Mon école** et **Mon équipe**, et brancher le menu d’accès aux permissions `school.manage` / `staff.manage`.

## Contexte

La Partie A (EventService + NotificationService) est mergée dans `main`. Le backend École & Personnel existe déjà à l’état squelette (`server/src/school/*`) avec :
- lecture / mise à jour des paramètres de l’école ;
- liste, invitation, modification de rôles et activation du personnel ;
- endpoints rôles et permissions.

Le frontend PWA a aussi un module école partiel (`app/modules/school/*`) qui n’est pas encore branché dans `app.js` ni dans le menu.

## Périmètre de la Partie B

### B1 — Backend École

1. **Années scolaires** (`academic_years`)
   - `GET /school/academic-years` : liste les années de l’école.
   - `POST /school/academic-years` : crée une année (label, dates, périodes : Trimestres/Semestres).
   - `PUT /school/academic-years/:id` : modifie une année non clôturée.
   - `POST /school/academic-years/:id/activate` : active une année (une seule active par école).
   - Une année active ne peut pas être supprimée.

2. **Cycles** (`school_cycles`)
   - `GET /school/cycles` : liste les cycles activés.
   - `PUT /school/cycles/:key/toggle` : active / désactive un cycle (`nursery`, `primary`, `secondary`).
   - Le cycle gardera son `cycle_name` localisable ; valeur par défaut :
     - `nursery` → Maternelle
     - `primary` → Primaire
     - `secondary` → Secondaire

3. **Logo / apparence**
   - `POST /school/logo` : upload du logo (multipart/form-data), stocké dans `server/uploads/logos/` pour l’instant.
   - Le chemin relatif est enregistré dans `school.logo_path`.
   - L’endpoint sert le logo en statique via `/uploads/logos/<filename>`.
   - Formats acceptés : PNG, JPG, WEBP ; taille max 2 Mo.

4. **Paramètres généraux**
   - L’endpoint `PUT /school/settings` reste le point d’entrée.
   - Le schéma Zod accepte les champs actuels plus `setup_completed_at` (auto-rempli à la première sauvegarde si vide).

### B2 — Backend Personnel

1. **Invitation**
   - `POST /school/staff/invite` existant reste valide.
   - Ajout d’un email de bienvenue envoyé via `NotificationService` (template `STAFF_INVITED`) avec un lien de réinitialisation de mot de passe.
   - `POST /school/staff/:id/resend-invite` : régénère un mot de passe temporaire et renvoie l’email.

2. **Détail d’un membre**
   - `GET /school/staff/:id` : retourne les infos du membre + rôles + scopes.

3. **Traçabilité**
   - Chaque création / modification de rôle / activation est enregistrée dans `audit_events` (action `staff.invited`, `staff.roles_changed`, `staff.toggled`).

### B3 — Tests backend

- Compléter `server/tests/school.test.ts` :
  - années scolaires CRUD + activation ;
  - cycles toggle ;
  - invitation avec audit event.
- Garder les tests mockés pour rester indépendants de Supabase en CI.

### B4 — Frontend École & Personnel

1. **CSS** : créer `app/modules/school/school.css` avec les styles des onglets, formulaires, tableaux et modales.
2. **Module JS** : compléter `app/modules/school/school-module.js` :
   - onglet **Mon école** : formulaire paramètres + gestion des années + cycles + upload logo ;
   - onglet **Mon équipe** : liste, invitation, édition rôles, activation/désactivation.
3. **API JS** : ajouter dans `app/modules/school/school-api.js` les appels années, cycles, logo, resend-invite.
4. **Chargement** : ajouter `school-module.js`, `school-api.js` et `school.css` dans `app/index.html`.
5. **Routage** : brancher `openSchoolModule()` / `closeSchoolModule()` dans `app/app.js`.

### B5 — Menu admin conditionné

- Ajouter une branche **Administration** dans le catalogue de rôles (`shared/permissions.json` déjà la source de vérité).
- L’action **École & Personnel** n’apparaît que si l’utilisateur a `school.manage` ou `staff.manage`.
- Le module s’ouvre via `openSchoolModule("school")` ou `openSchoolModule("staff")` selon l’action cliquée.

## Contraintes respectées

- **Mono-école** : toutes les requêtes utilisent `current_school_id()` côté base et `resolveProfileAndSchool` côté API.
- **Sécurité** : les routes sont protégées par `requirePermission(access, "school.manage")` ou `"staff.manage"`.
- **Aucun secret frontend** : l’upload passe par l’API, pas par Supabase direct.
- **Tests** : `npm run typecheck` et `npm test` doivent rester verts.

## Dépendances

- Partie A mergée (`main` à jour).
- Migrations existantes : `202608160001_step2_school_configuration.sql`.

## Non-objectifs (hors Partie B)

- Multi-école.
- Stockage R2 pour les logos (reporté après la mise en place de `FileStorage`).
- Gestion fine des contrats du personnel.
- Module public du site web de l’école.

## Critères d’acceptation

1. `GET /school/settings`, `PUT /school/settings`, `GET /school/staff`, `POST /school/staff/invite`, `PUT /school/staff/:id/roles`, `POST /school/staff/:id/toggle` restent fonctionnels.
2. `GET /school/academic-years`, `POST /school/academic-years`, `PUT /school/academic-years/:id`, `POST /school/academic-years/:id/activate` fonctionnent.
3. `GET /school/cycles`, `PUT /school/cycles/:key/toggle` fonctionnent.
4. `POST /school/logo` upload et sert un fichier.
5. Le module PWA s’ouvre depuis le menu et affiche les deux onglets.
6. `npm run typecheck` ✅ et `npm test` ✅ (78+ tests).
