# Index de la documentation

**🌐 Language:** [日本語](../DOCUMENTATION_INDEX.md) | [English](../en/DOCUMENTATION_INDEX.md) | [한국어](../ko/DOCUMENTATION_INDEX.md) | [简体中文](../zh-CN/DOCUMENTATION_INDEX.md) | [繁體中文](../zh-TW/DOCUMENTATION_INDEX.md) | **Français** | [Deutsch](../de/DOCUMENTATION_INDEX.md) | [Español](../es/DOCUMENTATION_INDEX.md)

## Lectures essentielles

| Document | Description |
|----------|-------------|
| [README.md](../../README.fr.md) | Vue d'ensemble du système, architecture, étapes de déploiement, paramètres WAF/Geo |
| [implementation-overview.md](implementation-overview.md) | Implémentation détaillée (12 aspects : analyse d'images RAG, UI de connexion KB, Smart Routing, surveillance et alertes) |
| [SID-Filtering-Architecture.md](SID-Filtering-Architecture.md) | Conception détaillée du filtrage des permissions basé sur SID |
| [verification-report.md](verification-report.md) | Procédures de vérification post-déploiement et cas de test |
| [ui-specification.md](ui-specification.md) | Spécification de l'UI Chatbot (mode KB/Agent, Agent Directory, fonctionnalités Agent entreprise, conception de la barre latérale) |
| [demo-recording-guide.md](demo-recording-guide.md) | Guide d'enregistrement de vidéo de démonstration (6 éléments de preuve) |
| [embedding-server-design.md](embedding-server-design.md) | Document de conception et d'implémentation du serveur Embedding |
| [stack-architecture-comparison.md](stack-architecture-comparison.md) | Guide d'architecture des piles CDK (comparaison des magasins de vecteurs, perspectives d'implémentation) |
| [README - AD SAML Federation](../../README.fr.md#ad-saml-federation-optional) | Configuration AD SAML federation (Managed AD / Self-managed AD) |

## Configuration et vérification

| Document | Description |
|----------|-------------|
| [demo-scenario.md](../../demo-data/guides/demo-scenario.md) | Scénarios de vérification (différences de permissions admin vs. utilisateur standard, connexion AD SSO) |
| [ontap-setup-guide.md](../../demo-data/guides/ontap-setup-guide.md) | Intégration FSx ONTAP + AD, partage CIFS, configuration NTFS ACL (procédures vérifiées) |
| [demo-environment-guide.md](demo-environment-guide.md) | ID des ressources de l'environnement de vérification, informations d'accès, procédures du serveur Embedding |

## Serveur Embedding (via montage FlexCache CIFS)

| Document / Fichier | Description |
|---------------------|-------------|
| [demo-environment-guide.md#6](demo-environment-guide.md) | Procédures de déploiement et d'exploitation du serveur Embedding |
| `docker/embed/src/index.ts` | Application Embedding (scan de documents → découpage en chunks → vectorisation → indexation) |
| `docker/embed/src/oss-client.ts` | Client de signature SigV4 OpenSearch Serverless (support d'authentification IMDS) |
| `docker/embed/Dockerfile` | Définition du conteneur Embedding (node:22-slim, cifs-utils) |
| `docker/embed/buildspec.yml` | Définition de build CodeBuild |
| `lib/stacks/demo/demo-embedding-stack.ts` | Définition CDK EmbeddingStack (EC2 + ECR + IAM) |

## Scripts de configuration

| Script | Description |
|--------|-------------|
| `demo-data/scripts/create-demo-users.sh` | Créer des utilisateurs de test Cognito |
| `demo-data/scripts/setup-user-access.sh` | Enregistrer les données SID dans DynamoDB |
| `demo-data/scripts/upload-demo-data.sh` | Téléverser les documents de test vers S3 |
| `demo-data/scripts/sync-kb-datasource.sh` | Synchroniser la source de données Bedrock KB |

## Ordre de lecture recommandé

1. **README.md** — Vue d'ensemble du système et étapes de déploiement
2. **implementation-overview.md** — Implémentation détaillée sur 8 aspects
3. **SID-Filtering-Architecture.md** — Détails techniques de la fonctionnalité principale
4. **demo-recording-guide.md** — Guide d'enregistrement de vidéo de démonstration
5. **ontap-setup-guide.md** — Intégration FSx ONTAP AD, configuration du partage CIFS
6. **README.md - AD SAML Federation** — Configuration AD SAML federation (optionnel)
7. **demo-environment-guide.md** — Configuration de l'environnement de vérification (incluant le serveur Embedding)
8. **demo-scenario.md** — Exécuter les scénarios de vérification (connexion AD SSO)
9. **verification-report.md** — Procédures de vérification au niveau API
