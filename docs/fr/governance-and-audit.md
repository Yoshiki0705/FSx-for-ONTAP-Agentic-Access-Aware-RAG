# Conception de la gouvernance et de l'audit

**🌐 Language:** [日本語](../governance-and-audit.md) | [English](../en/governance-and-audit.md) | [한국어](../ko/governance-and-audit.md) | [简体中文](../zh-CN/governance-and-audit.md) | [繁體中文](../zh-TW/governance-and-audit.md) | **Français** | [Deutsch](../de/governance-and-audit.md) | [Español](../es/governance-and-audit.md)

**Créé le** : 2026-05-21  
**Statut** : Brouillon  
**Public cible** : Responsables sécurité, responsables conformité, secteurs public/santé/finance

---

## Aperçu

Ce document organise la conception des journaux d'audit, le cadre de gouvernance et les directives d'implémentation de l'IA responsable pour le système RAG sensible aux permissions. L'objectif est de rendre le système explicable : « qui, quand, sur la base de quels documents, a reçu quelles réponses. »

---

## Schéma des journaux d'audit

### Journal d'audit de recherche RAG

Les informations suivantes sont enregistrées pour toutes les requêtes de recherche RAG.

```json
{
  "eventType": "RAG_SEARCH",
  "timestamp": "2026-05-21T10:30:00.000Z",
  "requestId": "req-uuid-1234",
  "sessionId": "session-uuid-5678",
  
  "user": {
    "userId": "user@example.com",
    "cognitoSub": "4704eaa8-3041-70d9-672b-e4fbb65bec40",
    "userSID": "S-1-5-21-...-1001",
    "groupSIDs": ["S-1-5-21-...-512", "S-1-1-0"],
    "ipAddress": "203.0.113.1",
    "userAgent": "Mozilla/5.0..."
  },
  
  "query": {
    "text": "会社の売上について教えてください",
    "mode": "kb",
    "modelId": "anthropic.claude-3-5-haiku-20241022-v1:0",
    "smartRouting": true,
    "routingTier": "simple"
  },
  
  "retrieval": {
    "knowledgeBaseId": "KB-XXXXXXXX",
    "vectorStoreType": "s3vectors",
    "totalDocumentsRetrieved": 5,
    "documentsAfterFilter": 2,
    "documentsDenied": 3,
    "filterMethod": "SID_MATCHING",
    "retrievedDocuments": [
      {
        "sourceUri": "s3://bucket/public/product-catalog.md",
        "score": 0.85,
        "accessDecision": "ALLOW",
        "matchedSID": "S-1-1-0"
      },
      {
        "sourceUri": "s3://bucket/confidential/financial-report.md",
        "score": 0.92,
        "accessDecision": "DENY",
        "matchedSID": null
      }
    ]
  },
  
  "response": {
    "tokensInput": 1500,
    "tokensOutput": 350,
    "latencyMs": 2340,
    "guardrailsApplied": false,
    "guardrailsAction": null
  }
}
```

### Journal d'audit du mode Agent

```json
{
  "eventType": "AGENT_EXECUTION",
  "timestamp": "2026-05-21T10:35:00.000Z",
  "requestId": "req-uuid-5678",
  
  "user": { "..." },
  
  "agent": {
    "agentId": "AGENT-XXXXXXXX",
    "agentName": "Document Analyst",
    "agentMode": "single",
    "toolsInvoked": ["kb-search", "summarize"],
    "stepsExecuted": 3
  },
  
  "retrieval": { "..." },
  
  "response": {
    "taskSuccess": true,
    "humanEscalation": false,
    "tokensTotal": 5200,
    "costEstimate": 0.015
  }
}
```

### Journal d'audit des changements de permissions

```json
{
  "eventType": "PERMISSION_CHANGE",
  "timestamp": "2026-05-21T11:00:00.000Z",
  
  "change": {
    "type": "USER_SID_UPDATE",
    "userId": "user@example.com",
    "previousGroupSIDs": ["S-1-1-0"],
    "newGroupSIDs": ["S-1-5-21-...-1100", "S-1-1-0"],
    "source": "AD_SYNC_LAMBDA",
    "triggeredBy": "EventBridge Schedule"
  }
}
```

---

## Architecture de stockage et de protection des journaux

```
┌──────────────────────────────────────────────────────────────────┐
│                     Flux des journaux d'audit                      │
│                                                                    │
│  ┌──────────┐    ┌──────────────┐    ┌─────────────────────────┐ │
│  │ Lambda   │───▶│ CloudWatch   │───▶│ S3 (Bucket journaux     │ │
│  │ (WebApp) │    │ Logs         │    │ d'audit)                 │ │
│  └──────────┘    │ Rétention:1an│    │ ・Object Lock (WORM)    │ │
│                  └──────────────┘    │ ・Chiffrement KMS       │ │
│                                      │ ・Cycle de vie :        │ │
│                                      │   90j→IA, 365j→Glacier  │ │
│  ┌──────────┐    ┌──────────────┐    └─────────────────────────┘ │
│  │ Bedrock  │───▶│ CloudTrail   │                                │
│  │ Appels   │    │ (Data events)│                                │
│  │ API      │    └──────────────┘                                │
│  └──────────┘                                                    │
│                                                                    │
│  ┌──────────┐    ┌──────────────┐                                │
│  │ DynamoDB │───▶│ DynamoDB     │                                │
│  │ Chgmt    │    │ Streams      │───▶ Journal d'audit des chgmt   │
│  │ perm.    │    └──────────────┘     de permissions              │
│  └──────────┘                                                    │
└──────────────────────────────────────────────────────────────────┘
```

### Configuration recommandée

| Composant | Paramètre | Objectif |
|-----------|-----------|----------|
| CloudWatch Logs | Rétention : 1 an | Journaux opérationnels, débogage |
| Bucket S3 journaux d'audit | Object Lock (Mode Governance) | Prévention de la falsification |
| KMS CMK | Rotation automatique activée | Chiffrement |
| CloudTrail | Événements de gestion + données | Suivi des appels API |
| Cycle de vie S3 | 90 jours → IA, 365 jours → Glacier | Optimisation des coûts |
| Athena | Tables partitionnées | Analyse et recherche de journaux |

---

## Conception IA responsable / Guardrails

### Exploitation de Bedrock Guardrails

Configuration des Guardrails activée avec `enableGuardrails=true` :

| Politique | Objectif | Exemple de configuration |
|-----------|----------|--------------------------|
| Filtre de contenu | Détecter et bloquer le contenu nuisible | HATE: HIGH, VIOLENCE: HIGH |
| Politique de sujets | Définir les sujets interdits | Informations sur les concurrents, conseils d'investissement |
| Détection PII | Détecter et masquer les informations personnelles | Noms, numéros de téléphone, adresses e-mail |
| Filtre de mots | Bloquer les expressions interdites | Noms de code internes, informations non publiées |

### Exemple de politique Guardrails

```json
{
  "contentPolicyConfig": {
    "filtersConfig": [
      { "type": "HATE", "inputStrength": "HIGH", "outputStrength": "HIGH" },
      { "type": "INSULTS", "inputStrength": "HIGH", "outputStrength": "HIGH" },
      { "type": "SEXUAL", "inputStrength": "HIGH", "outputStrength": "HIGH" },
      { "type": "VIOLENCE", "inputStrength": "HIGH", "outputStrength": "HIGH" },
      { "type": "MISCONDUCT", "inputStrength": "HIGH", "outputStrength": "HIGH" }
    ]
  },
  "topicPolicyConfig": {
    "topicsConfig": [
      {
        "name": "investment-advice",
        "definition": "投資助言、株価予測、金融商品の推奨",
        "type": "DENY"
      },
      {
        "name": "medical-diagnosis",
        "definition": "医療診断、処方箋の推奨、治療方針の決定",
        "type": "DENY"
      }
    ]
  },
  "sensitiveInformationPolicyConfig": {
    "piiEntitiesConfig": [
      { "type": "NAME", "action": "ANONYMIZE" },
      { "type": "PHONE", "action": "ANONYMIZE" },
      { "type": "EMAIL", "action": "ANONYMIZE" },
      { "type": "CREDIT_DEBIT_CARD_NUMBER", "action": "BLOCK" }
    ]
  }
}
```

### Contrôles par classification des données

| Classification des données | Recherche | Résumé | Citation | Utilisation Agent |
|---------------------------|-----------|--------|----------|-------------------|
| Public | ✅ Autorisé | ✅ Autorisé | ✅ Autorisé | ✅ Autorisé |
| Interne | ✅ Autorisé | ✅ Autorisé | ⚠️ Résumé uniquement | ✅ Autorisé |
| Confidentiel | ✅ Autorisé (autorisés uniquement) | ⚠️ Restreint | ❌ Pas de citation verbatim | ⚠️ Avec approbation |
| Très secret | ⚠️ Avec approbation | ❌ Interdit | ❌ Interdit | ❌ Interdit |

### Approbation humaine pour le mode Agent

Conception où l'Agent demande une approbation humaine avant d'exécuter des actions externes :

```
L'Agent tente d'invoquer l'outil "Envoyer un e-mail"
  → La politique AgentCore détecte la catégorie "Communication externe"
  → Génère une demande d'approbation humaine
  → L'interface affiche l'invite d'approbation/rejet à l'utilisateur
  → L'action n'est exécutée qu'après approbation
```

---

## Cas d'utilisation sectoriels et conformité réglementaire

### Santé

| Exigence | Implémentation |
|----------|----------------|
| Isolation des informations patients | Groupes SID spécifiques au département + masquage PII |
| Recherche de procédures spécifiques au département | Filtrage par SID de département |
| Piste d'audit | Rétention de 5 ans de tous les journaux de recherche |
| Gestion du consentement | Inclure l'indicateur de consentement patient dans les métadonnées |
| Interdire le diagnostic médical | DENY via politique de sujets Guardrails |

**Conformité réglementaire** : Directives pour la gestion de la sécurité des systèmes d'information de santé (Ministère de la Santé)

### Gouvernement / Secteur public

| Exigence | Implémentation |
|----------|----------------|
| Isolation des documents par bureau | Groupes SID par bureau |
| Séparation des documents de politique et non-publics | Métadonnée `access_level` + SID |
| Support des demandes d'accès à l'information | Préservation et capacité d'export des journaux de recherche |
| Protection des informations personnelles | Détection PII + masquage |
| Gestion des documents administratifs | Attribution de métadonnées de classification des documents |

**Conformité réglementaire** : Loi sur la protection des informations personnelles, ISMAP

### Institutions financières

| Exigence | Implémentation |
|----------|----------------|
| Isolation stricte des informations clients | Contrôle d'accès basé sur l'ID client |
| Interdire les conseils d'investissement | Politique de sujets Guardrails |
| Préservation des enregistrements de transactions | Rétention des journaux d'audit de 10 ans |
| Contrôles internes | Revue périodique des journaux d'opérations |
| Exigences de chiffrement | KMS CMK + TLS 1.2 |

**Conformité réglementaire** : Directives de sécurité FISC, Loi sur les instruments financiers et les échanges

### Établissements d'enseignement

| Exigence | Implémentation |
|----------|----------------|
| Séparation des permissions enseignants/étudiants | Groupes SID basés sur les rôles |
| Isolation des matériaux de laboratoire | Groupes SID par laboratoire |
| Protection des informations personnelles des étudiants | Masquage PII |
| Confidentialité des données de recherche | Contrôle d'accès par projet de recherche |

---

## Génération de rapports d'audit

### Éléments de rapport périodique

| Rapport | Fréquence | Contenu |
|---------|-----------|---------|
| Résumé des accès | Quotidien | Nombre de recherches par utilisateur, nombre de refus |
| Rapport de violation de permissions | Quotidien | Déclenchements Fail-Closed, modèles d'accès anormaux |
| Rapport d'intervention Guardrails | Hebdomadaire | Nombre de déclenchements de filtres, statistiques par sujet |
| Rapport de coûts et d'utilisation | Mensuel | Consommation de tokens, nombre d'appels API, utilisation du stockage |
| Rapport de conformité | Trimestriel | État de conformité aux exigences réglementaires, éléments d'amélioration |

### Exemples de requêtes Athena

```sql
-- Événements de refus de permissions des 7 derniers jours
SELECT 
  timestamp,
  user.userId,
  query.text,
  retrieval.documentsDenied,
  retrieval.filterMethod
FROM audit_logs
WHERE eventType = 'RAG_SEARCH'
  AND retrieval.documentsDenied > 0
  AND timestamp > current_timestamp - interval '7' day
ORDER BY timestamp DESC;

-- Analyse des modèles de recherche par utilisateur
SELECT 
  user.userId,
  COUNT(*) as total_searches,
  SUM(retrieval.documentsDenied) as total_denied,
  AVG(response.latencyMs) as avg_latency
FROM audit_logs
WHERE eventType = 'RAG_SEARCH'
  AND timestamp > current_timestamp - interval '30' day
GROUP BY user.userId
ORDER BY total_denied DESC;
```

---

## Traitement des informations personnelles et sensibles

### Flux de masquage / classification

```
Ingestion de documents
  → Scan PII (Comprehend / Guardrails)
  → Attribution d'étiquette de classification (niveau de confidentialité + présence PII)
  → Enregistrement des informations de classification dans .metadata.json
  → Sync KB
  
Lors de la recherche
  → Filtrage SID (permissions d'accès)
  → Détection PII Guardrails (masquage en sortie)
  → Génération de réponse (masquée)
```

### Flux d'approbation (accès aux données confidentielles)

Flux d'approbation lorsque l'accès aux données très secrètes est requis :

1. L'utilisateur soumet une requête de recherche
2. La correspondance SID identifie la catégorie « approbation requise »
3. Notification de demande d'approbation envoyée à l'administrateur (SNS / Slack)
4. L'administrateur approuve → jeton d'accès temporaire émis
5. Accès disponible uniquement pendant la période de validité du jeton
6. Journal d'accès enregistré dans la table d'audit

---

## Documents associés

| Document | Description |
|----------|-------------|
| [production-readiness-checklist.md](production-readiness-checklist.md) | Liste de vérification pour la mise en production |
| [permission-consistency.md](permission-consistency.md) | Modèle de cohérence des changements de permissions |
| [SID-Filtering-Architecture.md](SID-Filtering-Architecture.md) | Architecture de filtrage SID |
| [safe-experimentation-guide.md](safe-experimentation-guide.md) | Guide d'expérimentation sécurisée |
