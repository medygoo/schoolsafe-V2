# Journal des décisions — SchoolSafe V2

| ID | Date | Décision | Raison | Parties concernées | Conséquences |
|----|------|----------|--------|--------------------|--------------|
| DEC-001 | 2026-08-21 | Chantier Frontend puis Backend séparés | Éviter de mélanger les couches et construire le backend à partir des besoins frontend réels | Tout le projet | Aucun code backend pendant le chantier frontend. Tout besoin backend va dans `BACKEND_LATER.md`. |
| DEC-002 | 2026-08-21 | Système de mémoire projet dans `docs/project-context/` | Le contexte ne doit plus dépendre uniquement de la mémoire de conversation | Tout le projet | Création et mise à jour obligatoires des fichiers de contexte. |
| DEC-003 | 2026-08-21 | Une fonctionnalité à la fois | Éviter le travail dispersé et les régressions | Frontend | Valider chaque fonctionnalité avant de passer à la suivante. |
| DEC-004 | 2026-08-21 | Pas de fausses données présentées comme réelles | Préserver la confiance des utilisateurs | Frontend | Identifier et séparer données réelles / démo ; états indisponibles clairs. |
| DEC-005 | 2026-08-21 | Frontend jamais autorité de sécurité | La sécurité reste serveur/RLS | Frontend + Backend | UI peut masquer mais ne remplace pas les vérifications backend. |
| DEC-006 | 2026-08-21 | Loi d’accès SchoolSafe formalisée | Normaliser les permissions et empêcher l’invention d’accès | Tout le projet | Création de `PROJECT_RULES.md` et `docs/project-context/ACCESS_LAW.md`. Avant toute fonctionnalité, répondre aux 5 questions (fonctionnalité, action, permission, portée, condition/exception). |
| DEC-007 | 2026-08-21 | Architecture du moteur documentaire transversal DOC-01 | Unifier tous les documents sous un seul moteur, garantir la bascule future backend | Document Engine, Frontend, Backend futur | Approche 2 validée : Document Engine abstrait, hybride, frontend-first. Templates indépendants de jsPDF via `RenderContext`. Centre de documents global unique. PDF universel. Snapshots d’identité. Historique frontend provisoire sans données sensibles. |
| DEC-008 | 2026-08-21 | DOC-02 validé — squelette du Document Engine frontend | Le moteur commun est prêt pour les documents pilotes | Document Engine, Frontend | Squelette validé. Règle : tant que le renderer XLSX est un placeholder, aucun bouton Excel ne doit apparaître comme fonctionnel dans l’interface réelle. |
