# SchoolSafe V2 - Charte de construction

## Objectif

SchoolSafe V2 est un produit generique installe pour une seule ecole par instance.
Chaque ecole dispose de son VPS, de sa base, de son domaine, de son stockage et de
ses secrets. Une instance ne contient jamais plusieurs ecoles et ne propose aucun
selecteur d'ecole.

## Patrimoine protege

- L'application SchoolSafe actuellement publiee reste intacte.
- Le premier ecran bleu et l'experience visuelle animee des jeunes filles sont
  conserves comme signature de marque.
- Le systeme de production des cartes est branche par contrat; son comportement,
  son format, ses numeros, ses QR codes et ses regles ne sont pas reecrits.
- Les documents officiels telecharges ou imprimes sont des PDF portant le logo de
  l'ecole configuree.
- R2 reste le stockage cible des documents et medias jusqu'a decision contraire.

## Cycles configurables

Une ecole active un ou plusieurs cycles pendant l'installation:

1. Maternelle
2. Primaire
3. Secondaire et Humanites

Les modules communs restent disponibles pour toute ecole. Les fonctions
pedagogiques specialisees sont affichees uniquement lorsque leur cycle est actif.

## Profils de reference

- Administrateur principal
- Chef d'etablissement
- Responsable pedagogique
- Responsable administratif et admissions
- Secretaire scolaire
- Responsable financier
- Agent de caisse
- Comptable
- Responsable RH
- Enseignant
- Agent de controle d'acces
- Infirmier
- Responsable cantine
- Responsable communication et site
- Parent ou responsable legal

L'administrateur principal attribue des modeles de role, puis peut limiter les
modules, les actions et le perimetre de donnees. L'interface ne constitue jamais
une barriere de securite: l'autorite definitive devra etre appliquee cote serveur
et base de donnees apres analyse d'impact et autorisation explicite.

## Limites de cette premiere etape

La previsualisation utilise uniquement des donnees locales de demonstration. Elle
ne prouve aucun deploiement Supabase et n'ecrit dans aucun service distant. Toute
connexion au VPS, a Supabase, a la base, aux RLS, aux migrations, a la securite ou
aux sauvegardes exige d'abord une analyse d'impact presentee au proprietaire.
