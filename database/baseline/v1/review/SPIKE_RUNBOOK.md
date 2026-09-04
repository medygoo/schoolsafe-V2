# SPIKE RUNBOOK — review only, execution requires explicit human GO

Prérequis : DB-04C appliqué via scripts/run-from-zero-test.sh (procédure existante,
conteneur schoolsafe-postgres-test, base schoolsafe_test, port 5432 NON publié).

Le spike ne publie aucun port : il tourne dans un conteneur jetable attaché au
réseau interne schoolsafe-test-internal.

1. Depuis un terminal VPS autorisé root :
   docker run --rm --network schoolsafe-test-internal \
     -e PGHOST=schoolsafe-postgres-test -e PGPORT=5432 \
     -e PGDATABASE=schoolsafe_test -e PGUSER=schoolsafe_api \
     -e PGPASSWORD='<secret jamais commité>' \
     -e SCHOOLSAFE_SPIKE_CONFIRM=SPIKE_SCHOOLSAFE_TEST_ONLY \
     -v "$PWD/scripts:/spike:ro" -w /spike \
     node:20 node spike-baseline-context.mjs

2. Attendu : {"ok":true,"contextRejected":true,"accessDenied":true,"tableDenied":true}

3. Consigner la sortie dans docs/adr/ADR-001 (addendum « preuve du spike ») puis
   ratifier le point 2 (auth) de l'ADR.

Interdit : tout autre conteneur, toute autre base, toute publication de port,
toute donnée métier réelle.
