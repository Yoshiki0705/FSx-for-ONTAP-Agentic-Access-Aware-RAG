# Index de la documentation

**🌐 Language:** [日本語](../DOCUMENTATION_INDEX.md) | [English](../en/DOCUMENTATION_INDEX.md) | [한국어](../ko/DOCUMENTATION_INDEX.md) | [简体中文](../zh-CN/DOCUMENTATION_INDEX.md) | [繁體中文](../zh-TW/DOCUMENTATION_INDEX.md) | **Français** | [Deutsch](../de/DOCUMENTATION_INDEX.md) | [Español](../es/DOCUMENTATION_INDEX.md)

## Lectures essentielles

| Document | Description |
|----------|-------------|
| [README.md](../../README.fr.md) | Vue d'ensemble du système, architecture, étapes de déploiement, paramètres WAF/Geo |
| [auth-and-user-management.md](auth-and-user-management.md) | Guide d'authentification et de gestion des utilisateurs (sélection du mode d'authentification, AD Federation, enregistrement automatique SID, dépannage) |
| [implementation-overview.md](implementation-overview.md) | Implémentation détaillée (22 aspects : analyse d'images RAG, UI de connexion KB, Smart Routing, surveillance et alertes, OIDC/LDAP Federation) |
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
| [auth-mode-setup-guide.md](../../demo-data/guides/auth-mode-setup-guide.md) | Guide de configuration de l'environnement de démonstration par mode d'authentification (5 modes, avec fichiers de configuration exemples) |
| [demo-scenario.md](../../demo-data/guides/demo-scenario.md) | Scénarios de vérification (différences de permissions admin vs. utilisateur standard, connexion AD SSO, connexion OIDC/LDAP) |
| [ontap-setup-guide.md](../../demo-data/guides/ontap-setup-guide.md) | Intégration FSx for ONTAP + AD, partage CIFS, configuration NTFS ACL, configuration Name-Mapping (procédures vérifiées) |
| [demo-environment-guide.md](demo-environment-guide.md) | ID des ressources de l'environnement de vérification, informations d'accès, procédures du serveur Embedding |

## Guide de conception et d'exploitation entreprise

| Document | Description |
|----------|-------------|
| [production-readiness-checklist.md](production-readiness-checklist.md) | Liste de contrôle de mise en production (définitions des niveaux de maturité Demo → PoC → Production, éléments de vérification sécurité/audit/DR/exploitation, avec colonne approbateur) |
| [poc-success-criteria-template.md](poc-success-criteria-template.md) | Modèle de critères de succès PoC (définitions des parties prenantes, critères Go/No-Go, conditions de phase suivante, modèle de rapport de clôture) |
| [data-readiness-assessment.md](data-readiness-assessment.md) | Modèle d'évaluation de la préparation des données (emplacement/classification/structure des permissions/qualité/conformité des données, flux d'approbation) |
| [partner-faq.md](partner-faq.md) | FAQ partenaire (12 questions et réponses pour les propositions clients, liste des ressources de proposition) |
| [permission-consistency.md](permission-consistency.md) | Modèle de cohérence des changements de permissions (changement ACL → régénération des métadonnées → re-synchronisation KB → invalidation du cache, latence maximale, procédures de révocation d'urgence) |
| [fsxn-sizing-and-performance.md](fsxn-sizing-and-performance.md) | Guide de dimensionnement et de performance FSx for ONTAP (configurations par échelle, considérations S3 AP, QoS, sélection du magasin de vecteurs) |
| [partner-deployment-patterns.md](partner-deployment-patterns.md) | Modèles de déploiement multi-tenant et partenaires (isolation de compte/isolation SVM/hybride, modèles d'estimation des coûts) |
| [governance-and-audit.md](governance-and-audit.md) | Conception de la gouvernance et de l'audit (schéma de journal d'audit, IA responsable, politiques Guardrails, cas d'utilisation par secteur) |
| [evaluation.md](evaluation.md) | Métriques d'évaluation RAG / Agent (évaluation sur 4 axes : KPI métier, qualité RAG, contrôle des permissions, performance Agent ; modèle d'évaluation PoC) |
| [safe-experimentation-guide.md](safe-experimentation-guide.md) | Guide d'expérimentation sécurisée (définition du périmètre, actions interdites, liste de contrôle d'ingestion de données réelles, procédures de rollback) |
| [threat-model.md](threat-model.md) | Modèle de menaces (10 catégories de menaces, chemins d'attaque, mesures d'atténuation existantes, recommandations supplémentaires, tableau de correspondance menaces→contre-mesures) |
| [cloudwatch-dashboard-guide.md](cloudwatch-dashboard-guide.md) | Guide d'exploitation du tableau de bord CloudWatch (liste des métriques, définitions d'alarmes, modèles de dépannage) |
| [poc-workshop-guide.md](poc-workshop-guide.md) | Guide d'atelier PoC (90 minutes : déploiement → test → évaluation → nettoyage) |
| [cost-estimation-worksheet.md](cost-estimation-worksheet.md) | Feuille d'estimation des coûts (modèles de coûts mensuels par configuration, formules, points d'optimisation) |
| [architecture-decision-records.md](architecture-decision-records.md) | Architecture Decision Records (6 décisions clés : magasin de vecteurs, filtre de permissions, authentification, frontend, synchronisation, routage) |
| [managed-kb-migration-evaluation.md](managed-kb-migration-evaluation.md) | Évaluation du chemin de migration Amazon Bedrock Managed Knowledge Base (comparaison avec le KB existant + OpenSearch Serverless / S3 Vectors, impact sur le Permission-aware RAG, points de vérification du filtre de métadonnées ACL, migration progressive). AWS Summit NY 2026 |
| [managed-kb-upgrade-path.md](managed-kb-upgrade-path.md) | Chemin de mise à niveau Managed KB (étapes de validation de connexion de la source de données S3 AP V1–V4, défis de conception Permission-aware, modèle de validation sûre avec FlexClone, guide de choix selon l'usage). Option parallèle / procédure de validation |
| [investigations/agentcore-web-search-integration.md](investigations/agentcore-web-search-integration.md) | Étude de conception pour l'intégration de l'AgentCore Web Search Tool comme option de recherche hybride dans le Permission-aware RAG (bascule UI, Gateway inter-région us-east-1, Lambda Layer/inline, sécurité des requêtes / séparation des citations / défense contre l'injection de prompt, ordre d'implémentation). AWS Summit NY 2026 |
| [monitoring/athena-audit-tables.sql](../../monitoring/athena-audit-tables.sql) | Définitions de tables Athena (DDL pour l'analyse des journaux d'audit + requêtes exemples) |
| [benchmark-scenarios.md](benchmark-scenarios.md) | Scénarios de benchmark (10K/100K/1M fichiers, 5 scénarios de mesure, estimations de référence théoriques) |
| [demo-data/industry-packs/](../../demo-data/industry-packs/) | Packs de données de démonstration par secteur (8 secteurs × 5 documents : secteur public, santé, juridique, fabrication, construction, éducation, assurance + générique) |
| [s3ap-serverless-patterns-integration.md](s3ap-serverless-patterns-integration.md) | Architecture d'intégration S3AP Serverless Patterns (intégration en 3 modèles avec 17 UC) |
| [benchmarks/](../../benchmarks/) | Framework de benchmark (génération de données de test, scripts d'exécution, modèles de résultats) |
| [tests/permission-matrix/](../../tests/permission-matrix/) | Tests de matrice de permissions (31 scénarios de cas limites ACL : Fail-Closed, imbrication de groupes, permissions héritées, révocation d'urgence) |

## Automatisation des opérations FSx for ONTAP

| Document | Description |
|----------|-------------|
| [automation/fsxn-ops/README.md](../../automation/fsxn-ops/README.md) | Vue d'ensemble de la suite d'automatisation (structure des répertoires, cas d'utilisation) |
| [automation/fsxn-ops/docs/why-this-makes-fsxn-easier.md](../../automation/fsxn-ops/docs/why-this-makes-fsxn-easier.md) | Pourquoi cette architecture simplifie les opérations FSx for ONTAP (décisions de conception, estimations de coûts, conception de la sécurité) |
| [automation/fsxn-ops/docs/aws-verification-report.md](../../automation/fsxn-ops/docs/aws-verification-report.md) | Rapport de vérification d'intégration AWS (2026-05-01, toutes les phases RÉUSSIES) |
| [automation/fsxn-ops/cfn/fsxn-ops-stack.yaml](../../automation/fsxn-ops/cfn/fsxn-ops-stack.yaml) | Modèle CloudFormation intégré (incluant les points de terminaison VPC) |

## Ingestion Transfer Family

| Document | Description |
|----------|-------------|
| [transfer-family-e2e-verification.md](transfer-family-e2e-verification.md) | Rapport de vérification E2E (connexion SFTP → téléversement → ingestion KB terminée, toutes les étapes RÉUSSIES) |
| [transfer-family-partner-onboarding.md](transfer-family-partner-onboarding.md) | Guide d'intégration des partenaires (configuration des clés SSH, connexion SFTP, conventions de nommage des fichiers, dépannage) |
| [transfer-family-networking-prerequisites.md](transfer-family-networking-prerequisites.md) | Prérequis réseau (points de terminaison VPC, liste d'autorisation IP, groupes de sécurité) |
| [v4.2-demo-verification-supplement.md](v4.2-demo-verification-supplement.md) | Supplément de vérification de démonstration v4.2 (procédures de test pour tous les cas d'utilisation, résultats attendus, méthodes de récupération des journaux) |

## Fichiers de configuration exemples

| Fichier | Mode d'authentification | Description |
|---------|------------------------|-------------|
| `demo-data/configs/mode-a-email-password.json` | Email/Mot de passe | Configuration minimale, enregistrement SID manuel |
| `demo-data/configs/mode-b-saml-ad-federation.json` | SAML AD Federation | Managed AD + IAM Identity Center |
| `demo-data/configs/mode-c-oidc-ldap.json` | OIDC + LDAP | Auth0/Keycloak + OpenLDAP + ONTAP name-mapping |
| `demo-data/configs/mode-d-oidc-claims-only.json` | OIDC Claims Only | Okta/Auth0 (sans LDAP) |
| `demo-data/configs/mode-e-saml-oidc-hybrid.json` | SAML + OIDC | AD Federation + OIDC IdP activation simultanée |

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
| `demo-data/scripts/setup-openldap.sh` | Configuration du serveur OpenLDAP (EC2 dans VPC, utilisateurs/groupes de test) |
| `demo-data/scripts/setup-ontap-namemapping.sh` | Configuration des règles name-mapping via l'API REST ONTAP |
| `demo-data/scripts/verify-ldap-integration.sh` | Vérification de l'intégration LDAP (Lambda → LDAP → DynamoDB) |
| `demo-data/scripts/verify-ontap-namemapping.sh` | Vérification du name-mapping ONTAP (connexion API REST et récupération des règles) |
| `demo-data/scripts/setup-mode-c-oidc-ldap.sh` | Configuration one-shot Mode C (OIDC+LDAP) (toutes les phases exécutées automatiquement) |

## Ordre de lecture recommandé

### Phase 1 : Configuration initiale

1. **README.md** — Vue d'ensemble du système et étapes de déploiement
2. **auth-and-user-management.md** — Sélection du mode d'authentification et gestion des utilisateurs
3. **implementation-overview.md** — Implémentation détaillée sur 22 aspects
4. **SID-Filtering-Architecture.md** — Détails techniques de la fonctionnalité principale
5. **safe-experimentation-guide.md** — Guide d'expérimentation sécurisée (lecture obligatoire avant le PoC)

### Phase 2 : Vérification et évaluation

6. **demo-recording-guide.md** — Guide d'enregistrement de vidéo de démonstration
7. **ontap-setup-guide.md** — Intégration FSx for ONTAP AD, configuration du partage CIFS
8. **demo-environment-guide.md** — Configuration de l'environnement de vérification
9. **demo-scenario.md** — Exécuter les scénarios de vérification
10. **evaluation.md** — Modèle d'évaluation PoC

### Phase 3 : Production et conception entreprise

11. **production-readiness-checklist.md** — Liste de contrôle de mise en production
12. **permission-consistency.md** — Modèle de cohérence des changements de permissions
13. **fsxn-sizing-and-performance.md** — Dimensionnement et performance FSx for ONTAP
14. **governance-and-audit.md** — Conception de la gouvernance et de l'audit
15. **partner-deployment-patterns.md** — Modèles de déploiement multi-tenant
