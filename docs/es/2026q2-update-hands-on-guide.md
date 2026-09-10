# Guía práctica de la actualización de AI 2026 Q2

**🌐 Language:** [日本語](../2026q2-update-hands-on-guide.md) | [English](../en/2026q2-update-hands-on-guide.md) | [한국어](../ko/2026q2-update-hands-on-guide.md) | [简体中文](../zh-CN/2026q2-update-hands-on-guide.md) | [繁體中文](../zh-TW/2026q2-update-hands-on-guide.md) | [Français](../fr/2026q2-update-hands-on-guide.md) | [Deutsch](../de/2026q2-update-hands-on-guide.md) | **Español**

**Creado**: 2026-06-07  
**Duración**: unos 60 minutos  
**Público**: desarrolladores y partners que quieran probar las nuevas funciones

---

## Descripción general

Una guía práctica sobre las funciones añadidas en la actualización de AI 2026 Q2 (fases 0 a 5). Se habilitan una a una sobre un despliegue existente y se comprueba cada resultado.

---

## Requisitos previos

- un entorno Permission-aware RAG ya desplegado
- AWS CLI configurada
- Node.js 22+, npm

---

## Paso 1: comprobar la actualización de modelos (5 min)

Compruebe que los identificadores de modelo actualizados en la fase 0 se comportan como se espera.

```bash
# Configuración de modelos actual
grep -E "DEFAULT_CHAT_MODEL|FALLBACK_MODEL" docker/nextjs/src/config/model-defaults.ts

# Esperado:
# DEFAULT_CHAT_MODEL = 'anthropic.claude-sonnet-4-6'
# FALLBACK_MODEL_ID = 'amazon.nova-2-lite-v1:0'
```

Envíe una consulta desde la interfaz de chat y compruebe que `modelId` en los metadatos de la respuesta nombra el nuevo modelo.

---

## Paso 2: comprobar el efecto de la caché de prompts (10 min)

> **Requisito**: la caché de prompts solo funciona con modelos **Anthropic Claude**. En la configuración por defecto (sin modelo seleccionado, con repliegue a Nova 2 Lite) no se almacena nada. Antes de los pasos siguientes, elija **Claude Sonnet 4.6** o **Claude Opus 4.8** en el selector de modelo de la barra lateral.

Envíe consultas consecutivas dentro de una misma sesión y compruebe el acierto de caché.

```bash
# 1. Hacer una pregunta en la interfaz de chat
# 2. Hacer una segunda pregunta antes de 5 minutos
# 3. Comprobar en CloudWatch Logs:
aws logs filter-log-events \
  --log-group-name "/aws/lambda/${PREFIX}-webapp" \
  --filter-pattern '"Cache hit"' \
  --start-time $(date -d '5 minutes ago' +%s000) \
  --region ap-northeast-1

# Línea de log esperada:
# [Converse] Cache hit: 550/1200 input tokens cached (46%)
```

Comprobar la métrica de CloudWatch:
```bash
aws cloudwatch get-metric-statistics \
  --namespace "RAG/TokenUsage" \
  --metric-name "CachedInputTokens" \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum \
  --region ap-northeast-1
```

---

## Paso 3: Automated Reasoning Guardrails (15 min)

Provoque a propósito una violación de permisos y compruebe que Automated Reasoning la bloquea.

```bash
# 1. Desplegar con los guardrails habilitados
npx cdk deploy ${STACK_PREFIX}-AI -c enableGuardrails=true

# 2. Probar, desde la interfaz de chat, una consulta fuera de la frontera de permisos
#    ejemplo: preguntar por un documento solo para administradores con una cuenta normal
#    → comprobar que la respuesta indica que el contenido se restringió por la política de seguridad

# 3. Revisar el registro de intervención del guardrail
aws logs filter-log-events \
  --log-group-name "/aws/lambda/${PREFIX}-webapp" \
  --filter-pattern '"guardrailAction"' \
  --region ap-northeast-1
```

---

## Paso 4: AgentCore Gateway y el Permission Interceptor (15 min)

```bash
# 1. Desplegar con el Gateway habilitado
npx cdk deploy --all -c enableAgentCoreGateway=true

# 2. Obtener la URL del Gateway de las salidas del stack
aws cloudformation describe-stacks \
  --stack-name ${STACK_PREFIX}-AI \
  --query 'Stacks[0].Outputs[?OutputKey==`AgentCoreGatewayUrl`].OutputValue' \
  --output text

# 3. Revisar los logs de la Lambda Interceptor
aws logs tail "/aws/lambda/${PREFIX}-permission-interceptor" --follow --region ap-northeast-1
```

---

## Paso 5: citas y la frontera de permisos (10 min)

Envíe una consulta desde la interfaz de chat y examine las citas de la respuesta.

```bash
# Comprobar el campo citations de la respuesta de la API
curl -s -X POST "${APP_URL}/api/bedrock/kb/retrieve" \
  -H 'content-type: application/json' \
  -d '{"query":"Háblame del informe de ventas","userId":"user@example.com","knowledgeBaseId":"'${KB_ID}'"}' \
  | python3 -m json.tool

# Esperado:
# "citations": [{ "boundaryType": "verified", "permissionVerified": true, ... }]
```

---

## Paso 6: Graph RAG (opcional, 5 min)

```bash
# 1. Desplegar con Graph RAG habilitado (arrancar Neptune Analytics tarda ~10 min)
npx cdk deploy --all -c enableGraphRAG=true

# 2. Comprobar el endpoint de Neptune Analytics
aws neptune-graph list-graphs --region ap-northeast-1

# 3. Consulta de prueba al grafo (a través de la Lambda)
# construir el grafo de relaciones entre documentos requiere un script aparte
```

---

## Limpieza

Deshabilite las nuevas funciones para ahorrar coste:

```bash
# Deshabilitar Graph RAG (detiene Neptune Analytics)
npx cdk deploy --all -c enableGraphRAG=false

# Deshabilitar el Gateway
npx cdk deploy --all -c enableAgentCoreGateway=false

# Deshabilitar los guardrails
npx cdk deploy ${STACK_PREFIX}-AI -c enableGuardrails=false
```

---

## Documentos relacionados

- [Guía de selección de la estrategia de fragmentación](chunking-strategy-guide.md)
- [Hoja de cálculo de estimación de costes](cost-estimation-worksheet.md)
- [Lista de comprobación para producción](production-readiness-checklist.md)
