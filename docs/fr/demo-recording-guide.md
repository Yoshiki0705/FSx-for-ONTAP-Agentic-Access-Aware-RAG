# Guide d'enregistrement de vidéo de démonstration de vérification

**🌐 Language:** [日本語](../demo-recording-guide.md) | [English](../en/demo-recording-guide.md) | [한국어](../ko/demo-recording-guide.md) | [简体中文](../zh-CN/demo-recording-guide.md) | [繁體中文](../zh-TW/demo-recording-guide.md) | **Français** | [Deutsch](../de/demo-recording-guide.md) | [Español](../es/demo-recording-guide.md)

**Dernière mise à jour** : 2026-03-29  
**Objectif** : Guide étape par étape pour l'enregistrement de vidéos de démonstration de vérification du système Permission-Aware RAG  
**Prérequis** : Compte AWS (équivalent AdministratorAccess), instance EC2 (Ubuntu 22.04, t3.large ou supérieur, 50 Go EBS)

---

## Preuves à enregistrer (6 éléments)

| # | Preuve | Contenu |
|---|--------|---------|
| (1) | Construction d'une plateforme de chatbot IA basée sur RAG | Explication de l'architecture |
| (2) | Déploiement de la plateforme de chatbot avec AWS CDK | Procédure de déploiement CDK |
| (3) | Placement des données de stockage sur les volumes FSx ONTAP | Ingestion de données via S3 Access Point |
| (4) | Reflet des informations de permissions d'accès | Configuration et vérification des informations SID dans `.metadata.json` |
| (5) | Détermination de l'accès aux données basée sur les permissions par utilisateur | Vérification du filtrage SID |
| (6) | Vérification initiale | Vérification de l'interface carte, du mode KB/Agent et de l'affichage des citations |

---

## Préparation

### Lancement d'une instance EC2

```bash
aws ec2 run-instances \
  --region ap-northeast-1 \
  --image-id <UBUNTU_22_04_AMI_ID> \
  --instance-type t3.large \
  --subnet-id <PUBLIC_SUBNET_ID> \
  --security-group-ids <SG_ID> \
  --iam-instance-profile Name=<ADMIN_INSTANCE_PROFILE> \
  --associate-public-ip-address \
  --block-device-mappings '[{"DeviceName":"/dev/sda1","Ebs":{"VolumeSize":50,"VolumeType":"gp3"}}]' \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=cdk-deploy-server}]'
```

### Installation des outils requis sur EC2

```bash
sudo apt-get update -y
sudo apt-get install -y curl git unzip docker.io jq

curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

sudo systemctl enable docker && sudo systemctl start docker
sudo usermod -aG docker ubuntu && newgrp docker

sudo npm install -g aws-cdk typescript ts-node
```

### Clonage du dépôt

```bash
cd /home/ubuntu
git clone https://github.com/Yoshiki0705/FSx-for-ONTAP-Agentic-Access-Aware-RAG.git
cd FSx-for-ONTAP-Agentic-Access-Aware-RAG
npm install
```

---

## Preuve (1) : Construction d'une plateforme de chatbot IA basée sur RAG

**Contenu de l'enregistrement** : Explication de l'architecture du système

### Diagramme d'architecture

```
┌──────────┐     ┌──────────┐     ┌────────────┐     ┌─────────────────────┐
│ Browser  │────▶│ AWS WAF  │────▶│ CloudFront │────▶│ Lambda Web Adapter  │
└──────────┘     └──────────┘     │ (OAC+Geo)  │     │ (Next.js, IAM Auth) │
                                   └────────────┘     └──────┬──────────────┘
                                                             │
                       ┌─────────────────────┬───────────────┼────────────────────┐
                       ▼                     ▼               ▼                    ▼
              ┌─────────────┐    ┌──────────────────┐ ┌──────────────┐   ┌──────────────┐
              │ Cognito     │    │ Bedrock KB       │ │ DynamoDB     │   │ DynamoDB     │
              │ User Pool   │    │ + S3 Vectors /   │ │ user-access  │   │ perm-cache   │
              └─────────────┘    │   OpenSearch SL  │ │ (SID data)   │   │ (Perm Cache) │
                                 └────────┬─────────┘ └──────────────┘   └──────────────┘
                                          │
                                          ▼
                                 ┌──────────────────┐
                                 │ FSx for ONTAP    │
                                 │ (SVM + Volume)   │
                                 │ + S3 Access Point│
                                 └──────────────────┘
```

### 8 composants à expliquer

1. **Chatbot RAG Next.js sur AWS Lambda** — Exécution serverless via Lambda Web Adapter. Interface utilisateur orientée tâches basée sur des cartes
2. **AWS WAF** — Limitation de débit, réputation IP, règles conformes OWASP, protection SQLi
3. **Authentification IAM** — Lambda Function URL IAM Auth + CloudFront OAC (SigV4)
4. **Vector Store** — S3 Vectors (par défaut, faible coût) / OpenSearch Serverless (haute performance, sélectionné via `vectorStoreType`)
5. **FSx ONTAP + S3 Access Point** — Fournit les documents directement à Bedrock KB via S3 AP
6. **Titan Embed Text v2** — Modèle de vectorisation de texte Amazon Bedrock (1024 dimensions)
7. **Filtrage SID** — Contrôle d'accès au niveau du document utilisant les informations SID des ACL NTFS
8. **Basculement mode KB/Agent** — Mode KB (recherche de documents) et mode Agent (création dynamique d'Agent + raisonnement multi-étapes)

### Procédure d'enregistrement

1. Affichez `docs/implementation-overview.md` à l'écran
2. Expliquez chaque composant en montrant le diagramme d'architecture
3. Expliquez la structure des stacks CDK (7 stacks)
4. Expliquez le diagramme de flux du filtrage SID

---

## Preuve (2) : Déploiement de la plateforme de chatbot avec AWS CDK

**Contenu de l'enregistrement** : Exécution du déploiement CDK et vérification de la complétion

### Étape 1 : Configuration pré-déploiement (préparation de l'image ECR)

```bash
cd /home/ubuntu/Permission-aware-RAG-FSxN-CDK

# Create ECR repository + Build Docker image + Push
bash demo-data/scripts/pre-deploy-setup.sh
```

### Étape 2 : Déploiement CDK (les 6 stacks)

```bash
npx cdk deploy --all \
  --app "npx ts-node bin/demo-app.ts" \
  -c enableAgent=true \
  --require-approval never
```

> **Temps estimé** : Environ 30 à 40 minutes (20 à 30 minutes pour la création de FSx ONTAP)

### Étape 3 : Configuration post-déploiement (commande unique)

```bash
bash demo-data/scripts/post-deploy-setup.sh
```

Tâches exécutées automatiquement :
1. Création du S3 Access Point + configuration de la politique
2. Upload des données de démonstration vers FSx ONTAP (via S3 AP)
3. Ajout de la source de données Bedrock KB + synchronisation
4. Enregistrement des données SID des utilisateurs dans DynamoDB
5. Création des utilisateurs de démonstration dans Cognito

### Étape 4 : Vérification du déploiement

```bash
bash demo-data/scripts/verify-deployment.sh
```

### Points d'enregistrement

- Exécution de `pre-deploy-setup.sh` (préparation de l'image ECR)
- Écran d'exécution de `cdk deploy --all`
- Exécution de `post-deploy-setup.sh` (création S3 AP → synchronisation KB → création utilisateurs)
- Résultats des tests de `verify-deployment.sh`

---

## Preuve (3) : Placement des données de stockage sur les volumes FSx ONTAP

**Contenu de l'enregistrement** : Vérification de l'ingestion de données via S3 Access Point

`post-deploy-setup.sh` uploade automatiquement les données de démonstration via S3 AP. Vérification manuelle :

```bash
STACK_PREFIX="perm-rag-demo-demo"
S3AP_NAME=$(aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-Storage --region ap-northeast-1 \
  --query 'Stacks[0].Outputs[?OutputKey==`S3AccessPointName`].OutputValue' --output text)
S3AP_ALIAS=$(aws fsx describe-s3-access-point-attachments --region ap-northeast-1 \
  --query "S3AccessPointAttachments[?Name=='${S3AP_NAME}'].S3AccessPoint.Alias" --output text)

# List files via S3 AP
aws s3 ls "s3://${S3AP_ALIAS}/" --recursive --region ap-northeast-1
```

### Points d'enregistrement

- Afficher la liste des fichiers via S3 AP
- Vérifier le contenu des documents (3 types : public / confidentiel / restreint)

---

## Preuve (4) : Reflet des informations de permissions d'accès

**Contenu de l'enregistrement** : Vérification des informations SID via `.metadata.json`

```bash
# Check .metadata.json via S3 AP
aws s3 cp "s3://${S3AP_ALIAS}/public/company-overview.md.metadata.json" - | python3 -m json.tool
aws s3 cp "s3://${S3AP_ALIAS}/confidential/financial-report.md.metadata.json" - | python3 -m json.tool
aws s3 cp "s3://${S3AP_ALIAS}/restricted/project-plan.md.metadata.json" - | python3 -m json.tool
```

### Correspondance SID et permissions d'accès

| Répertoire | allowed_group_sids | Admin | Utilisateur standard |
|-----------|-------------------|-------|---------------------|
| `public/` | `S-1-1-0` (Everyone) | ✅ Visible | ✅ Visible |
| `confidential/` | `...-512` (Domain Admins) | ✅ Visible | ❌ Non visible |
| `restricted/` | `...-1100` + `...-512` | ✅ Visible | ❌ Non visible |

### Points d'enregistrement

- Afficher le contenu de `.metadata.json` à l'écran
- Expliquer la signification des SID (Everyone, Domain Admins, etc.)

---

## Preuve (5) : Détermination de l'accès aux données basée sur les permissions par utilisateur

**Contenu de l'enregistrement** : Vérification que des résultats de recherche différents sont retournés pour l'administrateur et l'utilisateur standard

### Vérification des données SID dans DynamoDB

```bash
USER_ACCESS_TABLE=$(aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-Storage --region ap-northeast-1 \
  --query 'Stacks[0].Outputs[?OutputKey==`UserAccessTableName`].OutputValue' --output text)

aws dynamodb get-item --table-name ${USER_ACCESS_TABLE} \
  --key '{"userId":{"S":"admin@example.com"}}' --region ap-northeast-1 --output json | python3 -m json.tool

aws dynamodb get-item --table-name ${USER_ACCESS_TABLE} \
  --key '{"userId":{"S":"user@example.com"}}' --region ap-northeast-1 --output json | python3 -m json.tool
```

### Vérification du filtrage SID via curl

```bash
LAMBDA_URL=$(aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-WebApp --region ap-northeast-1 \
  --query 'Stacks[0].Outputs[?OutputKey==`LambdaFunctionUrl`].OutputValue' --output text)
KB_ID=$(aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-AI --region ap-northeast-1 \
  --query 'Stacks[0].Outputs[?OutputKey==`KnowledgeBaseId`].OutputValue' --output text)

# Admin user
echo "=== admin@example.com ==="
curl -s -X POST "${LAMBDA_URL}api/bedrock/kb/retrieve" \
  -H "Content-Type: application/json" \
  -d '{"query":"会社の売上はいくらですか？","userId":"admin@example.com","knowledgeBaseId":"'${KB_ID}'"}' \
  | python3 -c "import sys,json;fl=json.load(sys.stdin).get('filterLog',{});print(f'  {fl.get(\"allowedDocuments\",0)}/{fl.get(\"totalDocuments\",0)} documents allowed')"

# Regular user
echo "=== user@example.com ==="
curl -s -X POST "${LAMBDA_URL}api/bedrock/kb/retrieve" \
  -H "Content-Type: application/json" \
  -d '{"query":"会社の売上はいくらですか？","userId":"user@example.com","knowledgeBaseId":"'${KB_ID}'"}' \
  | python3 -c "import sys,json;fl=json.load(sys.stdin).get('filterLog',{});print(f'  {fl.get(\"allowedDocuments\",0)}/{fl.get(\"totalDocuments\",0)} documents allowed')"
```

### Points d'enregistrement

- Afficher les données SID de DynamoDB à l'écran
- Souligner que l'administrateur a accès à tous les documents tandis que l'utilisateur standard n'a accès qu'aux documents publics

---

## Preuve (6) : Vérification initiale — Interface carte, mode KB/Agent et affichage des citations

**Contenu de l'enregistrement** : Vérification de bout en bout dans le navigateur

### Étape 1 : Accès via le navigateur

```bash
CF_URL=$(aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-WebApp --region ap-northeast-1 \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontUrl`].OutputValue' --output text)
echo "Access URL: ${CF_URL}/ja/signin"
```

### Étape 2 : Vérification en tant qu'administrateur (mode KB)

1. Connectez-vous en tant que `admin@example.com`
2. La grille de cartes s'affiche (14 cartes : 8 recherche + 6 production)
3. L'InfoBanner affiche les informations de permissions (3 répertoires, lecture ✅, écriture ✅)
4. Cliquez sur la carte "Recherche de documents" → le prompt est défini dans le champ de saisie
5. Demandez "Quel est le chiffre d'affaires de l'entreprise ?"
6. Les citations sont affichées dans la réponse (chemin de fichier FSx + badge de niveau d'accès)
   - `confidential/financial-report.md` — Administrateurs uniquement (badge rouge)
   - `public/company-overview.md` — Accessible à tous (badge vert)
7. Cliquez sur le bouton "🔄 Retour à la sélection de workflow" pour revenir à la grille de cartes

### Étape 3 : Vérification en tant qu'administrateur (mode Agent)

1. Basculez en mode Agent avec le bouton "🤖 Agent" dans l'en-tête
2. La grille de cartes du mode Agent s'affiche (14 cartes : 8 recherche + 6 production)
3. Cliquez sur la carte "Analyse de rapport financier"
4. Le Bedrock Agent est automatiquement recherché et créé dynamiquement (attendre quelques secondes lors de la première utilisation)
5. Réponse de l'Agent + affichage des citations pour la question

### Étape 4 : Vérification en tant qu'utilisateur standard

1. Déconnectez-vous → Connectez-vous en tant que `user@example.com`
2. L'InfoBanner affiche les informations de permissions (1 répertoire uniquement)
3. Demandez "Quel est le chiffre d'affaires de l'entreprise ?"
4. Confirmez que les citations des documents confidentiels ne sont pas incluses dans la réponse
5. Demandez "Parlez-moi de la présentation des produits"
6. Confirmez que les citations des documents publics sont affichées

### Résumé des résultats de vérification

| Question | admin | user | Raison |
|----------|-------|------|--------|
| Chiffre d'affaires de l'entreprise | ✅ Référence le rapport financier | ❌ Informations publiques uniquement | financial-report.md est réservé aux Domain Admins |
| Politique de télétravail | ✅ Référence la politique RH | ❌ Accès refusé | hr-policy.md est réservé aux Domain Admins |
| Présentation des produits | ✅ Référence le catalogue produits | ✅ Référence le catalogue produits | product-catalog.md est pour Everyone |

### Points d'enregistrement

- Mode KB : Grille de cartes → Question → Citation (chemin de fichier + badge de niveau d'accès)
- Mode Agent : Clic sur carte → Création dynamique d'Agent → Réponse
- Comparaison des résultats admin vs. utilisateur standard
- Comportement du bouton "Retour à la sélection de workflow"

---

## Nettoyage des ressources

```bash
bash demo-data/scripts/cleanup-all.sh
```

---

## Dépannage

| Symptôme | Cause | Résolution |
|----------|-------|------------|
| Erreur de version de schéma lors du déploiement CDK | Incompatibilité de version du CLI CDK | Utilisez `npm install aws-cdk@latest` + `npx cdk` |
| La recherche KB ne retourne aucun résultat | Source de données non synchronisée | Relancez `post-deploy-setup.sh` |
| Tous les documents sont refusés | Données SID non enregistrées | Relancez `post-deploy-setup.sh` |
| La page ne s'affiche pas | Cache CloudFront | `aws cloudfront create-invalidation --distribution-id <ID> --paths "/*"` |
| Erreur de permission Docker | Pas dans le groupe docker | `sudo usermod -aG docker ubuntu && newgrp docker` |
| La création dynamique d'Agent échoue | Permissions IAM Lambda insuffisantes | Déployez avec `enableAgent=true` spécifié dans CDK |