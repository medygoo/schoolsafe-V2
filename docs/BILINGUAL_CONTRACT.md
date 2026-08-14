# Contrat bilingue SchoolSafe V2

Ce contrat fixe le comportement français/anglais validé pour l'application, les
documents et les contenus scolaires. L'implémentation actuelle est une
prévisualisation frontend locale. Elle ne constitue ni un schéma de base de
données ni une preuve de déploiement serveur.

## Interface

- Chaque utilisateur choisit sa langue d'interface: français ou anglais.
- Le choix est conservé sur l'appareil et reste disponible hors connexion.
- Les codes internes, valeurs de permission et identifiants métier restent
  stables; seul le libellé présenté à l'utilisateur est traduit.
- Le passage de l'anglais au français restaure le libellé français d'origine,
  sans dépendre d'une traduction inverse ambiguë.

## Contenus rédigés

- Un auteur peut préparer un contenu en français, en anglais ou dans les deux
  langues.
- Une traduction manquante ne bloque jamais la publication.
- Le contenu d'origine reste visible avec la mention « Traduction non
  disponible ».
- Une alerte urgente est publiée immédiatement dans sa langue d'origine.
- SchoolSafe n'impose aucun service de traduction payant.

## Pédagogie bilingue

- Les enseignements français et anglais restent des parcours distincts dans
  une même classe.
- Chaque parcours conserve ses matières, devoirs, évaluations, cotations et
  enseignant affecté.
- Le bulletin annuel reste unique et présente les résultats séparés par langue,
  puis la synthèse générale selon les coefficients configurés.
- La Direction choisit le titulaire de la classe et configure les pondérations.
- Une troisième langue pourra utiliser la même structure sans modifier les
  règles des deux premières.

## Documents PDF

- L'utilisateur autorisé choisit un document français, anglais ou bilingue.
- Les libellés administratifs suivent la langue choisie.
- Un contenu rédigé dans une seule langue reste intact et porte un avertissement
  lorsque l'autre traduction n'existe pas.
- Chaque document officiel porte le logo officiel de l'école et la marque
  « SchoolSafe by PRODELI SARLU - www.schoolsafe1.com ».

## Hors connexion et site public

- La préférence de langue est conservée dans la PWA hors connexion.
- Les versions linguistiques rédigées sont des contenus distincts dans la file
  de synchronisation; aucune version ne doit écraser l'autre.
- Le futur site public de l'école devra lire les mêmes contenus validés, avec la
  même règle de repli vers le texte d'origine.

## Limite serveur

Le futur stockage des variantes linguistiques, les permissions de publication,
la synchronisation avec le site et les politiques d'accès devront faire l'objet
d'une analyse d'impact. Aucun changement VPS, Supabase, base de données, RLS,
migration, sécurité ou sauvegarde ne peut être appliqué sans autorisation
explicite.
