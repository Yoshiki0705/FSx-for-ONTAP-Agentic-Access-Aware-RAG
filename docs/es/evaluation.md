# Métricas de evaluación RAG / Agent

**🌐 Language:** [日本語](../evaluation.md) | [English](../en/evaluation.md) | [한국어](../ko/evaluation.md) | [简体中文](../zh-CN/evaluation.md) | [繁體中文](../zh-TW/evaluation.md) | [Français](../fr/evaluation.md) | [Deutsch](../de/evaluation.md) | **Español**

**Creado**: 2026-05-21  
**Estado**: Borrador  
**Audiencia**: Evaluadores de PoC, gerentes de proyecto, personal de aseguramiento de calidad

---

## Descripción general

Este documento proporciona definiciones de métricas y métodos de evaluación para evaluar cuantitativamente la calidad y efectividad del sistema RAG con reconocimiento de permisos. La evaluación se realiza en 4 ejes: KPIs de negocio, Calidad RAG, Control de permisos y Rendimiento del Agent.

---

## Marco de evaluación

```
┌─────────────────────────────────────────────────────────────┐
│                    4 ejes de evaluación                        │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ KPI de       │  │ Calidad RAG  │  │ Control de   │       │
│  │ negocio      │  │              │  │ permisos     │       │
│  │              │  │              │  │              │       │
│  │ ・Reducción  │  │ ・Precisión  │  │ ・Tasa de    │       │
│  │   tiempo     │  │   respuesta  │  │   violación  │       │
│  │ ・Resolución │  │ ・Fidelidad  │  │ ・Falsos Pos │       │
│  │   primera    │  │              │  │ ・Falsos Neg │       │
│  │ ・Reducción  │  │ ・Precisión  │  │ ・Retraso    │       │
│  │   consultas  │  │   contexto   │  │   propagación│       │
│  │ ・Tasa uso   │  │ ・Tiempo     │  │              │       │
│  │              │  │   respuesta  │  │              │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│                                                               │
│  ┌──────────────┐                                            │
│  │ Rendimiento  │                                            │
│  │ Agent        │                                            │
│  │              │                                            │
│  │ ・Éxito de   │                                            │
│  │   tarea      │                                            │
│  │ ・Precisión  │                                            │
│  │   herramienta│                                            │
│  │ ・Tasa       │                                            │
│  │   escalación │                                            │
│  │ ・Costo/tarea│                                            │
│  └──────────────┘                                            │
└─────────────────────────────────────────────────────────────┘
```

---

## 1. KPIs de negocio

### Definiciones y métodos de medición

| KPI | Definición | Objetivo (PoC) | Método de medición |
|-----|-----------|----------------|-------------------|
| Tasa de reducción de tiempo de búsqueda | Ahorro de tiempo comparado con búsqueda manual tradicional | 50%+ | Encuesta de usuarios + comparación de marcas de tiempo |
| Tasa de resolución en primera consulta | Porcentaje resuelto solo con la respuesta de IA | 60%+ | Retroalimentación del usuario (👍/👎) |
| Tasa de reducción de consultas | Disminución de consultas al helpdesk | 30%+ | Comparación de cantidad de tickets antes/después |
| Tasa de citación | Porcentaje de respuestas con citaciones | 90%+ | Agregación automática de presencia de citaciones |
| Cantidad de violaciones de permisos | Cantidad de documentos no autorizados mostrados | 0 | Prueba de matriz de permisos + registros de auditoría |
| Tasa de usuarios activos mensuales | Tasa de uso mensual entre usuarios registrados | 70%+ | Cognito + registros de acceso |

### Panel de medición

Visualice lo siguiente en el panel de CloudWatch (`enableMonitoring=true`):

- Cantidad de solicitudes de búsqueda diarias/semanales
- Frecuencia de uso por usuario
- Tasa de éxito de generación de respuestas
- Tiempo de respuesta promedio (P50/P95/P99)
- Tasa de intervención de Guardrails

---

## 2. Métricas de calidad RAG

### 2.1 Relevancia de la respuesta

**Definición**: Qué tan relevante es la respuesta generada para la pregunta del usuario

**Método de evaluación**:
- Evaluación humana: Escala de 5 puntos (1: Irrelevante – 5: Completamente relevante)
- Evaluación automatizada: LLM-as-Judge (puntuación automática por Claude)

**Objetivo**: Promedio 4.0+ (escala de 5 puntos)

### 2.2 Fidelidad

**Definición**: Si la respuesta generada es fiel al contenido de los documentos recuperados (sin alucinación)

**Método de evaluación**:
- Cruzar cada afirmación en la respuesta con los documentos de citación
- Medir la proporción de afirmaciones no respaldadas

**Fórmula**:
```
Fidelidad = (Número de afirmaciones respaldadas) / (Total de afirmaciones en la respuesta)
```

**Objetivo**: 0.90+

### 2.3 Precisión de contexto

**Definición**: Proporción de documentos recuperados que realmente contribuyeron a la generación de la respuesta

**Método de evaluación**:
- Determinar si cada documento en los resultados de búsqueda fue utilizado en la respuesta
- Los documentos de mayor rango tienen mayor peso

**Fórmula**:
```
Precisión de contexto = Σ(Precision@k × relevance@k) / (Número de documentos relevantes)
```

**Objetivo**: 0.80+

### 2.4 Tasa de violación de permisos

**Definición**: Proporción de resultados de búsqueda que contienen documentos no autorizados

**Método de evaluación**:
- Ejecutar la misma consulta con usuarios de prueba (diferentes niveles de permisos)
- Verificar que no aparezcan documentos no autorizados en los resultados de búsqueda de cada usuario

**Fórmula**:
```
Tasa de violación de permisos = (Cantidad de documentos no autorizados mostrados) / (Total de búsquedas)
```

**Objetivo**: 0% (tolerancia cero)

### 2.5 Latencia de respuesta

| Percentil | Objetivo (Modo KB) | Objetivo (Modo Agent) |
|-----------|--------------------|-----------------------|
| P50 | < 3 seg | < 8 seg |
| P95 | < 8 seg | < 20 seg |
| P99 | < 15 seg | < 30 seg |

---

## 3. Métricas de control de permisos

### 3.1 Matriz de pruebas

| Caso de prueba | Resultado esperado | Método de verificación |
|----------------|-------------------|----------------------|
| Admin busca documentos confidenciales | Mostrado | Confirmar coincidencia de SID |
| Usuario general busca documentos confidenciales | No mostrado | Confirmar no coincidencia de SID |
| Todos los usuarios buscan documentos Everyone | Mostrado para todos | Confirmar coincidencia S-1-1-0 |
| Usuario sin SID busca | Denegar todo (Fail-Closed) | Comportamiento cuando no hay registro en DynamoDB |
| Usuario busca inmediatamente después de agregar grupo | Documentos del nuevo grupo mostrados | Verificar comportamiento después de AD Sync |
| Usuario busca inmediatamente después de eliminar grupo | Documentos del grupo anterior ocultos | Verificar comportamiento después de TTL de caché |

### 3.2 Pruebas de casos extremos

| Caso | Comportamiento esperado | Notas |
|------|------------------------|-------|
| Conflicto Allow / Deny | Deny tiene prioridad (este sistema usa solo lista Allow) | ACE Deny de ACL NTFS no se refleja en `.metadata.json` por diseño |
| Anidamiento de grupos | Permitido por SID del grupo padre | Grupos anidados de AD gestionados como lista expandida de SID |
| Permisos heredados vs explícitos | Ambos SIDs incluidos en `.metadata.json` | Todos los SIDs de permisos efectivos enumerados |
| Permisos después de Rename / Move | Se aplican permisos heredados del destino | Se requiere regeneración de `.metadata.json` |
| Acceso mixto SMB y NFS | Depende del estilo de seguridad | Estilo NTFS: SID, Estilo UNIX: UID/GID |
| Usuario con SID no resoluble | Fail-Closed (denegar todo) | Sin datos de SID en DynamoDB |
| Búsqueda inmediatamente después de eliminación de permisos | Buscable con permisos antiguos dentro del TTL de caché | Retraso máx 5 min (limpieza manual para emergencias) |

---

## 4. Métricas de evaluación del Agent

### 4.1 Tasa de éxito de tareas

**Definición**: Porcentaje de tareas completadas correctamente por el Agent

**Fórmula**:
```
Tasa de éxito de tareas = (Tareas completadas correctamente) / (Total de tareas)
```

**Objetivo**: 80%+

### 4.2 Precisión de Tool-Call

**Definición**: Porcentaje de llamadas a herramientas apropiadas con parámetros apropiados por el Agent

**Elementos de evaluación**:
- Selección correcta de herramienta
- Configuración correcta de parámetros
- Evitación de llamadas a herramientas innecesarias

**Objetivo**: 90%+

### 4.3 Tasa de escalación humana

**Definición**: Porcentaje de casos donde el Agent difirió el juicio a un humano

**Fórmula**:
```
Tasa de escalación = (Cantidad de escalaciones) / (Total de tareas)
```

**Objetivo**: 20% o menos (aceptable para tareas complejas)

### 4.4 Costo por tarea

**Fórmula**:
```
Costo por tarea = (Tokens de entrada × precio de entrada + Tokens de salida × precio de salida) / Cantidad de tareas
```

**Estimaciones**:
| Modelo | Precio de entrada | Precio de salida | Costo promedio por tarea |
|--------|-------------------|------------------|--------------------------|
| Claude Haiku | $0.001/1K | $0.005/1K | $0.005–$0.02 |
| Claude Sonnet | $0.003/1K | $0.015/1K | $0.02–$0.10 |
| Claude Opus | $0.015/1K | $0.075/1K | $0.10–$0.50 |

---

## Plantilla de evaluación (Resumen de 1 página)

### Plantilla de informe de evaluación de PoC

```markdown
# Informe de evaluación de PoC de RAG con reconocimiento de permisos

## Período de evaluación: YYYY/MM/DD – YYYY/MM/DD
## Evaluador: [Nombre]
## Cantidad de usuarios objetivo: XX usuarios

### KPIs de negocio
| Métrica | Objetivo | Real | Juicio |
|---------|----------|------|--------|
| Tasa de reducción de tiempo de búsqueda | 50% | __% | ⬜ |
| Tasa de resolución en primera consulta | 60% | __% | ⬜ |
| Cantidad de violaciones de permisos | 0 | __ | ⬜ |
| Tasa de citación | 90% | __% | ⬜ |

### Calidad RAG
| Métrica | Objetivo | Real | Juicio |
|---------|----------|------|--------|
| Relevancia de respuesta | 4.0/5 | __/5 | ⬜ |
| Fidelidad | 0.90 | __ | ⬜ |
| Precisión de contexto | 0.80 | __ | ⬜ |
| Violación de permisos | 0% | __% | ⬜ |

### Rendimiento de respuesta
| Métrica | Objetivo | Real | Juicio |
|---------|----------|------|--------|
| Latencia P50 | < 3s | __s | ⬜ |
| Latencia P95 | < 8s | __s | ⬜ |

### Rendimiento del Agent (cuando se usa modo Agent)
| Métrica | Objetivo | Real | Juicio |
|---------|----------|------|--------|
| Tasa de éxito de tareas | 80% | __% | ⬜ |
| Precisión de Tool-Call | 90% | __% | ⬜ |
| Costo por tarea | < $0.05 | $__ | ⬜ |

### Juicio general
- [ ] PoC exitoso (se recomienda producción)
- [ ] Éxito condicional (re-evaluar después de mejoras)
- [ ] Se necesita verificación adicional

### Elementos de mejora / Próximas acciones
1. 
2. 
3. 
```

---

## Comparación de selección de modelo / costo / latencia

### Selección de almacén de vectores

| Aspecto | S3 Vectors | OpenSearch Serverless |
|---------|-----------|---------------------|
| Costo mensual (pequeña escala) | $5–$20 | $700+ |
| Latencia de consulta | 100ms–1s | 50ms–200ms |
| Escala recomendada | ~10,000 documentos | 10,000+ documentos |
| Uso recomendado | PoC, producción de pequeña escala | Producción de alto QPS |

### Selección de modelo de embedding

| Modelo | Dimensiones | Multilingüe | Costo | Uso recomendado |
|--------|------------|-------------|-------|-----------------|
| Titan Embed Text v2 | 1024 | ✅ | $0.0001/1K tokens | Predeterminado (eficiente en costos) |
| Nova Multimodal | 1024 | ✅ | $0.0002/imagen | Búsqueda multimodal |

### Selección de modelo de generación

| Modelo | Caso de uso | Costo de entrada | Costo de salida | Latencia |
|--------|-------------|------------------|-----------------|----------|
| Claude Haiku | Preguntas simples, Smart Routing: simple | $0.001/1K | $0.005/1K | ~2s |
| Claude Sonnet | Preguntas analíticas, Smart Routing: complex | $0.003/1K | $0.015/1K | ~5s |
| Claude Opus | Contexto grande, Smart Routing: full-context | $0.015/1K | $0.075/1K | ~10s |

### Plantilla de estimación de costos mensuales

```
Parámetros de entrada:
  Cantidad de documentos: _____ archivos
  Tamaño promedio de documento: _____ KB
  Cantidad de chunks (estimada): Cantidad de documentos × Tamaño promedio / 512
  Cantidad de consultas diarias: _____ consultas
  Tokens de entrada promedio/consulta: _____ tokens
  Tokens de salida promedio/consulta: _____ tokens

Cálculo de costos:
  Embedding (inicial): Cantidad de chunks × Tamaño promedio de chunk × $0.0001/1K = $____
  Embedding (incremental mensual): Chunks modificados × Tamaño promedio de chunk × $0.0001/1K = $____
  Generación (mensual): Consultas diarias × 30 × (tokens entrada × precio entrada + tokens salida × precio salida) = $____
  Almacén de vectores: S3 Vectors $____ u OpenSearch Serverless $____
  FSx for ONTAP: rendimiento + SSD + pool de capacidad = $____
  Otros (Lambda, CloudFront, DynamoDB): $____
  
  Total mensual: $____
```

---

## Documentos relacionados

| Documento | Descripción |
|-----------|-------------|
| [production-readiness-checklist.md](production-readiness-checklist.md) | Lista de verificación de preparación para producción |
| [governance-and-audit.md](governance-and-audit.md) | Diseño de gobernanza y auditoría |
| [safe-experimentation-guide.md](safe-experimentation-guide.md) | Guía de experimentación segura |
| [fsxn-sizing-and-performance.md](fsxn-sizing-and-performance.md) | Dimensionamiento y rendimiento de FSx for ONTAP |
