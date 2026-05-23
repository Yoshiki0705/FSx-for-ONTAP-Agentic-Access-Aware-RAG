# Índice de documentación

**🌐 Language:** [日本語](../DOCUMENTATION_INDEX.md) | [English](../en/DOCUMENTATION_INDEX.md) | [한국어](../ko/DOCUMENTATION_INDEX.md) | [简体中文](../zh-CN/DOCUMENTATION_INDEX.md) | [繁體中文](../zh-TW/DOCUMENTATION_INDEX.md) | [Français](../fr/DOCUMENTATION_INDEX.md) | [Deutsch](../de/DOCUMENTATION_INDEX.md) | **Español**

## Lectura esencial

| Documento | Descripción |
|-----------|-------------|
| [README.md](../../README.es.md) | Descripción general del sistema, arquitectura, pasos de despliegue, configuración WAF/Geo |
| [auth-and-user-management.md](auth-and-user-management.md) | Guía de autenticación y gestión de usuarios (selección de modo de autenticación, AD Federation, registro automático de SID, solución de problemas) |
| [implementation-overview.md](implementation-overview.md) | Implementación detallada (22 aspectos: análisis de imágenes RAG, UI de conexión KB, Smart Routing, monitoreo y alertas, OIDC/LDAP Federation) |
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
| [auth-mode-setup-guide.md](../../demo-data/guides/auth-mode-setup-guide.md) | Guía de configuración del entorno de demostración por modo de autenticación (5 modos, con archivos de configuración de ejemplo) |
| [demo-scenario.md](../../demo-data/guides/demo-scenario.md) | Escenarios de verificación (diferencias de permisos admin vs. usuario estándar, inicio de sesión AD SSO, inicio de sesión OIDC/LDAP) |
| [ontap-setup-guide.md](../../demo-data/guides/ontap-setup-guide.md) | Integración FSx ONTAP + AD, recurso compartido CIFS, configuración NTFS ACL, configuración Name-Mapping (procedimientos verificados) |
| [demo-environment-guide.md](demo-environment-guide.md) | IDs de recursos del entorno de verificación, información de acceso, procedimientos del servidor Embedding |

## Guía de diseño y operaciones empresariales

| Documento | Descripción |
|-----------|-------------|
| [production-readiness-checklist.md](production-readiness-checklist.md) | Lista de verificación de preparación para producción (definiciones de niveles de madurez Demo → PoC → Production, elementos de verificación de seguridad/auditoría/DR/operaciones) |
| [permission-consistency.md](permission-consistency.md) | Modelo de consistencia de cambios de permisos (cambio ACL → regeneración de metadatos → re-sincronización KB → invalidación de caché, latencia máxima, procedimientos de revocación de permisos de emergencia) |
| [fsxn-sizing-and-performance.md](fsxn-sizing-and-performance.md) | Guía de dimensionamiento y rendimiento de FSx for ONTAP (configuraciones por escala, consideraciones S3 AP, QoS, selección de almacén de vectores) |
| [partner-deployment-patterns.md](partner-deployment-patterns.md) | Patrones de despliegue multi-tenant y de socios (aislamiento de cuenta/aislamiento SVM/híbrido, plantillas de estimación de costos) |
| [governance-and-audit.md](governance-and-audit.md) | Diseño de gobernanza y auditoría (esquema de registro de auditoría, IA responsable, políticas de Guardrails, casos de uso por industria) |
| [evaluation.md](evaluation.md) | Métricas de evaluación RAG / Agent (evaluación en 4 ejes: KPIs de negocio, calidad RAG, control de permisos, rendimiento de Agent; plantilla de evaluación PoC) |
| [safe-experimentation-guide.md](safe-experimentation-guide.md) | Guía de experimentación segura (definición de alcance, acciones prohibidas, lista de verificación de ingesta de datos reales, procedimientos de rollback) |
| [threat-model.md](threat-model.md) | Modelo de amenazas (10 categorías de amenazas, rutas de ataque, mitigaciones existentes, recomendaciones adicionales, tabla de mapeo amenazas→contramedidas) |
| [cloudwatch-dashboard-guide.md](cloudwatch-dashboard-guide.md) | Guía de operaciones del panel CloudWatch (lista de métricas, definiciones de alarmas, patrones de solución de problemas) |
| [poc-workshop-guide.md](poc-workshop-guide.md) | Guía de taller PoC (90 minutos: despliegue → prueba → evaluación → limpieza) |
| [tests/permission-matrix/](../../tests/permission-matrix/) | Pruebas de matriz de permisos (31 escenarios de casos límite ACL: Fail-Closed, anidamiento de grupos, permisos heredados, revocación de emergencia) |

## Automatización de Operaciones FSx ONTAP

| Documento | Descripción |
|-----------|-------------|
| [automation/fsxn-ops/README.md](../../automation/fsxn-ops/README.md) | Descripción general de la suite de automatización (estructura de directorios, casos de uso) |
| [automation/fsxn-ops/docs/why-this-makes-fsxn-easier.md](../../automation/fsxn-ops/docs/why-this-makes-fsxn-easier.md) | Por qué esta arquitectura simplifica las operaciones de FSx ONTAP (decisiones de diseño, estimaciones de costos, diseño de seguridad) |
| [automation/fsxn-ops/docs/aws-verification-report.md](../../automation/fsxn-ops/docs/aws-verification-report.md) | Informe de verificación de integración AWS (2026-05-01, todas las fases APROBADAS) |
| [automation/fsxn-ops/cfn/fsxn-ops-stack.yaml](../../automation/fsxn-ops/cfn/fsxn-ops-stack.yaml) | Plantilla CloudFormation integrada (incluye puntos de enlace VPC) |

## Archivos de configuración de ejemplo

| Archivo | Modo de autenticación | Descripción |
|---------|----------------------|-------------|
| `demo-data/configs/mode-a-email-password.json` | Email/Contraseña | Configuración mínima, registro manual de SID |
| `demo-data/configs/mode-b-saml-ad-federation.json` | SAML AD Federation | Managed AD + IAM Identity Center |
| `demo-data/configs/mode-c-oidc-ldap.json` | OIDC + LDAP | Auth0/Keycloak + OpenLDAP + ONTAP name-mapping |
| `demo-data/configs/mode-d-oidc-claims-only.json` | OIDC Claims Only | Okta/Auth0 (sin LDAP) |
| `demo-data/configs/mode-e-saml-oidc-hybrid.json` | SAML + OIDC | AD Federation + OIDC IdP activación simultánea |

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
| `demo-data/scripts/setup-openldap.sh` | Configuración del servidor OpenLDAP (EC2 en VPC, usuarios/grupos de prueba) |
| `demo-data/scripts/setup-ontap-namemapping.sh` | Configuración de reglas name-mapping via API REST de ONTAP |
| `demo-data/scripts/verify-ldap-integration.sh` | Verificación de integración LDAP (Lambda → LDAP → DynamoDB) |
| `demo-data/scripts/verify-ontap-namemapping.sh` | Verificación de name-mapping ONTAP (conexión API REST y obtención de reglas) |
| `demo-data/scripts/setup-mode-c-oidc-ldap.sh` | Configuración one-shot Modo C (OIDC+LDAP) (todas las fases ejecutadas automáticamente) |

## Orden de lectura recomendado

### Fase 1: Configuración inicial

1. **README.md** — Descripción general del sistema y pasos de despliegue
2. **auth-and-user-management.md** — Selección de modo de autenticación y gestión de usuarios
3. **implementation-overview.md** — Implementación detallada en 22 aspectos
4. **SID-Filtering-Architecture.md** — Detalles técnicos de la funcionalidad principal
5. **safe-experimentation-guide.md** — Guía de experimentación segura (lectura obligatoria antes del PoC)

### Fase 2: Verificación y evaluación

6. **demo-recording-guide.md** — Guía de grabación de video de demostración
7. **ontap-setup-guide.md** — Integración FSx ONTAP AD, configuración de recurso compartido CIFS
8. **demo-environment-guide.md** — Configuración del entorno de verificación
9. **demo-scenario.md** — Ejecutar escenarios de verificación
10. **evaluation.md** — Plantilla de evaluación PoC

### Fase 3: Producción y diseño empresarial

11. **production-readiness-checklist.md** — Lista de verificación de preparación para producción
12. **permission-consistency.md** — Modelo de consistencia de cambios de permisos
13. **fsxn-sizing-and-performance.md** — Dimensionamiento y rendimiento de FSx for ONTAP
14. **governance-and-audit.md** — Diseño de gobernanza y auditoría
15. **partner-deployment-patterns.md** — Patrones de despliegue multi-tenant
