# Escenarios de benchmark (10K / 100K / 1M archivos)

**🌐 Language:** [日本語](../benchmark-scenarios.md) | [English](../en/benchmark-scenarios.md) | [한국어](../ko/benchmark-scenarios.md) | [简体中文](../zh-CN/benchmark-scenarios.md) | [繁體中文](../zh-TW/benchmark-scenarios.md) | [Français](../fr/benchmark-scenarios.md) | [Deutsch](../de/benchmark-scenarios.md) | **Español**

**Fecha de creación**: 2026-05-23  
**Estado**: Framework completado, pendiente de mediciones  
**Audiencia**: Ingenieros de rendimiento, planificadores de capacidad

> **⚠️ Distinción**: Las estimaciones en este documento son valores teóricos basados en la documentación de AWS. Para mediciones reales, ejecute `benchmarks/scripts/run-benchmark.sh` en su entorno de pruebas. No confunda los valores teóricos con las mediciones reales.

---

## Descripción general

Este documento define los escenarios de benchmark para evaluar el rendimiento del sistema Permission-aware RAG en tres escalas diferentes.

---

## Pasos de ejecución del benchmark

### Step 1: Generar datos de prueba

```bash
# 10K archivos (escala PoC)
python3 benchmarks/scripts/generate-test-data.py --scale 10k --output /tmp/bench-10k

# 100K archivos (escala departamental)
python3 benchmarks/scripts/generate-test-data.py --scale 100k --output /tmp/bench-100k

# 1M archivos (escala empresarial)
python3 benchmarks/scripts/generate-test-data.py --scale 1m --output /tmp/bench-1m
```

### Step 2: Subir datos y sincronizar KB

```bash
# Subir a S3
aws s3 sync /tmp/bench-10k/ s3://${KB_DATA_BUCKET}/ --exclude "*.DS_Store"

# Sincronizar KB (medir tiempo de indexación inicial)
time aws bedrock-agent start-ingestion-job \
  --knowledge-base-id ${KB_ID} \
  --data-source-id ${DS_ID}
```

### Step 3: Ejecutar benchmark

```bash
bash benchmarks/scripts/run-benchmark.sh \
  --kb-id ${KB_ID} \
  --user-access-table ${USER_ACCESS_TABLE} \
  --scale 10k \
  --queries 200 \
  --concurrent 5 \
  --output benchmarks/results/10k-results.json
```

---

## Escenarios de medición

### Escenario 1: Latencia de búsqueda (usuario único)

| Parámetro | Valor |
|-----------|-------|
| Objetivo | Medir la latencia base de Retrieve API + filtro SID |
| Consultas | 200 |
| Concurrencia | 1 |
| Usuario | admin (acceso a todos los documentos) |
| Métricas | Retrieve API P50/P95/P99, SID Filter, End-to-End |

### Escenario 2: Eficiencia del filtrado por permisos

| Parámetro | Valor |
|-----------|-------|
| Objetivo | Medir la eficiencia del filtrado y la calidad de resultados por nivel de permiso |
| Consultas | 100 × 3 usuarios |
| Usuarios | admin (acceso completo), engineer (parcial), general (solo público) |
| Métricas | Ratio de documentos antes/después del filtrado, calidad de respuestas |

### Escenario 3: Carga de acceso concurrente

| Parámetro | Valor |
|-----------|-------|
| Objetivo | Medir la degradación de latencia bajo acceso concurrente |
| Consultas | 500 |
| Concurrencia | 1, 5, 10, 20, 50 |
| Métricas | Cambio de latencia P95 por nivel de concurrencia |

### Escenario 4: Rendimiento de sincronización KB

| Parámetro | Valor |
|-----------|-------|
| Objetivo | Medir la duración de la indexación inicial y la sincronización incremental |
| Métricas | Tiempo de sincronización inicial, tiempo de sincronización incremental (5% de cambio), tiempo de ListObjectsV2 |

### Escenario 5: Efecto del caché

| Parámetro | Valor |
|-----------|-------|
| Objetivo | Medir el efecto del caché de permisos |
| Consultas | 100 (mismo usuario, consecutivas) |
| Métricas | Tasa de aciertos del caché, diferencia de latencia entre acierto/fallo |

---

## Estimaciones teóricas de referencia

> Para más detalles, consulte [benchmarks/results/baseline-estimates.md](../benchmarks/results/baseline-estimates.md)

| Escala | Retrieve P50 (S3V) | Retrieve P50 (AOSS) | End-to-End P50 | KB Sync (inicial) |
|--------|--------------------|--------------------|----------------|-------------------|
| 10K | 200–500 ms | 100–200 ms | 2–4 seg | 5–15 min |
| 100K | 300–800 ms | 100–200 ms | 3–6 seg | 30–90 min |
| 1M | 500–1.500 ms | 100–300 ms | 4–8 seg | Varias horas |

---

## Plantilla de informe de resultados

Después de ejecutar el benchmark, registre los resultados con la siguiente plantilla.

```markdown
# Benchmark Results — [SCALE] files

## Environment
- Region: ap-northeast-1
- Vector Store: S3 Vectors / OpenSearch Serverless
- FSx Throughput: XXX MB/s
- Document Count: XXX
- Chunk Count: XXX (estimated)
- Date: YYYY-MM-DD

## Results

### Retrieve API Latency
| Percentile | Value |
|-----------|-------|
| P50 | XXX ms |
| P95 | XXX ms |
| P99 | XXX ms |

### SID Filter Latency
| Percentile | Value |
|-----------|-------|
| P50 | XXX ms |
| P95 | XXX ms |

### End-to-End (Retrieve + SID + Converse)
| Percentile | Value |
|-----------|-------|
| P50 | XXX ms |
| P95 | XXX ms |

### KB Sync
| Operation | Duration |
|-----------|----------|
| Initial sync | XXX min |
| Incremental (5% change) | XXX min |

### Throughput
| Metric | Value |
|--------|-------|
| Queries/minute (single user) | XXX |
| Queries/minute (5 concurrent) | XXX |

## Observations
- 
- 

## Recommendations
- 
- 
```

---

## Documentos relacionados

| Documento | Descripción |
|-----------|-------------|
| [fsxn-sizing-and-performance.md](../fsxn-sizing-and-performance.md) | Rendimiento y dimensionamiento de FSx for ONTAP |
| [cost-estimation-worksheet.md](../cost-estimation-worksheet.md) | Hoja de estimación de costos |
| [benchmarks/README.md](../../benchmarks/README.md) | Framework de benchmark |
| [benchmarks/results/baseline-estimates.md](../../benchmarks/results/baseline-estimates.md) | Estimaciones teóricas de referencia |
