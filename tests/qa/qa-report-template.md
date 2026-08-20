# Rapport QA SchoolSafe V2 — {{date}}

## Résumé

- Profils testés : {{profile_count}} / 15
- Permissions testées : {{permission_count}} / 46
- Tests unitaires : {{unit_passed}} / {{unit_total}}
- Tests RLS : {{rls_passed}} / {{rls_total}}
- Tests intégration : {{integration_passed}} / {{integration_total}}
- Tests E2E : {{e2e_passed}} / {{e2e_total}}

## Écarts par priorité

### P0 — Bloquant pour le lancement

| Module | Fonction | Écart | Action corrective |
|--------|----------|-------|-------------------|
{{p0_rows}}

### P1 — À corriger avant production

| Module | Fonction | Écart | Action corrective |
|--------|----------|-------|-------------------|
{{p1_rows}}

### P2 — À planifier post-lancement

| Module | Fonction | Écart | Action corrective |
|--------|----------|-------|-------------------|
{{p2_rows}}

## Recommandation de GO/NO-GO

{{recommendation}}

## Notes complémentaires

- Ce rapport est généré automatiquement à partir des résultats des suites de tests.
- Les écarts P0 doivent être résolus avant tout GO/NO-GO positif.
- Les écarts P1 doivent être corrigés avant la mise en production.
- Les écarts P2 peuvent être planifiés pour les itérations suivantes.
