# Guía de selección de la estrategia de fragmentación

**🌐 Language:** [日本語](../chunking-strategy-guide.md) | [English](../en/chunking-strategy-guide.md) | [한국어](../ko/chunking-strategy-guide.md) | [简体中文](../zh-CN/chunking-strategy-guide.md) | [繁體中文](../zh-TW/chunking-strategy-guide.md) | [Français](../fr/chunking-strategy-guide.md) | [Deutsch](../de/chunking-strategy-guide.md) | **Español**

**Creado**: 2026-06-07  
**Estado**: Primera edición  
**Público**: responsables del ajuste de la calidad RAG, ingenieros de datos

---

## Descripción general

La estrategia de fragmentación de una Bedrock Knowledge Base afecta directamente a la precisión de la búsqueda, la calidad de las respuestas y el coste. Esta guía ayuda a elegir la que corresponde a las características de los documentos alojados en FSx for ONTAP.

---

## Estrategias disponibles

Se configura mediante el contexto de CDK `kbChunkingStrategy`:

```bash
npx cdk synth --quiet -c kbChunkingStrategy=FIXED_SIZE    # por defecto
npx cdk synth --quiet -c kbChunkingStrategy=HIERARCHICAL
npx cdk synth --quiet -c kbChunkingStrategy=SEMANTIC
npx cdk synth --quiet -c kbChunkingStrategy=NONE
```

> ⚠️ **Cambiar la estrategia de fragmentación exige resincronizar la fuente de datos (reingesta).**

**Cualquier valor fuera de estos cuatro lanza un error en el momento del synth.** Recurrir en silencio al valor por defecto dejaría la salida `KbChunkingStrategy` mostrando la errata mientras la configuración emitida diría `FIXED_SIZE`: el valor mostrado y la configuración desplegada no coincidirían. Se normaliza el uso de mayúsculas (`semantic` → `SEMANTIC`).

---

## Comparación de estrategias

| Estrategia | Tamaño de fragmento | Solapamiento | Precisión | Coste | Adecuada para |
|---|---|---|---|---|---|
| **FIXED_SIZE** | 300 tokens | 10% | ⭐⭐⭐ | 💰 bajo | uso general, primer despliegue, documentos de estructura uniforme |
| **HIERARCHICAL** | padre 1500 / hijo 300 | 60 tokens | ⭐⭐⭐⭐ | 💰💰 medio | informes largos, documentos jerárquicos, documentación técnica |
| **SEMANTIC** | ≤300 tokens | automático (unidades de sentido) | ⭐⭐⭐⭐⭐ | 💰💰💰 alto | corpus heterogéneo, preguntas frecuentes, diálogos, actas |
| **NONE** | documento completo | ninguno | ⭐⭐ | 💰 el más bajo | documentos cortos (<300 tokens), solo metadatos |

---

## Características del documento y estrategia recomendada

| Características | Recomendada | Motivo |
|---|---|---|
| **Documentos de diseño y especificación** (jerárquicos, largos) | HIERARCHICAL | conserva la jerarquía capítulo → sección → párrafo, lo que da contexto amplio y búsqueda precisa a la vez |
| **Contratos y documentos legales** (por cláusula) | SEMANTIC | detecta la frontera semántica entre cláusulas y no divide ninguna |
| **Preguntas frecuentes** (pares pregunta-respuesta cortos) | SEMANTIC | mantiene la pregunta y su respuesta en el mismo fragmento |
| **Actas y correo** (diálogo) | SEMANTIC | divide de forma natural donde cambia el tema |
| **Manuales y procedimientos** (paso a paso) | HIERARCHICAL | el procedimiento completo pasa a ser el padre y cada paso un hijo |
| **Informes financieros** (tablas y cifras) | FIXED_SIZE | el tamaño fijo es más estable cuando la estructura de tablas es compleja |
| **Avisos cortos** (menos de una página) | NONE | no hace falta dividir cuando el documento entero cabe en un fragmento |
| **Corpus mixto** (muchos tipos de documento) | SEMANTIC | produce una división semánticamente razonable sea cual sea el tipo |

---

## Por sector

| Sector | Documentos principales | Recomendada | Notas |
|---|---|---|---|
| **Manufactura** | planos (partes de texto), normas de calidad, instrucciones de trabajo | HIERARCHICAL | combinar los planos con un KB multimodal |
| **Servicios financieros** | documentos regulatorios, informes internos, informes de cumplimiento | SEMANTIC | preserva la integridad semántica de las cláusulas |
| **Sector público** | documentos de políticas, circulares, actas | SEMANTIC | importa la división por tema de las actas |
| **Salud** | guías clínicas, procedimientos, artículos de investigación | HIERARCHICAL | aprovecha la estructura por capítulos |
| **Legal** | contratos, jurisprudencia, normativa | SEMANTIC | evita dividir cláusulas |
| **Educación** | material docente, programas, material de investigación | FIXED_SIZE | estructura uniforme, sensible al coste |
| **Seguros** | criterios de evaluación, informes de detección de fraude | HIERARCHICAL | encaja con criterios de decisión jerárquicos |

---

## Características de rendimiento

### Tiempo de ingesta

| Estrategia | 1,000 documentos (estimación) | 10,000 documentos (estimación) |
|---|---|---|
| FIXED_SIZE | ~5 min | ~30 min |
| HIERARCHICAL | ~8 min | ~50 min |
| SEMANTIC | ~15 min | ~90 min |
| NONE | ~3 min | ~15 min |

> SEMANTIC realiza una llamada adicional al modelo en cada frontera candidata, lo que aumenta el tiempo de ingesta y el coste.

### Latencia de búsqueda

La estrategia de fragmentación no afecta directamente a la latencia de búsqueda: el rendimiento de la búsqueda vectorial depende del tamaño del índice. HIERARCHICAL realiza una búsqueda padre/hijo en dos etapas, por lo que puede añadir algo de latencia (~50 ms).

---

## Relación con el RAG consciente de permisos

**Importante**: sea cual sea la estrategia de fragmentación, el filtrado de permisos se aplica siempre **por documento**.

```
Documento A (SID: [Admin, Engineering])
  ├── Chunk 1 → SID: [Admin, Engineering] (heredado del documento)
  ├── Chunk 2 → SID: [Admin, Engineering] (heredado del documento)
  └── Chunk 3 → SID: [Admin, Engineering] (heredado del documento)
```

- La información de SID en `.metadata.json` se adjunta por documento.
- No es posible diferenciar permisos por fragmento; todo el documento lleva un único conjunto de permisos.
- Cuando un documento necesita permisos distintos en partes distintas, hay que separarlo en archivos.

---

## Cambiar de estrategia

```bash
# 1. Comprobar la estrategia actual
grep kbChunkingStrategy cdk.context.json

# 2. Actualizar el contexto de CDK
# editar cdk.context.json, o pasar el valor por línea de comandos

# 3. Revisar el diff de CDK
npx cdk diff ${STACK_PREFIX}-AI -c kbChunkingStrategy=SEMANTIC

# 4. Desplegar (solo actualiza la configuración de la fuente de datos)
npx cdk deploy ${STACK_PREFIX}-AI -c kbChunkingStrategy=SEMANTIC

# 5. Resincronizar la fuente de datos (obligatorio)
aws bedrock-agent start-ingestion-job \
  --knowledge-base-id <KB_ID> \
  --data-source-id <DS_ID> \
  --region ap-northeast-1

# 6. Esperar a que termine la reingesta
aws bedrock-agent get-ingestion-job \
  --knowledge-base-id <KB_ID> \
  --data-source-id <DS_ID> \
  --ingestion-job-id <JOB_ID>

# 7. Evaluar la calidad (comparar con RAGAS)
cd tests/rag-evaluation
python3 evaluate.py --kb-id <KB_ID> --model-id <MODEL_ID> --region ap-northeast-1
```

---

## Cómo evaluar un cambio

Después de cambiar la estrategia, mida siempre:

1. **Evaluación RAGAS**: compare fidelidad, relevancia de la respuesta y precisión del contexto con `tests/rag-evaluation/`.
2. **Regresión de la matriz de permisos**: confirme que el filtrado sigue comportándose en los 31 escenarios.
3. **Tiempo de respuesta**: revise las latencias P50/P95/P99 en CloudWatch.
4. **Coste**: compare la suma del coste de ingesta y el de consulta.

---

## Implementación en CDK

`buildChunkingConfiguration()` en `lib/stacks/demo/demo-ai-stack.ts`:

```typescript
// FIXED_SIZE: maxTokens=300, overlapPercentage=10
// HIERARCHICAL: parent=1500, child=300, overlapTokens=60
// SEMANTIC: maxTokens=300, bufferSize=1, breakpointPercentileThreshold=95
# NONE: sin fragmentación (el documento entero se convierte en un vector)
```

---

## Documentos relacionados

- [Dimensionamiento y rendimiento de FSx for ONTAP](fsxn-sizing-and-performance.md)
- [Marco de evaluación de RAG / Agent](evaluation.md)
- [Hoja de cálculo de estimación de costes](cost-estimation-worksheet.md)
- [Architecture Decision Records](architecture-decision-records.md)
