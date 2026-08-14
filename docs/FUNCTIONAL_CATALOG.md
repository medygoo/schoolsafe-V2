# Catalogue fonctionnel SchoolSafe V2

Ce document est la liste de contrôle fonctionnelle de SchoolSafe V2. Une fonction n'est considérée comme livrée que si son écran, ses règles de rôle, ses états, ses erreurs et ses tests sont présents. Un simple bouton ou un test frontend ne prouve aucun déploiement backend.

## Règles de classement

- Une instance SchoolSafe représente une seule école isolée.
- L'école n'est jamais un sélecteur de périmètre dans l'application.
- Accès effectif : rôle -> branche -> groupe métier -> fonction -> action -> vue de données -> périmètre.
- Le système historique de production des cartes reste intact et sera raccordé par contrat.
- Aucun raccordement VPS, Supabase, base, RLS, migration, sécurité ou sauvegarde sans analyse d'impact et autorisation explicite.

## Identité et accès

- Connexion séparée par e-mail ou numéro de téléphone.
- Récupération et première connexion, avec canal de secours administré.
- Administrateur principal et attribution des rôles.
- Chef d'établissement.
- Responsable pédagogique, qui remplace l'ancien nom Direction 2.
- Permissions de consultation, création, modification, validation, impression et export.
- Vues de données : statut uniquement, lecture détaillée, opération autorisée ou administration.
- Aucun héritage implicite entre fonctions voisines : chaque fonction est autorisée ou refusée indépendamment.
- Périmètres par cycle, classe, matière, service, portail ou enfants rattachés.
- Audit des connexions, attributions et actions sensibles.

## Élèves et familles

- Préinscriptions, admissions, inscriptions et réinscriptions.
- Dossier élève, matricule, classe, cycle et statut scolaire.
- Parent ou responsable légal principal.
- Autres responsables et personnes autorisées à récupérer l'enfant.
- Import massif contrôlé et détection des doublons.
- Documents privés dans R2 et séparation stricte des données publiques.
- Carte ou badge élève : sous-système historique protégé.

## Sécurité et contrôle d'accès

- Scanner un QR.
- Enregistrer une entrée et une sortie.
- Préparer une sortie.
- Vérifier l'identité et les personnes autorisées.
- Autoriser, refuser et confirmer une sortie.
- Voir les élèves actuellement dans l'école.
- Voir les sorties en attente.
- Alertes, anomalies et incidents.
- Historique des passages et recherche.

## Pédagogie

- Cycles Maternelle, Primaire, Secondaire et Humanités.
- Classes, matières, affectations et emplois du temps.
- Présences élèves, absences, retards et justifications.
- Devoirs, remises et corrections.
- Cahier de préparation de l'enseignant.
- Évaluations, notes, coefficients, moyennes et validation.
- Bulletins, palmarès et publication des résultats.
- Rattrapage pédagogique et suivi individuel.
- TENAFEP ou ENAFEP et EXETAT : règles à confirmer avant implémentation.

## Frais, caisse et comptabilité

- Structure des frais, échéances et remises autorisées.
- Frais scolaires, soldes, impayés et historique familial.
- Régularité scolaire partageable sous forme de statut sans montant ni historique financier.
- Encaissement, recherche du paiement et annulation contrôlée.
- Reçus officiels PDF avec logo de l'école.
- Ouverture, contrôle et clôture de caisse.
- Rapport de caisse et rapprochement.
- Recettes, dépenses et pièces justificatives.
- Comptabilité : journal, grand livre, balance, plan comptable et écritures.
- États financiers, rapports et exports Excel.
- Les règles SYSCOHADA et les validations comptables doivent être spécifiées avant codage.

## Personnel et ressources humaines

- Dossiers du personnel et contrats.
- Affectations, services et responsabilités.
- Présence du personnel et biométrie.
- Absences, congés et autorisations.
- Salaires, avances, primes et retenues.
- Appareils biométriques et règles de paie à spécifier avant raccordement.

## Vie scolaire et services

- Infirmerie, passages, incidents, allergies et traitements autorisés.
- Cantine, bénéficiaires, présences repas, menus et allergies.
- Les règles détaillées de facturation cantine restent à préciser.

## Communication

- Messagerie et conversations autorisées.
- Notifications dans et hors de l'application.
- Annonces, événements et convocations.
- Circuits d'approbation et niveaux d'urgence.
- Site public et synchronisation WebSync.

## Documents, rapports et plateforme

- Documents officiels uniquement en PDF avec logo de l'école.
- Exports de travail PDF et Excel selon la nature du document.
- Rapports pédagogiques, administratifs, financiers, RH et de sécurité.
- Historique et audit des actions.
- Interface français/anglais avec préférence conservée par utilisateur.
- Contenus rédigés en français, en anglais ou dans les deux langues, sans
  traduction payante obligatoire.
- Publication autorisée dans la langue d'origine lorsqu'une traduction manque,
  avec la mention « Traduction non disponible »; les alertes urgentes ne sont
  jamais retardées par une traduction.
- Parcours pédagogiques français et anglais séparés dans une même classe:
  matières, enseignants, devoirs, cotations et résultats propres à chaque langue,
  puis synthèse dans le bulletin annuel unique.
- Documents PDF français, anglais ou bilingues avec logo officiel de l'école et
  marque SchoolSafe by PRODELI SARLU.
- PWA installable avec cache de l'interface et reprise hors connexion.
- File locale priorisée: sécurité, messages, devoirs, présences, pédagogie, puis gestion.
- Synchronisation automatique sur Wi-Fi et données mobiles, avec contrôle manuel de secours.
- États visibles: synchronisé, hors connexion, en attente, en cours et à vérifier.
- Aucun reçu provisoire hors connexion; numéro et PDF seulement après confirmation du serveur.
- Correction autorisée et tracée des données métier, sans écrasement silencieux ni suppression de l'audit.
- Documents R2 conservés dans l'architecture prévue.
- Séparation des données privées et du contenu du site public.

## Fonctions qui exigent une spécification avant implémentation

- Calculs officiels des moyennes, coefficients, bulletins et palmarès par cycle.
- TENAFEP ou ENAFEP et EXETAT.
- Règles SYSCOHADA, corrections et annulations comptables.
- Paie, avances, primes, retenues et fiscalité applicable.
- Synchronisation biométrique.
- Notifications SMS, WhatsApp et quotas des fournisseurs.
- Implémentation serveur des conflits, reprise hors ligne et sessions selon le contrat PWA validé.
- Facturation et stock éventuel de la cantine.
