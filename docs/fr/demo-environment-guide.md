# Guide de l'environnement de vérification Permission-aware RAG

**🌐 Language:** [日本語](../demo-environment-guide.md) | [English](../en/demo-environment-guide.md) | [한국어](../ko/demo-environment-guide.md) | [简体中文](../zh-CN/demo-environment-guide.md) | [繁體中文](../zh-TW/demo-environment-guide.md) | **Français** | [Deutsch](../de/demo-environment-guide.md) | [Español](../es/demo-environment-guide.md)

**Dernière mise à jour** : 2026-03-25  
**Région** : ap-northeast-1 (Tokyo)

---

## 1. Informations d'accès

### URL de l'application web

| Point de terminaison | URL |
|---|---|
| CloudFront (Production) | `<Obtenir depuis les sorties CloudFormation après le déploiement CDK>` |
| Lambda Function URL (Direct) | `<Obtenir depuis les sorties CloudFormation après le déploiement CDK>` |

```bash
# Command to retrieve URLs
STACK_PREFIX="perm-rag-demo-demo"
aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-WebApp \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontUrl`].OutputValue' --output text
aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-WebApp \
  --query 'Stacks[0].Outputs[?OutputKey==`LambdaFunctionUrl`].OutputValue' --output text
```

### Utilisateurs de test

| Utilisateur | Adresse e-mail | Mot de passe | Rôle | Permissions |
|---|---|---|---|---|
| Administrateur | `admin@example.com` | `DemoAdmin123!` | administrator | Peut voir tous les documents |
| Utilisateur général | `user@example.com` | `DemoUser123!` | user | Documents publics uniquement |

L'authentification est gérée par Amazon Cognito.

---

## 2. Configuration des stacks CDK (6+1 stacks)

| Nom du stack | Région | Description |
|---|---|---|
| `${prefix}-Waf` | us-east-1 | WAF WebACL pour CloudFront |
| `${prefix}-Networking` | ap-northeast-1 | VPC, sous-réseaux, groupes de sécurité |
| `${prefix}-Security` | ap-northeast-1 | Cognito User Pool, authentification |
| `${prefix}-Storage` | ap-northeast-1 | FSx ONTAP + SVM + Volume + S3 + DynamoDB + AD |
| `${prefix}-AI` | ap-northeast-1 | Bedrock KB + S3 Vectors / OpenSearch Serverless (sélectionné via `vectorStoreType`) |
| `${prefix}-WebApp` | ap-northeast-1 | Lambda Web Adapter (Next.js) + CloudFront |
| `${prefix}-Embedding` (optionnel) | ap-northeast-1 | Embedding EC2 + ECR (montage CIFS FlexCache) |

### Récupération des identifiants de ressources

```bash
STACK_PREFIX="perm-rag-demo-demo"

# Retrieve outputs from all stacks at once
for stack in Waf Networking Security Storage AI WebApp Embedding; do
  echo "=== ${STACK_PREFIX}-${stack} ==="
  aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-${stack} \
    --query 'Stacks[0].Outputs[*].{Key:OutputKey,Value:OutputValue}' --output table 2>/dev/null || echo "  (Not deployed)"
done
```

---

## 3. Scénarios de vérification

### Flux de base

1. Accédez à l'URL CloudFront → `/ja/signin`
2. Connectez-vous avec un utilisateur de test
3. **Mode KB** : Sélectionnez un modèle sur l'écran de chat → Vérifiez le filtrage des permissions dans la recherche RAG
4. **Mode Agent** : Cliquez sur le bouton "🤖 Agent" dans l'en-tête → Sélectionnez un Agent → Choisissez un workflow ou chat libre

### Vérification des différences de permissions

Lorsque l'administrateur et l'utilisateur général posent la même question, le filtrage SID retourne des résultats différents. Les mêmes contrôles de permissions s'appliquent en mode KB et en mode Agent.

| Exemple de question | admin (KB/Agent) | user (KB/Agent) |
|--------|-------------------|-----------------|
| "Quel est le chiffre d'affaires de l'entreprise ?" | ✅ Référence le rapport financier (6/6 autorisés) | ❌ Informations publiques uniquement (2/6 autorisés) |
| "Quelle est la politique de télétravail ?" | ✅ Référence la politique RH | ❌ Accès refusé |
| "Quel est le plan de projet ?" | ✅ Référence le plan de projet | ❌ Accès refusé |

### Vérification du mode Agent

1. Cliquez sur le bouton "🤖 Agent" dans l'en-tête
2. Sélectionnez un Agent dans la barre latérale (`perm-rag-demo-demo-agent`)
3. Choisissez un workflow (📊 Analyse de rapport financier, etc.) ou saisissez un message de chat
4. Vérifiez la réponse de l'Agent (filtrage SID appliqué via le Permission-aware Action Group)

### Fonctionnalité de création dynamique d'Agent

Lorsque vous cliquez sur une carte de workflow en mode Agent, un Bedrock Agent correspondant à la catégorie est automatiquement recherché et créé.

| Élément | Description |
|------|------|
| Déclencheur | Clic sur une carte de workflow |
| Comportement | Détermination de la catégorie via AGENT_CATEGORY_MAP → Recherche d'Agent existant → Création dynamique via l'API CreateAgent si non trouvé |
| Durée | 30 à 60 secondes pour la création initiale (interface de chargement affichée), instantané à partir de la deuxième fois grâce au cache localStorage |
| Action Group | Le Permission-aware Action Group est automatiquement attaché aux Agents créés dynamiquement (spécifié via la variable d'environnement `PERM_SEARCH_LAMBDA_ARN`) |
| Cache | Le mapping carte-Agent est persisté via `useCardAgentMappingStore` (Zustand + localStorage) |
| Permissions requises | Le rôle IAM Lambda nécessite `bedrock:CreateAgent`, `bedrock:PrepareAgent`, `bedrock:CreateAgentAlias`, `bedrock:CreateAgentActionGroup`, `iam:PassRole` |

### Options de déploiement CDK

```bash
# Agent + all options enabled
npx cdk deploy --all --app "npx ts-node bin/demo-app.ts" \
  -c enableAgent=true \
  -c enableGuardrails=true \
  --require-approval never
```
| "Parlez-moi de la présentation des produits" | ✅ Référence le catalogue produits | ✅ Référence le catalogue produits |

Pour plus de détails, voir [demo-data/guides/demo-scenario.md](../../demo-data/guides/demo-scenario.md).

---

## 4. Intégration Active Directory

### Informations AD

| Élément | Valeur |
|---|---|
| Nom de domaine | `demo.local` |
| Édition | Standard |
| IP DNS | `<Obtenir après le déploiement AD>` |

```bash
# Retrieve AD information
aws ds describe-directories --region ap-northeast-1 \
  --query 'DirectoryDescriptions[?Name==`demo.local`].{Id:DirectoryId,Stage:Stage,DnsIps:DnsIpAddrs}' \
  --output table
```

### Procédure de jonction SVM à l'AD

CDK crée la SVM sans configuration AD. Après le déploiement, joignez le domaine AD via CLI.

#### Prérequis : Configuration du groupe de sécurité

La jonction SVM à l'AD nécessite la communication entre le SG FSx et le SG AD. CDK définit `allowAllOutbound: true`, mais les règles entrantes suivantes sont également requises.

```bash
# Retrieve FSx SG ID and AD SG ID
FSX_SG_ID=$(aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-Networking \
  --query 'Stacks[0].Outputs[?OutputKey==`FsxSgId`].OutputValue' --output text)
AD_SG_ID=$(aws ds describe-directories --region ap-northeast-1 \
  --query 'DirectoryDescriptions[?Name==`demo.local`].VpcSettings.SecurityGroupId' --output text)

# Add AD communication ports to FSx SG (if missing from CDK)
aws ec2 authorize-security-group-ingress --group-id $FSX_SG_ID \
  --protocol tcp --port 135 --source-group $AD_SG_ID --region ap-northeast-1
aws ec2 authorize-security-group-ingress --group-id $FSX_SG_ID \
  --protocol tcp --port 464 --source-group $AD_SG_ID --region ap-northeast-1
aws ec2 authorize-security-group-ingress --group-id $FSX_SG_ID \
  --protocol udp --port 464 --source-group $AD_SG_ID --region ap-northeast-1
aws ec2 authorize-security-group-ingress --group-id $FSX_SG_ID \
  --protocol tcp --port 636 --source-group $AD_SG_ID --region ap-northeast-1
aws ec2 authorize-security-group-ingress --group-id $FSX_SG_ID \
  --protocol udp --port 123 --source-group $AD_SG_ID --region ap-northeast-1
aws ec2 authorize-security-group-ingress --group-id $FSX_SG_ID \
  --protocol tcp --port 1024-65535 --source-group $AD_SG_ID --region ap-northeast-1

# Bidirectional communication: AD SG ↔ FSx SG allow all traffic
aws ec2 authorize-security-group-ingress --group-id $AD_SG_ID \
  --protocol -1 --source-group $FSX_SG_ID --region ap-northeast-1
aws ec2 authorize-security-group-ingress --group-id $FSX_SG_ID \
  --protocol -1 --source-group $AD_SG_ID --region ap-northeast-1
```

#### Commande de jonction SVM à l'AD

```bash
SVM_ID=$(aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-Storage \
  --query 'Stacks[0].Outputs[?OutputKey==`SvmId`].OutputValue' --output text)
AD_DNS_IPS=$(aws ds describe-directories --region ap-northeast-1 \
  --query 'DirectoryDescriptions[?Name==`demo.local`].DnsIpAddrs' --output json)

# Important: For AWS Managed AD, explicitly specify OrganizationalUnitDistinguishedName
aws fsx update-storage-virtual-machine \
  --storage-virtual-machine-id $SVM_ID \
  --active-directory-configuration '{
    "NetBiosName": "RAGSVM",
    "SelfManagedActiveDirectoryConfiguration": {
      "DomainName": "demo.local",
      "UserName": "Admin",
      "Password": "<AD_PASSWORD>",
      "DnsIps": '"$AD_DNS_IPS"',
      "OrganizationalUnitDistinguishedName": "OU=Computers,OU=demo,DC=demo,DC=local",
      "FileSystemAdministratorsGroup": "Domain Admins"
    }
  }' --region ap-northeast-1
```

> **Important** : Avec AWS Managed AD, l'omission de `OrganizationalUnitDistinguishedName` entraîne un état MISCONFIGURED. Spécifiez-le au format `OU=Computers,OU=<nom court NetBIOS>,DC=<domaine>,DC=<tld>`.

#### Vérification du statut de jonction AD

```bash
aws fsx describe-storage-virtual-machines \
  --storage-virtual-machine-ids $SVM_ID \
  --query 'StorageVirtualMachines[0].ActiveDirectoryConfiguration' \
  --region ap-northeast-1 --output json
```

Si `NetBiosName` est affiché et que `SelfManagedActiveDirectoryConfiguration` contient les informations du domaine, la jonction a réussi.

Pour les procédures détaillées, voir [demo-data/guides/ontap-setup-guide.md](../../demo-data/guides/ontap-setup-guide.md).

---

## 5. Données de la Knowledge Base

### Option A : Via le bucket S3 (par défaut)

Les documents suivants sont enregistrés dans le bucket S3. Chaque document a des informations SID attachées via `.metadata.json`.

| Fichier | Niveau d'accès | allowed_group_sids | admin | user |
|---|---|---|---|---|
| `public/company-overview.md` | public | S-1-1-0 (Everyone) | ✅ | ✅ |
| `public/product-catalog.md` | public | S-1-1-0 (Everyone) | ✅ | ✅ |
| `restricted/project-plan.md` | restreint | ...-1100, ...-512 | ✅ | ❌ |
| `confidential/financial-report.md` | confidentiel | ...-512 (Domain Admins) | ✅ | ❌ |
| `confidential/hr-policy.md` | confidentiel | ...-512 (Domain Admins) | ✅ | ❌ |

### Option B : Via le serveur d'Embedding (montage CIFS FlexCache)

Montez le volume FlexCache Cache via CIFS et vectorisez les documents directement avec le serveur d'Embedding, puis indexez-les dans OpenSearch Serverless (AOSS). C'est un chemin alternatif lorsque le S3 Access Point n'est pas disponible (non supporté pour les volumes FlexCache Cache en mars 2026). Disponible uniquement avec la configuration AOSS (`vectorStoreType=opensearch-serverless`).

Pour plus de détails, voir [6. Serveur d'Embedding](#6-serveur-dembedding-optionnel).

---

## 6. Serveur d'Embedding (optionnel)

### Vue d'ensemble

EmbeddingStack (le 7ème stack CDK) est un serveur basé sur EC2 qui lit directement les documents partagés via CIFS sur FSx ONTAP, les vectorise avec Amazon Bedrock Titan Embed Text v2 et les indexe dans OpenSearch Serverless (AOSS). Disponible uniquement avec la configuration AOSS (`vectorStoreType=opensearch-serverless`).

### Architecture

```
┌──────────────────┐     CIFS/SMB      ┌──────────────────┐
│ FSx ONTAP        │◀──────────────────│ Embedding EC2    │
│ (SVM + Volume)   │    Mount          │ (m5.large)       │
│ /data            │                   │                  │
└──────────────────┘                   │ Docker Container │
                                       │ ┌──────────────┐ │
                                       │ │ embed-app    │ │
                                       │ │ - scan docs  │ │
                                       │ │ - embedding  │ │
                                       │ │ - indexing   │ │
                                       │ └──────┬───────┘ │
                                       └────────┼─────────┘
                                                │
                              ┌─────────────────┼─────────────────┐
                              ▼                                   ▼
                    ┌──────────────────┐              ┌──────────────────┐
                    │ Bedrock          │              │ OpenSearch       │
                    │ Titan Embed v2   │              │ Serverless       │
                    │ (Vector Gen)     │              │ (Indexing)       │
                    └──────────────────┘              └──────────────────┘
```

Pour la procédure de déploiement détaillée, les étapes de montage CIFS et la configuration du serveur d'Embedding, consultez [embedding-server-design.md](embedding-server-design.md) et [la documentation en anglais](../en/demo-environment-guide.md#6-embedding-server-optional).

---

## 7. Points de terminaison API

| Méthode | Chemin | Description |
|---|---|---|
| POST | `/api/auth/signin` | Connexion (authentification Cognito) |
| POST | `/api/auth/signout` | Déconnexion |
| GET | `/api/auth/session` | Récupération des informations de session |
| GET | `/api/bedrock/models` | Liste des modèles disponibles |
| POST | `/api/bedrock/chat` | Chat |
| POST | `/api/bedrock/kb/retrieve` | Recherche RAG (avec filtrage SID) |
| GET | `/api/health` | Vérification de l'état |

---

## 8. Procédure de configuration (post-déploiement)

```bash
STACK_PREFIX="perm-rag-demo-demo"

# 1. Retrieve resource IDs
COGNITO_USER_POOL_ID=$(aws cloudformation describe-stacks \
  --stack-name ${STACK_PREFIX}-Security \
  --query 'Stacks[0].Outputs[?contains(OutputKey,`UserPoolId`)].OutputValue' --output text)
USER_ACCESS_TABLE_NAME=$(aws cloudformation describe-stacks \
  --stack-name ${STACK_PREFIX}-Storage \
  --query 'Stacks[0].Outputs[?OutputKey==`UserAccessTableName`].OutputValue' --output text)
DATA_BUCKET_NAME=$(aws cloudformation describe-stacks \
  --stack-name ${STACK_PREFIX}-Storage \
  --query 'Stacks[0].Outputs[?OutputKey==`DataBucketName`].OutputValue' --output text)
BEDROCK_KB_ID=$(aws cloudformation describe-stacks \
  --stack-name ${STACK_PREFIX}-AI \
  --query 'Stacks[0].Outputs[?OutputKey==`KnowledgeBaseId`].OutputValue' --output text)

# 2. Create test users
export COGNITO_USER_POOL_ID
bash demo-data/scripts/create-demo-users.sh

# 3. Register SID data (email address is used as userId in the app's JWT)
export USER_ACCESS_TABLE_NAME
bash demo-data/scripts/setup-user-access.sh

# 4. Upload test data
export DATA_BUCKET_NAME
bash demo-data/scripts/upload-demo-data.sh

# 5. Sync KB
export BEDROCK_KB_ID
bash demo-data/scripts/sync-kb-datasource.sh
```

---

## 9. Dépannage

| Symptôme | Cause | Résolution |
|------|------|------|
| Impossible de se connecter | Utilisateurs Cognito non créés | Exécutez `create-demo-users.sh` |
| La recherche KB ne retourne aucun résultat | Source de données non synchronisée | Exécutez `sync-kb-datasource.sh` |
| Tous les documents sont refusés | Données SID non enregistrées | Exécutez `setup-user-access.sh` |
| La jonction SVM AD est MISCONFIGURED | OU non spécifié ou SG insuffisant | Spécifiez explicitement le chemin OU + autorisez la communication entre les SG FSx/AD |
| Embedding 403 Forbidden | Politique d'accès aux données AOSS manquante | Ajoutez le rôle EC2 d'Embedding à la politique AOSS |
| Erreur d'authentification dans le conteneur d'Embedding | Limite de saut IMDS insuffisante | Vérifiez que la limite de saut des métadonnées EC2 = 2 |
| La page ne s'affiche pas | Cache CloudFront | `aws cloudfront create-invalidation --distribution-id <ID> --paths "/*"` |
| Délai de démarrage à froid | Démarrage initial de Lambda | Attendez 10-15 secondes (comportement normal) |


---

## Suppression de l'environnement

### Notes sur la suppression

Vous pouvez supprimer toutes les ressources avec `cdk destroy --all`, mais une intervention manuelle peut être nécessaire en raison des dépendances suivantes.

| Problème | Cause | Gestion CDK |
|------|------|---------|
| Échec de suppression du stack AI | Des sources de données restent dans la KB | ✅ Supprimé automatiquement par la ressource personnalisée KbCleanup |
| Échec de suppression du stack Storage | S3 AP attaché au volume | ✅ Supprimé automatiquement par le gestionnaire Delete de la ressource personnalisée S3 AP |
| Échec de suppression du stack Networking | Le SG du contrôleur AD est orphelin | ❌ Suppression manuelle requise (voir le script ci-dessous) |
| Stack Embedding non reconnu | Dépend du contexte CDK | ❌ Supprimez manuellement en premier |
| Ressources créées manuellement restantes | CodeBuild, ECR, politiques IAM | ❌ Supprimez avec le script ci-dessous |

### Procédure de suppression recommandée

```bash
# 1. Delete Embedding stack (if it exists)
aws cloudformation delete-stack --stack-name perm-rag-demo-demo-Embedding --region ap-northeast-1 2>/dev/null
aws cloudformation wait stack-delete-complete --stack-name perm-rag-demo-demo-Embedding --region ap-northeast-1 2>/dev/null

# 2. Delete KB data sources
KB_ID=$(aws cloudformation describe-stacks --stack-name perm-rag-demo-demo-AI --region ap-northeast-1 \
  --query 'Stacks[0].Outputs[?OutputKey==`KnowledgeBaseId`].OutputValue' --output text 2>/dev/null)
if [ -n "$KB_ID" ] && [ "$KB_ID" != "None" ]; then
  for DS_ID in $(aws bedrock-agent list-data-sources --knowledge-base-id $KB_ID --region ap-northeast-1 \
    --query 'dataSourceSummaries[].dataSourceId' --output text 2>/dev/null); do
    aws bedrock-agent delete-data-source --knowledge-base-id $KB_ID --data-source-id $DS_ID --region ap-northeast-1
  done
  sleep 10
fi

# 3. Delete S3 AP
aws fsx detach-and-delete-s3-access-point --name perm-rag-demo-s3ap --region ap-northeast-1 2>/dev/null
sleep 30

# 4. CDK destroy
npx cdk destroy --all --app "npx ts-node bin/demo-app.ts" --force

# 5. Delete orphaned AD SGs (when using Managed AD)
VPC_ID=$(aws ec2 describe-vpcs --filters "Name=tag:Name,Values=*perm-rag*" --region ap-northeast-1 \
  --query 'Vpcs[0].VpcId' --output text 2>/dev/null)
if [ -n "$VPC_ID" ] && [ "$VPC_ID" != "None" ]; then
  for SG_ID in $(aws ec2 describe-security-groups --filters "Name=vpc-id,Values=$VPC_ID" "Name=group-name,Values=d-*_controllers" \
    --region ap-northeast-1 --query 'SecurityGroups[].GroupId' --output text 2>/dev/null); do
    aws ec2 delete-security-group --group-id $SG_ID --region ap-northeast-1
  done
  # Retry Networking stack deletion
  aws cloudformation delete-stack --stack-name perm-rag-demo-demo-Networking --region ap-northeast-1
  aws cloudformation wait stack-delete-complete --stack-name perm-rag-demo-demo-Networking --region ap-northeast-1
fi
```