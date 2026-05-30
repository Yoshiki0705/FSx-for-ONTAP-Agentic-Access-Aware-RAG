# Modèle de menaces — Access-Aware Agentic RAG

**🌐 Language:** [日本語](../threat-model.md) | [English](../en/threat-model.md) | [한국어](../ko/threat-model.md) | [简体中文](../zh-CN/threat-model.md) | [繁體中文](../zh-TW/threat-model.md) | **Français** | [Deutsch](../de/threat-model.md) | [Español](../es/threat-model.md)

**Date de création** : 2026-05-21  
**Statut** : Brouillon  
**Public cible** : Architectes sécurité, responsables de la modélisation des menaces, RSSI

---

## Vue d'ensemble

Ce document est un modèle de menaces qui organise les principales menaces, vecteurs d'attaque, impacts, mesures d'atténuation existantes et contre-mesures supplémentaires recommandées pour le système Permission-aware Agentic RAG.

---

## Limites du système et limites de confiance

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Limite de confiance 1 : Internet → CloudFront                            │
│  Attaquants : Utilisateurs externes, bots, scripts                       │
├─────────────────────────────────────────────────────────────────────────┤
│ Limite de confiance 2 : CloudFront → Lambda (WebApp)                     │
│  Attaquants : Utilisateurs authentifiés mais non autorisés               │
├─────────────────────────────────────────────────────────────────────────┤
│ Limite de confiance 3 : Lambda → Bedrock / DynamoDB / FSx                │
│  Attaquants : Menaces internes, erreurs de configuration, chaîne         │
│               d'approvisionnement                                        │
├─────────────────────────────────────────────────────────────────────────┤
│ Limite de confiance 4 : FSx for ONTAP → S3 Access Point → Bedrock KB         │
│  Attaquants : Élévation de privilèges, falsification de métadonnées      │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Catalogue des menaces

### T1: Prompt Injection

| Élément | Détails |
|---------|---------|
| **Menace** | Des prompts malveillants provoquent l'ignorance du prompt système, le contournement des vérifications de permissions et la divulgation involontaire d'informations |
| **Vecteur d'attaque** | Entrée utilisateur → Converse API / Agent |
| **Impact** | Élevé — Fuite du contenu de documents hors périmètre d'autorisation, altération du comportement système |
| **Mesures d'atténuation existantes** | Bedrock Guardrails (filtre de contenu), le filtrage SID est effectué côté application (impossible à contourner par le LLM) |
| **Recommandations supplémentaires** | Activation du filtre Prompt Attack des Guardrails, limitation de la longueur d'entrée, ajout d'une couche de validation de sortie |
| **Risque résiduel** | Le Prompt Injection indirect (instructions intégrées dans les documents) ne peut pas être entièrement prévenu |

**Important** : Dans ce système, le filtrage SID est exécuté en dehors du LLM (couche applicative), ce qui rend impossible le contournement de la vérification des permissions par Prompt Injection. Cependant, le risque de divulgation involontaire d'informations contenues dans les documents autorisés subsiste.

---

### T2: Retrieval Poisoning

| Élément | Détails |
|---------|---------|
| **Menace** | Placement de documents malveillants dans le volume FSx pour contaminer les résultats de recherche RAG |
| **Vecteur d'attaque** | Accès CIFS/SMB → Volume FSx → S3 AP → Bedrock KB |
| **Impact** | Moyen à Élevé — Génération de désinformation, redirection vers du phishing, Prompt Injection indirect |
| **Mesures d'atténuation existantes** | Restriction d'écriture par NTFS ACL, restriction des rôles IAM de Transfer Family, `.metadata.json` générable uniquement par le rôle de service |
| **Recommandations supplémentaires** | Analyse antimalware lors de l'injection de documents, pipeline de validation de contenu, détection d'anomalies (alerte en cas d'augmentation soudaine de documents) |
| **Risque résiduel** | Contamination intentionnelle par un utilisateur interne disposant de droits d'écriture légitimes |

---

### T3: Cross-User Data Leakage

| Élément | Détails |
|---------|---------|
| **Menace** | Les résultats de recherche de l'utilisateur A contiennent des documents accessibles uniquement à l'utilisateur B |
| **Vecteur d'attaque** | Bug d'implémentation du filtrage SID, contamination du cache, confusion de session |
| **Impact** | Élevé — Fuite d'informations confidentielles, violation de conformité |
| **Mesures d'atténuation existantes** | Correspondance SID (intersection d'ensembles), principe Fail-Closed, tests de matrice de permissions (31 scénarios) |
| **Recommandations supplémentaires** | Exécution automatique régulière des tests de matrice de permissions, détection d'anomalies (schémas d'accès à des documents inhabituels) |
| **Risque résiduel** | Faible — Le filtrage SID étant exécuté en dehors du LLM, le contournement est difficile sauf en cas de bug d'implémentation |

---

### T4: Stale ACL / Permission Drift

| Élément | Détails |
|---------|---------|
| **Menace** | Les ACL de fichiers ont été modifiées mais les métadonnées du magasin vectoriel ou le cache de permissions conservent les anciennes autorisations |
| **Vecteur d'attaque** | Modification ACL → Métadonnées non mises à jour → Recherche possible avec les anciennes permissions |
| **Impact** | Moyen — Accès possible pendant une certaine période après la révocation des permissions (maximum 35 minutes) |
| **Mesures d'atténuation existantes** | KB Auto-Sync (intervalle de 15 minutes), TTL du cache de permissions (5 minutes), procédure de révocation d'urgence |
| **Recommandations supplémentaires** | Détection immédiate des événements de modification ACL (FSx Audit Log → EventBridge), réduction du TTL du cache, journal d'audit des modifications de permissions |
| **Risque résiduel** | Le modèle Eventually Consistent rend impossible la réplication en temps réel parfait. En cas d'urgence, la révocation manuelle est utilisée |

**Détails** : Voir [permission-consistency.md](permission-consistency.md)

---

### T5: Over-Permissive Cache

| Élément | Détails |
|---------|---------|
| **Menace** | Le cache de permissions se fige dans un état excessivement permissif, continuant à autoriser des accès qui devraient être refusés |
| **Vecteur d'attaque** | Condition de concurrence lors de l'écriture du cache, erreur de configuration TTL, collision de clés de cache |
| **Impact** | Élevé — Accès continu à des documents hors périmètre d'autorisation |
| **Mesures d'atténuation existantes** | Expiration automatique par DynamoDB TTL (5 minutes), clé de cache incluant l'ID utilisateur + l'ID document |
| **Recommandations supplémentaires** | Surveillance du taux de succès du cache, alerte en cas de taux anormalement élevé, purge complète périodique du cache (quotidienne) |
| **Risque résiduel** | Faible — Le TTL étant court, même en cas de contamination, la récupération automatique se fait en 5 minutes |

---

### T6: Agent Tool Abuse

| Élément | Détails |
|---------|---------|
| **Menace** | L'Agent appelle des outils non prévus, effectuant des modifications, suppressions ou envois externes de données |
| **Vecteur d'attaque** | Prompt Injection → Altération du plan d'action de l'Agent → Appel d'outils dangereux |
| **Impact** | Élevé — Destruction de données, fuite d'informations, explosion des coûts |
| **Mesures d'atténuation existantes** | AgentCore Policy (restriction d'accès aux outils), privilèges minimaux du rôle IAM des Action Groups, seuls les outils en lecture seule sont fournis par défaut |
| **Recommandations supplémentaires** | Human Approval (approbation avant exécution d'actions externes), limitation du nombre d'appels d'outils, plafond de coûts |
| **Risque résiduel** | Moyen — Compromis entre autonomie et sécurité de l'Agent. Le risque est faible si limité à la lecture seule |

---

### T7: Audit Log Tampering

| Élément | Détails |
|---------|---------|
| **Menace** | Falsification ou suppression des journaux d'audit pour dissimuler les traces d'accès non autorisé |
| **Vecteur d'attaque** | Élévation de privilèges du rôle d'exécution Lambda → Falsification de CloudWatch Logs / S3 |
| **Impact** | Élevé — Impossibilité d'investigation d'incident, violation de conformité |
| **Mesures d'atténuation existantes** | Politique de rétention CloudWatch Logs, privilèges minimaux IAM |
| **Recommandations supplémentaires** | S3 Object Lock (WORM), sauvegarde des journaux CloudTrail dans un compte séparé, vérification d'intégrité des journaux (CloudTrail Digest) |
| **Risque résiduel** | Faible — Avec S3 Object Lock + stockage dans un compte séparé, la falsification est pratiquement impossible |

**Détails** : Voir [governance-and-audit.md](governance-and-audit.md)

---

### T8: Misconfigured Identity Federation

| Élément | Détails |
|---------|---------|
| **Menace** | Une erreur de configuration OIDC / SAML / LDAP permet à des utilisateurs non autorisés de passer l'authentification, ou accorde des permissions excessives à des utilisateurs légitimes |
| **Vecteur d'attaque** | Erreur de configuration IdP → Émission de jetons non autorisés → Passage de l'authentification Cognito → Attribution excessive de SID |
| **Impact** | Élevé — Élévation de privilèges, accès à tous les documents |
| **Mesures d'atténuation existantes** | `authFailureMode=fail-closed` (blocage en cas d'échec d'obtention des permissions), validation des jetons Cognito, vérification de santé LDAP |
| **Recommandations supplémentaires** | Audit régulier de la configuration IdP, validation automatique des métadonnées de fédération, alerte en cas de nombre anormal de SID de groupe |
| **Risque résiduel** | Moyen — La configuration côté IdP est hors du contrôle de ce système. L'impact est limité par le Fail-Closed |

---

### T9: Vector Metadata Leakage

| Élément | Détails |
|---------|---------|
| **Menace** | Les métadonnées du magasin vectoriel (informations SID, chemins de fichiers) sont exposées involontairement, divulguant des informations sur la structure organisationnelle et les droits d'accès |
| **Vecteur d'attaque** | Accès direct à S3 Vectors / OpenSearch Serverless, retour excessif d'informations dans les réponses API |
| **Impact** | Moyen — Déduction de la structure organisationnelle, collecte d'informations pour des attaques ciblées |
| **Mesures d'atténuation existantes** | Restriction d'accès via VPC Endpoint, prévention de l'accès direct par politique IAM, exclusion des informations SID des réponses API (frontend) |
| **Recommandations supplémentaires** | Politique de bucket S3 Vectors avec privilèges minimaux, audit de la politique d'accès aux données OpenSearch Serverless, chiffrement des métadonnées |
| **Risque résiduel** | Faible — Seul l'accès via Bedrock KB est autorisé, l'accès direct est empêché par IAM |

---

### T10: Denial of Wallet / Cost Abuse

| Élément | Détails |
|---------|---------|
| **Menace** | Explosion des frais AWS par un volume massif de requêtes ou l'utilisation intentionnelle de modèles coûteux |
| **Vecteur d'attaque** | Requêtes massives par un utilisateur authentifié, boucle infinie en mode Agent, utilisation continue de modèles coûteux |
| **Impact** | Élevé — Facturation élevée imprévue |
| **Mesures d'atténuation existantes** | Rate limiting WAF (2000 req/5min), Smart Routing (priorité aux modèles à faible coût), limitation de la concurrence Lambda |
| **Recommandations supplémentaires** | Alertes AWS Budgets, quota quotidien de requêtes par utilisateur, limite du nombre d'étapes Agent, considération de Bedrock Provisioned Throughput |
| **Risque résiduel** | Moyen — Atténué par le rate limiting, mais l'utilisation excessive par des utilisateurs légitimes ne peut être entièrement empêchée |

---

## Table de correspondance menaces → contre-mesures

| Menace | WAF | Guardrails | SID Filter | Fail-Closed | IAM | KMS | Audit | AgentCore Policy |
|--------|-----|-----------|-----------|------------|-----|-----|-------|-----------------|
| T1: Prompt Injection | — | ✅ | — | — | — | — | ✅ | — |
| T2: Retrieval Poisoning | — | ✅ | — | — | ✅ | — | ✅ | — |
| T3: Cross-User Leakage | — | — | ✅ | ✅ | — | — | ✅ | — |
| T4: Stale ACL | — | — | — | ✅ | — | — | ✅ | — |
| T5: Over-Permissive Cache | — | — | ✅ | ✅ | — | — | ✅ | — |
| T6: Agent Tool Abuse | — | ✅ | — | — | ✅ | — | ✅ | ✅ |
| T7: Audit Log Tampering | — | — | — | — | ✅ | ✅ | — | — |
| T8: Misconfigured IdP | — | — | — | ✅ | ✅ | — | ✅ | — |
| T9: Metadata Leakage | — | — | — | — | ✅ | ✅ | ✅ | — |
| T10: Cost Abuse | ✅ | — | — | — | — | — | ✅ | ✅ |

---

## Résumé de l'évaluation des risques

| Menace | Probabilité | Impact | Risque résiduel | Priorité |
|--------|-------------|--------|-----------------|----------|
| T1: Prompt Injection | Élevé | Moyen | Moyen | P1 |
| T2: Retrieval Poisoning | Faible | Élevé | Faible | P2 |
| T3: Cross-User Leakage | Faible | Élevé | Faible | P1 |
| T4: Stale ACL | Moyen | Moyen | Moyen | P2 |
| T5: Over-Permissive Cache | Faible | Élevé | Faible | P3 |
| T6: Agent Tool Abuse | Moyen | Élevé | Moyen | P1 |
| T7: Audit Log Tampering | Faible | Élevé | Faible | P2 |
| T8: Misconfigured IdP | Moyen | Élevé | Moyen | P1 |
| T9: Metadata Leakage | Faible | Moyen | Faible | P3 |
| T10: Cost Abuse | Moyen | Moyen | Moyen | P2 |

---

## Contre-mesures supplémentaires recommandées

### Réponse immédiate (P1)

1. **Activation du filtre Prompt Attack des Guardrails** — Contre-mesure T1
2. **Implémentation du Human Approval pour les appels d'outils Agent** — Contre-mesure T6
3. **Établissement d'un processus d'audit régulier de la configuration IdP** — Contre-mesure T8
4. **Intégration des tests de matrice de permissions dans le CI/CD** — Contre-mesure T3

### Réponse à court terme (P2)

5. **Protection des journaux d'audit par S3 Object Lock** — Contre-mesure T7
6. **Détection immédiate des événements de modification ACL** — Contre-mesure T4
7. **Validation du contenu lors de l'injection de documents** — Contre-mesure T2
8. **AWS Budgets + quota de requêtes par utilisateur** — Contre-mesure T10

### Réponse à moyen terme (P3)

9. **Détection d'anomalies du taux de succès du cache** — Contre-mesure T5
10. **Chiffrement des métadonnées du magasin vectoriel** — Contre-mesure T9

---

## Documents associés

| Document | Menaces associées |
|----------|-------------------|
| [production-readiness-checklist.md](production-readiness-checklist.md) | Toutes les menaces (vérification des contre-mesures pour la mise en production) |
| [permission-consistency.md](permission-consistency.md) | T3, T4, T5 (cohérence des permissions) |
| [governance-and-audit.md](governance-and-audit.md) | T7, T8, T9 (audit et gouvernance) |
| [safe-experimentation-guide.md](safe-experimentation-guide.md) | T2, T10 (périmètre d'expérimentation sûr) |
| [SID-Filtering-Architecture.md](SID-Filtering-Architecture.md) | T1, T3, T5 (conception du filtrage SID) |
