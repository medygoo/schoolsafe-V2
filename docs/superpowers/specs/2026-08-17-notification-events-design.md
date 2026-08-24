> **Spec for:** Partie A — Fondations techniques : événements et notifications  
> **Date:** 17 août 2026  
> **Status:** Approuvé par l'utilisateur  
> **Next step:** `superpowers:writing-plans`

# Design — Système d'événements et notifications SchoolSafe V2

## Goal

Découpler les modules métiers (Sécurité QR, Finance, Pédagogie) des fournisseurs de notification (email, SMS, Push) en introduisant une file d'événements internes (`system_events`) et un `NotificationService` central.

## Scope (Phase A)

Cette spec couvre uniquement les notifications déclenchées par les **événements de sécurité QR** :

- `STUDENT_ENTERED` — un élève entre à l'école.
- `STUDENT_EXITED` — un élève sort avec une personne autorisée.
- `UNAUTHORIZED_EXIT_ATTEMPT` — tentative de sortie non autorisée.
- `LOCKDOWN_ACTIVATED` — la Direction active le mode lockdown.

Les événements Finance et Pédagogie seront branchés plus tard en réutilisant la même infrastructure.

## Architecture

```
Scan QR
  ↓
SecurityService enregistre l'événement métier
  ↓
EventService.emit({ type, schoolId, entityType, entityId, payload })
  ↓
system_events (INSERT, status = 'pending')
  ↓
NotificationDispatcher.dispatch(event)
  ↓
Charge notification_templates (event_type × channel × language)
  ↓
Pour chaque destinataire (tuteurs de l'élève) :
  ├─ notificationService.queue(EMAIL)   → ZohoMailProvider (principal)
  │                                        → BrevoEmailProvider (fallback)
  ├─ notificationService.queue(IN_APP)  → InAppProvider
  └─ notificationService.queue(PUSH)    → WebPushProvider
```

## Canaux et providers

| Canal | Provider principal | Fallback | Fichier serveur |
|---|---|---|---|
| `EMAIL` | ZohoMail | Brevo | `server/src/notifications/providers/zoho.ts` + `brevo.ts` |
| `IN_APP` | Internal | — | `server/src/notifications/providers/in-app.ts` |
| `PUSH` | Web Push (VAPID) | — | `server/src/notifications/providers/push.ts` |

## Destinataires

- Parents/tuteurs de l'élève concerné (`student_guardians` avec `is_authorized_pickup = true` ou rôle parent).
- Le personnel de sécurité pour `UNAUTHORIZED_EXIT_ATTEMPT` et `LOCKDOWN_ACTIVATED` (ajout futur, hors scope Phase A).

## Tables utilisées

- `system_events` : file d'événements métiers.
- `notifications` : file de notifications sortantes avec statut.
- `notification_templates` : templates paramétrables par événement, canal et langue.
- `data_retention_policies` : durée de conservation des événements/notification attempts.

## Comportement synchrone (Phase A)

Le traitement est **synchrone** pour commencer :

1. Le scan QR effectue le commit métier.
2. `EventService.emit()` insère dans `system_events`.
3. Le dispatcher est appelé immédiatement.
4. Chaque notification est mise en file (`notifications.status = 'PENDING'`).
5. Les providers synchrones (ZohoMail, Brevo, Web Push) sont appelés.
6. Le statut passe à `SENT`, `FAILED` ou `DELIVERED`.

> L'objectif métier (entrée/sortie) reste validé même si une notification échoue.

## Gestion des échecs

- **ZohoMail** : si l'envoi échoue, retry 1 fois puis fallback sur Brevo.
- **Brevo** : si l'envoi échoue, `status = 'FAILED'`, `retry_count` incrémenté, retry ultérieur possible.
- **Web Push** : si l'abonnement est expiré/invalide, marquer `FAILED` et optionnellement supprimer le subscription.
- **In-app** : ne peut pas échouer techniquement (simple INSERT).

## Variables de templates

Exemple pour `STUDENT_ENTERED` :

```json
{
  "parent_name": "Marie Kabamba",
  "student_name": "Grâce Kabamba",
  "time": "07:22",
  "date": "17/08/2026"
}
```

## Sécurité

- Aucune clé API (ZohoMail, Brevo, VAPID) dans le frontend.
- Toutes les clés sont dans les variables d'environnement du serveur VPS.
- RLS sur `system_events`, `notifications`, `notification_templates`.

## Environnement requis

```env
ZOHO_MAIL_API_KEY=...
ZOHO_MAIL_SENDER_EMAIL=...
ZOHO_MAIL_SENDER_NAME=SchoolSafe
BREVO_API_KEY=...
BREVO_SENDER_EMAIL=...
VAPID_PRIVATE_KEY=...
VAPID_PUBLIC_KEY=...
```

## Tests attendus

1. `eventService.emit()` crée un `system_event` avec statut `pending`.
2. Le dispatcher crée les notifications `EMAIL`, `IN_APP`, `PUSH` pour chaque tuteur.
3. `NotificationService` appelle ZohoMail en premier.
4. Si ZohoMail échoue, Brevo est utilisé.
5. Si tous les providers échouent, la notification reste en `FAILED` mais l'événement métier est conservé.
6. Les templates par défaut existent pour les 4 événements de sécurité.

## Non-goals (hors scope Phase A)

- Traitement asynchrone par worker séparé.
- Notifications Finance et Pédagogie.
- Notifications SMS payantes.
- Centre de notifications in-app avancé (historique, badges).
- Suppression automatique des anciennes notifications (sera géré par `data_retention_policies` plus tard).

## Fichiers impactés

### Créations
- `server/src/events/types.ts`
- `server/src/events/service.ts`
- `server/src/notifications/types.ts`
- `server/src/notifications/service.ts`
- `server/src/notifications/dispatcher.ts`
- `server/src/notifications/providers/zoho.ts`
- `server/src/notifications/providers/brevo.ts`
- `server/src/notifications/providers/in-app.ts`
- `server/src/notifications/providers/push.ts`
- `server/src/push/subscriptions.ts`
- `server/tests/events/service.test.ts`
- `server/tests/notifications/service.test.ts`
- `server/tests/notifications/dispatcher.test.ts`

### Modifications
- `server/src/security/service.ts`
- `server/src/security/routes.ts`
- `server/src/config/env.ts`
- `server/src/index.ts`
- `server/src/app.ts`
- `app/sw.js` (service worker)
- `app/app.js`
- `app/index.html`

## Global Constraints

- Mono-école par instance.
- Pas de secrets dans le frontend.
- RLS activé sur toutes les tables exposées.
- `npm run typecheck && npm test` verts avant chaque commit.
- Français principal pour les templates.
