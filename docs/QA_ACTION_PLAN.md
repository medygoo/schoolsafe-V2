# SchoolSafe V2 — Plan d'action QA (Choix 3)

> Périmètre : validation visuelle et fonctionnelle du frontend `app/`, corrections possibles sans instance Supabase réelle, identification des écarts nécessitant une base distante.

---

## 1. Objectifs

1. Documenter les scénarios de test par profil utilisateur.
2. Effectuer une passe visuelle complète sur les écrans clés.
3. Corriger les défauts frontend qui ne dépendent pas du backend.
4. Identifier clairement ce qui reste à valider sur Supabase réel.

---

## 2. Profils de base à couvrir

| Profil | Code rôle | Modules concernés |
|--------|-----------|-------------------|
| Direction / Admin principal | `admin`, `school_head` | Tous |
| Enseignant | `teacher` | Pédagogie, Finance (lecture) |
| Parent / Tuteur | `parent` | Finance famille, Pédagogie parent |
| Caisse | `cashier` | Finance caisse/reçus |
| Gardien / Sécurité | `guard` | Sécurité (scan QR) |
| Finance | `finance` | Finance complet |

---

## 3. Modules et fonctionnalités à inspecter

| Module | Points de contrôle |
|--------|--------------------|
| **Navigation** | Splash, guardian, auth, workspace, menu latéral, responsive mobile/desktop. |
| **Auth** | Formulaire e-mail/téléphone, mot de passe oublié, sélecteur de démo, changement de langue. |
| **Finance** | Vue d'ensemble, structure des frais, caisse, reçus, soldes, rapports, vue famille. |
| **Sécurité** | Saisie manuelle QR, scan caméra, historique. |
| **Pédagogie** | Matières, devoirs, notes, bulletins, remédiation, certifications, vue parent. |
| **Pilotage** | Tableau de bord, alertes. |
| **École** | Paramètres, années académiques, cycles, personnel, rôles et permissions. |
| **Cartes** | Sélection classe/élève/gardien, aperçu, demande d'impression. |
| **Formulaires** | Validation visuelle, états d'erreur, messages, accessibilité. |
| **Responsive** | Mobile ≤620 px, tablette 621–900 px, desktop >900 px. |

---

## 4. Phases de travail

### Phase 1 — Scénarios de test (sans backend)
- Rédiger `docs/QA_PROFILE_SCENARIOS.md`.
- Associer chaque fonctionnalité à un profil, des étapes, un résultat attendu.

### Phase 2 — Tests visuels frontend
- Servir `app/` en local via un serveur statique.
- Naviguer manuellement / via Playwright sur les écrans principaux.
- Capturer les anomalies : erreurs console, layout cassé, boutons sans action, fallback démo silencieux.

### Phase 3 — Corrections frontend autonomes
- Corriger les problèmes purement visuels/JS sans dépendance backend.
- Ne pas modifier la logique métier qui nécessite Supabase.
- Vérifier `node --check` ou compilation si applicable.

### Phase 4 — Validation post-correction
- Relancer les tests visuels sur les zones corrigées.
- Mettre à jour les scénarios avec le statut réel.

### Phase 5 — Écarts backend / Supabase
- Lister ce qui ne peut pas être testé sans base réelle.
- Reporter dans le bilan final.

---

## 5. Critères de passage partiel (frontend uniquement)

- [ ] Tous les écrans principaux s'affichent sans erreur console bloquante.
- [ ] La navigation entre les 5 écrans principaux fonctionne.
- [ ] Le sélecteur de profil démo affiche les modules correspondants.
- [ ] Les formulaires affichent des états d'erreur cohérents.
- [ ] Le responsive ne masque pas de fonctionnalité essentielle.
- [ ] Les fallback démo sont visuellement identifiables (badge, message) et ne se confondent pas avec des données réelles.
- [ ] Les actions non branchées affichent un message explicite à l'utilisateur.

---

## 6. Livrables attendus

1. `docs/QA_PROFILE_SCENARIOS.md` — scénarios par profil.
2. Captures d'écran / rapport des tests visuels (dans `tmp/qa-visual-report/` si généré).
3. Corrections de fichiers frontend.
4. Bilan final structuré : corrigé / testé / restant / dépendant Supabase.

---

## 7. Hors périmètre de cette passe

- Tests d'intégration API/Worker.
- Validation RLS sur Supabase.
- Tests E2E avec authentification réelle.
- Lancement de Supabase local ou Docker.
