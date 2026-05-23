# Architecture Decision Records (ADR) — Registres de décisions d'architecture

**🌐 Language:** [日本語](../architecture-decision-records.md) | [English](../en/architecture-decision-records.md) | [한국어](../ko/architecture-decision-records.md) | [简体中文](../zh-CN/architecture-decision-records.md) | [繁體中文](../zh-TW/architecture-decision-records.md) | **Français** | [Deutsch](../de/architecture-decision-records.md) | [Español](../es/architecture-decision-records.md)

**Date de création** : 2026-05-23  
**Statut** : Approuvé  
**Public cible** : Architectes, responsables techniques, toute personne souhaitant comprendre les raisons des décisions

---

## Vue d'ensemble

Ce document enregistre les décisions architecturales clés et leurs justifications pour le système Permission-aware Agentic RAG. Il explique « pourquoi cette configuration a été choisie » et sert de référence pour les futures décisions de modification.

---

## ADR-001 : Stockage vectoriel — S3 Vectors par défaut

| Élément | Détails |
|---------|---------|
| **Statut** | Approuvé |
| **Date** | 2026-03-29 |
| **Contexte** | Choix entre S3 Vectors et OpenSearch Serverless comme stockage vectoriel par défaut pour la recherche RAG |

### Options considérées

| Option | Avantages | Inconvénients |
|--------|-----------|---------------|
| S3 Vectors (adopté) | Quelques dollars/mois, zéro opération, export AOSS en un clic | Requête à froid : sub-seconde, non adapté au QPS élevé |
| OpenSearch Serverless | 50ms constant, QPS élevé, recherche plein texte | Minimum $700/mois (2 OCU), gestion OCU nécessaire |

### Décision

**S3 Vectors par défaut**, avec possibilité de basculer vers OpenSearch Serverless via le paramètre `vectorStoreType`.

### Justification

1. Pour PoC / petite échelle, démarrage à quelques dollars/mois réduit la barrière d'adoption
2. L'accès via Bedrock KB est indépendant du stockage vectoriel, la logique de filtrage SID est partagée
3. Quand les exigences de performance augmentent, export en un clic vers AOSS depuis la console (~15 minutes)
4. Toutes les métadonnées S3 Vectors sont filtrables (aucune configuration supplémentaire)

### Impact

- Coût de déploiement par défaut considérablement réduit ($700/mois → $5/mois)
- Les environnements à QPS élevé nécessitent le basculement vers `vectorStoreType=opensearch`
- Attention à la limite de 2 Ko de métadonnées filtrables dans S3 Vectors (quand les métadonnées PDF sont volumineuses)

---

## ADR-002 : Filtrage des permissions — Correspondance SID côté application

| Élément | Détails |
|---------|---------|
| **Statut** | Approuvé |
| **Date** | 2026-01-15 |
| **Contexte** | À quelle couche implémenter le filtrage des permissions des résultats de recherche RAG |

### Options considérées

| Option | Avantages | Inconvénients |
|--------|-----------|---------------|
| Correspondance SID côté application (adopté) | Indépendant du stockage vectoriel, contournement LLM impossible, implémentation Fail-Closed facile | Filtre post-recherche, nombre récupéré > nombre affiché |
| Filtre metadata du stockage vectoriel | Filtre au moment de la recherche, efficace | Non contrôlable directement via Bedrock KB Retrieve API |
| Bedrock KB RetrieveAndGenerate | Un seul appel API | Métadonnées non retournées, filtrage SID impossible |

### Décision

Adopter une **approche en deux étapes : Bedrock KB Retrieve API + correspondance SID côté application + Converse API**.

### Justification

1. L'API RetrieveAndGenerate n'inclut pas `allowed_group_sids` dans les métadonnées de citation, rendant le filtrage SID impossible
2. Le filtrage côté application s'exécute en dehors du LLM, ne peut pas être contourné par Prompt Injection
3. Logique commune indépendante du type de stockage vectoriel (S3 Vectors / AOSS)
4. L'implémentation Fail-Closed (refus total en cas d'échec de récupération SID) est claire

### Impact

- Nécessité de définir un nombre de récupération plus élevé car le filtrage s'applique à tous les documents de l'API Retrieve
- La qualité des réponses peut se dégrader si peu de documents restent après filtrage
- Cache de permissions (DynamoDB, TTL 5 minutes) accélère les vérifications répétées

---

## ADR-003 : Authentification — Cognito + Fédération multi-IdP

| Élément | Détails |
|---------|---------|
| **Statut** | Approuvé |
| **Date** | 2026-02-01 |
| **Contexte** | Sélection de la méthode d'authentification utilisateur et de récupération SID/UID/GID |

### Options considérées

| Option | Avantages | Inconvénients |
|--------|-----------|---------------|
| Cognito + SAML/OIDC/LDAP (adopté) | 5 modes supportés, basculement par paramètre CDK, support Fail-Closed | Limitations Cognito (nombre d'attributs personnalisés, taille du jeton) |
| IAM Identity Center utilisation directe | SSO natif AWS | Intégration complexe avec l'application RAG |
| Authentification personnalisée (Lambda Authorizer) | Flexibilité totale | Coût d'implémentation et d'exploitation élevé |

### Décision

Utiliser **Cognito User Pool** comme hub, avec 5 modes commutables via paramètres CDK : SAML (AD Federation), OIDC (Auth0/Keycloak/Okta), LDAP (OpenLDAP/FreeIPA), et email/mot de passe.

### Justification

1. Cognito s'intègre facilement avec CloudFront + Lambda Function URL (IAM Auth)
2. Le Post-Authentication Trigger permet la récupération automatique SID/UID/GID et l'enregistrement DynamoDB
3. `authFailureMode=fail-closed` bloque la connexion en cas d'échec de récupération des permissions
4. Flexibilité pour sélectionner le mode selon l'IdP existant du client

### Impact

- Attention aux limitations Cognito (50 attributs personnalisés, taille de jeton 2 Ko)
- Gestion de l'URL de métadonnées SAML nécessaire (lors du renouvellement du certificat IdP)
- La requête LDAP directe nécessite un Lambda dans le VPC

---

## ADR-004 : Frontend — Lambda Web Adapter + Next.js 15

| Élément | Détails |
|---------|---------|
| **Statut** | Approuvé |
| **Date** | 2026-01-10 |
| **Contexte** | Sélection de la méthode d'hébergement de l'application web |

### Options considérées

| Option | Avantages | Inconvénients |
|--------|-----------|---------------|
| Lambda Web Adapter + Next.js (adopté) | Serverless, IAM Auth + OAC, démarrage à froid acceptable | Démarrage à froid 3-5 secondes, taille de l'image Docker |
| ECS Fargate | Toujours actif, faible latence | Minimum $30/mois (toujours actif), ALB nécessaire |
| Amplify Hosting | Géré, intégration CI/CD | IAM Auth non supporté, limitations de personnalisation |
| App Runner | Déploiement facile, auto-scaling | IAM Auth non supporté, limitations d'intégration VPC |

### Décision

Exécuter Next.js 15 en serverless avec **Lambda Web Adapter**, protégé par CloudFront OAC + IAM Auth.

### Justification

1. L'authentification IAM (Function URL + OAC) empêche complètement l'accès direct en dehors de CloudFront
2. Serverless signifie zéro coût pendant les périodes d'inactivité
3. Déploiement CDK en une commande (incluant la construction de l'image Docker)
4. Next.js 15 App Router + Server Components permettent SSR/ISR

### Impact

- Le démarrage à froid (3-5 secondes) se produit au premier accès. Atténuable avec Provisioned Concurrency
- Optimisation de la taille de l'image Docker nécessaire (construction multi-étapes)
- Apple Silicon (M1/M2/M3) nécessite le mode pré-construction (compatibilité Lambda x86_64)

---

## ADR-005 : Synchronisation des données — KB Auto-Sync (méthode par interrogation)

| Élément | Détails |
|---------|---------|
| **Statut** | Approuvé |
| **Date** | 2026-04-15 |
| **Contexte** | Méthode pour refléter les modifications de fichiers sur FSx for ONTAP dans Bedrock KB |

### Options considérées

| Option | Avantages | Inconvénients |
|--------|-----------|---------------|
| Interrogation EventBridge Scheduler (adopté) | Simple, pas d'événements FSx nécessaires, compatible S3 AP | Délai max 15 minutes, coût ListObjectsV2 |
| CloudTrail + EventBridge (événementiel) | Quasi temps réel | Support CloudTrail limité pour S3 AP |
| FSx Audit Log + EventBridge | Événements au niveau fichier | Configuration complexe, volume de logs élevé |
| Déclenchement manuel uniquement | Le plus simple | Charge opérationnelle, risque de synchronisations manquées |

### Décision

**Interrogation EventBridge Scheduler à intervalles de 5-15 minutes** par défaut, exécutant `StartIngestionJob` uniquement lorsque des modifications sont détectées.

### Justification

1. FSx for ONTAP S3 Access Point a un support limité des événements de données CloudTrail
2. ListObjectsV2 + comparaison d'inventaire DynamoDB détecte les modifications de manière fiable
3. La déduplication des jobs IN_PROGRESS empêche les synchronisations inutiles
4. 3 échecs consécutifs déclenchent CloudWatch Alarm → notification de l'équipe opérationnelle

### Impact

- Délai de synchronisation max 15 minutes (dépend de l'intervalle d'interrogation)
- Les environnements à grande échelle (100 000+ fichiers) doivent noter le temps d'exécution de ListObjectsV2
- Le chemin Transfer Family supporte également le mode événementiel CloudTrail

---

## ADR-006 : Smart Routing — Sélection automatique de modèle à 3 niveaux

| Élément | Détails |
|---------|---------|
| **Statut** | Approuvé |
| **Date** | 2026-05-01 |
| **Contexte** | Stratégie de sélection de modèle pour l'optimisation des coûts |

### Options considérées

| Option | Avantages | Inconvénients |
|--------|-----------|---------------|
| Routage automatique à 3 niveaux (adopté) | Réduction des coûts 60-80%, qualité maintenue | Dépend de la précision de classification, risque de mauvaise classification |
| Modèle unique fixe | Simple, prévisible | Coût inefficace ou qualité insuffisante |
| Sélection manuelle par l'utilisateur | Contrôle utilisateur | UX dégradée, gestion des coûts difficile |

### Décision

**Routage automatique à 3 niveaux** basé sur la complexité de la requête (Simple → Haiku, Complex → Sonnet, Full-context → Opus) par défaut, avec option de sélection manuelle également disponible.

### Justification

1. Dans le RAG d'entreprise, 60%+ des questions sont de simples vérifications factuelles (Haiku suffit)
2. Le coût moyen pondéré ~$0.014/query améliore la qualité tout en maintenant un coût similaire au tout-Sonnet (~$0.01)
3. Les métriques CloudWatch EMF visualisent la distribution du routage, permettant l'ajustement des seuils
4. Le mécanisme de repli (basculement automatique vers le niveau suivant quand le modèle est indisponible) assure la disponibilité

### Impact

- La précision du classificateur affecte directement le coût et la qualité (ajustement périodique des seuils recommandé)
- Attention aux pics de coûts lors de l'utilisation d'Opus (paramétrage d'un plafond de coût quotidien recommandé)
- Quand Smart Routing est désactivé, utilisation d'un modèle unique fixe comme auparavant

---

## Documents associés

| Document | ADR associé |
|----------|------------|
| [s3-vectors-sid-architecture-guide.md](../s3-vectors-sid-architecture-guide.md) | ADR-001, ADR-002 |
| [SID-Filtering-Architecture.md](../SID-Filtering-Architecture.md) | ADR-002 |
| [auth-and-user-management.md](../auth-and-user-management.md) | ADR-003 |
| [stack-architecture-comparison.md](../stack-architecture-comparison.md) | ADR-001, ADR-004 |
| [permission-consistency.md](../permission-consistency.md) | ADR-005 |
| [evaluation.md](../evaluation.md) | ADR-006 |
