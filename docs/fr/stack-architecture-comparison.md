# Guide d'architecture des stacks CDK

**🌐 Language:** [日本語](../stack-architecture-comparison.md) | [English](../en/stack-architecture-comparison.md) | [한국어](../ko/stack-architecture-comparison.md) | [简体中文](../zh-CN/stack-architecture-comparison.md) | [繁體中文](../zh-TW/stack-architecture-comparison.md) | **Français** | [Deutsch](../de/stack-architecture-comparison.md) | [Español](../es/stack-architecture-comparison.md)

**Dernière mise à jour** : 2026-03-31  
**Statut** : Consolidé sur la lignée du stack de démonstration, intégration S3 Vectors vérifiée

---

## Vue d'ensemble

Tous les stacks CDK sont consolidés sous `lib/stacks/demo/`. Le seul point d'entrée est `bin/demo-app.ts`. Les fonctionnalités optionnelles peuvent être activées via les paramètres de contexte CDK.

---

## Comparaison des fonctionnalités

| Fonctionnalité | Stack de démonstration (actuel) | Contexte CDK | Notes |
|----------------|-------------------------------|--------------|-------|
| Authentification | Cognito + AD (optionnel) | `adPassword`, `adDomainName` | Cognito uniquement lorsque l'AD n'est pas configuré |
| Récupération automatique des SID | AD Sync Lambda | `adType=managed\|self-managed` | Manuel (`setup-user-access.sh`) lorsque l'AD n'est pas configuré |
| Récupération des ACL NTFS | Génération automatique dans le serveur d'Embedding | `ontapMgmtIp`, `ontapSvmUuid` | `.metadata.json` manuel lorsque non configuré |
| Filtrage des permissions | Dans la route API Next.js (par défaut) | `usePermissionFilterLambda=true` | Peut aussi être migré vers une Lambda dédiée |
| Bedrock Agent | Création dynamique d'Agent + Action Group | `enableAgent=true` | Crée automatiquement un Agent spécifique à la catégorie au clic sur la carte |
| Bedrock Guardrails | Sécurité du contenu + protection PII | `enableGuardrails=true` | |
| Chiffrement KMS | Chiffrement CMK S3 / DynamoDB | `enableKmsEncryption=true` | Rotation des clés activée |
| CloudTrail | Accès aux données S3 + audit Lambda | `enableCloudTrail=true` | Rétention de 90 jours |
| VPC Endpoints | S3, DynamoDB, Bedrock, etc. | `enableVpcEndpoints=true` | Supporte 6 services |
| Serveur d'Embedding | Montage CIFS FlexCache + écriture directe dans le vector store | `enableEmbeddingServer=true` | Chemin de repli lorsque S3 AP n'est pas disponible (configuration AOSS uniquement) |
| Contrôle avancé des permissions | Contrôle d'accès basé sur le temps + journal d'audit des décisions de permissions | `enableAdvancedPermissions=true` | Table DynamoDB `permission-audit` + GSI |

---

## Chemins d'ingestion des données

| Chemin | Méthode | Activation | Cas d'utilisation |
|--------|---------|------------|-------------------|
| Principal | FSx ONTAP → S3 Access Point → Bedrock KB | `post-deploy-setup.sh` | Volumes standard |
| Repli | Upload direct dans le bucket S3 → Bedrock KB | `upload-demo-data.sh` | Lorsque S3 AP n'est pas disponible |
| Alternatif | Montage CIFS → Serveur d'Embedding → Écriture directe dans le vector store | `enableEmbeddingServer=true` | Volumes FlexCache (configuration AOSS uniquement) |

---

## Bedrock KB Ingestion Job — Quotas et considérations de conception

Bedrock KB Ingestion Job est un service géré qui prend en charge la récupération de documents, le découpage, la vectorisation et le stockage. Il lit les données directement depuis FSx ONTAP via S3 Access Point et ne traite que les fichiers modifiés grâce à la synchronisation incrémentielle. Aucun pipeline d'Embedding personnalisé (tel qu'AWS Batch) n'est nécessaire.

### Quotas de service (en date de mars 2026, tous non ajustables)

| Quota | Valeur | Impact sur la conception |
|-------|--------|-------------------------|
| Taille des données par job | 100 Go | Les données excédentaires ne sont pas traitées. Les sources de données dépassant 100 Go doivent être divisées en plusieurs sources de données |
| Taille de fichier par fichier | 50 Mo | Les PDF volumineux doivent être divisés |
| Fichiers ajoutés/mis à jour par job | 5 000 000 | Suffisant pour les volumes de documents d'entreprise typiques |
| Fichiers supprimés par job | 5 000 000 | Idem |
| Fichiers lors de l'utilisation du parseur BDA | 1 000 | Limite lors de l'utilisation du parseur Bedrock Data Automation |
| Fichiers lors de l'utilisation du parseur FM | 1 000 | Limite lors de l'utilisation du parseur Foundation Model |
| Sources de données par KB | 5 | Limite supérieure lors de l'enregistrement de plusieurs volumes comme sources de données individuelles |
| KB par compte | 100 | Considération pour la conception multi-tenant |
| Jobs concurrents par compte | 5 | Contrainte pour la synchronisation parallèle de plusieurs KB |
| Jobs concurrents par KB | 1 | La synchronisation parallèle vers la même KB n'est pas possible. Il faut attendre la fin du job précédent |
| Jobs concurrents par source de données | 1 | Idem |

### Déclencheurs d'exécution et contraintes de fréquence

| Élément | Valeur | Notes |
|---------|--------|-------|
| Débit de l'API StartIngestionJob | 0,1 req/sec (une fois toutes les 10 secondes) | **Non ajustable**. Non adapté à la synchronisation automatique haute fréquence |
| Déclencheur d'exécution | Manuel (API/CLI/Console) | Pas de fonctionnalité de planification automatique côté Bedrock KB |
| Méthode de synchronisation | Synchronisation incrémentielle | Traite uniquement les ajouts, modifications et suppressions. Le retraitement complet n'est pas nécessaire |
| Durée de synchronisation | Dépend du volume de données (de quelques dizaines de secondes à plusieurs heures) | Petite échelle (dizaines de fichiers) : 30 sec–2 min, Grande échelle : heures |

### Planification de la synchronisation automatique

Comme Bedrock KB ne dispose pas de fonctionnalité de synchronisation planifiée intégrée, implémentez la synchronisation périodique avec les méthodes suivantes si nécessaire :

```bash
# Exécution périodique avec EventBridge Scheduler (ex. : toutes les heures)
aws scheduler create-schedule \
  --name kb-sync-hourly \
  --schedule-expression "rate(1 hour)" \
  --target '{"Arn":"arn:aws:bedrock:ap-northeast-1:ACCOUNT_ID:knowledge-base/KB_ID","RoleArn":"arn:aws:iam::ACCOUNT_ID:role/scheduler-role","Input":"{\"dataSourceId\":\"DS_ID\"}"}' \
  --flexible-time-window '{"Mode":"OFF"}'
```

Alternativement, vous pouvez détecter les modifications de fichiers sur FSx ONTAP via les notifications d'événements S3 et déclencher un Ingestion Job. Cependant, soyez conscient de la limite de débit de l'API StartIngestionJob (une fois toutes les 10 secondes).

### Recommandations de conception

1. **Fréquence de synchronisation** : La synchronisation en temps réel n'est pas possible. L'intervalle minimum est de 10 secondes ; en pratique, 15 minutes à 1 heure est recommandé
2. **Données à grande échelle** : Les sources de données dépassant 100 Go doivent être réparties sur plusieurs volumes FSx ONTAP (= plusieurs S3 AP = plusieurs sources de données)
3. **Traitement parallèle** : La synchronisation parallèle vers la même KB n'est pas possible. Synchronisez les sources de données multiples séquentiellement
4. **Gestion des erreurs** : Implémentez une logique de réessai pour les échecs de jobs (surveillez le statut avec `GetIngestionJob`)
5. **Pas besoin de pipeline d'Embedding personnalisé** : Comme Bedrock KB gère le découpage, la vectorisation et le stockage, les pipelines personnalisés tels qu'AWS Batch sont inutiles

---

## Structure des stacks CDK (7 stacks)

| # | Stack | Requis/Optionnel | Description |
|---|-------|------------------|-------------|
| 1 | WafStack | Requis | WAF pour CloudFront (us-east-1) |
| 2 | NetworkingStack | Requis | VPC, Sous-réseaux, SG |
| 3 | SecurityStack | Requis | Cognito User Pool |
| 4 | StorageStack | Requis | FSx ONTAP + SVM + Volume (ou référence existante), S3, DynamoDB×2 |
| 5 | AIStack | Requis | Bedrock KB, S3 Vectors ou OpenSearch Serverless, Agent (optionnel) |
| 6 | WebAppStack | Requis | Lambda Web Adapter + CloudFront |
| 7 | EmbeddingStack | Optionnel | Montage CIFS FlexCache + serveur d'Embedding |

### Mode de référence FSx for ONTAP existant

StorageStack peut référencer des ressources FSx ONTAP existantes en utilisant les paramètres `existingFileSystemId`/`existingSvmId`/`existingVolumeId`. Dans ce cas :
- La création de nouveaux FSx/SVM/Volume est ignorée (réduit le temps de déploiement de 30-40 minutes)
- La création de Managed AD est également ignorée (utilise la configuration AD de l'environnement existant)
- Les buckets S3, les tables DynamoDB et les ressources personnalisées S3 AP sont créés normalement
- `cdk destroy` ne supprime pas FSx/SVM/Volume (hors gestion CDK)

---

## Comparaison des configurations de vector store

La configuration du vector store peut être changée via le paramètre de contexte CDK `vectorStoreType`. La troisième configuration (S3 Vectors + Export AOSS) est fournie comme procédure opérationnelle pour l'export à la demande en complément de la configuration S3 Vectors.

> **Support régional** : S3 Vectors est disponible dans `ap-northeast-1` (région Tokyo).

| Élément | OpenSearch Serverless | S3 Vectors autonome | S3 Vectors + Export AOSS |
|---------|----------------------|---------------------|--------------------------|
| **Paramètre CDK** | `vectorStoreType=opensearch-serverless` | `vectorStoreType=s3vectors` (par défaut) | Exécuter `export-to-opensearch.sh` en complément de la configuration 2 |
| **Coût** | ~700 $/mois (2 OCU toujours en fonctionnement) | Quelques dollars/mois (petite échelle) | S3 Vectors + OCU AOSS (uniquement pendant l'export) |
| **Latence** | ~10 ms | Sous-seconde (froid), ~100 ms (chaud) | ~10 ms (recherche AOSS après export) |
| **Filtrage** | Filtre de métadonnées (`$eq`, `$ne`, `$in`, etc.) | Filtre de métadonnées (`$eq`, `$in`, `$and`, `$or`) | Filtrage AOSS après export |
| **Contraintes de métadonnées** | Pas de contraintes | filterable 2 Ko/vecteur (effectivement 1 Ko pour les personnalisées), clés non filtrables max 10 | Suit les contraintes AOSS après export |
| **Cas d'utilisation** | Environnements de production nécessitant de hautes performances | Optimisation des coûts, démo, environnements de développement | Demande temporaire de hautes performances |
| **Procédure opérationnelle** | Déploiement CDK uniquement | Déploiement CDK uniquement | Exécuter `export-to-opensearch.sh` après le déploiement CDK. Le rôle IAM d'export est créé automatiquement |

> **Contrainte de métadonnées S3 Vectors** : Lors de l'utilisation de Bedrock KB + S3 Vectors, les métadonnées personnalisées sont effectivement limitées à 1 Ko ou moins (les métadonnées internes de Bedrock KB consomment ~1 Ko de la limite de 2 Ko de métadonnées filtrables). Le code CDK définit toutes les métadonnées comme non filtrables pour contourner la limite de 2 Ko. Le filtrage SID est effectué côté application, donc le filtre QueryVectors de S3 Vectors n'est pas nécessaire. Voir [docs/s3-vectors-sid-architecture-guide.md](s3-vectors-sid-architecture-guide.md) pour plus de détails.

### Notes sur l'export

- L'export est une **copie ponctuelle**. Un ré-export est nécessaire après les mises à jour des données S3 Vectors (la synchronisation continue n'est pas effectuée)
- Pendant l'export, une collection AOSS, un pipeline OSI, un rôle de service IAM et un bucket S3 DLQ sont automatiquement créés
- L'option "Create and use a new service role" de la console crée automatiquement le rôle IAM, donc aucune création préalable de rôle n'est nécessaire
- L'export prend environ 15 minutes (création de la collection AOSS 5 min + création du pipeline 5 min + transfert de données 5 min)
- Le pipeline OSI **s'arrête automatiquement** après la fin du transfert de données (économique)
- La collection AOSS reste interrogeable après l'arrêt du pipeline
- **Supprimez manuellement les collections AOSS lorsqu'elles ne sont plus nécessaires** (non supprimées par `cdk destroy` car hors gestion CDK. La facturation OCU continue)

---

## Leçons tirées de l'implémentation S3 Vectors (vérifiées)

Les leçons suivantes sont tirées de la vérification de déploiement réelle dans ap-northeast-1 (région Tokyo) le 29/03/2026.

### Liées au SDK/API

| Élément | Leçon |
|---------|-------|
| Réponse SDK v3 | Les réponses de `CreateVectorBucketCommand`/`CreateIndexCommand` n'incluent pas `vectorBucketArn`/`indexArn`. Seul `$metadata` est retourné. L'ARN doit être construit en utilisant le pattern `arn:aws:s3vectors:{region}:{account}:bucket/{name}` |
| Noms des commandes API | `CreateIndexCommand`/`DeleteIndexCommand` sont corrects. `CreateVectorBucketIndexCommand` n'existe pas |
| Paramètres requis de CreateIndex | `dataType: 'float32'` est requis. L'omettre provoque une erreur de validation |
| Conception des métadonnées | Toutes les clés de métadonnées sont filtrables par défaut. `metadataConfiguration` ne spécifie que `nonFilterableMetadataKeys`. Aucune configuration explicite n'est nécessaire pour rendre `allowed_group_sids` filtrable |

### Liées à Bedrock KB

| Élément | Leçon |
|---------|-------|
| S3VectorsConfiguration | `indexArn` et `indexName` sont mutuellement exclusifs. Spécifier les deux provoque une erreur `2 subschemas matched instead of one`. Utilisez uniquement `indexArn` |
| Validation des permissions IAM | Bedrock KB valide la permission `s3vectors:QueryVectors` du rôle KB au moment de la création. La politique IAM doit être appliquée avant la création de la KB |
| Actions IAM requises | 5 actions sont requises : `s3vectors:QueryVectors`, `s3vectors:PutVectors`, `s3vectors:DeleteVectors`, `s3vectors:GetVectors`, `s3vectors:ListVectors` |

### Liées à CDK/CloudFormation

| Élément | Leçon |
|---------|-------|
| ARN de ressource de politique IAM | Utilisez des patterns ARN explicites au lieu de tokens `GetAtt` de ressources personnalisées. Cela évite les problèmes de dépendance |
| Hook CloudFormation | Le Hook `AWS::EarlyValidation::ResourceExistenceCheck` au niveau de l'organisation bloquant les change-sets peut être contourné avec `--method=direct` |
| Temps de déploiement | Le temps de déploiement du stack AI (configuration S3 Vectors) est d'environ 83 secondes (significativement réduit par rapport aux ~5 minutes pour la configuration AOSS) |

---

---

## Options d'extension futures

Les fonctionnalités suivantes ne sont pas actuellement implémentées mais sont conçues pour être ajoutées comme fonctionnalités optionnelles via les paramètres de contexte CDK.

| Fonctionnalité | Vue d'ensemble | Paramètre attendu |
|----------------|----------------|-------------------|
| Surveillance et alertes | Tableau de bord CloudWatch (métriques cross-stack), alertes SNS (taux d'erreur / dépassement de seuil de latence) | `enableMonitoring=true` |
| Contrôle avancé des permissions | Contrôle d'accès basé sur le temps (autoriser uniquement pendant les heures de bureau), restriction d'accès géographique (géolocalisation IP), journal d'audit DynamoDB | `enableAdvancedPermissions=true` |

---

## Documents associés

| Document | Contenu |
|----------|---------|
| [README.md](../README.md) | Procédures de déploiement et liste des paramètres de contexte CDK |
| [SID-Filtering-Architecture.md](SID-Filtering-Architecture.md) | Conception du filtrage SID et détails des chemins d'ingestion de données |
| [embedding-server-design.md](embedding-server-design.md) | Conception du serveur d'Embedding (incluant la récupération automatique des ACL ONTAP) |
| [ui-specification.md](ui-specification.md) | Spécification de l'interface utilisateur (interface carte, basculement mode KB/Agent) |