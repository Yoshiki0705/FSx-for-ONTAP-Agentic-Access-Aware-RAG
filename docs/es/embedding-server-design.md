# Documento de Diseño e Implementación del Servidor de Embedding

**🌐 Language:** [日本語](../embedding-server-design.md) | [English](../en/embedding-server-design.md) | [한국어](../ko/embedding-server-design.md) | [简体中文](../zh-CN/embedding-server-design.md) | [繁體中文](../zh-TW/embedding-server-design.md) | [Français](../fr/embedding-server-design.md) | [Deutsch](../de/embedding-server-design.md) | **Español**

**Creado**: 2026-03-26  
**Audiencia**: Desarrolladores y Operadores  
**Código fuente**: `docker/embed/`

---

## Descripción general

### Vector Store & Embedding Server

| Configuration | Embedding Server | Description |
|--------------|-----------------|-------------|
| **S3 Vectors** (default) | **Not needed** | Bedrock KB auto-manages via S3 Access Point |
| **OpenSearch Serverless** | **Optional** | Alternative when S3 AP unavailable |

> **S3 Vectors (default): this document is for reference only.** Bedrock KB Ingestion Job handles all processing automatically.

Este servidor lee documentos en FSx ONTAP a través de montaje CIFS/SMB, los vectoriza con Amazon Bedrock Titan Embed Text v2 y los indexa en OpenSearch Serverless (AOSS).

> **Nota**: El servidor de Embedding solo está disponible cuando se configura con AOSS (`vectorStoreType=opensearch-serverless`). Con la configuración de S3 Vectors (predeterminada), Bedrock KB gestiona automáticamente el Embedding, por lo que el servidor de Embedding no es necesario.

Se utiliza como ruta alternativa (Opción B) cuando la fuente de datos S3 de Bedrock KB (Opción A) o el S3 Access Point (Opción C) no pueden utilizarse.

---

## Arquitectura

```
FSx ONTAP Volume (/data)
  │ CIFS/SMB Mount
  ▼
EC2 (m5.large) /tmp/data
  │
  ▼
Docker Container (embed-app)
  ├── 1. Escaneo de archivos (recursivo, .md/.txt/.html, etc.)
  ├── 2. Leer información SID de .metadata.json
  ├── 3. División de texto en chunks (1000 caracteres, 200 caracteres de solapamiento)
  ├── 4. Vectorización con Bedrock Titan Embed v2 (1024 dimensiones)
  └── 5. Indexación en AOSS (formato compatible con Bedrock KB)
          │
          ▼
      OpenSearch Serverless
      (bedrock-knowledge-base-default-index)
```

---

## Estructura del código fuente

```
docker/embed/
├── src/
│   ├── index.ts       # Procesamiento principal (escaneo → chunk → Embedding → índice)
│   └── oss-client.ts  # Cliente de firma SigV4 para AOSS (soporte de autenticación IMDS)
├── Dockerfile         # node:22-slim + cifs-utils
├── buildspec.yml      # Definición de compilación de CodeBuild
├── package.json       # AWS SDK v3, chokidar, dotenv
└── tsconfig.json
```

---

## Modos de ejecución

| Modo | Variable de entorno | Comportamiento |
|------|---------------------|----------------|
| Modo batch | `ENV_WATCH_MODE=false` (predeterminado) | Procesa todos los archivos una vez y finaliza |
| Modo watch | `ENV_WATCH_MODE=true` | Detecta cambios en archivos con chokidar y procesa automáticamente |

---

## Variables de entorno

| Variable | Predeterminado | Descripción |
|----------|----------------|-------------|
| `ENV_REGION` | `ap-northeast-1` | Región de AWS |
| `ENV_DATA_DIR` | `/opt/netapp/ai/data` | Directorio de datos montado por CIFS |
| `ENV_DB_DIR` | `/opt/netapp/ai/db` | Ubicación de almacenamiento para registros de archivos procesados |
| `ENV_EMBEDDING_MODEL_ID` | `amazon.titan-embed-text-v2:0` | Modelo de Embedding |
| `ENV_INDEX_NAME` | `bedrock-knowledge-base-default-index` | Nombre del índice AOSS |
| `ENV_OPEN_SEARCH_SERVERLESS_COLLECTION_NAME` | (requerido) | Nombre de la colección AOSS |
| `ENV_WATCH_MODE` | `false` | Activar modo watch |
| `ENV_AUTO_METADATA` | `false` | Generar automáticamente .metadata.json a través de ONTAP REST API |
| `ENV_ONTAP_MGMT_IP` | (vacío) | IP del endpoint de gestión de ONTAP |
| `ENV_ONTAP_SVM_UUID` | (vacío) | UUID de SVM |
| `ENV_ONTAP_USERNAME` | `fsxadmin` | Nombre de usuario del administrador de ONTAP |
| `ENV_ONTAP_PASSWORD` | (vacío) | Contraseña del administrador de ONTAP |

---

## Flujo de procesamiento

### Modo batch

```
1. Inicializar cliente AOSS (obtener endpoint de la colección)
2. Cargar processed.json (para procesamiento diferencial)
3. Escanear recursivamente DATA_DIR (.md, .txt, .html, .csv, .json, .xml)
4. Para cada archivo:
   a. Omitir si mtime coincide con processed.json
   b. Usar .metadata.json si existe
   c. Si .metadata.json no existe y ENV_AUTO_METADATA=true:
      - Obtener ACL a través de ONTAP REST API (`GET /api/protocols/file-security/permissions/{SVM_UUID}/{PATH}`)
      - Extraer SID de ACL y generar/escribir automáticamente .metadata.json
   d. Leer texto → dividir en chunks (1000 caracteres, 200 caracteres de solapamiento)
   e. Vectorizar cada chunk con Bedrock Titan Embed v2
   f. Indexar en AOSS (formato compatible con Bedrock KB)
   g. Actualizar processed.json
5. Mostrar resumen de procesamiento y finalizar
```

### Modo watch

```
1-5. Igual que el modo batch (escaneo inicial)
6. Iniciar vigilancia de archivos con chokidar
   - awaitWriteFinish: 2 segundos (esperar a que se complete la escritura)
7. Eventos de adición/cambio de archivos → agregar a la cola
8. Procesar secuencialmente desde la cola (prevenir ejecución paralela)
   - processFile() → actualizar processed.json
9. Esperar en bucle infinito
```

---

## Mecanismo de procesamiento diferencial

Las rutas de archivos y los tiempos de modificación (mtime) se registran en `processed.json`.

```json
{
  "public/company-overview.md": {
    "mtime": "2026-03-24T23:55:50.000Z",
    "indexedAt": "2026-03-25T05:30:00.000Z"
  }
}
```

- Omitir si el mtime del archivo no ha cambiado
- Reprocesar si el archivo ha sido actualizado (sobrescribir índice)
- Eliminar `processed.json` para reprocesar todos los archivos

### Diferencias con versiones anteriores

| Elemento | Versión anterior | Versión actual |
|----------|-----------------|----------------|
| Gestión diferencial | SQLite (drizzle-orm + better-sqlite3) | Archivo JSON (processed.json) |
| Identificación de archivos | Número de inode (files.ino) | Ruta de archivo + mtime |
| Carga simultánea masiva de archivos | UNIQUE constraint failed | ✅ Procesado de forma segura mediante cola secuencial |
| Dependencias | drizzle-orm, better-sqlite3 | Ninguna (fs estándar) |

---

## Formato del índice AOSS

Solo se escriben 3 campos compatibles con Bedrock KB.

```json
{
  "bedrock-knowledge-base-default-vector": [0.123, -0.456, ...],  // 1024 dimensiones
  "AMAZON_BEDROCK_TEXT_CHUNK": "Chunk de texto del documento",
  "AMAZON_BEDROCK_METADATA": "{\"source\":\"public/company-overview.md\",\"allowed_group_sids\":[\"S-1-1-0\"],\"access_level\":\"public\"}"
}
```

### Importante: Compatibilidad del esquema del índice AOSS

El índice AOSS se crea con `dynamic: false`. Esto significa:
- El mapeo del índice no cambia aunque se escriban campos distintos a los 3 anteriores
- La sincronización de Bedrock KB no causa errores de "storage configuration invalid"
- Los metadatos (información SID, etc.) se almacenan como cadena JSON dentro del campo `AMAZON_BEDROCK_METADATA`

### Estructura de metadatos

Cada documento requiere un archivo `.metadata.json` correspondiente. Al incluir información SID de ACL NTFS en este archivo, se logra el control de acceso durante la búsqueda RAG.

#### Cómo obtener información SID para `.metadata.json`

Este sistema tiene un mecanismo para recuperar automáticamente SIDs de las ACLs NTFS.

| Componente | Archivo de implementación | Función |
|------------|--------------------------|---------|
| AD Sync Lambda | `lambda/agent-core-ad-sync/index.ts` | Ejecuta PowerShell a través de SSM para obtener información SID de usuarios AD y almacenarla en DynamoDB |
| FSx Permission Service | `lambda/permissions/fsx-permission-service.ts` | Ejecuta Get-Acl a través de SSM para obtener ACL NTFS (SID) de archivos/directorios |
| Configuración de AD Sync | `types/agentcore-config.ts` (`AdSyncConfig`) | Configuración para habilitación de AD sync, TTL de caché, timeout de SSM, etc. |

Estas son opciones de extensión futura. En la configuración actual del stack de demostración (`lib/stacks/demo/`), se colocan manualmente archivos `.metadata.json` de ejemplo con fines de verificación.

#### Flujo de procesamiento de recuperación automática de SID

```
1. AD Sync Lambda (Recuperación de SID de usuario)
   SSM → Windows EC2 → PowerShell (Get-ADUser) → Obtener SID → Almacenar en DynamoDB user-access

2. FSx Permission Service (Recuperación de ACL de archivo)
   SSM → Windows EC2 → PowerShell (Get-Acl) → Obtener ACL NTFS → Extraer SID → Puede generar .metadata.json
```

#### Configuración simplificada para entorno de demostración

El stack de demostración no utiliza la automatización anterior y configura los datos SID mediante los siguientes pasos manuales:

- `.metadata.json`: Ejemplos colocados manualmente en `demo-data/documents/`
- DynamoDB user-access: Registrar manualmente las asignaciones de correo electrónico a SID usando `demo-data/scripts/setup-user-access.sh`

#### Opciones de automatización para entorno de producción

| Método | Descripción |
|--------|-------------|
| AD Sync Lambda | Recupera automáticamente SIDs de usuarios AD a través de SSM y los almacena en DynamoDB (implementado) |
| FSx Permission Service | Recupera ACL NTFS a través de Get-Acl mediante SSM (implementado) |
| ONTAP REST API | Recupera ACL directamente a través del endpoint de gestión de FSx ONTAP (implementado: `ENV_AUTO_METADATA=true`) |
| S3 Access Point | La ACL NTFS se aplica automáticamente al acceder a archivos a través de S3 AP (soportado por CDK: `useS3AccessPoint=true`) |

#### Al usar S3 Access Point (Opción C)

Cuando Bedrock KB ingiere documentos a través de S3 Access Point, la ACL NTFS se aplica automáticamente a través de la `FileSystemIdentity` (tipo WINDOWS) del S3 Access Point. Sin embargo, si los metadatos devueltos por la API Retrieve de Bedrock KB incluyen información ACL depende de la implementación del S3 Access Point. En este momento, la gestión de SID a través de `.metadata.json` es el método confiable.

#### Formato de `.metadata.json`

```json
// .metadata.json
{
  "metadataAttributes": {
    "allowed_group_sids": ["S-1-5-21-...-512"],
    "access_level": "confidential",
    "department": "finance"
  }
}

// → Valor almacenado en AMAZON_BEDROCK_METADATA
{
  "source": "confidential/financial-report.md",
  "x-amz-bedrock-kb-source-uri": "s3://fsx-ontap/confidential/financial-report.md",
  "allowed_group_sids": ["S-1-5-21-...-512"],
  "access_level": "confidential",
  "department": "finance"
}
```

---

## Autenticación AOSS (Firma SigV4)

`oss-client.ts` accede a AOSS usando firma AWS SigV4.

- Recupera automáticamente credenciales del perfil de instancia EC2 (IMDS)
- Usa defaultProvider de `@aws-sdk/credential-provider-node`
- Las credenciales se actualizan automáticamente 5 minutos antes de su expiración
- El nombre del servicio para AOSS es `aoss`

---

## Manejo de carga simultánea masiva de archivos

Cuando se cargan 20 o más archivos simultáneamente en modo watch:

1. Esperar a que se complete la escritura con `awaitWriteFinish` de chokidar (2 segundos)
2. Cada evento de archivo se agrega a una cola
3. Procesar un archivo a la vez desde la cola (control exclusivo mediante flag `processing`)
4. 200ms de espera después del Embedding de cada chunk (contramedida para el límite de tasa de la API de Bedrock)
5. Actualizar `processed.json` después de completar el procesamiento

Esto asegura:
- Sin violaciones del límite de tasa de la API de Bedrock
- Sin escrituras concurrentes en `processed.json`
- Si el proceso se detiene durante el procesamiento, los archivos ya registrados en `processed.json` no se reprocesan

---

## CDK Stack

`DemoEmbeddingStack` (`lib/stacks/demo/demo-embedding-stack.ts`) crea lo siguiente:

| Recurso | Descripción |
|---------|-------------|
| Instancia EC2 (m5.large) | IMDSv2 obligatorio, SSM habilitado |
| Repositorio ECR | Para imágenes de contenedor de Embedding |
| Rol IAM | SSM, FSx, AOSS, Bedrock, ECR, Secrets Manager |
| Security Group | Comunicación permitida con FSx SG + AD SG |
| UserData | Montaje CIFS automático + inicio automático de Docker |

### Activación

```bash
npx cdk deploy <PREFIX>-Embedding \
  --app "npx ts-node bin/demo-app.ts" \
  -c enableEmbeddingServer=true \
  -c embeddingAdSecretArn=<SECRETS_MANAGER_ARN> \
  --require-approval never
```

---

## Solución de problemas

| Síntoma | Causa | Resolución |
|---------|-------|------------|
| AOSS 403 Forbidden | Rol EC2 no agregado a la política de acceso a datos | Agregar rol EC2 de Embedding a la política AOSS |
| Bedrock ThrottlingException | Límite de tasa de API excedido | Aumentar tiempo de espera entre chunks (200ms → 500ms) |
| Fallo de montaje CIFS | SVM no unida a AD o CIFS share no creado | Verificar unión a AD + crear CIFS share a través de ONTAP REST API |
| processed.json corrupto | Proceso interrumpido | Eliminar `processed.json` y volver a ejecutar |
| Error de sincronización KB (storage config invalid) | Campos incompatibles con KB existen en el índice AOSS | Eliminar índice → recrear → recrear fuente de datos → sincronizar |
| Todos los documentos DENIED por filtrado SID | Documentos del servidor de Embedding no tienen metadatos | Verificar que `.metadata.json` existe y `allowed_group_sids` está configurado |

---

## Documentos relacionados

| Documento | Contenido |
|-----------|-----------|
| [README.md](../../README.es.md) | Pasos de despliegue (Opción B) |
| [docs/implementation-overview.md](implementation-overview.md) | Descripción general de la implementación (Punto 5: Servidor de Embedding) |
| [docs/ui-specification.md](ui-specification.md) | Especificación de UI (visualización de directorios) |
| [docs/demo-environment-guide.md](demo-environment-guide.md) | Procedimientos de operación para el entorno de verificación |
