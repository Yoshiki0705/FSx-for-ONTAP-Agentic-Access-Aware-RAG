# Hoja de cálculo de estimación de costos

**🌐 Language:** [日本語](../cost-estimation-worksheet.md) | [English](../en/cost-estimation-worksheet.md) | [한국어](../ko/cost-estimation-worksheet.md) | [简体中文](../zh-CN/cost-estimation-worksheet.md) | [繁體中文](../zh-TW/cost-estimation-worksheet.md) | [Français](../fr/cost-estimation-worksheet.md) | [Deutsch](../de/cost-estimation-worksheet.md) | **Español**

**Fecha de creación**: 2026-05-23  
**Estado**: Borrador  
**Audiencia**: Gerentes de proyecto, responsables de propuestas de socios, planificadores de presupuesto

> **⚠️ Nota**: Los precios en esta hoja de cálculo son valores de referencia basados en los precios públicos de la región ap-northeast-1 a mayo de 2026. Los costos reales varían según la región, el uso, los descuentos y las actualizaciones de precios. Consulte [AWS Pricing](https://aws.amazon.com/pricing/) para las tarifas más recientes.

---

## Parámetros de entrada

Complete los valores a continuación para estimar su costo mensual.

| Parámetro | Valor | Notas |
|-----------|-------|-------|
| Número de documentos | _____ | Archivos en el volumen FSx |
| Tamaño promedio de documento | _____ KB | Equivalente en texto |
| Consultas diarias | _____ /día | Total de todos los usuarios |
| Usuarios simultáneos | _____ | Pico |
| Usuarios registrados | _____ | Cognito User Pool |
| Frecuencia de sincronización KB | _____ /día | Calculada del intervalo Auto-Sync |
| Tasa de uso del modo Agent | _____ % | Porcentaje de consultas usando Agent |
| Requisito de disponibilidad | Single-AZ / Multi-AZ | Configuración FSx |

---

## Fórmulas de cálculo de costos

### 1. FSx for ONTAP

```
Mensual = costo de throughput + costo de SSD + costo de Capacity Pool + costo de respaldo

Costo de throughput:
  128 MB/s: ~$210/mes
  256 MB/s: ~$420/mes
  512 MB/s: ~$840/mes
  1,024 MB/s: ~$1,680/mes

Costo de SSD: $0.125/GiB/mes × capacidad SSD (GiB)
Costo de Capacity Pool: $0.0125/GiB/mes × uso de Capacity Pool (GiB)
Costo de respaldo: $0.025/GiB/mes × capacidad de respaldo (GiB)

Para Multi-AZ: los costos de throughput + SSD se duplican aproximadamente
```

**Ejemplos de cálculo**:
- 128 MB/s + 1 TiB SSD + 500 GiB CP (Single-AZ): $210 + $128 + $6.25 = **~$344/mes**
- 512 MB/s + 5 TiB SSD + 2 TiB CP (Multi-AZ): $1,680 + $640 + $25 = **~$2,345/mes**

### 2. Almacenamiento vectorial

```
S3 Vectors:
  Almacenamiento: $0.023/GB/mes × tamaño de datos vectoriales
  Solicitudes: $0.005/1,000 PUT + $0.0004/1,000 GET
  Estimación: 10,000 documentos → ~$5/mes

OpenSearch Serverless:
  OCU: $0.24/OCU/hora × 24 × 30 = $172.80/OCU/mes
  Mínimo 2 OCU (búsqueda + índice): ~$346/mes
  Recomendado 4 OCU: ~$691/mes
```

### 3. Bedrock (Embedding)

```
Titan Embed Text v2: $0.0001/1,000 tokens

Embedding inicial:
  = número de documentos × tamaño promedio (KB) × 1,000 / 4 × $0.0001/1K
  Ejemplo: 10,000 docs × 10 KB × 250 tokens/KB × $0.0001/1K = $2.50

Embedding incremental mensual:
  = documentos modificados × tamaño promedio × $0.0001/1K
  Ejemplo: 500 docs/mes × 10 KB × 250 tokens/KB × $0.0001/1K = $0.13
```

### 4. Bedrock (Modelos de generación)

```
Distribución Smart Routing (supuesto por defecto):
  Simple (Haiku): 60% → $0.001/query
  Complex (Sonnet): 30% → $0.01/query
  Full-context (Opus): 10% → $0.10/query

Costo promedio ponderado/consulta:
  = 0.6 × $0.001 + 0.3 × $0.01 + 0.1 × $0.10
  = $0.0006 + $0.003 + $0.01
  = ~$0.014/query

Mensual:
  = consultas diarias × 30 × $0.014
  Ejemplo: 100 queries/día × 30 × $0.014 = $42/mes
  Ejemplo: 1,000 queries/día × 30 × $0.014 = $420/mes
```

### 5. Lambda

```
WebApp Lambda:
  Solicitudes: $0.20/1 millón de solicitudes
  Cómputo: $0.0000166667/GB-segundo
  Memoria: 1,024 MB, tiempo de ejecución promedio: 3 segundos
  
  Mensual = solicitudes × (memoria_GB × segundos_ejec × $0.0000166667 + $0.0000002)
  Ejemplo: 100,000 req/mes × (1 × 3 × $0.0000166667 + $0.0000002) = ~$5/mes

Lambda de sincronización (KB Auto-Sync, AD Sync):
  Intervalo de 5 minutos × 30 días = 8,640 invocaciones/mes
  128 MB × 5 segundos = ~$0.60/mes
```

### 6. Otros servicios

```
CloudFront: $0.114/GB (Japón) × volumen de transferencia
  Ejemplo: 10 GB/mes = $1.14/mes

WAF: $5/WebACL + $1/regla × 6 + $0.60/1 millón de solicitudes
  Base: $11/mes + cargos por uso

DynamoDB (bajo demanda):
  Escrituras: $1.25/1 millón WRU
  Lecturas: $0.25/1 millón RRU
  Almacenamiento: $0.25/GB/mes
  Ejemplo: ~$5/mes (pequeña escala)

Cognito:
  Primeros 50,000 MAU: Gratis
  50,001–100,000: $0.0055/MAU
  Ejemplo: 100 MAU = $0 (dentro del nivel gratuito)

CloudWatch:
  Ingesta de logs: $0.76/GB
  Almacenamiento de logs: $0.033/GB/mes
  Métricas: $0.30/métrica/mes (primeras 10,000)
  Ejemplo: ~$10–$30/mes
```

---

## Plantillas de estimación mensual por configuración

### Plantilla A: PoC a pequeña escala

| Recurso | Configuración | Mensual |
|---------|--------------|---------|
| FSx for ONTAP | 128 MB/s, 1 TiB SSD, Single-AZ | $344 |
| S3 Vectors | ~10,000 vectores | $5 |
| Bedrock Embedding | Inicial + incremental | $3 |
| Bedrock Generación | 100 queries/día, Smart Routing | $42 |
| Lambda | WebApp + Sync | $6 |
| CloudFront + WAF | Básico | $15 |
| DynamoDB | Bajo demanda | $5 |
| Cognito | ~50 MAU | $0 |
| CloudWatch | Básico | $10 |
| **Total** | | **~$430/mes** |

### Plantilla B: Producción a mediana escala

| Recurso | Configuración | Mensual |
|---------|--------------|---------|
| FSx for ONTAP | 512 MB/s, 5 TiB SSD, Multi-AZ | $2,345 |
| OpenSearch Serverless | 4 OCU | $691 |
| Bedrock Embedding | Sincronización periódica | $10 |
| Bedrock Generación | 1,000 queries/día, Smart Routing | $420 |
| Lambda | WebApp + Sync + Monitoreo | $30 |
| CloudFront + WAF | Tráfico de producción | $50 |
| DynamoDB | Aprovisionado | $30 |
| Cognito | ~500 MAU | $0 |
| CloudWatch | Logs + Métricas + Alarmas | $50 |
| **Total** | | **~$3,626/mes** |

### Plantilla C: Gran empresa

| Recurso | Configuración | Mensual |
|---------|--------------|---------|
| FSx for ONTAP | 1,024 MB/s, 10 TiB SSD, Multi-AZ | $4,480 |
| OpenSearch Serverless | 8 OCU | $1,382 |
| Bedrock Embedding | Sincronización a gran escala | $50 |
| Bedrock Generación | 5,000 queries/día, Smart Routing | $2,100 |
| Lambda | Todas las funciones | $100 |
| CloudFront + WAF | Alto tráfico | $200 |
| DynamoDB | Aprovisionado + DAX | $100 |
| Cognito | ~2,000 MAU | $0 |
| CloudWatch | Monitoreo completo | $100 |
| **Total** | | **~$8,512/mes** |

---

## Puntos de optimización de costos

| Método | Ahorro | Condiciones de aplicación |
|--------|--------|--------------------------|
| S3 Vectors (en lugar de AOSS) | -$700/mes | QPS < 10, latencia tolerable |
| Smart Routing (prioridad Haiku) | -30–50% | Mayoría de preguntas simples |
| Capacity Pool Tiering | -50–80% (almacenamiento) | Datos con baja frecuencia de acceso |
| Reducción de throughput (fase operativa) | -50% | Después de completar la indexación inicial |
| Savings Plans (Lambda) | -17% | Compromiso de 1 año |
| Reserved Capacity (AOSS) | Consultar a AWS | Uso a largo plazo confirmado |

---

## Documentos relacionados

| Documento | Descripción |
|-----------|-------------|
| [fsxn-sizing-and-performance.md](../fsxn-sizing-and-performance.md) | Rendimiento y planificación de capacidad de FSx for ONTAP |
| [partner-deployment-patterns.md](../partner-deployment-patterns.md) | Patrones de despliegue de socios (incluye comparación de costos) |
| [evaluation.md](../evaluation.md) | Métricas de evaluación RAG / Agent |
