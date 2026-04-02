# Système RAG sensible aux permissions — Vue d'ensemble de l'implémentation

**🌐 Language:** [日本語](../implementation-overview.md) | [English](../en/implementation-overview.md) | [한국어](../ko/implementation-overview.md) | [简体中文](../zh-CN/implementation-overview.md) | [繁體中文](../zh-TW/implementation-overview.md) | **Français** | [Deutsch](../de/implementation-overview.md) | [Español](../es/implementation-overview.md)

**Date de création** : 2026-03-25  
**Version** : 3.3.0

---

## Vue d'ensemble

Ce système est un chatbot RAG (Retrieval-Augmented Generation) qui combine Amazon FSx for NetApp ONTAP avec Amazon Bedrock, fournissant un filtrage basé sur les permissions d'accès aux fichiers (SID). Il gère les informations ACL NTFS par utilisateur comme métadonnées et filtre les résultats de recherche en temps réel, permettant une recherche de documents sécurisée et une génération de réponses par IA.

Toute l'infrastructure est définie avec AWS CDK (TypeScript) et peut être déployée en une seule fois avec `npx cdk deploy --all`.

---

## 1. Application chatbot — Chatbot RAG Next.js sur AWS Lambda

### Détails d'implémentation

Une application chatbot RAG construite avec Next.js 15 (App Router) est exécutée de manière serverless via AWS Lambda Web Adapter.

### Architecture

```
Browser → CloudFront → Lambda Function URL → Lambda Web Adapter → Next.js (standalone)
```

### Stack technologique

| Couche | Technologie |
|--------|-----------|
| Framework | Next.js 15 (App Router, standalone output) |
| UI | React 18 + Tailwind CSS |
| Authentification | Amazon Cognito (JWT) |
| IA/RAG | Amazon Bedrock Knowledge Base Retrieve API + Converse API |
| Runtime | Lambda Web Adapter (Rust) + Docker Container |
| CDN | Amazon CloudFront |

### Fonctionnalités clés

- **Recherche RAG** : Effectue une recherche vectorielle via Bedrock Knowledge Base et génère des réponses en référençant les documents pertinents
- **Filtrage SID** : Filtre les résultats de recherche basé sur les informations SID de l'utilisateur (détaillé dans la section 7)
- **Basculement mode KB/Agent** : Basculez entre le mode KB (recherche de documents) et le mode Agent (raisonnement multi-étapes) via le toggle dans l'en-tête
- **Interface orientée tâches basée sur des cartes** : Avant de commencer un chat, le mode KB affiche des cartes spécifiques (recherche de documents, création de résumés, génération de quiz, etc.) et le mode Agent affiche des cartes de workflow (analyse financière, gestion de projet, etc.) en grille. Supporte la gestion des favoris et le filtrage par catégorie
- **Mode Agent (API InvokeAgent)** : Réalise un raisonnement multi-étapes avec filtrage SID via Bedrock Agent + Permission-aware Action Group. Se replie sur le mode hybride KB si l'invocation de l'Agent échoue
- **Support multilingue** : 8 langues — japonais, anglais, coréen, chinois (simplifié/traditionnel), français, allemand et espagnol
- **Affichage des citations** : Affiche les informations sources des documents utilisés comme base des réponses
- **Authentification Cognito** : Connexion/déconnexion et gestion de session

### Stack CDK

`DemoWebAppStack` (`lib/stacks/demo/demo-webapp-stack.ts`) crée les ressources suivantes :
- Lambda DockerImageFunction (image ECR, 1024 Mo de mémoire, timeout de 30 secondes)
- Lambda Function URL (authentification IAM)
- Distribution CloudFront (OAC + restriction géographique + intégration WAF)
- Bucket S3 pour les logs d'accès CloudFront

---

## 2. AWS WAF — Protection via IP et informations géographiques

### Détails d'implémentation

Un WebACL WAFv2 pour CloudFront est déployé dans `us-east-1`, protégeant l'application avec plusieurs règles de sécurité.

### Configuration des règles WAF (par priorité)

| Priorité | Nom de la règle | Type | Description |
|----------|----------------|------|-------------|
| 100 | RateLimit | Personnalisé | Bloque au-delà de 3 000 requêtes par IP en 5 minutes |
| 200 | AWSIPReputationList | AWS Managed | Bloque les IP malveillantes des botnets, sources DDoS, etc. |
| 300 | AWSCommonRuleSet | AWS Managed | Conforme OWASP Top 10 (XSS, LFI, RFI, etc.). Certaines règles exclues pour la compatibilité RAG |
| 400 | AWSKnownBadInputs | AWS Managed | Bloque les requêtes exploitant des vulnérabilités connues comme Log4j |
| 500 | AWSSQLiRuleSet | AWS Managed | Détecte et bloque les patterns d'attaque par injection SQL |
| 600 | IPAllowList | Personnalisé (optionnel) | Actif uniquement lorsque `allowedIps` est configuré. Bloque les IP non listées |

### Restriction géographique

Les restrictions d'accès géographique sont appliquées au niveau CloudFront (par défaut : Japon uniquement).

### Stack CDK

`DemoWafStack` (`lib/stacks/demo/demo-waf-stack.ts`) crée les ressources suivantes :
- WAFv2 WebACL (portée CLOUDFRONT, `us-east-1`)
- IP Set (lorsque `allowedIps` est configuré)

### Configuration

Contrôlé via `cdk.context.json` :
```json
{
  "allowedIps": ["203.0.113.0/24"],
  "allowedCountries": ["JP", "US"]
}
```

---

## 3. Authentification IAM — Lambda Function URL IAM Auth + CloudFront OAC

### Détails d'implémentation

L'authentification IAM (`AWS_IAM`) est configurée sur la Lambda Function URL, et CloudFront Origin Access Control (OAC) fournit le contrôle d'accès à l'origine via la signature SigV4.

### Flux d'authentification

```
Browser
  │
  ▼
CloudFront (OAC: Automatically adds SigV4 signature)
  │
  ▼
Lambda Function URL (AuthType: AWS_IAM)
  │ → Validates SigV4 signature
  │ → Allows only requests from CloudFront
  ▼
Next.js Application
  │
  ▼
Cognito JWT Validation (Application-level authentication)
```

### Couches de sécurité

| Couche | Technologie | Objectif |
|--------|-----------|---------|
| L1 : Réseau | Restriction géographique CloudFront | Restriction d'accès géographique |
| L2 : WAF | AWS WAF | Détection et blocage des patterns d'attaque |
| L3 : Auth origine | OAC (SigV4) | Empêche l'accès direct contournant CloudFront |
| L4 : Auth API | Lambda Function URL IAM Auth | Contrôle d'accès via authentification IAM |
| L5 : Auth utilisateur | Cognito JWT | Authentification et autorisation au niveau utilisateur |
| L6 : Authz données | Filtrage SID | Contrôle d'accès au niveau document |

### Implémentation CDK

Dans `DemoWebAppStack` :
- Crée la Function URL avec `lambda.FunctionUrlAuthType.AWS_IAM`
- Crée l'OAC avec `cloudfront.CfnOriginAccessControl` (`signingBehavior: 'always'`)
- Associe l'OAC à la Distribution en utilisant l'escape hatch L1

### Notes post-déploiement

La configuration IAM authentication + OAC ci-dessus est recommandée pour l'utilisation en production. Cependant, si des problèmes de compatibilité avec les requêtes POST (chat, etc.) surviennent dans les environnements de vérification, les ajustements manuels suivants peuvent être nécessaires :
- Changer le AuthType de Lambda Function URL à `NONE`
- Supprimer l'association OAC de CloudFront

---

## 4. Base de données vectorielle — S3 Vectors / Amazon OpenSearch Serverless

### Détails d'implémentation

La base de données vectorielle utilisée pour la recherche RAG peut être sélectionnée via le paramètre de contexte CDK `vectorStoreType` :
- **S3 Vectors** (par défaut) : Faible coût, latence sous-seconde. Utilisé directement comme vector store pour Bedrock KB
- **Amazon OpenSearch Serverless (AOSS)** : Haute performance (~10 ms), coût élevé (~700 $/mois)

### Décision de conception

Raisons du choix de S3 Vectors par défaut :
- Le coût est de quelques dollars par mois (petite échelle), significativement inférieur aux ~700 $/mois pour OpenSearch Serverless
- Supporté nativement comme vector store pour Bedrock KB
- Supporte le filtrage de métadonnées (`$eq`, `$in`, `$and`, `$or`)
- L'export en un clic de S3 Vectors vers AOSS est disponible lorsque de hautes performances sont nécessaires

### Stack CDK

`DemoAIStack` (`lib/stacks/demo/demo-ai-stack.ts`) crée les ressources suivantes :
- `vectorStoreType=s3vectors` : Bucket vectoriel S3 Vectors + index (Lambda de ressource personnalisée)
- `vectorStoreType=opensearch-serverless` : Collection OpenSearch Serverless + politiques de sécurité (chiffrement, réseau, accès aux données)
- Lambda de ressource personnalisée pour la création automatique d'index
- Bedrock Knowledge Base + source de données S3

---

## 5. Serveur d'Embedding — Montage CIFS FSx ONTAP + écriture dans la base vectorielle

### Détails d'implémentation

Sur une instance EC2 avec un volume Amazon FSx for NetApp ONTAP monté via CIFS/SMB, un conteneur Docker lit les documents, les vectorise et les indexe dans OpenSearch Serverless (AOSS). Non utilisé dans la configuration S3 Vectors (configuration AOSS uniquement).

### Vue d'ensemble des chemins d'ingestion de données

| Chemin | Méthode | Activation CDK | Statut |
|------|--------|---------------|--------|
| Option A (par défaut) | Bucket S3 → Source de données S3 Bedrock KB | Toujours activé | ✅ |
| Option B (optionnel) | Serveur d'Embedding (montage CIFS) → Écriture directe dans le vector store | `-c enableEmbeddingServer=true` | ✅ (configuration AOSS uniquement) |
| Option C (optionnel) | S3 Access Point → Bedrock KB | Configuration manuelle après déploiement | ✅ SnapMirror supporté, FlexCache bientôt |

> **À propos du S3 Access Point** : StorageStack crée automatiquement un S3 Access Point pour le volume FSx ONTAP. Selon le style de sécurité du volume (NTFS/UNIX) et l'état d'adhésion AD, un S3 AP de type utilisateur WINDOWS ou UNIX est créé. Cela peut être contrôlé explicitement via les paramètres de contexte CDK `volumeSecurityStyle`, `s3apUserType`, `s3apUserName`.

#### Conception du type d'utilisateur S3 Access Point

| Modèle | Type d'utilisateur | Source utilisateur | Style du volume | Condition |
|--------|-------------------|-------------------|----------------|-----------|
| A | WINDOWS | Utilisateur AD existant (Admin) | NTFS/UNIX | SVM joint à AD (recommandé : environnements NTFS) |
| B | WINDOWS | Nouvel utilisateur AD dédié | NTFS/UNIX | SVM joint à AD + moindre privilège |
| C | UNIX | Utilisateur UNIX existant (root) | UNIX | Non joint à AD (recommandé : environnements UNIX) |
| D | UNIX | Nouvel utilisateur UNIX dédié | UNIX | Non joint à AD + moindre privilège |

Le filtrage SID fonctionne avec la même logique (basée sur les métadonnées `.metadata.json`) pour tous les modèles et ne dépend pas du style de sécurité du volume ni du type d'utilisateur S3 AP.

Pour plus de détails sur le serveur d'Embedding, voir [embedding-server-design.md](embedding-server-design.md).

---

## 6. Amazon Titan Text Embeddings — Modèle de vectorisation

### Détails d'implémentation

`amazon.titan-embed-text-v2:0` est utilisé pour la vectorisation des documents.

### Spécifications du modèle

| Élément | Valeur |
|------|-------|
| ID du modèle | `amazon.titan-embed-text-v2:0` |
| Dimensions vectorielles | 1024 |
| Longueur d'entrée maximale | 8 000 caractères |
| Normalisation | Activée (`normalize: true`) |

### Utilisation

| Composant | Objectif |
|-----------|---------|
| Bedrock Knowledge Base | Vectorisation lors de l'ingestion de documents depuis la source de données S3 |
| Serveur d'Embedding | Vectorisation des documents montés via CIFS (`docker/embed/src/index.ts`) |

---

## 7. Métadonnées SID + filtrage des permissions

### Détails d'implémentation

Lors de la vectorisation des documents, les informations SID (Security Identifier) basées sur l'ACL NTFS du fichier sont attachées comme métadonnées dans les fichiers `.metadata.json`. Dans l'interface de chat, les SID de l'utilisateur connecté sont comparés aux SID de chaque document, et seuls les documents avec des SID correspondants sont inclus dans les résultats de recherche.

### Qu'est-ce qu'un SID ?

Un SID (Security Identifier) est un identifiant unique pour les principaux de sécurité (utilisateurs, groupes) dans Windows/NTFS.

```
S-1-5-21-{DomainID1}-{DomainID2}-{DomainID3}-{RID}
```

| SID | Nom | Description |
|-----|------|-------------|
| `S-1-1-0` | Everyone | Tous les utilisateurs |
| `S-1-5-21-...-512` | Domain Admins | Groupe des administrateurs du domaine |
| `S-1-5-21-...-1001` | User | Utilisateur standard |

### Fichier de métadonnées (`.metadata.json`)

Un fichier `.metadata.json` correspondant à chaque document définit la liste des SID d'accès autorisés.

```json
{
  "metadataAttributes": {
    "allowed_group_sids": ["S-1-5-21-0000000000-0000000000-0000000000-512"],
    "access_level": "confidential"
  }
}
```

### Correspondance document-SID

| Répertoire | Niveau d'accès | allowed_group_sids | Admin | Utilisateur standard |
|-----------|-------------|-------------------|-------|---------------------|
| `public/` | Public | `S-1-1-0` (Everyone) | ✅ Autorisé | ✅ Autorisé |
| `confidential/` | Confidentiel | `...-512` (Domain Admins) | ✅ Autorisé | ❌ Refusé |
| `restricted/` | Restreint | `...-1100` (Engineering) + `...-512` (DA) | ✅ Autorisé | ❌ Refusé |

### Flux de traitement du filtrage (méthode en deux étapes)

```
User              Next.js API Route        DynamoDB          Bedrock KB        Bedrock Converse
  │                  │                       │                  │                  │
  │ 1. Submit query  │                       │                  │                  │
  │─────────────────▶│                       │                  │                  │
  │                  │ 2. Get user SIDs      │                  │                  │
  │                  │──────────────────────▶│                  │                  │
  │                  │◀──────────────────────│                  │                  │
  │                  │ userSID + groupSIDs   │                  │                  │
  │                  │                       │                  │                  │
  │                  │ 3. Retrieve API (vector search)          │                  │
  │                  │─────────────────────────────────────────▶│                  │
  │                  │◀─────────────────────────────────────────│                  │
  │                  │ Search results + metadata(allowed_group_sids)               │
  │                  │                       │                  │                  │
  │                  │ 4. SID matching        │                  │                  │
  │                  │ User SIDs ∩ Document SIDs                │                  │
  │                  │ → Match: ALLOW                           │                  │
  │                  │ → No match: DENY                         │                  │
  │                  │                       │                  │                  │
  │                  │ 5. Converse API (generate answer using only allowed docs)   │
  │                  │────────────────────────────────────────────────────────────▶│
  │                  │◀────────────────────────────────────────────────────────────│
  │                  │                       │                  │                  │
  │ 6. Filtered      │                       │                  │                  │
  │    answer+Citation│                      │                  │                  │
  │◀─────────────────│                       │                  │                  │
```

Raison de l'utilisation de l'API Retrieve : L'API RetrieveAndGenerate ne retourne pas les métadonnées de citation (`allowed_group_sids`), donc le filtrage SID ne fonctionne pas. L'API Retrieve retourne correctement les métadonnées, donc la méthode en deux étapes (Retrieve → filtre SID → Converse) est adoptée.

### Repli Fail-Closed

Lorsque les vérifications de permissions échouent, l'accès à tous les documents est refusé.

| Situation | Comportement |
|-----------|-------------|
| Erreur de connexion DynamoDB | Tous les documents refusés |
| Pas d'enregistrement SID utilisateur | Tous les documents refusés |
| Pas d'info SID dans les métadonnées | Document correspondant refusé |
| Pas de correspondance SID | Document correspondant refusé |
| Correspondance SID trouvée | Document correspondant autorisé |

### Fichiers d'implémentation

| Fichier | Rôle |
|------|------|
| `docker/nextjs/src/app/api/bedrock/kb/retrieve/route.ts` | API de recherche KB + intégration du filtrage SID (support Lambda/inline) |
| `lambda/permissions/metadata-filter-handler.ts` | Lambda de filtrage des permissions basé sur les métadonnées (activé avec `-c usePermissionFilterLambda=true`) |
| `lambda/permissions/permission-filter-handler.ts` | Lambda de filtrage des permissions basé sur les ACL (pour extension future) |
| `lambda/permissions/permission-calculator.ts` | Logique de correspondance SID/ACL |
| `demo-data/scripts/setup-user-access.sh` | Script d'enregistrement des données SID utilisateur |
| `demo-data/documents/**/*.metadata.json` | Métadonnées SID des documents |

---

## 8. Bedrock Agent — IA agentique sensible aux permissions

### Détails d'implémentation

Un agent IA à raisonnement multi-étapes est implémenté avec Bedrock Agent. L'Agent effectue des recherches KB via un Permission-aware Action Group et génère des réponses en référençant uniquement les documents filtrés selon les permissions SID de l'utilisateur.

### Architecture

```
User → InvokeAgent API → Bedrock Agent (Claude 3 Haiku)
  │
  ├── Permission-aware Search Action Group
  │   ├── KB Retrieve API (vector search)
  │   ├── DynamoDB user-access (get user SIDs)
  │   ├── SID matching (allowed_group_sids ∩ userSIDs)
  │   └── Return only allowed documents
  │
  └── Agent multi-step reasoning → Answer generation
```

### Ressources CDK (`enableAgent=true`)

| Ressource | Description |
|----------|-------------|
| Bedrock Agent | Claude 3 Haiku, pas d'association KB directe (Action Group uniquement) |
| Agent Alias | Alias pour l'invocation stable |
| Lambda Action Group | Recherche KB sensible aux permissions (avec filtrage SID) |
| Rôle IAM Agent | Permissions Bedrock InvokeModel + KB Retrieve |

### Permission-aware Action Group

L'Agent ne recherche pas directement dans la KB mais y accède toujours via l'Action Group (`permissionAwareSearch`). Cela garantit :
- Le filtrage basé sur les informations SID de l'utilisateur est toujours appliqué
- Les administrateurs peuvent référencer tous les documents, tandis que les utilisateurs standard ne peuvent référencer que les documents publics
- Le raisonnement multi-étapes de l'Agent est exécuté uniquement avec les documents filtrés

### Interface orientée tâches basée sur des cartes

Des grilles de cartes spécifiques au mode sont affichées avant de commencer un chat. La configuration comprend 8 cartes pour le mode KB + 14 cartes pour le mode Agent (8 recherche + 6 production), permettant la saisie de prompts en un clic. Supporte la gestion des favoris et le filtrage par catégorie.

### Fichiers d'implémentation

| Fichier | Rôle |
|------|------|
| `lib/stacks/demo/demo-ai-stack.ts` | Ressources CDK Agent + Action Group |
| `lambda/bedrock-agent-actions/permission-aware-search.ts` | Lambda Action Group (version TypeScript) |
| `docker/nextjs/src/app/api/bedrock/agent/route.ts` | Route API InvokeAgent |
| `docker/nextjs/src/app/[locale]/genai/page.tsx` | Interface Agent (toggle de mode, workflows) |
| `docker/nextjs/src/components/bedrock/AgentModeSidebar.tsx` | Barre latérale Agent |

---

## 9. RAG par analyse d'images — Intégration de l'API Vision Bedrock

### Détails d'implémentation

Une fonctionnalité d'upload d'images est ajoutée à la saisie du chat, utilisant la capacité multimodale (API Vision) de l'API Converse de Bedrock pour analyser les images et intégrer les résultats dans le contexte de recherche KB.

### Flux de traitement

```
User → Drag & drop image or file picker
  → Validation (format: JPEG/PNG/GIF/WebP, size: ≤3MB)
  → Base64 encoding → API submission
  → Vision API (Claude 3 Haiku) image analysis
  → Analysis result + user query → KB Retrieve API
  → SID filtering → Answer generation
```

### Gestion des erreurs

- Format non supporté → Affichage du message d'erreur (i18n supporté)
- Dépasse 5 Mo → Affichage du message d'erreur
- Échec de l'API Vision → Se replie sur la requête texte uniquement (n'interrompt pas l'expérience utilisateur)
- Timeout de 15 secondes de l'API Vision → Annulé via AbortController, repli

---

## 10. Interface de connexion Knowledge Base — Gestion Agent × KB

### Détails d'implémentation

Lors de la création ou de l'édition d'Agents dans l'Agent Directory (`/genai/agents`), une interface est fournie pour sélectionner, connecter et déconnecter les Bedrock Knowledge Bases.

### Extensions API

Trois actions ajoutées à l'existant `/api/bedrock/agent` (pas de changements aux actions existantes) :

| Action | Description |
|--------|-------------|
| `associateKnowledgeBase` | Connecter la KB à l'Agent → PrepareAgent |
| `disassociateKnowledgeBase` | Déconnecter la KB de l'Agent → PrepareAgent |
| `listAgentKnowledgeBases` | Obtenir la liste des KB connectées à l'Agent |

---

## 11. Routage intelligent — Sélection de modèle optimisée en coût

### Détails d'implémentation

Route automatiquement les requêtes en fonction de leur complexité. Les requêtes factuelles courtes sont dirigées vers un modèle léger (Haiku), tandis que les requêtes analytiques longues sont dirigées vers un modèle haute performance (Sonnet).

### Algorithme de classification (ComplexityClassifier)

| Caractéristique | Tend vers Simple | Tend vers Complexe |
|-----------------|-----------------|-------------------|
| Nombre de caractères | ≤100 caractères (+0.3) | >100 caractères (+0.3) |
| Nombre de phrases | 1 phrase (+0.2) | Plusieurs phrases (+0.2) |
| Mots-clés analytiques | Aucun | Présents (+0.3) (比較/分析/要約/explain/compare/analyze/summarize) |
| Questions multiples | Aucune | 2+ points d'interrogation (+0.2) |

Score < 0.5 → simple, ≥ 0.5 → complexe. Confiance = |score - 0.5| × 2.

### Composants clés

| Fichier | Rôle |
|---------|------|
| `docker/nextjs/src/lib/complexity-classifier.ts` | Classification de la complexité des requêtes (fonction pure) |
| `docker/nextjs/src/lib/smart-router.ts` | Décision de routage du modèle |
| `docker/nextjs/src/store/useSmartRoutingStore.ts` | Store Zustand (persistance localStorage) |
| `docker/nextjs/src/components/sidebar/RoutingToggle.tsx` | Toggle ON/OFF + affichage de la paire de modèles |
| `docker/nextjs/src/components/chat/ResponseMetadata.tsx` | Nom du modèle utilisé + badge Auto/Manual |

### Paramètres par défaut

- Smart Routing : OFF par défaut (aucun impact sur le comportement existant)
- Modèle léger : `anthropic.claude-haiku-4-5-20251001-v1:0`
- Modèle haute performance : `anthropic.claude-3-5-sonnet-20241022-v2:0`

---

## 12. Monitoring et alertes — CloudWatch Dashboard + SNS Alerts + EventBridge

### Détails d'implémentation

Une fonctionnalité optionnelle activée avec `enableMonitoring=true` qui fournit un tableau de bord CloudWatch, des alertes SNS et une intégration EventBridge. L'état global du système peut être vérifié depuis un seul tableau de bord, et des notifications par e-mail sont envoyées lorsque des anomalies surviennent.

### Architecture

```
MonitoringConstruct (dans WebAppStack)
├── CloudWatch Dashboard (tableau de bord unifié)
│   ├── Lambda Overview (WebApp / PermFilter / AgentScheduler / AD Sync)
│   ├── CloudFront (nombre de requêtes, taux d'erreur, taux de cache hit)
│   ├── DynamoDB (capacité, throttling)
│   ├── Bedrock (appels API, latence)
│   ├── WAF (nombre de requêtes bloquées)
│   ├── Advanced RAG (Vision API, Smart Routing, gestion des connexions KB)
│   ├── AgentCore (conditionnel : enableAgentCoreObservability=true)
│   └── KB Ingestion Jobs (historique d'exécution)
├── CloudWatch Alarms → SNS Topic → Email
│   ├── WebApp Lambda taux d'erreur > 5%
│   ├── WebApp Lambda P99 Duration > 25 secondes
│   ├── CloudFront taux d'erreur 5xx > 1%
│   ├── DynamoDB throttling ≥ 1
│   ├── Permission Filter Lambda taux d'erreur > 10% (conditionnel)
│   ├── Vision API taux de timeout > 20%
│   └── Agent taux d'erreur d'exécution > 10% (conditionnel)
└── EventBridge Rule → SNS Topic
    └── Bedrock KB Ingestion Job FAILED
```

### Stack technologique

| Couche | Technologie |
|--------|-----------|
| Tableau de bord | CloudWatch Dashboard (rafraîchissement automatique 5 minutes) |
| Alarmes | CloudWatch Alarms (notifications dans les deux directions OK↔ALARM) |
| Notifications | SNS Topic + Email Subscription |
| Surveillance des événements | EventBridge Rule (détection d'échec KB Ingestion Job) |
| Métriques personnalisées | CloudWatch Embedded Metric Format (EMF) |
| Construct CDK | `lib/constructs/monitoring-construct.ts` |

### Métriques personnalisées (EMF)

Des métriques personnalisées sont émises dans les fonctions Lambda sous le namespace `PermissionAwareRAG/AdvancedFeatures`. Lorsque `enableMonitoring=false`, une implémentation no-op est utilisée sans impact sur les performances.

| Métrique | Dimension | Source |
|----------|-----------|--------|
| VisionApiInvocations / Timeouts / Fallbacks / Latency | Operation=vision | Lors de l'invocation de l'API Vision |
| SmartRoutingSimple / Complex / AutoSelect / ManualOverride | Operation=routing | Lors de la sélection du Smart Router |
| KbAssociateInvocations / KbDisassociateInvocations / KbMgmtErrors | Operation=kb-mgmt | Lors de l'invocation de l'API de gestion des connexions KB |

### Coût

| Ressource | Coût mensuel |
|-----------|-------------|
| CloudWatch Dashboard | $3.00 |
| CloudWatch Alarms (7) | $0.70 |
| SNS Email Notifications | Dans le niveau gratuit |
| EventBridge Rule | Dans le niveau gratuit |
| **Total** | **Environ $4/mois** |

### Stack CDK

Implémenté en tant que `MonitoringConstruct` dans `DemoWebAppStack`. Les ressources sont créées uniquement lorsque `enableMonitoring=true`.

```bash
# Déployer avec le monitoring activé
npx cdk deploy --all --app "npx ts-node bin/demo-app.ts" \
  -c enableMonitoring=true \
  -c monitoringEmail=ops@example.com

# Activer également AgentCore Observability
npx cdk deploy --all --app "npx ts-node bin/demo-app.ts" \
  -c enableMonitoring=true \
  -c monitoringEmail=ops@example.com \
  -c enableAgentCoreObservability=true
```

---

## 13. AgentCore Memory — Maintien du contexte de conversation

### Détails d'implémentation

Une fonctionnalité optionnelle activée avec `enableAgentCoreMemory=true` qui fournit une mémoire à court terme (historique de conversation en session) et une mémoire à long terme (préférences utilisateur inter-sessions, résumés et connaissances sémantiques) via Bedrock AgentCore Memory.

### Architecture

```
AIStack (CfnMemory)
├── Event Store (mémoire à court terme : historique de conversation en session, TTL 3 jours)
├── Semantic Strategy (mémoire à long terme : extraction automatique de faits/connaissances des conversations)
└── Summary Strategy (mémoire à long terme : génération automatique de résumés de conversation de session)

Next.js API Routes
├── POST/GET/DELETE /api/agentcore/memory/session — Gestion des sessions
├── POST/GET /api/agentcore/memory/event — Enregistrement/récupération d'événements
└── POST /api/agentcore/memory/search — Recherche sémantique

Flux d'authentification
├── lib/agentcore/auth.ts — Validation JWT par Cookie (pas d'accès DynamoDB)
└── actorId = userId (@ → _at_, . → _dot_ remplacement)
```

### Ressources CDK

| Ressource | Description |
|-----------|-------------|
| `CfnMemory` | Ressource AgentCore Memory (créée uniquement lorsque `enableAgent=true` ET `enableAgentCoreMemory=true`) |
| Rôle IAM Memory | Service principal `bedrock-agentcore.amazonaws.com` |
| Politique IAM Lambda | `bedrock-agentcore:CreateEvent/ListEvents/DeleteEvent/ListSessions/RetrieveMemoryRecords` (ajoutée uniquement lorsque memoryId est défini) |

### Fonctionnalités clés

- Conservation automatique de l'historique de conversation en session (mémoire à court terme, TTL 3 jours, valeur minimale)
- Extraction automatique des préférences et connaissances utilisateur inter-sessions (stratégie sémantique)
- Génération automatique de résumés de conversation de session (stratégie de résumé)
- Affichage de la liste des sessions et de la section mémoire dans la barre latérale
- Maintien du contexte de conversation en mode KB et en mode Agent
- Support i18n 8 langues (`agentcore.memory.*`, `agentcore.session.*`)

### Notes de déploiement

| Élément | Contrainte | Résolution |
|---------|-----------|------------|
| Memory Name | `^[a-zA-Z][a-zA-Z0-9_]{0,47}` (tirets non autorisés) | `prefix.replace(/-/g, '_')` pour la conversion |
| EventExpiryDuration | Jours (min : 3, max : 365) | 3 jours (valeur minimale) |
| Service Principal | `bedrock-agentcore.amazonaws.com` | Pas `bedrock.amazonaws.com` |
| Format des Tags | Map `{ key: value }` | Remplacer le format tableau par défaut de CDK avec `addPropertyOverride` |
| actorId | `[a-zA-Z0-9][a-zA-Z0-9-_/]*` | Remplacer `@` et `.` dans les adresses e-mail |

### Paramètres de contexte CDK

| Paramètre | Défaut | Description |
|-----------|--------|-------------|
| `enableAgentCoreMemory` | `false` | Activer AgentCore Memory (nécessite `enableAgent=true` comme prérequis) |

### Variables d'environnement

| Variable | Description |
|----------|-------------|
| `AGENTCORE_MEMORY_ID` | AgentCore Memory ID (sortie CDK) |
| `ENABLE_AGENTCORE_MEMORY` | Indicateur d'activation de la fonctionnalité Memory |

