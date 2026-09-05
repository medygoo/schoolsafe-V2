# Correspondance spécification ↔ catalogue (ACL-01)

> La spécification officielle (ordre du 2026-09-04) et le catalogue canonique
> `shared/permissions.json` utilisent deux vocabulaires. Cette table est la
> correspondance verrouillée. Toute nouvelle permission exige conception
> Access_Law + autorisation (verrou du catalogue).

## Rôles

| Spécification | Code réel | État |
|---|---|---|
| DIRECTION_1 | `admin` | existant |
| PEDAGOGICAL_DIRECTOR | `pedagogy` | existant |
| CASHIER | `cashier` | existant |
| FEE_CONTROL | `fee_control` | **ajouté par le pack access/v1** |
| TEACHER | `teacher` | existant |
| GUARD | `guard` | existant |
| PARENT | `parent` | existant |
| STAFF | `staff` | **ajouté par le pack access/v1** |
| HR | `hr` | **ajouté par le pack access/v1** |
| HIKVISION_ADMIN | `hikvision_admin` | **ajouté par le pack access/v1** |
| Chef d'établissement | `school_head` | existant |

## Portées

| Spécification | Scope canonique |
|---|---|
| SELF | `own` |
| OWN_CHILDREN | `own_children` |
| OWN_CLASSES / ASSIGNED_CLASSES | `assigned_classes` |
| ASSIGNED_SUBJECTS | `assigned_subjects` |
| SECURITY_POST | `assigned_portal` |
| SCHOOL | `school` |
| GLOBAL_CONTROL | **refusé dans l'instance école — appartient à Control** |
| FINANCE / HR | ne sont PAS des portées : ce sont des domaines de permissions |

## Permissions (exemples de correspondance)

| Spécification | Catalogue canonique |
|---|---|
| `student.read` | `school.student.read` |
| `grade.create/update` | `pedagogy.grade.manage` |
| `grade.read` | `pedagogy.grade.read` |
| `payment.create` | `finance.payment.record` |
| `payment.correct` | `finance.payment.cancel` (conditionnée : fenêtre 24 h) |
| `security.scan.entry/exit` | `security.scan` |
| `staff.read` | `staff.read` |
| `biometric.enroll` | **PERMISSION_FUTURE — n'existe pas (lot BIO-01)** |
| `biometric.events.read` | `staff.attendance.read` (lecture seule, provisoire) |
| `role.assign` | `roles.manage` |
| `audit.read` | **PERMISSION_FUTURE — n'existe pas encore dans le catalogue** |

## Règle

Si une ligne manque dans ce tableau, on ne l'invente pas : on la conçoit,
on l'autorise, on l'ajoute au catalogue et à cette table ensemble.

## Décisions de portée par rôle (ACL-01-R2, verrouillées par preuve SQL)

La portée du catalogue est un défaut ; le grant d'un rôle peut la resserrer
ou la décider autrement. Matrice prouvée sur PostgreSQL réel :

| Rôle | Permission | Portée décidée | Raison |
|---|---|---|---|
| teacher | `pedagogy.grade.read` | `assigned_classes` | un enseignant lit les notes de SES classes, pas seulement « ses enfants » |
| teacher | `palmarques.read` | `assigned_classes` | palmarès borné à ses classes |
| teacher | `school.guardian.read` | `assigned_classes` | tuteurs de ses élèves uniquement |
| parent | toutes | `own_children` | jamais de classe ni d'école entière |
| cashier | `finance.status.read` / `fee.read` / `receipt.read` | `school` | la caisse opère sur toute l'école |
| cashier | `finance.payment.cancel` | `school` + condition `within_cancellation_window` (24 h) | annulation jamais libre |
| guard | `security.scan` / `pickup.*` / `events.read` | `assigned_portal` | son poste, rien d'autre |
| school_head | lectures de supervision | `school` | portée school décidée explicitement |
| pedagogy | `pedagogy.grade.read` | `school` | le responsable pédagogique voit tous les résultats |
| fee_control | `finance.control.scan` | `assigned_classes` | le scan se fait par classe |
| hr | `staff.*` | `school` | personnel de l'école |
| hikvision_admin | `staff.attendance.read` | `school` | pointages du personnel ; écriture = PERMISSION_FUTURE (BIO-01) |
| staff | bloc commun uniquement | `own`/`none` | socle minimal |
