# Besoins backend découverts pendant le chantier frontend

> Chaque besoin reçoit un ID. Ne pas développer pendant le chantier frontend.

| ID | Écran demandeur | Fonctionnalité | Données nécessaires | Format attendu | Actions possibles | Permissions nécessaires | Validations | Erreurs possibles | Temps réel | Dépendance frontend |
|----|-----------------|----------------|---------------------|----------------|-------------------|------------------------|-------------|-------------------|------------|---------------------|
| BE-NEED-001 | Dashboard Pilotage | Indicateurs réels par profil | KPIs adaptés au rôle/portée (effectifs, paiements, présences, alertes) | Tableau `{ kpis: [{ code, value, unit }] }` | Lecture | `pilotage.dashboard.read` + portée utilisateur | Code unique par indicateur | Indisponible | Non | `FE-DASH-001` |
| BE-NEED-002 | Bulletin continu | Bulletin officiel | Notes publiées, coefficients, périodes, conduite | Objet bulletin par élève/période | Générer, publier, archiver | `pedagogy.bulletin.read/manage` | Période validée | Données incomplètes | Non | `FE-PED-006` |
| BE-NEED-003 | Calculs et coefficients | Règles de moyennes | Poids par type d’évaluation, coefficients matière | Configuration école | Lire, modifier | `school.manage` | Cohérence 100 % | Règles invalides | Non | `FE-PED-007` |
| BE-NEED-004 | Rattrapage pédagogique | Sessions de remédiation | Élèves, matières, dates, objectifs | Liste + détail | CRUD | `pedagogy.remediation.manage` | — | — | Non | `FE-PED-008` |
| BE-NEED-005 | Attestations | Génération PDF | Identité école, élève, type d’attestation | Document PDF | Générer | `documents.generate` | Élève inscrit | — | Non | `FE-DOC-003` |
| BE-NEED-006 | Convocations | Génération et envoi | Élève, motif, date, parent | Document PDF + notification | Créer, envoyer, suivre accusé | `communication.convocation.manage` | Parent lié | — | Non | `FE-DOC-004` |
| BE-NEED-007 | Palmarès | Données réelles de classement | Entrées, étoiles, photos | Objet palmarès | Lire, étoiler | `palmarques.read` | Parent/enfant lié | — | Non | `FE-PALM-001/002/003` |
| BE-NEED-008 | Finance | Situation réelle famille | Soldes, paiements, frais | Objet famille par parent | Lire | `finance.receipt.read` / `school.guardian.read` | — | Indisponible | Non | `FE-FIN-007` |
| BE-NEED-009 | Finance | Dépenses et recettes | Transactions de caisse | Liste + détail | CRUD | `finance.expense.manage` | — | — | Non | `FE-FIN-009` |
| BE-NEED-010 | Safe Assistant | FAQ administrable | Questions/réponses, onboarding | Liste FAQ | Lire | Aucune | — | — | Non | `FE-SAFE-002` |
| BE-NEED-011 | Média library | Photos d’ambiance login/guardian | Images, positions desktop/mobile | Liste médias | Lire | `school.manage` | — | — | Non | `FE-AUTH-001` |
| BE-NEED-012 | Rattrapage pédagogique | Sessions de remédiation | Élèves, matières, dates, objectifs, finance 60/40 | Liste + détail | CRUD | `pedagogy.remediation.manage` | — | — | Non | `FE-PED-105` |
| BE-NEED-013 | Épreuves certificatives | Dossiers ENAFEP/TENASOSP/EXETAT | Candidats, phases, résultats | Liste + détail | CRUD | `pedagogy.certification.manage` | — | — | Non | `FE-PED-106` |
| BE-NEED-014 | Sécurité | Historique des scans | Événements entrée/sortie | Liste paginée | Lire | `security.event.read` | — | — | Non | `FE-SEC-005` |
| BE-NEED-015 | École | Liste élèves par classe | Élèves, classes, photos | Liste + détail | Lire | `school.student.read` | — | — | Non | `FE-SCH-005` |

| BE-NEED-016 | Dashboard Pilotage | Icônes des indicateurs | Code KPI → icône Lucide | Champ `icon` optionnel dans les KPIs | Lecture | `pilotage.dashboard.read` | — | — | Non | `FE-DASH-001` |
| BE-DOC-001 | Centre de documents | Historique officiel des documents | Documents, snapshots, métadonnées | Table `documents` | Lire, archiver | Selon type | — | — | Non | `FE-DOC-001` |
| BE-DOC-002 | Centre de documents | Numérotation atomique fiable | Reçus, bulletins, attestations | `document_number_sequences` | Générer | Selon type | Unicité | Conflit | Non | `FE-DOC-001` |
| BE-DOC-003 | Centre de documents | QR signé pour cartes et reçus | Secrets HMAC, `student_cards` | QR signé | Générer | `security.card.create` / `finance.receipt.read` | Clé secrète | — | Non | `FE-DOC-001` |
| BE-DOC-004 | Centre de documents | Stockage S3/R2 des documents officiels | Fichiers PDF signés | URL signée | Lire | Selon type | — | — | Non | `FE-DOC-001` |
| BE-DOC-005 | Centre de documents | Audit documentaire | Événements sensibles | `audit_events` | Écrire | Système | — | — | Non | `FE-DOC-001` |
| BE-DOC-006 | Centre de documents | Endpoint `/documents/generate` | `DocumentRequest` + `DocumentModel` | PDF/Excel/CSV/PNG | Générer | Selon type | Validation | Refus | Non | `FE-DOC-001` |
| BE-DOC-007 | Centre de documents | Permissions admissions, attestations, certificats | Admissions | Nouvelles permissions | Lire/Gérer | À définir | — | — | Non | `FE-DOC-001` |
| BE-DOC-008 | Centre de documents | Permissions paie / fiches de paie | RH | `payroll.read`, `payroll.manage` | Lire/Gérer | `staff.read` / `staff.manage` | — | — | Non | `FE-DOC-001` |
| BE-DOC-009 | Pédagogie — Devoirs | Upload officiel de fichiers PDF/photo | Fichier binaire + métadonnées | `multipart/form-data` ou storage signé | Uploader, stocker, rattacher au devoir | `pedagogy.assignment.manage` | Type MIME, taille, virus scan | Échec upload | Non | `FE-PED-002D` |
