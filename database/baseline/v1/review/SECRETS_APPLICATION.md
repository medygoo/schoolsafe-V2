# DB-04B-R1 — injection future des secrets de rôles

Statut : **DESIGN UNIQUEMENT — AUCUN SECRET CRÉÉ, LU OU MODIFIÉ**.

`01_roles.sql` ne contient aucun mot de passe. Il crée trois rôles `LOGIN`
inutilisables par les services tant que leurs secrets SCRAM n'ont pas été
injectés hors Git :

- `schoolsafe_migrator` ;
- `schoolsafe_api` ;
- `schoolsafe_worker`.

`schoolsafe_owner` et `schoolsafe_auditor` restent `NOLOGIN` dans le flux
runtime prévu ; aucun secret applicatif ne leur est attribué.

## Stockage et génération futurs

Après une autorisation distincte, root créera des fichiers `0600` dans :

```text
/etc/schoolsafe-db/test/secrets/schoolsafe_migrator_password
/etc/schoolsafe-db/test/secrets/schoolsafe_api_password
/etc/schoolsafe-db/test/secrets/schoolsafe_worker_password
```

Les valeurs seront générées par un CSPRNG, ne seront jamais écrites dans Git,
une variable d'environnement Docker, une ligne de commande, un rapport ou une
sortie terminal. Le backend et le worker recevront seulement leur propre
fichier en montage lecture seule. Le navigateur ne reçoit aucun identifiant
PostgreSQL et ne se connecte jamais directement à la base.

## Application future contrôlée

L'étape autorisée utilisera un conteneur client PostgreSQL éphémère, rattaché
uniquement à `schoolsafe-test-internal`, avec les quatre fichiers secrets montés
en lecture seule. Le script fixe exécuté dans ce client :

1. lit le secret bootstrap et les trois secrets de rôles sans les afficher ;
2. désactive pour cette session le suivi/journal des commandes contenant les
   valeurs (`pg_stat_statements.track=none`, `log_min_duration_statement=-1`,
   `log_statement=none`) ;
3. exécute `ALTER ROLE ... PASSWORD` via une connexion administrative locale ;
4. vérifie uniquement que `pg_authid.rolpassword` porte le préfixe SCRAM pour
   les trois rôles, sans lire ni afficher les hash ;
5. se détruit avec `--rm` et ne conserve aucun secret.

La commande exacte d'application ne sera produite qu'après validation du
runbook final et avant exécution, afin d'éviter qu'une procédure non approuvée
devienne une autorisation implicite. Toute rotation suit le même canal. Aucun
secret PROD n'est prévu dans DB-04B-R1.
