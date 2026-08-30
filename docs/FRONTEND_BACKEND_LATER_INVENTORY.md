# Inventaire final frontend → backend à reprendre

Gel de référence : branche `work/phase-m-frontend-freeze`, base M8 `fc4a34846d4a867caeb73c3f33b8eb94c06211e5`.

Ce document inventorie l’état réellement visible dans le frontend B→L. Il ne définit ni API, ni table, ni permission. Le catalogue officiel demeure `shared/permissions.json` et le moteur demeure `app/modules/core/access.js`.

## Légende et ordre de reprise

- **BACKEND_LATER** : la surface existe en démonstration, en lecture, en aperçu ou en brouillon local, mais la projection, la persistance, la décision ou la sortie officielle manque côté serveur.
- **PERMISSION_FUTURE** : une action officielle exige un droit dédié qui n’existe pas dans le catalogue actuel. Son code reste **non défini** ; une future phase Access_Law devra le concevoir, l’auditer et l’ajouter explicitement.
- **SAFE_CONTROL_LATER** : l’adaptateur de préparation de carte existe, mais la transmission et l’impression réelles restent dans SchoolSafe Control ; le sous-système Cartes demeure intact.
- **JASPE_3D_LATER** : aucune interaction, ressource ou bibliothèque 3D Jaspe n’a commencé. Il s’agit d’une phase séparée après le gel frontend.
- **P0** : sécurité, autorisation, intégrité ou séparation des données à traiter avant toute activation live.
- **P1** : projection et persistance métier nécessaires au premier parcours live.
- **P2** : sortie officielle, reporting, intégration ou automatisation ultérieure.
- **P3** : évolution séparée, sans dépendance pour activer le métier actuel.

Toutes les reprises doivent conserver la règle : utilisateur → rôle → permission → portée → exception, avec DENY explicite prioritaire, contrôle serveur et audit des mutations sensibles.

## Élèves

Modules frontend sources pour toutes les lignes ci-dessous : `app/modules/school/`.

| Marqueur | Fonctionnalité | État frontend actuel | Permission existante ou future | Dépendance backend | Priorité | Sécurité |
|---|---|---|---|---|---|---|
| BACKEND_LATER · PERMISSION_FUTURE | Activation réelle et transitions du dossier | Vérification, aperçu de confirmation et opérations de cycle en préparation locale ; le dossier officiel reste inchangé. | Lecture : `school.student.read`. Activation/transfert/archivage officiels : code non défini dans le catalogue actuel. | Reprendre le workflow backend amorcé en B1 : décision atomique, statut officiel, historique et audit. | P0 | Exclure les élèves draft des flux actifs ; revalider permission, portée, condition et DENY côté serveur. |
| BACKEND_LATER | Projections live du dossier, de la famille et du parcours | Les sessions live sans projection affichent « DONNÉES INDISPONIBLES » et ne réutilisent aucune fixture. | `school.student.read`, `school.guardian.read`, `school.class.read` selon le contexte effectif. | Projection filtrée de l’élève, des tuteurs, inscriptions, classes et historique. | P0 | Ne retourner que les lignes compatibles avec la portée effective ; aucune donnée sensible dans le stockage navigateur. |
| BACKEND_LATER · PERMISSION_FUTURE | Années, niveaux et classes officiels | Création/modification conservée en brouillons locaux distincts ; les classes sources restent intactes. | Lecture : `school.class.read`. Mutation de structure : code non défini dans le catalogue actuel. | Persistance versionnée de la structure académique, validations et audit. | P1 | Une garde frontend de démonstration ne devient jamais une autorisation serveur. |

## Parent / tuteur

Module frontend source pour toutes les lignes ci-dessous : `app/modules/parent/parent-portal-demo.js`.

| Marqueur | Fonctionnalité | État frontend actuel | Permission existante ou future | Dépendance backend | Priorité | Sécurité |
|---|---|---|---|---|---|---|
| BACKEND_LATER | Données live des enfants liés | Portail démo limité aux enfants liés ; une session live sans projection `own_children` ne montre aucun enfant fictif. | `school.student.read` avec portée effective `own_children`; autres panneaux selon leur permission propre. | Projection des identifiants enfants et des données autorisées par sous-fonctionnalité. | P0 | Le lien familial doit être établi côté serveur ; un identifiant fourni par le client ne suffit pas. |
| BACKEND_LATER · PERMISSION_FUTURE | Historique messages, convocations et notifications | Brouillon de message local possible lorsque autorisé ; aucun historique réel ni envoi. | Brouillon : `communication.message.send` avec portée compatible. Lecture d’historique, convocation et envoi de notification : codes non définis. | Chargement paginé, envoi, accusés et traçabilité. | P0 | Message ≠ convocation ≠ notification ; ne jamais déduire un droit de l’un vers l’autre. |
| BACKEND_LATER | Documents live de l’enfant | Les aperçus autorisés restent frontend ; aucun document confidentiel live n’est inventé ni archivé localement. | Permission du type documentaire, notamment `finance.receipt.read`, `pedagogy.report.read`, `file.download`, avec portée `own_children` ou `own` effective. | Modèles officiels, données live, stockage définitif, numérotation et historique. | P1 | Vérifier permission + portée + enfant lié + contexte avant génération et téléchargement. |

## Pédagogie

Modules frontend sources pour toutes les lignes ci-dessous : `app/modules/pedagogy/`, notamment `teacher-pedagogy-demo.js`.

| Marqueur | Fonctionnalité | État frontend actuel | Permission existante ou future | Dépendance backend | Priorité | Sécurité |
|---|---|---|---|---|---|---|
| BACKEND_LATER | Devoirs, remises et corrections live | Devoirs et pièces sont préparés localement ; remises et corrections serveur restent indisponibles. | `pedagogy.assignment.read`, `pedagogy.assignment.manage` avec `assigned_classes`; matière bornée par `pedagogy.subject.read`. | Publication, dépôt de fichiers, remises, corrections, historique et audit. | P1 | Contrôler classe et matière affectées ; analyser les fichiers côté serveur avant stockage. |
| BACKEND_LATER | Évaluations et notes live | Formulaires de démonstration et brouillons « NON PUBLIÉ » ; aucune note officielle. | `pedagogy.grade.read`, `pedagogy.grade.manage` avec portée compatible. | Persistance, verrouillage de période, publication et historique des corrections. | P0 | DENY prioritaire ; aucun élève hors `assigned_classes`, aucune matière hors `assigned_subjects`. |
| BACKEND_LATER | Rattrapage pédagogique | Plan local distinct, marqué « PÉDAGOGIE UNIQUEMENT » ; aucune inscription financière. | `pedagogy.lesson-plan.manage` avec `assigned_classes`, déjà existante. | Persistance du plan, suivi et résultats ; liaison Finance séparée. | P1 | Ne créer aucune permission de rattrapage ; Jaspe applique exactement la même garde. |
| BACKEND_LATER · PERMISSION_FUTURE | Bulletins, validations et rapports officiels | Aperçus et synthèses frontend ; aucune validation ni publication officielle. | Lecture/pilotage : `pedagogy.report.read`, `pedagogy.report.manage`. Sortie officielle dédiée : code non défini. | Calculs validés, périodes, publication, archivage et audit. | P1 | Les agrégats et décisions doivent être calculés à partir de données autorisées côté serveur. |

## Sécurité

Modules frontend sources pour toutes les lignes ci-dessous : `app/modules/security/security-module.js` et `app/modules/security/guard-security-demo.js`.

| Marqueur | Fonctionnalité | État frontend actuel | Permission existante ou future | Dépendance backend | Priorité | Sécurité |
|---|---|---|---|---|---|---|
| BACKEND_LATER | Scans entrée / sortie live | Scanner existant utilisé en démonstration ; l’événement produit reste local. | `security.scan` avec `assigned_portal`. | Validation QR/identité, décision serveur, idempotence et journal d’événements. | P0 | Le portail affecté, le statut actif et le QR doivent être revalidés côté serveur. |
| BACKEND_LATER | Pickup et préparation de sortie live | Préparation, contrôle et notification Parent sont des états locaux ; PRÊT ≠ SORTI. | `security.pickup.manage` avec `assigned_portal`; lecture Parent via `security.pickup.read` et `own_children`. | Autorisations live, preuve de remise, notification et audit. | P0 | Ne jamais remettre un enfant sur la seule foi de l’état frontend. |
| BACKEND_LATER · PERMISSION_FUTURE | Incidents et historique serveur | Incidents, lockdown et chronologie sont des simulations/brouillons locaux ; lecture agrégée seulement. | Lecture : `security.events.read`, `reports.security.read`; lockdown : `security.lockdown.manage`. Mutation officielle d’incident : code non défini. | Persistance append-only, pièces probantes, recherche, rétention et audit. | P0 | Les données de sécurité sont minimisées par portée ; aucune suppression silencieuse. |

## Finance

Modules frontend sources pour toutes les lignes ci-dessous : `app/modules/finance/finance-module.js` et `app/modules/finance/fee-control-module.js`.

| Marqueur | Fonctionnalité | État frontend actuel | Permission existante ou future | Dépendance backend | Priorité | Sécurité |
|---|---|---|---|---|---|---|
| BACKEND_LATER | Structures de frais et affectations | Catalogue et affectations préparés en brouillons ; aucune obligation élève officielle. | `finance.fee.read`, `finance.fee.manage`. | Persistance des structures, affectations et obligations élève. | P1 | Conserver devises séparées et élèves actifs uniquement ; toute mutation est auditée. |
| BACKEND_LATER | Paiements et annulations | Paiement constaté et annulation préparée en démonstration ; pas d’écriture live. | `finance.payment.record`, `finance.payment.cancel`. | Écriture idempotente, référence, rapprochement, annulation compensée et audit. | P0 | Aucun montant ne doit être déduit du navigateur ; lecture ≠ modification ≠ suppression. |
| BACKEND_LATER | Reçus | Aperçu PDF et registre de démonstration ; registre live non connecté. | `finance.receipt.read`. | Numérotation fiable, projection filtrée, stockage et récupération du reçu officiel. | P1 | Portée `own_children` pour le Parent ; le paiement n’accorde pas la lecture du registre. |
| BACKEND_LATER · PERMISSION_FUTURE | Exemptions | Demande locale sur une obligation précise ; aucune exemption appliquée. | La garde transitoire frontend utilise `finance.fee.manage`; droit officiel dédié : code non défini. | Validation, persistance, révocation et audit. | P0 | La garde transitoire ne doit pas être reproduite comme autorisation serveur. |
| BACKEND_LATER | Caisse | Surface bornée et indisponible en live ; journal, état, clôture et historique non connectés. | `finance.cash_register.close` ouvre seulement la surface actuelle. | Journal de caisse, états, clôture idempotente et historique. | P0 | Séparer devises et moyens ; aucune conversion ou clôture locale officielle. |
| BACKEND_LATER | Rapports financiers | Contrat visuel de rapports ; aucun agrégat ni export officiel. | `finance.report.read`, `reports.financial.read`. | Agrégats par période/devise, pagination et sorties officielles. | P1 | Aucun total CDF + USD ; pas de calcul officiel dans le navigateur. |
| BACKEND_LATER | Contrôle des frais serveur | Campagnes et scans de démonstration ; publication/activation de campagne absente. | `finance.control.read`, `finance.control.manage`, `finance.control.scan` selon la portée. | Campagnes, cibles, affectations, statuts, historique et audit. | P0 | Contrôle minimal ; ne pas exposer tout le dossier financier à l’agent de scan. |

## Comptabilité / trésorerie

Module frontend source pour toutes les lignes ci-dessous : `app/modules/accounting/accounting-treasury-demo.js`.

| Marqueur | Fonctionnalité | État frontend actuel | Permission existante ou future | Dépendance backend | Priorité | Sécurité |
|---|---|---|---|---|---|---|
| BACKEND_LATER · PERMISSION_FUTURE | Écritures et journaux officiels | Projection en lecture seule des mouvements Finance ; aucune saisie débit/crédit. | Lecture : `reports.financial.read` ou `finance.report.read`. Écriture comptable : code non défini. | Grand livre/journaux officiels, règles comptables, pièces et audit. | P0 | Une permission de lecture n’autorise jamais une écriture ; append-only et traçabilité obligatoires. |
| BACKEND_LATER | Trésorerie et rapprochement | Positions théoriques par devise et chaîne de contrôle visibles ; aucune correction automatique. | `reports.financial.read` ou `finance.report.read`. | Soldes d’ouverture, rapprochement serveur et gestion des anomalies. | P1 | Aucune conversion, aucun solde inventé, aucune mutation de paiement ou reçu. |
| BACKEND_LATER | Clôtures | Comptage conservé en brouillon local ; la caisse n’est jamais officiellement fermée. | `finance.cash_register.close`. | Clôture idempotente, verrouillage, preuve, écarts et audit. | P0 | Une clôture doit être transactionnelle, en ligne et irréversible seulement selon la procédure officielle. |
| BACKEND_LATER · PERMISSION_FUTURE | États comptables officiels | Synthèse frontend sans valeur légale ; fiscalité et exports finaux exclus. | Lecture : `reports.financial.read`. Production légale : code non défini. | Règles de période, états légaux, signatures et archivage. | P2 | Ne présenter aucune synthèse locale comme état comptable légal. |

## Personnel / RH

Module frontend source pour toutes les lignes ci-dessous : `app/modules/hr/hr-demo.js`.

| Marqueur | Fonctionnalité | État frontend actuel | Permission existante ou future | Dépendance backend | Priorité | Sécurité |
|---|---|---|---|---|---|---|
| BACKEND_LATER | Personnel, contrats et affectations live | Fiches démo ; modifications, contrats et affectations conservés comme brouillons distincts des originaux. | `staff.read`, `staff.manage`. | Dossiers, versions de contrat, affectations, validations et audit. | P0 | Données RH minimisées ; source officielle intacte tant que le brouillon n’est pas validé. |
| BACKEND_LATER | Présence et biométrie | Lecture/simulation de présence ; aucune biométrie corporelle officielle stockée ou exportée. | `staff.attendance.read`; rapports via `reports.hr.read`. | Pointages live, dispositif autorisé, rétention et rapprochement. | P0 | Une future collecte biométrique exige base légale, minimisation, chiffrement et permission dédiée. |
| BACKEND_LATER · PERMISSION_FUTURE | Paie réelle | Structure informative uniquement ; aucun salaire, prime, retenue, bulletin ou paiement calculé. | Consultation de la frontière : `reports.hr.read`. Paie officielle : code non défini. | Source de rémunération, calculs, validations, paiements, bulletins et déclarations. | P0 | `staff.manage` et `finance.payment.record` ne sont pas des permissions de paie. |

## Stock / inventaire / achats internes

Module frontend source pour toutes les lignes ci-dessous : `app/modules/inventory/inventory-demo.js`.

| Marqueur | Fonctionnalité | État frontend actuel | Permission existante ou future | Dépendance backend | Priorité | Sécurité |
|---|---|---|---|---|---|---|
| BACKEND_LATER · PERMISSION_FUTURE | Inventaire live et catalogue | Fixtures et brouillons locaux ; en live, seuls des agrégats peuvent être affichés lorsque autorisés. | Agrégats : `reports.operational.read`. Gestion officielle du stock : code non défini. | Référentiel articles, emplacements, quantités, seuils et versionnement. | P0 | Le navigateur n’est pas la source du stock ; aucune correction silencieuse ou quantité négative. |
| BACKEND_LATER · PERMISSION_FUTURE | Mouvements | Journal local append-only sans recalcul officiel. | Lecture agrégée : `reports.operational.read`. Mutation de stock : code non défini. | Écritures de mouvement atomiques, contrôles de disponibilité et audit. | P0 | Chaque mouvement conserve source, destination, motif et acteur ; aucune suppression. |
| BACKEND_LATER · PERMISSION_FUTURE | Achats internes, fournisseurs et réceptions | Demandes, commandes et réceptions simulées ; anomalies préparées, aucun paiement fournisseur. | Rapports : `reports.operational.read`. Workflow d’achat/réception : codes non définis. | Workflow de validation, fournisseurs, commandes, réceptions et anomalies. | P1 | L’achat interne ne donne aucun droit Finance ; données commerciales et paiements restent séparés. |

## Documents

Modules frontend sources pour toutes les lignes ci-dessous : `app/modules/document-center/` et `app/modules/document-engine/`; adaptateur carte dans `app/modules/school/student-card-preparation-demo.js`.

| Marqueur | Fonctionnalité | État frontend actuel | Permission existante ou future | Dépendance backend | Priorité | Sécurité |
|---|---|---|---|---|---|---|
| BACKEND_LATER | Stockage définitif et archivage | Le Centre conserve seulement des métadonnées non sensibles ; aucun PDF confidentiel dans le navigateur. | Permission du modèle documentaire, plus `file.download` lorsque l’action l’exige. | Stockage privé, URL temporaires, rétention, historique et audit. | P0 | Permission + portée + contexte sont exigés ; DENY prioritaire avant toute lecture. |
| BACKEND_LATER | PDF et documents officiels | jsPDF produit des aperçus/brouillons frontend ; aucune signature, numérotation ou valeur officielle. | Permissions existantes propres au modèle : par exemple `finance.receipt.read`, `pedagogy.assignment.read`, `pedagogy.report.read`, `reports.operational.read`. | Données officielles, numérotation atomique, signature, génération et archivage fiables. | P1 | Le type documentaire ne peut jamais fournir sa propre permission ; le catalogue canonique décide. |
| SAFE_CONTROL_LATER | Cartes vers SchoolSafe Control | Adaptateur d’aperçu et checklist ; bouton de transmission désactivé, impression finale absente. | `security.card.create` avec portée `school`. | Contrat versionné vers SchoolSafe Control après comparaison des références. | P2 | Préserver QR, dimensions, impression, révocation, historique et scanners ; `app/modules/cards/` reste intact. |

## Communication

Module frontend source pour toutes les lignes ci-dessous : `app/modules/communication/communication-demo.js`.

| Marqueur | Fonctionnalité | État frontend actuel | Permission existante ou future | Dépendance backend | Priorité | Sécurité |
|---|---|---|---|---|---|---|
| BACKEND_LATER | Messages réels | Composition et liaisons transversales en brouillon local ; aucun envoi automatique. | `communication.message.send` avec portée et contexte compatibles. | Boîtes, envoi, réception, statuts, pièces et historique. | P0 | La donnée source et l’envoi subissent deux contrôles Access_Law indépendants. |
| BACKEND_LATER · PERMISSION_FUTURE | Convocations | Préparation fictive en démo ; session live refusée, aucun document officiel. | Code dédié non défini ; `communication.message.send`, `communication.announcement.manage` et `email.send` ne s’y substituent pas. | Création, destinataires, document, envoi, accusé et suivi. | P0 | Convocation individuelle ≠ message ≠ annonce. |
| BACKEND_LATER · PERMISSION_FUTURE | Notifications | Préférences personnelles locales ; aucun envoi ni lecture globale. | Abonnement propre : `notification.subscribe` avec `own`. Envoi/historique : codes non définis. | Abonnements persistés, diffusion, préférences et historique. | P1 | Un abonnement n’autorise jamais l’envoi ni les notifications d’autrui. |
| BACKEND_LATER | Email | Brouillon local seulement. | `email.send` avec portée effective compatible. | Livraison, modèles, pièces, statut et audit. | P1 | Revalider destinataires et portée côté serveur ; éviter toute fuite par destinataire élargi. |
| BACKEND_LATER · PERMISSION_FUTURE | Site public / WebSync et événements | Aperçu non publié ; boutons de publication désactivés. | Code de publication non défini ; `sync.submit` ne vaut pas publication. | Workflow de relecture, publication, version et retour d’état. | P1 | Aucune publication par déduction d’un droit de synchronisation. |

## Administration

Module frontend source pour toutes les lignes ci-dessous : `app/modules/administration/administration-demo.js`.

| Marqueur | Fonctionnalité | État frontend actuel | Permission existante ou future | Dépendance backend | Priorité | Sécurité |
|---|---|---|---|---|---|---|
| BACKEND_LATER | Grants fins, exceptions et DENY | Console et simulateur en lecture/simulation ; la session réelle n’est jamais modifiée. | `roles.manage` avec `school`. | Persistance des grants/exceptions, justification, version et audit. | P0 | Aucun bypass admin ; DENY explicite reste prioritaire même pour l’Administrateur principal sans grant effectif. |
| BACKEND_LATER | Portées et conditions persistées | Inspection du résultat Access_Law et brouillon de simulation éphémère. | `roles.manage` avec `school`. | Modèle canonique de portée/condition, validation et audit des changements. | P0 | Refuser toute portée inconnue ; ne pas créer de moteur parallèle. |
| BACKEND_LATER | Mutations comptes et paramètres | Invitations, statuts et mutations live échouent honnêtement lorsque le contrat manque. | `staff.manage`, `school.manage` ou `roles.manage` selon la surface existante. | Services de mutation, concurrence, idempotence et audit. | P1 | Chaque mutation réévalue acteur, permission, portée, condition et exception côté serveur. |

## Jaspe

Modules frontend sources pour toutes les lignes ci-dessous : `app/modules/safe/jaspe-governance.js`, `app/modules/safe/jaspe-capability-router.js` et `app/modules/safe/safe-assistant.js`.

| Marqueur | Fonctionnalité | État frontend actuel | Permission existante ou future | Dépendance backend | Priorité | Sécurité |
|---|---|---|---|---|---|---|
| BACKEND_LATER | Appels IA réels | Routeur déterministe frontend et réponses locales ; aucune exécution métier ni appel IA serveur. | `safe.assistant.use` avec `own`, puis permission et portée du domaine demandé. | Service IA gouverné, contexte minimal autorisé, journalisation et limites d’outils. | P1 | Jaspe reste toujours inférieur ou égal à l’utilisateur et ne modifie jamais rôle, permission, portée ou exception. |
| BACKEND_LATER | Garde Access_Law serveur | Les gardes frontend refusent DENY, portée incompatible, contexte manquant et module indisponible. | `safe.assistant.use` + permission métier canonique correspondante. | Répéter les mêmes contrôles avant chaque lecture ou action serveur. | P0 | Le frontend seul n’est pas une barrière de sécurité ; aucune élévation via le prompt. |
| JASPE_3D_LATER | Expérience Jaspe 3D | Non commencée ; aucun Blender, GLB, FBX, OBJ, Three.js ou interaction 3D ajouté. | Aucune permission concernée à ce stade. | Phase séparée après le gel, avec conception et actifs validés. | P3 | La 3D ne doit jamais devenir un chemin alternatif vers une capacité métier ou un contournement Access_Law. |

## Conditions de sortie du gel frontend

Une reprise BACKEND_LATER n’est recevable que si elle documente au minimum la permission canonique, la portée, la condition, les exceptions, la priorité du DENY, la validation serveur, l’audit et l’état d’erreur fermé. Toute ligne marquée PERMISSION_FUTURE impose une conception Access_Law séparée avant implémentation ; ce document ne lui attribue volontairement aucun code.
