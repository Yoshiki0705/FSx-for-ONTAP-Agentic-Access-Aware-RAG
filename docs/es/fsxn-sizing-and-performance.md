# Guía de dimensionamiento y rendimiento de FSx for ONTAP

**🌐 Language:** [日本語](../fsxn-sizing-and-performance.md) | [English](../en/fsxn-sizing-and-performance.md) | [한국어](../ko/fsxn-sizing-and-performance.md) | [简体中文](../zh-CN/fsxn-sizing-and-performance.md) | [繁體中文](../zh-TW/fsxn-sizing-and-performance.md) | [Français](../fr/fsxn-sizing-and-performance.md) | [Deutsch](../de/fsxn-sizing-and-performance.md) | **Español**

**Creado**: 2026-05-21  
**Estado**: Borrador  
**Audiencia**: Arquitectos de infraestructura, administradores de almacenamiento

---

## Descripción general

Este documento proporciona directrices de diseño de dimensionamiento y rendimiento para FSx for ONTAP en el sistema RAG con reconocimiento de permisos. Organiza las recomendaciones de configuración basadas en la cantidad de archivos, el tamaño de archivos, la frecuencia de acceso y la frecuencia de re-sincronización.

---

## Configuraciones recomendadas por escala

### Pequeña (~10,000 archivos) — PoC / Uso departamental

| Elemento | Valor recomendado | Notas |
|----------|-------------------|-------|
| Capacidad de rendimiento de FSx | 128 MB/s | Configuración mínima |
| Capacidad de almacenamiento SSD | 1,024 GiB | Configuración mínima |
| Tiering de pool de capacidad | Habilitado | Optimización de costos |
| Almacén de vectores | S3 Vectors | Bajo costo (unos pocos dólares/mes) |
| Intervalo de KB Auto-Sync | 15 min | Predeterminado |
| Tiempo de indexación inicial | 5–15 min | Depende del tamaño del documento |
| Estimación mensual (solo FSx) | ~$300–$500 | rendimiento + SSD |

### Mediana (10,000–100,000 archivos) — Unidad de negocio / Uso empresarial

| Elemento | Valor recomendado | Notas |
|----------|-------------------|-------|
| Capacidad de rendimiento de FSx | 256–512 MB/s | Basado en la cantidad de accesos concurrentes |
| Capacidad de almacenamiento SSD | 2,048–10,240 GiB | Basado en el volumen de datos calientes |
| Tiering de pool de capacidad | Habilitado | Tiering automático de datos fríos |
| Almacén de vectores | S3 Vectors u OpenSearch Serverless | Elegir según requisitos de QPS |
| Intervalo de KB Auto-Sync | 5–15 min | Basado en la frecuencia de actualización |
| Tiempo de indexación inicial | 30–120 min | Se puede acortar con procesamiento paralelo |
| Estimación mensual (solo FSx) | ~$1,000–$5,000 | rendimiento + SSD + pool de capacidad |

### Grande (100,000–1,000,000 archivos) — Empresarial

| Elemento | Valor recomendado | Notas |
|----------|-------------------|-------|
| Capacidad de rendimiento de FSx | 1,024–4,096 MB/s | Multi-AZ + alto rendimiento |
| Capacidad de almacenamiento SSD | 10,240+ GiB | Basado en el volumen de datos calientes |
| Tiering de pool de capacidad | Habilitado | La mayoría de datos en pool de capacidad |
| Almacén de vectores | OpenSearch Serverless | Alto QPS, baja latencia |
| Intervalo de KB Auto-Sync | Se requiere diseño de sincronización incremental | El escaneo completo es impracticable |
| Tiempo de indexación inicial | Varias horas a 1 día | Se recomienda división por lotes |
| Estimación mensual (solo FSx) | ~$5,000–$30,000+ | Altamente dependiente de la configuración |

---

## Características de rendimiento de FSx for ONTAP

### Capacidad de rendimiento

La capacidad de rendimiento de FSx for ONTAP se configura a nivel de sistema de archivos.

| Rendimiento | IOPS lectura (SSD) | IOPS escritura | Ancho de banda de red | Caso de uso |
|-------------|---------------------|----------------|------------------------|-------------|
| 128 MB/s | 6,000 | 1,500 | Hasta 600 MB/s | PoC, pequeña escala |
| 256 MB/s | 12,000 | 3,000 | Hasta 1.2 GB/s | Uso departamental |
| 512 MB/s | 40,000 | 10,000 | Hasta 2.4 GB/s | Empresarial |
| 1,024 MB/s | 80,000 | 20,000 | Hasta 4.8 GB/s | Gran escala |
| 2,048 MB/s | 160,000 | 40,000 | Hasta 9.6 GB/s | Misión crítica |

> **Referencia**: Amazon FSx for ONTAP soporta hasta 72 GB/s de rendimiento (configuración de 12 pares HA).

### Tiering de almacenamiento (Capacity Pool Tiering)

| Nivel | Características | Costo | Caso de uso |
|-------|----------------|-------|-------------|
| SSD | Latencia sub-milisegundo | Alto | Archivos de acceso frecuente |
| Capacity Pool | Latencia de decenas de milisegundos | Bajo (~1/10 de SSD) | Archivo, acceso infrecuente |

**Recomendaciones para sistemas RAG**:
- `.metadata.json` y documentos buscados frecuentemente → Nivel SSD
- Documentos de archivo, versiones antiguas → Capacity Pool

**Políticas de tiering**:
- `auto`: Mueve datos automáticamente al Capacity Pool después de un período sin acceso (recomendado)
- `snapshot-only`: Solo mueve datos de snapshot al Capacity Pool
- `all`: Mueve todos los datos al Capacity Pool (prioridad de costo)
- `none`: Mantiene todos los datos en SSD (prioridad de rendimiento)

---

## Consideraciones del S3 Access Point

### Características de rendimiento

El S3 Access Point de FSx for ONTAP expone archivos en volúmenes FSx a través de una interfaz compatible con S3.

| Operación | Latencia | Rendimiento | Notas |
|-----------|----------|-------------|-------|
| ListObjectsV2 | Cientos de milisegundos | — | Proporcional a la cantidad de archivos |
| GetObject (archivos pequeños) | Decenas a cientos de milisegundos | — | Para nivel SSD |
| GetObject (archivos grandes) | Proporcional al tamaño del archivo | Depende del rendimiento de FSx | Streaming |
| HeadObject | Decenas de milisegundos | — | Solo metadatos |

### Carga durante la sincronización de Bedrock KB

Durante la sincronización de KB (StartIngestionJob), Bedrock lee todos los documentos a través del S3 Access Point.

| Cantidad de documentos | Carga de lectura durante sincronización | Rendimiento recomendado |
|------------------------|----------------------------------------|------------------------|
| ~1,000 | Baja (varios GB) | 128 MB/s es suficiente |
| ~10,000 | Media (decenas de GB) | 256 MB/s recomendado |
| ~100,000 | Alta (cientos de GB) | 512 MB/s o superior recomendado |

### Autorización de doble capa

El acceso a través del S3 Access Point requiere 2 capas de autenticación:

1. **Autenticación IAM**: Política del S3 Access Point + política basada en identidad IAM
2. **Autenticación del sistema de archivos**: ACL NTFS (mapeo de usuario Windows)

```
Bedrock KB Role → S3 Access Point Policy (IAM) → FSx NTFS ACL (File System)
                   ↓                                ↓
                   IAM Allow                        ACL Allow
                   ↓                                ↓
                   Both Allow → Access Granted
```

---

## Criterios de selección del almacén de vectores

### S3 Vectors vs OpenSearch Serverless

| Aspecto | S3 Vectors | OpenSearch Serverless |
|---------|-----------|---------------------|
| Costo (pequeña escala) | Unos pocos dólares/mes | $700+/mes (mínimo 2 OCU) |
| Costo (gran escala) | Proporcional a la cantidad de vectores | Proporcional a la cantidad de OCU |
| Latencia de consulta | Frío: sub-segundo, Caliente: ~100ms | Siempre ~50ms |
| Cantidad máxima de vectores | 10,000 índices/bucket | Virtualmente ilimitado |
| Filtro de metadatos | 2KB/vector (filtrable) | Límites relajados |
| Escalabilidad | Automática | Escalado de OCU manual/automático |
| Sobrecarga operativa | Casi cero | Se requiere monitoreo de OCU |
| Exportación | → OpenSearch Serverless (un clic) | — |

### Diagrama de flujo de selección

```
¿Usuarios concurrentes < 10 Y cantidad de documentos < 10,000?
  → Sí: S3 Vectors (prioridad de costo)
  → No:
    ¿Requisito de latencia < 100ms?
      → Sí: OpenSearch Serverless
      → No:
        ¿Presupuesto mensual < $1,000?
          → Sí: S3 Vectors (latencia aceptable)
          → No: OpenSearch Serverless
```

### Ruta de migración

La migración de S3 Vectors → OpenSearch Serverless se puede realizar con exportación de un clic desde la consola (toma ~15 min). La migración inversa se logra mediante re-sincronización de KB.

---

## Diseño de indexación inicial

### Enfoque recomendado

| Cantidad de documentos | Método | Notas |
|------------------------|--------|-------|
| ~1,000 | Sincronización KB por lotes | Se completa con un solo `StartIngestionJob` |
| ~10,000 | Sincronización KB por lotes | Esperar a que se complete la sincronización (30–60 min) |
| ~100,000 | División por lotes | Dividir fuentes de datos y sincronizar incrementalmente |
| 100,000+ | Ingesta gradual | Ingestar por carpeta → repetir sincronización |

### Consideraciones de indexación inicial

1. **Aumento temporal del rendimiento de FSx**: La carga de lectura es alta durante la indexación inicial, por lo que considere aumentar temporalmente la capacidad de rendimiento
2. **Conexiones concurrentes del S3 Access Point**: Bedrock KB lee archivos en paralelo, así que tenga en cuenta los límites de conexiones concurrentes de FSx
3. **Pre-preparar `.metadata.json`**: Confirme que todos los documentos tienen `.metadata.json` antes de iniciar la sincronización
4. **Cambios de archivos durante la sincronización**: Pueden ocurrir inconsistencias si se modifican archivos durante la sincronización. Se recomienda una congelación de cambios durante la sincronización inicial

---

## Diseño de sincronización incremental

### Comportamiento de KB Auto-Sync

Mecanismo de sincronización incremental habilitado con `enableKbAutoSync=true`:

```
EventBridge Scheduler (intervalo de 5–15 min)
  → Lambda: Obtener lista de archivos del S3 AP vía ListObjectsV2
  → DynamoDB: Comparar con inventario anterior
  → Solo al detectar cambios: Ejecutar StartIngestionJob
  → Si existe trabajo IN_PROGRESS: Omitir (deduplicación)
```

### Mecanismo de detección de cambios

| Objetivo de detección | Método | Notas |
|-----------------------|--------|-------|
| Archivos nuevos | Comparación de LastModified | Claves no presentes en el inventario de DynamoDB |
| Archivos actualizados | Comparación de ETag / LastModified | Claves con valores cambiados |
| Archivos eliminados | Diferencia de inventario | Claves presentes en DynamoDB pero no en S3 AP |

### Desafíos de sincronización incremental a escala

| Cantidad de archivos | Duración de ListObjectsV2 | Contramedida |
|---------------------|---------------------------|--------------|
| ~10,000 | Varios segundos | Sin problemas |
| ~100,000 | Decenas de segundos | Extender timeout de Lambda (15 min) |
| 100,000+ | Varios minutos o más | División por prefijo, Step Functions |

---

## Diseño de QoS (Calidad de Servicio)

Cuando múltiples inquilinos o cargas de trabajo comparten FSx, las políticas de QoS pueden controlar el rendimiento.

### Configuración de QoS recomendada

| Carga de trabajo | Prioridad | Límite de IOPS | Límite de rendimiento |
|------------------|-----------|-----------------|----------------------|
| Búsqueda RAG (vía S3 AP) | Alta | Ilimitado | Ilimitado |
| Sincronización KB (lotes) | Media | 5,000 IOPS | 100 MB/s |
| Acceso de usuario CIFS/SMB | Alta | Ilimitado | Ilimitado |
| Respaldo / SnapMirror | Baja | 2,000 IOPS | 50 MB/s |

### Aplicación de políticas de QoS

```bash
# Crear grupo de políticas QoS vía ONTAP CLI
qos policy-group create -policy-group kb-sync-limit \
  -vserver svm1 -max-throughput 100MB/s -min-throughput 0

# Aplicar política QoS al volumen
volume modify -vserver svm1 -volume kb_data \
  -qos-policy-group kb-sync-limit
```

---

## Monitoreo de capacidad y expansión automática

### Métricas de monitoreo

| Métrica | Umbral | Acción |
|---------|--------|--------|
| Utilización de SSD | > 80% | Expandir capacidad o revisar política de tiering |
| Utilización de Capacity Pool | > 90% | Expandir capacidad |
| Utilización de IOPS | > 80% | Aumentar capacidad de rendimiento |
| Utilización de ancho de banda de red | > 70% | Aumentar capacidad de rendimiento |

### Expansión automática (FSx for ONTAP Ops)

La Lambda de monitoreo de capacidad incluida en `automation/fsxn-ops/` realiza la expansión automática:

- Monitorea la utilización del volumen cada 5 minutos vía EventBridge
- Expande automáticamente el tamaño del volumen cuando se supera el umbral
- Capacity Guardrails (límite diario, período de enfriamiento) previenen la sobre-expansión
- CloudWatch Dashboard visualiza el historial de expansión

---

## Consejos de optimización de costos

### 1. Aprovechar el Capacity Pool Tiering

La mayoría de los documentos objetivo para búsqueda RAG rara vez se acceden una vez embebidos. Establezca la política de tiering en `auto` para mover automáticamente los datos de acceso infrecuente al nivel de bajo costo.

### 2. Dimensionar correctamente la capacidad de rendimiento

La carga de lectura disminuye significativamente después de la indexación inicial. Sincronice con alto rendimiento inicialmente, luego reduzca el rendimiento durante la fase operativa para reducir costos.

```bash
# Cambiar capacidad de rendimiento (sin tiempo de inactividad)
aws fsx update-file-system \
  --file-system-id fs-0123456789abcdef0 \
  --ontap-configuration ThroughputCapacity=128
```

### 3. Aprovechar S3 Vectors

Para entornos pequeños a medianos, use S3 Vectors (unos pocos dólares/mes) para evitar los costos de OpenSearch Serverless ($700+/mes). La exportación de un clic está disponible cuando aumentan los requisitos de rendimiento.

---

## Documentos relacionados

| Documento | Descripción |
|-----------|-------------|
| [permission-consistency.md](permission-consistency.md) | Modelo de consistencia de cambios de permisos |
| [s3-vectors-sid-architecture-guide.md](s3-vectors-sid-architecture-guide.md) | Arquitectura S3 Vectors + SID |
| [stack-architecture-comparison.md](stack-architecture-comparison.md) | Comparación de 3 configuraciones |
| [automation/fsxn-ops/README.md](../automation/fsxn-ops/README.md) | Automatización de operaciones FSx for ONTAP |
