# SchoolSafe V2 - Etat de coordination

## Etape 1 - Fondation visuelle

Etat: terminee et verifiee.

- ecran bleu conserve;
- textes historiques conserves;
- 25 particules colorees ascendantes;
- portraits d'enfants alignes, sans video;
- mouvement avant/arriere centre sur les visages;
- connexion en verre transparent;
- modes E-mail et Telephone separes;
- aucune erreur console observee pendant les controles visuels.

## Etape 2 - Configuration mono-ecole

Etat: terminee, validee et poussee sur GitHub.

- identite de l'ecole (nom francais et anglais);
- cycles Maternelle, Primaire, Secondaire et Humanites;
- annee scolaire;
- coordonnees officielles et parametres du site public;
- logo et couleurs;
- Administrateur principal avec mot de passe defini a la configuration;
- recapitulatif local + ecriture dans Supabase via l'API VPS;
- schema Supabase, RLS, API VPS et tests unitaires deployes;
- connexion par e-mail ou par telephone (resolu en e-mail cote VPS).

## Etape 3 - Shell des profils

Etat: premier shell construit.

- premier profil: Administrateur principal;
- cube 3D anime utilise comme bouton de menu;
- navigation modulaire;
- production de cartes affichee comme module protege et intact.

## Etape 4 - Fondation PWA hors connexion

Etat: interface locale construite et tests frontend termines.

- manifeste PWA et Service Worker;
- cache de l'application, des logos et des photos;
- file IndexedDB priorisee;
- etats Synchronise, Sans connexion, En cours et A verifier;
- reprise automatique au retour du reseau;
- devoirs, cotations, regles pedagogiques, caisse et permissions relies a la file locale;
- aucun recu provisoire: PDF disponible apres confirmation;
- controles ordinateur et telephone termines;
- redemarrage de l'application depuis le cache hors connexion verifie.

Limite: la confirmation est simulee localement. Aucun connecteur VPS ou Supabase
n'est deploye et aucun test frontend ne prouve un deploiement backend.

## Etape 5 - Fondation bilingue

Etat: interface locale construite et tests frontend termines.

- choix d'interface francais ou anglais conserve sur l'appareil;
- restauration fiable des libelles francais apres passage en anglais;
- selecteur independant pour les PDF francais, anglais ou bilingues;
- traduction des ecrans dynamiques Enseignant et Devoirs;
- contenu metier conserve dans sa langue d'origine;
- mention visible lorsque la traduction du contenu n'est pas disponible;
- devoir PDF anglais verifie visuellement sur deux pages;
- logo SchoolSafe et mention SchoolSafe by PRODELI SARLU sur le PDF;
- controles ordinateur et telephone termines sans debordement horizontal;
- tests `qa-i18n.cjs`, `qa-pwa.cjs` et `qa-smoke.cjs` reussis.

Limite: le catalogue linguistique et les PDF sont executes dans la maquette
locale. Aucun stockage de variantes linguistiques ni connecteur de site public
n'est deploye sur un serveur.

## Etape 6 - Architecture site et medias

Etat: regles fonctionnelles validees et verrouillees; aucun raccordement deploye.

- une ecole correspond a une instance et un VPS isoles;
- site public, application et API separes sur le VPS de l'ecole;
- site existant conserve ou modele SchoolSafe deploye sur le domaine de l'ecole;
- publication controlee de l'application vers le site, jamais de lecture publique directe;
- vraies photos autorisees avec rotation de cinq secondes et points focaux;
- niveaux Public, Classe protegee et Enfant prive;
- photo personnelle de l'enfant visible au parent uniquement apres authentification;
- R2 reste la cible des fichiers, sans modification actuelle de R2 ou de la base.

## Protections

Le SchoolSafe actuel n'a pas ete modifie. Aucun VPS, Supabase, base, RLS,
migration, secret, sauvegarde ou service de production n'a ete modifie.

## Installation locale permanente

Etat: integree et validee le 14 aout 2026.

- maquette copiee depuis l'espace temporaire vers le dossier officiel `app`;
- serveur local permanent configure sur `127.0.0.1:4175`;
- lanceur idempotent `app/start-schoolsafe.ps1`;
- controle de disponibilite `app/check-schoolsafe.ps1`;
- tests de permanence: 3 reussis sur 3;
- integrite: 20 fichiers fonctionnels copies avec empreintes SHA-256 identiques;
- serveur actif verifie depuis `app/server.mjs`.

Limite de verification: les suites historiques Playwright n'ont pas pu etre
relancees, car aucun navigateur compatible n'etait installe et le telechargement
Chromium a ete interrompu par une reinitialisation reseau. Leurs scripts ont ete
copies sans modification et leurs empreintes sont identiques a la maquette deja
validee.
