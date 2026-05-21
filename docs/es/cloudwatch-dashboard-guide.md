# Guía operativa del panel de CloudWatch

**🌐 Language:** [日本語](../cloudwatch-dashboard-guide.md) | [English](../en/cloudwatch-dashboard-guide.md) | [한국어](../ko/cloudwatch-dashboard-guide.md) | [简体中文](../zh-CN/cloudwatch-dashboard-guide.md) | [繁體中文](../zh-TW/cloudwatch-dashboard-guide.md) | [Français](../fr/cloudwatch-dashboard-guide.md) | [Deutsch](../de/cloudwatch-dashboard-guide.md) | **Español**

**Fecha de creación**: 2026-05-21  
**Estado**: Borrador  
**Audiencia**: Equipos de operaciones, SRE, ingenieros de plataforma

---

## Descripción general

Este documento es una guía de diseño e implementación del panel de CloudWatch y las alarmas necesarias para la monitorización operativa del sistema Permission-aware RAG. Además del panel creado automáticamente por CDK con `enableMonitoring=true`, se organizan las métricas y alarmas adicionales que deben configurarse.

---

## Lista de métricas de monitorización

### Rendimiento de búsqueda RAG

| Métrica | Espacio de nombres | Dimensión | Descripción | Umbral de alerta |
|---------|-------------------|-----------|-------------|-----------------|
| Query Latency | `PermissionAwareRAG` | Mode (kb/agent) | Latencia total desde la búsqueda hasta la generación de respuesta | P95 > 10s |
| Bedrock Invocation Count | `AWS/Bedrock` | ModelId | Número de llamadas a la API de Bedrock | — |
| Bedrock Error Count | `AWS/Bedrock` | ModelId | Número de errores de la API de Bedrock | > 5/5min |
| Retrieved Chunk Count | `PermissionAwareRAG` | KnowledgeBaseId | Número de chunks recuperados de KB | — |

### Control de permisos

| Métrica | Espacio de nombres | Dimensión | Descripción | Umbral de alerta |
|---------|-------------------|-----------|-------------|-----------------|
| Permission Denied Count | `PermissionAwareRAG` | UserId | Número de documentos denegados por filtrado SID | — |
| Permission Cache Hit Rate | `PermissionAwareRAG` | — | Tasa de aciertos de caché | < 20% (anómalo) |
| Permission Cache Miss Rate | `PermissionAwareRAG` | — | Tasa de fallos de caché | > 80% (anómalo) |
| Deny All Fallback Count | `PermissionAwareRAG` | — | Número de activaciones de Fail-Closed | > 5/5min |
| SID Resolution Failure | `PermissionAwareRAG` | — | Número de fallos en resolución de SID | > 0 |

### Sincronización de datos

| Métrica | Espacio de nombres | Dimensión | Descripción | Umbral de alerta |
|---------|-------------------|-----------|-------------|-----------------|
| KB Sync Duration | `KbAutoSync` | KnowledgeBaseId | Duración de la sincronización de KB | > 30min |
| KB Sync Success | `KbAutoSync` | — | Número de sincronizaciones exitosas | — |
| KB Sync Failure | `KbAutoSync` | — | Número de sincronizaciones fallidas | 3 consecutivas |
| ACL Sync Success | `PermissionAwareRAG` | — | Número de sincronizaciones ACL exitosas | — |
| ACL Sync Failure | `PermissionAwareRAG` | — | Número de sincronizaciones ACL fallidas | > 0 |

### Guardrails

| Métrica | Espacio de nombres | Dimensión | Descripción | Umbral de alerta |
|---------|-------------------|-----------|-------------|-----------------|
| Guardrails Blocked Count | `PermissionAwareRAG` | PolicyType | Número de bloqueos por Guardrails | — |
| Guardrails Intervention Rate | `PermissionAwareRAG` | — | Tasa de intervención sobre el total de solicitudes | > 10% |

### Agent

| Métrica | Espacio de nombres | Dimensión | Descripción | Umbral de alerta |
|---------|-------------------|-----------|-------------|-----------------|
| Agent Tool Invocation Count | `PermissionAwareRAG` | AgentId, ToolName | Número de invocaciones de herramientas | — |
| Agent Step Count | `PermissionAwareRAG` | AgentId | Número de pasos de ejecución del Agent | > 10/request |
| Agent Error Count | `PermissionAwareRAG` | AgentId | Número de errores del Agent | > 3/5min |

### Costes

| Métrica | Espacio de nombres | Dimensión | Descripción | Umbral de alerta |
|---------|-------------------|-----------|-------------|-----------------|
| Estimated Token Cost | `PermissionAwareRAG` | ModelId | Coste estimado de tokens (USD) | Diario > $50 |
| Smart Routing Tier | `SmartRouting` | RoutingTier | Distribución de destinos de enrutamiento | — |

---

## Diseño del panel

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

## Definiciones de alarmas

### Critical (Respuesta inmediata)

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

### Warning (Investigación requerida)

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

## Patrones de solución de problemas

### Patrón 1: Deny All Fallback frecuente

```
Síntoma: DenyAllFallbackCount aumenta repentinamente
Causas posibles:
  1. Fallo de conexión a la tabla DynamoDB user-access
  2. Datos SID no registrados para nuevos usuarios
  3. Fallo de la Lambda de AD Sync

Procedimiento de investigación:
  1. Verificar errores de Lambda en CloudWatch Logs
  2. Verificar throttling de la tabla DynamoDB
  3. Verificar el resultado de la última ejecución de la Lambda de AD Sync
```

### Patrón 2: Aumento repentino de latencia

```
Síntoma: QueryLatency P95 supera los 10 segundos
Causas posibles:
  1. Throttling de la API de Bedrock
  2. Cold start de S3 Vectors
  3. Carga durante la sincronización de KB

Procedimiento de investigación:
  1. Verificar Bedrock InvocationLatency
  2. Verificar la latencia de consulta de S3 Vectors
  3. Verificar el estado de ejecución del trabajo de sincronización de KB
```

### Patrón 3: Aumento repentino de costes

```
Síntoma: EstimatedTokenCost es más de 3 veces lo normal
Causas posibles:
  1. Smart Routing está sesgado hacia modelos de alto coste
  2. Uso excesivo del modo Agent
  3. Solicitudes masivas no autorizadas

Procedimiento de investigación:
  1. Verificar la distribución de SmartRouting RoutingTier
  2. Verificar valores anómalos de Agent StepCount
  3. Verificar el número de bloqueos del rate limit de WAF
```

---

## Procedimiento de importación del panel

### Creación automática CDK (recomendado)

```bash
# Creación automática con enableMonitoring=true
cat > cdk.context.json << 'EOF'
{
  "projectName": "rag-demo",
  "environment": "demo",
  "enableMonitoring": true
}
EOF

npx cdk deploy --all
```

### Importación manual

```bash
# Usar monitoring/cloudwatch-dashboard.json
aws cloudwatch put-dashboard \
  --dashboard-name "PermissionAwareRAG-Operations" \
  --dashboard-body file://monitoring/cloudwatch-dashboard.json \
  --region ap-northeast-1
```

---

## Documentos relacionados

| Documento | Contenido |
|-----------|-----------|
| [production-readiness-checklist.md](production-readiness-checklist.md) | Lista de verificación para producción (elementos de configuración de monitorización) |
| [permission-consistency.md](permission-consistency.md) | Configuración de monitorización recomendada para cambios de permisos |
| [governance-and-audit.md](governance-and-audit.md) | Registros de auditoría y generación de informes |
| [threat-model.md](threat-model.md) | Modelo de amenazas (amenazas a detectar mediante monitorización) |
