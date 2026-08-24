# Catalogue documentaire transversal — SchoolSafe V2

> Source de vérité des documents créés, utilisés, imprimés, téléchargés ou prévus par SchoolSafe.
> Dernière mise à jour : session en cours — correction DOC-00.

## Légende des états

- **EXISTANT ET FONCTIONNEL** : document réellement généré/consulté dans l’application.
- **EXISTANT À CORRIGER** : document présent mais avec défaut fonctionnel ou technique à corriger.
- **PARTIEL** : implémentation incomplète (démo, données locales, manque backend ou manque export).
- **PRÉVU MAIS ABSENT** : mentionné dans le catalogue fonctionnel ou la navigation, mais non implémenté.
- **CANDIDAT À VALIDER** : document potentiellement utile, non prévu explicitement ; à décider.

## Légende des natures

- **DOCUMENT** : document officiel à valeur probante (reçu, bulletin, attestation, fiche de paie, etc.).
- **CARTE/BADGE** : support physique ou numérique d’identification (carte PVC, badge, QR).
- **FORMULAIRE** : écran de saisie structurée sans sortie documentaire directe.
- **EXPORT** : extraction de données vers un fichier (PDF, Excel, CSV, PNG).
- **REGISTRE/LISTE IMPRIMABLE** : liste ou tableau consultable, filtrable et potentiellement imprimable.

---

## 1. Finance / Comptabilité

| ID | Nature | Nom | Fonctionnalité source | Usage | Format | Qui le crée | Qui le consulte | Permission / portée ACCESS_LAW | Données école nécessaires | Données SchoolSafe nécessaires | Données contextuelles | État actuel | Besoin backend futur |
|----|--------|-----|----------------------|-------|--------|-------------|-----------------|--------------------------------|---------------------------|--------------------------------|----------------------|-------------|----------------------|
| DOC-FIN-001 | DOCUMENT | Reçu de paiement scolaire / Preuve de paiement | Encaissements + Registre des reçus | Générer, consulter, télécharger | PDF A5 (2 reçus sur une feuille A4 si impression papier) | Caisse (`finance.payment.record`) | Caisse, Finance, Admin, Direction, Parent (`own_children`) | `finance.receipt.read` scope `own_children` | Logo, nom, adresse, contacts, devise, compte bancaire | `fee_payments`, `student_fees`, `fee_structures`, `students`, `profiles`, `academic_years` | Mode, montant, référence, numéro de reçu, QR de vérification | EXISTANT ET FONCTIONNEL | Aucun — maintenir l’API existante |
| DOC-FIN-002 | DOCUMENT | Rapport de caisse journalier | Rapports de caisse + Clôture | Consulter, imprimer, télécharger | PDF A4 | Caisse / Admin (`finance.cash_register.close`) | Caisse, Direction, Finance, Admin | `finance.report.read` + `finance.cash_register.close` | Identité école | `fee_payments` du jour, `cash_register_closures` | Date, total par mode, par type de frais, écarts | EXISTANT ET FONCTIONNEL | Endpoint `/finance/reports/daily` déjà présent |
| DOC-FIN-003 | FORMULAIRE | Structure des frais | Configuration des frais | Consulter, créer, modifier, activer | Tableau HTML | Responsable financier / Admin (`finance.fee.manage`) | Finance, Admin | `finance.fee.read` / `finance.fee.manage` | Cycles actifs | `fee_structures` | Cycle, montant, devise, échéance, périodicité | EXISTANT ET FONCTIONNEL | Aucun |
| DOC-FIN-004 | REGISTRE/LISTE IMPRIMABLE | Journal de caisse | Encaissements | Consulter, filtrer | Tableau HTML | Caisse | Caisse, Finance, Admin, Direction | `finance.payment.record`, `finance.receipt.read` | Identité école | `fee_payments` | Reçu, élève, mode, montant, statut | EXISTANT ET FONCTIONNEL | Aucun |
| DOC-FIN-005 | REGISTRE/LISTE IMPRIMABLE | Soldes et impayés | Soldes | Consulter | Tableau HTML | Calculé depuis `student_fees` | Finance, Admin, Caisse ; Pédagogie (statut uniquement) | `finance.fee.read` / `finance.status.read` | — | `student_fees` | Attendu, payé, solde, statut | EXISTANT ET FONCTIONNEL | Aucun |
| DOC-FIN-006 | REGISTRE/LISTE IMPRIMABLE | Situation familiale (vue parent) | Ma famille | Consulter, télécharger reçus | Carte HTML + PDF reçus | Automatique par tuteur | Parent (`own_children`) | `finance.receipt.read` scope `own_children` | Logo école | `student_fees` + `fee_payments` filtrés par tuteur | Enfants rattachés, paiements, échéances | EXISTANT ET FONCTIONNEL | Connecter la vraie vue famille (BE-NEED-008) |
| DOC-FIN-007 | REGISTRE/LISTE IMPRIMABLE | Vue financière / KPI | Tableau de bord financier | Consulter | Tuiles + tableau HTML | Agrégation | Finance, Admin, Direction | `finance.report.read` / `reports.financial.read` | — | `student_fees`, `fee_payments` | Total attendu, payé, solde, taux recouvrement | EXISTANT ET FONCTIONNEL | Aucun |
| DOC-FIN-008 | DOCUMENT | Recettes / dépenses et pièces justificatives | Trésorerie | Consulter, inclure dans rapport PDF | Données locales (démo) | Non implémenté côté serveur | Finance, Admin | Non définie | — | Objet `expenses` local uniquement | Référence, date, libellé, montant, statut | PARTIEL | Créer table `expenses`, API et permissions |
| DOC-FIN-009 | REGISTRE/LISTE IMPRIMABLE | Plan comptable | Comptabilité | Consulter, gérer | Non défini | Comptable / Admin | Comptable, Finance, Admin | Non créée | — | Aucune table dédiée | — | PRÉVU MAIS ABSENT | Spécifier SYSCOHADA + modèle de données |
| DOC-FIN-010 | REGISTRE/LISTE IMPRIMABLE | Journal comptable | Comptabilité | Consulter, gérer | Non défini | Comptable / Admin | Comptable, Finance, Admin | Non créée | — | Aucune table dédiée | — | PRÉVU MAIS ABSENT | Spécifier SYSCOHADA + modèle de données |
| DOC-FIN-011 | REGISTRE/LISTE IMPRIMABLE | Grand livre | Comptabilité | Consulter, gérer | Non défini | Comptable / Admin | Comptable, Finance, Admin | Non créée | — | Aucune table dédiée | — | PRÉVU MAIS ABSENT | Spécifier SYSCOHADA + modèle de données |
| DOC-FIN-012 | DOCUMENT | Écritures comptables | Comptabilité | Consulter, gérer | Non défini | Comptable / Admin | Comptable, Finance, Admin | Non créée | — | Aucune table dédiée | — | PRÉVU MAIS ABSENT | Spécifier SYSCOHADA + modèle de données |
| DOC-FIN-013 | REGISTRE/LISTE IMPRIMABLE | Balance | Comptabilité | Consulter | Non défini | Comptable / Admin | Comptable, Finance, Admin | Non créée | — | Aucune table dédiée | — | PRÉVU MAIS ABSENT | Spécifier SYSCOHADA + modèle de données |
| DOC-FIN-014 | DOCUMENT | Rapprochements | Comptabilité | Consulter, gérer | Non défini | Comptable / Admin | Comptable, Finance, Admin | Non créée | — | Aucune table dédiée | — | PRÉVU MAIS ABSENT | Spécifier SYSCOHADA + modèle de données |
| DOC-FIN-015 | DOCUMENT | États financiers | Comptabilité | Consulter | PDF/Excel prévu | Système / Comptable | Direction, Comptable, Admin | Non créée | Identité école | Comptes, écritures | Bilan, compte de résultat | PRÉVU MAIS ABSENT | Spécifier SYSCOHADA + modèle de données |
| DOC-FIN-016 | EXPORT | Rapports SYSCOHADA | Comptabilité | Consulter, exporter | PDF/Excel prévu | Système / Comptable | Direction, Comptable, Admin | Non créée | Identité école | Écritures comptables | Règles SYSCOHADA | PRÉVU MAIS ABSENT | Spécifier règles avant codage |
| DOC-FIN-017 | EXPORT | Exports financiers Excel | Trésorerie | Télécharger | Excel | Finance / Comptable | Finance, Comptable, Admin | Non créée | — | Paiements, soldes, écritures | — | PRÉVU MAIS ABSENT | Définir gabarits et endpoints |
| DOC-FIN-018 | REGISTRE/LISTE IMPRIMABLE | Campagnes de contrôle des frais | Contrôle des frais par QR | Consulter, créer, publier | Liste HTML | Admin / Finance | Contrôleur assigné | `finance.control.read` / `finance.control.manage` | — | `fee_control_campaigns`, `fee_control_assignees`, `fee_structures` | Période, structure de frais, assignations | EXISTANT ET FONCTIONNEL | Aucun |
| DOC-FIN-019 | DOCUMENT | Résultat de scan de contrôle | Scan QR contrôle | Consulter résultat | Alerte HTML | Agent de contrôle | Opérateur, Direction | `finance.control.scan` | — | `fee_control_scans`, `student_fees` | Statut (OK, partiel, non réglé, exempté, anomalie) | EXISTANT À CORRIGER | Ne plus créer d’événement de sécurité `incident` à chaque scan |
| DOC-FIN-020 | REGISTRE/LISTE IMPRIMABLE | Historique des scans de contrôle | Contrôle des frais | Consulter | Liste HTML | Système | Direction, Finance | `finance.control.read` | — | `fee_control_scans` | Date, opérateur, résultat | EXISTANT ET FONCTIONNEL | Aucun |

---

## 2. Pédagogie

| ID | Nature | Nom | Fonctionnalité source | Usage | Format | Qui le crée | Qui le consulte | Permission / portée ACCESS_LAW | Données école nécessaires | Données SchoolSafe nécessaires | Données contextuelles | État actuel | Besoin backend futur |
|----|--------|-----|----------------------|-------|--------|-------------|-----------------|--------------------------------|---------------------------|--------------------------------|----------------------|-------------|----------------------|
| DOC-PED-001 | DOCUMENT | Devoir / Interrogation / Examen PDF | Devoirs et évaluations | Créer, consulter, télécharger, imprimer | PDF A4 | Enseignant, Responsable pédagogique (`pedagogy.assignment.manage`) | Enseignant, élève, parent (après publication) | `pedagogy.assignment.read` / `pedagogy.assignment.manage` | Logo, identité école | `assignments`, `subjects`, `classes` | Titre, classe, matière, langue, type, barème, coefficient, date, consignes, questions | EXISTANT ET FONCTIONNEL | Migrer dans Document Engine (candidat) |
| DOC-PED-002 | DOCUMENT | Bulletin scolaire continu | Bulletin continu | Consulter, préparer PDF | PDF A4 | Système après validation Direction | Parent, élève, Direction, Pédagogie | `pedagogy.grade.read`, `pedagogy.report.read` | Logo, identité école | `students`, `grades`, `periods`, `conduct` | Moyennes par période, matières, langues, conduite, position | EXISTANT À CORRIGER | Template PDF + validation période (BE-NEED-002) |
| DOC-PED-003 | REGISTRE/LISTE IMPRIMABLE | Palmarès / Classement mensuel | Palmarès | Consulter, calculer, publier | Interface web (pas d’export PDF) | Responsable pédagogique, Admin | Enseignant, parent (Top 10), Direction | `palmarques.read`, `palmarques.manage` | Logo, identité école | `rankings`, `students`, `grades`, `stars` | Moyennes mensuelles, classement, étoiles parents | EXISTANT ET FONCTIONNEL | Export PDF candidat |
| DOC-PED-004 | DOCUMENT | Relevé individuel épreuve certificative | Épreuves certificatives (ENAFEP/TENASOSP/EXETAT) | Consulter, télécharger PDF | PDF A4 | Système après validation | Parent, Admin, Chef d’établissement, Pédagogie, Secrétariat | Aucune permission certificative dédiée ; rôles + `pedagogy.grade.read` | Logo, identité école | `certification_candidates`, `classes` | Nom, classe, numéro, centre, option, jury, résultat | EXISTANT ET FONCTIONNEL | Définir permissions certificatives |
| DOC-PED-005 | EXPORT | Export résultats épreuves certificatives | Épreuves certificatives | Télécharger PDF | PDF A4 | Admin, Chef d’établissement, Pédagogie, Secrétariat | Mêmes créateurs | Rôles admin / school_head / pedagogy / secretary | Logo, identité école | `certification_candidates` | Liste filtrée, résultats, décisions | EXISTANT ET FONCTIONNEL | Définir permissions certificatives |
| DOC-PED-006 | FORMULAIRE | Cahier de préparation de l’enseignant | Cahier de préparation | Créer, consulter, modifier, supprimer | Interface web (pas d’export PDF) | Enseignant | Enseignant, Responsable pédagogique | `pedagogy.lesson-plan.read` / `pedagogy.lesson-plan.manage` | — | `lesson_plans`, `classes`, `subjects` | Titre, date, classe, matière, objectifs, déroulement | EXISTANT ET FONCTIONNEL | Export PDF candidat |
| DOC-PED-007 | DOCUMENT | Bilan / rapport de rattrapage pédagogique | Rattrapage pédagogique | Créer, consulter, valider, clôturer | Interface web (pas de PDF) | Enseignant, Pédagogie | Parent, enseignant, Direction | Non définie dans `shared/permissions.json` | — | `remediation_cases`, `students`, `subjects` | Élève, matières, moyenne, séances, présences, prix, bilan | PARTIEL | Backend dédié + permission rattrapage (BE-NEED-004/012) |
| DOC-PED-008 | EXPORT | Rapports / statistiques pédagogiques | Rapports et audit | Consulter, exporter PDF/Excel | PDF / Excel prévu | Système / Direction | Direction, Pédagogie | `pedagogy.report.read`, `pedagogy.report.manage` | Logo, identité école | `grades`, `attendance`, `students` | Indicateurs pédagogiques, résultats, absences | PRÉVU MAIS ABSENT | Générateur de rapports pédagogiques |
| DOC-PED-009 | FORMULAIRE | Matières | Organisation pédagogique | Consulter, gérer | Tableau HTML | Pédagogie / Admin | Enseignants, Pédagogie | `pedagogy.subject.read` / `pedagogy.subject.manage` | — | `subjects` | Nom, langue, coefficients | EXISTANT ET FONCTIONNEL | Aucun |
| DOC-PED-010 | REGISTRE/LISTE IMPRIMABLE | Cotations / notes | Évaluations | Saisir, publier | Tableau HTML | Enseignant | Enseignant, Pédagogie, Parent (`own_children`) | `pedagogy.grade.manage` / `pedagogy.grade.read` | — | `grades`, `assignments`, `students` | Notes, coefficients, publication | EXISTANT ET FONCTIONNEL | Aucun |

---

## 3. Sécurité / QR / Contrôle d’accès

| ID | Nature | Nom | Fonctionnalité source | Usage | Format | Qui le crée | Qui le consulte | Permission / portée ACCESS_LAW | Données école nécessaires | Données SchoolSafe nécessaires | Données contextuelles | État actuel | Besoin backend futur |
|----|--------|-----|----------------------|-------|--------|-------------|-----------------|--------------------------------|---------------------------|--------------------------------|----------------------|-------------|----------------------|
| DOC-SEC-001 | CARTE/BADGE | Carte élève SchoolSafe / Badge | Studio de cartes | Créer, aperçu, imprimer, télécharger PNG | Badge vertical 340×540 px ou carte PVC horizontale 560×353 px | Admin / Admissions (`cards.request.print`) | Personnel école, élève, parent (carte physique) | `cards.request.print` scope `school`, `school.student.read` | Logo, nom, adresse, téléphone, couleurs, patrimoine | `students`, `classes`, `guardians` | Nom, matricule, photo, date naissance, tuteurs, personnes autorisées | EXISTANT À CORRIGER | QR signé + création `student_cards` côté backend |
| DOC-SEC-002 | CARTE/BADGE | QR de scan sécurité (entrée/sortie/incident) | Module Sécurité | Imprimer sur carte, scanner | QR code `schoolsafe://card/<number>/<signature>` | Émission de carte sécurisée | Agent de contrôle d’accès, Direction | `security.scan` scope `assigned_portal` | — | `student_cards`, secrets HMAC | Numéro de carte signé, élève, portail | PARTIEL | Exposer API de création de carte signée |
| DOC-SEC-003 | REGISTRE/LISTE IMPRIMABLE | Historique des événements de sécurité | Sécurité | Consulter, filtrer | API JSON / liste HTML | Système à chaque scan | Direction, Sécurité | `security.events.read` | — | `security_events` | Type, décision, élève, carte, portail, opérateur, motif | EXISTANT ET FONCTIONNEL | Interface dédiée de liste (FE-SEC-005) |
| DOC-SEC-004 | REGISTRE/LISTE IMPRIMABLE | Alertes de sécurité | Sécurité / Pilotage | Consulter, acquitter, résoudre | Alerte in-app | Moteur de sécurité | Admin, Direction, Sécurité | `pilotage.alerts.read`, `pilotage.alerts.manage` | — | `alert_rules`, `alerts` | Sévérité, titre, message, entité, metadata | EXISTANT ET FONCTIONNEL | Aucun |
| DOC-SEC-005 | FORMULAIRE | Lockdown / verrouillage global | Sécurité | Activer/désactiver, consulter statut | État booléen | Direction / Admin | Tous les utilisateurs connectés | `security.lockdown.manage` | — | `school_settings` | Timestamp, profil activateur | EXISTANT ET FONCTIONNEL | Aucun |
| DOC-SEC-006 | CARTE/BADGE | Fiche personnes autorisées (verso carte) | Studio de cartes | Imprimer (intégré carte), consulter | Face verso badge/carte PVC | Généré avec la carte | Agent sécurité, parent, école | `school.guardian.read`, `security.pickup.read` | Contacts école | `guardians`, `authorized_pickups` | Parent, personne autorisée, téléphones | EXISTANT ET FONCTIONNEL | Aucun |
| DOC-SEC-007 | EXPORT | Aperçu PNG de test de carte | Test carte | Générer aperçu, télécharger PNG | PNG (recto/verso) | Développeur / testeur | Test local | Aucune | Données test | Données test | — | EXISTANT ET FONCTIONNEL | Aucun |
| DOC-SEC-008 | DOCUMENT | Rapport d’incident sécurité | Sécurité | Créer, consulter, archiver | PDF/Formulaire prévu | Agent sécurité, Admin | Direction, Sécurité | Non définie | Logo école | `security_events`, `incidents` | Date, lieu, personnes, description, décision | CANDIDAT À VALIDER | Définir modèle incident + permission |
| DOC-SEC-009 | EXPORT | Registre des entrées/sorties | Sécurité | Consulter, exporter | PDF/Excel prévu | Système | Direction, Sécurité | `security.events.read` | Logo école | `security_events` | Période, filtres | CANDIDAT À VALIDER | Endpoint d’export |

---

## 4. École / Administration

| ID | Nature | Nom | Fonctionnalité source | Usage | Format | Qui le crée | Qui le consulte | Permission / portée ACCESS_LAW | Données école nécessaires | Données SchoolSafe nécessaires | Données contextuelles | État actuel | Besoin backend futur |
|----|--------|-----|----------------------|-------|--------|-------------|-----------------|--------------------------------|---------------------------|--------------------------------|----------------------|-------------|----------------------|
| DOC-ADM-001 | FORMULAIRE | Fiche d’identité de l’école | Configuration École | Créer, modifier, consulter | Formulaire web | Administrateur principal (`school.manage`) | Admin, Chef d’établissement | `school.manage` | Nom, nom EN, nom légal, type, code agrément, devise, motto, banque, compte, tax ID, directeur, langue, coordonnées, couleurs, logo, pied de page | `schools`, `school_settings` | — | EXISTANT ET FONCTIONNEL | Aucun |
| DOC-ADM-002 | FORMULAIRE | Années scolaires | Configuration École | Créer, modifier, activer, consulter | Tableau web | Administrateur principal | Admin, Chef d’établissement | `school.manage` | — | `academic_years` | Libellé, début, fin, périodes, statut | EXISTANT ET FONCTIONNEL | Aucun |
| DOC-ADM-003 | FORMULAIRE | Cycles scolaires | Configuration École | Activer/désactiver, consulter | Tableau web | Administrateur principal | Admin, Chef d’établissement | `school.manage` | — | `school_cycles` | Maternelle, Primaire, Secondaire | EXISTANT ET FONCTIONNEL | Aucun |
| DOC-ADM-004 | REGISTRE/LISTE IMPRIMABLE | Liste du personnel (staff) | Gestion du personnel | Inviter, modifier rôles, activer, consulter | Tableau web + modal | Administrateur principal (`staff.manage`) | Admin, Chef d’établissement | `staff.manage` | — | `profiles`, `staff`, `roles` | Nom, email, téléphone, rôles, statut | EXISTANT ET FONCTIONNEL | Aucun |
| DOC-ADM-005 | FORMULAIRE | Fiche détail d’un membre du personnel | Gestion du personnel | Consulter | Modal web | Lecture automatique | Admin, Chef d’établissement | `staff.manage` | — | `profiles`, `staff` | Identité, rôles, scopes | EXISTANT ET FONCTIONNEL | Aucun |
| DOC-ADM-006 | REGISTRE/LISTE IMPRIMABLE | Liste des élèves par classe | École / Classes | Consulter, filtrer | Tableau web | Lecture automatique | Admin, Pédagogie, Enseignant (`assigned_classes`) | `school.student.read` scope `assigned_classes` | — | `students`, `classes` | Nom, matricule, classe, statut | PRÉVU MAIS ABSENT | Écran liste élèves (FE-SCH-005) |
| DOC-ADM-007 | FORMULAIRE | Dossier élève | Élèves | Consulter, modifier | Fiche web | Secrétariat, Admin | Admin, Secrétariat, Enseignant (`assigned_classes`), Parent (`own_children`) | `school.student.read` / `school.student.manage` | — | `students`, `classes`, `guardians` | Identité, classe, cycle, matricule, photo, documents | PRÉVU MAIS ABSENT | Fiche complète élève |
| DOC-ADM-008 | FORMULAIRE | Fiche d’inscription / préinscription | Admissions | Créer, modifier, valider | Formulaire web + PDF prévu | Secrétariat, Admissions | Admin, Secrétariat, Parent | Non définie | Logo école | `students`, `guardians`, `admissions` | Dossier candidat, pièces, classe souhaitée | PRÉVU MAIS ABSENT | Module admissions |
| DOC-ADM-009 | DOCUMENT | Attestation d’admission / certificat de scolarité | Admissions / Documents | Créer, imprimer, archiver, consulter | PDF A4 officiel | Responsable admissions, Secrétariat | Direction, parents, élèves | Non identifiée | Logo, identité école | `students`, `classes`, `academic_years` | Nom élève, classe, année, date | PRÉVU MAIS ABSENT | Template + permission |
| DOC-ADM-010 | EXPORT | Import massif d’élèves | Admissions / École | Importer | Excel/CSV | Admin, Secrétariat | Admin, Secrétariat | Non définie | — | Fichier import | Données brutes, détection doublons | PRÉVU MAIS ABSENT | API import + validation |

---

## 5. RH / Personnel

| ID | Nature | Nom | Fonctionnalité source | Usage | Format | Qui le crée | Qui le consulte | Permission / portée ACCESS_LAW | Données école nécessaires | Données SchoolSafe nécessaires | Données contextuelles | État actuel | Besoin backend futur |
|----|--------|-----|----------------------|-------|--------|-------------|-----------------|--------------------------------|---------------------------|--------------------------------|----------------------|-------------|----------------------|
| DOC-RH-001 | FORMULAIRE | Fiche personnel / contrat | Gestion du personnel | Créer, modifier, consulter | Fiche web + PDF prévu | Responsable RH | RH, Direction, intéressé | `staff.read` / `staff.manage` | Logo école | `staff`, `contracts`, `profiles` | Identité, rôles, contrat, affectations, absences | PRÉVU MAIS ABSENT | Module RH complet |
| DOC-RH-002 | REGISTRE/LISTE IMPRIMABLE | Fiche de présence du personnel | Temps et paie | Enregistrer, consulter | Liste web / fiche | Responsable RH | RH, Direction | `staff.attendance.read` | — | `staff_attendance`, `profiles` | Pointages, biométrie | PRÉVU MAIS ABSENT | Module pointage |
| DOC-RH-003 | DOCUMENT | Fiche de paie / bulletin de salaire | Rémunération | Créer, consulter, imprimer | PDF A4 | Responsable RH | Personnel concerné, RH, Direction | Non identifiée (prévue RH) | Logo, identité école | `staff`, `payroll` | Salaire, primes, avances, retenues, période | PRÉVU MAIS ABSENT | Spécifier paie + fiscalité |
| DOC-RH-004 | FORMULAIRE | Demandes d’absences et congés | RH | Créer, consulter, approuver | Formulaire web | Personnel, RH | Personnel, RH, Direction | Non définie | — | `staff`, `leave_requests` | Dates, motif, statut | CANDIDAT À VALIDER | Module congés |
| DOC-RH-005 | REGISTRE/LISTE IMPRIMABLE | Organigramme / affectations | RH | Consulter | Diagramme / liste | RH, Admin | Tous le personnel autorisé | `staff.read` | — | `staff`, `services` | Services, responsabilités | CANDIDAT À VALIDER | Module services |

---

## 6. Communication

| ID | Nature | Nom | Fonctionnalité source | Usage | Format | Qui le crée | Qui le consulte | Permission / portée ACCESS_LAW | Données école nécessaires | Données SchoolSafe nécessaires | Données contextuelles | État actuel | Besoin backend futur |
|----|--------|-----|----------------------|-------|--------|-------------|-----------------|--------------------------------|---------------------------|--------------------------------|----------------------|-------------|----------------------|
| DOC-COM-001 | FORMULAIRE | Message / notification | Messagerie | Envoyer, consulter | In-app / email / push | Direction, Secrétariat, Communication | Destinataires | `communication.message.send` | — | `notifications`, `profiles` | Expéditeur, destinataires, contenu, urgence | PRÉVU MAIS ABSENT | Module messagerie frontend |
| DOC-COM-002 | FORMULAIRE | Annonce | Publications | Créer, publier, consulter | Web / notification | Responsable communication | Public cible | `communication.announcement.manage` | — | `announcements` | Titre, contenu, langue, public cible, dates | PRÉVU MAIS ABSENT | Module annonces |
| DOC-COM-003 | DOCUMENT | Convocation parent | Communication / Secrétariat | Créer, envoyer, consulter | Notification / PDF | Secrétariat, Direction | Parents / destinataires | `communication.announcement.manage` / `communication.message.send` | Logo école | `guardians`, `students` | Destinataire, motif, date, heure | PRÉVU MAIS ABSENT | Template + envoi |
| DOC-COM-004 | FORMULAIRE | Événement / site public | Publication / WebSync | Créer, publier, consulter | Web / notification | Responsable communication | Communauté | `communication.announcement.manage` | — | `events`, `media` | Titre, date, description, galerie | PRÉVU MAIS ABSENT | Module site public |
| DOC-COM-005 | FORMULAIRE | Circuits d’approbation | Communication / Pilotage | Créer, suivre, valider | Flux in-app | Direction | Acteurs du circuit | `pilotage.approvals.read` / `pilotage.approvals.manage` | — | `approvals`, `profiles` | Demande, validateurs, statut | PRÉVU MAIS ABSENT | Module approvals |

---

## 7. Cantine

| ID | Nature | Nom | Fonctionnalité source | Usage | Format | Qui le crée | Qui le consulte | Permission / portée ACCESS_LAW | Données école nécessaires | Données SchoolSafe nécessaires | Données contextuelles | État actuel | Besoin backend futur |
|----|--------|-----|----------------------|-------|--------|-------------|-----------------|--------------------------------|---------------------------|--------------------------------|----------------------|-------------|----------------------|
| DOC-CAN-001 | FORMULAIRE | Menu | Service de cantine | Créer, consulter | Fiche web / liste | Responsable cantine | Personnel, parents | `canteen.manage` | — | `canteen_menus` | Date, repas, ingrédients | PRÉVU MAIS ABSENT | Module cantine |
| DOC-CAN-002 | REGISTRE/LISTE IMPRIMABLE | Liste des présences repas | Service de cantine | Enregistrer, consulter | Liste web | Responsable cantine | Personnel, parents | `canteen.manage` | — | `canteen_attendance`, `students` | Élève, date, présence, menu | PRÉVU MAIS ABSENT | Module cantine |
| DOC-CAN-003 | FORMULAIRE | Fiche allergies / bénéficiaires | Service de cantine | Signaler, consulter | Fiche web / alerte | Responsable cantine | Personnel, parents | `canteen.manage` | — | `students`, `medical_notes` | Élève, allergies, restrictions | PRÉVU MAIS ABSENT | Module cantine |
| DOC-CAN-004 | DOCUMENT | Facturation cantine | Cantine | Générer, consulter | PDF/Excel prévu | Responsable cantine | Direction, Finance, Parent | Non définie | Logo école | `canteen_attendance`, `canteen_prices` | Repas consommés, tarifs | CANDIDAT À VALIDER | Règles de facturation |

---

## 8. Infirmerie

| ID | Nature | Nom | Fonctionnalité source | Usage | Format | Qui le crée | Qui le consulte | Permission / portée ACCESS_LAW | Données école nécessaires | Données SchoolSafe nécessaires | Données contextuelles | État actuel | Besoin backend futur |
|----|--------|-----|----------------------|-------|--------|-------------|-----------------|--------------------------------|---------------------------|--------------------------------|----------------------|-------------|----------------------|
| DOC-INF-001 | FORMULAIRE | Fiche de passage infirmerie | Santé et urgences | Créer, consulter | Fiche web | Infirmier | Infirmier, Direction, parent concerné | `infirmary.manage` scope `own_children` pour parent | — | `students`, `infirmary_visits` | Élève, date, motif, soins prodigués | PRÉVU MAIS ABSENT | Module infirmerie |
| DOC-INF-002 | DOCUMENT | Fiche incident médical | Santé et urgences | Créer, consulter | Fiche web / rapport | Infirmier | Infirmier, Direction, parent concerné | `infirmary.manage` scope `own_children` pour parent | — | `students`, `medical_incidents` | Date, description, gravité, actions | PRÉVU MAIS ABSENT | Module infirmerie |
| DOC-INF-003 | FORMULAIRE | Dossier santé / allergies / traitements autorisés | Suivi médical | Mettre à jour, consulter | Fiche web | Infirmier | Infirmier, Direction, parent concerné | `infirmary.manage` / `own_children` | — | `students`, `medical_profiles` | Antécédents, allergies, traitements, contacts urgence | PRÉVU MAIS ABSENT | Module infirmerie |
| DOC-INF-004 | DOCUMENT | Certificat médical / autorisation de soins | Infirmerie | Archiver, consulter | PDF/Scan | Parent, Infirmier | Infirmier, Direction, parent | Non définie | — | `student_documents` | Document uploadé | CANDIDAT À VALIDER | Stockage R2 + permission |

---

## 9. Rapports et audit transversaux

| ID | Nature | Nom | Fonctionnalité source | Usage | Format | Qui le crée | Qui le consulte | Permission / portée ACCESS_LAW | Données école nécessaires | Données SchoolSafe nécessaires | Données contextuelles | État actuel | Besoin backend futur |
|----|--------|-----|----------------------|-------|--------|-------------|-----------------|--------------------------------|---------------------------|--------------------------------|----------------------|-------------|----------------------|
| DOC-REP-001 | EXPORT | Rapports opérationnels | Rapports et audit | Consulter, exporter | PDF/Excel | Système / Direction | Direction, Admin | `reports.operational.read` | Logo école | Multi-sources | Période, filtres | PRÉVU MAIS ABSENT | Générateur rapports |
| DOC-REP-002 | EXPORT | Rapports financiers | Rapports et audit | Consulter, exporter | PDF/Excel | Système / Finance | Finance, Direction, Admin | `reports.financial.read` | Logo école | `fee_payments`, `student_fees` | Période, filtres | PRÉVU MAIS ABSENT | Générateur rapports |
| DOC-REP-003 | EXPORT | Rapports de sécurité | Rapports et audit | Consulter, exporter | PDF/Excel | Système / Sécurité | Direction, Sécurité | `reports.security.read` | Logo école | `security_events` | Période, filtres | PRÉVU MAIS ABSENT | Générateur rapports |
| DOC-REP-004 | EXPORT | Rapports RH | Rapports et audit | Consulter, exporter | PDF/Excel | Système / RH | RH, Direction | `reports.hr.read` | Logo école | `staff`, `attendance` | Période, filtres | PRÉVU MAIS ABSENT | Générateur rapports |
| DOC-REP-005 | REGISTRE/LISTE IMPRIMABLE | Journal d’audit | Administration / Audit | Consulter, exporter | Liste web / PDF | Système | Admin | `roles.manage` / audit | — | `audit_events` | Actor, action, timestamp, payload | PRÉVU MAIS ABSENT | Interface audit |

---

## Synthèse

### Nombre total de documents recensés

**72 documents** au total.

### Classement par état

| État | Nombre |
|------|--------|
| EXISTANT ET FONCTIONNEL | 26 |
| EXISTANT À CORRIGER | 3 |
| PARTIEL | 3 |
| PRÉVU MAIS ABSENT | 34 |
| CANDIDAT À VALIDER | 6 |

### Classement par nature

| Nature | Nombre |
|--------|--------|
| DOCUMENT | 19 |
| FORMULAIRE | 21 |
| REGISTRE/LISTE IMPRIMABLE | 19 |
| EXPORT | 10 |
| CARTE/BADGE | 3 |

### Classement par fonctionnalité

| Domaine | Nombre |
|---------|--------|
| Finance / Comptabilité | 20 |
| École / Administration | 10 |
| Pédagogie | 10 |
| Sécurité / QR / Cartes | 9 |
| Communication | 5 |
| RH / Personnel | 5 |
| Rapports et audit | 5 |
| Cantine | 4 |
| Infirmerie | 4 |

### Formats détectés

- **PDF A4** : bulletins, relevés certificatifs, fiches de paie, attestations, convocations, rapports divers.
- **PDF A5 (2 sur A4)** : reçus de paiement / preuves de paiement.
- **PDF A4 paysage / multi-colonnes** : listes, exports.
- **Carte PVC horizontale 560×353 px** : carte élève.
- **Badge vertical 340×540 px** : badge élève.
- **PNG** : aperçu carte.
- **QR code** : carte élève, contrôle des frais, scan sécurité.
- **Excel / CSV** : imports, exports financiers, rapports.
- **Interface web** : structures, fiches, listes, cahiers de préparation.

### Vérification des documents clés demandés

| Document clé | ID | Statut |
|--------------|----|--------|
| Preuves de paiement | DOC-FIN-001 | EXISTANT ET FONCTIONNEL (format A5 corrigé) |
| Fiches de paie | DOC-RH-003 | PRÉVU MAIS ABSENT |
| Bulletins | DOC-PED-002 | EXISTANT À CORRIGER (PDF non généré) |
| Devoirs | DOC-PED-001 | EXISTANT ET FONCTIONNEL |
| Cartes / Badges | DOC-SEC-001 | EXISTANT À CORRIGER (QR non signé) |
| Dossiers / Fiches élèves | DOC-ADM-007 | PRÉVU MAIS ABSENT |

### Documents existants et fonctionnels (26)

- Reçu de paiement / Preuve de paiement PDF (A5)
- Rapport de caisse journalier PDF
- Structure des frais
- Journal de caisse
- Soldes et impayés
- Situation familiale parent
- Vue financière / KPI
- Campagnes de contrôle des frais
- Historique des scans de contrôle
- Devoir / Interrogation / Examen PDF
- Palmarès
- Relevé individuel épreuve certificative PDF
- Export résultats épreuves certificatives PDF
- Cahier de préparation de l’enseignant
- Matières
- Cotations / notes
- Historique des événements de sécurité
- Alertes de sécurité
- Lockdown
- Fiche personnes autorisées (verso carte)
- Aperçu PNG de test de carte
- Fiche d’identité de l’école
- Années scolaires
- Cycles scolaires
- Liste du personnel
- Fiche détail d’un membre du personnel

### Documents existants à corriger (3)

- Carte élève / Badge : QR non signé, non conforme au format attendu par le scan sécurité.
- Bulletin scolaire continu : bouton PDF sans génération réelle.
- Résultat de scan de contrôle des frais : crée abusivement un événement de sécurité `incident` à chaque scan.

### Documents partiels (3)

- Recettes / dépenses (données locales uniquement)
- Bilan / rapport de rattrapage pédagogique (démo sans backend)
- QR de scan sécurité signé (backend présent mais non branché à l’UI)

### Documents manquants (prévus) (34)

- Plan comptable, journal comptable, grand livre, écritures, balance, rapprochements, états financiers, rapports SYSCOHADA
- Exports financiers Excel
- Bulletin scolaire PDF officiel
- Rapports / statistiques pédagogiques
- Fiche d’inscription / préinscription, attestation d’admission, certificat de scolarité
- Liste élèves par classe, dossier élève complet
- Import massif d’élèves
- Fiche personnel / contrat, fiche de présence, fiche de paie
- Messages, annonces, convocations, événements / site public, circuits d’approbation
- Menus cantine, présences repas, fiches allergies
- Fiches infirmerie, incidents médicaux, dossier santé
- Rapports opérationnels, financiers, sécurité, RH, journal d’audit

### Candidats proposés à validation (6)

- DOC-SEC-008 : Rapport d’incident sécurité PDF
- DOC-SEC-009 : Registre des entrées/sorties PDF/Excel
- DOC-RH-004 : Demandes d’absences et congés
- DOC-RH-005 : Organigramme / affectations
- DOC-CAN-004 : Facturation cantine
- DOC-INF-004 : Certificat médical / autorisation de soins

---

## Notes transversales

- Le moteur de documents `app/modules/document-engine/` ne contient actuellement qu’un seul template : `receipt-template.js`.
- Les PDF pédagogiques existants (devoirs, épreuves certificatives) sont générés inline dans `app/app.js`, sans réutilisation du Document Engine.
- Plusieurs permissions existent dans `shared/permissions.json` sans module attaché : `staff.read`, `staff.attendance.read`, `canteen.manage`, `infirmary.manage`, `communication.announcement.manage`, `communication.message.send`.
- Les permissions spécifiques admissions, attestations, certificats, convocations et paie n’existent pas encore.
