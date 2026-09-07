# Modelo de consistencia de metadatos de permisos

**🌐 Language:** [日本語](../permission-consistency.md) | [English](../en/permission-consistency.md) | [한국어](../ko/permission-consistency.md) | [简体中文](../zh-CN/permission-consistency.md) | [繁體中文](../zh-TW/permission-consistency.md) | [Français](../fr/permission-consistency.md) | [Deutsch](../de/permission-consistency.md) | **Español**

**Creado**: 2026-05-21
**Actualizado**: 2026-09-07 (se retira la descripción del flujo de propagación automática con origen en las ACL, tras verificar la implementación)
**Estado**: Borrador
**Audiencia**: Diseñadores de operaciones, ingenieros de seguridad

---

## Resumen

Este documento define cuándo un cambio en los datos usados para la decisión de permisos en tiempo de consulta se refleja en los resultados de búsqueda. Se usan dos conjuntos: `.metadata.json` del lado del documento y la tabla DynamoDB `user-access` del lado del usuario.

**No existe ningún mecanismo que siga automáticamente los cambios de ACL NTFS de los archivos en FSx for ONTAP.** El índice de permisos no es una proyección de la ACL, sino un índice construido y mantenido por separado. Los motivos y las implicaciones operativas están en «Por qué los cambios de ACL no llegan».

---

## Datos usados para la decisión de permisos

| Datos | Ubicación | Producido/actualizado por | Función en tiempo de consulta |
|-------|-----------|---------------------------|-------------------------------|
| `.metadata.json` (`allowed_group_sids` / `allowed_uids` / `allowed_gids`) | Objeto adyacente en el S3 AP → atributo de metadatos en el Bedrock KB | Según la ruta (véase abajo) | Conjunto de SID / UID / GID permitidos del fragmento recuperado |
| `user-access` (`userSID` / `groupSIDs` / `uid` / `gid` / `unixGroups`) | DynamoDB | Lambda de sincronización AD / LDAP (`lambda/agent-core-ad-sync/`) | Conjunto de SID / UID / GID del solicitante |
| `perm-cache` | DynamoDB (TTL 5 minutos) | Filtro de permisos | Caché de los resultados de decisión |

Origen de `.metadata.json`:

| Ruta | Origen | Disparador |
|------|--------|-----------|
| Transfer Family SFTP (`enableTransferFamily=true`) | Mapeo en DynamoDB mantenido por el administrador (clave: nombre del usuario de carga) | Al subir el archivo |
| Servidor de embeddings autoalojado (`ENV_AUTO_METADATA=true`, opcional, no por defecto) | ACL NTFS real obtenida mediante la API REST de ONTAP | Al detectar un archivo no procesado (según `mtime`) |
| Entorno de demostración | Ejemplos incluidos en el repositorio, colocados manualmente | Manual |

Los usuarios SFTP llevan un Deny de IAM sobre `*.metadata.json`, de modo que quien sube un archivo no puede redactar sus propios permisos.

---

## Rutas de propagación

Se propagan automáticamente dos rutas.

### Ruta A: cambio de permisos del lado del documento

| Paso | A cargo de | Latencia |
|------|-----------|----------|
| ① Actualización de `.metadata.json` | El origen de la tabla anterior, o una actualización directa por parte del administrador | Según el disparador |
| ② Detección de diferencias | KB Auto-Sync (EventBridge Scheduler; compara `size` / `lastModified` / `ETag`) | Intervalo de sondeo (15 min por defecto) |
| ③ Actualización del almacén vectorial | `StartIngestionJob` | 1–15 min (según el número de documentos) |
| ④ Caducidad de la caché de decisión | TTL de `perm-cache` | Hasta 5 min |

### Ruta B: cambio de permisos del lado del usuario

| Paso | A cargo de | Latencia |
|------|-----------|----------|
| ① Cambio de pertenencia a un grupo de AD | Replicación de AD | Normalmente en 15 min |
| ② Actualización de `user-access` | Lambda de sincronización AD / LDAP. **Se dispara por Cognito PostAuthentication / PostConfirmation; no hay ejecución programada** | Hasta el próximo inicio de sesión del usuario (indefinido) |
| ③ Caducidad de la caché de decisión | TTL de `perm-cache`, o invalidación explícita mediante DynamoDB Streams de `user-access` | Hasta 5 min |

El paso ② de la ruta B nunca llega para un usuario cuya sesión continúa. Para revocar de forma fiable, use el procedimiento de revocación de emergencia.

---

## Por qué los cambios de ACL no llegan

Cambiar la ACL NTFS de un archivo no regenera `.metadata.json` en ninguna configuración de despliegue. Verificado contra la implementación:

| Mecanismo | ¿Se ejecuta ante un cambio de ACL? | Base |
|-----------|-----------------------------------|------|
| Lambda de sincronización AD / LDAP | No | No implementa ni la obtención de ACL ni la escritura de `.metadata.json`. Solo obtiene los SID de usuario desde AD |
| Generación de metadatos de Transfer Family | No | Se dispara al subir el archivo. El origen es un mapeo en DynamoDB mantenido por el administrador, que no consulta la ACL |
| Servidor de embeddings autoalojado (`ENV_AUTO_METADATA=true`) | No | El reprocesamiento se basa en `mtime`. Un cambio solo de ACL no altera `mtime` |
| KB Auto-Sync | No | La diferencia se calcula sobre `size` / `lastModified` / `ETag`. Un cambio de ACL no altera ninguno |
| Servicio de permisos FSx (`lambda/permissions/fsx-permission-service.ts`) | Fuera de alcance | Existe código que lee ACL, pero ningún stack de CDK lo despliega |

**Implicación**: para reflejar un cambio de ACL en los resultados de búsqueda, un operador debe regenerar `.metadata.json` y colocarlo en el S3 AP. La corrección de este índice depende de la operación; la coincidencia con la ACL no está garantizada automáticamente. Para bloqueos urgentes de acceso, actúe del lado del usuario (borrado en `user-access` + limpieza de caché + invalidación de sesión) en lugar de sobre la ACL.

---

## Detalle de los pasos

### Actualización del almacén vectorial (resincronización del KB)

| Método | Disparador | Latencia | Notas |
|--------|-----------|----------|-------|
| KB Auto-Sync | EventBridge Scheduler (sondeo) | Intervalo configurado (por defecto: 15 min) | Con `enableKbAutoSync=true`. StartIngestionJob se ejecuta solo si se detecta un cambio de archivo |
| Sincronización manual del KB | Consola AWS / CLI | Inicio inmediato, finaliza en minutos | `aws bedrock-agent start-ingestion-job` |
| Evento de CloudTrail | S3 PutObject | Minutos | En la ruta de Transfer Family con `enableCloudTrailIngestion=true` |

**Duración indicativa de la sincronización del KB:**

| Número de documentos | Tiempo de sincronización (indicativo) |
|----------------------|---------------------------------------|
| hasta 100 | 1–3 min |
| hasta 1.000 | 5–15 min |
| hasta 10.000 | 30–60 min |
| hasta 100.000 | Horas (se recomienda sincronización incremental) |

### Invalidación de la caché de permisos

| Caché | TTL | Invalidación | Notas |
|-------|-----|--------------|-------|
| DynamoDB `perm-cache` | 5 min | Caducidad del TTL / borrado explícito mediante Streams de `user-access` | Caché de los resultados de filtrado |
| DynamoDB `user-access` | Ninguno (persistente) | Requiere actualización explícita | SID de usuario / SID de grupos |
| Sesión del navegador | Durante la sesión | Cierre de sesión / caducidad | Caché en memoria del front-end |

---

## Retardo máximo de propagación

| Origen | Retardo máximo | Desglose |
|--------|----------------|----------|
| Cambio del lado del documento (ruta A, Auto-Sync cada 15 min) | ~35 min | 15 min de sondeo + 15 min de sincronización del KB + 5 min de caché |
| Cambio del lado del documento (Auto-Sync cada 5 min) | ~25 min | 5 min de sondeo + 15 min de sincronización del KB + 5 min de caché |
| Cambio del lado del documento (sincronización manual del KB) | ~20 min | 15 min de sincronización del KB + 5 min de caché |
| Cambio del lado del usuario (ruta B) | No definible | 15 min de replicación de AD + hasta el próximo inicio de sesión (indefinido) + 5 min de caché |
| Revocación de emergencia (procedimiento abajo) | Hasta 5 min | Limpieza forzada de caché + Fail-Closed |
| Cambio de la ACL de un archivo | **No definible** | Ningún mecanismo lo sigue. Supone que un operador regenere `.metadata.json` |

Los 15 min de sincronización del KB dependen del número de documentos (véase la duración indicativa arriba). Con 10.000 documentos pasan a 30–60 min, y el retardo total crece en consecuencia.

---

## Procedimiento de revocación de emergencia

Cuando hay que revocar el acceso de un usuario de inmediato:

### Paso 1: eliminar los SID del usuario de DynamoDB (efecto inmediato)

```bash
# Eliminar los datos de SID del usuario → Fail-Closed rechaza todos los documentos
aws dynamodb delete-item \
  --table-name perm-rag-demo-demo-user-access \
  --key '{"userId": {"S": "target-user@example.com"}}'
```

### Paso 2: limpiar forzadamente la caché de permisos

```bash
# Eliminar las entradas de caché del usuario
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

### Paso 3: deshabilitar el usuario de Cognito (invalidación de sesión)

```bash
# Deshabilitar el usuario de Cognito
aws cognito-idp admin-disable-user \
  --user-pool-id <USER_POOL_ID> \
  --username target-user@example.com
```

### Efecto

- Tras el paso 1: las nuevas solicitudes de búsqueda se rechazan de inmediato para todos los documentos (Fail-Closed)
- Tras el paso 2: los datos de permisos en caché ya no pueden usarse
- Tras el paso 3: la sesión del usuario queda invalidada

**Tenga en cuenta que este procedimiento detiene el lado del usuario, no el del documento.** Ocultar un documento concreto a una sola persona pasa por la actualización de `.metadata.json` y la resincronización del KB, y por tanto sufre el retardo de la ruta A.

---

## Comportamiento por escenario de cambio

### Escenario 1: cambio de los metadatos de permisos de un documento

```
El administrador elimina el SID de User X del .metadata.json del archivo A
  → KB Auto-Sync detecta la diferencia (ETag cambiado)
  → StartIngestionJob actualiza los metadatos del almacén vectorial
  → Tras caducar el TTL de perm-cache, el archivo A queda excluido de las búsquedas de User X
```

**Retardo**: hasta ~35 min (Auto-Sync cada 15 min)

### Escenario 2: cambio de pertenencia a un grupo de AD

```
El administrador elimina a User X del grupo Engineering
  → Replicación de AD (~15 min)
  → En el próximo inicio de sesión de User X, la Lambda de sincronización AD actualiza groupSIDs en user-access
  → Tras caducar perm-cache, se excluyen los documentos exclusivos de Engineering
```

**Retardo**: replicación de AD + hasta el próximo inicio de sesión (indefinido) + TTL de caché. **Nada se refleja mientras la sesión continúa.** Si se requiere inmediatez, use el procedimiento de revocación de emergencia.

### Escenario 3: movimiento de archivo (rename / move)

```
El administrador mueve el archivo A de /public/ a /confidential/
  → Los permisos heredados se recalculan en FSx (solo permisos efectivos del lado de ONTAP)
  → .metadata.json no sigue los permisos del destino
  → Un operador debe regenerar y colocar .metadata.json
```

**Nota**: los SID permitidos del origen permanecen, por lo que mover por sí solo no cambia la visibilidad en la búsqueda. Si la estructura de directorios se usa como frontera de permisos, haga del movimiento y de la actualización de `.metadata.json` un único procedimiento.

### Escenario 4: cambio masivo de ACL en una carpeta superior

```
El administrador cambia la ACL de /confidential/ (herencia activada)
  → Los permisos efectivos cambian en ONTAP para todos los archivos inferiores
  → .metadata.json no sigue (véase «Por qué los cambios de ACL no llegan»)
  → Se requiere regenerar .metadata.json de esos archivos más una resincronización del KB
```

**Nota**: los cambios masivos sobre muchos archivos alargan la resincronización. Se recomiendan cambios por fases.

---

## Niveles de garantía de consistencia

| Nivel | Garantía | Implementación |
|-------|----------|----------------|
| **Fail-Closed** | Denegar todo cuando no se puede obtener la información de SID | Ante error de DynamoDB / registro ausente |
| **Eventually Consistent** | Los cambios de los metadatos de permisos (`.metadata.json` / `user-access`) llegan finalmente a los resultados de búsqueda | KB Auto-Sync + TTL de caché + invalidación por Streams |
| **No False Positive** | No se muestran documentos sin permiso | Coincidencia de SID (intersección de conjuntos) |
| **Metadata Required** | Se excluyen los documentos sin metadatos | `.metadata.json` obligatorio |
| **Ausencia de seguimiento de ACL** | Los cambios de ACL de archivos no se reflejan automáticamente | Supone que un operador regenere `.metadata.json` |

### Nota: posibles falsos negativos

En los casos siguientes, un documento al que el usuario tiene derecho puede no aparecer temporalmente (falso negativo):

- Justo después de una concesión (`.metadata.json` aún sin actualizar, o antes de la resincronización del KB)
- Durante la sincronización del KB (metadatos antiguos aún presentes)
- Durante un retardo de replicación de AD, o antes de que el usuario vuelva a iniciar sesión

**Postura de diseño**: por seguridad, se aceptan los falsos negativos (algo que debería verse no se ve) y se persigue cero falsos positivos (algo que no debe verse se ve).

Sin embargo, **esta postura supone que el índice de permisos es correcto.** Si se restringió una ACL pero no se actualizó `.metadata.json`, el índice sigue devolviendo permiso, lo que es un falso positivo. El mantenimiento del índice es la frontera misma.

---

## Monitorización y alertas recomendadas

```yaml
# Alarmas de CloudWatch recomendadas
Alarms:
  - Name: PermCacheHighMissRate
    Metric: CacheMissRate
    Threshold: 80%  # tasa de fallos alta = actualizaciones frecuentes de datos de permisos

  - Name: KBSyncFailure
    Metric: IngestionJobFailureCount
    Threshold: 3  # alerta tras 3 fallos consecutivos

  - Name: SIDResolutionFailure
    Metric: SIDResolutionErrorCount
    Threshold: 1  # alerta inmediata ante fallo de resolución de SID

  - Name: PermissionDenyAllFallback
    Metric: DenyAllFallbackCount
    Threshold: 5  # activaciones frecuentes de Fail-Closed requieren investigación
```

---

## Documentos relacionados

| Documento | Contenido |
|-----------|-----------|
| [SID-Filtering-Architecture.md](SID-Filtering-Architecture.md) | Detalles del diseño del filtrado por SID |
| [production-readiness-checklist.md](production-readiness-checklist.md) | Checklist de preparación para producción |
| [fsxn-sizing-and-performance.md](fsxn-sizing-and-performance.md) | Diseño de rendimiento y capacidad de FSx for ONTAP |
