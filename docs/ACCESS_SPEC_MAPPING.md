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
