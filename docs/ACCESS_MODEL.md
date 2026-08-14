# Modele d'acces SchoolSafe V2

## Principe

L'interface et les autorisations sont construites a partir d'un catalogue unique:

`Role -> Branche -> Groupe metier -> Fonction -> Action -> Vue de donnees -> Perimetre`

L'ecole n'est pas un perimetre selectionnable dans l'application. Une instance
SchoolSafe V2 appartient deja a une seule ecole isolee. Cela interdit le retour
d'un systeme multi-ecoles dans une meme base ou une meme session.

## Couches

### 1. Role

Le role traduit le travail principal de la personne: Administrateur principal,
Chef d'etablissement, Responsable pedagogique, Enseignant, Agent de controle
d'acces, Agent de caisse, Parent ou responsable legal, etc.

### 2. Branche

Une branche est un grand domaine metier visible dans la navigation: Pilotage,
Ecole, Pedagogie, Securite et acces, Finances, Personnel, Communication,
Administration ou Rapports.

### 3. Groupe metier

Une branche est decoupee selon le rythme du travail. Exemple pour le controle
d'acces:

- Action immediate;
- Controle;
- Surveillance;
- Historique.

Cette couche evite d'afficher une grille uniforme de fonctions sans priorite.

### 4. Permission et action

L'acces a une branche ne donne pas automatiquement tous les pouvoirs. Les actions
sont autorisees separement: consulter, creer, modifier, approuver, scanner,
encaisser, imprimer, exporter, annuler ou administrer.

Exemple:

- Chef d'etablissement + Finances: consulter et imprimer les rapports;
- Agent de caisse + Finances: encaisser, rechercher et emettre un recu;
- Responsable financier + Finances: parametrer, superviser et cloturer;
- Agent de controle d'acces + Securite: scanner, autoriser ou refuser une sortie.

### 5. Vue de donnees

Une permission definit aussi les champs que la personne peut connaitre:

- statut uniquement;
- lecture detaillee;
- operation autorisee;
- administration.

Exemple: un Responsable pedagogique peut recevoir `Finances -> Regularite
scolaire -> Statut uniquement`. Pour ses classes ou cycles, il voit l'identite
scolaire de l'eleve et `En ordre`, `A regulariser` ou `Statut non disponible`.
Il ne recoit aucun montant, solde, paiement, recu, chiffre de caisse ou element
de tresorerie.

Cette regle s'applique a toutes les branches et a toutes les sous-branches, pas
seulement aux finances. Exemples:

- Personnel peut etre autorise sans Biometrie;
- Pedagogie peut autoriser Devoirs et Bulletins sans Cahier de preparation;
- Administration peut autoriser Documents sans Parametres ni Comptes et droits;
- Securite peut autoriser la consultation des passages sans autoriser une sortie.

Il n'existe aucune autorisation automatique par voisinage. Le role fournit un
modele initial, mais chaque fonction conserve son propre etat d'autorisation.

La vue de donnees doit etre appliquee avant la construction de la reponse
serveur. Masquer une colonne uniquement dans le frontend n'est pas une
protection suffisante.

### 6. Perimetre

Une permission est limitee a un contexte concret:

- classe ou groupe de classes;
- cycle d'enseignement;
- service administratif;
- portail ou point de controle;
- enfant rattache au responsable legal;
- periode scolaire.

Exemples dans une instance SchoolSafe:

- Agent de controle d'acces + portail principal;
- Enseignante + classe 4e A;
- Responsable pedagogique + cycle primaire;
- Parent + enfants explicitement rattaches.

## Autorite

Le catalogue pilote l'interface, mais ne constitue pas la securite definitive.
Les memes permissions et perimetres devront etre appliques cote serveur et dans
la base apres analyse d'impact et autorisation explicite. Aucun test frontend ne
prouve qu'une fonction Supabase ou une politique RLS est deployee.
