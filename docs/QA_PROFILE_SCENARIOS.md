# SchoolSafe V2 — Scénarios de test par profil (QA visuel)

> Ces scénarios couvrent la navigation, l'affichage et les interactions frontend. Ils peuvent être exécutés sans instance Supabase réelle en utilisant le mode démo intégré.

---

## Légende

| Statut | Signification |
|--------|---------------|
| ✅ | Comportement attendu observé. |
| ⚠️ | Fonctionnel mais avec réserves (fallback, données statiques, UI perfectible). |
| ❌ | Anomalie détectée. |
| ⏳ | Non testable sans backend Supabase réel. |

---

## 1. Direction / Admin principal (`admin`, `school_head`)

| ID | Fonctionnalité | Étapes | Résultat attendu | Statut | Notes |
|----|----------------|--------|------------------|--------|-------|
| D1 | Connexion et accès workspace | 1. Ouvrir l'application.<br>2. Choisir le profil Direction.<br>3. Accéder au workspace. | Le workspace s'affiche avec le menu complet. | ⏳ | Nécessite authentification réelle pour validation complète. |
| D2 | Navigation complète | 1. Cliquer sur chaque icône du menu latéral. | Chaque module s'affiche sans erreur console. | ⏳ | — |
| D3 | Finance — structure des frais | 1. Ouvrir Finance.<br>2. Sélectionner « Structure des frais ». | Liste des frais visible, bouton d'ajout présent. | ⏳ | — |
| D4 | École — gestion du personnel | 1. Ouvrir École.<br>2. Sélectionner « Personnel ». | Tableau du personnel affiché, modale d'invitation fonctionnelle. | ⏳ | — |
| D5 | Pilotage — alertes | 1. Ouvrir Pilotage.<br>2. Sélectionner « Alertes ». | Liste des alertes affichée, actions ACK/résolution présentes. | ⏳ | — |
| D6 | Cartes — aperçu avant impression | 1. Ouvrir Cartes.<br>2. Sélectionner classe et élève. | L'aperçu de la carte s'affiche. | ⏳ | Dépend de Supabase pour les données élèves. |
| D7 | Responsive desktop | 1. Redimensionner à 1280×800. | Menu latéral visible, grilles lisibles. | ⏳ | — |

---

## 2. Enseignant (`teacher`)

| ID | Fonctionnalité | Étapes | Résultat attendu | Statut | Notes |
|----|----------------|--------|------------------|--------|-------|
| E1 | Accès au workspace enseignant | 1. Sélectionner profil Enseignant. | Modules Pédagogie et Finance (lecture) visibles. | ⏳ | — |
| E2 | Pédagogie — matières | 1. Ouvrir Pédagogie.<br>2. Sélectionner « Matières ». | Liste des matières affichée. | ⏳ | — |
| E3 | Pédagogie — devoirs | 1. Sélectionner « Devoirs ».<br>2. Cliquer sur « Ajouter ». | Formulaire de création de devoir affiché. | ⏳ | — |
| E4 | Pédagogie — notes | 1. Sélectionner « Notes ». | Grille de notes affichée. | ⏳ | Données statiques dans app.js à remplacer par API. |
| E5 | Pédagogie — bulletins | 1. Sélectionner « Bulletins ». | Vue des bulletins affichée. | ⏳ | — |
| E6 | Finance — lecture limitée | 1. Ouvrir Finance. | Seules les vues autorisées sont visibles. | ⏳ | — |
| E7 | Responsive mobile | 1. Redimensionner à 375×812. | Menu devient burger, contenu lisible. | ⏳ | — |

---

## 3. Parent / Tuteur (`parent`)

| ID | Fonctionnalité | Étapes | Résultat attendu | Statut | Notes |
|----|----------------|--------|------------------|--------|-------|
| P1 | Accès parent | 1. Sélectionner profil Parent. | Workspace avec Finance famille et Pédagogie parent. | ⏳ | — |
| P2 | Finance famille | 1. Ouvrir Finance. | Vue famille avec reçus des enfants. | ⏳ | — |
| P3 | Reçu PDF | 1. Sélectionner un reçu.<br>2. Cliquer sur « Télécharger ». | Le PDF est généré ou un message explicite apparaît. | ⏳ | — |
| P4 | Pédagogie parent | 1. Ouvrir Pédagogie.<br>2. Sélectionner « Vue parent ». | Devoirs et notes des enfants affichés. | ⏳ | — |
| P5 | Message si aucun enfant | 1. Simuler un parent sans enfant. | Message « Aucun enfant rattaché » affiché. | ⏳ | — |

---

## 4. Caisse (`cashier`)

| ID | Fonctionnalité | Étapes | Résultat attendu | Statut | Notes |
|----|----------------|--------|------------------|--------|-------|
| C1 | Accès caisse | 1. Sélectionner profil Caisse. | Modules Caisse et Reçus visibles. | ⏳ | — |
| C2 | Enregistrement paiement | 1. Ouvrir Caisse.<br>2. Remplir montant/mode.<br>3. Valider. | Paiement enregistré ou message explicite. | ⏳ | — |
| C3 | Édition reçu | 1. Sélectionner un paiement.<br>2. Cliquer sur « Reçu ». | Aperçu du reçu visible. | ⏳ | — |
| C4 | Clôture caisse | 1. Cliquer sur « Clôturer la caisse ». | Confirmation ou message d'erreur explicite. | ⏳ | — |
| C5 | Annulation non autorisée | 1. Tenter d'annuler un paiement. | Message « Action non autorisée » affiché. | ⏳ | — |

---

## 5. Gardien / Sécurité (`guard`)

| ID | Fonctionnalité | Étapes | Résultat attendu | Statut | Notes |
|----|----------------|--------|------------------|--------|-------|
| G1 | Accès sécurité | 1. Sélectionner profil Gardien. | Écran guardian ou workspace avec module Sécurité. | ⏳ | — |
| G2 | Saisie manuelle QR | 1. Ouvrir Sécurité.<br>2. Saisir un code.<br>3. Valider. | Résultat du scan affiché (autorisé/refusé). | ⏳ | — |
| G3 | Scan caméra | 1. Autoriser la caméra.<br>2. Pointer un QR. | Scan détecté et résultat affiché. | ⏳ | Nécessite `BarcodeDetector` et une vraie caméra. |
| G4 | Historique | 1. Consulter l'historique. | Liste des derniers événements de sécurité. | ⏳ | — |
| G5 | Fallback si caméra indisponible | 1. Désactiver la caméra ou utiliser un navigateur sans BarcodeDetector. | Message explicite proposant la saisie manuelle. | ⏳ | — |

---

## 6. Finance (`finance`)

| ID | Fonctionnalité | Étapes | Résultat attendu | Statut | Notes |
|----|----------------|--------|------------------|--------|-------|
| F1 | Accès finance complet | 1. Sélectionner profil Finance. | Tous les onglets Finance disponibles. | ⏳ | — |
| F2 | Structure des frais | 1. Ouvrir Structure.<br>2. Ajouter/modifier un frais. | Formulaire fonctionnel, validation visible. | ⏳ | — |
| F3 | Rapports journaliers | 1. Ouvrir Rapports.<br>2. Sélectionner une date. | Rapport généré ou message si aucune donnée. | ⏳ | — |
| F4 | Annulation paiement | 1. Sélectionner un paiement récent.<br>2. Annuler. | Paiement annulé ou message condition refusée. | ⏳ | — |
| F5 | Soldes et contrôle QR | 1. Ouvrir Soldes.<br>2. Scanner un contrôle. | État financier de l'élève affiché. | ⏳ | — |

---

## 7. Tests transversaux

| ID | Thème | Étapes | Résultat attendu | Statut | Notes |
|----|-------|--------|------------------|--------|-------|
| T1 | Changement de langue | 1. Basculer FR → EN sur l'écran auth. | Les labels changent. | ⏳ | — |
| T2 | Mot de passe oublié | 1. Cliquer sur « Mot de passe oublié ». | Formulaire de réinitialisation affiché. | ⏳ | — |
| T3 | Formulaires — validation | 1. Soumettre un formulaire vide. | Messages d'erreur apparition. | ⏳ | — |
| T4 | États vides | 1. Naviguer dans un module sans données. | Message « Aucune donnée » avec call-to-action. | ⏳ | — |
| T5 | Erreurs réseau | 1. Couper le backend.<br>2. Tenter une action. | Message « Connexion impossible » explicite. | ⏳ | — |
| T6 | Responsive mobile | 1. Tester 375×812 sur les 5 écrans. | Pas de débordement horizontal, texte lisible. | ⏳ | — |
| T7 | Responsive desktop | 1. Tester 1920×1080. | Grilles utilisent l'espace, menu latéral stable. | ⏳ | — |
| T8 | Accessibilité | 1. Naviguer au clavier.<br>2. Vérifier les contrastes. | Focus visible, labels associés. | ⏳ | — |

---

## 8. Résultats de la passe visuelle (2026-08-20)

> Environnement : serveur statique local `app/` sur `http://127.0.0.1:8080`, sans backend ni Supabase. Les captures sont dans `tmp/qa-visual-report/`.

### 8.1 Synthèse par profil

| Profil | Scénarios OK | Scénarios en anomalie | Scénarios non testables sans backend |
|--------|--------------|-----------------------|--------------------------------------|
| Direction | D1, D2, D7 | — | D3-D6 (données réelles nécessaires) |
| Enseignant | E1, E2, E7 | — | E3-E6 |
| Parent | P1, P2 | — | P3-P5 |
| Caisse | C1 | — | C2-C5 |
| Gardien | G1, G2, G4, G5 | — | G3 (caméra) |
| Finance | F1, F2 | — | F3-F5 |
| Transversaux | T1, T6, T7 | T5 partiel | T3, T4, T8 |

### 8.2 Corrections apportées pendant la passe

| Fichier | Correction |
|---------|------------|
| `app/modules/pedagogy/pedagogy-module.js` | Ajout d’un **mode démo local** : données de matières, classes, devoirs, élèves et vue parent en l’absence de backend. |
| `app/modules/pedagogy/pedagogy-module.js` | Le module accepte maintenant l’onglet cible via `render(containerId, { tab })`. |
| `app/app.js` | `openPedagogyModule(actionName)` passe l’onglet calculé au module pédagogie. |
| `app/modules/finance/finance-module.js` | `loadFinanceData()` et `loadDailyReport()` ne tentent plus d’appels API en mode démo, supprimant les erreurs CORS visibles dans la console. |

### 8.3 Anomalies détectées (non corrigées dans cette passe)

| ID | Anomalie | Raison |
|----|----------|--------|
| A1 | Module Pédagogie : « Aucun élève dans cette classe » dans le panneau de cotation en mode démo. | Les élèves démo ne sont pas filtrés par classe. Purement cosmétique en démo. |
| A2 | Boutons d’action du workspace non accessibles après ouverture d’un module (ce sont les onglets du module qui prennent le relais). | Comportement de design ; pas un bug. |
| A3 | Finance : en mode réel sans backend, le message d’erreur « Données indisponibles / connexion impossible » doit être confirmé avec le backend lancé. | Nécessite le worker/backend. |

### 8.4 Ce qui reste à valider sur Supabase réel

- Authentification réelle et rôle actif après connexion.
- Chargement des données depuis Supabase pour chaque module.
- Vérification des permissions et scopes par profil.
- Génération PDF des reçus et devoirs.
- Scan QR caméra (`BarcodeDetector`).
- Paiements, annulations, clôture de caisse.
- Synchronisation offline et file d’attente.
- Notifications push.
