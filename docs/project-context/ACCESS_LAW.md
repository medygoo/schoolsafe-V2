# Loi d’accès — SchoolSafe V2

> Version permanente. S’applique à toutes les fonctionnalités actuelles et futures.

## 1. Autorité principale

**Administrateur principal = accès total à SchoolSafe.**

Il peut :

- accéder à toutes les fonctionnalités ;
- décider quelles fonctionnalités sont ouvertes aux autres profils ;
- décider quelles actions sont autorisées ;
- décider sur quelles données ces actions peuvent être exécutées ;
- ajouter ou retirer des exceptions particulières.

## 2. Tous les autres utilisateurs

Pour tout utilisateur autre que l’Administrateur principal :

**DENY PAR DÉFAUT.**

Une permission qui n’existe pas explicitement signifie :

**ACCÈS REFUSÉ.**

## 3. Formule officielle d’accès

Tout accès doit suivre cette structure :

**Fonctionnalité → Sous-fonctionnalité → Action → Portée → Condition → Exception**

Exemple :

**Finance → Reçus → Voir → own_children**

Le parent peut voir les reçus de ses propres enfants. Cela ne signifie jamais qu’il possède toute la Finance.

## 4. Règle essentielle

**OUVRIR UNE FONCTIONNALITÉ ≠ OUVRIR TOUTE LA FONCTIONNALITÉ.**

Exemple :

L’Administrateur principal peut ouvrir **Finance** au profil Parent, mais autoriser uniquement :

**Reçus → Voir → own_children**

Le Parent ne reçoit donc pas automatiquement :

- la caisse ;
- les paiements globaux ;
- les reçus des autres enfants ;
- les rapports financiers de l’école ;
- la configuration des frais ;
- les autres fonctions Finance.

## 5. Le rôle n’est pas la permission finale

Un rôle représente seulement **un ensemble de permissions de départ**.

Exemples :

- Parent
- Enseignant
- Gardien
- Caisse
- Direction pédagogique

Il est interdit de construire l’application uniquement avec :

```js
if (role === 'parent') { ... }
```

ou :

```js
if (role === 'teacher') { ... }
```

Le système doit vérifier les **permissions réelles**.

## 6. Structure d’une permission

Chaque permission doit avoir une clé unique.

Exemples :

- `finance.receipts.view`
- `finance.payments.create`
- `students.view`
- `attendance.create`
- `grades.update`
- `exits.scan`

Puis une portée.

Exemples :

- `own`
- `own_children`
- `assigned_classes`
- `assigned_subjects`
- `school`

## 7. Exemples par profil

### Parent

Configuration :

**Parent → Finance → Reçus → Voir → own_children**

Résultat :

✅ reçus de ses enfants  
❌ reçus des autres familles  
❌ caisse générale  
❌ finances globales  
❌ configuration des frais

### Enseignant

Configuration :

**Enseignant → Élèves → Voir → assigned_classes**

Résultat :

✅ élèves de ses classes  
❌ autres classes de l’école

On peut ensuite lui donner séparément :

**Notes → Créer → assigned_subjects**

sans lui donner automatiquement toutes les autres fonctions pédagogiques.

### Gardien

Configuration :

**QR → Scanner → assigned_scope**

Le Gardien peut recevoir uniquement les informations nécessaires à son contrôle. Il ne reçoit pas automatiquement l’accès aux finances, notes ou dossiers pédagogiques.

## 8. Exceptions

L’Administrateur principal peut créer une exception pour un utilisateur particulier.

Une exception peut :

- ajouter un droit ;
- retirer un droit ;
- réduire une portée.

Elle doit toujours être explicite et traçable.

## 9. Application technique

Cette même logique doit être utilisée partout :

- menus ;
- sous-menus ;
- dashboard ;
- pages ;
- routes ;
- cartes ;
- boutons ;
- formulaires ;
- tableaux ;
- documents ;
- données visibles ;
- actions ;
- exports ;
- fonctionnalités futures.

Il ne doit pas exister un système différent dans chaque module.

## 10. Source unique

Utiliser le système central existant :

`shared/permissions.json`

comme catalogue officiel des permissions.

Ne jamais créer plusieurs catalogues concurrents.

Le code doit disposer d’un moteur central capable de répondre à une question du type :

```js
canAccess(user, permission, scope)
```

Les différents modules interrogent ce moteur au lieu d’inventer leurs propres règles.

## 11. Frontend et backend

Pendant le chantier frontend :

le moteur détermine ce que l’utilisateur peut voir et utiliser dans l’interface.

Plus tard :

**le backend + API + RLS devront appliquer exactement la même loi.**

Le frontend seul ne constitue jamais une sécurité suffisante.

## 12. Loi anti-contournement

Cacher un bouton ne signifie pas sécuriser une fonctionnalité.

Un utilisateur ne doit pas pouvoir obtenir un droit interdit en :

- saisissant directement une URL ;
- appelant directement une route ;
- modifiant le navigateur ;
- manipulant le frontend.

La sécurité définitive sera également vérifiée côté serveur et base de données.

## 13. Questionnaire obligatoire

Avant toute nouvelle fonctionnalité, répondre aux 5 questions :

1. **Quelle fonctionnalité ?**
2. **Quelle action ?**
3. **Quelle permission ?**
4. **Quelle portée ?**
5. **Existe-t-il une condition ou une exception ?**

Si une réponse manque : **ne pas inventer l’accès**.
