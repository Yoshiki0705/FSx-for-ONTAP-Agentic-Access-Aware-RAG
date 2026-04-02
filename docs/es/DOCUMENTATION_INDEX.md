# Índice de documentación

**🌐 Language:** [日本語](../DOCUMENTATION_INDEX.md) | [English](../en/DOCUMENTATION_INDEX.md) | [한국어](../ko/DOCUMENTATION_INDEX.md) | [简体中文](../zh-CN/DOCUMENTATION_INDEX.md) | [繁體中文](../zh-TW/DOCUMENTATION_INDEX.md) | [Français](../fr/DOCUMENTATION_INDEX.md) | [Deutsch](../de/DOCUMENTATION_INDEX.md) | **Español**

## Lectura esencial

| Documento | Descripción |
|-----------|-------------|
| [README.md](../../README.es.md) | Descripción general del sistema, arquitectura, pasos de despliegue, configuración WAF/Geo |
| [implementation-overview.md](implementation-overview.md) | Implementación detallada (12 aspectos: análisis de imágenes RAG, UI de conexión KB, Smart Routing, monitoreo y alertas) |
| [SID-Filtering-Architecture.md](SID-Filtering-Architecture.md) | Diseño detallado del filtrado de permisos basado en SID |
| [verification-report.md](verification-report.md) | Procedimientos de verificación post-despliegue y casos de prueba |
| [ui-specification.md](ui-specification.md) | Especificación de la UI del Chatbot (modo KB/Agent, Agent Directory, funciones Agent empresariales, diseño de barra lateral) |
| [demo-recording-guide.md](demo-recording-guide.md) | Guía de grabación de video de demostración (6 elementos de evidencia) |
| [embedding-server-design.md](embedding-server-design.md) | Documento de diseño e implementación del servidor Embedding |
| [stack-architecture-comparison.md](stack-architecture-comparison.md) | Guía de arquitectura de pilas CDK (comparación de almacenes de vectores, perspectivas de implementación) |
| [README - AD SAML Federation](../../README.es.md#ad-saml-federation-optional) | Configuración de AD SAML federation (Managed AD / Self-managed AD) |

## Configuración y verificación

| Documento | Descripción |
|-----------|-------------|
| [demo-scenario.md](../../demo-data/guides/demo-scenario.md) | Escenarios de verificación (diferencias de permisos admin vs. usuario estándar, inicio de sesión AD SSO) |
| [ontap-setup-guide.md](../../demo-data/guides/ontap-setup-guide.md) | Integración FSx ONTAP + AD, recurso compartido CIFS, configuración NTFS ACL (procedimientos verificados) |
| [demo-environment-guide.md](demo-environment-guide.md) | IDs de recursos del entorno de verificación, información de acceso, procedimientos del servidor Embedding |

## Servidor Embedding (mediante montaje FlexCache CIFS)

| Documento / Archivo | Descripción |
|----------------------|-------------|
| [demo-environment-guide.md#6](demo-environment-guide.md) | Procedimientos de despliegue y operación del servidor Embedding |
| `docker/embed/src/index.ts` | Aplicación Embedding (escaneo de documentos → división en chunks → vectorización → indexación) |
| `docker/embed/src/oss-client.ts` | Cliente de firma SigV4 de OpenSearch Serverless (soporte de autenticación IMDS) |
| `docker/embed/Dockerfile` | Definición del contenedor Embedding (node:22-slim, cifs-utils) |
| `docker/embed/buildspec.yml` | Definición de compilación CodeBuild |
| `lib/stacks/demo/demo-embedding-stack.ts` | Definición CDK de EmbeddingStack (EC2 + ECR + IAM) |

## Scripts de configuración

| Script | Descripción |
|--------|-------------|
| `demo-data/scripts/create-demo-users.sh` | Crear usuarios de prueba en Cognito |
| `demo-data/scripts/setup-user-access.sh` | Registrar datos SID en DynamoDB |
| `demo-data/scripts/upload-demo-data.sh` | Subir documentos de prueba a S3 |
| `demo-data/scripts/sync-kb-datasource.sh` | Sincronizar fuente de datos de Bedrock KB |

## Orden de lectura recomendado

1. **README.md** — Descripción general del sistema y pasos de despliegue
2. **implementation-overview.md** — Implementación detallada en 8 aspectos
3. **SID-Filtering-Architecture.md** — Detalles técnicos de la funcionalidad principal
4. **demo-recording-guide.md** — Guía de grabación de video de demostración
5. **ontap-setup-guide.md** — Integración FSx ONTAP AD, configuración de recurso compartido CIFS
6. **README.md - AD SAML Federation** — Configuración de AD SAML federation (opcional)
7. **demo-environment-guide.md** — Configuración del entorno de verificación (incluido el servidor Embedding)
8. **demo-scenario.md** — Ejecutar escenarios de verificación (inicio de sesión AD SSO)
9. **verification-report.md** — Procedimientos de verificación a nivel de API
