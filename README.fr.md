# Système RAG avec gestion des permissions et Amazon FSx for NetApp ONTAP

**🌐 Language / Langue :** [日本語](README.md) | [English](README.en.md) | [한국어](README.ko.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | **Français** | [Deutsch](README.de.md) | [Español](README.es.md)

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)

Un système de recherche IA d'entreprise qui permet aux utilisateurs d'interroger les documents d'un serveur de fichiers (FSx for NetApp ONTAP) **tout en respectant les permissions d'accès de chaque utilisateur**. Les documents confidentiels ne sont inclus dans les réponses que pour les utilisateurs autorisés ; les utilisateurs standard reçoivent des réponses basées uniquement sur les documents publics.

Déployez en une seule commande avec AWS CDK. Combine Amazon Bedrock (RAG/Agent), Cognito (authentification), FSx for ONTAP (stockage) et S3 Vectors (base vectorielle) dans une configuration prête pour l'entreprise. Interface utilisateur orientée tâches basée sur Next.js 15, prenant en charge 8 langues.

Caractéristiques principales :
- **Filtrage des permissions** : les ACL NTFS / permissions UNIX du serveur de fichiers sont automatiquement appliquées aux résultats de recherche RAG
- **Provisionnement sans intervention** : l'intégration AD / OIDC / LDAP récupère automatiquement les permissions lors de la première connexion
- **Basculement Agent + KB** : basculez entre la recherche documentaire (mode KB) et le raisonnement multi-étapes (mode Agent) en un clic
- **Faible coût** : S3 Vectors (quelques dollars/mois) par défaut. Possibilité de basculer vers OpenSearch Serverless

---

## Quick Start

```bash
git clone https://github.com/Yoshiki0705/FSx-for-ONTAP-Agentic-Access-Aware-RAG.git
cd FSx-for-ONTAP-Agentic-Access-Aware-RAG && npm install
npx cdk bootstrap aws://$(aws sts get-caller-identity --query Account --output text)/ap-northeast-1
npx cdk bootstrap aws://$(aws sts get-caller-identity --query Account --output text)/us-east-1
bash demo-data/scripts/pre-deploy-setup.sh
npx cdk deploy --all --require-approval never
bash demo-data/scripts/post-deploy-setup.sh
```


## Architecture

```
+----------+     +----------+     +------------+     +---------------------+
| Browser  |---->| AWS WAF  |---->| CloudFront |---->| Lambda Web Adapter  |
+----------+     +----------+     | (OAC+Geo)  |     | (Next.js, IAM Auth) |
                                  +------------+     +------+--------------+
                                                            |
                      +---------------------+---------------+--------------------+
                      v                     v               v                    v
             +-------------+    +------------------+ +--------------+   +--------------+
             | Cognito     |    | Bedrock KB       | | DynamoDB     |   | DynamoDB     |
             | User Pool   |    | + S3 Vectors /   | | user-access  |   | perm-cache   |
             +-------------+    |   OpenSearch SL  | | (SID Data)   |   | (Perm Cache) |
                                +--------+---------+ +--------------+   +--------------+
                                         |
                                         v
                                +------------------+
                                | FSx for ONTAP    |
                                | (SVM + Volume)   |
                                | + S3 Access Point|
                                +--------+---------+
                                         | CIFS/SMB (optional)
                                         v
                                +------------------+
                                | Embedding EC2    |
                                | (Titan Embed v2) |
                                | (optional)       |
                                +------------------+
```

## Vue d'ensemble de l'implémentation (14 perspectives)

L'implémentation de ce système est organisée en 14 perspectives. Pour les détails de chaque élément, consultez [docs/implementation-overview.md](docs/implementation-overview.md).

| # | Perspective | Vue d'ensemble | Stack CDK associé |
|---|-------------|----------------|-------------------|
| 1 | Application Chatbot | Next.js 15 (App Router) fonctionnant en mode serverless avec Lambda Web Adapter. Support du basculement KB/Agent. Interface utilisateur orientée tâches basée sur des cartes | WebAppStack |
| 2 | AWS WAF | Configuration à 6 règles : limitation de débit, réputation IP, règles conformes OWASP, protection SQLi, liste blanche IP | WafStack |
| 3 | Authentification IAM | Sécurité multicouche avec Lambda Function URL + CloudFront OAC | WebAppStack |
| 4 | Base de données vectorielle | S3 Vectors (par défaut, faible coût) / OpenSearch Serverless (haute performance). Sélectionné via `vectorStoreType` | AIStack |
| 5 | Serveur d'embedding | Vectorise les documents sur EC2 avec le volume FSx ONTAP monté via CIFS/SMB et écrit dans AOSS (configuration AOSS uniquement) | EmbeddingStack |
| 6 | Titan Text Embeddings | Utilise `amazon.titan-embed-text-v2:0` (1024 dimensions) pour l'ingestion KB et le serveur d'embedding | AIStack |
| 7 | Métadonnées SID + Filtrage des permissions | Gère les informations SID ACL NTFS via `.metadata.json` et filtre par correspondance des SID utilisateur lors de la recherche | StorageStack |
| 8 | Basculement KB/Agent | Basculer entre le mode KB (recherche de documents) et le mode Agent (raisonnement multi-étapes). Répertoire Agent (`/genai/agents`) pour la gestion catalogue des Agents, création de modèles, édition et suppression. Création dynamique d'Agent et liaison de cartes. Workflows orientés résultats (présentations, documents d'approbation, comptes-rendus de réunion, rapports, contrats, intégration). Support i18n 8 langues. Gestion des permissions dans les deux modes | WebAppStack |
| 9 | RAG avec analyse d'images | Ajout du téléchargement d'images (glisser-déposer / sélecteur de fichiers) dans l'entrée de chat. Analyse les images avec l'API Bedrock Vision (Claude Haiku 4.5) et intègre les résultats dans le contexte de recherche KB. Supporte JPEG/PNG/GIF/WebP, limite de 3 Mo | WebAppStack |
| 10 | Interface de connexion KB | Interface pour sélectionner, connecter et déconnecter les Bedrock Knowledge Bases lors de la création/édition d'Agent. Affiche la liste des KB connectées dans le panneau de détail de l'Agent | WebAppStack |
| 11 | Routage intelligent | Sélection automatique du modèle basée sur la complexité de la requête. Les requêtes factuelles courtes sont routées vers le modèle léger (Haiku), les requêtes analytiques longues vers le modèle haute performance (Sonnet). Bouton ON/OFF dans la barre latérale | WebAppStack |
| 12 | Surveillance et alertes | Tableau de bord CloudWatch (Lambda/CloudFront/DynamoDB/Bedrock/WAF/intégration RAG avancée), alertes SNS (notifications de seuil de taux d'erreur et de latence), notifications d'échec EventBridge KB Ingestion Job, métriques personnalisées EMF. Activer avec `enableMonitoring=true` | WebAppStack (MonitoringConstruct) |
| 13 | AgentCore Memory | Maintien du contexte de conversation via AgentCore Memory (mémoire à court et long terme). Historique de conversation en session (court terme) + préférences utilisateur et résumés inter-sessions (long terme). Activer avec `enableAgentCoreMemory=true` | AIStack |
| 14 | OIDC/LDAP Federation + ONTAP Name-Mapping | Intégration OIDC IdP (Auth0/Keycloak/Okta), requête LDAP directe (OpenLDAP/FreeIPA) pour récupération automatique UID/GID, ONTAP REST API name-mapping (correspondance UNIX→Windows). Activation automatique par configuration. Activer avec `oidcProviderConfig` + `ldapConfig` + `ontapNameMappingEnabled` | SecurityStack |

## Captures d'écran de l'interface

### Mode KB — Grille de cartes (État initial)

L'état initial de la zone de chat affiche 14 cartes spécifiques (8 recherche + 6 production) dans une disposition en grille. Comprend des filtres de catégorie, une fonctionnalité de favoris et un InfoBanner (informations de permissions).

![KB Mode Card Grid](docs/screenshots/kb-mode-cards-full.png)

### Mode Agent — Grille de cartes + Barre latérale

Le mode Agent affiche 14 cartes de workflow (8 recherche + 6 production). Cliquer sur une carte recherche automatiquement un Bedrock Agent, et s'il n'a pas été créé, navigue vers le formulaire de création du répertoire Agent. La barre latérale comprend un menu déroulant de sélection d'Agent, des paramètres d'historique de chat et une section d'administration système repliable.

![Agent Mode Card Grid](docs/screenshots/agent-mode-card-grid.png)

### Répertoire Agent — Liste des Agents et écran de gestion

Un écran de gestion dédié aux Agents accessible à `/[locale]/genai/agents`. Fournit un affichage catalogue des Bedrock Agents créés, des filtres de recherche et de catégorie, un panneau de détail, une création basée sur des modèles et une édition/suppression en ligne. La barre de navigation permet de basculer entre le mode Agent / la liste des Agents / le mode KB. Lorsque les fonctionnalités entreprise sont activées, les onglets « Agents partagés » et « Tâches planifiées » sont ajoutés.

![Agent Directory](docs/screenshots/agent-directory-enterprise.png)

#### Répertoire Agent — Onglet Agents partagés

Activé avec `enableAgentSharing=true`. Liste, prévisualise et importe les configurations d'Agent depuis le bucket S3 partagé.

![Shared Agents Tab](docs/screenshots/agent-directory-shared-tab.png)

### Répertoire Agent — Formulaire de création d'Agent

Cliquer sur « Créer à partir d'un modèle » sur une carte de modèle affiche un formulaire de création où vous pouvez modifier le nom de l'Agent, la description, le prompt système et le modèle IA. Le même formulaire apparaît lorsque vous cliquez sur une carte en mode Agent si l'Agent n'a pas encore été créé.

![Agent Creation Form](docs/screenshots/agent-creator-form.png)

### Répertoire Agent — Détail et édition de l'Agent

Cliquer sur une carte Agent affiche un panneau de détail montrant l'ID de l'Agent, le statut, le modèle, la version, la date de création, le prompt système (repliable) et les groupes d'actions. Les actions disponibles incluent « Modifier » pour l'édition en ligne, « Utiliser dans le chat » pour naviguer vers le mode Agent, « Exporter » pour le téléchargement de la configuration JSON, « Télécharger vers le bucket partagé » pour le partage S3, « Créer un planning » pour les paramètres d'exécution périodique, et « Supprimer » avec une boîte de dialogue de confirmation.

![Agent Detail Panel](docs/screenshots/agent-detail-panel.png)

### Réponse du chat — Affichage des citations + Badge de niveau d'accès

Les résultats de recherche RAG affichent les chemins de fichiers FSx et les badges de niveau d'accès (accessible à tous / administrateurs uniquement / groupes spécifiques). Pendant le chat, un bouton « 🔄 Retour à la sélection de workflow » retourne à la grille de cartes. Un bouton « ➕ » sur le côté gauche du champ de saisie de message démarre un nouveau chat.

![Chat Response + Citation](docs/screenshots/kb-mode-chat-citation.png)

### Téléchargement d'images — Glisser-déposer + Sélecteur de fichiers (v3.1.0)

Ajout de la fonctionnalité de téléchargement d'images dans la zone de saisie du chat. Joignez des images via la zone de glisser-déposer et le bouton 📎 sélecteur de fichiers, analysez avec l'API Bedrock Vision (Claude Haiku 4.5) et intégrez dans le contexte de recherche KB. Supporte JPEG/PNG/GIF/WebP, limite de 3 Mo.

![Image Upload Zone](docs/screenshots/kb-mode-image-upload-zone.png)

### Routage intelligent — Sélection automatique de modèle optimisée en coût (v3.1.0)

Lorsque le bouton de routage intelligent dans la barre latérale est activé, il sélectionne automatiquement un modèle léger (Haiku) ou un modèle haute performance (Sonnet) en fonction de la complexité de la requête. Une option « ⚡ Auto » est ajoutée au ModelSelector, et les réponses affichent le nom du modèle utilisé avec un badge « Auto ».

![Smart Routing ON + ResponseMetadata](docs/screenshots/kb-mode-response-metadata-auto.png)

### AgentCore Memory — Liste de sessions + Section mémoire (v3.3.0)

Activé avec `enableAgentCoreMemory=true`. Ajoute une liste de sessions (SessionList) et un affichage de mémoire à long terme (MemorySection) dans la barre latérale du mode Agent. Les paramètres d'historique de chat sont remplacés par un badge « AgentCore Memory: Enabled ».

![AgentCore Memory Sidebar](docs/screenshots/agent-mode-agentcore-memory-sidebar.png)

## Structure des stacks CDK

| # | Stack | Région | Ressources | Description |
|---|-------|--------|------------|-------------|
| 1 | WafStack | us-east-1 | WAF WebACL, IP Set | WAF pour CloudFront (limitation de débit, règles gérées) |
| 2 | NetworkingStack | ap-northeast-1 | VPC, Subnets, Security Groups, VPC Endpoints (optionnel) | Infrastructure réseau |
| 3 | SecurityStack | ap-northeast-1 | Cognito User Pool, Client, SAML IdP + OIDC IdP + Cognito Domain (quand Federation activé), Identity Sync Lambda (optionnel) | Authentification et autorisation (SAML/OIDC/Email) |
| 4 | StorageStack | ap-northeast-1 | FSx ONTAP + SVM + Volume, S3, DynamoDB×2, (AD), chiffrement KMS (optionnel), CloudTrail (optionnel) | Stockage, données SID, cache de permissions |
| 5 | AIStack | ap-northeast-1 | Bedrock KB, S3 Vectors / OpenSearch Serverless (sélectionné via `vectorStoreType`), Bedrock Guardrails (optionnel) | Infrastructure de recherche RAG (Titan Embed v2) |
| 6 | WebAppStack | ap-northeast-1 | Lambda (Docker, IAM Auth + OAC), CloudFront, Permission Filter Lambda (optionnel), MonitoringConstruct (optionnel) | Application web, gestion des Agents, surveillance et alertes |
| 7 | EmbeddingStack (optionnel) | ap-northeast-1 | EC2 (m5.large), ECR, récupération automatique ACL ONTAP (optionnel) | Montage FlexCache CIFS + serveur d'embedding |

### Fonctionnalités de sécurité (Défense à 6 couches)

| Couche | Technologie | Objectif |
|--------|------------|----------|
| L1 : Réseau | CloudFront Geo Restriction | Restriction d'accès géographique (par défaut : Japon uniquement) |
| L2 : WAF | AWS WAF (6 règles) | Détection et blocage des schémas d'attaque |
| L3 : Authentification d'origine | CloudFront OAC (SigV4) | Empêcher l'accès direct contournant CloudFront |
| L4 : Authentification API | Lambda Function URL IAM Auth | Contrôle d'accès via l'authentification IAM |
| L5 : Authentification utilisateur | Cognito JWT / SAML / OIDC Federation | Authentification et autorisation au niveau utilisateur |
| L6 : Autorisation des données | SID / UID+GID Filtering | Contrôle d'accès au niveau document |

## Prérequis

- Compte AWS (avec des permissions équivalentes à AdministratorAccess)
- Node.js 22+, npm
- Docker (Colima, Docker Desktop ou docker.io sur EC2)
- CDK initialisé (`cdk bootstrap aws://ACCOUNT_ID/REGION`)

> **Note** : Les builds peuvent être exécutés localement (macOS / Linux) ou sur EC2. Pour Apple Silicon (M1/M2/M3), `pre-deploy-setup.sh` utilise automatiquement le mode pré-build (build Next.js local + packaging Docker) pour générer des images compatibles Lambda x86_64. Sur EC2 (x86_64), un build Docker complet est effectué.

## Étapes de déploiement

### Étape 1 : Configuration de l'environnement

Peut être exécuté localement (macOS / Linux) ou sur EC2.

#### Local (macOS)

```bash
# Node.js 22+ (Homebrew)
brew install node@22

# Docker (l'un ou l'autre)
brew install --cask docker          # Docker Desktop (nécessite sudo)
brew install docker colima          # Colima (pas de sudo requis, recommandé)
colima start --cpu 4 --memory 8     # Démarrer Colima

# AWS CDK
npm install -g aws-cdk typescript ts-node
```

#### EC2 (Ubuntu 22.04)

```bash
# Lancer un t3.large dans un sous-réseau public (avec un rôle IAM compatible SSM)
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

Le groupe de sécurité n'a besoin que du port sortant 443 (HTTPS) ouvert pour que SSM Session Manager fonctionne. Aucune règle entrante n'est requise.

### Étape 2 : Installation des outils (pour EC2)

Après connexion via SSM Session Manager, exécutez les commandes suivantes.

```bash
# Mise à jour système + outils de base
sudo apt-get update -y
sudo apt-get install -y curl git unzip docker.io

# Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# Activer Docker
sudo systemctl enable docker
sudo systemctl start docker
sudo usermod -aG docker ubuntu

# AWS CDK (global)
sudo npm install -g aws-cdk typescript ts-node
```

#### ⚠️ Notes sur la version du CLI CDK

La version du CLI CDK installée via `npm install -g aws-cdk` peut ne pas être compatible avec le `aws-cdk-lib` du projet.

```bash
# Comment vérifier
cdk --version          # Version CLI globale
npx cdk --version      # Version CLI locale au projet
```

Ce projet utilise `aws-cdk-lib@2.244.0`. Si la version du CLI est obsolète, vous verrez l'erreur suivante :

```
Cloud assembly schema version mismatch: Maximum schema version supported is 48.x.x, but found 52.0.0
```

**Solution** : Mettez à jour le CLI CDK local du projet vers la dernière version.

```bash
cd Permission-aware-RAG-FSxN-CDK
npm install aws-cdk@latest
npx cdk --version  # Vérifier la version mise à jour
```

> **Important** : Utilisez `npx cdk` au lieu de `cdk` pour vous assurer que le CLI local le plus récent du projet est utilisé.

### Étape 3 : Cloner le dépôt et installer les dépendances

```bash
cd /home/ubuntu
git clone https://github.com/Yoshiki0705/FSx-for-ONTAP-Agentic-Access-Aware-RAG.git
cd FSx-for-ONTAP-Agentic-Access-Aware-RAG
npm install
```

### Étape 4 : CDK Bootstrap (première fois uniquement)

Exécutez ceci si CDK Bootstrap n'a pas été exécuté dans les régions cibles. Comme le stack WAF est déployé dans us-east-1, le Bootstrap est requis dans les deux régions.

```bash
# ap-northeast-1 (région principale)
npx cdk bootstrap aws://$(aws sts get-caller-identity --query Account --output text)/ap-northeast-1

# us-east-1 (pour le stack WAF)
npx cdk bootstrap aws://$(aws sts get-caller-identity --query Account --output text)/us-east-1
```

> **Lors du déploiement sur un autre compte AWS** : Supprimez le cache AZ (`availability-zones:account=...`) de `cdk.context.json`. CDK récupérera automatiquement les informations AZ pour le nouveau compte.

> **Comment les utilisateurs LDAP se connectent** : Choisissez le bouton « Se connecter avec {providerName} » sur la page de connexion (ex : « Se connecter avec Keycloak »). LDAP gère la récupération des permissions, pas l'authentification.

### Étape 5 : Configuration du contexte CDK

```bash
cat > cdk.context.json << 'EOF'
{
  "projectName": "rag-demo",
  "environment": "demo",
  "imageTag": "latest",
  "allowedIps": [],
  "allowedCountries": ["JP"]
}
EOF
```

#### Intégration Active Directory (optionnel)

Pour joindre le SVM FSx ONTAP à un domaine Active Directory et utiliser les ACL NTFS (basées sur SID) avec les partages CIFS, ajoutez ce qui suit à `cdk.context.json`.

```bash
cat > cdk.context.json << 'EOF'
{
  "projectName": "rag-demo",
  "environment": "demo",
  "imageTag": "latest",
  "allowedIps": [],
  "allowedCountries": ["JP"],
  "adPassword": "YourStrongP@ssw0rd123",
  "adDomainName": "demo.local"
}
EOF
```

| Paramètre | Type | Défaut | Description |
|-----------|------|--------|-------------|
| `adPassword` | string | Non défini (pas d'AD créé) | Mot de passe administrateur AWS Managed Microsoft AD. Lorsqu'il est défini, crée l'AD et joint le SVM au domaine |
| `adDomainName` | string | `demo.local` | Nom de domaine AD (FQDN) |

> **Note** : La création de l'AD prend 20 à 30 minutes supplémentaires. Les démonstrations de filtrage SID sont possibles sans AD (vérifié avec les données SID DynamoDB).

#### Fédération SAML AD (optionnel)

Vous pouvez activer la fédération SAML pour que les utilisateurs AD se connectent directement depuis l'interface CloudFront, avec création automatique d'utilisateur Cognito + enregistrement automatique des données SID DynamoDB.

**Vue d'ensemble de l'architecture :**

```
AD User → CloudFront UI → "Sign in with AD" button
  → Cognito Hosted UI → SAML IdP (AD) → AD Authentication
  → Automatic Cognito User Creation
  → Post-Auth Trigger → AD Sync Lambda → DynamoDB SID Data Registration
  → OAuth Callback → Session Cookie → Chat Screen
```

**Paramètres CDK :**

| Paramètre | Type | Défaut | Description |
|-----------|------|--------|-------------|
| `enableAdFederation` | boolean | `false` | Indicateur d'activation de la fédération SAML |
| `cloudFrontUrl` | string | Non défini | URL CloudFront pour l'URL de callback OAuth (ex. `https://d3xxxxx.cloudfront.net`) |
| `samlMetadataUrl` | string | Non défini | Pour AD auto-géré : URL des métadonnées de fédération Entra ID |
| `adEc2InstanceId` | string | Non défini | Pour AD auto-géré : ID d'instance EC2 |

> **Configuration automatique des variables d'environnement** : Lors du déploiement CDK avec `enableAdFederation=true` ou `oidcProviderConfig`, les variables d'environnement Federation (`COGNITO_DOMAIN`, `COGNITO_CLIENT_SECRET`, `CALLBACK_URL`, `IDP_NAME`) sont automatiquement configurées sur la fonction Lambda WebAppStack. Aucune configuration manuelle des variables d'environnement Lambda n'est requise.

**Modèle AD géré :**

Lors de l'utilisation d'AWS Managed Microsoft AD.

> **⚠️ La configuration d'IAM Identity Center (anciennement AWS SSO) est requise :**
> Pour utiliser l'URL de métadonnées SAML de l'AD géré (`portal.sso.{region}.amazonaws.com/saml/metadata/{directoryId}`), vous devez activer AWS IAM Identity Center, configurer l'AD géré comme source d'identité et créer une application SAML. La simple création d'un AD géré ne fournit pas de point de terminaison de métadonnées SAML.
>
> Si la configuration d'IAM Identity Center est difficile, vous pouvez également spécifier directement une URL de métadonnées d'IdP externe (AD FS, etc.) via le paramètre `samlMetadataUrl`.

```json
{
  "enableAdFederation": true,
  "adPassword": "YourStrongP@ssw0rd123",
  "adDomainName": "demo.local",
  "cloudFrontUrl": "https://d3xxxxx.cloudfront.net",
  // Optionnel : Lors de l'utilisation d'une URL de métadonnées SAML autre qu'IAM Identity Center
  // "samlMetadataUrl": "https://your-adfs-server/federationmetadata/2007-06/federationmetadata.xml"
}
```

Étapes de configuration :
1. Définir `adPassword` et déployer CDK (crée AD géré + SAML IdP + Cognito Domain)
2. Activer AWS IAM Identity Center et changer la source d'identité vers AD géré
3. Définir les adresses e-mail pour les utilisateurs AD (PowerShell : `Set-ADUser -Identity Admin -EmailAddress "admin@demo.local"`)
4. Dans IAM Identity Center, aller dans « Gérer la synchronisation » → « Configuration guidée » pour synchroniser les utilisateurs AD
5. Créer une application SAML « Permission-aware RAG Cognito » dans IAM Identity Center :
   - URL ACS : `https://{cognito-domain}.auth.{region}.amazoncognito.com/saml2/idpresponse`
   - Audience SAML : `urn:amazon:cognito:sp:{user-pool-id}`
   - Mappages d'attributs : Subject → `${user:email}` (emailAddress), emailaddress → `${user:email}`
6. Attribuer les utilisateurs AD à l'application SAML
7. Après le déploiement, définir l'URL CloudFront dans `cloudFrontUrl` et redéployer
8. Exécuter l'authentification AD depuis le bouton « Sign in with AD » sur l'interface CloudFront

**Modèle AD auto-géré (sur EC2, avec intégration Entra Connect) :**

Intègre l'AD sur EC2 avec Entra ID (anciennement Azure AD) et utilise l'URL de métadonnées de fédération Entra ID.

```json
{
  "enableAdFederation": true,
  "adEc2InstanceId": "i-0123456789abcdef0",
  "samlMetadataUrl": "https://login.microsoftonline.com/{tenant-id}/federationmetadata/2007-06/federationmetadata.xml",
  "cloudFrontUrl": "https://d3xxxxx.cloudfront.net"
}
```

Étapes de configuration :
1. Installer AD DS sur EC2 et configurer la synchronisation avec Entra Connect
2. Obtenir l'URL de métadonnées de fédération Entra ID
3. Définir les paramètres ci-dessus et déployer CDK
4. Exécuter l'authentification AD depuis le bouton « Sign in with AD » sur l'interface CloudFront

**Comparaison des modèles :**

| Élément | AD géré | AD auto-géré |
|---------|---------|--------------|
| Métadonnées SAML | Via IAM Identity Center ou spécification `samlMetadataUrl` | URL de métadonnées Entra ID (spécification `samlMetadataUrl`) |
| Méthode de récupération SID | LDAP ou via SSM | SSM → EC2 → PowerShell |
| Paramètres requis | `adPassword`, `cloudFrontUrl` + configuration IAM Identity Center (ou `samlMetadataUrl`) | `adEc2InstanceId`, `samlMetadataUrl`, `cloudFrontUrl` |
| Gestion AD | Géré par AWS | Géré par l'utilisateur |
| Coût | Tarification AD géré | Tarification instance EC2 |

**Dépannage :**

| Symptôme | Cause | Solution |
|----------|-------|----------|
| Échec d'authentification SAML | URL de métadonnées SAML IdP invalide | AD géré : Vérifier la configuration IAM Identity Center, ou spécifier directement via `samlMetadataUrl`. Auto-géré : Vérifier l'URL de métadonnées Entra ID |
| Erreur de callback OAuth | `cloudFrontUrl` non défini ou non concordant | Vérifier que `cloudFrontUrl` dans le contexte CDK correspond à l'URL de la distribution CloudFront |
| Échec du Post-Auth Trigger | Permissions insuffisantes du Lambda AD Sync | Vérifier les détails d'erreur dans CloudWatch Logs. La connexion elle-même n'est pas bloquée |
| Erreur d'accès S3 dans la recherche KB | Le rôle IAM KB manque de permissions d'accès direct au bucket S3 | Le rôle IAM KB n'a des permissions que via S3 Access Point. Lors de l'utilisation directe du bucket S3 comme source de données, les permissions `s3:GetObject` et `s3:ListBucket` doivent être ajoutées (non spécifique à AD Federation) |
| S3 AP data plane API AccessDenied | WindowsUser inclut le préfixe de domaine | Le WindowsUser du S3 AP ne doit PAS inclure le préfixe de domaine (ex: `DEMO\Admin`). Spécifiez uniquement le nom d'utilisateur (ex: `Admin`). Le CLI accepte le préfixe mais les API data plane échouent |
| Échec de création du domaine Cognito | Conflit de préfixe de domaine | Vérifier si le préfixe `{projectName}-{environment}-auth` est en conflit avec d'autres comptes |
| Erreur USER_PASSWORD_AUTH 401 | SECRET_HASH non envoyé lorsque Client Secret est activé | Avec `enableAdFederation=true`, le Client User Pool a un Client Secret. L'API de connexion doit calculer SECRET_HASH à partir de la variable d'environnement `COGNITO_CLIENT_SECRET` |
| Post-Auth Trigger `Cannot find module 'index'` | Lambda TypeScript non compilé | CDK `Code.fromAsset` a une option de bundling esbuild. `npx esbuild index.ts --bundle --platform=node --target=node22 --outfile=index.js --external:@aws-sdk/*` |
| Redirection OAuth Callback `0.0.0.0` | Lambda Web Adapter `request.url` est `http://0.0.0.0:3000/...` | Utiliser la variable d'environnement `CALLBACK_URL` pour construire l'URL de base de redirection |

#### OIDC/LDAP Federation (optionnel) — Provisionnement utilisateur sans intervention

En plus de SAML AD Federation, vous pouvez activer OIDC IdP (Keycloak, Okta, Entra ID, etc.) et les requêtes LDAP directes pour le provisionnement utilisateur sans intervention. Les permissions utilisateur existantes du serveur de fichiers sont automatiquement mappées aux utilisateurs de l'interface RAG — aucune inscription manuelle par les administrateurs ou les utilisateurs n'est requise.

Chaque méthode d'authentification utilise l'« activation automatique pilotée par la configuration ». Il suffit d'ajouter les valeurs de configuration dans `cdk.context.json` pour l'activer, avec un coût de ressources AWS supplémentaire quasi nul. L'activation simultanée SAML + OIDC est également prise en charge.

**Exemple de configuration OIDC + LDAP (OpenLDAP/FreeIPA + Keycloak) :**

```json
{
  "oidcProviderConfig": {
    "providerName": "Keycloak",
    "clientId": "rag-system",
    "clientSecret": "arn:aws:secretsmanager:ap-northeast-1:123456789012:secret:oidc-client-secret",
    "issuerUrl": "https://keycloak.example.com/realms/main",
    "groupClaimName": "groups"
  },
  "ldapConfig": {
    "ldapUrl": "ldaps://ldap.example.com:636",
    "baseDn": "dc=example,dc=com",
    "bindDn": "cn=readonly,dc=example,dc=com",
    "bindPasswordSecretArn": "arn:aws:secretsmanager:ap-northeast-1:123456789012:secret:ldap-bind-password"
  },
  "permissionMappingStrategy": "uid-gid"
}
```

**Paramètres CDK :**

| Paramètre | Type | Description |
|-----------|------|-------------|
| `oidcProviderConfig` | object | Configuration OIDC IdP (`providerName`, `clientId`, `clientSecret`, `issuerUrl`, `groupClaimName`) |
| `ldapConfig` | object | Configuration de connexion LDAP (`ldapUrl`, `baseDn`, `bindDn`, `bindPasswordSecretArn`, `userSearchFilter`, `groupSearchFilter`) |
| `permissionMappingStrategy` | string | Stratégie de mappage des permissions : `sid-only` (par défaut), `uid-gid`, `hybrid` |
| `ontapNameMappingEnabled` | boolean | Intégration ONTAP name-mapping (mappage utilisateur UNIX→Windows) |

Page de connexion hybride SAML + OIDC (Connexion AD + Connexion Auth0 + E-mail/Mot de passe) :

![Page de connexion (SAML + OIDC Hybride)](docs/screenshots/signin-page-saml-oidc-hybrid.png)

#### Fonctionnalités entreprise (optionnel)

Les paramètres de contexte CDK suivants activent les fonctionnalités d'amélioration de la sécurité et d'unification de l'architecture.

```json
{
  "useS3AccessPoint": "true",
  "usePermissionFilterLambda": "true",
  "enableGuardrails": "true",
  "enableKmsEncryption": "true",
  "enableCloudTrail": "true",
  "enableVpcEndpoints": "true"
}
```

| Paramètre | Défaut | Description |
|-----------|--------|-------------|
| `ontapMgmtIp` | (aucun) | IP de gestion ONTAP. Lorsqu'il est défini, le serveur d'embedding génère automatiquement `.metadata.json` depuis l'API REST ONTAP |
| `ontapSvmUuid` | (aucun) | UUID SVM (utilisé avec `ontapMgmtIp`) |
| `ontapAdminSecretArn` | (aucun) | ARN Secrets Manager pour le mot de passe admin ONTAP |
| `useS3AccessPoint` | `false` | Utiliser S3 Access Point comme source de données Bedrock KB |
| `volumeSecurityStyle` | `NTFS` | Style de sécurité du volume FSx ONTAP (`NTFS` or `UNIX`) |
| `s3apUserType` | (auto) | Type d'utilisateur S3 AP (`WINDOWS` or `UNIX`). Par défaut : AD configuré→WINDOWS, pas d'AD→UNIX |
| `s3apUserName` | (auto) | Nom d'utilisateur S3 AP. Par défaut : WINDOWS→`Admin`, UNIX→`root` |
| `usePermissionFilterLambda` | `false` | Exécuter le filtrage SID via un Lambda dédié (avec repli sur le filtrage en ligne) |
| `enableGuardrails` | `false` | Bedrock Guardrails (filtre de contenu nuisible + protection PII) |
| `enableAgent` | `false` | Bedrock Agent + Action Group avec gestion des permissions (recherche KB + filtrage SID). Création dynamique d'Agent (crée et lie automatiquement des Agents spécifiques à la catégorie au clic sur la carte) |
| `enableAgentSharing` | `false` | Bucket S3 de partage de configuration Agent. Export/import JSON des configurations Agent, partage à l'échelle de l'organisation via S3 |
| `enableAgentSchedules` | `false` | Infrastructure d'exécution planifiée des Agents (EventBridge Scheduler + Lambda + table d'historique d'exécution DynamoDB) |
| `enableKmsEncryption` | `false` | Chiffrement KMS CMK pour S3 et DynamoDB (rotation de clé activée) |
| `enableCloudTrail` | `false` | Journaux d'audit CloudTrail (accès aux données S3 + invocations Lambda, rétention de 90 jours) |
| `enableVpcEndpoints` | `false` | VPC Endpoints (S3, DynamoDB, Bedrock, SSM, Secrets Manager, CloudWatch Logs) |
| `enableMonitoring` | `false` | Tableau de bord CloudWatch + alertes SNS + surveillance EventBridge KB Ingestion. Coût : Tableau de bord 3$/mois + Alarmes 0,10$/alarme/mois |
| `monitoringEmail` | *(aucun)* | Adresse e-mail de notification d'alerte (effective quand `enableMonitoring=true`) |
| `enableAgentCoreMemory` | `false` | Activer AgentCore Memory (mémoire à court et long terme). Nécessite `enableAgent=true` |
| `enableAgentCoreObservability` | `false` | Intégrer les métriques AgentCore Runtime dans le tableau de bord (effective quand `enableMonitoring=true`) |
| `enableAdvancedPermissions` | `false` | Contrôle d'accès basé sur le temps + journal d'audit des décisions de permissions. Crée la table DynamoDB `permission-audit` |
| `alarmEvaluationPeriods` | `1` | Nombre de périodes d'évaluation d'alarme (l'alarme se déclenche après N dépassements consécutifs du seuil) |
| `dashboardRefreshInterval` | `300` | Intervalle de rafraîchissement automatique du tableau de bord (secondes) |

#### Sélection de la configuration du magasin de vecteurs

Changez le magasin de vecteurs en utilisant le paramètre `vectorStoreType`. La valeur par défaut est S3 Vectors (faible coût).

| Configuration | Coût | Latence | Utilisation recommandée |
|--------------|------|---------|------------------------|
| `s3vectors` (défaut) | Quelques dollars/mois | Sous-seconde à 100ms | Démo, développement, optimisation des coûts |

#### Utilisation d'un FSx for ONTAP existant

Si un système de fichiers FSx for ONTAP existe déjà, vous pouvez référencer les ressources existantes au lieu d'en créer de nouvelles. Cela réduit considérablement le temps de déploiement (élimine l'attente de 30-40 minutes pour la création de FSx ONTAP).

```bash
npx cdk deploy --all --app "npx ts-node bin/demo-app.ts" \
  -c existingFileSystemId=fs-0123456789abcdef0 \
  -c existingSvmId=svm-0123456789abcdef0 \
  -c existingVolumeId=fsvol-0123456789abcdef0 \
  -c vectorStoreType=s3vectors \
  -c enableAgent=true
```

| Paramètre | Description |
|-----------|-------------|
| `existingFileSystemId` | ID du système de fichiers FSx ONTAP existant (ex. `fs-0123456789abcdef0`) |
| `existingSvmId` | ID SVM existant (ex. `svm-0123456789abcdef0`) |
| `existingVolumeId` | ID du volume existant (ex : `fsvol-0123456789abcdef0`) — spécifiez **un volume principal** |

> **Note** : En mode référence FSx existant, FSx/SVM/Volume sont en dehors de la gestion CDK. Ils ne seront pas supprimés par `cdk destroy`. L'AD géré n'est pas non plus créé (utilise les paramètres AD de l'environnement existant).


##### Plusieurs volumes sous un même SVM

Lorsqu'un SVM contient plusieurs volumes, spécifiez uniquement **un volume principal** dans `existingVolumeId` lors du déploiement CDK. Les volumes supplémentaires sont ajoutés après le déploiement via la procédure de gestion des cibles d'embedding.

```
FileSystem: fs-0123456789abcdef0
└── SVM: svm-0123456789abcdef0
    ├── vol-data      (fsvol-aaaa...)  ← existingVolumeId
    ├── vol-reports   (fsvol-bbbb...)  ← post-deploy
    └── vol-archives  (fsvol-cccc...)  ← post-deploy
```

| Configuration | Coût | Latence | Utilisation recommandée | Contraintes de métadonnées |
|--------------|------|---------|------------------------|---------------------------|
| `s3vectors` (défaut) | Quelques dollars/mois | Sous-seconde à 100ms | Démo, développement, optimisation des coûts | Limite filterable de 2 Ko (voir ci-dessous) |
| `opensearch-serverless` | ~700$/mois | ~10ms | Environnements de production haute performance | Aucune contrainte |

```bash
# Configuration S3 Vectors (défaut)
npx cdk deploy --all --app "npx ts-node bin/demo-app.ts" -c vectorStoreType=s3vectors

# Configuration OpenSearch Serverless
npx cdk deploy --all --app "npx ts-node bin/demo-app.ts" -c vectorStoreType=opensearch-serverless
```

Si des performances élevées sont nécessaires tout en utilisant la configuration S3 Vectors, vous pouvez exporter à la demande vers OpenSearch Serverless en utilisant `demo-data/scripts/export-to-opensearch.sh`. Pour plus de détails, consultez [docs/stack-architecture-comparison.md](docs/stack-architecture-comparison.md).

### Étape 6 : Configuration pré-déploiement (Préparation de l'image ECR)

Le stack WebApp référence une image Docker depuis un dépôt ECR, l'image doit donc être préparée avant le déploiement CDK.

```bash
bash demo-data/scripts/pre-deploy-setup.sh
```

Ce script effectue automatiquement les opérations suivantes :
1. Crée le dépôt ECR (`permission-aware-rag-webapp`)
2. Construit et pousse l'image Docker

Le mode de construction est automatiquement sélectionné en fonction de l'architecture hôte :

| Hôte | Mode de construction | Description |
|------|---------------------|-------------|
| x86_64 (EC2, etc.) | Construction Docker complète | npm install + next build dans le Dockerfile |
| arm64 (Apple Silicon) | Mode pré-construction | Construction next locale → Packaging Docker |

> **Temps requis** : EC2 (x86_64) : 3-5 min, Local (Apple Silicon) : 5-8 min, CodeBuild : 5-10 min

> **Note pour Apple Silicon** : `docker buildx` est requis (`brew install docker-buildx`). Lors du push vers ECR, spécifiez `--provenance=false` (car Lambda ne supporte pas le format manifest list).

### Étape 7 : Déploiement CDK

```bash
npx cdk deploy --all \
  --app "npx ts-node bin/demo-app.ts" \
  -c enableAgent=true \
  --require-approval never
```

Pour activer les fonctionnalités entreprise :

```bash
npx cdk deploy --all \
  --app "npx ts-node bin/demo-app.ts" \
  -c enableAgent=true \
  -c enableAgentSharing=true \
  -c enableAgentSchedules=true \
  --require-approval never
```

Pour activer la surveillance et les alertes :

```bash
npx cdk deploy --all \
  --app "npx ts-node bin/demo-app.ts" \
  -c enableAgent=true \
  -c enableMonitoring=true \
  -c monitoringEmail=ops@example.com \
  --require-approval never
```

> **Estimation du coût de surveillance** : CloudWatch Dashboard 3$/mois + Alarmes 0,10$/alarme/mois (7 alarmes = 0,70$/mois) + notifications SNS dans le niveau gratuit. Total environ 4$/mois.

> **Temps requis** : La création de FSx for ONTAP prend 20-30 minutes, donc le total est d'environ 30-40 minutes.

### Étape 8 : Configuration post-déploiement (Commande unique)

Une fois le déploiement CDK terminé, toute la configuration est finalisée avec cette commande unique :

```bash
bash demo-data/scripts/post-deploy-setup.sh
```

Ce script effectue automatiquement les opérations suivantes :
1. Crée le S3 Access Point + configure la politique
2. Télécharge les données de démonstration vers FSx ONTAP (via S3 AP)
3. Ajoute la source de données Bedrock KB + synchronise
4. Enregistre les données SID utilisateur dans DynamoDB
5. Crée les utilisateurs de démonstration dans Cognito (admin / user)

> **Temps requis** : 2-5 minutes (incluant l'attente de synchronisation KB)

### Étape 9 : Vérification du déploiement (Tests automatisés)

Exécutez les scripts de test automatisés pour vérifier toutes les fonctionnalités.

```bash
bash demo-data/scripts/verify-deployment.sh
```

Les résultats des tests sont auto-générés dans `docs/test-results.md`. Éléments de vérification :
- Statut des stacks (tous les 6 stacks CREATE/UPDATE_COMPLETE)
- Existence des ressources (Lambda URL, KB, Agent)
- Réponse de l'application (page de connexion HTTP 200)
- Mode KB avec gestion des permissions (admin : tous les documents autorisés, user : public uniquement)
- Mode Agent avec gestion des permissions (filtrage SID Action Group)
- S3 Access Point (AVAILABLE)
- Fonctionnalités Agent entreprise (bucket S3 partagé, table d'historique d'exécution DynamoDB, Lambda planificateur, réponses API Sharing/Schedules) *uniquement quand `enableAgentSharing`/`enableAgentSchedules` sont activés

### Étape 10 : Accès navigateur

Récupérez l'URL depuis les sorties CloudFormation et accédez-y dans votre navigateur.

```bash
aws cloudformation describe-stacks \
  --stack-name perm-rag-demo-demo-WebApp \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontUrl`].OutputValue' \
  --output text
```

### Nettoyage des ressources

Utilisez le script qui supprime toutes les ressources (stacks CDK + ressources créées manuellement) en une seule fois :

```bash
bash demo-data/scripts/cleanup-all.sh
```

Ce script effectue automatiquement les opérations suivantes :
1. Supprime les ressources créées manuellement (S3 AP, ECR, CodeBuild)
2. Supprime les sources de données Bedrock KB (requis avant cdk destroy)
3. Supprime les Bedrock Agents créés dynamiquement (Agents hors gestion CDK)
4. Supprime les ressources de fonctionnalités Agent entreprise (plannings et groupes EventBridge Scheduler, bucket S3 partagé)
5. Supprime le stack Embedding (si existant)
6. CDK destroy (tous les stacks)
7. Suppression individuelle des stacks restants + suppression des SG AD orphelins
8. Suppression des instances EC2 et SG non gérés par CDK dans le VPC + re-suppression du stack Networking
9. Suppression CDKToolkit + bucket S3 staging CDK (les deux régions, compatible versioning)

> **Note** : La suppression de FSx ONTAP prend 20-30 minutes, donc le total est d'environ 30-40 minutes.

## Dépannage

### Échec de création du stack WebApp (Image ECR introuvable)

| Symptôme | Cause | Solution |
|----------|-------|----------|
| `Source image ... does not exist` | Pas d'image Docker dans le dépôt ECR | Exécutez d'abord `bash demo-data/scripts/pre-deploy-setup.sh` |

> **Important** : Pour les nouveaux comptes, exécutez toujours `pre-deploy-setup.sh` avant le déploiement CDK. Le stack WebApp référence l'image `permission-aware-rag-webapp:latest` dans ECR.

### Incompatibilité de version du CLI CDK

| Symptôme | Cause | Solution |
|----------|-------|----------|
| `Cloud assembly schema version mismatch` | Le CLI CDK global est obsolète | Mettez à jour localement avec `npm install aws-cdk@latest` et utilisez `npx cdk` |

### Échec de déploiement dû au Hook CloudFormation

| Symptôme | Cause | Solution |
|----------|-------|----------|
| `The following hook(s)/validation failed: [AWS::EarlyValidation::ResourceExistenceCheck]` | Hook CloudFormation au niveau organisation bloquant le ChangeSet | Ajoutez l'option `--method=direct` pour contourner le ChangeSet |

```bash
# Déploiement dans les environnements avec Hook CloudFormation activé
npx cdk deploy --all --app "npx ts-node bin/demo-app.ts" --method=direct --require-approval never

# Le Bootstrap utilise aussi create-stack pour la création directe
aws cloudformation create-stack --stack-name CDKToolkit \
  --template-body file://cdk-bootstrap-template.yaml \
  --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM CAPABILITY_AUTO_EXPAND
```

### Erreur de permission Docker

| Symptôme | Cause | Solution |
|----------|-------|----------|
| `permission denied while trying to connect to the Docker daemon` | L'utilisateur n'est pas dans le groupe docker | `sudo usermod -aG docker ubuntu && newgrp docker` |

### Échec de déploiement AgentCore Memory

| Symptôme | Cause | Solution |
|----------|-------|----------|
| `EarlyValidation::PropertyValidation` | Les propriétés CfnMemory ne sont pas conformes au schéma | Les tirets ne sont pas autorisés dans Name (remplacer par `_`), EventExpiryDuration est en jours (min:3, max:365) |
| `Please provide a role with a valid trust policy` | Principal de service invalide pour le rôle IAM Memory | Utilisez `bedrock-agentcore.amazonaws.com` (pas `bedrock.amazonaws.com`) |
| `actorId failed to satisfy constraint` | actorId contient `@` `.` de l'adresse e-mail | Déjà géré dans `lib/agentcore/auth.ts` : `@` → `_at_`, `.` → `_dot_` |
| `AccessDeniedException: bedrock-agentcore:CreateEvent` | Le rôle d'exécution Lambda manque de permissions AgentCore | Automatiquement ajouté lors du déploiement CDK avec `enableAgentCoreMemory=true` |
| `exec format error` (échec de démarrage Lambda) | Architecture d'image Docker incompatible avec Lambda | Lambda est x86_64. Sur Apple Silicon, utilisez `docker buildx` + `--platform linux/amd64` |

### Échec de connexion SSM Session Manager

| Symptôme | Cause | Solution |
|----------|-------|----------|
| Instance non affichée dans SSM | Rôle IAM non configuré ou sortant 443 bloqué | Vérifiez le profil d'instance IAM et les règles sortantes du SG |

## Configuration WAF et restriction géographique

### Configuration des règles WAF

Le WAF CloudFront est déployé dans `us-east-1` et se compose de 6 règles (évaluées par ordre de priorité).

| Priorité | Nom de la règle | Type | Description |
|----------|----------------|------|-------------|
| 100 | RateLimit | Personnalisé | Bloque quand une seule adresse IP dépasse 3000 requêtes en 5 minutes |
| 200 | AWSIPReputationList | AWS géré | Bloque les adresses IP malveillantes telles que les botnets et sources DDoS |
| 300 | AWSCommonRuleSet | AWS géré | Règles générales conformes OWASP Top 10 (XSS, LFI, RFI, etc.). `GenericRFI_BODY`, `SizeRestrictions_BODY`, `CrossSiteScripting_BODY` exclus pour la compatibilité des requêtes RAG |
| 400 | AWSKnownBadInputs | AWS géré | Bloque les requêtes exploitant des vulnérabilités connues telles que Log4j (CVE-2021-44228) |
| 500 | AWSSQLiRuleSet | AWS géré | Détecte et bloque les schémas d'attaque par injection SQL |
| 600 | IPAllowList | Personnalisé (optionnel) | Actif uniquement quand `allowedIps` est configuré. Bloque les IP non listées |

### Restriction géographique

Applique des restrictions d'accès géographique au niveau CloudFront. C'est une couche de protection séparée du WAF.

- Par défaut : Japon (`JP`) uniquement
- Implémenté via `GeoRestriction.allowlist` de CloudFront
- L'accès depuis les pays non autorisés retourne `403 Forbidden`

### Configuration

Modifiez les valeurs suivantes dans `cdk.context.json`.

```json
{
  "allowedIps": ["203.0.113.0/24", "198.51.100.1/32"],
  "allowedCountries": ["JP", "US"]
}
```

| Paramètre | Type | Défaut | Description |
|-----------|------|--------|-------------|
| `allowedIps` | string[] | `[]` (pas de restriction) | Liste CIDR des adresses IP autorisées. Quand vide, la règle de filtre IP elle-même n'est pas créée |
| `allowedCountries` | string[] | `["JP"]` | Codes pays autorisés par la restriction géographique CloudFront (ISO 3166-1 alpha-2) |

### Configuration des documents cibles d'embedding

Les documents intégrés dans Bedrock KB sont déterminés par la structure de fichiers sur le volume FSx ONTAP.

#### Structure des répertoires et métadonnées SID

```
FSx ONTAP Volume (/data)
  ├── public/                          ← Accessible à tous les utilisateurs
  │   ├── product-catalog.md           ← Corps du document
  │   └── product-catalog.md.metadata.json  ← Métadonnées SID
  ├── confidential/                    ← Administrateurs uniquement
  │   ├── financial-report.md
  │   └── financial-report.md.metadata.json
  └── restricted/                      ← Groupes spécifiques uniquement
      ├── project-plan.md
      └── project-plan.md.metadata.json
```

#### Format .metadata.json

Définissez le contrôle d'accès basé sur SID dans le fichier `.metadata.json` correspondant à chaque document.

```json
{
  "metadataAttributes": {
    "allowed_group_sids": "[\"S-1-1-0\"]",
    "access_level": "public",
    "doc_type": "catalog"
  }
}
```

| Champ | Requis | Description |
|-------|--------|-------------|
| `allowed_group_sids` | ✅ | Chaîne de tableau JSON des SID autorisés. `S-1-1-0` est Everyone |
| `access_level` | Optionnel | Niveau d'accès pour l'affichage UI (`public`, `confidential`, `restricted`) |
| `doc_type` | Optionnel | Type de document (pour filtrage futur) |

#### Valeurs SID clés

| SID | Nom | Utilisation |
|-----|-----|-------------|
| `S-1-1-0` | Everyone | Documents publiés à tous les utilisateurs |
| `S-1-5-21-...-512` | Domain Admins | Documents accessibles uniquement aux administrateurs |
| `S-1-5-21-...-1100` | Engineering | Documents pour le groupe ingénierie |

> **Détails** : Voir [docs/SID-Filtering-Architecture.md](docs/SID-Filtering-Architecture.md) pour le mécanisme de filtrage SID.

#### Contraintes et considérations des métadonnées S3 Vectors

Lors de l'utilisation de la configuration S3 Vectors (`vectorStoreType=s3vectors`), notez les contraintes de métadonnées suivantes.

| Contrainte | Valeur | Impact |
|-----------|--------|--------|
| Métadonnées filtrables | 2 Ko/vecteur | Y compris les métadonnées internes Bedrock KB (~1 Ko), les métadonnées personnalisées sont effectivement **1 Ko ou moins** |
| Clés de métadonnées non filtrables | Max 10 clés/index | Atteint la limite avec les clés auto Bedrock KB (5) + clés personnalisées (5) |
| Métadonnées totales | 40 Ko/vecteur | Généralement pas un problème |

### Sélection du chemin d'ingestion des données

| Chemin | Méthode | Activation CDK | Statut |
|--------|---------|---------------|--------|
| Principal | FSx ONTAP → S3 Access Point → Bedrock KB → Vector Store | Exécuter `post-deploy-setup.sh` après le déploiement CDK | ✅ |
| Repli | Téléchargement direct bucket S3 → Bedrock KB → Vector Store | Manuel (`upload-demo-data.sh`) | ✅ |
| Alternatif (optionnel) | Serveur d'embedding (montage CIFS) → Écriture directe AOSS | `-c enableEmbeddingServer=true` | ✅ (configuration AOSS uniquement) |

> **Chemin de repli** : Si FSx ONTAP S3 AP n'est pas disponible (ex. restrictions SCP d'Organisation), vous pouvez télécharger directement les documents + `.metadata.json` dans un bucket S3 et le configurer comme source de données KB. Le filtrage SID ne dépend pas du type de source de données.

### Gestion manuelle des documents cibles d'embedding

Vous pouvez ajouter, modifier et supprimer des documents cibles d'embedding sans déploiement CDK.

#### Ajout de documents

Via FSx ONTAP S3 Access Point (chemin principal) :

```bash
# Placer les fichiers sur FSx ONTAP via SMB depuis EC2 ou WorkSpaces dans le VPC
SVM_IP=<SVM_SMB_IP>
smbclient //$SVM_IP/data -U 'demo.local\Admin%<PASSWORD>' \
  -c "cd public; put new-document.md; put new-document.md.metadata.json"

# Exécuter la synchronisation KB (requis après l'ajout de documents)
aws bedrock-agent start-ingestion-job \
  --knowledge-base-id <KB_ID> \
  --data-source-id <DATA_SOURCE_ID> \
  --region ap-northeast-1
```

Téléchargement direct bucket S3 (chemin de repli) :

```bash
# Télécharger documents + métadonnées dans le bucket S3
aws s3 cp new-document.md s3://<DATA_BUCKET>/public/new-document.md
aws s3 cp new-document.md.metadata.json s3://<DATA_BUCKET>/public/new-document.md.metadata.json

# Synchronisation KB
aws bedrock-agent start-ingestion-job \
  --knowledge-base-id <KB_ID> \
  --data-source-id <DATA_SOURCE_ID> \
  --region ap-northeast-1
```

#### Mise à jour de documents

Après avoir écrasé un document, relancez la synchronisation KB. Bedrock KB détecte automatiquement les documents modifiés et les ré-intègre.

```bash
# Écraser le document via SMB
smbclient //$SVM_IP/data -U 'demo.local\Admin%<PASSWORD>' \
  -c "cd public; put updated-document.md product-catalog.md"

# Synchronisation KB (détection de changement + ré-embedding)
aws bedrock-agent start-ingestion-job \
  --knowledge-base-id <KB_ID> \
  --data-source-id <DATA_SOURCE_ID> \
  --region ap-northeast-1
```

#### Suppression de documents

```bash
# Supprimer le document via SMB
smbclient //$SVM_IP/data -U 'demo.local\Admin%<PASSWORD>' \
  -c "cd public; del old-document.md; del old-document.md.metadata.json"

# Synchronisation KB (détection de suppression + retrait du magasin de vecteurs)
aws bedrock-agent start-ingestion-job \
  --knowledge-base-id <KB_ID> \
  --data-source-id <DATA_SOURCE_ID> \
  --region ap-northeast-1
```

#### Modification des métadonnées SID (Changements de permissions d'accès)

Pour modifier les permissions d'accès d'un document, mettez à jour le `.metadata.json` et lancez la synchronisation KB.

```bash
# Exemple : Changer un document public en confidentiel
cat > financial-report.md.metadata.json << 'EOF'
{"metadataAttributes":{"allowed_group_sids":"[\"S-1-5-21-...-512\"]","access_level":"confidential","doc_type":"financial"}}
EOF

smbclient //$SVM_IP/data -U 'demo.local\Admin%<PASSWORD>' \
  -c "cd confidential; put financial-report.md.metadata.json"

# Synchronisation KB
aws bedrock-agent start-ingestion-job \
  --knowledge-base-id <KB_ID> \
  --data-source-id <DATA_SOURCE_ID> \
  --region ap-northeast-1
```

> **Note** : Lancez toujours la synchronisation KB après l'ajout, la mise à jour ou la suppression de documents. Les changements ne sont pas reflétés dans le magasin de vecteurs sans synchronisation. La synchronisation se termine généralement en 30 secondes à 2 minutes.

## Fonctionnement du RAG avec gestion des permissions

### Flux de traitement (Méthode en 2 étapes : Retrieve + Converse)

```
User              Next.js API             DynamoDB            Bedrock KB         Converse API
  |                    |                      |                    |                  |
  | 1. Send query      |                      |                    |                  |
  |------------------->|                      |                    |                  |
  |                    | 2. Get user SIDs     |                    |                  |
  |                    |--------------------->|                    |                  |
  |                    |<---------------------|                    |                  |
  |                    | userSID + groupSIDs  |                    |                  |
  |                    |                      |                    |                  |
  |                    | 3. Retrieve API      |                    |                  |
  |                    |  (vector search)     |                    |                  |
  |                    |--------------------->|------------------->|                  |
  |                    |<---------------------|                    |                  |
  |                    | Results + metadata   |                    |                  |
  |                    |  (allowed_group_sids)|                    |                  |
  |                    |                      |                    |                  |
  |                    | 4. SID matching      |                    |                  |
  |                    | userSIDs n docSIDs   |                    |                  |
  |                    | -> Match: ALLOW      |                    |                  |
  |                    | -> No match: DENY    |                    |                  |
  |                    |                      |                    |                  |
  |                    | 5. Generate answer   |                    |                  |
  |                    |  (allowed docs only) |                    |                  |
  |                    |--------------------->|------------------->|----------------->|
  |                    |<---------------------|                    |                  |
  |                    |                      |                    |                  |
  | 6. Filtered result |                      |                    |                  |
  |<-------------------|                      |                    |                  |
```

1. L'utilisateur envoie une question via le chat
2. Récupère la liste SID de l'utilisateur (SID personnel + SID de groupes) depuis la table DynamoDB `user-access`
3. L'API Bedrock KB Retrieve effectue une recherche vectorielle pour récupérer les documents pertinents (les métadonnées incluent les informations SID)
4. Compare les `allowed_group_sids` de chaque document avec la liste SID de l'utilisateur, n'autorisant que les documents correspondants
5. Génère une réponse via l'API Converse en utilisant uniquement les documents auxquels l'utilisateur a accès comme contexte
6. Affiche la réponse filtrée et les informations de citation

### Fonctionnement du filtrage SID

Chaque document a des informations SID ACL NTFS attachées via `.metadata.json`. Lors de la recherche, les SID utilisateur sont comparés aux SID des documents, et l'accès n'est autorisé qu'en cas de correspondance.

```
■ Utilisateur admin : SID = [...-512 (Domain Admins), S-1-1-0 (Everyone)]
  public/     (Everyone)      → S-1-1-0 correspondance → ✅ Autorisé
  confidential/ (Domain Admins) → ...-512 correspondance → ✅ Autorisé
  restricted/ (Engineering+DA) → ...-512 correspondance → ✅ Autorisé

■ Utilisateur standard : SID = [...-1001, S-1-1-0 (Everyone)]
  public/     (Everyone)      → S-1-1-0 correspondance → ✅ Autorisé
  confidential/ (Domain Admins) → Pas de correspondance → ❌ Refusé
  restricted/ (Engineering+DA) → Pas de correspondance → ❌ Refusé
```

Pour plus de détails, consultez [docs/SID-Filtering-Architecture.md](docs/SID-Filtering-Architecture.md).

## Stack technique

| Couche | Technologie |
|--------|------------|
| IaC | AWS CDK v2 (TypeScript) |
| Frontend | Next.js 15 + React 18 + Tailwind CSS |
| Auth | Amazon Cognito |
| AI/RAG | Amazon Bedrock Knowledge Base + S3 Vectors / OpenSearch Serverless |
| Embedding | Amazon Titan Text Embeddings v2 (`amazon.titan-embed-text-v2:0`, 1024 dimensions) |
| Stockage | Amazon FSx for NetApp ONTAP + S3 |
| Calcul | Lambda Web Adapter + CloudFront |
| Permissions | DynamoDB (user-access: SID data, perm-cache: permission cache) |
| Sécurité | AWS WAF + IAM Auth + OAC + Geo Restriction |

## Scénarios de vérification

Consultez [demo-data/guides/demo-scenario.md](demo-data/guides/demo-scenario.md) pour les procédures de vérification du filtrage des permissions.

Lorsque deux types d'utilisateurs (administrateur et utilisateur standard) posent la même question, vous pouvez confirmer que des résultats de recherche différents sont retournés en fonction des permissions d'accès.

## Liste de documentation

| Document | Contenu |
|----------|---------|
| [docs/implementation-overview.md](docs/implementation-overview.md) | Description détaillée de l'implémentation (14 perspectives) |
| [docs/ui-specification.md](docs/ui-specification.md) | Spécification UI (basculement KB/Agent, répertoire Agent, design barre latérale, affichage citations) |
| [docs/SID-Filtering-Architecture.md](docs/SID-Filtering-Architecture.md) | Détails de l'architecture de filtrage basé sur SID |
| [docs/embedding-server-design.md](docs/embedding-server-design.md) | Conception du serveur d'embedding (incluant la récupération automatique ACL ONTAP) |
| [docs/stack-architecture-comparison.md](docs/stack-architecture-comparison.md) | Guide d'architecture des stacks CDK (comparaison des magasins de vecteurs, insights d'implémentation) |
| [docs/verification-report.md](docs/verification-report.md) | Procédures de vérification post-déploiement et cas de test |
| [docs/demo-recording-guide.md](docs/demo-recording-guide.md) | Guide d'enregistrement vidéo de démonstration (6 éléments de preuve) |
| [docs/demo-environment-guide.md](docs/demo-environment-guide.md) | Guide de configuration de l'environnement de vérification |
| [docs/DOCUMENTATION_INDEX.md](docs/DOCUMENTATION_INDEX.md) | Index de documentation (ordre de lecture recommandé) |
| [demo-data/guides/demo-scenario.md](demo-data/guides/demo-scenario.md) | Scénarios de vérification (confirmation de la différence de permissions admin vs. utilisateur standard) |
| [demo-data/guides/ontap-setup-guide.md](demo-data/guides/ontap-setup-guide.md) | FSx ONTAP + intégration AD, partage CIFS, configuration ACL NTFS |

## Configuration FSx ONTAP + Active Directory

Consultez [demo-data/guides/ontap-setup-guide.md](demo-data/guides/ontap-setup-guide.md) pour les procédures d'intégration AD FSx ONTAP, de partage CIFS et de configuration ACL NTFS.

Le déploiement CDK crée AWS Managed Microsoft AD et FSx ONTAP (SVM + Volume). La jonction du SVM au domaine AD est exécutée via CLI après le déploiement (pour le contrôle du timing).

```bash
# Obtenir les IP DNS AD
AD_DNS_IPS=$(aws ds describe-directories --region ap-northeast-1 \
  --query 'DirectoryDescriptions[?Name==`demo.local`].DnsIpAddrs' --output json)

# Joindre le SVM à l'AD
# Note : Pour AWS Managed AD, OrganizationalUnitDistinguishedName doit être spécifié
aws fsx update-storage-virtual-machine \
  --storage-virtual-machine-id <SVM_ID> \
  --active-directory-configuration '{
    "NetBiosName": "RAGSVM",
    "SelfManagedActiveDirectoryConfiguration": {
      "DomainName": "demo.local",
      "UserName": "Admin",
      "Password": "<AD_PASSWORD>",
      "DnsIps": <AD_DNS_IPS>,
      "FileSystemAdministratorsGroup": "Domain Admins",
      "OrganizationalUnitDistinguishedName": "OU=Computers,OU=demo,DC=demo,DC=local"
    }
  }' --region ap-northeast-1
```

> **Important** : Pour AWS Managed AD, si `OrganizationalUnitDistinguishedName` n'est pas spécifié, la jonction SVM AD deviendra `MISCONFIGURED`. Le format du chemin OU est `OU=Computers,OU=<AD ShortName>,DC=<domain>,DC=<tld>`.

Les décisions de conception pour S3 Access Point (type d'utilisateur WINDOWS, accès Internet) sont également documentées dans le guide.

### Guide de conception des utilisateurs S3 Access Point

La combinaison du type d'utilisateur et du nom d'utilisateur spécifiés lors de la création d'un S3 Access Point varie selon le style de sécurité du volume et l'état de jonction AD. Il existe 4 modèles.

#### Matrice de décision à 4 modèles

| Modèle | Type d'utilisateur | Source utilisateur | Condition | Exemple de paramètre CDK |
|--------|-------------------|-------------------|-----------|-------------------------|
| A | WINDOWS | Utilisateur AD existant | SVM joint à AD + volume NTFS/UNIX | `s3apUserType=WINDOWS` (par défaut) |
| B | WINDOWS | Nouvel utilisateur dédié | SVM joint à AD + compte de service dédié | `s3apUserType=WINDOWS s3apUserName=s3ap-service` |
| C | UNIX | Utilisateur UNIX existant | Pas de jonction AD ou volume UNIX | `s3apUserType=UNIX` (par défaut) |
| D | UNIX | Nouvel utilisateur dédié | Pas de jonction AD + utilisateur dédié | `s3apUserType=UNIX s3apUserName=s3ap-user` |

#### Organigramme de sélection de modèle

```
Le SVM est-il joint à AD ?
  ├── Oui → Volume NTFS ?
  │           ├── Oui → Modèle A (WINDOWS + utilisateur AD existant) recommandé
  │           └── Non → Modèle A ou C (les deux fonctionnent)
  └── Non → Modèle C (UNIX + root) recommandé
```

#### Détails de chaque modèle

**Modèle A : WINDOWS + Utilisateur AD existant (Recommandé : environnement NTFS)**

```bash
# Déploiement CDK
npx cdk deploy --all -c adPassword=<PASSWORD> -c volumeSecurityStyle=NTFS
# → S3 AP: WINDOWS, Admin (configuré automatiquement)
```

- Le contrôle d'accès au niveau des fichiers basé sur les ACL NTFS est activé
- L'accès aux fichiers via S3 AP est effectué avec l'utilisateur AD `Admin`
- Important : Ne pas inclure le préfixe de domaine (`DEMO\Admin`). Spécifier uniquement `Admin`

**Modèle B : WINDOWS + Nouvel utilisateur dédié**

```bash
# 1. Créer un compte de service dédié dans AD (PowerShell)
New-ADUser -Name "s3ap-service" -AccountPassword (ConvertTo-SecureString "P@ssw0rd" -AsPlainText -Force) -Enabled $true

# 2. Déploiement CDK
npx cdk deploy --all -c adPassword=<PASSWORD> -c s3apUserName=s3ap-service
```

- Compte dédié basé sur le principe du moindre privilège
- L'accès S3 AP peut être clairement identifié dans les journaux d'audit

**Modèle C : UNIX + Utilisateur UNIX existant (Recommandé : environnement UNIX)**

```bash
# Déploiement CDK (sans configuration AD)
npx cdk deploy --all -c volumeSecurityStyle=UNIX
# → S3 AP: UNIX, root (configuré automatiquement)
```

- Contrôle d'accès basé sur les permissions POSIX (uid/gid)
- Tous les fichiers accessibles avec l'utilisateur `root`
- Le filtrage SID fonctionne sur la base des métadonnées `.metadata.json` (ne dépend pas des ACL du système de fichiers)

**Modèle D : UNIX + Nouvel utilisateur dédié**

```bash
# 1. Créer un utilisateur UNIX dédié via ONTAP CLI
vserver services unix-user create -vserver <SVM_NAME> -user s3ap-user -id 1100 -primary-gid 0

# 2. Déploiement CDK
npx cdk deploy --all -c volumeSecurityStyle=UNIX -c s3apUserType=UNIX -c s3apUserName=s3ap-user
```

- Compte dédié basé sur le principe du moindre privilège
- Lors de l'accès avec un utilisateur autre que `root`, la configuration des permissions POSIX du volume est nécessaire

#### Relation avec le filtrage SID

Le filtrage SID ne dépend pas du type d'utilisateur S3 AP. La même logique fonctionne dans tous les modèles :

```
allowed_group_sids dans .metadata.json
  ↓
Retourné comme métadonnées via Bedrock KB Retrieve API
  ↓
Comparé avec les SID utilisateur (DynamoDB user-access) dans route.ts
  ↓
Correspondance → ALLOW, Pas de correspondance → DENY
```

Que ce soit un volume NTFS ou UNIX, le même filtrage SID est appliqué tant que les informations SID sont incluses dans `.metadata.json`.

## Licence

[Apache License 2.0](LICENSE)
