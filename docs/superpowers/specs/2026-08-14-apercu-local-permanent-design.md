# Aperçu local permanent de SchoolSafe V2

## Objectif

Rendre la maquette SchoolSafe V2 indépendante des dossiers temporaires Codex et
permettre son redémarrage fiable sur `http://127.0.0.1:4175` depuis le dossier
officiel `app`.

## Périmètre

- Copier la dernière maquette validée dans `app` sans modifier son comportement.
- Conserver l'expérience visuelle, la PWA, le bilinguisme et les tests existants.
- Ajouter un lanceur Windows unique et un contrôle de disponibilité local.
- Documenter le démarrage et l'arrêt du serveur.
- Ne connecter aucun VPS, Supabase, base, RLS, migration, secret, sauvegarde ou
  service de production.
- Ne pas modifier le sous-système protégé de production des cartes.

## Architecture

Le dossier `app` devient la source permanente de la prévisualisation. Il contient
les fichiers statiques existants, le serveur HTTP local `server.mjs`, les tests QA
et les médias. Le serveur écoute uniquement sur `127.0.0.1` et utilise le port
`4175` par défaut afin de ne jamais exposer la maquette sur le réseau.

Un script PowerShell `start-schoolsafe.ps1` lance le serveur avec le runtime Node
fourni par Codex lorsqu'il est disponible, sinon avec `node` présent dans le PATH.
Il refuse de lancer une seconde instance si le port est déjà occupé et affiche
l'URL à ouvrir. Un script `check-schoolsafe.ps1` contrôle que le port répond sans
modifier les données de l'application.

## Flux de démarrage

1. L'utilisateur exécute `start-schoolsafe.ps1` depuis le dossier `app`.
2. Le script résout un exécutable Node valide.
3. Il vérifie que le port 4175 est libre ou déjà utilisé par un serveur actif.
4. Il lance `server.mjs` depuis `app` dans une fenêtre masquée.
5. Il attend que le port écoute, puis affiche l'adresse de SchoolSafe V2.
6. Le navigateur ouvre l'adresse sur action de l'utilisateur ou via le lien Codex.

## Gestion des erreurs

- Si Node est absent, le lanceur s'arrête avec un message indiquant comment le
  rendre disponible.
- Si le port 4175 est occupé, le lanceur ne tue aucun processus et signale le PID.
- Si le serveur ne démarre pas dans le délai prévu, le lanceur échoue clairement.
- Aucun fichier existant n'est supprimé pendant l'intégration.

## Tests et validation

- Un test de structure échoue avant l'intégration si les fichiers permanents ou
  les lanceurs sont absents.
- Les tests existants `qa-smoke.cjs`, `qa-pwa.cjs` et `qa-i18n.cjs` sont exécutés
  depuis le nouvel emplacement.
- Le lanceur est testé sur un port libre puis sur un port déjà occupé.
- La validation finale confirme que `127.0.0.1:4175` est en écoute depuis `app`.

## Sauvegarde et limites

Le dossier de travail actuel n'est pas un dépôt Git. L'intégration rend les
fichiers permanents dans le projet, mais la création d'un historique de versions
nécessitera ensuite l'initialisation explicite d'un dépôt Git ou un dépôt existant
fourni par le propriétaire.
