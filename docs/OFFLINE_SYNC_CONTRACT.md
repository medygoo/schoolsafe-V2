# Contrat PWA et synchronisation SchoolSafe V2

## Portée validée

SchoolSafe est une PWA utilisable hors connexion par une personne déjà
authentifiée sur l'appareil. Les opérations sont conservées localement puis
reprises automatiquement sur Wi-Fi ou données mobiles.

Ordre de priorité:

1. scans, entrées, sorties et alertes de sécurité;
2. messages urgents, convocations et notifications;
3. devoirs, pièces jointes et cotations associées;
4. présences, biométrie et cantine;
5. notes et pédagogie;
6. finances, RH, rapports et administration.

## États visibles

- Synchronisé.
- Sans connexion, travail conservé sur l'appareil.
- Synchronisation en cours.
- Opérations en attente.
- Actions ou conflits à vérifier.

La synchronisation est automatique au retour du réseau, à la reprise de
l'application et, lorsque le navigateur le permet, en arrière-plan. Un bouton de
reprise manuelle reste disponible comme contrôle de secours.

## Reçus et documents

Une opération de caisse hors connexion ne produit aucun reçu provisoire. Le reçu
officiel, son numéro et le message destiné à la famille sont produits seulement
après confirmation du serveur. La prévisualisation locale simule cette
confirmation et l'indique explicitement; elle ne prouve aucun raccordement réel.

## Conflits et corrections

Une divergence ne remplace jamais silencieusement une donnée. Les versions sont
conservées et l'opération passe dans les actions à vérifier.

Toute donnée métier doit disposer d'un parcours autorisé de correction,
d'annulation, de restauration ou de création de nouvelle version. Les données
sensibles conservent la valeur avant/après, l'auteur, le rôle, l'appareil, la date
et le motif. Les journaux d'audit techniques ne sont pas modifiables.

## Durées hors connexion

- Administration, Caisse et RH: 24 heures.
- Enseignants et personnel: 72 heures.
- Parents: 7 jours sur leurs propres données.
- Agent de contrôle d'accès: 7 jours sur un appareil scolaire enregistré, dans le
  périmètre sécurité autorisé.

L'expiration ne supprime ni les données locales ni la file. Elle exige une
nouvelle authentification en ligne.

## Frontière actuelle

Le manifeste, le Service Worker, le cache, la file IndexedDB et l'interface de
reprise existent dans la prévisualisation séparée. Aucun VPS, Supabase, schéma,
RLS, migration, secret, sauvegarde ou service de production n'a été modifié. Le
connecteur serveur, le chiffrement local, les règles de session et l'autorité des
permissions devront faire l'objet d'une analyse d'impact et d'une autorisation
explicite avant implémentation.
