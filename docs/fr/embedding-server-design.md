# Document de conception et d'implémentation du serveur d'Embedding

**🌐 Language:** [日本語](../embedding-server-design.md) | [English](../en/embedding-server-design.md) | [한국어](../ko/embedding-server-design.md) | [简体中文](../zh-CN/embedding-server-design.md) | [繁體中文](../zh-TW/embedding-server-design.md) | **Français** | [Deutsch](../de/embedding-server-design.md) | [Español](../es/embedding-server-design.md)

**Date de création** : 2026-03-26  
**Public cible** : Développeurs et opérateurs  
**Code source** : `docker/embed/`

---

## Vue d'ensemble

Ce serveur lit les documents sur FSx ONTAP via un montage CIFS/SMB, les vectorise avec Amazon Bedrock Titan Embed Text v2 et les indexe dans OpenSearch Serverless (AOSS).

### Vector Store & Embedding Server

| Configuration | Embedding Server | Description |
|--------------|-----------------|-------------|
| **S3 Vectors** (default) | **Not needed** | Bedrock KB auto-manages via S3 Access Point |
| **OpenSearch Serverless** | **Optional** | Alternative when S3 AP unavailable |

> **S3 Vectors (default): this document is for reference only.** Bedrock KB Ingestion Job handles all processing automatically.

> **Remarque** : Le serveur d'Embedding n'est disponible que dans la configuration AOSS (`vectorStoreType=opensearch-serverless`). Avec la configuration S3 Vectors (par défaut), Bedrock KB gère automatiquement l'Embedding, donc le serveur d'Embedding n'est pas nécessaire.

Il est utilisé comme chemin alternatif (Option B) lorsque la source de données S3 de Bedrock KB (Option A) ou le S3 Access Point (Option C) ne peut pas être utilisé.

---

## Architecture

```
FSx ONTAP Volume (/data)
  │ CIFS/SMB Mount
  ▼
EC2 (m5.large) /tmp/data
  │
  ▼
Docker Container (embed-app)
  ├── 1. File scan (recursive, .md/.txt/.html, etc.)
  ├── 2. Read SID information from .metadata.json
  ├── 3. Text chunk splitting (1000 chars, 200 char overlap)
  ├── 4. Vectorize with Bedrock Titan Embed v2 (1024 dimensions)
  └── 5. Index into AOSS (Bedrock KB compatible format)
          │
          ▼
      OpenSearch Serverless
      (bedrock-knowledge-base-default-index)
```

---

## Structure du code source

```
docker/embed/
├── src/
│   ├── index.ts       # Traitement principal (scan → chunk → Embedding → index)
│   └── oss-client.ts  # Client de signature SigV4 pour AOSS (support auth IMDS)
├── Dockerfile         # Base node:22-slim + cifs-utils
├── buildspec.yml      # Définition de build CodeBuild
├── package.json       # AWS SDK v3, chokidar, dotenv
└── tsconfig.json
```

---

## Modes d'exécution

| Mode | Variable d'environnement | Comportement |
|------|--------------------------|-------------|
| Mode batch | `ENV_WATCH_MODE=false` (par défaut) | Traite tous les fichiers une fois et se termine |
| Mode surveillance | `ENV_WATCH_MODE=true` | Détecte les modifications de fichiers avec chokidar et traite automatiquement |

---

## Variables d'environnement

| Variable | Valeur par défaut | Description |
|----------|-------------------|-------------|
| `ENV_REGION` | `ap-northeast-1` | Région AWS |
| `ENV_DATA_DIR` | `/opt/netapp/ai/data` | Répertoire de données monté via CIFS |
| `ENV_DB_DIR` | `/opt/netapp/ai/db` | Emplacement de stockage des enregistrements de fichiers traités |
| `ENV_EMBEDDING_MODEL_ID` | `amazon.titan-embed-text-v2:0` | Modèle d'Embedding |
| `ENV_INDEX_NAME` | `bedrock-knowledge-base-default-index` | Nom de l'index AOSS |
| `ENV_OPEN_SEARCH_SERVERLESS_COLLECTION_NAME` | (requis) | Nom de la collection AOSS |
| `ENV_WATCH_MODE` | `false` | Activer le mode surveillance |
| `ENV_AUTO_METADATA` | `false` | Génération automatique de .metadata.json via l'API REST ONTAP |
| `ENV_ONTAP_MGMT_IP` | (vide) | IP du point de gestion ONTAP |
| `ENV_ONTAP_SVM_UUID` | (vide) | UUID de la SVM |
| `ENV_ONTAP_USERNAME` | `fsxadmin` | Nom d'utilisateur administrateur ONTAP |
| `ENV_ONTAP_PASSWORD` | (vide) | Mot de passe administrateur ONTAP |

---

## Flux de traitement

### Mode batch

```
1. Initialiser le client AOSS (récupérer le point de terminaison de la collection)
2. Charger processed.json (pour le traitement différentiel)
3. Scanner récursivement DATA_DIR (.md, .txt, .html, .csv, .json, .xml)
4. Pour chaque fichier :
   a. Ignorer si le mtime correspond à processed.json
   b. Utiliser .metadata.json s'il existe
   c. Si .metadata.json n'existe pas et ENV_AUTO_METADATA=true :
      - Récupérer l'ACL via l'API REST ONTAP (`GET /api/protocols/file-security/permissions/{SVM_UUID}/{PATH}`)
      - Extraire le SID de l'ACL et générer/écrire automatiquement .metadata.json
   d. Lire le texte → découper en chunks (1000 caractères, 200 caractères de chevauchement)
   e. Vectoriser chaque chunk avec Bedrock Titan Embed v2
   f. Indexer dans AOSS (format compatible Bedrock KB)
   g. Mettre à jour processed.json
5. Afficher le résumé du traitement et quitter
```

### Mode surveillance

```
1-5. Identique au mode batch (scan initial)
6. Démarrer la surveillance des fichiers avec chokidar
   - awaitWriteFinish : 2 secondes (attendre la fin de l'écriture)
7. Événements d'ajout/modification de fichiers → ajout à la file d'attente
8. Traitement séquentiel depuis la file d'attente (prévention de l'exécution parallèle)
   - processFile() → mise à jour de processed.json
9. Attente en boucle infinie
```

---

## Mécanisme de traitement différentiel

Les chemins de fichiers et les dates de modification (mtime) sont enregistrés dans `processed.json`.

```json
{
  "public/company-overview.md": {
    "mtime": "2026-03-24T23:55:50.000Z",
    "indexedAt": "2026-03-25T05:30:00.000Z"
  }
}
```

- Ignorer si le mtime du fichier n'a pas changé
- Retraiter si le fichier a été mis à jour (écraser l'index)
- Supprimer `processed.json` pour retraiter tous les fichiers

### Différences par rapport aux versions précédentes

| Élément | Version précédente | Version actuelle |
|---------|-------------------|-----------------|
| Gestion différentielle | SQLite (drizzle-orm + better-sqlite3) | Fichier JSON (processed.json) |
| Identification des fichiers | Numéro d'inode (files.ino) | Chemin du fichier + mtime |
| Upload simultané de fichiers en masse | Échec UNIQUE constraint | ✅ Traitement sécurisé via file d'attente séquentielle |
| Dépendances | drizzle-orm, better-sqlite3 | Aucune (fs standard) |

---

## Format d'index AOSS

Seuls 3 champs compatibles Bedrock KB sont écrits.

```json
{
  "bedrock-knowledge-base-default-vector": [0.123, -0.456, ...],  // 1024 dimensions
  "AMAZON_BEDROCK_TEXT_CHUNK": "Document text chunk",
  "AMAZON_BEDROCK_METADATA": "{\"source\":\"public/company-overview.md\",\"allowed_group_sids\":[\"S-1-1-0\"],\"access_level\":\"public\"}"
}
```

### Important : Compatibilité du schéma d'index AOSS

L'index AOSS est créé avec `dynamic: false`. Cela signifie :
- Le mapping de l'index ne change pas même si des champs autres que les 3 ci-dessus sont écrits
- La synchronisation Bedrock KB ne provoque pas d'erreurs "storage configuration invalid"
- Les métadonnées (informations SID, etc.) sont stockées sous forme de chaîne JSON dans le champ `AMAZON_BEDROCK_METADATA`

### Structure des métadonnées

Chaque document nécessite un fichier `.metadata.json` correspondant. En incluant les informations SID des ACL NTFS dans ce fichier, le contrôle d'accès lors de la recherche RAG est réalisé.

#### Comment obtenir les informations SID pour `.metadata.json`

Ce système dispose d'un mécanisme pour récupérer automatiquement les SID à partir des ACL NTFS.

| Composant | Fichier d'implémentation | Fonction |
|-----------|--------------------------|----------|
| AD Sync Lambda | `lambda/agent-core-ad-sync/index.ts` | Exécute PowerShell via SSM pour récupérer les informations SID des utilisateurs AD et les stocker dans DynamoDB |
| FSx Permission Service | `lambda/permissions/fsx-permission-service.ts` | Exécute Get-Acl via SSM pour récupérer les ACL NTFS (SID) des fichiers/répertoires |
| Configuration AD Sync | `types/agentcore-config.ts` (`AdSyncConfig`) | Paramètres d'activation de la synchronisation AD, TTL du cache, timeout SSM, etc. |

Ce sont des options d'extension futures. Dans la configuration actuelle du stack de démonstration (`lib/stacks/demo/`), des fichiers `.metadata.json` d'exemple sont placés manuellement à des fins de vérification.

#### Flux de traitement de récupération automatique des SID

```
1. AD Sync Lambda (récupération des SID utilisateurs)
   SSM → Windows EC2 → PowerShell (Get-ADUser) → Récupérer SID → Stocker dans DynamoDB user-access

2. FSx Permission Service (récupération des ACL de fichiers)
   SSM → Windows EC2 → PowerShell (Get-Acl) → Récupérer ACL NTFS → Extraire SID → Peut générer .metadata.json
```

#### Configuration simplifiée pour l'environnement de démonstration

Le stack de démonstration n'utilise pas l'automatisation ci-dessus et configure les données SID via les étapes manuelles suivantes :

- `.metadata.json` : Exemples placés manuellement sous `demo-data/documents/`
- DynamoDB user-access : Enregistrement manuel des correspondances email-SID avec `demo-data/scripts/setup-user-access.sh`

#### Options d'automatisation pour l'environnement de production

| Méthode | Description |
|---------|-------------|
| AD Sync Lambda | Récupère automatiquement les SID des utilisateurs AD via SSM et les stocke dans DynamoDB (implémenté) |
| FSx Permission Service | Récupère les ACL NTFS via Get-Acl par SSM (implémenté) |
| API REST ONTAP | Récupère directement les ACL via le point de gestion FSx ONTAP (implémenté : `ENV_AUTO_METADATA=true`) |
| S3 Access Point | Les ACL NTFS sont automatiquement appliquées lors de l'accès aux fichiers via S3 AP (supporté par CDK : `useS3AccessPoint=true`) |

#### Lors de l'utilisation du S3 Access Point (Option C)

Lorsque Bedrock KB ingère des documents via S3 Access Point, les ACL NTFS sont automatiquement appliquées via le `FileSystemIdentity` (type WINDOWS) du S3 Access Point. Cependant, le fait que les métadonnées retournées par l'API Retrieve de Bedrock KB incluent les informations ACL dépend de l'implémentation du S3 Access Point. À ce stade, la gestion des SID via `.metadata.json` est la méthode fiable.

#### Format `.metadata.json`

```json
// .metadata.json
{
  "metadataAttributes": {
    "allowed_group_sids": ["S-1-5-21-...-512"],
    "access_level": "confidential",
    "department": "finance"
  }
}

// → Valeur stockée dans AMAZON_BEDROCK_METADATA
{
  "source": "confidential/financial-report.md",
  "x-amz-bedrock-kb-source-uri": "s3://fsx-ontap/confidential/financial-report.md",
  "allowed_group_sids": ["S-1-5-21-...-512"],
  "access_level": "confidential",
  "department": "finance"
}
```

---

## Authentification AOSS (signature SigV4)

`oss-client.ts` accède à AOSS en utilisant la signature AWS SigV4.

- Récupère automatiquement les identifiants depuis le profil d'instance EC2 (IMDS)
- Utilise defaultProvider de `@aws-sdk/credential-provider-node`
- Les identifiants sont automatiquement rafraîchis 5 minutes avant expiration
- Le nom de service pour AOSS est `aoss`

---

## Gestion de l'upload simultané de fichiers en masse

Lorsque 20 fichiers ou plus sont uploadés simultanément en mode surveillance :

1. Attendre la fin de l'écriture avec `awaitWriteFinish` de chokidar (2 secondes)
2. Chaque événement de fichier est ajouté à une file d'attente
3. Traitement d'un fichier à la fois depuis la file d'attente (contrôle exclusif via le flag `processing`)
4. Attente de 200ms après l'Embedding de chaque chunk (contre-mesure pour la limite de débit de l'API Bedrock)
5. Mise à jour de `processed.json` après la fin du traitement

Cela garantit :
- Aucune violation de la limite de débit de l'API Bedrock
- Aucune écriture concurrente dans `processed.json`
- Si le processus s'arrête pendant le traitement, les fichiers déjà enregistrés dans `processed.json` ne sont pas retraités

---

## Stack CDK

`DemoEmbeddingStack` (`lib/stacks/demo/demo-embedding-stack.ts`) crée les ressources suivantes :

| Ressource | Description |
|-----------|-------------|
| Instance EC2 (m5.large) | IMDSv2 imposé, SSM activé |
| Dépôt ECR | Pour les images de conteneur d'Embedding |
| Rôle IAM | SSM, FSx, AOSS, Bedrock, ECR, Secrets Manager |
| Groupe de sécurité | Communication autorisée avec le SG FSx + SG AD |
| UserData | Montage CIFS automatique + démarrage automatique de Docker |

### Activation

```bash
npx cdk deploy <PREFIX>-Embedding \
  --app "npx ts-node bin/demo-app.ts" \
  -c enableEmbeddingServer=true \
  -c embeddingAdSecretArn=<SECRETS_MANAGER_ARN> \
  --require-approval never
```

---

## Dépannage

| Symptôme | Cause | Résolution |
|----------|-------|------------|
| AOSS 403 Forbidden | Rôle EC2 non ajouté à la politique d'accès aux données | Ajouter le rôle EC2 d'Embedding à la politique AOSS |
| Bedrock ThrottlingException | Limite de débit de l'API dépassée | Augmenter le temps d'attente entre les chunks (200ms → 500ms) |
| Échec du montage CIFS | SVM non jointe à l'AD ou partage CIFS non créé | Vérifier la jonction AD + créer le partage CIFS via l'API REST ONTAP |
| processed.json corrompu | Processus interrompu | Supprimer `processed.json` et relancer |
| Erreur de synchronisation KB (storage config invalid) | Des champs incompatibles avec KB existent dans l'index AOSS | Supprimer l'index → recréer → recréer la source de données → synchroniser |
| Tous les documents REFUSÉS par le filtrage SID | Les documents via le serveur d'Embedding n'ont pas de métadonnées | Vérifier que `.metadata.json` existe et que `allowed_group_sids` est défini |

---

## Documents associés

| Document | Contenu |
|----------|---------|
| [README.md](../../README.fr.md) | Étapes de déploiement (Option B) |
| [docs/implementation-overview.md](implementation-overview.md) | Vue d'ensemble de l'implémentation (Point 5 : Serveur d'Embedding) |
| [docs/ui-specification.md](ui-specification.md) | Spécification de l'interface utilisateur (affichage des répertoires) |
| [docs/demo-environment-guide.md](demo-environment-guide.md) | Procédures d'exploitation pour l'environnement de vérification |
