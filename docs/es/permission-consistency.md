# Modelo de consistencia de cambios de permisos

**🌐 Language:** [日本語](../permission-consistency.md) | [English](../en/permission-consistency.md) | [한국어](../ko/permission-consistency.md) | [简体中文](../zh-CN/permission-consistency.md) | [繁體中文](../zh-TW/permission-consistency.md) | [Français](../fr/permission-consistency.md) | [Deutsch](../de/permission-consistency.md) | **Español**

**Creado**: 2026-05-21  
**Estado**: Borrador  
**Audiencia**: Diseñadores de operaciones, ingenieros de seguridad

---

## Descripción general

Este documento aclara cuándo y cómo los cambios en las ACL de archivos en FSx for ONTAP se reflejan en el almacén de vectores y la caché de permisos, y define los niveles de garantía de consistencia durante los cambios de permisos.

---

## Flujo general de datos de permisos

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                     Flujo de propagación de cambios de permisos                │
│                                                                              │
│  ① Cambio ACL      ② Regeneración de     ③ Re-sincronización ④ Invalidación │
│                       metadatos              de KB               de caché    │
│                                                                              │
│  ┌──────────┐      ┌──────────────┐      ┌──────────────┐      ┌────────┐  │
│  │ FSx for ONTAP│      │ .metadata    │      │ Bedrock KB   │      │DynamoDB│  │
│  │ NTFS ACL │─────▶│ .json update │─────▶│ StartIngest  │─────▶│perm-   │  │
│  │ Change   │      │              │      │ ionJob       │      │cache   │  │
│  └──────────┘      └──────────────┘      └──────────────┘      │TTL     │  │
│                                                                  │expiry  │  │
│  Admin cambia       Rol de servicio       KB Auto-Sync          └────────┘  │
│  permisos de        Lambda re-recupera    (EventBridge           TTL 5-min   │
│  archivo            ACL                   Scheduler)             invalidación│
│                                           o trigger manual       automática  │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Detalles de cada paso

### Paso ①: Cambio de ACL (FSx for ONTAP)

| Operación | Tiempo de reflejo | Notas |
|-----------|-------------------|-------|
| Cambio de ACL de archivo | Inmediato (en FSx) | La ACL NTFS se refleja inmediatamente en el volumen FSx |
| Cambio de membresía de grupo | Después de la propagación de AD (típicamente dentro de 15 min) | Depende del retraso de replicación de AD |
| Movimiento de archivo (rename/move) | Inmediato (en FSx) | Los permisos heredados se recalculan |
| Cambio de permisos heredados | Inmediato (en FSx) | Los cambios de ACL de la carpeta padre se propagan a los hijos |

### Paso ②: Regeneración de metadatos

Métodos para actualizar `allowed_group_sids` en `.metadata.json`:

| Método | Disparador | Retraso | Notas |
|--------|-----------|---------|-------|
| Carga vía Transfer Family | Al cargar archivo | Inmediato | Cuando `enableTransferFamily=true`. Genera metadatos automáticamente para archivos cargados |
| AD Sync Lambda | Manual / Programado | Depende de la configuración | `lambda/agent-core-ad-sync/` re-recupera ACL NTFS |
| Actualización manual | Operación de administrador | Inmediato | Para la ruta de respaldo del bucket S3, actualizar `.metadata.json` directamente |

### Paso ③: Actualización del almacén de vectores (Re-sincronización de KB)

| Método | Disparador | Retraso | Notas |
|--------|-----------|---------|-------|
| KB Auto-Sync | EventBridge Scheduler (sondeo) | Intervalo configurado (predeterminado: 15 min) | Cuando `enableKbAutoSync=true`. Ejecuta StartIngestionJob solo cuando se detectan cambios en archivos |
| Sincronización manual de KB | Consola AWS / CLI | Inicia inmediatamente, se completa en minutos | `aws bedrock-agent start-ingestion-job` |
| Evento CloudTrail | S3 PutObject | Varios minutos | Cuando `enableCloudTrailIngestion=true` en la ruta de Transfer Family |

**Duración estimada de sincronización de KB:**

| Cantidad de documentos | Tiempo de sincronización (estimado) |
|------------------------|-------------------------------------|
| ~100 | 1–3 min |
| ~1,000 | 5–15 min |
| ~10,000 | 30–60 min |
| ~100,000 | Varias horas (se recomienda sincronización incremental) |

### Paso ④: Invalidación de caché de permisos

| Caché | TTL | Método de invalidación | Notas |
|-------|-----|------------------------|-------|
| DynamoDB `perm-cache` | 5 min | Expiración automática de TTL | Caché de resultados de filtrado |
| DynamoDB `user-access` | Ninguno (persistente) | Se requiere actualización explícita | SID de usuario / SID de grupo |
| Sesión del navegador | Durante la sesión | Cierre de sesión / expiración de sesión | Caché en memoria del frontend |

---

## Retraso máximo de propagación de permisos

### Operaciones normales

```
Cambio ACL → Regeneración de metadatos → Re-sincronización KB → Expiración de caché
  0 min        0–15 min                   1–15 min               0–5 min
                                              
Retraso máximo: ~35 min (15 min sondeo + 15 min sincronización KB + 5 min caché)
```

### Expresión estilo RPO

| Escenario | Retraso máximo | Descripción |
|-----------|----------------|-------------|
| Operaciones normales (KB Auto-Sync intervalo 15 min) | Máx 35 min | Intervalo de sondeo + sincronización KB + TTL de caché |
| Sincronización de alta frecuencia (KB Auto-Sync intervalo 5 min) | Máx 15 min | Intervalo de sondeo reducido |
| Sincronización manual inmediata | Máx 10 min | Sincronización manual de KB + TTL de caché |
| Revocación de permisos de emergencia | Máx 5 min | Limpieza forzada de caché + Fail-Closed |

---

## Procedimiento de revocación de permisos de emergencia

Cuando se requiere la revocación inmediata de los permisos de acceso de un usuario:

### Paso 1: Eliminar SID del usuario de DynamoDB (efecto inmediato)

```bash
# Eliminar datos de SID del usuario → Fail-Closed deniega todos los documentos
aws dynamodb delete-item \
  --table-name perm-rag-demo-demo-user-access \
  --key '{"userId": {"S": "target-user@example.com"}}'
```

### Paso 2: Limpieza forzada de caché de permisos

```bash
# Eliminar entradas de caché para el usuario objetivo
aws dynamodb scan \
  --table-name perm-rag-demo-demo-perm-cache \
  --filter-expression "userId = :uid" \
  --expression-attribute-values '{":uid": {"S": "target-user@example.com"}}' \
  --projection-expression "cacheKey" \
  | jq -r '.Items[].cacheKey.S' \
  | xargs -I {} aws dynamodb delete-item \
    --table-name perm-rag-demo-demo-perm-cache \
    --key '{"cacheKey": {"S": "{}"}}'
```

### Paso 3: Deshabilitar usuario de Cognito (invalidación de sesión)

```bash
# Deshabilitar usuario de Cognito
aws cognito-idp admin-disable-user \
  --user-pool-id <USER_POOL_ID> \
  --username target-user@example.com
```

### Efecto

- Después del Paso 1: Las nuevas solicitudes de búsqueda deniegan inmediatamente todos los documentos (Fail-Closed)
- Después del Paso 2: Previene el uso de información de permisos antigua en caché
- Después del Paso 3: Invalida la sesión del usuario en sí

---

## Comportamiento por escenario de cambio de permisos

### Escenario 1: Cambio de ACL de archivo

```
Admin elimina al Usuario X de la ACL del Archivo A
  → Eliminar SID del Usuario X de allowed_group_sids en .metadata.json
  → Re-sincronización de KB actualiza metadatos del almacén de vectores
  → Archivo A se excluye de los próximos resultados de búsqueda del Usuario X
```

**Retraso**: Máx 35 min (operaciones normales)

### Escenario 2: Cambio de membresía de grupo AD

```
Admin elimina al Usuario X del grupo Engineering
  → Replicación de AD (~15 min)
  → groupSIDs de DynamoDB user-access actualizados (en ejecución de AD Sync Lambda)
  → Documentos restringidos al grupo Engineering excluidos de la próxima búsqueda del Usuario X
```

**Retraso**: Replicación de AD + intervalo de ejecución de AD Sync Lambda + TTL de caché

### Escenario 3: Movimiento de archivo (rename / move)

```
Admin mueve Archivo A de /public/ a /confidential/
  → Permisos heredados recalculados en FSx
  → Se requiere regeneración de .metadata.json
  → Re-sincronización de KB actualiza metadatos del almacén de vectores
```

**Nota**: La regeneración automática de `.metadata.json` puede no ocurrir al mover archivos. Se recomienda un diseño donde el sondeo de KB Auto-Sync detecte cambios en la ruta del archivo y active la regeneración de metadatos.

### Escenario 4: Cambio de permisos heredados

```
Admin cambia ACL en la carpeta /confidential/ (herencia habilitada)
  → Los permisos efectivos cambian para todos los archivos debajo
  → Se requiere regeneración de .metadata.json para cada archivo
  → Re-sincronización de KB
```

**Nota**: Los cambios masivos de permisos para grandes cantidades de archivos toman tiempo para la sincronización de KB. Se recomiendan cambios graduales.

---

## Niveles de garantía de consistencia

| Nivel | Garantía | Implementación |
|-------|----------|----------------|
| **Fail-Closed** | Denegar todo si no se puede recuperar la información de SID | En error de DynamoDB / sin registro |
| **Eventualmente consistente** | Los cambios de ACL se reflejan eventualmente en los resultados de búsqueda | KB Auto-Sync + TTL de caché |
| **Sin falsos positivos** | Los documentos sin permiso nunca se muestran | Coincidencia de SID (intersección de conjuntos) |
| **Metadatos requeridos** | Los documentos sin metadatos se excluyen | Se requiere `.metadata.json` |

### Nota: Posibilidad de falsos negativos

En los siguientes casos, los documentos que deberían ser accesibles pueden no mostrarse temporalmente (falso negativo):

- Inmediatamente después de la concesión de permisos (metadatos aún no actualizados)
- Durante la sincronización de KB (metadatos antiguos permanecen)
- Durante el retraso de replicación de AD

**Principio de diseño**: Por seguridad, se toleran los falsos negativos (elementos accesibles no visibles), mientras que los falsos positivos (elementos restringidos visibles) tienen como objetivo cero ocurrencias.

---

## Configuración recomendada de monitoreo y alertas

```yaml
# Configuración recomendada de alarmas de CloudWatch
Alarms:
  - Name: PermCacheHighMissRate
    Metric: CacheMissRate
    Threshold: 80%  # Alta tasa de fallos de caché = alta frecuencia de actualización de datos de permisos
    
  - Name: KBSyncFailure
    Metric: IngestionJobFailureCount
    Threshold: 3  # Alerta en 3 fallos consecutivos
    
  - Name: SIDResolutionFailure
    Metric: SIDResolutionErrorCount
    Threshold: 1  # Alerta inmediata en fallo de resolución de SID
    
  - Name: PermissionDenyAllFallback
    Metric: DenyAllFallbackCount
    Threshold: 5  # Investigar si Fail-Closed se activa frecuentemente
```

---

## Documentos relacionados

| Documento | Descripción |
|-----------|-------------|
| [SID-Filtering-Architecture.md](SID-Filtering-Architecture.md) | Detalles de la arquitectura de filtrado SID |
| [production-readiness-checklist.md](production-readiness-checklist.md) | Lista de verificación de preparación para producción |
| [fsxn-sizing-and-performance.md](fsxn-sizing-and-performance.md) | Dimensionamiento y rendimiento de FSx for ONTAP |
