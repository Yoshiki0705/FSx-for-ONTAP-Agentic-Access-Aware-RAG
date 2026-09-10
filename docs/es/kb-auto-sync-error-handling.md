# Diseño del manejo de errores de KB Auto-Sync

**🌐 Language:** [日本語](../kb-auto-sync-error-handling.md) | [English](../en/kb-auto-sync-error-handling.md) | [한국어](../ko/kb-auto-sync-error-handling.md) | [简体中文](../zh-CN/kb-auto-sync-error-handling.md) | [繁體中文](../zh-TW/kb-auto-sync-error-handling.md) | [Français](../fr/kb-auto-sync-error-handling.md) | [Deutsch](../de/kb-auto-sync-error-handling.md) | **Español**

## Descripción general

Este documento define el flujo ante errores, la estrategia de reintento, las alertas y los procedimientos de recuperación manual de KB Auto-Sync (`enableKbAutoSync=true`).

## Mecanismos de detección de errores

### CloudWatch Alarm (detección automática)

```
EventBridge Scheduler (cada 5 min)
  → ejecución de la Lambda
    → éxito: métricas normales
    → fallo: métrica Lambda Errors +1
      → 3 errores consecutivos: se dispara la alarma de CloudWatch
        → notificación SNS (si enableMonitoring=true)
```

**Configuración de la alarma:**
- Nombre: `${prefix}-kb-auto-sync-errors`
- Umbral: 1 error × 3 periodos consecutivos
- Periodo: igual al intervalo de sondeo (5 minutos por defecto)
- Datos ausentes: NOT_BREACHING (sin alarma mientras la Lambda no se ejecuta)

### Métricas EMF (supervisión detallada)

La Lambda de KB Auto-Sync emite las siguientes métricas personalizadas:

| Métrica | Namespace | Significado |
|---|---|---|
| `FilesScanned` | `KbAutoSync` | Número de archivos analizados |
| `FilesChanged` | `KbAutoSync` | Número de archivos detectados como modificados |
| `IngestionJobTriggered` | `KbAutoSync` | Número de trabajos de ingesta iniciados |
| `IngestionJobFailed` | `KbAutoSync` | Número de trabajos de ingesta fallidos |
| `InventoryDiffErrors` | `KbAutoSync` | Número de errores al calcular la diferencia de inventario |

## Patrones de error y respuestas

### Patrón 1: error de ListObjectsV2 en el Access Point de S3

**Causa**: fallo de conexión con FSx for ONTAP S3 AP, permisos de IAM insuficientes o Access Point eliminado

**Comportamiento**:
- la Lambda registra el error y lanza una excepción
- la alarma de CloudWatch se dispara tras tres fallos consecutivos
- el inventario de DynamoDB queda intacto, lo que preserva la atomicidad

**Recuperación manual**:
```bash
# 1. Comprobar que el Access Point de S3 existe
aws fsx describe-s3-access-points --volume-id <VOLUME_ID> --region ap-northeast-1

# 2. Revisar el ARN del Access Point en el entorno de la Lambda
aws lambda get-function-configuration \
  --function-name ${PREFIX}-kb-auto-sync \
  --query 'Environment.Variables.S3_ACCESS_POINT_ARN'

# 3. Probar con una invocación manual
aws lambda invoke --function-name ${PREFIX}-kb-auto-sync /dev/stdout
```

### Patrón 2: fallo del trabajo de ingesta de Bedrock KB

**Causa**: configuración incorrecta de la fuente de datos del KB, error de permisos en el Access Point de S3, o error de fragmentación/análisis

**Comportamiento**:
- la Lambda sigue el estado con `StartIngestionJob` y luego `GetIngestionJob`
- cuando el estado es `FAILED`:
  - el archivo pasa a `status: "failed"` en el inventario de DynamoDB
  - no se reingesta en el siguiente sondeo, lo que evita un bucle de reintentos infinito
  - se emite la métrica `IngestionJobFailed`
- cuando el estado es `IN_PROGRESS`:
  - no se inicia ningún trabajo duplicado (IN_PROGRESS actúa como exclusión mutua)

**Recuperación manual**:
```bash
# 1. Inspeccionar el trabajo fallido
aws bedrock-agent list-ingestion-jobs \
  --knowledge-base-id <KB_ID> \
  --data-source-id <DS_ID> \
  --filters '[{"attribute":"STATUS","operator":"EQ","values":["FAILED"]}]'

# 2. Localizar los archivos fallidos en el inventario
aws dynamodb scan \
  --table-name ${PREFIX}-kb-sync-inventory \
  --filter-expression "#s = :failed" \
  --expression-attribute-names '{"#s": "status"}' \
  --expression-attribute-values '{":failed": {"S": "failed"}}'

# 3. Restablecer la entrada del inventario para permitir una nueva ingesta
aws dynamodb delete-item \
  --table-name ${PREFIX}-kb-sync-inventory \
  --key '{"fileKey": {"S": "<file_key>"}}'

# 4. Iniciar la ingesta manualmente
aws bedrock-agent start-ingestion-job \
  --knowledge-base-id <KB_ID> \
  --data-source-id <DS_ID>
```

### Patrón 3: error en la tabla de inventario de DynamoDB

**Causa**: capacidad de DynamoDB agotada, errores de permisos o tabla eliminada

**Comportamiento**:
- la Lambda lanza una excepción y termina de inmediato
- a prueba de fallos: no se actualiza el inventario, por lo que el siguiente sondeo vuelve a analizarlo todo
- la alarma de CloudWatch se dispara tras tres fallos consecutivos

**Recuperación manual**:
```bash
# Comprobar que la tabla de inventario existe
aws dynamodb describe-table --table-name ${PREFIX}-kb-sync-inventory

# Si falta la tabla, volver a desplegar con CDK
npx cdk deploy ${STACK_PREFIX}-AI -c enableKbAutoSync=true
```

### Patrón 4: tiempo de espera de la Lambda (más de 5 minutos)

**Causa**: análisis de una gran cantidad de archivos (>10 000) o latencia alta de ListObjectsV2

**Comportamiento**:
- la Lambda expira a los 5 minutos y la métrica Errors se incrementa
- los archivos analizados parcialmente no se registran en el inventario, lo que preserva la atomicidad

**Mitigación**:
- ampliar `kbAutoSyncIntervalMinutes` (por ejemplo, 15 minutos)
- con muchísimos archivos, considerar dividir el Access Point de S3 por prefijo

## Estrategia de reintento

| Patrón de error | Reintento automático | Intervalo | Número máximo |
|---|---|---|---|
| Error de conexión con el Access Point de S3 | ✅ (siguiente sondeo) | intervalo de sondeo (5 min) | ilimitado (lo detecta la alarma) |
| Fallo de ingesta del KB | ❌ (requiere restablecimiento manual) | — | — |
| Error de DynamoDB | ✅ (siguiente sondeo) | intervalo de sondeo (5 min) | ilimitado (lo detecta la alarma) |
| Tiempo de espera de la Lambda | ✅ (siguiente sondeo) | intervalo de sondeo (5 min) | ilimitado (lo detecta la alarma) |

**Decisión de diseño**: no hay Dead Letter Queue. En un patrón de sondeo periódico gobernado por EventBridge Scheduler, una ejecución fallida se reintenta automáticamente en el siguiente ciclo, así que una DLQ no aporta nada. La excepción es el trabajo de ingesta del KB fallido, que *no* se reintenta automáticamente porque puede indicar un problema de calidad de datos que conviene revisar a mano.

## Comportamiento fail-closed cuando falla la ingesta

Un fallo de KB Auto-Sync no debilita la frontera de permisos del pipeline RAG:

1. **Un inventario sin actualizar deja el índice existente en su sitio.** Los archivos nuevos simplemente no se vuelven buscables; el control de permisos sobre los existentes no cambia.
2. **Los archivos fallidos quedan marcados como `status: "failed"`.** No se reingestan automáticamente; la entrada se restablece después de una revisión humana.
3. **Los trabajos IN_PROGRESS se excluyen mutuamente**, lo que evita la inconsistencia que causaría una ingesta doble.
4. **Los archivos sin metadatos de permisos (`.metadata.json`)** quedan excluidos por el filtro fail-closed en el momento de la consulta, incluso si llegan al KB. La regla fail-closed se aplica siempre.

## Panel de supervisión

Con `enableMonitoring=true`, el panel de CloudWatch incorpora estos widgets:

- **KB Auto-Sync Errors**: la métrica Lambda Errors (periodos de 5 minutos)
- **Ingestion Job Status**: recuento de trabajos correctos, fallidos y en curso
- **Files Changed**: archivos detectados como modificados por sondeo
- **Scan Duration**: tiempo de ejecución de la Lambda (P50/P90/P99)

## Documentos relacionados

- [Modelo de coherencia de los metadatos de permisos](permission-consistency.md) — cómo se relacionan las actualizaciones de permisos con las del índice del KB, y por qué los cambios de ACL no se reflejan automáticamente
- [Guía del panel de CloudWatch](cloudwatch-dashboard-guide.md) — cómo leer las métricas de supervisión
- [Lista de comprobación para producción](production-readiness-checklist.md) — requisitos antes de ejecutar KB Auto-Sync en producción
