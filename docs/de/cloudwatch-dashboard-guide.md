# CloudWatch-Dashboard-Betriebsleitfaden

**🌐 Language:** [日本語](../cloudwatch-dashboard-guide.md) | [English](../en/cloudwatch-dashboard-guide.md) | [한국어](../ko/cloudwatch-dashboard-guide.md) | [简体中文](../zh-CN/cloudwatch-dashboard-guide.md) | [繁體中文](../zh-TW/cloudwatch-dashboard-guide.md) | [Français](../fr/cloudwatch-dashboard-guide.md) | **Deutsch** | [Español](../es/cloudwatch-dashboard-guide.md)

**Erstellungsdatum**: 2026-05-21  
**Status**: Entwurf  
**Zielgruppe**: Betriebsteams, SRE, Plattform-Ingenieure

---

## Überblick

Dieses Dokument ist ein Design- und Einführungsleitfaden für CloudWatch-Dashboards und Alarme, die für die Betriebsüberwachung des Permission-aware RAG-Systems erforderlich sind. Neben dem Dashboard, das CDK automatisch mit `enableMonitoring=true` erstellt, werden zusätzlich zu konfigurierende Metriken und Alarme zusammengefasst.

---

## Überwachungsmetriken-Liste

### RAG-Suchleistung

| Metrik | Namespace | Dimension | Beschreibung | Alarmschwellenwert |
|--------|-----------|-----------|--------------|-------------------|
| Query Latency | `PermissionAwareRAG` | Mode (kb/agent) | Gesamtlatenz von Suche bis Antwortgenerierung | P95 > 10s |
| Bedrock Invocation Count | `AWS/Bedrock` | ModelId | Anzahl der Bedrock API-Aufrufe | — |
| Bedrock Error Count | `AWS/Bedrock` | ModelId | Anzahl der Bedrock API-Fehler | > 5/5min |
| Retrieved Chunk Count | `PermissionAwareRAG` | KnowledgeBaseId | Anzahl der aus KB abgerufenen Chunks | — |

### Berechtigungskontrolle

| Metrik | Namespace | Dimension | Beschreibung | Alarmschwellenwert |
|--------|-----------|-----------|--------------|-------------------|
| Permission Denied Count | `PermissionAwareRAG` | UserId | Anzahl der durch SID-Filterung abgelehnten Dokumente | — |
| Permission Cache Hit Rate | `PermissionAwareRAG` | — | Cache-Trefferquote | < 20% (anomal) |
| Permission Cache Miss Rate | `PermissionAwareRAG` | — | Cache-Fehlquote | > 80% (anomal) |
| Deny All Fallback Count | `PermissionAwareRAG` | — | Anzahl der Fail-Closed-Auslösungen | > 5/5min |
| SID Resolution Failure | `PermissionAwareRAG` | — | Anzahl der SID-Auflösungsfehler | > 0 |


### Datensynchronisation

| Metrik | Namespace | Dimension | Beschreibung | Alarmschwellenwert |
|--------|-----------|-----------|--------------|-------------------|
| KB Sync Duration | `KbAutoSync` | KnowledgeBaseId | Dauer der KB-Synchronisation | > 30min |
| KB Sync Success | `KbAutoSync` | — | Anzahl erfolgreicher Synchronisationen | — |
| KB Sync Failure | `KbAutoSync` | — | Anzahl fehlgeschlagener Synchronisationen | 3 aufeinanderfolgende |
| ACL Sync Success | `PermissionAwareRAG` | — | Anzahl erfolgreicher ACL-Synchronisationen | — |
| ACL Sync Failure | `PermissionAwareRAG` | — | Anzahl fehlgeschlagener ACL-Synchronisationen | > 0 |

### Guardrails

| Metrik | Namespace | Dimension | Beschreibung | Alarmschwellenwert |
|--------|-----------|-----------|--------------|-------------------|
| Guardrails Blocked Count | `PermissionAwareRAG` | PolicyType | Anzahl der durch Guardrails blockierten Anfragen | — |
| Guardrails Intervention Rate | `PermissionAwareRAG` | — | Interventionsrate aller Anfragen | > 10% |

### Agent

| Metrik | Namespace | Dimension | Beschreibung | Alarmschwellenwert |
|--------|-----------|-----------|--------------|-------------------|
| Agent Tool Invocation Count | `PermissionAwareRAG` | AgentId, ToolName | Anzahl der Tool-Aufrufe | — |
| Agent Step Count | `PermissionAwareRAG` | AgentId | Anzahl der Agent-Ausführungsschritte | > 10/request |
| Agent Error Count | `PermissionAwareRAG` | AgentId | Anzahl der Agent-Fehler | > 3/5min |

### Kosten

| Metrik | Namespace | Dimension | Beschreibung | Alarmschwellenwert |
|--------|-----------|-----------|--------------|-------------------|
| Estimated Token Cost | `PermissionAwareRAG` | ModelId | Geschätzte Token-Kosten (USD) | Täglich > $50 |
| Smart Routing Tier | `SmartRouting` | RoutingTier | Verteilung der Routing-Ziele | — |

---

## Dashboard-Layout

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

## Alarmdefinitionen

### Critical (Sofortige Reaktion)

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

### Warning (Untersuchung erforderlich)

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

## Fehlerbehebungsmuster

### Muster 1: Häufiges Deny All Fallback

```
Symptom: DenyAllFallbackCount steigt rapide an
Mögliche Ursachen:
  1. Verbindungsstörung zur DynamoDB user-access-Tabelle
  2. SID-Daten für neue Benutzer nicht registriert
  3. Fehler der AD Sync Lambda

Untersuchungsschritte:
  1. Lambda-Fehler in CloudWatch Logs prüfen
  2. Throttling der DynamoDB-Tabelle prüfen
  3. Letztes Ausführungsergebnis der AD Sync Lambda prüfen
```

### Muster 2: Plötzlicher Latenzanstieg

```
Symptom: QueryLatency P95 übersteigt 10 Sekunden
Mögliche Ursachen:
  1. Throttling der Bedrock API
  2. Cold Start von S3 Vectors
  3. Last während KB-Synchronisation

Untersuchungsschritte:
  1. Bedrock InvocationLatency prüfen
  2. Abfragelatenz von S3 Vectors prüfen
  3. Ausführungsstatus des KB-Synchronisationsjobs prüfen
```

### Muster 3: Plötzlicher Kostenanstieg

```
Symptom: EstimatedTokenCost ist mehr als 3-fach über dem Normalwert
Mögliche Ursachen:
  1. Smart Routing bevorzugt hochpreisige Modelle
  2. Übermäßige Nutzung des Agent-Modus
  3. Unberechtigte Massenanfragen

Untersuchungsschritte:
  1. Verteilung von SmartRouting RoutingTier prüfen
  2. Anomale Werte bei Agent StepCount prüfen
  3. Blockierungsanzahl der WAF-Ratenbegrenzung prüfen
```

---

## Dashboard-Importverfahren

### CDK-Automatische Erstellung (empfohlen)

```bash
# Automatische Erstellung mit enableMonitoring=true
cat > cdk.context.json << 'EOF'
{
  "projectName": "rag-demo",
  "environment": "demo",
  "enableMonitoring": true
}
EOF

npx cdk deploy --all
```

### Manueller Import

```bash
# monitoring/cloudwatch-dashboard.json verwenden
aws cloudwatch put-dashboard \
  --dashboard-name "PermissionAwareRAG-Operations" \
  --dashboard-body file://monitoring/cloudwatch-dashboard.json \
  --region ap-northeast-1
```

---

## Verwandte Dokumente

| Dokument | Inhalt |
|----------|--------|
| [production-readiness-checklist.md](production-readiness-checklist.md) | Produktionsreife-Checkliste (Überwachungskonfigurationselemente) |
| [permission-consistency.md](permission-consistency.md) | Empfohlene Überwachungseinstellungen bei Berechtigungsänderungen |
| [governance-and-audit.md](governance-and-audit.md) | Auditprotokolle und Berichtserstellung |
| [threat-model.md](threat-model.md) | Bedrohungsmodell (durch Überwachung zu erkennende Bedrohungen) |