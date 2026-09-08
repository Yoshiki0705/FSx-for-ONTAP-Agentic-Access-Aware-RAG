# Agentic Access-Aware RAG with Amazon FSx for NetApp ONTAP

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)

**🌐 Language / 言語:** [日本語](README.md) | [English](README.en.md) | [한국어](README.ko.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | **Français** | [Deutsch](README.de.md) | [Español](README.es.md)

> Implémentation de référence fournissant un RAG Permission-aware + IA Agentique sur les données d'entreprise stockées dans FSx for ONTAP, qui confronte les métadonnées de permission de chaque document au SID / UID-GID de l'appelant au moment de la requête (Fail-Closed). Déploiement AWS CDK en une commande. Du PoC à l'évaluation de production.

---

## Commencer

| Je veux... | Guide | Durée |
|------------|-------|-------|
| Essayer rapidement | [Guide atelier PoC](docs/fr/poc-workshop-guide.md) | 90 min |
| Déployer sur mon compte | [Guide de déploiement](docs/deployment-guide.md) | 30-40 min |
| Valider avec des données réelles | [Guide d'expérimentation sûre](docs/fr/safe-experimentation-guide.md) | 2-4 sem. |
| Évaluer la précision et le coût | [Framework d'évaluation RAG/Agent](docs/fr/evaluation.md) | 1 sem. |
| Évaluer la maturité production | [Checklist de production](docs/fr/production-readiness-checklist.md) | — |
| Estimer les coûts | [Feuille d'estimation des coûts](docs/fr/cost-estimation-worksheet.md) | — |

## À décider avant d'arriver ici / Ce que ce dépôt ne couvre pas

Ce dépôt porte l'**implémentation et les mesures**. Les **décisions** — FSx for ONTAP convient-il, faut-il exposer les données via un S3 Access Point, quelle couche porte les permissions — se trouvent dans le [FSx for ONTAP Adoption Playbook](https://github.com/Yoshiki0705/FSx-for-ONTAP-Adoption-Playbook).

| À décider d'abord | Où se trouve la base |
|-------------------|----------------------|
| Si FSx for ONTAP convient au problème (y compris les cas où il ne convient pas) | [Arbres de décision](https://github.com/Yoshiki0705/FSx-for-ONTAP-Adoption-Playbook/tree/main/docs/en/reference/decision-trees) |
| Prérequis et contraintes de l'exposition via S3 Access Point (même compte, même Région, et le fait que toute requête est autorisée sous une seule identité) | [domaine data-utilization](https://github.com/Yoshiki0705/FSx-for-ONTAP-Adoption-Playbook/tree/main/docs/en/domains/data-utilization) |
| À quelle couche l'autorisation est établie et ce que conserve la piste d'audit | [domaine security-governance](https://github.com/Yoshiki0705/FSx-for-ONTAP-Adoption-Playbook/tree/main/docs/en/domains/security-governance) |
| Coexistence NFS / SMB et conception des identités Active Directory | [domaine multiprotocol-identity](https://github.com/Yoshiki0705/FSx-for-ONTAP-Adoption-Playbook/tree/main/docs/en/domains/multiprotocol-identity) |

**Non couvert ici** : choix du stockage, méthode de migration, stockage bloc, conception des performances et des coûts. Tout cela est du côté du Playbook.

**Couvert ici** : une implémentation RAG qui conserve les métadonnées de permission par document dans un index et les confronte au SID / UID-GID de l'appelant au moment de la requête (Amazon Bedrock + AWS CDK), les procédures de déploiement et d'exploitation, et les mesures pour cette architecture. **Les ACL d'origine par fichier ne sont pas reportées sur l'autorisation de l'utilisateur final sur les chemins passant par un S3 Access Point ; les permissions sont donc maintenues comme un index distinct** ([Modèle de cohérence des métadonnées de permission](docs/fr/permission-consistency.md)).

<details><summary>📂 Liste complète des fonctionnalités et guides</summary>

| Catégorie | Guide | Contenu |
|-----------|-------|---------|
| Architecture | [Vue d'ensemble (22 aspects)](docs/fr/implementation-overview.md) | Détails techniques de tous les composants |
| Architecture | [Architecture Decision Records](docs/fr/architecture-decision-records.md) | Justification de 6 décisions clés |
| Permissions | [Architecture du filtrage SID](docs/fr/SID-Filtering-Architecture.md) | Mécanisme de correspondance des permissions |
| Auth | [Auth et gestion des utilisateurs](docs/fr/auth-and-user-management.md) | Intégration OIDC / SAML / LDAP |
| Sécurité | [Modèle de menaces](docs/fr/threat-model.md) | 10 catégories de menaces, chemins d'attaque |
| Sécurité | [Gouvernance et audit](docs/fr/governance-and-audit.md) | Logs d'audit, IA responsable, Guardrails |
| Démo | [Données démo par industrie (7)](demo-data/industry-packs/) | Administration, santé, juridique, industrie, construction, éducation, assurance |
| Tous les docs | [Index de documentation](docs/fr/DOCUMENTATION_INDEX.md) | Liste complète avec ordre de lecture recommandé |

</details>

---

## Architecture

```
Browser → WAF → CloudFront (OAC) → Lambda Web Adapter (Next.js 15)
                                         │
              ┌──────────────────────────┼──────────────────────────┐
              ▼                          ▼                          ▼
     Cognito User Pool          Bedrock KB + S3 Vectors      DynamoDB
     (Auth: OIDC/SAML/Email)    (Recherche RAG + Embedding)  (Données SID/perm)
                                         │
                                         ▼
                                FSx for ONTAP (SVM + Volume)
                                + S3 Access Point
```

**Flux**: Authentification → récupération SID depuis DynamoDB → recherche vectorielle Bedrock KB → filtrage par correspondance SID → génération de réponse à partir des documents autorisés uniquement

Caractéristiques principales :
- **RAG Permission-aware** — métadonnées de permission du document confrontées au SID / UID-GID de l'appelant à la requête (Fail-Closed)
- **IA Agentique** — Bascule entre mode KB (recherche documentaire) et mode Agent (raisonnement multi-étapes)
- **Smart Routing** — Sélection automatique Haiku / Sonnet / Opus selon la complexité (réduction 40-60% des coûts)
- **Faible coût** — S3 Vectors (quelques dollars/mois) par défaut
- **22 capacités intégrées** — Chat vocal, Guardrails, Graph RAG, Web Search, etc. ([détails](docs/fr/implementation-overview.md))

<details><summary>⚠️ Prérequis et contraintes</summary>

| Élément | Détails |
|---------|---------|
| Prérequis | Node.js 22+, Docker, AWS CLI configuré, droits AdministratorAccess |
| Régions | ap-northeast-1 (modifiable) + us-east-1 (WAF/Web Search, fixe) |
| Version ONTAP | 9.17.1+ (requis pour S3 Access Points) |
| Contraintes S3 AP | Pas d'écritures conditionnelles, pas d'Event Notifications, latence élevée ListObjectsV2 |
| Store vectoriel | S3 Vectors (défaut, limite 2KB filterable) / OpenSearch Serverless (haute perf.) |
| IA responsable | Les sorties IA sont des signaux d'aide. La décision finale est humaine. [Détails](docs/fr/governance-and-audit.md) |

</details>

<details><summary>📚 Dépôts associés</summary>

| Dépôt | Usage | Description |
|-------|-------|-------------|
| **[Ce dépôt]** | AI / RAG | RAG avec filtrage de permissions + IA Agentique |
| [FSx-for-ONTAP-S3AccessPoints-Serverless-Patterns](https://github.com/Yoshiki0705/FSx-for-ONTAP-S3AccessPoints-Serverless-Patterns) | Serverless | 17 patterns serverless par industrie |
| [fsxn-lakehouse-integrations](https://github.com/Yoshiki0705/fsxn-lakehouse-integrations) | Analytics | Intégration Athena / Glue / EMR / SageMaker |
| [fsxn-observability-integrations](https://github.com/Yoshiki0705/fsxn-observability-integrations) | Observabilité | Livraison de logs d'audit vers Datadog / Splunk / Grafana sans EC2 |
| [FSx-for-ONTAP-Adoption-Playbook — data-utilization](https://github.com/Yoshiki0705/FSx-for-ONTAP-Adoption-Playbook/tree/main/docs/en/domains/data-utilization) | Décisions d'adoption | Hub du domaine data-utilization : comportement d'autorisation du S3 AP, contraintes et options de conception |

</details>

<details><summary>🔧 Développeurs</summary>

```bash
npx tsc --noEmit
npx cdk synth --quiet
npx jest --no-coverage
cd docker/nextjs && npx vitest run
```

Structure du projet et conventions : [CONTRIBUTING.md](CONTRIBUTING.md). Journal des modifications : [CHANGELOG.md](CHANGELOG.md).

</details>

---

## License

[Apache License 2.0](LICENSE)

---

🌐 [日本語](README.md) | [English](README.en.md) | [한국어](README.ko.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [Deutsch](README.de.md) | [Español](README.es.md)
