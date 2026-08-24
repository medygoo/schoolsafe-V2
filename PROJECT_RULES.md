# Règles permanentes — SchoolSafe V2

> Lire ce fichier au début de chaque session.

## Lois fondamentales d’autorisation

**LAW-01 — Administrateur principal = accès total.**

**LAW-02 — Tous les autres utilisateurs = DENY par défaut.**

**LAW-03 — Accès = Fonction → Sous-fonction → Action → Portée → Condition → Exception.**

**LAW-04 — Une fonctionnalité ouverte ne signifie jamais toute la fonctionnalité ouverte.**

**LAW-05 — Le rôle est un modèle de permissions, pas une permission absolue.**

**LAW-06 — Permission absente = refus.**

**LAW-07 — Même moteur d’autorisation partout.**

**LAW-08 — Ne jamais inventer une permission : en cas de doute, demander ou enregistrer le cas.**

## Méthode de travail

- Chantier A = frontend uniquement.
- Chantier B = backend uniquement, après validation du frontend.
- Une fonctionnalité à la fois.
- Rien ne doit être perdu entre les sessions : mémoire dans `docs/project-context/`.
- Aucun `git push`, aucun déploiement, aucune commande destructive Supabase.

## Mémoire projet

- Index : `docs/project-context/INDEX.md`
- État : `docs/project-context/CURRENT_STATE.md`
- Frontend : `docs/project-context/FRONTEND_MASTER_PLAN.md`
- Idées : `docs/project-context/IDEAS_BACKLOG.md`
- Décisions : `docs/project-context/DECISIONS.md`
- Sessions : `docs/project-context/SESSION_LOG.md`
- Backend différé : `docs/project-context/BACKEND_LATER.md`
- Loi d’accès : `docs/project-context/ACCESS_LAW.md`

## Avant toute nouvelle fonctionnalité

Répondre aux 5 questions :

1. Quelle fonctionnalité ?
2. Quelle action ?
3. Quelle permission ?
4. Quelle portée ?
5. Existe-t-il une condition ou une exception ?

Si une réponse manque : **ne pas inventer l’accès**.
