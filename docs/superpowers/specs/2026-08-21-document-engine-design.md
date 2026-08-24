# DOC-01 — Moteur documentaire transversal SchoolSafe

**Date :** 2026-08-21  
**Statut :** Spec d’architecture frontend — **VALIDÉ**  
**Contrainte :** Frontend uniquement. Aucun backend, aucune migration, aucune commande Supabase.

---

## 1. Objectif

Définir l’architecture commune utilisée par **tous** les documents, cartes, badges, exports et listes imprimables de SchoolSafe.

Le moteur doit être :

- **Unique** : un seul Document Engine pour toute l’application.
- **Centralisé** : identité école, identité SchoolSafe, mise en page et numérotation partagées.
- **Sécurisé par design** : ACCESS_LAW appliquée au point d’entrée unique.
- **Backend-ready** : les templates et le contrat doivent pouvoir être repris par le backend sans réécriture.
- **PDF-first** : tout document exportable propose obligatoirement une version PDF.

---

## 2. Principes directeurs

### 2.1 Portabilité frontend/backend des contrats

`DocumentRequest` et `DocumentModel` doivent être **100 % sérialisables en JSON**.

- Dates au format **ISO 8601**.
- Objets simples : chaînes, nombres, booléens, tableaux, objets plats.
- **Aucun objet navigateur** dans le cœur du moteur : pas de `jsPDF`, pas de `canvas`, pas de `Blob`, pas de `File`, pas de `Image`.
- Les objets binaires (Blob, ArrayBuffer, fichiers) ne traversent le contrat que sous forme d’URL, de clé de stockage ou de référence.
- Cette règle garantit que le backend peut recevoir le même `DocumentRequest`, produire le même `DocumentModel` et appeler les mêmes templates sans réécriture.

### 2.2 Loi documentaire SchoolSafe

- **PDF universel** : tout document exportable possède une version PDF.
- **Formats complémentaires** : Excel, CSV, PNG sont des compléments, jamais des remplacements.
- **Une seule source pour les données communes** : logo, adresse, téléphone, e-mail, site, coordonnées SchoolSafe viennent de configurations centrales.
- **Ordre officiel des données** : `DocumentRequest → AccessGate → Identité école → Identité SchoolSafe → Données contextuelles → Normalisation → Template → Layout → Renderer`.
- **Snapshot des identités** : un document officiel conserve les identités et la version du template telles qu’au moment de la génération officielle.
- **ACCESS_LAW partout** : `Fonctionnalité → Sous-fonctionnalité → Action → Portée → Condition → Exception`.

### 2.3 Frontend vs backend

- Cette phase est **frontend-only**.
- Les documents générés côté frontend sont des **aperçus/prototypes/téléchargements utilisateur**, pas des preuves officielles.
- L’historique, la numérotation fiable, la signature, l’archivage et l’audit officiel seront **backend**.
- Le `DocumentHistory` frontend reste **provisoire et minimal**, sans données sensibles.

### 2.4 Permissions

- Utiliser exclusivement les clés de `shared/permissions.json`.
- Ne jamais inventer de permission équivalente si elle existe déjà.
- Actions documentaires possibles : `view`, `preview`, `generate`, `print`, `export_pdf`, `download`.

---

## 3. Vue d’ensemble

```
DocumentRequest
    ↓
AccessGate  ← ACCESS_LAW + shared/permissions.json
    ↓
DocumentDataResolver
    ├── SchoolIdentityProvider      → snapshot identité école
    ├── SchoolSafeIdentityProvider  → snapshot identité SchoolSafe
    └── ModuleContextResolver       → données contextuelles
    ↓
DocumentModelNormalizer
    ↓
DocumentModel  (meta + schoolSnapshot + schoolsafeSnapshot + content)
    ↓
TemplateRegistry
    ↓
Template
    ├── ProgrammaticTemplate  → RenderContext / DrawingSurface
    └── DeclarativeTemplate   → JSON schema
    ↓
LayoutEngine
    ↓
FrontendRenderer
    ├── PDF  → jsPDF adapter
    ├── PNG  → canvas adapter
    ├── XLSX → SheetJS adapter
    └── CSV  → CSV adapter
    ↓
DocumentOutput
    ↓
DocumentCenter  → aperçu / impression / téléchargement
```

---

## 4. Composants détaillés

### 4.1 DocumentRequest

Représente la demande de document. Tout appel au moteur passe par cet objet.

```ts
interface DocumentRequest {
  id: string;                    // UUID généré côté client
  documentType: string;          // "receipt", "report-card", "student-card", "payroll", "report"...
  sourceModule: string;          // "finance", "pedagogy", "security", "hr"...
  action: DocumentAction;        // "view" | "preview" | "generate" | "print" | "export_pdf" | "download"
  formats: DocumentFormat[];     // ["pdf"] minimum
  context: DocumentContext;      // données contextuelles (élève, classe, paiement...)
  origin: DocumentOrigin;        // generated | uploaded | composed
  sourceArtifacts?: string[];    // IDs ou clés des documents sources (pour composed)
  requestedBy: UserContext;      // id, rôle, école
  reason?: string;               // motif si action sensible
  locale?: string;               // "fr-FR" par défaut
}

type DocumentOrigin = "generated" | "uploaded" | "composed";

type DocumentAction =
  | "view"
  | "preview"
  | "generate"
  | "print"
  | "export_pdf"
  | "download";

type DocumentFormat = "pdf" | "png" | "xlsx" | "csv";

interface DocumentContext {
  [key: string]: any;
}

interface UserContext {
  userId: string;
  role: string;
  schoolId: string;
  permissions?: string[];
}
```

Exemple — reçu de paiement :

```ts
{
  id: "doc-req-uuid",
  documentType: "receipt",
  sourceModule: "finance",
  action: "download",
  formats: ["pdf"],
  origin: "generated",
  context: {
    paymentId: "pay-123",
    studentId: "stu-456",
    academicYearId: "ay-2026"
  },
  requestedBy: {
    userId: "usr-789",
    role: "cashier",
    schoolId: "sch-001"
  },
  locale: "fr-FR"
}
```

---

### 4.2 AccessGate

Point d’entrée unique de sécurité.

```ts
interface AccessResult {
  allowed: boolean;
  permission: string;
  scope: string;
  reason?: string;
}

function checkDocumentAccess(request: DocumentRequest, templateInfo: TemplateInfo): AccessResult;
```

Règles :

- **La permission ne vient jamais du `DocumentRequest`.** Elle est définie par le `TemplateInfo` du `TemplateRegistry` et contrôlée par `AccessGate`.
- Le `role` envoyé par le frontend est une information indicative, **jamais une preuve d’autorisation**. Le backend vérifie lui-même l’identité, le rôle et les permissions via JWT + RLS.
- Administrateur principal → `allowed: true` par défaut.
- Tous les autres → `deny` par défaut.
- Vérification de la permission dans `shared/permissions.json`.
- Vérification de la portée : `own`, `own_children`, `assigned_classes`, `assigned_subjects`, `school`...
- Vérification des conditions et exceptions.
- Journalisation locale des refus importants (frontend).
- Le backend refait la vérification définitive plus tard.

Mapping action → permission (exemples) :

| Action | Permission typique |
|--------|-------------------|
| `view` / `preview` | `finance.receipt.read`, `pedagogy.assignment.read` |
| `generate` / `download` | `finance.receipt.read` + contexte, `finance.report.read` |
| `print` | même permission que `generate` |
| `export_pdf` | permission de lecture + droit d’export si défini |

---

### 4.3 DocumentDataResolver

Responsable de l’ordre officiel des données.

```ts
interface DocumentDataResolver {
  resolve(request: DocumentRequest): Promise<DocumentModel>;
}
```

Sous-composants :

#### 4.3.1 SchoolIdentityProvider

- Source : `api.getSettings()` (déjà existant dans `app/modules/document-engine/school-identity-provider.js`).
- Fournit : nom, adresse, contacts, logo, couleurs, devise, directeur, année scolaire active...
- Doit être **enrichi** pour supporter toutes les données du catalogue documentaire.

#### 4.3.2 SchoolSafeIdentityProvider

- Source : fichier central `shared/schoolsafe-identity.json` ou constantes livrées.
- Fournit : logo SchoolSafe, nom, site, e-mail, mentions légales secondaires.
- L’école reste l’identité principale ; SchoolSafe est secondaire.

#### 4.3.3 ModuleContextResolver

- Le module appelant fournit un `contextData` structuré.
- Exemple Finance : paiement, élève, caissier, référence, montant.
- Exemple Pédagogie : devoir, classe, matière, questions, barème.
- Exemple Sécurité : élève, photo, matricule, QR, personnes autorisées.

---

### 4.4 DocumentModel

Structure commune normalisée passée aux templates.

```ts
interface DocumentModel {
  meta: DocumentMeta;
  school: SchoolIdentitySnapshot;
  schoolsafe: SchoolSafeIdentitySnapshot;
  content: any;                 // données spécifiques au document (JSON-sérialisable)
}

interface DocumentMeta {
  reference: string;            // numéro de document officiel (vide si non numéroté)
  version: number;              // version du document généré
  templateVersion: string;      // version du template utilisé
  status: DocumentStatus;
  origin: DocumentOrigin;       // generated | uploaded | composed
  sourceArtifacts?: string[];   // IDs ou clés des sources (pour composed)
  sensitivity: DocumentSensitivity;
  authority: DocumentAuthority;
  createdAt: string;            // ISO 8601
  generatedAt?: string;         // ISO 8601
  sourceModule: string;
  documentType: string;
  action: DocumentAction;
  formats: DocumentFormat[];
  author: {
    id: string;
    name: string;
    role: string;
  };
  schoolId: string;
  academicYear?: {
    id: string;
    label: string;
  };
  locale: string;
  generatedBy: "frontend" | "server";
}

type DocumentStatus =
  | "draft"
  | "generated"
  | "validated"
  | "cancelled"
  | "archived";

type DocumentSensitivity = "public" | "internal" | "confidential" | "restricted";

type DocumentAuthority = "preview" | "official";
```

#### Snapshot des identités

Chaque `DocumentModel` conserve un **snapshot** des identités au moment de la génération :

```ts
interface SchoolIdentitySnapshot extends SchoolIdentity {
  snapshotAt: string;   // ISO 8601
}

interface SchoolSafeIdentitySnapshot extends SchoolSafeIdentity {
  snapshotAt: string;   // ISO 8601
}
```

Ainsi, un ancien reçu, bulletin ou contrat reste inchangé si l’école modifie son logo, téléphone, adresse ou site plus tard.

---

### 4.5 Origines des documents

Le moteur distingue trois origines :

| Origine | Signification | Exemple |
|---------|--------------|---------|
| `generated` | Document créé entièrement par SchoolSafe. | Reçu PDF, bulletin, carte élève. |
| `uploaded` | Document fourni par un utilisateur. | Photo d’un devoir, PDF scanné, certificat médical. |
| `composed` | Document construit à partir de plusieurs sources. | Devoir final = texte saisi + photo importée + consignes SchoolSafe. |

Un document `uploaded` ou `composed` peut ensuite être normalisé et exporté au format PDF SchoolSafe uniforme.

Exemple pédagogique :

```ts
{
  documentType: "homework",
  sourceModule: "pedagogy",
  origin: "composed",
  sourceArtifacts: ["upload-photo-abc", "text-input-def"],
  formats: ["pdf"]
}
```

---

### 4.6 Confidentialité et caractère officiel

Chaque `DocumentModel.meta` porte deux champs obligatoires :

```ts
type DocumentSensitivity = "public" | "internal" | "confidential" | "restricted";
type DocumentAuthority = "preview" | "official";
```

**Sensibilité :**

| Niveau | Usage |
|--------|-------|
| `public` | Documents pouvant être diffusés largement (plaquettes, annonces). |
| `internal` | Documents internes à l’école (listes, devoirs non notés). |
| `confidential` | Données personnelles ou financières (reçus, bulletins, fiches de paie). |
| `restricted` | Données très sensibles (dossiers médicaux, incidents sécurité). |

**Autorité :**

| Niveau | Usage |
|--------|-------|
| `preview` | Aperçu généré côté frontend. Non officiel. Peut porter un watermark. |
| `official` | Document validé et archivé côté serveur. Preuve officielle. |

**Watermarks et mentions :**

Le renderer ajoute automatiquement selon le contexte :

- `authority === "preview"` → watermark **BROUILLON** ou **APERÇU**.
- Document copié/exporté depuis l’historique → mention **COPIE**.
- `sensitivity === "confidential"` ou `restricted` → mention **CONFIDENTIEL**.
- `generatedBy === "frontend"` → watermark discret **Document généré localement — non officiel**.

Pendant la phase frontend, un document officiel peut être prévisualisé, mais il est toujours marqué comme `preview` et jamais présenté comme preuve officielle serveur.

---

### 4.7 TemplateRegistry

Catalogue central et unique de tous les templates.

```ts
interface TemplateRegistry {
  register(info: TemplateInfo, template: DocumentTemplate): void;
  get(type: string): DocumentTemplate;
  getInfo(type: string): TemplateInfo;
  list(filters?: TemplateFilter): TemplateInfo[];
}

interface TemplateInfo {
  type: string;
  label: string;
  labelFr?: string;
  labelEn?: string;
  sourceModule: string;
  nature: DocumentNature;
  defaultFormats: DocumentFormat[];
  supportedFormats: DocumentFormat[];
  defaultLayout: string;
  permissions: string[];
  templateVersion: string;
  description?: string;
}

type DocumentNature =
  | "DOCUMENT"
  | "CARTE/BADGE"
  | "FORMULAIRE"
  | "EXPORT"
  | "REGISTRE/LISTE IMPRIMABLE";
```

Le `TemplateRegistry` est la contrepartie exécutable du `DOCUMENT_CATALOG.md`.

---

### 4.8 Templates

#### 4.8.1 Templates programmatiques

Pour documents visuels complexes : reçus, bulletins, cartes, badges.

**Importante : le template ne dépend pas directement de jsPDF.**

Il reçoit un `RenderContext` / `DrawingSurface` abstrait :

```ts
interface ProgrammaticTemplate {
  info: TemplateInfo;
  render(ctx: RenderContext, model: DocumentModel, layout: LayoutContext): Promise<void>;
}

interface RenderContext {
  // État
  getDimensions(): PageDimensions;
  getCurrentPage(): number;

  // Dessin
  drawRect(x, y, w, h, options): void;
  drawText(text, x, y, options): void;
  drawImage(src, x, y, w, h, options): Promise<void>;
  drawQR(text, x, y, size, options): Promise<void>;
  drawLine(x1, y1, x2, y2, options): void;

  // Tableaux
  drawTable(config: TableConfig, x, y, maxY): number;

  // Pages
  addPage(): void;
  setPage(pageNumber: number): void;

  // Métadonnées
  setTitle(title: string): void;
  setAuthor(author: string): void;
}
```

Le `FrontendRenderer` implémente `RenderContext` avec jsPDF.

Le futur `ServerRenderer` implémentera `RenderContext` avec son propre moteur (par exemple PDFKit, Puppeteer, ou autre).

**Aucun template ne doit être réécrit lors du passage au backend.**

#### 4.8.2 Templates déclaratifs

Pour listes, registres, exports tabulaires.

```ts
interface DeclarativeTemplate {
  info: TemplateInfo;
  schema: DeclarativeSchema;
}

interface DeclarativeSchema {
  title?: string;
  subtitle?: string;
  headerText?: string;
  footerText?: string;
  columns: ColumnDef[];
  groupBy?: string;
  aggregates?: AggregateDef[];
  sort?: SortDef[];
  filters?: FilterDef[];
  translations?: Record<string, string>;
}
```

Le renderer déclaratif utilise ce schéma pour générer PDF, XLSX ou CSV.

#### 4.8.3 Règle de choix

| Type de document | Type de template |
|------------------|------------------|
| Reçu, bulletin, attestation, fiche de paie, carte, badge | Programmatique |
| Registre, liste, journal, export tabulaire | Déclaratif |
| Document avec photo + QR + signature | Programmatique |

---

### 4.8.4 Règle permanente de pagination

Lors de la pagination, le moteur ne doit jamais couper un bloc de question (ou tout bloc sémantique cohérent) entre deux pages si ce bloc peut tenir entièrement sur la page suivante.

- Un bloc qui tient dans la hauteur exploitable d’une page doit être reporté entièrement sur la page suivante.
- Une coupure interne d’un bloc n’est autorisée que si le bloc lui-même dépasse la hauteur exploitable d’une page.
- Le template est responsable d’estimer la hauteur de ses blocs avant de les dessiner.
- Cette règle s’applique aux questions, aux tableaux, aux fiches identité et à tout regroupement visuel qui perdrait son sens en étant coupé.

---

### 4.9 LayoutEngine

Gère les dimensions, marges, en-tête, pied de page, pagination et identité visuelle.

```ts
interface LayoutEngine {
  getDimensions(layoutName: string): PageDimensions;
  applyHeader(ctx: RenderContext, model: DocumentModel): void;
  applyFooter(ctx: RenderContext, model: DocumentModel): void;
  applyPageNumber(ctx: RenderContext, model: DocumentModel): void;
}
```

Layouts prédéfinis :

| Nom | Dimensions | Usage |
|-----|-----------|-------|
| `a4-portrait` | 210 × 297 mm | bulletins, attestations, rapports |
| `a4-landscape` | 297 × 210 mm | listes larges, tableaux |
| `a5-portrait` | 148 × 210 mm | documents courts |
| `a5-receipt` | 148 × 210 mm (logique) | reçu de paiement |
| `a4-two-up-a5` | 2 × A5 sur A4 | impression papier de deux reçus |
| `student-card-horizontal` | 86 × 54 mm | carte PVC |
| `student-badge-vertical` | 54 × 86 mm | badge |

**Distinction format / impression :**

- Le reçu est logiquement un document **A5** (`a5-receipt`).
- L’impression "2 reçus sur A4" est une **politique d’impression** (`a4-two-up-a5`), pas un changement de format logique.

---

### 4.10 FrontendRenderer

Implémentation concrète du renderer pour la phase frontend.

```ts
interface DocumentRenderer {
  render(model: DocumentModel, format: DocumentFormat): Promise<DocumentOutput>;
}

class FrontendRenderer implements DocumentRenderer {
  async render(model: DocumentModel, format: DocumentFormat): Promise<DocumentOutput>;
}
```

Adaptateurs :

| Format | Bibliothèque | Adapter |
|--------|--------------|---------|
| PDF | jsPDF | `JspdfRenderContext` |
| PNG | canvas / html2canvas | `CanvasRenderContext` |
| XLSX | SheetJS | `XlsxExportAdapter` |
| CSV | natif | `CsvExportAdapter` |

Le renderer :

1. Récupère le template dans le `TemplateRegistry`.
2. Vérifie que le format demandé est supporté.
3. Charge le layout.
4. Si programmatique : crée un `RenderContext` adapté au format et appelle `template.render(ctx, model, layout)`.
5. Si déclaratif : appelle le moteur déclaratif générique.
6. Retourne un `DocumentOutput`.

```ts
interface DocumentOutput {
  format: DocumentFormat;
  blob: Blob;
  objectUrl?: string;
  filename: string;
  pages?: number;
  size?: number;
}
```

---

### 4.11 Politique des formats

**PDF universel.**

Tout document exportable doit proposer une version PDF. Les autres formats sont complémentaires.

| Action | Comportement |
|--------|-------------|
| Télécharger PDF | Génère uniquement le PDF. |
| Télécharger Excel | Génère uniquement l’Excel. Le bouton PDF reste disponible séparément. |
| Télécharger CSV | Génère uniquement le CSV. Le bouton PDF reste disponible séparément. |
| Imprimer | Génère le PDF et lance l’impression. |
| Aperçu | Génère le PDF et l’affiche. |

Mapping document/format :

| Document | PDF | XLSX | CSV | PNG |
|----------|-----|------|-----|-----|
| Reçu | obligatoire | non | non | optionnel QR |
| Bulletin | obligatoire | non | non | non |
| Carte élève | obligatoire | non | non | optionnel aperçu |
| Registre caisse | obligatoire | optionnel | optionnel | non |
| Rapport financier | obligatoire | optionnel | optionnel | non |
| Devoir | obligatoire | non | non | non |
| Fiche de paie | obligatoire | non | non | non |

---

### 4.12 DocumentCenter

Écran unique, hub transversal de tous les documents.

Fonctions :

- Lister tous les documents accessibles à l’utilisateur selon ACCESS_LAW.
- Recherche par nom, type, référence.
- Filtres : domaine, nature, format disponible, date, statut.
- Aperçu PDF intégré.
- Boutons : Imprimer, Télécharger PDF, Télécharger complément (Excel/CSV/PNG).
- Entrées contextuelles : depuis Finance, le Centre s’ouvre filtré sur `sourceModule=finance`.

Structure UI proposée :

```
┌─────────────────────────────────────────────────────┐
│  Centre de documents — SchoolSafe                   │
│  [Recherche] [Domaine ▼] [Nature ▼] [Format ▼] [Date ▼] │
├─────────────────────────────────────────────────────┤
│  Tuiles des documents accessibles                   │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │ Reçu    │ │ Bulletin│ │ Carte   │ │ Rapport │   │
│  │ PDF     │ │ PDF     │ │ PDF/PNG │ │ PDF/XLSX│   │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘   │
├─────────────────────────────────────────────────────┤
│  Aperçu PDF                                         │
│  [Imprimer] [Télécharger PDF] [Télécharger Excel?]  │
└─────────────────────────────────────────────────────┘
```

Le Centre ne génère pas directement : il construit un `DocumentRequest` et appelle le moteur.

---

### 4.13 Historique, version et statut

#### Cycle de vie

```
draft → generated → validated → archived
          ↓
      cancelled
```

| Statut | Signification |
|--------|--------------|
| `draft` | Aperçu provisoire, non officiel. |
| `generated` | Document généré côté frontend. Non officiel. |
| `validated` | Document validé (backend futur). |
| `cancelled` | Document annulé. |
| `archived` | Document archivé définitivement (backend futur). |

#### Versionnement

- `meta.version` : version du document généré.
- `meta.templateVersion` : version du template utilisé.
- `meta.schoolSnapshot` et `meta.schoolsafeSnapshot` : identités figées au moment de la génération.

#### Historique frontend (provisoire)

- Stockage : **uniquement métadonnées non sensibles** (`documentType`, `reference`, `status`, `createdAt`, `sourceModule`, `formats`).
- **Interdiction** de stocker dans `localStorage` : PDF, données médicales, données financières sensibles, données personnelles complètes, contenu officiel.
- Objectif : permettre le prototype, le QA et une liste récente dans le Centre.
- L’historique officiel, les snapshots, les références et l’audit seront persistés côté backend.

---

## 5. Politique centrale des fichiers

Une convention unique s’applique à tous les documents afin qu’aucun module n’invente sa propre manière de nommer, référencer ou formater.

### 5.1 Nom de fichier

```
<documentType>_<reference>_<version>_<locale>.<ext>
```

Exemples :

```
receipt_REC-2026-00042_v1_fr.pdf
report-card_BUL-2026-0123_v2_fr.pdf
student-card_CARD-2026-0088_v1_fr.png
```

Règles :

- Minuscules, sans espaces.
- Séparateur `_` (tiret bas).
- Référence sans caractères spéciaux.
- Locale ISO (`fr`, `fr-FR`, `en`, `en-US`).

### 5.2 Référence

```
<PREFIX>-<ANNÉE>-<NUMÉRO>
```

- `REC` → reçu
- `BUL` → bulletin
- `CARD` → carte élève
- `ATT` → attestation
- `PAY` → fiche de paie
- `RPT` → rapport

Numéro séquentiel, atomique côté backend en phase 2.

### 5.3 Version

- `version` du document : incrémenté à chaque regénération significative.
- `templateVersion` : version du template utilisé.

### 5.4 Locale

- `locale` dans `DocumentRequest` et `DocumentModel`.
- Formatage des dates, nombres et monnaies selon cette locale.
- Pas de formatage hardcodé dans les templates.

### 5.5 Dates

- Stockage : ISO 8601 (`2026-08-21T14:30:00Z`).
- Affichage : via helper central selon la locale (`21/08/2026` en fr-FR).

### 5.6 Monnaie et nombres

- Monnaie : via helper central `formatCurrency(amount, currency, locale)`.
- Nombres : via helper central `formatNumber(value, locale)`.
- Pas de `toFixed(2)` ou de concaténation manuelle dans les templates.

### 5.7 Pagination

- Gérée par le `LayoutEngine`.
- Format : `Page {n} / {total}`.
- Localisé selon la locale.

---

## 6. Stratégie de bascule vers ServerRenderer

L’architecture est conçue pour que la bascule soit un ajout.

```ts
interface DocumentRenderer {
  render(model: DocumentModel, format: DocumentFormat): Promise<DocumentOutput>;
}

class FrontendRenderer implements DocumentRenderer { ... }
class ServerRenderer implements DocumentRenderer { ... }   // Phase 2
```

Principe :

- Les templates programmatiques utilisent `RenderContext`, pas jsPDF directement.
- Le `ServerRenderer` implémentera `RenderContext` avec un moteur serveur.
- Le `DocumentModel` reste identique.
- Le `DocumentRequest` reste identique.
- Le `TemplateRegistry` reste identique.

Bascule par type de document :

| Document | Phase frontend | Phase backend |
|----------|---------------|---------------|
| Aperçus, prototypes, listes simples | `FrontendRenderer` | Peut rester frontend |
| Reçus officiels | `FrontendRenderer` (non officiel) | `ServerRenderer` (numérotation + audit) |
| Bulletins, attestations, fiches de paie | `FrontendRenderer` (aperçu) | `ServerRenderer` (signature + archive) |
| Cartes sécurisées | `FrontendRenderer` (prototype) | `ServerRenderer` (QR signé + `student_cards`) |

Backend plus tard :

- Endpoint `/documents/generate` recevant un `DocumentRequest`.
- Vérification ACCESS_LAW côté serveur + RLS.
- Numérotation atomique via `document_number_sequences`.
- Stockage S3/R2.
- Table `documents` avec snapshots et versions.
- Audit : `document.generated`, `document.downloaded`, `document.printed`.

---

## 7. Permissions et ACCESS_LAW

### 6.1 Source unique

- `shared/permissions.json` est le catalogue officiel.
- Aucune permission ne doit être inventée si une équivalente existe.

### 6.2 Mapping des permissions documentaires existantes

| Domaine | Permission | Document concerné |
|---------|------------|-------------------|
| Finance | `finance.receipt.read` | Reçus, preuves de paiement |
| Finance | `finance.report.read` | Rapports de caisse, rapports financiers |
| Finance | `finance.cash_register.close` | Clôture de caisse, rapport journalier |
| Finance | `finance.control.read` / `finance.control.scan` | Contrôle des frais, scans |
| Pédagogie | `pedagogy.assignment.read` / `.manage` | Devoirs, interrogations |
| Pédagogie | `pedagogy.grade.read` / `.manage` | Bulletins, relevés de notes |
| Pédagogie | `pedagogy.report.read` / `.manage` | Rapports pédagogiques |
| Palmarès | `palmarques.read` / `.manage` | Palmarès (export PDF futur) |
| Sécurité | `security.scan`, `security.events.read` | Cartes, registres, incidents |
| Sécurité | `security.card.create` | Création de carte/badge |
| Rapports | `reports.operational.read` | Rapports opérationnels |
| Rapports | `reports.financial.read` | Rapports financiers |
| Rapports | `reports.security.read` | Rapports de sécurité |
| Rapports | `reports.hr.read` | Rapports RH |
| RH | `staff.read`, `staff.attendance.read` | Fiches personnel, présences |
| Administration | `school.manage` | Identité école, paramètres |

### 6.3 Actions vs permissions

L’action documentaire est déduite de la permission existante :

- `view` / `preview` → permission de lecture.
- `generate` / `download` / `print` / `export_pdf` → permission de lecture ou permission de gestion selon le document.

Exemple :

```
Parent → finance.receipt.read → scope=own_children
  → view/preview/generate/download/print de ses propres reçus.
```

---

## 8. Backend Later needs

Les besoins backend découverts pendant DOC-01 sont enregistrés ici pour la phase backend.

| ID | Besoin | Fonctionnalité concernée | Données attendues |
|----|--------|-------------------------|-------------------|
| BE-DOC-001 | Historique officiel des documents | Tous les documents | Table `documents` avec snapshots |
| BE-DOC-002 | Numérotation atomique fiable | Reçus, bulletins, attestations | `document_number_sequences` |
| BE-DOC-003 | QR signé pour cartes et reçus | Cartes, reçus | Secrets HMAC, `student_cards` |
| BE-DOC-004 | Stockage S3/R2 des documents officiels | Documents sensibles | Fichiers PDF signés |
| BE-DOC-005 | Audit documentaire | Tous les documents sensibles | `audit_events` |
| BE-DOC-006 | Endpoint `/documents/generate` | Bascule ServerRenderer | `DocumentRequest` + `DocumentModel` |
| BE-DOC-007 | Permissions admissions, attestations, certificats | Admissions | Nouvelles permissions si non existantes |
| BE-DOC-008 | Permissions paie / fiches de paie | RH | `payroll.read`, `payroll.manage` |

---

## 9. Non-objectifs de DOC-01

- Ne pas développer le backend.
- Ne pas créer de nouvelle table Supabase.
- Ne pas générer de document réel dans ce spec.
- Ne pas choisir de premier document à implémenter.
- Ne pas modifier `shared/permissions.json` dans cette étape.
- Ne pas stocker de données sensibles dans l’historique frontend.

---

## 10. Critères de validation de DOC-01

- [x] L’architecture couvre tous les documents du `DOCUMENT_CATALOG.md`.
- [x] Les templates programmatiques sont indépendants de jsPDF.
- [x] Le PDF est universel pour tout document exportable.
- [x] L’identité école et SchoolSafe sont centralisées et snapshotées.
- [x] ACCESS_LAW est au point d’entrée unique.
- [x] Le Centre de documents est défini comme hub global unique.
- [x] La bascule future vers `ServerRenderer` ne nécessite pas de réécrire les templates.
- [x] `DocumentRequest` et `DocumentModel` sont sérialisables en JSON (dates ISO, pas d’objets navigateur).
- [x] La permission vient du `TemplateRegistry`, jamais du `DocumentRequest`.
- [x] Le moteur supporte les origines `generated`, `uploaded` et `composed`.
- [x] Les métadonnées incluent `sensitivity` et `authority` avec watermarks adaptés.
- [x] Une politique centrale des fichiers définit nom, référence, version, locale, dates, monnaie, pagination.
- [x] Les besoins backend sont enregistrés dans `BACKEND_LATER.md`.

**Statut : DOC-01 = VALIDÉ.**

---

## 11. Références

- `docs/project-context/DOCUMENT_CATALOG.md`
- `docs/project-context/ACCESS_LAW.md`
- `docs/project-context/FRONTEND_MASTER_PLAN.md`
- `shared/permissions.json`
- `app/modules/document-engine/` (implémentation existante)
