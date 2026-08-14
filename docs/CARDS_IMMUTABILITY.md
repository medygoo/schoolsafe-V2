# Contrat d'intangibilite - Cartes SchoolSafe

## Regle absolue

La production de cartes existante est un sous-systeme protege. SchoolSafe V2 ne
la remplace pas et ne la reimplemente pas. Elle la connecte au moyen d'un
adaptateur versionne uniquement apres validation de tests de contrat.

## Comportements a conserver a l'identique

- dimensions physiques et mise en page;
- logo et elements visuels officiels;
- numerotation, unicite, contenu et encodage des QR codes;
- emission individuelle et par classe;
- apercu, impression et reimpression;
- perte, revocation et remplacement;
- historique et tracabilite;
- compatibilite avec les scanners d'entree et de sortie;
- preparation et confirmation de sortie.

## Conditions avant branchement

1. Capturer des exemples de reference produits par le systeme actuel.
2. Documenter les entrees, sorties, erreurs et invariants.
3. Executer les memes cas sur l'adaptateur V2.
4. Comparer les PDF, QR codes, identifiants et evenements generes.
5. Obtenir une validation explicite avant toute activation reelle.

Une difference avec un resultat de reference est bloquante jusqu'a decision
explicite du proprietaire.
