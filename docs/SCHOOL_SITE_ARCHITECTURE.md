# Architecture Application + Site SchoolSafe

Statut: decision fonctionnelle validee et verrouillee le 14 aout 2026.

## Principe

Une instance SchoolSafe correspond à une seule école isolée et à son propre
VPS. Il n'existe pas de base multi-écoles partagée. Lors de la création de
l'école, l'administrateur relie son site existant ou déploie le modèle de site
SchoolSafe directement sur le domaine et le VPS de cette école.

Pour une école comme le Complexe Scolaire Le Sage, l'organisation cible est:

- `cslesage.com`: site public existant;
- `app.cslesage.com`: application privée SchoolSafe;
- `api.cslesage.com`: API privée de l'instance;
- un même VPS d'école, avec des services isolés et des déploiements séparés.

Le domaine `schoolsafe1.com` reste le site de référence de SchoolSafe et ne
sert pas de sous-domaine d'hébergement obligatoire pour les écoles.

L'application reste privée. Le site est public et ne reçoit que des contenus
explicitement validés.

## Circuit de publication

`Application privée -> Brouillon -> Validation -> Publication sur le site`

Ce circuit concerne:

- les actualités;
- les événements;
- les galeries de photos;
- le palmarès;
- les informations officielles de l'école.

Aucune donnée privée, note détaillée, situation financière ou information de
sécurité ne doit être synchronisée automatiquement vers le site. Le site public
ne lit jamais directement les données privées de l'application: il reçoit
uniquement une version publique explicitement validée.

## Bibliothèque média

Les fichiers seront conservés dans R2 après autorisation. La base ne conservera
que les métadonnées utiles:

- clé ou adresse du fichier;
- école implicite de l'instance;
- texte alternatif;
- point focal ordinateur X/Y;
- point focal téléphone X/Y;
- ordre;
- activation;
- destination privée ou publique;
- consentement de publication et période de validité;
- auteur, date et statut de validation.

Le deuxième écran de SchoolSafe utilise les médias actifs de la bibliothèque et
change la composition toutes les cinq secondes.

Chaque média appartient obligatoirement à l'un de ces niveaux de visibilité:

- **Public**: site de l'école et carrousel avant connexion, avec consentement;
- **Classe protégée**: parents de la classe et personnel expressément autorisé;
- **Enfant privé**: parents liés à l'enfant et personnel expressément autorisé.

Avant l'authentification, SchoolSafe ne connaît pas encore le parent: aucune
photo privée de son enfant ne doit donc apparaître sur l'écran de connexion.
Après authentification, le parent peut voir la photo de son enfant et les albums
pour lesquels il possède une autorisation. Une photo publique de l'école peut
apparaître avant connexion uniquement si sa publication a été validée.

## Protection des mineurs

Une photo d'enfant ne peut devenir publique sans consentement documenté. Le
retrait du consentement doit désactiver rapidement la publication et empêcher
une nouvelle synchronisation. Le palmarès public doit définir précisément les
identités et résultats autorisés avant implémentation.

## État actuel

La maquette utilise uniquement des fichiers locaux et des métadonnées frontend.
Aucun bucket R2, schéma de base, VPS, domaine ou site réel n'a été créé ou
modifié. Une analyse d'impact et une autorisation explicite sont obligatoires
avant le raccordement.
