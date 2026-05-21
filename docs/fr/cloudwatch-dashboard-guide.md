# Guide opérationnel du tableau de bord CloudWatch

**🌐 Language:** [日本語](../cloudwatch-dashboard-guide.md) | [English](../en/cloudwatch-dashboard-guide.md) | [한국어](../ko/cloudwatch-dashboard-guide.md) | [简体中文](../zh-CN/cloudwatch-dashboard-guide.md) | [繁體中文](../zh-TW/cloudwatch-dashboard-guide.md) | **Français** | [Deutsch](../de/cloudwatch-dashboard-guide.md) | [Español](../es/cloudwatch-dashboard-guide.md)

**Date de création** : 2026-05-21  
**Statut** : Brouillon  
**Public cible** : Équipes opérationnelles, SRE, ingénieurs plateforme

---

## Vue d'ensemble

Ce document est un guide de conception et de déploiement du tableau de bord CloudWatch et des alarmes nécessaires à la surveillance opérationnelle du système Permission-aware RAG. En plus du tableau de bord créé automatiquement par CDK avec `enableMonitoring=true`, il organise les métriques et alarmes supplémentaires à configurer.

---

## Liste des métriques de surveillance

### Performance de recherche RAG

| Métrique | Espace de noms | Dimension | Description | Seuil d'alerte |
|----------|---------------|-----------|-------------|----------------|
| Query Latency | `PermissionAwareRAG` | Mode (kb/agent) | Latence globale de la recherche à la génération de réponse | P95 > 10s |
| Bedrock Invocation Count | `AWS/Bedrock` | ModelId | Nombre d'appels à l'API Bedrock | — |
| Bedrock Error Count | `AWS/Bedrock` | ModelId | Nombre d'erreurs de l'API Bedrock | > 5/5min |
| Retrieved Chunk Count | `PermissionAwareRAG` | KnowledgeBaseId | Nombre de chunks récupérés depuis la KB | — |

### Contrôle des permissions

| Métrique | Espace de noms | Dimension | Description | Seuil d'alerte |
|----------|---------------|-----------|-------------|----------------|
| Permission Denied Count | `PermissionAwareRAG` | UserId | Nombre de documents refusés par le filtrage SID | — |
| Permission Cache Hit Rate | `PermissionAwareRAG` | — | Taux de succès du cache | < 20% (anomalie) |
| Permission Cache Miss Rate | `PermissionAwareRAG` | — | Taux d'échec du cache | > 80% (anomalie) |
| Deny All Fallback Count | `PermissionAwareRAG` | — | Nombre de déclenchements Fail-Closed | > 5/5min |
| SID Resolution Failure | `PermissionAwareRAG` | — | Nombre d'échecs de résolution SID | > 0 |

### Synchronisation des données

| Métrique | Espace de noms | Dimension | Description | Seuil d'alerte |
|----------|---------------|-----------|-------------|----------------|
| KB Sync Duration | `KbAutoSync` | KnowledgeBaseId | Durée de la synchronisation KB | > 30min |
| KB Sync Success | `KbAutoSync` | — | Nombre de synchronisations réussies | — |
| KB Sync Failure | `KbAutoSync` | — | Nombre de synchronisations échouées | 3 échecs consécutifs |
| ACL Sync Success | `PermissionAwareRAG` | — | Nombre de synchronisations ACL réussies | — |
| ACL Sync Failure | `PermissionAwareRAG` | — | Nombre de synchronisations ACL échouées | > 0 |

### Guardrails

| Métrique | Espace de noms | Dimension | Description | Seuil d'alerte |
|----------|---------------|-----------|-------------|----------------|
| Guardrails Blocked Count | `PermissionAwareRAG` | PolicyType | Nombre de blocages par les Guardrails | — |
| Guardrails Intervention Rate | `PermissionAwareRAG` | — | Taux d'intervention sur l'ensemble des requêtes | > 10% |

### Agent

| Métrique | Espace de noms | Dimension | Description | Seuil d'alerte |
|----------|---------------|-----------|-------------|----------------|
| Agent Tool Invocation Count | `PermissionAwareRAG` | AgentId, ToolName | Nombre d'appels d'outils | — |
| Agent Step Count | `PermissionAwareRAG` | AgentId | Nombre d'étapes d'exécution de l'Agent | > 10/requête |
| Agent Error Count | `PermissionAwareRAG` | AgentId | Nombre d'erreurs de l'Agent | > 3/5min |

### Coûts

| Métrique | Espace de noms | Dimension | Description | Seuil d'alerte |
|----------|---------------|-----------|-------------|----------------|
| Estimated Token Cost | `PermissionAwareRAG` | ModelId | Coût estimé des tokens (USD) | Quotidien > $50 |
| Smart Routing Tier | `SmartRouting` | RoutingTier | Distribution des destinations de routage | — |

---

## Disposition du tableau de bord

```
┌─────────────────────────────────────────────────────────────────┐
│ Permission-Aware RAG Operations Dashboard                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────────────┐  ┌─────────────────────┐              │
│  │ Query Latency       │  │ Bedrock Invocations  │              │
│  │ (P50/P95/P99)       │  │ (by Model)           │              │
│  └─────────────────────┘  └─────────────────────┘              │
│                                                                   │
│  ┌─────────────────────┐  ┌─────────────────────┐              │
│  │ Permission Denied   │  │ Cache Hit/Miss Rate  │              │
│  │ Count               │  │                      │              │
│  └─────────────────────┘  └─────────────────────┘              │
│                                                                   │
│  ┌─────────────────────┐  ┌─────────────────────┐              │
│  │ KB Sync Status      │  │ Guardrails Blocked   │              │
│  │ (Success/Failure)   │  │ Count                │              │
│  └─────────────────────┘  └─────────────────────┘              │
│                                                                   │
│  ┌─────────────────────┐  ┌─────────────────────┐              │
│  │ Agent Tool Calls    │  │ Estimated Cost       │              │
│  │ (by Tool)           │  │ Trend                │              │
│  └─────────────────────┘  └─────────────────────┘              │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Définitions des alarmes

### Critical (Réponse immédiate)

```yaml
- AlarmName: RAG-PermissionDenyAllFallback
  MetricName: DenyAllFallbackCount
  Namespace: PermissionAwareRAG
  Statistic: Sum
  Period: 300
  EvaluationPeriods: 1
  Threshold: 5
  ComparisonOperator: GreaterThanThreshold
  AlarmActions: [!Ref CriticalSNSTopic]

- AlarmName: RAG-SIDResolutionFailure
  MetricName: SIDResolutionFailure
  Namespace: PermissionAwareRAG
  Statistic: Sum
  Period: 300
  EvaluationPeriods: 1
  Threshold: 0
  ComparisonOperator: GreaterThanThreshold
  AlarmActions: [!Ref CriticalSNSTopic]
```

### Warning (Investigation requise)

```yaml
- AlarmName: RAG-HighLatency
  MetricName: QueryLatency
  Namespace: PermissionAwareRAG
  ExtendedStatistic: p95
  Period: 300
  EvaluationPeriods: 3
  Threshold: 10000  # 10 seconds in ms
  ComparisonOperator: GreaterThanThreshold
  AlarmActions: [!Ref WarningSNSTopic]

- AlarmName: RAG-KBSyncConsecutiveFailure
  MetricName: KBSyncFailure
  Namespace: KbAutoSync
  Statistic: Sum
  Period: 900
  EvaluationPeriods: 3
  Threshold: 1
  ComparisonOperator: GreaterThanOrEqualToThreshold
  AlarmActions: [!Ref WarningSNSTopic]

- AlarmName: RAG-HighCacheMissRate
  MetricName: PermissionCacheMissRate
  Namespace: PermissionAwareRAG
  Statistic: Average
  Period: 300
  EvaluationPeriods: 3
  Threshold: 80
  ComparisonOperator: GreaterThanThreshold
  AlarmActions: [!Ref WarningSNSTopic]
```

---

## Modèles de dépannage

### Modèle 1 : Déclenchements fréquents du Deny All Fallback

```
Symptôme : DenyAllFallbackCount en forte augmentation
Causes possibles :
  1. Problème de connexion à la table DynamoDB user-access
  2. Données SID non enregistrées pour un nouvel utilisateur
  3. Échec de la Lambda AD Sync

Procédure d'investigation :
  1. Vérifier les erreurs Lambda dans CloudWatch Logs
  2. Vérifier le throttling de la table DynamoDB
  3. Vérifier le dernier résultat d'exécution de la Lambda AD Sync
```

### Modèle 2 : Augmentation soudaine de la latence

```
Symptôme : QueryLatency P95 supérieur à 10 secondes
Causes possibles :
  1. Throttling de l'API Bedrock
  2. Cold start de S3 Vectors
  3. Charge pendant la synchronisation KB

Procédure d'investigation :
  1. Vérifier InvocationLatency de Bedrock
  2. Vérifier la latence des requêtes S3 Vectors
  3. Vérifier l'état d'exécution du job de synchronisation KB
```

### Modèle 3 : Augmentation soudaine des coûts

```
Symptôme : EstimatedTokenCost supérieur à 3 fois la normale
Causes possibles :
  1. Smart Routing orienté vers les modèles coûteux
  2. Utilisation excessive du mode Agent
  3. Requêtes massives non autorisées

Procédure d'investigation :
  1. Vérifier la distribution de SmartRouting RoutingTier
  2. Vérifier les valeurs anormales de Agent StepCount
  3. Vérifier le nombre de blocages du rate limiting WAF
```

---

## Procédure d'importation du tableau de bord

### Création automatique CDK (recommandé)

```bash
# Création automatique avec enableMonitoring=true
cat > cdk.context.json << 'EOF'
{
  "projectName": "rag-demo",
  "environment": "demo",
  "enableMonitoring": true
}
EOF

npx cdk deploy --all
```

### Importation manuelle

```bash
# Utilisation de monitoring/cloudwatch-dashboard.json
aws cloudwatch put-dashboard \
  --dashboard-name "PermissionAwareRAG-Operations" \
  --dashboard-body file://monitoring/cloudwatch-dashboard.json \
  --region ap-northeast-1
```

---

## Documents associés

| Document | Contenu |
|----------|---------|
| [production-readiness-checklist.md](production-readiness-checklist.md) | Checklist de mise en production (éléments de configuration de la surveillance) |
| [permission-consistency.md](permission-consistency.md) | Configuration de surveillance recommandée lors des modifications de permissions |
| [governance-and-audit.md](governance-and-audit.md) | Journaux d'audit et génération de rapports |
| [threat-model.md](threat-model.md) | Modèle de menaces (menaces à détecter par la surveillance) |
