# Agentic Access-Aware RAG with Amazon FSx for NetApp ONTAP

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)

**🌐 Language / 言語:** [日本語](README.md) | [English](README.en.md) | [한국어](README.ko.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | **Français** | [Deutsch](README.de.md) | [Español](README.es.md)

> Implémentation de référence fournissant un RAG Permission-aware + IA Agentique sur les données d'entreprise stockées dans FSx for ONTAP, avec application automatique des ACL NTFS / permissions UNIX au moment de la requête. Déploiement AWS CDK en une commande. Du PoC à l'évaluation de production.

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
- **RAG Permission-aware** — ACL NTFS / permissions UNIX appliquées automatiquement (Fail-Closed)
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
