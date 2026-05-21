# Lista de verificación de preparación para producción

**🌐 Language:** [日本語](../production-readiness-checklist.md) | [English](../en/production-readiness-checklist.md) | [한국어](../ko/production-readiness-checklist.md) | [简体中文](../zh-CN/production-readiness-checklist.md) | [繁體中文](../zh-TW/production-readiness-checklist.md) | [Français](../fr/production-readiness-checklist.md) | [Deutsch](../de/production-readiness-checklist.md) | **Español**

**Creado**: 2026-05-21  
**Estado**: Borrador  
**Audiencia**: Equipos que consideran la migración de PoC → Producción

---

## Descripción general

Este documento proporciona una lista de verificación de elementos a confirmar al migrar el sistema RAG con reconocimiento de permisos de un entorno PoC a un entorno de producción.

---

## Definiciones de nivel de madurez

| Nivel | Nombre | Descripción | Objetivo |
|-------|--------|-------------|----------|
| L1 | Demo | Verificar operación con datos de muestra y usuarios incluidos. Despliegue más rápido | Validación técnica, demostraciones internas |
| L2 | PoC | Conectar AD/IdP del cliente, ingestar archivos reales, recopilar registros de evaluación | Propuestas a clientes, verificación de efectividad |
| L3 | Producción | Multi-cuenta, retención de registros de auditoría, DR, SLO, modelo de amenazas, Runbook de operaciones | Uso empresarial en producción |

---

## Lista de verificación L1 → L2 (Demo → PoC)

### Autenticación y federación de identidades

- [ ] Conectar Cognito User Pool al IdP del cliente (OIDC / SAML / LDAP)
- [ ] Confirmar inicio de sesión SSO exitoso con usuarios de prueba
- [ ] Confirmar que la recuperación automática de SID / UID+GID funciona correctamente
- [ ] Establecer `authFailureMode` en `fail-closed` y confirmar el comportamiento de bloqueo ante fallo de recuperación de permisos

### Ingesta de datos

- [ ] Colocar archivos reales (10–100) en el volumen FSx for ONTAP
- [ ] Confirmar que `.metadata.json` se genera correctamente
- [ ] Confirmar que la sincronización de la fuente de datos de Bedrock KB se completa exitosamente
- [ ] Confirmar que los resultados de búsqueda se filtran correctamente para usuarios con diferentes permisos

### Evaluación

- [ ] Evaluación cualitativa de la precisión de respuestas (10+ preguntas)
- [ ] Confirmar cero violaciones de permisos
- [ ] Medir tiempos de respuesta (P50 / P95 / P99)

---

## Lista de verificación L2 → L3 (PoC → Producción)

### 1. Seguridad

#### Cifrado

- [ ] Cifrado KMS CMK para S3 / DynamoDB / FSx (`enableKmsEncryption=true`)
- [ ] Habilitar rotación de claves KMS
- [ ] Aplicar TLS 1.2 o superior (CloudFront, ALB, FSx)
- [ ] Gestionar contraseñas y claves API con Secrets Manager (no codificar en `cdk.context.json`)

#### Red

- [ ] Habilitar VPC endpoints (`enableVpcEndpoints=true`)
  - S3, DynamoDB, Bedrock, Bedrock Agent, CloudWatch Logs, STS
- [ ] Minimizar permisos de grupos de seguridad (eliminar reglas de entrada innecesarias)
- [ ] Restringir tráfico saliente a través de NAT Gateway
- [ ] Configurar restricciones geográficas apropiadas de CloudFront

#### WAF

- [ ] Establecer valores de límite de tasa para producción (predeterminado: 2000 req/5min)
- [ ] Configurar lista de IPs permitidas (solo IPs internas)
- [ ] Habilitar almacenamiento de registros WAF en S3
- [ ] Considerar agregar reglas de Bot Control

#### IAM

- [ ] Minimizar permisos del rol de ejecución de Lambda
- [ ] Minimizar permisos del rol de Bedrock KB
- [ ] Restringir acceso entre cuentas
- [ ] Detectar permisos no utilizados con IAM Access Analyzer

### 2. Auditoría y registro

- [ ] Habilitar CloudTrail (todas las regiones, eventos de gestión + eventos de datos)
- [ ] Establecer período de retención de CloudWatch Logs (mínimo 1 año)
- [ ] Habilitar registro de acceso a S3
- [ ] Rastrear cambios de permisos a través de DynamoDB Streams
- [ ] Habilitar registro de invocación de modelos de Bedrock
- [ ] Prevenir manipulación de registros de auditoría (S3 Object Lock / Glacier Vault Lock)
- [ ] Almacenar registros de búsqueda RAG (ID de usuario, consulta, documentos referenciados, resultados de filtrado)

### 3. Disponibilidad y DR

- [ ] Confirmar configuración Multi-AZ de FSx for ONTAP
- [ ] Habilitar recuperación en un punto en el tiempo (PITR) de DynamoDB
- [ ] Habilitar versionado de S3
- [ ] Configurar programación de respaldos (respaldos automáticos de FSx)
- [ ] Definir y verificar RTO / RPO
- [ ] Seleccionar región de DR y diseñar replicación SnapMirror
- [ ] Crear documentación del procedimiento de conmutación por error manual

### 4. Operaciones

- [ ] Configurar panel de CloudWatch (`enableMonitoring=true`)
- [ ] Establecer umbrales de alerta
  - Tasa de error de Lambda > 1%
  - Latencia P95 de Bedrock > 10s
  - Limitación de DynamoDB
  - Utilización de almacenamiento de FSx > 80%
- [ ] Crear Runbook de operaciones
  - Procedimiento de re-sincronización de KB
  - Procedimiento de limpieza forzada de caché de permisos
  - Procedimiento de revocación de permisos de emergencia
  - Procedimiento de reversión
- [ ] Definir flujo de respuesta a incidentes
- [ ] Establecer estructura de guardia

### 5. Gestión de costos

- [ ] Establecer alertas de costos con AWS Budgets
- [ ] Definir estrategia de etiquetado (Environment, Project, CostCenter)
- [ ] Política de ciclo de vida de S3 (migración a Glacier para registros)
- [ ] Establecer valores apropiados de memoria y timeout de Lambda
- [ ] Monitorear uso de modelos de Bedrock
- [ ] Establecer proceso de revisión mensual de costos

### 6. Escalabilidad

- [ ] Seleccionar modo de capacidad de DynamoDB (On-Demand vs Provisioned)
- [ ] Configurar límites de concurrencia de Lambda
- [ ] Verificar rendimiento de Bedrock (considerar Provisioned Throughput)
- [ ] Establecer capacidad de rendimiento apropiada de FSx
- [ ] Optimizar estrategia de caché de CloudFront

### 7. Cumplimiento normativo

- [ ] Establecer política de clasificación de datos (Confidencial, Interno, Público)
- [ ] Definir reglas de manejo de información personal
- [ ] Definir períodos de retención de datos
- [ ] Preparar términos de servicio y política de privacidad
- [ ] Abordar regulaciones específicas de la industria (Salud: HIPAA, Finanzas: FISC, Sector público: ISMAP)

### 8. Pruebas

- [ ] Ejecutar pruebas de matriz de permisos (ver [tests/permission-matrix/](../tests/permission-matrix/))
- [ ] Pruebas de carga (2x usuarios concurrentes esperados)
- [ ] Pruebas de seguridad (pruebas de penetración)
- [ ] Pruebas de DR (conmutación por error / conmutación por recuperación)
- [ ] Pruebas de propagación de cambios de permisos (cambio de ACL → reflejo en resultados de búsqueda)

---

## Verificación final antes del despliegue en producción

```bash
# 1. Verificar cambios con CDK diff
npx cdk diff --all

# 2. Escaneo de seguridad
npx cdk synth --quiet | cfn-nag

# 3. Ejecutar pruebas
npx jest --no-coverage
cd automation/fsxn-ops && python3 -m pytest tests/ -v

# 4. Desplegar (con aprobación)
npx cdk deploy --all --require-approval broadening
```

---

## Documentos relacionados

| Documento | Descripción |
|-----------|-------------|
| [permission-consistency.md](permission-consistency.md) | Modelo de consistencia de cambios de permisos |
| [governance-and-audit.md](governance-and-audit.md) | Diseño de gobernanza y auditoría |
| [partner-deployment-patterns.md](partner-deployment-patterns.md) | Patrones de despliegue multi-inquilino |
| [safe-experimentation-guide.md](safe-experimentation-guide.md) | Guía de experimentación segura |
| [evaluation.md](evaluation.md) | Métricas de evaluación RAG / Agent |
