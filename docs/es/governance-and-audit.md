# Diseño de gobernanza y auditoría

**🌐 Language:** [日本語](../governance-and-audit.md) | [English](../en/governance-and-audit.md) | [한국어](../ko/governance-and-audit.md) | [简体中文](../zh-CN/governance-and-audit.md) | [繁體中文](../zh-TW/governance-and-audit.md) | [Français](../fr/governance-and-audit.md) | [Deutsch](../de/governance-and-audit.md) | **Español**

**Creado**: 2026-05-21  
**Estado**: Borrador  
**Audiencia**: Oficiales de seguridad, oficiales de cumplimiento, sector público/salud/financiero

---

## Descripción general

Este documento organiza el diseño de registros de auditoría, el marco de gobernanza y las directrices de implementación de IA Responsable para el sistema RAG con reconocimiento de permisos. El objetivo es hacerlo explicable: "quién, cuándo, basándose en qué documentos, recibió qué respuestas."

---

## Esquema de registro de auditoría

### Registro de auditoría de búsqueda RAG

La siguiente información se registra para todas las solicitudes de búsqueda RAG.

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

### Registro de auditoría del modo Agent

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

### Registro de auditoría de cambios de permisos

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

## Arquitectura de almacenamiento y protección de registros

```
┌──────────────────────────────────────────────────────────────────┐
│                     Flujo de registros de auditoría                │
│                                                                    │
│  ┌──────────┐    ┌──────────────┐    ┌─────────────────────────┐ │
│  │ Lambda   │───▶│ CloudWatch   │───▶│ S3 (Bucket de auditoría)│ │
│  │ (WebApp) │    │ Logs         │    │ ・Object Lock (WORM)    │ │
│  └──────────┘    │ Retención:1yr│    │ ・Cifrado KMS           │ │
│                  └──────────────┘    │ ・Lifecycle:            │ │
│                                      │   90d→IA, 365d→Glacier  │ │
│  ┌──────────┐    ┌──────────────┐    └─────────────────────────┘ │
│  │ Bedrock  │───▶│ CloudTrail   │                                │
│  │ API calls│    │ (Data events)│                                │
│  └──────────┘    └──────────────┘                                │
│                                                                    │
│  ┌──────────┐    ┌──────────────┐                                │
│  │ DynamoDB │───▶│ DynamoDB     │                                │
│  │ Perm     │    │ Streams      │───▶ Registro de auditoría de   │
│  │ changes  │    └──────────────┘     cambios de permisos        │
│  └──────────┘                                                    │
└──────────────────────────────────────────────────────────────────┘
```

### Configuración recomendada

| Componente | Configuración | Propósito |
|------------|---------------|-----------|
| CloudWatch Logs | Retención: 1 año | Registros operativos, depuración |
| Bucket de auditoría S3 | Object Lock (Modo Governance) | Prevención de manipulación |
| KMS CMK | Rotación automática habilitada | Cifrado |
| CloudTrail | Eventos de gestión + datos | Rastreo de llamadas API |
| Lifecycle S3 | 90 días → IA, 365 días → Glacier | Optimización de costos |
| Athena | Tablas particionadas | Análisis y búsqueda de registros |

---

## Diseño de IA Responsable / Guardrails

### Aprovechamiento de Bedrock Guardrails

Configuración de Guardrails habilitada con `enableGuardrails=true`:

| Política | Propósito | Ejemplo de configuración |
|----------|-----------|--------------------------|
| Filtro de contenido | Detectar y bloquear contenido dañino | HATE: HIGH, VIOLENCE: HIGH |
| Política de temas | Definir temas prohibidos | Información de competidores, asesoramiento de inversión |
| Detección de PII | Detectar y enmascarar información personal | Nombres, números de teléfono, direcciones de correo electrónico |
| Filtro de palabras | Bloquear frases prohibidas | Nombres en código internos, información no publicada |

### Política de muestra de Guardrails

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

### Controles por clasificación de datos

| Clasificación de datos | Búsqueda | Resumen | Citación | Uso de Agent |
|------------------------|----------|---------|----------|--------------|
| Público | ✅ Permitido | ✅ Permitido | ✅ Permitido | ✅ Permitido |
| Interno | ✅ Permitido | ✅ Permitido | ⚠️ Solo resumen | ✅ Permitido |
| Confidencial | ✅ Permitido (solo autorizados) | ⚠️ Restringido | ❌ Sin citación textual | ⚠️ Con aprobación |
| Máximo secreto | ⚠️ Con aprobación | ❌ Prohibido | ❌ Prohibido | ❌ Prohibido |

### Aprobación humana para modo Agent

Diseño donde el Agent solicita aprobación humana antes de ejecutar acciones externas:

```
Agent intenta invocar herramienta "Send Email"
  → Política de AgentCore detecta categoría "External Communication"
  → Genera solicitud de aprobación humana
  → UI muestra prompt de aprobación/rechazo al usuario
  → Acción ejecutada solo después de la aprobación
```

---

## Casos de uso específicos por industria y cumplimiento regulatorio

### Salud

| Requisito | Implementación |
|-----------|----------------|
| Aislamiento de información del paciente | Grupos SID específicos por departamento + enmascaramiento de PII |
| Búsqueda de procedimientos por departamento | Filtrar por SID de departamento |
| Rastro de auditoría | Retención de 5 años de todos los registros de búsqueda |
| Gestión de consentimiento | Incluir indicador de consentimiento del paciente en metadatos |
| Prohibir diagnóstico médico | DENY vía política de temas de Guardrails |

**Cumplimiento regulatorio**: Directrices para la gestión segura de sistemas de información sanitaria (Ministerio de Salud, Trabajo y Bienestar)

### Gobierno / Sector público

| Requisito | Implementación |
|-----------|----------------|
| Aislamiento de documentos por oficina | Grupos SID por oficina |
| Separación de políticas y materiales no públicos | Metadatos `access_level` + SID |
| Soporte de solicitudes de acceso a información | Preservación y capacidad de exportación de registros de búsqueda |
| Protección de información personal | Detección de PII + enmascaramiento |
| Gestión de documentos administrativos | Asignación de metadatos de clasificación de documentos |

**Cumplimiento regulatorio**: Ley de Protección de Información Personal, ISMAP

### Instituciones financieras

| Requisito | Implementación |
|-----------|----------------|
| Aislamiento estricto de información del cliente | Control de acceso basado en ID de cliente |
| Prohibir asesoramiento de inversión | Política de temas de Guardrails |
| Preservación de registros de transacciones | Retención de registros de auditoría por 10 años |
| Controles internos | Revisión periódica de registros de operaciones |
| Requisitos de cifrado | KMS CMK + TLS 1.2 |

**Cumplimiento regulatorio**: Directrices de seguridad FISC, Ley de Instrumentos Financieros y Bolsa

### Instituciones educativas

| Requisito | Implementación |
|-----------|----------------|
| Separación de permisos facultad/estudiante | Grupos SID basados en roles |
| Aislamiento de materiales por laboratorio | Grupos SID por laboratorio |
| Protección de información personal de estudiantes | Enmascaramiento de PII |
| Confidencialidad de datos de investigación | Control de acceso por proyecto de investigación |

---

## Generación de informes de auditoría

### Elementos de informes periódicos

| Informe | Frecuencia | Contenido |
|---------|-----------|-----------|
| Resumen de acceso | Diario | Cantidad de búsquedas por usuario, cantidad de denegaciones |
| Informe de violaciones de permisos | Diario | Activaciones de Fail-Closed, patrones de acceso anómalos |
| Informe de intervención de Guardrails | Semanal | Cantidad de activaciones de filtro, estadísticas por tema |
| Informe de costos y uso | Mensual | Consumo de tokens, cantidad de llamadas API, uso de almacenamiento |
| Informe de cumplimiento | Trimestral | Estado de conformidad con requisitos regulatorios, elementos de mejora |

### Ejemplos de consultas Athena

```sql
-- Eventos de denegación de permisos en los últimos 7 días
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

-- Análisis de patrones de búsqueda por usuario
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

## Manejo de información personal y sensible

### Flujo de enmascaramiento / clasificación

```
Ingesta de documentos
  → Escaneo de PII (Comprehend / Guardrails)
  → Asignación de etiqueta de clasificación (nivel de confidencialidad + presencia de PII)
  → Registrar información de clasificación en .metadata.json
  → Sincronización de KB
  
En el momento de la búsqueda
  → Filtrado SID (permisos de acceso)
  → Detección de PII por Guardrails (enmascaramiento de salida)
  → Generación de respuesta (enmascarada)
```

### Flujo de aprobación (acceso a datos confidenciales)

Flujo de aprobación cuando se requiere acceso a datos de máximo secreto:

1. El usuario envía solicitud de búsqueda
2. La coincidencia de SID identifica la categoría "se requiere aprobación"
3. Se envía notificación de solicitud de aprobación al administrador (SNS / Slack)
4. El administrador aprueba → se emite token de acceso temporal
5. Acceso disponible solo durante el período de validez del token
6. El registro de acceso se registra en la tabla de auditoría

---

## Documentos relacionados

| Documento | Descripción |
|-----------|-------------|
| [production-readiness-checklist.md](production-readiness-checklist.md) | Lista de verificación de preparación para producción |
| [permission-consistency.md](permission-consistency.md) | Modelo de consistencia de cambios de permisos |
| [SID-Filtering-Architecture.md](SID-Filtering-Architecture.md) | Arquitectura de filtrado SID |
| [safe-experimentation-guide.md](safe-experimentation-guide.md) | Guía de experimentación segura |
