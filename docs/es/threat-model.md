# Modelo de amenazas — Access-Aware Agentic RAG

**🌐 Language:** [日本語](../threat-model.md) | [English](../en/threat-model.md) | [한국어](../ko/threat-model.md) | [简体中文](../zh-CN/threat-model.md) | [繁體中文](../zh-TW/threat-model.md) | [Français](../fr/threat-model.md) | [Deutsch](../de/threat-model.md) | **Español**

**Fecha de creación**: 2026-05-21  
**Estado**: Borrador  
**Audiencia**: Arquitectos de seguridad, responsables de modelado de amenazas, CISOs

---

## Descripción general

Este documento es un modelo de amenazas que organiza las principales amenazas, vectores de ataque, impacto, medidas de mitigación existentes y contramedidas adicionales recomendadas para el sistema Permission-aware Agentic RAG.

---

## Límites del sistema y límites de confianza

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Límite de confianza 1: Internet → CloudFront                            │
│  Atacantes: Usuarios externos, bots, scripts                            │
├─────────────────────────────────────────────────────────────────────────┤
│ Límite de confianza 2: CloudFront → Lambda (WebApp)                     │
│  Atacantes: Usuarios autenticados pero no autorizados                   │
├─────────────────────────────────────────────────────────────────────────┤
│ Límite de confianza 3: Lambda → Bedrock / DynamoDB / FSx                │
│  Atacantes: Amenazas internas, errores de configuración, cadena de      │
│             suministro                                                   │
├─────────────────────────────────────────────────────────────────────────┤
│ Límite de confianza 4: FSx ONTAP → S3 Access Point → Bedrock KB         │
│  Atacantes: Escalada de privilegios, manipulación de metadatos          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Catálogo de amenazas

### T1: Prompt Injection

| Elemento | Detalles |
|----------|----------|
| **Amenaza** | Mediante prompts maliciosos, se provoca la omisión del prompt del sistema, el bypass de verificaciones de permisos y la divulgación no intencionada de información |
| **Vector de ataque** | Entrada del usuario → Converse API / Agent |
| **Impacto** | Alto — Filtración del contenido de documentos fuera de los permisos, alteración del comportamiento del sistema |
| **Medidas de mitigación existentes** | Bedrock Guardrails (filtro de contenido), el filtrado SID se ejecuta en la capa de aplicación (no puede ser evitado por el LLM) |
| **Recomendaciones adicionales** | Activar el filtro Prompt Attack de Guardrails, limitar la longitud de entrada, añadir capa de validación de salida |
| **Riesgo residual** | La Prompt Injection indirecta (instrucciones incrustadas en documentos) no puede prevenirse completamente |

**Importante**: En este sistema, el filtrado SID se ejecuta fuera del LLM (en la capa de aplicación), por lo que no es posible eludir la verificación de permisos mediante Prompt Injection. Sin embargo, persiste el riesgo de divulgar información de documentos permitidos de forma no intencionada.

---

### T2: Retrieval Poisoning

| Elemento | Detalles |
|----------|----------|
| **Amenaza** | Colocar documentos maliciosos en el volumen FSx para contaminar los resultados de búsqueda RAG |
| **Vector de ataque** | Acceso CIFS/SMB → Volumen FSx → S3 AP → Bedrock KB |
| **Impacto** | Medio a Alto — Generación de información errónea, inducción a phishing, Prompt Injection indirecta |
| **Medidas de mitigación existentes** | Restricción de escritura mediante NTFS ACL, restricción de rol IAM de Transfer Family, `.metadata.json` solo puede ser generado por el rol de servicio |
| **Recomendaciones adicionales** | Escaneo de malware al ingerir documentos, pipeline de validación de contenido, detección de anomalías (alerta por aumento repentino de documentos) |
| **Riesgo residual** | Contaminación intencional por usuarios internos con permisos legítimos de escritura |

---

### T3: Cross-User Data Leakage

| Elemento | Detalles |
|----------|----------|
| **Amenaza** | Los resultados de búsqueda del usuario A incluyen documentos accesibles solo para el usuario B |
| **Vector de ataque** | Bug en la implementación del filtrado SID, contaminación de caché, confusión de sesión |
| **Impacto** | Alto — Filtración de información confidencial, violación de cumplimiento normativo |
| **Medidas de mitigación existentes** | Coincidencia SID (intersección de conjuntos), principio Fail-Closed, pruebas de matriz de permisos (31 escenarios) |
| **Recomendaciones adicionales** | Ejecución automática periódica de pruebas de matriz de permisos, detección de anomalías (patrones de acceso a documentos no habituales) |
| **Riesgo residual** | Bajo — El filtrado SID se ejecuta fuera del LLM, por lo que el bypass es difícil excepto por bugs de implementación |

---

### T4: Stale ACL / Permission Drift

| Elemento | Detalles |
|----------|----------|
| **Amenaza** | Se modifican las ACL del archivo, pero los permisos antiguos persisten en los metadatos del vector store o en la caché de permisos |
| **Vector de ataque** | Cambio de ACL → Metadatos no actualizados → Búsqueda posible con permisos antiguos |
| **Impacto** | Medio — Acceso posible durante un período después de la revocación de permisos (máximo 35 minutos) |
| **Medidas de mitigación existentes** | KB Auto-Sync (intervalo de 15 minutos), TTL de caché de permisos (5 minutos), procedimiento de revocación de emergencia |
| **Recomendaciones adicionales** | Detección inmediata de eventos de cambio de ACL (FSx Audit Log → EventBridge), considerar reducción del TTL de caché, registro de auditoría de cambios de permisos |
| **Riesgo residual** | Debido al modelo Eventually Consistent, la reflexión completa en tiempo real es imposible. En emergencias se responde con revocación manual |

**Detalle**: Consulte [permission-consistency.md](permission-consistency.md)

---

### T5: Over-Permissive Cache

| Elemento | Detalles |
|----------|----------|
| **Amenaza** | La caché de permisos se fija en un estado excesivamente permisivo y continúa permitiendo accesos que deberían ser denegados |
| **Vector de ataque** | Condición de carrera al escribir en caché, error de configuración de TTL, colisión de claves de caché |
| **Impacto** | Alto — Acceso continuo a documentos fuera de los permisos |
| **Medidas de mitigación existentes** | Expiración automática mediante DynamoDB TTL (5 minutos), la clave de caché incluye ID de usuario + ID de documento |
| **Recomendaciones adicionales** | Monitorización de la tasa de aciertos de caché, alerta por tasa de aciertos anormalmente alta, limpieza completa periódica de caché (diaria) |
| **Riesgo residual** | Bajo — Dado que el TTL es corto, incluso si se contamina, se recupera automáticamente en 5 minutos |

---

### T6: Agent Tool Abuse

| Elemento | Detalles |
|----------|----------|
| **Amenaza** | El Agent invoca herramientas no previstas, realizando modificación, eliminación o envío externo de datos |
| **Vector de ataque** | Prompt Injection → Alteración del plan de acción del Agent → Invocación de herramientas peligrosas |
| **Impacto** | Alto — Destrucción de datos, filtración de información, explosión de costes |
| **Medidas de mitigación existentes** | AgentCore Policy (restricción de acceso a herramientas), mínimo privilegio en roles IAM de Action Group, solo herramientas de solo lectura proporcionadas por defecto |
| **Recomendaciones adicionales** | Human Approval (aprobación antes de ejecutar acciones externas), límite de invocaciones de herramientas, configuración de límite de costes |
| **Riesgo residual** | Medio — Compromiso entre autonomía y seguridad del Agent. Si se restringe a solo lectura, el riesgo es bajo |

---

### T7: Audit Log Tampering

| Elemento | Detalles |
|----------|----------|
| **Amenaza** | Alteración o eliminación de registros de auditoría para ocultar evidencias de acceso no autorizado |
| **Vector de ataque** | Escalada de privilegios del rol de ejecución Lambda → Alteración de CloudWatch Logs / S3 |
| **Impacto** | Alto — Imposibilidad de investigación de incidentes, violación de cumplimiento normativo |
| **Medidas de mitigación existentes** | Política de retención de CloudWatch Logs, mínimo privilegio IAM |
| **Recomendaciones adicionales** | S3 Object Lock (WORM), almacenamiento de logs de CloudTrail en cuenta separada, verificación de integridad de logs (CloudTrail Digest) |
| **Riesgo residual** | Bajo — Con S3 Object Lock + almacenamiento en cuenta separada, la alteración es prácticamente imposible |

**Detalle**: Consulte [governance-and-audit.md](governance-and-audit.md)

---

### T8: Misconfigured Identity Federation

| Elemento | Detalles |
|----------|----------|
| **Amenaza** | Errores de configuración de OIDC / SAML / LDAP permiten que usuarios no autorizados pasen la autenticación, o se otorgan permisos excesivos a usuarios legítimos |
| **Vector de ataque** | Error de configuración del IdP → Emisión de token no autorizado → Paso de autenticación Cognito → Asignación excesiva de SID |
| **Impacto** | Alto — Escalada de privilegios, acceso a todos los documentos |
| **Medidas de mitigación existentes** | `authFailureMode=fail-closed` (bloqueo en caso de fallo en obtención de permisos), validación de token Cognito, health check LDAP |
| **Recomendaciones adicionales** | Auditoría periódica de configuración del IdP, validación automática de metadatos de federación, alerta por número anormal de SID de grupo |
| **Riesgo residual** | Medio — La configuración del IdP está fuera del control de este sistema. El impacto se limita con Fail-Closed |

---

### T9: Vector Metadata Leakage

| Elemento | Detalles |
|----------|----------|
| **Amenaza** | Los metadatos del vector store (información SID, rutas de archivos) se exponen involuntariamente, filtrando información sobre la estructura organizativa y permisos de acceso |
| **Vector de ataque** | Acceso directo a S3 Vectors / OpenSearch Serverless, retorno excesivo de información en respuestas API |
| **Impacto** | Medio — Inferencia de estructura organizativa, recopilación de información para ataques dirigidos |
| **Medidas de mitigación existentes** | Restricción de acceso mediante VPC endpoint, prevención de acceso directo mediante políticas IAM, exclusión de información SID de las respuestas API (frontend) |
| **Recomendaciones adicionales** | Mínimo privilegio en la política de bucket de S3 Vectors, auditoría de políticas de acceso a datos de OpenSearch Serverless, cifrado de metadatos |
| **Riesgo residual** | Bajo — Solo se permite acceso a través de Bedrock KB, el acceso directo se previene con IAM |

---

### T10: Denial of Wallet / Cost Abuse

| Elemento | Detalles |
|----------|----------|
| **Amenaza** | Mediante un gran volumen de solicitudes o uso intencional de modelos de alto coste, se provocan costes explosivos en AWS |
| **Vector de ataque** | Consultas masivas por usuarios autenticados, bucles infinitos en modo Agent, uso continuo de modelos de alto coste |
| **Impacto** | Alto — Facturación inesperadamente elevada |
| **Medidas de mitigación existentes** | WAF rate limit (2000 req/5min), Smart Routing (prioridad a modelos de bajo coste), límite de ejecución concurrente de Lambda |
| **Recomendaciones adicionales** | Alertas de AWS Budgets, límite diario de consultas por usuario, límite de pasos del Agent, considerar Bedrock Provisioned Throughput |
| **Riesgo residual** | Medio — Se mitiga con rate limit, pero el uso excesivo por usuarios legítimos no puede prevenirse completamente |

---

## Tabla de correspondencia amenazas → contramedidas

| Amenaza | WAF | Guardrails | SID Filter | Fail-Closed | IAM | KMS | Audit | AgentCore Policy |
|---------|-----|-----------|-----------|------------|-----|-----|-------|-----------------|
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

## Resumen de evaluación de riesgos

| Amenaza | Probabilidad | Impacto | Riesgo residual | Prioridad |
|---------|-------------|---------|----------------|-----------|
| T1: Prompt Injection | Alto | Medio | Medio | P1 |
| T2: Retrieval Poisoning | Bajo | Alto | Bajo | P2 |
| T3: Cross-User Leakage | Bajo | Alto | Bajo | P1 |
| T4: Stale ACL | Medio | Medio | Medio | P2 |
| T5: Over-Permissive Cache | Bajo | Alto | Bajo | P3 |
| T6: Agent Tool Abuse | Medio | Alto | Medio | P1 |
| T7: Audit Log Tampering | Bajo | Alto | Bajo | P2 |
| T8: Misconfigured IdP | Medio | Alto | Medio | P1 |
| T9: Metadata Leakage | Bajo | Medio | Bajo | P3 |
| T10: Cost Abuse | Medio | Medio | Medio | P2 |

---

## Contramedidas adicionales recomendadas (por prioridad)

### Respuesta inmediata (P1)

1. **Activación del filtro Prompt Attack de Guardrails** — Contramedida para T1
2. **Implementación de Human Approval para invocaciones de herramientas del Agent** — Contramedida para T6
3. **Establecimiento de proceso de auditoría periódica de configuración del IdP** — Contramedida para T8
4. **Incorporación de pruebas de matriz de permisos en CI/CD** — Contramedida para T3

### Respuesta a corto plazo (P2)

5. **Protección de registros de auditoría con S3 Object Lock** — Contramedida para T7
6. **Detección inmediata de eventos de cambio de ACL** — Contramedida para T4
7. **Validación de contenido al ingerir documentos** — Contramedida para T2
8. **AWS Budgets + límite de consultas por usuario** — Contramedida para T10

### Respuesta a medio plazo (P3)

9. **Detección de anomalías en la tasa de aciertos de caché** — Contramedida para T5
10. **Cifrado de metadatos del vector store** — Contramedida para T9

---

## Documentos relacionados

| Documento | Amenazas relacionadas |
|-----------|----------------------|
| [production-readiness-checklist.md](production-readiness-checklist.md) | Todas las amenazas (confirmación de contramedidas para producción) |
| [permission-consistency.md](permission-consistency.md) | T3, T4, T5 (consistencia de permisos) |
| [governance-and-audit.md](governance-and-audit.md) | T7, T8, T9 (auditoría y gobernanza) |
| [safe-experimentation-guide.md](safe-experimentation-guide.md) | T2, T10 (alcance seguro de experimentación) |
| [SID-Filtering-Architecture.md](SID-Filtering-Architecture.md) | T1, T3, T5 (diseño del filtrado SID) |
