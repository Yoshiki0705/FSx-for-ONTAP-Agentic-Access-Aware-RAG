# Guide d'architecture S3 Vectors + filtrage SID

**🌐 Language:** [日本語](../s3-vectors-sid-architecture-guide.md) | [English](../en/s3-vectors-sid-architecture-guide.md) | [한국어](../ko/s3-vectors-sid-architecture-guide.md) | [简体中文](../zh-CN/s3-vectors-sid-architecture-guide.md) | [繁體中文](../zh-TW/s3-vectors-sid-architecture-guide.md) | **Français** | [Deutsch](../de/s3-vectors-sid-architecture-guide.md) | [Español](../es/s3-vectors-sid-architecture-guide.md)

**Date de création** : 2026-03-29
**Environnement de vérification** : ap-northeast-1 (Tokyo)
**Statut** : Déploiement CDK vérifié, filtrage SID vérifié

---

## Vue d'ensemble

Ce document résume les décisions architecturales pour l'adoption d'Amazon S3 Vectors comme vector store pour un système RAG sensible aux permissions, ainsi que les patterns d'intégration pour le contrôle d'accès basé sur les SID. Il inclut les résultats de vérification et les recommandations en réponse aux retours d'experts.

---

## Évaluation des patterns de filtrage SID

### Approche actuelle de ce système

Ce système utilise l'API Retrieve de Bedrock KB pour effectuer des recherches vectorielles et fait correspondre le champ `allowed_group_sids` dans les métadonnées retournées côté application. Cette approche est indépendante du vector store.

```
Bedrock KB Retrieve API → Search results + Metadata (allowed_group_sids)
→ Application-side matching: User SID ∩ Document SID
→ Call Converse API only with matched documents
```

### Pattern A : Attacher le SID comme métadonnée filtrable (pattern recommandé)

Comme toutes les métadonnées dans S3 Vectors sont filtrables par défaut, `allowed_group_sids` peut être filtré sans configuration supplémentaire.

#### Application dans ce système

Comme ce système accède à S3 Vectors via Bedrock KB, le paramètre de filtre `QueryVectors` ne peut pas être contrôlé directement. L'API Retrieve de Bedrock KB effectue la recherche vectorielle et retourne les résultats incluant les métadonnées. Le filtrage SID est effectué côté application.

Avantages de cette approche :
- L'API Retrieve de Bedrock KB est indépendante du vector store, donc le même code applicatif fonctionne avec S3 Vectors et AOSS
- `allowed_group_sids` de `.metadata.json` est stocké et retourné tel quel comme métadonnée
- La logique de filtrage SID côté application (`route.ts`) ne nécessite aucune modification

#### Réponse aux retours d'experts

> Veuillez vous assurer par des tests que l'application applique toujours le filtre SID. Le filtre de métadonnées S3 Vectors est pratique, mais il ne remplace pas le contrôle d'accès lui-même.

Ce système garantit cela par les moyens suivants :
1. Le filtrage SID est intégré dans la route API KB Retrieve (`route.ts`) et ne peut pas être contourné
2. Si les informations SID ne peuvent pas être récupérées depuis DynamoDB, tous les documents sont refusés (principe Fail-Closed)
3. Les tests basés sur les propriétés (Propriété 5) ont vérifié l'indépendance du filtrage SID par rapport au vector store

### Pattern B : Séparation des index par SID/tenant

#### Évaluation pour ce système

Les SID de ce système sont des SID de groupe basés sur les ACL NTFS d'Active Directory, et plusieurs SID sont assignés par document (ex. : `["S-1-5-21-...-512", "S-1-1-0"]`). La séparation des index par SID est inappropriée pour les raisons suivantes :

1. **Relations SID many-to-many** : Un seul document appartient à plusieurs groupes SID, et un seul utilisateur a plusieurs SID. La séparation des index nécessiterait un stockage dupliqué des documents
2. **Changements dynamiques du nombre de SID** : Le nombre de SID fluctue à mesure que des groupes AD sont ajoutés ou modifiés. La gestion des index devient complexe
3. **Limite de 10 000 index/bucket** : Dans les environnements AD à grande échelle, le nombre de SID peut approcher cette limite

#### Considération de conception hybride

Comme les experts l'ont souligné, une conception hybride qui sépare les index par tenant/client et utilise le filtre SID au sein de chaque index est efficace. Comme ce système suppose un seul tenant (environnement AD unique), la séparation des index n'est pas nécessaire pour le moment. Cela sera envisagé lors de l'extension au multi-tenant.

---

## Résultats de vérification de la checklist de migration

### 1. Vérification du modèle d'Embedding / dimensions / métrique

| Élément | Actuel (AOSS) | S3 Vectors | Compatibilité |
|---------|---------------|-----------|---------------|
| Modèle d'Embedding | Amazon Titan Embed Text v2 | Identique | ✅ |
| Dimensions | 1024 | 1024 | ✅ |
| Métrique de distance | l2 (AOSS/faiss) | cosine (S3 Vectors) | ⚠️ Vérification nécessaire |
| Type de données | - | float32 (requis) | ✅ |

> **Remarque** : L'AOSS actuel utilise l2 (distance euclidienne), tandis que S3 Vectors utilise cosine. Comme Bedrock KB gère la cohérence entre l'embedding et la métrique, il n'y a pas de problème lors de l'accès via KB. Cependant, soyez conscient de la différence de métrique lors de l'utilisation directe de l'API S3 Vectors. S3 Vectors ne permet pas de changer les dimensions et la métrique après la création de l'index.

### 2. Conception des métadonnées

| Clé de métadonnée | Objectif | Filtrable | Notes |
|-------------------|---------|-----------|-------|
| `allowed_group_sids` | Filtrage SID | non-filterable recommandé | Le filtre S3 Vectors n'est pas nécessaire car le filtrage côté application est fait via l'API Retrieve de Bedrock KB |
| `access_level` | Affichage du niveau d'accès | non-filterable recommandé | Pour l'affichage UI |
| `doc_type` | Type de document | non-filterable recommandé | Pour le filtrage futur |
| `source_uri` | Chemin du fichier source | non-filterable | Non recherchable, référence uniquement |
| `chunk_text` | Texte du chunk | non-filterable | Non recherchable, données volumineuses |

#### Contraintes de métadonnées S3 Vectors (valeurs réelles découvertes lors de la vérification)

| Contrainte | Valeur nominale | Valeur effective avec Bedrock KB | Atténuation |
|-----------|---------------|-------------------------------|------------|
| Métadonnées filtrables | 2 Ko/vecteur | **Métadonnées personnalisées jusqu'à 1 Ko** (le 1 Ko restant est consommé par les métadonnées internes de Bedrock KB) | Minimiser les métadonnées personnalisées |
| Clés de métadonnées non filtrables | Max 10 clés/index | 10 clés (5 clés auto Bedrock KB + 5 clés personnalisées) | Prioriser les clés auto Bedrock KB comme non filtrables |
| Total des clés de métadonnées | Max 50 clés/vecteur | 35 clés (lors de l'utilisation de Bedrock KB) | Pas de problème |

#### Clés de métadonnées automatiquement ajoutées par Bedrock KB

Les clés suivantes sont automatiquement stockées par Bedrock KB dans S3 Vectors. Si elles ne sont pas incluses dans `nonFilterableMetadataKeys`, elles sont traitées comme filtrables et consomment la limite de 2 Ko.

| Clé | Description | non-filterable recommandé |
|-----|-------------|---------------------------|
| `x-amz-bedrock-kb-source-file-modality` | Type de fichier (TEXT, etc.) | ✅ |
| `x-amz-bedrock-kb-chunk-id` | ID du chunk (UUID) | ✅ |
| `x-amz-bedrock-kb-data-source-id` | ID de la source de données | ✅ |
| `x-amz-bedrock-kb-source-uri` | URI source | ✅ |
| `x-amz-bedrock-kb-document-page-number` | Numéro de page PDF | ✅ |

> **Important** : Les métadonnées filtrables peuvent dépasser 2 Ko en raison des métadonnées de numéro de page PDF, etc. Incluez toutes les clés auto Bedrock KB dans `nonFilterableMetadataKeys` et rendez les métadonnées personnalisées non filtrables autant que possible.

### 3. Pré-vérification des permissions insuffisantes

Actions IAM requises confirmées par la vérification :

```
KB Role (for Bedrock KB):
  s3vectors:QueryVectors   ← Required for search
  s3vectors:PutVectors     ← Required for data sync
  s3vectors:DeleteVectors  ← Required for data sync
  s3vectors:GetVectors     ← Required for metadata retrieval (as experts pointed out)
  s3vectors:ListVectors    ← Found to be required during verification

Custom Resource Lambda (for resource management):
  s3vectors:CreateVectorBucket
  s3vectors:DeleteVectorBucket
  s3vectors:CreateIndex
  s3vectors:DeleteIndex
  s3vectors:ListVectorBuckets
  s3vectors:GetVectorBucket
  s3vectors:ListIndexes
  s3vectors:GetIndex
```

> **Découvert lors de la vérification** : Non seulement `s3vectors:GetVectors` mais aussi `s3vectors:ListVectors` est requis pour le rôle KB. L'absence de cette permission provoque une erreur 403.

### 4. Vérification des performances

> **Statut** : Vérification du déploiement CDK terminée. Vérification de la latence de l'API Retrieve terminée.

Performances nominales de S3 Vectors :
- Requête à froid : Sous-seconde (moins d'1 seconde)
- Requête à chaud : ~100 ms ou moins
- Requêtes haute fréquence : Latence réduite

Résultats de vérification de l'API Retrieve (2 documents, ap-northeast-1) :
- Confirmé que l'API Retrieve de Bedrock KB retourne correctement les métadonnées SID (`allowed_group_sids`)
- Document public : `allowed_group_sids: ["S-1-1-0"]` (SID Everyone)
- Document confidentiel : `allowed_group_sids: ["S-1-5-21-...-512"]` (SID Domain Admins)
- Les métadonnées personnalisées telles que `access_level` et `doc_type` sont également correctement retournées
- La logique de filtrage SID existante (`route.ts`) fonctionne sans modification

### 5. Conception de migration par phases

Ce système supporte la migration par phases via le basculement du paramètre de contexte CDK `vectorStoreType` :

1. **Phase 1** : Nouveau déploiement avec `vectorStoreType=s3vectors` (environnement de vérification) ← Actuellement ici
2. **Phase 2** : Ajout/synchronisation de source de données, vérification de la récupération des métadonnées SID via l'API Retrieve
3. **Phase 3** : Vérification des performances (latence, concurrence)
4. **Phase 4** : Décision sur l'adoption en environnement de production

La migration d'AOSS vers S3 Vectors peut être réalisée en re-synchronisant la source de données Bedrock KB (les données vectorielles sont auto-générées par KB, donc la migration manuelle est inutile).

---

## Résultats de vérification du déploiement CDK

### Environnement de vérification

- Région : ap-northeast-1 (Tokyo)
- Noms des stacks : s3v-test-val-AI (vérification autonome), perm-rag-demo-demo-* (vérification full stack)
- vectorStoreType : s3vectors
- Temps de déploiement : Stack AI autonome ~83 secondes, full stack (6 stacks) ~30 minutes

### Résultats de vérification E2E full stack (30/03/2026)

La vérification E2E de la configuration S3 Vectors a été effectuée avec les 6 stacks déployés (Networking, Security, Storage, AI, WebApp + WAF).

#### Vérification du fonctionnement du filtrage SID

| Utilisateur | SID | Question | Documents référencés | Résultat |
|------|-----|----------|---------------------|--------|
| admin@example.com | Domain Admins (-512) + Everyone (S-1-1-0) | "Parlez-moi du chiffre d'affaires de l'entreprise" | confidential/financial-report.txt + public/product-catalog.txt (2 docs) | ✅ La réponse inclut les informations de CA de 15 milliards de yens |
| user@example.com | Regular User (-1001) + Everyone (S-1-1-0) | "Parlez-moi du chiffre d'affaires de l'entreprise" | public/product-catalog.txt (1 doc uniquement) | ✅ Pas d'informations de CA (document confidentiel correctement exclu) |

#### Vérification du mode Agent (admin@example.com)

| Test | Question | Résultat |
|------|----------|--------|
| Recherche KB via Agent Action Group | "Parlez-moi du chiffre d'affaires de l'entreprise" | ✅ La réponse inclut les informations de CA de 15 milliards de yens. L'Agent appelle l'API Retrieve via le Permission-aware Search Action Group et génère la réponse à partir des résultats filtrés par SID |

Leçons du mode Agent :
- Le Bedrock Agent Action Group utilise l'API Retrieve de Bedrock KB, donc il est indépendant du type de vector store (S3 Vectors / AOSS)
- L'Agent créé via CDK (`enableAgent=true`) fonctionne normalement en état PREPARED même avec la configuration S3 Vectors
- Le filtrage SID via l'Agent utilise la même logique que le mode KB (approche hybride `route.ts`)

#### Leçons supplémentaires découvertes lors de la vérification

| # | Leçon | Impact |
|---|--------|--------|
| 1 | L'application envoie l'adresse e-mail comme userId au lieu du sub Cognito | Les clés DynamoDB doivent être enregistrées avec les adresses e-mail |
| 2 | La jonction SVM AD nécessite l'ouverture des ports AD dans le groupe de sécurité VPC | Les ports 636, 135, 464, 3268-3269, 1024-65535 doivent être ajoutés au SG FSx. Mise à jour requise dans le CDK NetworkingStack |
| 3 | Dépendance `@aws-sdk/client-scheduler` manquante | Causé par des ajouts de fonctionnalités dans d'autres threads. Résolu en ajoutant à package.json |
| 4 | La jonction SVM AD nécessite la spécification de l'OU | Pour AWS Managed AD, `OrganizationalUnitDistinguishedName` doit spécifier `OU=Computers,OU=<ShortName>,DC=<domain>,DC=<tld>` |
| 5 | L'accès FSx ONTAP S3 AP nécessite la configuration de la politique du bucket | Le rôle assumé SSO ne peut pas accéder au S3 AP par défaut. La politique S3 AP (`s3:*`) + la politique basée sur l'identité IAM (pattern ARN S3 AP) sont toutes deux requises. De plus, les fichiers doivent exister sur le volume et l'ACL NTFS doit autoriser l'accès (autorisation à double couche) |
| 6 | FSx ONTAP S3 AP utilise un modèle d'autorisation à double couche | L'authentification IAM (politique S3 AP + politique basée sur l'identité) et l'authentification du système de fichiers (ACL NTFS) sont toutes deux requises. AccessDenied se produit également lorsque le volume est vide ou que le partage CIFS n'est pas créé |
| 7 | Le mot de passe admin FSx ONTAP est séparé du mot de passe AD CDK | Le mot de passe `fsxadmin` de FSx ONTAP est auto-généré à la création du système de fichiers. Ce mot de passe est requis pour la création du partage CIFS via l'API REST ONTAP. Définissez `FsxAdminPassword` dans CDK ou définissez-le ultérieurement avec `update-file-system` |
| 8 | Problème AccessDenied de FSx ONTAP S3 AP | **Cause racine identifiée : SCP de l'Organisation**. L'accès S3 AP réussit dans l'ancien compte (pas de restrictions SCP d'Organisation). AccessDenied dans le nouveau compte (avec restrictions SCP d'Organisation). Modification SCP requise dans le compte de gestion de l'Organisation |
| 9 | Limite de 2 Ko des métadonnées filtrables S3 Vectors | Avec Bedrock KB + S3 Vectors, les métadonnées personnalisées sont limitées à **1 Ko** (pas les 2 Ko autonomes de S3 Vectors, car les métadonnées internes de Bedrock KB consomment le 1 Ko restant). **Atténuation** : (1) Minimiser les clés de métadonnées (uniquement `sids`, valeurs courtes), (2) Utiliser des fichiers PDF sans métadonnées, (3) Chemin de repli via bucket S3 vérifié sans problème dans le nouveau compte (pas de limite de 2 Ko avec la configuration AOSS) |

#### Statut de vérification du chemin FSx ONTAP S3 AP

| Étape | Statut | Notes |
|------|--------|-------|
| Jonction SVM AD | ✅ Terminé | Résolu avec spécification OU + ajouts de ports SG |
| Création du partage CIFS | ✅ Terminé | Partage `data` créé via l'API REST ONTAP |
| Placement de fichiers via SMB | ✅ Terminé | Fichiers placés dans public/confidential avec `demo.local\Admin` |
| Création S3 AP | ✅ AVAILABLE | Créé avec le type utilisateur WINDOWS, SVM jointe à l'AD |
| Accès via S3 AP | ❌ AccessDenied (nouveau compte uniquement) | **Cause racine identifiée : SCP de l'Organisation**. L'accès réussit dans l'ancien compte (pas de restrictions SCP). Modification SCP requise dans le compte de gestion de l'Organisation |
| Synchronisation KB (via S3 AP) | ⚠️ Limite de métadonnées 2 Ko | La synchronisation KB via S3 AP elle-même réussit, mais les métadonnées de fichiers PDF peuvent dépasser la limite de 2 Ko |
| Synchronisation KB (via bucket S3) | ✅ Terminé | La synchronisation KB des documents avec métadonnées SID a réussi via le chemin de repli bucket S3 |
| cdk destroy | ✅ Terminé | Les ressources personnalisées S3 Vectors (bucket + index) supprimées normalement. FSx reste en mode de référence FSx existant (par conception) |

> **Chemin alternatif** : La vérification E2E via le chemin de repli bucket S3 (bucket S3 → synchronisation KB → S3 Vectors → filtrage SID) est terminée. Comme le filtrage SID est indépendant du type de vector store et de source de données, les résultats de vérification du chemin bucket S3 s'appliquent également au chemin S3 AP.

### Résultats de vérification de l'export S3 Vectors → OpenSearch Serverless

L'export en un clic depuis la console a été vérifié avec les résultats suivants :

| Étape | Durée | Résultat |
|------|----------|--------|
| Création automatique de la collection AOSS | ~5 minutes | ACTIVE |
| Création automatique du pipeline OSI | ~5 minutes | ACTIVE → Transfert de données démarré |
| Transfert de données terminé | ~5 minutes | Pipeline auto-STOPPING |
| Total | ~15 minutes | Export terminé |

Ressources automatiquement créées lors de l'export :
- Collection AOSS (`s3vectors-collection-<timestamp>`)
- Pipeline OSI (`s3vectors-pipeline<timestamp>`)
- Rôle de service IAM (`S3VectorsOSIRole-<timestamp>`)
- Bucket S3 DLQ

Leçons de l'export :
- L'option "Create and use a new service role" de la console crée automatiquement le rôle IAM. Pas besoin de créer le rôle à l'avance avec un script
- Le pipeline OSI s'arrête automatiquement après la fin du transfert de données (économique)
- La collection AOSS reste interrogeable après l'arrêt du pipeline
- Le max OCU de la collection AOSS est par défaut de 100 (configurable dans la console)
- La politique de confiance du script d'export (`export-to-opensearch.sh`) utilise uniquement `osis-pipelines.amazonaws.com` (`s3vectors.amazonaws.com` est un principal de service invalide dans IAM)

---

## Documents associés

| Document | Contenu |
|----------|---------|
| [SID-Filtering-Architecture.md](SID-Filtering-Architecture.md) | Détails de la conception du filtrage SID |
| [stack-architecture-comparison.md](stack-architecture-comparison.md) | Tableau de comparaison des 3 configurations et leçons d'implémentation |
| [.kiro/specs/s3-vectors-integration/design.md](../.kiro/specs/s3-vectors-integration/design.md) | Document de conception technique |
| [.kiro/specs/s3-vectors-integration/requirements.md](../.kiro/specs/s3-vectors-integration/requirements.md) | Document d'exigences |