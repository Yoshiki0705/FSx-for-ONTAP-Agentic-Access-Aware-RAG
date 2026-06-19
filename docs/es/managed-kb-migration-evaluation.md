# Evaluación de la ruta de migración a Amazon Bedrock Managed Knowledge Base

**🌐 Language:** [日本語](../managed-kb-migration-evaluation.md) | [English](../en/managed-kb-migration-evaluation.md) | [한국어](../ko/managed-kb-migration-evaluation.md) | [简体中文](../zh-CN/managed-kb-migration-evaluation.md) | [繁體中文](../zh-TW/managed-kb-migration-evaluation.md) | [Français](../fr/managed-kb-migration-evaluation.md) | [Deutsch](../de/managed-kb-migration-evaluation.md) | **Español**

**Fecha de creación**: 2026-06-18
**Región objetivo**: ap-northeast-1 (Tokio) — Managed KB está disponible en la región de Tokio
**Estado**: Documento de evaluación (migración no realizada / ruta existente conservada)
**Relacionado**: `fsxn-lakehouse-integrations/docs/ja/cross-repo-integration-strategy.md` (origen)

---

## 0. Propósito de este documento

Este documento evalúa la **ruta de migración** para actualizar la configuración Permission-aware RAG existente de este repositorio (Bedrock KB + OpenSearch Serverless / S3 Vectors) a [Amazon Bedrock Managed Knowledge Base](https://aws.amazon.com/about-aws/whats-new/2026/06/amazon-bedrock-managed-knowledge-base/), que pasó a estar disponible de forma general (GA) en el AWS Summit New York 2026 (2026-06-17).

Supuestos clave:

- Este es un **documento de evaluación**; no recomienda una migración inmediata.
- La ruta existente (Bedrock KB + OpenSearch Serverless / S3 Vectors) **no se elimina**.
- El contenido se clasifica en dos niveles de evidencia.

| Nivel | Definición | Tratamiento en este documento |
|-------|-----------|-------------------------------|
| Public evidence | Verificable desde la documentación/blogs oficiales de AWS | Citado con enlaces a las fuentes |
| Project-context expectation | Decisiones/expectativas de diseño dentro de este proyecto (no verificables públicamente) | Etiquetado como "supuesto del proyecto" |

> ⚠️ **Distinction discipline**: Separamos claramente la "descripción general de una función" del "comportamiento verificado en este proyecto". Las descripciones de funciones de Managed KB son explicaciones generales basadas en información pública de AWS; el comportamiento de integración de ACL en este proyecto está **sin verificar** (ver puntos de verificación a continuación).

---

## 1. Funciones principales de Managed KB (Public evidence)

Basado en el [blog Introducing Amazon Bedrock Managed Knowledge Base](https://aws.amazon.com/blogs/aws/introducing-amazon-bedrock-managed-knowledge-base-for-faster-more-accurate-enterprise-ai-applications/) y el [anuncio de GA](https://aws.amazon.com/about-aws/whats-new/2026/06/amazon-bedrock-managed-knowledge-base/). El contenido se reformuló para cumplir con las restricciones de licencia preservando la intención de la fuente.

| Función | Resumen | Relevancia para este proyecto |
|---------|---------|-------------------------------|
| 6 conectores de datos nativos | Amazon S3 / SharePoint / Confluence / Google Drive / OneDrive / Web Crawler. Ingiere datos y permisos automáticamente | La pregunta clave es si el **conector S3** puede conectarse al FSx for ONTAP S3 Access Point |
| Smart Parsing | Selecciona automáticamente la estrategia de parsing óptima por tipo de datos y conector (PDF, Office, tablas, multimodal) | Podría automatizar la selección manual de estrategia de chunking existente |
| Agentic Retriever | Descompone consultas complejas en subconsultas y ejecuta recuperación multi-hop iterativa | Requiere reautorización en el contexto Permission-aware (ver abajo) |
| Almacenamiento vectorial gestionado | Sin aprovisionamiento de DB vectorial. Optimizado en precio/rendimiento | Elimina la carga operativa de OpenSearch Serverless / S3 Vectors |
| Integración con AgentCore Gateway | Expuesto como connector target integrado (MCP) con dos herramientas: `Retrieve` y `AgenticRetrieveStream` | Integrable con el AgentCore Gateway de este proyecto (ya implementado) |
| Compatibilidad de API existente | `Retrieve` / `StartIngest` / `IngestKnowledgeBaseDocuments` etc. son iguales | Solo cambio de KB ID, sin cambio de código (afirmación de AWS, por verificar) |
| Regiones | GA en varias regiones incluida Tokio | Coherente con el despliegue ap-northeast-1 |

### Modelo de precios (Public evidence)

Según la [descripción de AWS](https://aws.amazon.com/blogs/aws/introducing-amazon-bedrock-managed-knowledge-base-for-faster-more-accurate-enterprise-ai-applications/), la facturación tiene dos dimensiones (tamaño de datos indexados + número de recuperaciones bajo demanda). Sin compromiso inicial.

> ⚠️ **Nota sobre la estimación de costos**: Lo anterior es la estructura del modelo de precios publicado; el costo real para la carga de trabajo de este proyecto no está medido. Antes de cualquier decisión de migración, realice una comparación de costos unitarios entre "el actual (OpenSearch Serverless OCU / almacenamiento S3 Vectors)" y "Managed KB (tamaño de datos + número de recuperaciones)" usando los volúmenes de consultas y datos esperados.

---

## 2. Comparación con la configuración existente

### 2.1 Comparación de arquitectura

| Aspecto | Actual (Custom: Bedrock KB + OpenSearch Serverless / S3 Vectors) | Managed KB |
|---------|-------------------------------------------------------------------|------------|
| Operación del vector store | Autogestionado (diseño OCU de AOSS / gestión de index de S3 Vectors) | Totalmente gestionado (sin aprovisionamiento) |
| Fuente de datos | FSx ONTAP → S3 AP → Bedrock KB (`setup-kb-datasource.sh`) | Vía conector S3 (conexión S3 AP por verificar) |
| Parsing y chunking | Selección manual vía `kbChunkingStrategy` (FIXED/HIERARCHICAL/SEMANTIC/NONE) | Smart Parsing selecciona automáticamente (personalizable) |
| Modelo de embedding | Fijado en el despliegue (`embeddingModel`, el cambio requiere recreación) | Auto-seleccionado por defecto + modelo Bedrock opcional |
| Recuperación | Retrieve único + filtro SID del lado de la aplicación | `Retrieve` (híbrido único) + `AgenticRetrieveStream` (multi-hop) |
| Filtro ACL | Coincidencia `allowed_group_sids` del lado de la aplicación (independiente del vector store) | Operadores `filter` de metadatos + `userContext` (por verificar) |
| Integración Gateway | Personalizada (AgentCore Gateway + Permission Interceptor implementados) | Connector target integrado |
| Carga operativa | Media (requiere diseño de vector store / pipeline) | Baja (gestionado) |
| Personalización | Alta (todos los componentes controlables) | Media (ajustable dentro del alcance gestionado) |

### 2.2 Enfoque de filtrado SID existente (Project-context)

Según [SID-Filtering-Architecture.md](SID-Filtering-Architecture.md) / [s3-vectors-sid-architecture-guide.md](s3-vectors-sid-architecture-guide.md), este proyecto usa el siguiente enfoque independiente del vector store.

```
Bedrock KB Retrieve API → resultados de búsqueda + metadatos(allowed_group_sids)
→ lado de la aplicación (route.ts) coincide SID usuario ∩ SID documento
→ solo los documentos coincidentes van a Converse API
→ Fail-Closed: denegar todo si falla la recuperación del SID
```

La fortaleza de este enfoque es que **la lógica de autorización del lado de la aplicación permanece sin cambios** aunque cambie el vector store (AOSS / S3 Vectors). El punto más crítico es si este invariante puede preservarse tras migrar a Managed KB.

---

## 3. Criterios de decisión de migración

Enmarcado como "la herramienta adecuada para la tarea", no "reemplazar a un competidor". Las compensaciones de ambas configuraciones se exponen simétricamente.

### 3.1 Cuándo considerar migrar a Managed KB

- Quiere **reducir la carga operativa/de diseño** del vector store (OpenSearch Serverless OCU / index de S3 Vectors)
- Quiere aprovechar Smart Parsing para el **parsing automático de documentos multi-formato** (PDF, Office, tablas)
- Busca mejoras de precisión para **consultas complejas multi-hop** vía Agentic Retriever
- Quiere **adoptar nuevos modelos de embedding/re-ranking sin reconstruir la infraestructura**
- Quiere integrar en una arquitectura centrada en AgentCore Gateway y **simplificar la conexión vía un connector target integrado**

### 3.2 Cuándo conservar la configuración actual

- Tiene un **requisito de aplicar estrictamente ACL a nivel de archivo (NTFS / SID) en el momento de la recuperación** y quiere control total del comportamiento de coincidencia `allowed_group_sids`
- Tiene **lógica personalizada para el reflejo inmediato** de cambios de permisos, eliminaciones y renombrados (si la sincronización gestionada puede igualarlo está sin verificar)
- Quiere **control fino del filter / ranking / reranking del vector store**
- No quiere comprometer las garantías Fail-Closed de producción mientras **la retención/filtrado de metadatos ACL en el almacenamiento gestionado está sin verificar**
- Los requisitos de soberanía de datos o auditoría exigen **gestionar explícitamente dónde se almacenan los datos vectoriales**

### 3.3 Flujo de decisión

```
¿Necesita aplicar estrictamente ACL en el momento de la recuperación?
├─ SÍ → ¿Puede superar todos los puntos de verificación del §4?
│        ├─ SÍ → Considerar migración por fases (§5)
│        └─ NO → Conservar la configuración actual (priorizar la garantía ACL)
└─ NO → Priorizar carga operativa / precisión; considerar Managed KB
```

> ⚠️ El propósito principal de este proyecto es **Permission-aware RAG**, y la aplicación estricta de ACL es un requisito no negociable. Por lo tanto, a menos que se supere la verificación del §4, conservar la configuración actual es la política por defecto.

---

## 4. Impacto en Permission-aware RAG (lo más crítico)

¿Puede preservarse el filtro ACL basado en SID de este proyecto con el almacenamiento gestionado de Managed KB? Organizamos la evidencia pública y los puntos de verificación.

### 4.1 Public evidence: métodos de control de acceso de Managed KB

Según la [documentación del connector target de AgentCore Gateway](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/gateway-target-connector-managed-kb.html), Managed KB tiene dos métodos de control de acceso.

**(A) Operadores `filter` de metadatos (herramienta `Retrieve`)**

`managedSearchConfiguration.filter` admite estos operadores (resumiendo la intención de la fuente):
`equals`, `notEquals`, `greaterThan`, `greaterThanOrEquals`, `lessThan`, `lessThanOrEquals`, `in`, `notIn`, `startsWith`, `listContains`, `stringContains`, `andAll`, `orAll`

→ **`listContains` podría ser usable para coincidir un SID de usuario con `allowed_group_sids` (un array)**. Esto podría empujar la coincidencia actual del lado de la aplicación hacia la capa de recuperación.

**(B) Filtrado de control de acceso vía `userContext`**

Según la documentación, cuando un KB aplica control de acceso por usuario/grupo, la aplicación que llama incluye `userContext` (p. ej. `userId`) en la solicitud. El Gateway lo pasa al KB, que aplica el filtrado según `userContext`. Crítico: **el Gateway no rellena `userContext` a partir de la identidad IAM del llamante — la aplicación debe proporcionarlo explícitamente**. También se indica explícitamente que **`userContext` lo proporciona la aplicación, no el modelo**.

→ Este diseño "la aplicación lo proporciona explícitamente" / "no se deja al modelo" se alinea direccionalmente con el principio **Fail-Closed, impuesto por la aplicación** de este proyecto.

### 4.2 Puntos de verificación (confirmar antes de la migración)

Todos los siguientes están **sin verificar** y determinan la viabilidad de la migración. Los supuestos Project-context se indican al lado.

| # | Elemento de verificación | Supuesto del proyecto | Riesgo |
|---|--------------------------|----------------------|--------|
| V1 | ¿Puede el conector S3 usar el **FSx ONTAP S3 Access Point** como fuente de datos (formato alias, frontera IAM)? | Se asume conectable si es compatible con S3 | Si no es conectable, la migración es inviable |
| V2 | ¿Se **conserva como metadato** el `allowed_group_sids` de `.metadata.json` en el índice de Managed KB? | Se asume conservado | Si no se conserva, el filtro ACL es imposible |
| V3 | ¿Funciona el `filter` de `Retrieve` para la **coincidencia de array SID vía `listContains`**? | Se asume funcional | Si no, cambiar al método userContext |
| V4 | ¿Es válido el método `userContext` para **datos ingeridos por conector S3** (no solo conectores SaaS)? | Desconocido si es válido para S3 | Si es inválido para S3, depende del método filter |
| V5 | ¿Se aplica ACL en **cada paso de `AgenticRetrieveStream` (multi-hop)**? | Se requiere aplicación por paso | Riesgo de que datos no autorizados entren en pasos intermedios |
| V6 | ¿Es aceptable la **latencia de reflejo de cambios/eliminaciones/renombrados de permisos** en el almacenamiento gestionado? | Se espera la misma inmediatez que el actual | Riesgo de datos con permisos obsoletos por retraso de reflejo |
| V7 | ¿Se mantiene la **aplicación de ACL para el historial de conversación/caché**? | Mantenida del lado de la aplicación | Comportamiento de la caché del lado gestionado desconocido |

> ⚠️ **No negociable**: Si V2, V3 (o V4) o V5 no se cumple, la migración es **BLOCKED** porque **datos no autorizados podrían entrar en los resultados de búsqueda**. Esto violaría los requisitos no negociables de la revisión de arquitectura FSxN AI/RAG ("un diseño donde datos no autorizados pueden entrar en los resultados de vector search", "un diseño sin verificación de autorización del contexto pasado al LLM").

### 4.3 Mantenimiento de la defensa en profundidad

Incluso al migrar, mantenga la defensa en profundidad sin depender de un único método.

```
1. Autenticación de usuario vía IdP / Cognito / AD
2. Recuperar el principal del usuario / SID de grupo (DynamoDB user-access)
3. filter (listContains) o userContext en el momento de la recuperación de Managed KB
4. ★ Recoincidencia ACL del lado de la aplicación justo antes de la inyección del contexto LLM (conservar la lógica route.ts actual) ★
5. Reautorización después de cada paso al usar AgenticRetrieveStream
6. Reautorización al mostrar enlaces de fuente de cita
7. Registro de auditoría (quién usó qué información derivada de un SID, y cuándo)
```

→ Incluso al usar el filtrado del lado de Managed KB, **recomendamos encarecidamente conservar el paso 4 (coincidencia ACL final del lado de la aplicación)**. Esto garantiza Fail-Closed incluso si el filtro del lado gestionado se comporta de forma diferente a lo esperado.

---

## 5. Ruta de migración (por fases / ruta existente conservada)

Como el patrón de migración Dual KB existente ([migration-guide-multimodal.md](../en/migration-guide-multimodal.md)), verifique por etapas con **operación en paralelo**. La ruta existente no se elimina.

### Phase 0: Verificación PoC (sin impacto en producción)

1. Crear un Managed KB con un pequeño conjunto de datos de verificación (se recomiendan datos consistentes desde Snapshot / FlexClone)
2. Verificar V1–V7 del §4.2 en orden
3. Confirmar el comportamiento del filtrado SID (filter / userContext) frente a los 31 escenarios de [tests/permission-matrix/](../../tests/permission-matrix/)

### Phase 1: Operación en paralelo (Shadow)

1. Conservar el KB existente y ejecutar el Managed KB como **shadow de solo lectura** en paralelo
2. Enviar consultas idénticas a ambos sistemas y comparar resultados de búsqueda, resultados del filtro ACL y consistencia de citas
3. Comparar precisión y citation precision con RAGAS etc. ([evaluation.md](evaluation.md))

### Phase 2: Migración por fases (Canary)

1. Usar pruebas A/B de AgentCore Gateway (AgentCore Optimization — ya implementado en este repositorio) para enrutar una parte del tráfico a la ruta Managed KB
2. Confirmar que todas las pruebas de permisos (Fail-Closed, anidamiento de grupos, casos límite de ACL) pasen
3. Tras confirmar la significancia estadística, trasladar el tráfico gradualmente

### Phase 3: Decisión de cambio (cutover)

- Todas las verificaciones superadas → hacer de Managed KB la ruta por defecto
- Cualquier elemento no cumplido → conservar la configuración actual; mantener Managed KB como shadow o retirarlo

> Recomendamos conservar la ruta existente (Bedrock KB + OpenSearch Serverless / S3 Vectors) como **ruta de rollback durante un período** incluso tras completar la migración.

---

## 6. Lista de verificación

Confirme todos los siguientes elementos antes de una decisión de migración.

### Fundamento de datos
- [ ] V1: El conector S3 puede registrar FSx ONTAP S3 AP como fuente de datos
- [ ] PoC realizado con datos consistentes desde Snapshot / FlexClone
- [ ] Los datos de producción no se someten a crawling directo intensivo

### Permission-aware RAG (lo más crítico)
- [ ] V2: `allowed_group_sids` se conserva como metadato
- [ ] V3 o V4: El filtro SID funciona vía el filter `listContains` o `userContext`
- [ ] V5: ACL se aplica en cada paso de AgenticRetrieveStream
- [ ] Se mantiene el paso 4 de defensa en profundidad (coincidencia final del lado de la aplicación)
- [ ] Fail-Closed: denegar todo cuando falla la recuperación del SID
- [ ] Los 31 escenarios de prueba de permisos pasan

### Ciclo de vida de los datos
- [ ] V6: La latencia de reflejo de cambios/eliminaciones/renombrados de permisos es aceptable
- [ ] V7: ACL se aplica al historial de conversación/caché

### Costo y rendimiento
- [ ] Comparación de costos unitarios actual vs Managed KB realizada (tamaño de datos + número de recuperaciones)
- [ ] Estimación mensual creada para el volumen de consultas esperado

### Operación
- [ ] Procedimiento de rollback (volver a la ruta existente) documentado en un runbook
- [ ] Historial de uso rastreable vía registro de auditoría

---

## 7. Recomendación

**Veredicto actual: REQUEST CHANGES (migración en espera hasta completar la verificación)**

Condiciones para levantarlo:

1. Verificar los puntos V1–V7 del §4.2 vía PoC
2. Superar específicamente **V2, V3 (o V4) y V5** (BLOCKED si no se cumplen)
3. El diseño debe mantener el paso 4 de defensa en profundidad (coincidencia ACL final del lado de la aplicación)
4. La comparación de costos muestra que no hay desventaja frente al actual, o la reducción de carga operativa supera cualquier aumento de costo

**Fundamento:**

- La reducción de carga operativa, Smart Parsing y Agentic Retriever de Managed KB ofrecen un valor claro para este proyecto (public evidence).
- Sin embargo, el **requisito de máxima prioridad de este proyecto es la aplicación estricta de ACL para Permission-aware RAG**, y el comportamiento del filtro SID en el almacenamiento gestionado está **sin verificar**.
- `userContext` (proporcionado por la aplicación, independiente del modelo) y el filter `listContains` se alinean direccionalmente, por lo que **la migración es bastante viable según la verificación**.

> Este documento es una evaluación. La migración real solo debe realizarse tras la verificación anterior y la aprobación mediante la revisión correspondiente (revisión de arquitectura FSxN AI/RAG).

---

## Documentos relacionados

- [managed-kb-upgrade-path.md](managed-kb-upgrade-path.md) — Procedimientos de validación de Managed KB (validación de conexión S3 AP / patrón de validación segura FlexClone)
- [SID-Filtering-Architecture.md](SID-Filtering-Architecture.md) — Diseño fundamental del filtrado SID
- [s3-vectors-sid-architecture-guide.md](s3-vectors-sid-architecture-guide.md) — Integración S3 Vectors + SID
- [stack-architecture-comparison.md](stack-architecture-comparison.md) — Configuración de stack existente y cuotas de KB
- [metadata-json-schema.md](metadata-json-schema.md) — Esquema de metadatos `allowed_group_sids`
- [migration-guide-multimodal.md](../en/migration-guide-multimodal.md) — Patrón de referencia para la migración por fases Dual KB (en inglés)
- [chunking-strategy-guide.md](chunking-strategy-guide.md) — Estrategia de chunking actual
- [evaluation.md](evaluation.md) — Métodos de evaluación RAG
