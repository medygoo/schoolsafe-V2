# Charte SchoolSafe V2

## Modèle de déploiement

SchoolSafe V2 est générique, mais chaque installation appartient à une seule école.
Chaque école dispose de son propre VPS, de sa base, de son domaine, de son stockage
et de ses secrets. Une instance ne contient jamais plusieurs écoles et ne propose
aucun sélecteur d'école.

## Cycles

- Maternelle
- Primaire
- Secondaire et Humanités

L'école active un ou plusieurs cycles. Les modules communs restent disponibles; les
fonctions pédagogiques spécialisées dépendent des cycles sélectionnés.

## Profils de référence

Administrateur principal, Chef d'établissement, Responsable pédagogique,
Responsable administratif et admissions, Secrétaire scolaire, Responsable
financier, Agent de caisse, Comptable, Responsable RH, Enseignant, Agent de
contrôle d'accès, Infirmier, Responsable cantine, Responsable communication et
site, Parent ou responsable légal.

L'Administrateur principal attribue les modules, les actions et le périmètre de
données. L'interface n'est jamais l'autorité de sécurité définitive.

## Frontières de sécurité

Aucune modification du VPS, de Supabase, de la base, des RLS, des migrations, de
la sécurité ou des sauvegardes ne peut être réalisée sans analyse d'impact et
autorisation explicite.
