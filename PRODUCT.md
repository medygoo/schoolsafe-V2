# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

SchoolSafe V2 est utilisé par le personnel d'une seule école et les parents/responsables légaux des élèves. Les profils de référence sont :

- Administrateur principal
- Chef d'établissement
- Responsable pédagogique
- Responsable administratif et admissions
- Secrétaire scolaire
- Responsable financier
- Agent de caisse
- Comptable
- Responsable RH
- Enseignant
- Agent de contrôle d'accès
- Infirmier
- Responsable cantine
- Responsable communication et site
- Parent ou responsable légal

Chaque profil reçoit un rôle modèle, puis l'administrateur principal peut affiner modules, actions et périmètre de données.

## Product Purpose

SchoolSafe V2 est une application de gestion scolaire intelligente pour une école isolée : présence par QR code, sécurité des enfants, suivi des résultats, communication parents-école, gestion financière et pilotage administratif. Elle rend visible en temps réel qui est dans l'école, qui peut sortir, et informe les parents des événements importants.

## Positioning

Une instance mono-école : une base, un domaine, un stockage, un backend. Aucun multi-tenant, aucun sélecteur d'école. La sécurité QR historique et le patrimoine visuel de SchoolSafe restent intacts ; V2 connecte et modernise sans remplacer.

## Operating Context

- Déployé en République démocratique du Congo, en français principalement, avec support anglais.
- Utilisé sur ordinateur (administration) et téléphone (agents de sécurité, enseignants, parents).
- Connexion variable ; la PWA doit fonctionner hors connexion pour les flux prioritaires (sécurité, messages, devoirs, présences, pédagogie, gestion).
- Les documents officiels sont des PDF avec le logo de l'école et la marque SchoolSafe by PRODELI SARLU.
- Les cycles configurables sont : Maternelle, Primaire, Secondaire et Humanités.

## Capabilities and Constraints

- Instance mono-école isolée.
- Authentification par e-mail ou par numéro de téléphone, séparément.
- Permissions explicites (deny override), sans héritage implicite.
- RLS activé sur toutes les tables exposées aux clients.
- Aucune clé secrète (service_role, Brevo, VAPID, QR, SMS) dans le frontend ni dans GitHub.
- PWA installable avec cache interface et synchronisation.
- Données réelles lues et écrites dans Supabase.
- Archivage historique vers Cloudflare D1 et sauvegardes vers R2.
- Notifications : in-app, email (Brevo), SMS (fournisseur futur), push.
- Documents PDF français, anglais ou bilingues.
- Synchronisation biométrique, règles SYSCOHADA, TENAFEP/ENAFEP/EXETAT, paie et facturation cantine : à spécifier avant implémentation.

## Brand Commitments

Patrimoine visuel verrouillé (cf. `docs/VISUAL_PATRIMONY.md` et `docs/DESIGN_SYSTEM.md`) :

- Logo SchoolSafe et lignes multicolores.
- Écran d'accueil bleu avec particules multicolores et textes historiques, mot pour mot.
- Slogan « Chaque enfant protégé, chaque parent informé ».
- Écran de portraits d'enfants alignés, sans vidéo, avec animation calibrée sur les visages.
- Rotation des photographies derrière l'écran de connexion ; formulaire transparent.
- Cube 3D animé dans la barre supérieure : bouton de menu, mouvement et place conservés.
- Volet latéral bleu profond sur ordinateur, replié derrière le cube sur téléphone.
- Grande surface de travail claire, bandeau de synthèse bleu, tuiles colorées par domaine (bleu, vert, violet, or).
- Police système nette et administrative.
- Aucun bloc purement décoratif ne réduit l'espace de travail.

## Evidence on Hand

- Application existante dans `app/` (PWA statique, splash bleu, écrans auth, workspace).
- Maquette validée le 13 août 2026 (`docs/DESIGN_SYSTEM.md`).
- Charte de construction `docs/V2_CHARTER.md`.
- Catalogue fonctionnel `docs/FUNCTIONAL_CATALOG.md`.
- Contrats visuels `docs/VISUAL_PATRIMONY.md` et `docs/CARDS_IMMUTABILITY.md`.
- Backend existant `server/` (Fastify) et migrations Supabase dans `supabase/migrations/`.

## Product Principles

1. **Sécurité avant fluidité** : l'autorité définitive reste côté serveur et base de données ; l'interface n'est jamais une barrière de sécurité.
2. **Un seul établissement par instance** : pas de multi-tenant, pas de sélecteur d'école.
3. **Patrimoine protégé** : l'écran bleu, le cube, les portraits et la production de cartes restent intacts.
4. **Vrai hors-ligne, vraie synchronisation** : les flux critiques doivent rester utilisables sans connexion, puis se synchroniser.
5. **Aucun secret exposé** : les clés sensibles vivent dans les secrets du cloud, jamais dans GitHub ni le frontend.

## Accessibility & Inclusion

- Interface en français principal, anglais secondaire.
- Support mobile et desktop.
- Navigation accessible par rôle et permissions ; les branches inutiles sont masquées.
