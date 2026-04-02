# Architecture du filtrage des permissions basé sur les SID

**🌐 Language:** [日本語](../SID-Filtering-Architecture.md) | [English](../en/SID-Filtering-Architecture.md) | [한국어](../ko/SID-Filtering-Architecture.md) | [简体中文](../zh-CN/SID-Filtering-Architecture.md) | [繁體中文](../zh-TW/SID-Filtering-Architecture.md) | **Français** | [Deutsch](../de/SID-Filtering-Architecture.md) | [Español](../es/SID-Filtering-Architecture.md)

## Vue d'ensemble

Ce système exploite les SID (Security Identifiers) des ACL NTFS pour filtrer les résultats de recherche RAG par utilisateur. Les informations de permissions d'accès du système de fichiers FSx for NetApp ONTAP sont stockées comme métadonnées dans la base de données vectorielle, et les vérifications de permissions sont effectuées en temps réel lors des recherches.

---

## Diagramme d'architecture globale

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Data Ingestion Flow                              │
│                                                                         │
│  ┌──────────────┐    ┌─────────────────┐    ┌───────────────────────┐  │
│  │ FSx for ONTAP│    │ S3 Access Point │    │ Bedrock Knowledge Base│  │
│  │              │───▶│                 │───▶│                       │  │
│  │ NTFS ACL     │    │ Exposes FSx     │    │ ・Vectorized with     │  │
│  │ File         │    │ volumes via     │    │   Titan Embed v2      │  │
│  │ permissions  │    │ S3-compatible   │    │ ・Metadata (SID) also │  │
│  │ + .metadata  │    │ interface       │    │   stored              │  │
│  │   .json      │    └─────────────────┘    └───────────┬───────────┘  │
│  └──────────────┘                                       │              │
│                                                         ▼              │
│                                          ┌──────────────────────────┐  │
│                                          │ Vector Store             │  │
│                                          │ (Selected by             │  │
│                                          │  vectorStoreType)        │  │
│                                          │ ・S3 Vectors (default)   │  │
│                                          │ ・OpenSearch Serverless   │  │
│                                          │                          │  │
│                                          │ Vector data +            │  │
│                                          │ metadata (SID etc.)      │  │
│                                          │ stored                   │  │
│                                          └──────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Search & Filtering Flow                          │
│                                                                         │
│  ┌──────────┐    ┌──────────────────┐    ┌──────────────────────────┐  │
│  │ User      │───▶│ Next.js          │───▶│ Bedrock KB               │  │
│  │ (Browser) │    │ KB Retrieve API  │    │ Retrieve API             │  │
│  └──────────┘    └────────┬─────────┘    └────────────┬─────────────┘  │
│                           │                           │                │
│                           │                           ▼                │
│                           │              ┌──────────────────────────┐  │
│                           │              │ Search Results            │  │
│                           │              │ ・Citation (source doc)   │  │
│                           │              │   └─ metadata             │  │
│                           │              │       └─ allowed_group_sids│ │
│                           │              └────────────┬─────────────┘  │
│                           │                           │                │
│                           ▼                           ▼                │
│              ┌──────────────────┐    ┌──────────────────────────────┐  │
│              │ DynamoDB         │    │ SID Filtering Process        │  │
│              │ user-access      │───▶│                              │  │
│              │ ・userId          │    │ User SID ∩ Document SID     │  │
│              │ ・userSID         │    │ = Match → Access allowed    │  │
│              │ ・groupSIDs       │    │ ≠ No match → Access denied  │  │
│              └──────────────────┘    └──────────────┬───────────────┘  │
│                                                     │                │
│                                                     ▼                │
│                                      ┌──────────────────────────────┐  │
│                                      │ Converse API                 │  │
│                                      │ ・Generate response using    │  │
│                                      │   only allowed documents     │  │
│                                      │ ・Return filtered citations  │  │
│                                      └──────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

> **À propos du S3 Access Point** : Le S3 Access Point pour FSx for ONTAP expose directement les fichiers des volumes FSx via une interface compatible S3. Il n'est pas nécessaire de copier les fichiers dans un bucket S3 séparé. Bedrock KB référence l'alias S3 AP comme source de données et ingère directement les documents (y compris `.metadata.json`) depuis le volume FSx.

---

## Logique détaillée du filtrage SID

### Étape 1 : Récupération des SID de l'utilisateur

Lorsqu'un utilisateur soumet une question dans le chat, l'API KB Retrieve récupère les informations SID de l'utilisateur depuis la table DynamoDB `user-access`.

```
DynamoDB user-access table
┌──────────────────────────────────────────────────────────────┐
│ userId (PK)          │ userSID              │ groupSIDs      │
├──────────────────────┼──────────────────────┼────────────────┤
│ {Cognito sub}        │ S-1-5-21-...-500     │ [S-1-5-21-...-512, │
│ (admin@example.com)  │ (Administrator)      │  S-1-1-0]      │
├──────────────────────┼──────────────────────┼────────────────┤
│ {Cognito sub}        │ S-1-5-21-...-1001    │ [S-1-1-0]      │
│ (user@example.com)   │ (Regular User)       │                │
└──────────────────────┴──────────────────────┴────────────────┘

→ Liste complète des SID de l'utilisateur = [userSID] + groupSIDs
   admin: [S-1-5-21-...-500, S-1-5-21-...-512, S-1-1-0]
   user:  [S-1-5-21-...-1001, S-1-1-0]
```

### Étape 2 : Récupération des métadonnées des documents

Chaque citation dans les résultats de recherche Bedrock KB contient des métadonnées ingérées depuis les fichiers `.metadata.json` sur S3.

> **Comment `.metadata.json` est créé** : Ce système inclut la récupération automatique des ACL NTFS implémentée par l'AD Sync Lambda (`lambda/agent-core-ad-sync/`) et le service de permissions FSx (`lambda/permissions/fsx-permission-service.ts`). Dans l'environnement de démonstration, des données d'exemple sont placées manuellement à des fins de vérification. Pour plus de détails, voir la section "Structure des métadonnées" dans [docs/embedding-server-design.md](embedding-server-design.md).

```
Document Metadata (.metadata.json)
┌──────────────────────────┬──────────────────────────────────────┐
│ Document                 │ allowed_group_sids                   │
├──────────────────────────┼──────────────────────────────────────┤
│ public/product-catalog   │ ["S-1-1-0"]                          │
│                          │  └─ Everyone (tous les utilisateurs) │
├──────────────────────────┼──────────────────────────────────────┤
│ public/company-overview  │ ["S-1-1-0"]                          │
│                          │  └─ Everyone (tous les utilisateurs) │
├──────────────────────────┼──────────────────────────────────────┤
│ confidential/financial   │ ["S-1-5-21-...-512"]                 │
│                          │  └─ Domain Admins uniquement         │
├──────────────────────────┼──────────────────────────────────────┤
│ confidential/hr-policy   │ ["S-1-5-21-...-512"]                 │
│                          │  └─ Domain Admins uniquement         │
├──────────────────────────┼──────────────────────────────────────┤
│ restricted/project-plan  │ ["S-1-5-21-...-1100",                │
│                          │  "S-1-5-21-...-512"]                 │
│                          │  └─ Engineering + Domain Admins      │
└──────────────────────────┴──────────────────────────────────────┘
```

### Étape 3 : Correspondance SID

La liste des SID de l'utilisateur est comparée aux `allowed_group_sids` du document.

```
Règle de correspondance : SID utilisateur ∩ SID document ≠ ∅ → AUTORISER

■ Utilisateur administrateur (admin@example.com)
  SID utilisateur : [S-1-5-21-...-500, S-1-5-21-...-512, S-1-1-0]

  public/product-catalog    → S-1-1-0 ∈ SID utilisateur → ✅ AUTORISER
  public/company-overview   → S-1-1-0 ∈ SID utilisateur → ✅ AUTORISER
  confidential/financial    → S-1-5-21-...-512 ∈ SID utilisateur → ✅ AUTORISER
  confidential/hr-policy    → S-1-5-21-...-512 ∈ SID utilisateur → ✅ AUTORISER
  restricted/project-plan   → S-1-5-21-...-512 ∈ SID utilisateur → ✅ AUTORISER

■ Utilisateur standard (user@example.com)
  SID utilisateur : [S-1-5-21-...-1001, S-1-1-0]

  public/product-catalog    → S-1-1-0 ∈ SID utilisateur → ✅ AUTORISER
  public/company-overview   → S-1-1-0 ∈ SID utilisateur → ✅ AUTORISER
  confidential/financial    → S-1-5-21-...-512 ∉ SID utilisateur → ❌ REFUSER
  confidential/hr-policy    → S-1-5-21-...-512 ∉ SID utilisateur → ❌ REFUSER
  restricted/project-plan   → {-1100, -512} ∩ {-1001, S-1-1-0} = ∅ → ❌ REFUSER
```

### Étape 4 : Repli de sécurité

Lorsque les informations SID ne peuvent pas être récupérées (pas d'enregistrement dans DynamoDB, erreur de connexion, etc.), le système se replie du côté sûr et refuse l'accès à tous les documents.

```
Flux en cas d'échec de récupération SID :
  DynamoDB → Erreur ou pas d'enregistrement
    → allUserSIDs = [] (vide)
    → Tous les documents REFUSÉS
    → filterMethod: "DENY_ALL_FALLBACK"
```

---

## À propos du SID (Security Identifier)

### Structure du SID

```
S-1-5-21-{DomainID1}-{DomainID2}-{DomainID3}-{RID}
│ │ │  │  └─────────────────────────────────────────┘  └─┘
│ │ │  │              Domain Identifier                Relative ID
│ │ │  └─ Sub-authority count
│ │ └─ Identifier Authority (5 = NT Authority)
│ └─ Revision
└─ SID Prefix
```

### SID principaux

| SID | Nom | Description |
|-----|------|-------------|
| `S-1-1-0` | Everyone | Tous les utilisateurs |
| `S-1-5-21-...-500` | Administrator | Administrateur du domaine |
| `S-1-5-21-...-512` | Domain Admins | Groupe des administrateurs du domaine |
| `S-1-5-21-...-1001` | User | Utilisateur standard |
| `S-1-5-21-...-1100` | Engineering | Groupe d'ingénierie |

### SID dans FSx for ONTAP

FSx for ONTAP supporte les ACL Windows sur les volumes de style de sécurité NTFS. Chaque fichier/répertoire a une ACL (Access Control List) configurée, et les permissions d'accès sont gérées sur la base des SID.

Lors de l'accès aux fichiers sur FSx via S3 Access Point, les informations ACL NTFS sont exposées comme métadonnées. Ce système ingère ces informations ACL (SID) comme métadonnées Bedrock KB et les utilise pour le filtrage lors des recherches.

---

## Flux de données détaillé

### 1. Pendant l'ingestion des données (Embedding)

```
FSx for ONTAP                    S3 Access Point              Bedrock KB
┌─────────────┐                ┌──────────────┐             ┌──────────────┐
│ file.md     │  S3 Access     │ S3-compatible│  KB Sync    │ Vectorization│
│ NTFS ACL:   │──Point──▶     │ interface    │────────▶   │ + metadata   │
│  Admin:Full │                │              │             │ storage      │
│  Users:Read │                │ file.md      │             │              │
│             │                │ file.md      │             └──────┬───────┘
│ file.md     │                │ .metadata    │                    │
│ .metadata   │                │ .json        │                    ▼
│ .json       │                │ (Directly    │             ┌──────────────┐
│ {           │                │  exposed     │             │ OpenSearch   │
│  "allowed_  │                │  from FSx)   │             │ Serverless   │
│   group_sids│                └──────────────┘             │ ・vector     │
│  :["S-1-.."]│                                             │ ・text_chunk │
│ }           │                                             │ ・metadata   │
└─────────────┘                                             │   (SID info) │
                                                            └──────────────┘
```

> Le S3 Access Point expose directement les fichiers du volume FSx via une interface compatible S3, donc la copie vers un bucket S3 n'est pas nécessaire.

### Options de chemins d'ingestion des données

Ce système fournit trois chemins d'ingestion de données. Comme le S3 Access Point n'est pas disponible pour les volumes FlexCache Cache en mars 2026, une configuration de repli est nécessaire.

| # | Chemin | Méthode | Activation CDK | Cas d'utilisation |
|---|------|--------|----------------|----------|
| 1 | Principal | Volume FSx ONTAP → S3 Access Point → Bedrock KB | `post-deploy-setup.sh` | Volumes standard (S3 AP supporté) |
| 2 | Repli | Upload manuel vers le bucket S3 → Bedrock KB | `upload-demo-data.sh` | Volumes FlexCache et autres cas non supportés par S3 AP |
| 3 | Alternatif | Montage CIFS → Serveur d'Embedding → Écriture directe dans AOSS | `-c enableEmbeddingServer=true` | Volumes FlexCache + cas nécessitant un contrôle direct d'AOSS |

Le bucket S3 pour le chemin 2 (`${prefix}-kb-data-${ACCOUNT_ID}`) est toujours créé par StorageStack. Lorsque S3 AP n'est pas disponible, vous pouvez uploader les documents + `.metadata.json` dans ce bucket et le configurer comme source de données KB pour activer le filtrage SID.

### 2. Pendant la recherche (méthode en deux étapes : Retrieve + Converse)

```
User              Next.js API           DynamoDB          Bedrock KB       Converse API
  │                  │                    │                  │                │
  │ Submit question  │                    │                  │                │
  │─────────────────▶│                    │                  │                │
  │                  │ Get SIDs           │                  │                │
  │                  │───────────────────▶│                  │                │
  │                  │◀───────────────────│                  │                │
  │                  │ userSID + groupSIDs│                  │                │
  │                  │                    │                  │                │
  │                  │ Retrieve API (vector search + metadata)│                │
  │                  │─────────────────────────────────────▶│                │
  │                  │◀─────────────────────────────────────│                │
  │                  │ Search results + metadata (SID)      │                │
  │                  │                    │                  │                │
  │                  │ SID Matching       │                  │                │
  │                  │ (User SID ∩        │                  │                │
  │                  │  Document SID)     │                  │                │
  │                  │                    │                  │                │
  │                  │ Generate response using only allowed documents         │
  │                  │──────────────────────────────────────────────────────▶│
  │                  │◀──────────────────────────────────────────────────────│
  │                  │                    │                  │                │
  │ Filtered results │                    │                  │                │
  │◀─────────────────│                    │                  │                │
```

> Raison de l'utilisation de l'API Retrieve au lieu de l'API RetrieveAndGenerate : L'API RetrieveAndGenerate n'inclut pas `allowed_group_sids` de `.metadata.json` dans le champ `metadata` de la citation, rendant le filtrage SID impossible. Comme l'API Retrieve retourne correctement les métadonnées, la méthode en deux étapes (Retrieve → filtre SID → Converse) est adoptée.

### 3. Pendant la recherche en mode Agent (méthode hybride)

En mode Agent, une méthode hybride est adoptée pour réaliser un RAG sensible aux permissions. Comme l'API InvokeAgent ne permet pas le filtrage SID côté application, cela est réalisé par une combinaison de l'API KB Retrieve + filtrage SID + API Converse (avec le prompt système de l'Agent).

```
User              Next.js API           Bedrock KB          DynamoDB         Converse API
  │                  │                    │                    │                │
  │ Submit question  │                    │                    │                │
  │─────────────────▶│                    │                    │                │
  │                  │ Retrieve API       │                    │                │
  │                  │───────────────────▶│                    │                │
  │                  │◀───────────────────│                    │                │
  │                  │ Results + metadata │                    │                │
  │                  │                    │                    │                │
  │                  │ Get SIDs                                │                │
  │                  │────────────────────────────────────────▶│                │
  │                  │◀────────────────────────────────────────│                │
  │                  │                    │                    │                │
  │                  │ SID Filtering      │                    │                │
  │                  │ (Same as KB mode)  │                    │                │
  │                  │                    │                    │                │
  │                  │ Generate response with allowed docs + Agent system prompt│
  │                  │─────────────────────────────────────────────────────────▶│
  │                  │◀─────────────────────────────────────────────────────────│
  │                  │                    │                    │                │
  │ Agent response   │                    │                    │                │
  │ + Citations      │                    │                    │                │
  │◀─────────────────│                    │                    │                │
```

> L'API InvokeAgent de Bedrock Agent est également disponible, mais comme l'API InvokeAgent ne permet pas le filtrage SID côté application, elle n'est utilisée que comme repli. La méthode hybride est la méthode par défaut pour garantir un comportement sensible aux permissions.

---

## Exemple de réponse API

### Journal de filtrage (filterLog)

```json
{
  "totalDocuments": 5,
  "allowedDocuments": 2,
  "deniedDocuments": 3,
  "userId": "4704eaa8-3041-70d9-672b-e4fbb65bec40",
  "userSIDs": [
    "S-1-5-21-0000000000-0000000000-0000000000-1001",
    "S-1-1-0"
  ],
  "filterMethod": "SID_MATCHING",
  "details": [
    {
      "fileName": "product-catalog.md",
      "documentSIDs": ["S-1-1-0"],
      "matched": true,
      "matchedSID": "S-1-1-0"
    },
    {
      "fileName": "financial-report.md",
      "documentSIDs": ["S-1-5-21-0000000000-0000000000-0000000000-512"],
      "matched": false
    }
  ]
}
```

---

## Conception de la sécurité

### Principe de repli de sécurité

Ce système suit le principe "Fail-Closed", refusant l'accès à tous les documents lorsque les vérifications de permissions échouent.

| Situation | Comportement |
|-----------|-------------|
| Erreur de connexion DynamoDB | Refuser tous les documents |
| Pas d'enregistrement SID utilisateur | Refuser tous les documents |
| Pas d'informations SID dans les métadonnées | Refuser le document correspondant |
| Pas de correspondance SID | Refuser le document correspondant |
| Correspondance SID trouvée | Autoriser le document correspondant |

### Cache des permissions

Les résultats de filtrage sont mis en cache dans la table DynamoDB `permission-cache` pour accélérer les vérifications répétées pour la même combinaison utilisateur et document (TTL : 5 minutes).