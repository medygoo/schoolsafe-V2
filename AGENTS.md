# SchoolSafe V2 — Règles agents

## Règle d’autorisation globale SchoolSafe (verrouillée)

Tous les modules SchoolSafe doivent appliquer le même modèle d’autorisation :

```
Utilisateur → Rôle → Permission → Portée → Exception
```

### Principes

- Une **permission** détermine **ce que** l’utilisateur peut faire.
- Une **portée** détermine **sur quelles données** il peut le faire.
- Un **DENY explicite** l’emporte toujours sur un ALLOW.
- Les rôles standards servent de modèles, mais l’**Administrateur principal** conserve le contrôle global et peut créer des **exceptions individuelles**.
- Toute modification de rôle, permission ou portée doit être **auditée**.

### Portées reconnées

- `own` : ses propres données.
- `own_children` : les données de ses enfants (parents/tuteurs).
- `assigned_classes` : les classes auxquelles l’utilisateur est affecté.
- `assigned_subjects` : les matières auxquelles l’utilisateur est affecté.
- `school` : toute l’école.
- D’autres portées peuvent être ajoutées si nécessaire, avec la même logique.

### Exemple

```
finance.receipts.view + scope=own_children
=> le Parent peut voir uniquement les reçus de ses propres enfants.
```

### Droits de l’Administrateur principal

L’Administrateur principal peut :

- modifier les permissions d’un **rôle complet** (ex. tous les Parents, tous les Enseignants) ;
- ajouter ou retirer une **permission à un utilisateur précis** ;
- définir la **portée** associée à une permission ou exception.

### Application obligatoire

Cette règle s’applique partout :

- Finance
- Pédagogie
- Sécurité / QR
- Élèves
- Parents / tuteurs
- Personnel / RH
- Documents
- Notifications
- Administration
- et tout futur module

### Vérification en profondeur

La sécurité ne doit pas reposer uniquement sur l’interface :

- **Interface** : masquer les actions non autorisées.
- **Cloudflare Worker / API** : vérifier les droits avant chaque action.
- **Supabase RLS** : appliquer les politiques row-level security correspondantes.

### Audit

Toute création, modification ou suppression de rôle, permission, portée ou exception individuelle doit générer un événement dans `public.audit_events` avec :

- `event_type` explicite (ex. `role.permission.granted`, `role.permission.revoked`, `user.exception.added`) ;
- l’`actor_profile_id` de l’administrateur ayant fait la modification ;
- le payload détaillé (rôle, permission, portée, utilisateur concerné, raison si fournie).

---

*Cette règle est verrouillée. Aucune implémentation ne peut l’ignorer ou la court-circuiter.*
