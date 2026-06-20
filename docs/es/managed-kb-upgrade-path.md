# Ruta de actualización a Amazon Bedrock Managed Knowledge Base (procedimientos de validación)

**🌐 Language:** [日本語](../managed-kb-upgrade-path.md) | [English](../en/managed-kb-upgrade-path.md) | [한국어](../ko/managed-kb-upgrade-path.md) | [简体中文](../zh-CN/managed-kb-upgrade-path.md) | [繁體中文](../zh-TW/managed-kb-upgrade-path.md) | [Français](../fr/managed-kb-upgrade-path.md) | [Deutsch](../de/managed-kb-upgrade-path.md) | **Español**

**Fecha de creación**: 2026-06-18
**Región objetivo**: ap-northeast-1 (Tokio) — Managed KB está disponible en la región de Tokio (GA 2026-06-17)
**Estado**: Documento de procedimiento de validación (migración no implementada / ruta existente conservada)
**Relacionado**: [Evaluación de migración de Managed KB](managed-kb-migration-evaluation.md) (criterios de decisión / compensaciones)

---

## 0. Propósito de este documento

Este documento traduce los puntos de verificación organizados en la [Evaluación de migración de Managed KB](managed-kb-migration-evaluation.md) en **procedimientos de validación accionables**. Consulte el documento de evaluación de migración para la discusión de criterios de decisión y compensaciones; este documento se centra en "cómo validar".

Supuestos importantes:

- Este documento es una **guía de procedimientos de validación** y no recomienda una migración inmediata.
- La ruta existente (Bedrock KB + OpenSearch Serverless / S3 Vectors) **no se elimina**. Esta es una validación adicional de una opción paralela.
- Managed KB no es "superior" al KB convencional. Es una elección de **la herramienta adecuada para la tarea**; si puede cumplir el requisito principal de este proyecto, el Permission-aware RAG (aplicación estricta de ACL), determina la viabilidad de la migración.
- Los niveles de evidencia del contenido a continuación se clasifican de la siguiente manera.

| Nivel | Definición | Tratamiento en este documento |
|-------|-----------|-------------------------------|
| Public evidence | Verificable desde la documentación/blogs oficiales de AWS | Citado con enlaces a las fuentes |
| Project-context expectation | Decisiones/expectativas de diseño dentro de este proyecto (no verificables públicamente) | Etiquetado explícitamente "supuesto del proyecto" |

> ⚠️ **Validation Required**: Los procedimientos de este documento incluyen el **supuesto** de que el tutorial oficial de AWS ([para KB convencional](https://docs.aws.amazon.com/fsx/latest/ONTAPGuide/tutorial-build-rag-with-bedrock.html)) se reinterpreta para Managed KB. Si el conector S3 de Managed KB reconoce el FSx for ONTAP S3 Access Point no está confirmado oficialmente, y la validación V1 debe verificar esto primero.

---

## 1. Resumen de la validación

La validación para la decisión de viabilidad de la migración consta de las siguientes 3 fases. Cada fase supone el éxito de la anterior.

```
Phase A: Validación de conexión (V1, V2)
  └─ ¿Puede usarse S3 AP como fuente de datos / se conservan los metadatos?
       │ PASS
       ▼
Phase B: Validación de autorización (V3, V4, V5)
  └─ ¿Funciona el filtro ACL / se mantiene a través de multi-hop / latencia de propagación?
       │ PASS
       ▼
Phase C: Validación de auditoría y operaciones (V6, V7)
  └─ registro de lineage / ACL en historial de conversación y caché
       │ PASS
       ▼
Decisión de viabilidad de la migración (→ doc de evaluación de migración §5)
```

> Cada fase se realiza contra un **volumen de validación creado con FlexClone, no contra datos de producción** (ver §4).

---

## 2. Phase A: Validación de conexión de la fuente de datos S3 Access Point

### 2.1 Validación V1: ¿reconoce el conector S3 la URI de S3 AP?

⚠️ **Validation Required**: El tutorial oficial es para el KB convencional, y si el conector S3 de Managed KB acepta la URI en formato alias de S3 AP no está confirmado.

**Requisitos previos**:

1. Crear un volumen de validación con FlexClone (procedimiento en §4)
2. Crear un S3 Access Point para el volumen de validación (consultar la lógica del `setup-kb-datasource.sh` existente)
3. Confirmar el alias de S3 AP (formato: `<alias>-<suffix>.s3-accesspoint.<region>.amazonaws.com` o ARN)

**Procedimiento de validación**:

```bash
# 1. Crear un Managed KB (almacenamiento vectorial gestionado)
#    ⚠️ Lo siguiente es un comando supuesto. Verifique los parámetros exactos de la API de Managed KB en la documentación de GA
aws bedrock-agent create-knowledge-base \
  --name "managed-kb-validation" \
  --region ap-northeast-1 \
  --knowledge-base-configuration '{...managed configuration...}' \
  # ⚠️ La forma de especificar el almacenamiento gestionado necesita confirmación

# 2. Agregar el conector S3 como fuente de datos y especificar la URI de S3 AP
#    Núcleo de la validación: si se acepta el formato alias / ARN de S3 AP
aws bedrock-agent create-data-source \
  --knowledge-base-id "<KB_ID>" \
  --data-source-configuration '{
    "type": "S3",
    "s3Configuration": {
      "bucketArn": "<S3_AP_ARN>"  # ⚠️ Si esto se acepta es la esencia de V1
    }
  }'
```

**Criterios de juicio**:

| Resultado | Juicio | Acción siguiente |
|-----------|--------|------------------|
| ARN/alias de S3 AP aceptado, sincronización exitosa | ✅ PASS | Pasar a V2 |
| S3 AP no es posible pero un bucket S3 normal funciona | △ Condicional | Considerar una ruta de relé S3 basada en DataSync (se necesita validación adicional para la preservación de metadatos ACL) |
| La sincronización del conector S3 en sí falla | ❌ FAIL | Migración no viable. Conservar la configuración actual |

> **Supuesto del proyecto**: Asumimos que la conexión es posible si la API compatible con S3 funciona, pero las restricciones específicas de S3 AP (como la latencia de ListObjectsV2 señalada en la [matriz de compatibilidad de FSx for ONTAP S3 AP](https://github.com/Yoshiki0705/fsxn-lakehouse-integrations/blob/main/docs/en/compatibility-matrix.md)) pueden afectar al crawler de Managed KB.

### 2.2 Validación V2: preservación de metadatos

**Procedimiento de validación**:

1. Colocar `.metadata.json` (que contiene `allowed_group_sids`) en el volumen de validación
2. Ejecutar la sincronización de Managed KB
3. Recuperar un documento vía la API `Retrieve` y comprobar si los metadatos están incluidos en la respuesta

```bash
aws bedrock-agent-runtime retrieve \
  --knowledge-base-id "<KB_ID>" \
  --retrieval-query '{"text": "consulta de prueba"}' \
  --region ap-northeast-1
# Comprobar si el campo metadata de la respuesta incluye allowed_group_sids
```

**Criterios de juicio**:

| Resultado | Juicio |
|-----------|--------|
| `allowed_group_sids` se conserva como metadato y es recuperable | ✅ PASS → Pasar a Phase B |
| Los metadatos faltan o se convierten a otro formato | ❌ FAIL → Filtro ACL imposible. Conservar la configuración actual |

> ⚠️ Cómo maneja los metadatos el Smart Parsing de Managed KB no está confirmado. Verifique si el enfoque sidecar de `.metadata.json` funciona igual que en el KB convencional, o si se requiere otro método de atribución de metadatos (atributos del conector, etc.).

---

## 3. Phase B: Validación del desafío de diseño del Permission-aware RAG

El propósito principal de este proyecto es Permission-aware RAG, y la aplicación estricta de ACL es un requisito no negociable. A menos que se supere la validación de la Phase B, conservar la configuración actual sigue siendo la política por defecto.

### 3.1 Invariante con el enfoque existente

La implementación actual usa un [enfoque independiente del vector store](s3-vectors-sid-architecture-guide.md).

```
Bedrock KB Retrieve → resultados de búsqueda + allowed_group_sids
→ Lado de la aplicación (route.ts) coincide SID usuario ∩ SID documento (Fail-Closed)
→ Solo los documentos coincidentes van a la API Converse
```

**Invariante a mantener durante la migración**: "Imponer la autorización final del lado de la aplicación, y denegar todo si la recuperación del SID es imposible (Fail-Closed)." Verifique que Managed KB no rompa este invariante.

### 3.2 Validación V3: coincidencia de array SID vía `listContains`

Según la [documentación del connector target de AgentCore Gateway](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/gateway-target-connector-managed-kb.html), la herramienta `Retrieve` de Managed KB admite el operador `listContains` en `managedSearchConfiguration.filter` (resumido de la fuente).

**Procedimiento de validación**:

```bash
# Recuperar solo documentos donde el SID del usuario está en el array allowed_group_sids
aws bedrock-agent-runtime retrieve \
  --knowledge-base-id "<KB_ID>" \
  --retrieval-query '{"text": "prueba de documento confidencial"}' \
  --retrieval-configuration '{
    "vectorSearchConfiguration": {
      "filter": {
        "listContains": {
          "key": "allowed_group_sids",
          "value": "<USER_SID>"
        }
      }
    }
  }' \
  --region ap-northeast-1
```

**Criterios de juicio**:

| Caso de prueba | Resultado esperado |
|----------------|--------------------|
| Documento donde el SID del usuario está en el array | Recuperado |
| Documento donde el SID del usuario no está en el array | Excluido |
| Documento sin `allowed_group_sids` | Excluido (Fail-Closed) |

> ⚠️ **Importante**: Aunque `listContains` filtre en la capa de recuperación, el principio de diseño de este proyecto es la **reautorización del lado de la aplicación**. Recomendamos una defensa de dos capas que use el filtro de Managed KB como "filtro primario" mientras mantiene la autorización final del lado de la aplicación (no depender solo del filtro).

### 3.3 Validación V4: mantenimiento del filtro durante el multi-hop de Agentic Retrieval

Este es el mayor riesgo específico de Managed KB. `AgenticRetrieveStream` descompone una consulta en subconsultas e itera varias búsquedas. **Si el filtro de metadatos no se mantiene en cada hop, datos no autorizados pueden mezclarse en un paso intermedio.**

**Procedimiento de validación**:

1. Preparar una consulta compleja que requiera abarcar varios documentos con permisos diferentes (p. ej., "Comparar el documento de diseño confidencial del Departamento A con la especificación pública")
2. Ejecutar `AgenticRetrieveStream` como un usuario que no puede acceder al documento no autorizado (confidencial del Departamento A)
3. Inspeccionar la traza de cada hop (CloudWatch / pasos intermedios en la respuesta) y verificar que el documento no autorizado **no se referencia en ningún hop**

**Criterios de juicio**:

| Resultado | Juicio |
|-----------|--------|
| `userContext` / filtro aplicado en todos los hops, ningún dato no autorizado referenciado | ✅ PASS |
| El filtro se pierde en un hop intermedio y datos no autorizados se mezclan | ❌ FAIL → Deshabilitar multi-hop, usar solo un `Retrieve` único |

> ⚠️ **Validation Required**: La propagación del filtro a cada paso multi-hop no está documentada oficialmente. Si no puede confirmarse en la validación, restringir a un solo `Retrieve` + coincidencia del lado de la aplicación sin usar `AgenticRetrieveStream` (priorizar las garantías de ACL incluso a costa de renunciar al beneficio del multi-hop).

### 3.4 Validación V5: latencia de propagación de cambios / eliminaciones de permisos

**Procedimiento de validación**:

1. Eliminar el SID de un usuario de un grupo (o cambiar el `allowed_group_sids` de un documento)
2. Tras completar la sincronización de Managed KB, volver a buscar como ese usuario
3. Medir la latencia hasta que los datos con el permiso antiguo dejen de devolverse

**Criterios de juicio**: Si la latencia de propagación está dentro del rango aceptable definido en el [modelo de consistencia de permisos](permission-consistency.md) de este proyecto. Si está fuera de rango, el diseño debe garantizar por separado la revocación de emergencia vía la invalidación de caché del lado de la aplicación.

---

## 4. Patrón de validación segura con FlexClone

Los datos de producción nunca deben convertirse en un objetivo de crawl directo de Managed KB. Cree un volumen de validación equivalente a producción con FlexClone y valide en un entorno aislado.

### 4.1 Por qué FlexClone

| Aspecto | Acceso directo a producción | Validación FlexClone |
|---------|------------------------------|----------------------|
| Impacto en E/S de producción | La carga de crawl afecta a las cargas de trabajo de negocio | Sin impacto (el clon es independiente) |
| Consistencia de datos | Posible inconsistencia por actualizaciones durante el crawl | Consistente en un punto en el tiempo |
| Reproducibilidad de la validación | Difícil de reproducir por cambios en datos de producción | Reproducible cualquier número de veces desde el mismo snapshot |
| Riesgo de accidentes | Riesgo de escrituras erróneas en datos de producción | El clon es desechable |
| Costo | — | Solo delta de snapshot (inicialmente unos pocos MB) |

### 4.2 Procedimiento de creación del clon de validación

```bash
# 1. Crear un snapshot del volumen de producción (ONTAP REST API / CLI)
#    ⚠️ Acceder al endpoint de gestión de ONTAP desde dentro del VPC
curl -X POST "https://<ontap-mgmt-ip>/api/storage/volumes/<volume-uuid>/snapshots" \
  -u "<user>:<pass>" \
  -d '{"name": "managed-kb-validation-snap"}'

# 2. Crear un FlexClone a partir del snapshot
curl -X POST "https://<ontap-mgmt-ip>/api/storage/volumes" \
  -u "<user>:<pass>" \
  -d '{
    "name": "managed_kb_validation_clone",
    "clone": {
      "parent_volume": {"name": "<prod-volume-name>"},
      "parent_snapshot": {"name": "managed-kb-validation-snap"},
      "is_flexclone": true
    },
    "svm": {"name": "<svm-name>"}
  }'

# 3. Crear un S3 Access Point para el volumen clonado
#    (Reutilizar la lógica del setup-kb-datasource.sh existente para la validación)

# 4. Tras completar la validación, destruir el clon (sin impacto en producción)
curl -X DELETE "https://<ontap-mgmt-ip>/api/storage/volumes/<clone-uuid>" \
  -u "<user>:<pass>"
```

> Para los parámetros exactos de la API REST de ONTAP, consulte la sección de operaciones de ONTAP del [Runbook de operaciones](operations-runbook.md). Siga los procedimientos de producción para la información de clave SSH / endpoint de gestión.

### 4.3 Principios de aislamiento del entorno de validación

- Crear el Managed KB de validación como un **recurso separado** del KB de producción; no cambiar el KB ID de producción
- El S3 AP de validación apunta solo al clon de validación (no referencia el volumen de producción)
- Acotar el rol IAM de validación con el **mínimo privilegio** a los recursos de validación (no otorgar acceso de lectura a datos de producción)
- Tras completar la validación, destruir todo el clon / KB / S3 AP / rol IAM

---

## 5. Validación de auditoría y lineage (Phase C / Opcional)

⚠️ **Validation Required**: Si el acceso vía Managed KB se registra en el lineage de Unity Catalog del objetivo de integración ([fsxn-lakehouse-integrations](https://github.com/Yoshiki0705/fsxn-lakehouse-integrations)) no está confirmado.

**Aspectos de validación**:

- Si las llamadas `Retrieve` / `AgenticRetrieveStream` de Managed KB se registran en CloudTrail
- Si "quién, cuándo, usó información de qué documento, en qué respuesta" es rastreable
- Si la aplicación de ACL al historial de conversación / caché se mantiene del lado de la aplicación (dado que el comportamiento de la caché del lado gestionado es desconocido, controlarlo explícitamente del lado de la aplicación)

Para los detalles de los requisitos de auditoría, vea [Diseño de gobernanza y auditoría](governance-and-audit.md).

---

## 6. Lista de verificación (resumen)

Supere todos los siguientes elementos antes de la decisión de viabilidad de la migración.

- [ ] **V1**: El conector S3 reconoce FSx for ONTAP S3 AP (Phase A)
- [ ] **V2**: `allowed_group_sids` se conserva como metadato (Phase A)
- [ ] **V3**: La coincidencia de array SID vía `listContains` funciona (Phase B)
- [ ] **V4**: El filtro se mantiene durante el multi-hop de Agentic Retrieval (Phase B)
- [ ] **V5**: La latencia de propagación de cambios / eliminaciones de permisos está dentro del rango aceptable (Phase B)
- [ ] **V6**: Registrado en CloudTrail / lineage (Phase C)
- [ ] **V7**: La aplicación de ACL al historial de conversación / caché se mantiene (Phase C)
- [ ] Toda la validación realizada en un **volumen de validación FlexClone** (sin impacto en producción)
- [ ] El invariante de reautorización Fail-Closed del lado de la aplicación se mantiene

> Si algún elemento FALLA, a menos que exista un complemento de diseño que pueda tolerar ese riesgo, **conservar la configuración actual (OpenSearch Serverless / S3 Vectors)** sigue siendo la política por defecto. La integración de Managed KB en el stack CDK comienza solo después de que se supere toda la validación.

---

## 7. Documentos relacionados

| Documento | Contenido |
|-----------|-----------|
| [Evaluación de migración de Managed KB](managed-kb-migration-evaluation.md) | Criterios de decisión / compensaciones / comparación de configuración existente |
| [Guía de arquitectura de stack CDK](stack-architecture-comparison.md) | Comparación de configuraciones de almacén vectorial (incl. columna Managed KB) |
| [SID-Filtering-Architecture.md](SID-Filtering-Architecture.md) | Diseño del filtrado SID |
| [s3-vectors-sid-architecture-guide.md](s3-vectors-sid-architecture-guide.md) | Enfoque de autorización independiente del vector store |
| [Modelo de consistencia de permisos](permission-consistency.md) | Flujo de propagación de cambios ACL / latencia aceptable |
| [Diseño de gobernanza y auditoría](governance-and-audit.md) | Requisitos de registro de auditoría / lineage |
| [Runbook de operaciones](operations-runbook.md) | Operaciones ONTAP (procedimiento de creación FlexClone) |

---

## Enlaces de referencia

- [Anuncio de GA de Amazon Bedrock Managed Knowledge Base](https://aws.amazon.com/about-aws/whats-new/2026/06/amazon-bedrock-managed-knowledge-base/)
- [Tutorial oficial de AWS (KB convencional)](https://docs.aws.amazon.com/fsx/latest/ONTAPGuide/tutorial-build-rag-with-bedrock.html)
- [Connector target de AgentCore Gateway (Managed KB)](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/gateway-target-connector-managed-kb.html)

> El contenido se reformuló para cumplir con las restricciones de licencia. La información oficial de AWS se resume y parafrasea preservando la intención de las fuentes.
