# Guía de Arquitectura de CDK Stack

**🌐 Language:** [日本語](../stack-architecture-comparison.md) | [English](../en/stack-architecture-comparison.md) | [한국어](../ko/stack-architecture-comparison.md) | [简体中文](../zh-CN/stack-architecture-comparison.md) | [繁體中文](../zh-TW/stack-architecture-comparison.md) | [Français](../fr/stack-architecture-comparison.md) | [Deutsch](../de/stack-architecture-comparison.md) | **Español**

**Última actualización**: 2026-03-31  
**Estado**: Consolidado en la línea del stack de demostración, integración de S3 Vectors verificada

---

## Descripción general

Todos los CDK stacks están consolidados bajo `lib/stacks/demo/`. El único punto de entrada es `bin/demo-app.ts`. Las funciones opcionales se pueden habilitar mediante parámetros de contexto CDK.

---

## Comparación de funcionalidades

| Funcionalidad | Demo Stack (Actual) | Contexto CDK | Notas |
|---------------|---------------------|-------------|-------|
| Autenticación | Cognito + AD (opcional) | `adPassword`, `adDomainName` | Solo Cognito cuando AD no está configurado |
| Recuperación automática de SID | AD Sync Lambda | `adType=managed\|self-managed` | Manual (`setup-user-access.sh`) cuando AD no está configurado |
| Recuperación de ACL NTFS | Generado automáticamente en el servidor de Embedding | `ontapMgmtIp`, `ontapSvmUuid` | `.metadata.json` manual cuando no está configurado |
| Filtrado de permisos | Dentro de Next.js API Route (predeterminado) | `usePermissionFilterLambda=true` | También puede migrarse a una Lambda dedicada |
| Bedrock Agent | Creación dinámica de Agent + Action Group | `enableAgent=true` | Crea automáticamente Agent específico de categoría al hacer clic en tarjeta |
| Bedrock Guardrails | Seguridad de contenido + protección PII | `enableGuardrails=true` | |
| Cifrado KMS | Cifrado CMK de S3 / DynamoDB | `enableKmsEncryption=true` | Rotación de claves habilitada |
| CloudTrail | Acceso a datos S3 + auditoría Lambda | `enableCloudTrail=true` | Retención de 90 días |
| VPC Endpoints | S3, DynamoDB, Bedrock, etc. | `enableVpcEndpoints=true` | Soporta 6 servicios |
| Servidor de Embedding | Montaje CIFS FlexCache + escritura directa al almacén vectorial | `enableEmbeddingServer=true` | Ruta de respaldo cuando S3 AP no está disponible (solo configuración AOSS) |
| Control avanzado de permisos | Control de acceso basado en tiempo + registro de auditoría de decisiones de permisos | `enableAdvancedPermissions=true` | Tabla DynamoDB `permission-audit` + GSI |

---

## Rutas de ingesta de datos

| Ruta | Método | Activación | Caso de uso |
|------|--------|------------|-------------|
| Principal | FSx ONTAP → S3 Access Point → Bedrock KB | `post-deploy-setup.sh` | Volúmenes estándar |
| Respaldo | Carga directa a bucket S3 → Bedrock KB | `upload-demo-data.sh` | Cuando S3 AP no está disponible |
| Alternativa | Montaje CIFS → Servidor de Embedding → Escritura directa al almacén vectorial | `enableEmbeddingServer=true` | Volúmenes FlexCache (solo configuración AOSS) |

---

## Bedrock KB Ingestion Job — Cuotas y consideraciones de diseño

Bedrock KB Ingestion Job es un servicio gestionado que maneja la recuperación de documentos, chunking, vectorización y almacenamiento. Lee datos directamente de FSx ONTAP a través de S3 Access Point y procesa solo archivos modificados mediante sincronización incremental. No se requiere pipeline de Embedding personalizado (como AWS Batch).

### Cuotas de servicio (a marzo de 2026, todas no ajustables)

| Cuota | Valor | Impacto en el diseño |
|-------|-------|---------------------|
| Tamaño de datos por job | 100GB | Los datos excedentes no se procesan. Las fuentes de datos que excedan 100GB deben dividirse en múltiples fuentes |
| Tamaño de archivo por archivo | 50MB | Los PDFs grandes necesitan dividirse |
| Archivos añadidos/actualizados por job | 5.000.000 | Suficiente para volúmenes típicos de documentos empresariales |
| Archivos eliminados por job | 5.000.000 | Igual que arriba |
| Archivos al usar parser BDA | 1.000 | Límite al usar el parser Bedrock Data Automation |
| Archivos al usar parser FM | 1.000 | Límite al usar el parser Foundation Model |
| Fuentes de datos por KB | 5 | Límite superior al registrar múltiples volúmenes como fuentes de datos individuales |
| KBs por cuenta | 100 | Consideración para diseño multi-tenant |
| Jobs concurrentes por cuenta | 5 | Restricción para sincronización paralela entre múltiples KBs |
| Jobs concurrentes por KB | 1 | La sincronización paralela a la misma KB no es posible. Debe esperar a que el job anterior se complete |
| Jobs concurrentes por fuente de datos | 1 | Igual que arriba |

### Disparadores de ejecución y restricciones de frecuencia

| Elemento | Valor | Notas |
|----------|-------|-------|
| Tasa de API StartIngestionJob | 0,1 req/seg (una vez cada 10 segundos) | **No ajustable**. No adecuado para sincronización automática de alta frecuencia |
| Disparador de ejecución | Manual (API/CLI/Consola) | Sin función de programación automática en el lado de Bedrock KB |
| Método de sincronización | Sincronización incremental | Procesa solo adiciones, cambios y eliminaciones. No se requiere reprocesamiento completo |
| Duración de sincronización | Depende del volumen de datos (segundos a horas) | Pequeña escala (decenas de archivos): 30 seg–2 min, Gran escala: horas |

### Programación de sincronización automática

Dado que Bedrock KB no tiene una función de sincronización programada integrada, implemente sincronización periódica usando los siguientes métodos si es necesario:

```bash
# Periodic execution with EventBridge Scheduler (e.g., every hour)
aws scheduler create-schedule \
  --name kb-sync-hourly \
  --schedule-expression "rate(1 hour)" \
  --target '{"Arn":"arn:aws:bedrock:ap-northeast-1:ACCOUNT_ID:knowledge-base/KB_ID","RoleArn":"arn:aws:iam::ACCOUNT_ID:role/scheduler-role","Input":"{\"dataSourceId\":\"DS_ID\"}"}' \
  --flexible-time-window '{"Mode":"OFF"}'
```

Alternativamente, puede detectar cambios de archivos en FSx ONTAP a través de notificaciones de eventos S3 y disparar un Ingestion Job. Sin embargo, tenga en cuenta el límite de tasa de la API StartIngestionJob (una vez cada 10 segundos).

### Recomendaciones de diseño

1. **Frecuencia de sincronización**: La sincronización en tiempo real no es posible. El intervalo mínimo es de 10 segundos; prácticamente, se recomiendan de 15 minutos a 1 hora
2. **Datos a gran escala**: Las fuentes de datos que excedan 100GB deben dividirse en múltiples volúmenes FSx ONTAP (= múltiples S3 APs = múltiples fuentes de datos)
3. **Procesamiento paralelo**: La sincronización paralela a la misma KB no es posible. Sincronizar múltiples fuentes de datos secuencialmente
4. **Manejo de errores**: Implementar lógica de reintento para fallos de jobs (monitorear estado con `GetIngestionJob`)
5. **No se necesita pipeline de Embedding personalizado**: Dado que Bedrock KB gestiona chunking, vectorización y almacenamiento, las pipelines personalizadas como AWS Batch son innecesarias

---

## Estructura de CDK Stack (7 Stacks)

| # | Stack | Requerido/Opcional | Descripción |
|---|-------|-------------------|-------------|
| 1 | WafStack | Requerido | WAF para CloudFront (us-east-1) |
| 2 | NetworkingStack | Requerido | VPC, Subnets, SG |
| 3 | SecurityStack | Requerido | Cognito User Pool |
| 4 | StorageStack | Requerido | FSx ONTAP + SVM + Volume (o referencia existente), S3, DynamoDB×2 |
| 5 | AIStack | Requerido | Bedrock KB, S3 Vectors o OpenSearch Serverless, Agent (opcional) |
| 6 | WebAppStack | Requerido | Lambda Web Adapter + CloudFront |
| 7 | EmbeddingStack | Opcional | Montaje CIFS FlexCache + Servidor de Embedding |

### Modo de referencia de FSx for ONTAP existente

StorageStack puede referenciar recursos FSx ONTAP existentes usando los parámetros `existingFileSystemId`/`existingSvmId`/`existingVolumeId`. En este caso:
- Omite la creación de nuevos FSx/SVM/Volume (reduce el tiempo de despliegue en 30-40 minutos)
- También omite la creación de Managed AD (usa la configuración AD del entorno existente)
- Los buckets S3, tablas DynamoDB y custom resources de S3 AP se crean normalmente
- `cdk destroy` no elimina FSx/SVM/Volume (fuera de la gestión CDK)

---

## Comparación de configuraciones de almacén vectorial

La configuración del almacén vectorial se puede cambiar usando el parámetro de contexto CDK `vectorStoreType`. La tercera configuración (S3 Vectors + Exportación AOSS) se proporciona como procedimiento operativo para exportación bajo demanda sobre la configuración de S3 Vectors.

> **Soporte regional**: S3 Vectors está disponible en `ap-northeast-1` (región de Tokio).

| Elemento | OpenSearch Serverless | S3 Vectors Standalone | S3 Vectors + Exportación AOSS |
|----------|----------------------|----------------------|-------------------------------|
| **Parámetro CDK** | `vectorStoreType=opensearch-serverless` | `vectorStoreType=s3vectors` (predeterminado) | Ejecutar `export-to-opensearch.sh` sobre la configuración 2 |
| **Costo** | ~700$/mes (2 OCUs siempre activas) | Pocos dólares/mes (pequeña escala) | S3 Vectors + AOSS OCU (solo durante exportación) |
| **Latencia** | ~10ms | Sub-segundo (frío), ~100ms (caliente) | ~10ms (búsqueda AOSS después de exportación) |
| **Filtrado** | Filtro de metadatos (`$eq`, `$ne`, `$in`, etc.) | Filtro de metadatos (`$eq`, `$in`, `$and`, `$or`) | Filtrado AOSS después de exportación |
| **Restricciones de metadatos** | Sin restricciones | filterable 2KB/vector (efectivamente 1KB para personalizado), claves non-filterable máx 10 | Sigue restricciones AOSS después de exportación |
| **Caso de uso** | Entornos de producción que requieren alto rendimiento | Optimización de costos, demo, entornos de desarrollo | Demanda temporal de alto rendimiento |
| **Procedimiento operativo** | Solo CDK deploy | Solo CDK deploy | Ejecutar `export-to-opensearch.sh` después de CDK deploy. El rol IAM de exportación se crea automáticamente |

> **Restricción de metadatos de S3 Vectors**: Al usar Bedrock KB + S3 Vectors, los metadatos personalizados están efectivamente limitados a 1KB o menos (los metadatos internos de Bedrock KB consumen ~1KB del límite de 2KB de metadatos filtrables). El código CDK establece todos los metadatos como non-filterable para evitar el límite de 2KB. El filtrado SID se realiza en el lado de la aplicación, por lo que el filtro QueryVectors de S3 Vectors no es necesario. Consulte [docs/s3-vectors-sid-architecture-guide.md](s3-vectors-sid-architecture-guide.md) para más detalles.

### Notas sobre la exportación

- La exportación es una **copia en un punto en el tiempo**. Se requiere re-exportación después de actualizaciones de datos de S3 Vectors (no se realiza sincronización continua)
- Durante la exportación, se crean automáticamente una colección AOSS, pipeline OSI, rol de servicio IAM y bucket S3 DLQ
- La opción de consola "Create and use a new service role" crea automáticamente el rol IAM, por lo que no se necesita creación previa del rol
- La exportación toma aproximadamente 15 minutos (creación de colección AOSS 5 min + creación de pipeline 5 min + transferencia de datos 5 min)
- La pipeline OSI **se detiene automáticamente** después de completar la transferencia de datos (eficiente en costos)
- La colección AOSS permanece consultable después de que la pipeline se detiene
- **Eliminar manualmente las colecciones AOSS cuando ya no se necesiten** (no se eliminan con `cdk destroy` ya que están fuera de la gestión CDK. La facturación de OCU continúa)

---

## Lecciones aprendidas de la implementación de S3 Vectors (Verificado)

Las siguientes son lecciones aprendidas de la verificación real de despliegue en ap-northeast-1 (región de Tokio) el 2026-03-29.

### Relacionado con SDK/API

| Elemento | Lección |
|----------|---------|
| Respuesta SDK v3 | Las respuestas de `CreateVectorBucketCommand`/`CreateIndexCommand` no incluyen `vectorBucketArn`/`indexArn`. Solo se devuelve `$metadata`. El ARN debe construirse usando el patrón `arn:aws:s3vectors:{region}:{account}:bucket/{name}` |
| Nombres de comandos API | `CreateIndexCommand`/`DeleteIndexCommand` son correctos. `CreateVectorBucketIndexCommand` no existe |
| Parámetros requeridos de CreateIndex | `dataType: 'float32'` es requerido. Omitirlo causa un error de validación |
| Diseño de metadatos | Todas las claves de metadatos son filtrables por defecto. `metadataConfiguration` solo especifica `nonFilterableMetadataKeys`. No se necesita configuración explícita para hacer `allowed_group_sids` filtrable |

### Relacionado con Bedrock KB

| Elemento | Lección |
|----------|---------|
| S3VectorsConfiguration | `indexArn` e `indexName` son mutuamente excluyentes. Especificar ambos causa un error `2 subschemas matched instead of one`. Usar solo `indexArn` |
| Validación de permisos IAM | Bedrock KB valida el permiso `s3vectors:QueryVectors` del rol KB en el momento de la creación. La política IAM debe aplicarse antes de la creación de KB |
| Acciones IAM requeridas | Se requieren 5 acciones: `s3vectors:QueryVectors`, `s3vectors:PutVectors`, `s3vectors:DeleteVectors`, `s3vectors:GetVectors`, `s3vectors:ListVectors` |

### Relacionado con CDK/CloudFormation

| Elemento | Lección |
|----------|---------|
| ARN de recurso de política IAM | Usar patrones ARN explícitos en lugar de tokens `GetAtt` de custom resource. Esto evita problemas de dependencia |
| CloudFormation Hook | El Hook `AWS::EarlyValidation::ResourceExistenceCheck` a nivel de Organization que bloquea change-sets puede evitarse con `--method=direct` |
| Tiempo de despliegue | El tiempo de despliegue del AI stack (configuración S3 Vectors) es aproximadamente 83 segundos (significativamente reducido comparado con ~5 minutos para configuración AOSS) |

---

---

## Opciones de extensión futura

Las siguientes funcionalidades no están implementadas actualmente pero están diseñadas para agregarse como funciones opcionales mediante parámetros de contexto CDK.

| Funcionalidad | Descripción general | Parámetro esperado |
|---------------|--------------------|--------------------|
| Monitoreo y alertas | Dashboard de CloudWatch (métricas entre stacks), alertas SNS (tasa de error / umbral de latencia excedido) | `enableMonitoring=true` |
| Control de permisos avanzado | Control de acceso basado en tiempo (permitir solo durante horario laboral), restricción de acceso geográfico (geolocalización IP), log de auditoría DynamoDB | `enableAdvancedPermissions=true` |

---

## Documentos relacionados

| Documento | Contenido |
|-----------|-----------|
| [README.md](../../README.es.md) | Procedimientos de despliegue y lista de parámetros de contexto CDK |
| [SID-Filtering-Architecture.md](SID-Filtering-Architecture.md) | Diseño de filtrado SID y detalles de rutas de ingesta de datos |
| [embedding-server-design.md](embedding-server-design.md) | Diseño del servidor de Embedding (incluyendo recuperación automática de ACL ONTAP) |
| [ui-specification.md](ui-specification.md) | Especificación de UI (UI de tarjetas, cambio de modo KB/Agent) |