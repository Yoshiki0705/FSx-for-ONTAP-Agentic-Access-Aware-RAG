# Architecture Decision Records (ADR) — Registros de decisiones de arquitectura

**🌐 Language:** [日本語](../architecture-decision-records.md) | [English](../en/architecture-decision-records.md) | [한국어](../ko/architecture-decision-records.md) | [简体中文](../zh-CN/architecture-decision-records.md) | [繁體中文](../zh-TW/architecture-decision-records.md) | [Français](../fr/architecture-decision-records.md) | [Deutsch](../de/architecture-decision-records.md) | **Español**

**Fecha de creación**: 2026-05-23  
**Estado**: Aprobado  
**Audiencia**: Arquitectos, líderes técnicos, cualquier persona que desee comprender las razones de las decisiones

---

## Descripción general

Este documento registra las decisiones arquitectónicas clave y sus justificaciones para el sistema Permission-aware Agentic RAG. Explica "por qué se eligió esta configuración" y sirve como referencia para futuras decisiones de cambio.

---

## ADR-001: Almacenamiento vectorial — S3 Vectors como predeterminado

| Elemento | Detalles |
|----------|----------|
| **Estado** | Aprobado |
| **Fecha** | 2026-03-29 |
| **Contexto** | Si usar S3 Vectors u OpenSearch Serverless como almacenamiento vectorial predeterminado para la búsqueda RAG |

### Opciones consideradas

| Opción | Ventajas | Desventajas |
|--------|----------|-------------|
| S3 Vectors (adoptado) | Pocos dólares/mes, cero operaciones, exportación AOSS con un clic | Consulta en frío: sub-segundo, no apto para alto QPS |
| OpenSearch Serverless | 50ms constante, soporte alto QPS, búsqueda de texto completo | Mínimo $700/mes (2 OCU), gestión de OCU necesaria |

### Decisión

**S3 Vectors como predeterminado**, con la capacidad de cambiar a OpenSearch Serverless mediante el parámetro `vectorStoreType`.

### Justificación

1. Para PoC / uso a pequeña escala, comenzar con pocos dólares/mes reduce la barrera de adopción
2. El acceso vía Bedrock KB es independiente del almacenamiento vectorial, la lógica de filtrado SID es compartida
3. Cuando aumentan los requisitos de rendimiento, exportación con un clic a AOSS desde la consola (~15 minutos)
4. Todos los metadatos de S3 Vectors son filtrables (sin configuración adicional necesaria)

### Impacto

- Costo de despliegue predeterminado significativamente reducido ($700/mes → $5/mes)
- Entornos de alto QPS requieren cambiar a `vectorStoreType=opensearch`
- Tener en cuenta el límite de 2KB de metadatos filtrables en S3 Vectors (cuando los metadatos PDF son grandes)

---

## ADR-002: Filtrado de permisos — Coincidencia SID del lado de la aplicación

| Elemento | Detalles |
|----------|----------|
| **Estado** | Aprobado |
| **Fecha** | 2026-01-15 |
| **Contexto** | En qué capa implementar el filtrado de permisos de los resultados de búsqueda RAG |

### Opciones consideradas

| Opción | Ventajas | Desventajas |
|--------|----------|-------------|
| Coincidencia SID del lado de la aplicación (adoptado) | Independiente del almacenamiento vectorial, imposible eludir LLM, implementación Fail-Closed fácil | Filtro post-búsqueda, cantidad recuperada > cantidad mostrada |
| Filtro de metadata del almacenamiento vectorial | Filtra en tiempo de búsqueda, eficiente | No controlable directamente vía Bedrock KB Retrieve API |
| Bedrock KB RetrieveAndGenerate | Una sola llamada API | Metadatos no devueltos, filtrado SID imposible |

### Decisión

Adoptar un **enfoque de dos etapas: Bedrock KB Retrieve API + coincidencia SID del lado de la aplicación + Converse API**.

### Justificación

1. La API RetrieveAndGenerate no incluye `allowed_group_sids` en los metadatos de citación, haciendo imposible el filtrado SID
2. El filtrado del lado de la aplicación se ejecuta fuera del LLM, no puede ser eludido por Prompt Injection
3. Lógica común independiente del tipo de almacenamiento vectorial (S3 Vectors / AOSS)
4. La implementación Fail-Closed (denegar todo en caso de fallo de recuperación SID) es clara

### Impacto

- Necesidad de establecer un número de recuperación más alto ya que el filtrado se aplica a todos los documentos de la API Retrieve
- La calidad de las respuestas puede degradarse si quedan pocos documentos después del filtrado
- Caché de permisos (DynamoDB, TTL 5 minutos) acelera las verificaciones repetidas

---

## ADR-003: Autenticación — Cognito + Federación multi-IdP

| Elemento | Detalles |
|----------|----------|
| **Estado** | Aprobado |
| **Fecha** | 2026-02-01 |
| **Contexto** | Selección del método de autenticación de usuarios y recuperación de SID/UID/GID |

### Opciones consideradas

| Opción | Ventajas | Desventajas |
|--------|----------|-------------|
| Cognito + SAML/OIDC/LDAP (adoptado) | 5 modos soportados, cambio por parámetro CDK, soporte Fail-Closed | Limitaciones de Cognito (número de atributos personalizados, tamaño del token) |
| IAM Identity Center uso directo | SSO nativo de AWS | Integración compleja con la aplicación RAG |
| Autenticación personalizada (Lambda Authorizer) | Flexibilidad total | Alto costo de implementación y operación |

### Decisión

Usar **Cognito User Pool** como hub, con 5 modos conmutables vía parámetros CDK: SAML (AD Federation), OIDC (Auth0/Keycloak/Okta), LDAP (OpenLDAP/FreeIPA), y correo electrónico/contraseña.

### Justificación

1. Cognito se integra fácilmente con CloudFront + Lambda Function URL (IAM Auth)
2. El Post-Authentication Trigger permite la recuperación automática de SID/UID/GID y registro en DynamoDB
3. `authFailureMode=fail-closed` bloquea el inicio de sesión cuando falla la recuperación de permisos
4. Flexibilidad para seleccionar el modo según el IdP existente del cliente

### Impacto

- Tener en cuenta las limitaciones de Cognito (50 atributos personalizados, tamaño de token 2KB)
- Gestión de URL de metadatos SAML necesaria (durante la renovación del certificado IdP)
- La consulta LDAP directa requiere Lambda dentro del VPC

---

## ADR-004: Frontend — Lambda Web Adapter + Next.js 15

| Elemento | Detalles |
|----------|----------|
| **Estado** | Aprobado |
| **Fecha** | 2026-01-10 |
| **Contexto** | Selección del método de alojamiento de la aplicación web |

### Opciones consideradas

| Opción | Ventajas | Desventajas |
|--------|----------|-------------|
| Lambda Web Adapter + Next.js (adoptado) | Serverless, IAM Auth + OAC, arranque en frío aceptable | Arranque en frío 3-5 segundos, tamaño de imagen Docker |
| ECS Fargate | Siempre activo, baja latencia | Mínimo $30/mes (siempre activo), ALB necesario |
| Amplify Hosting | Gestionado, integración CI/CD | IAM Auth no soportado, limitaciones de personalización |
| App Runner | Despliegue fácil, auto-escalado | IAM Auth no soportado, limitaciones de integración VPC |

### Decisión

Ejecutar Next.js 15 de forma serverless con **Lambda Web Adapter**, protegido por CloudFront OAC + IAM Auth.

### Justificación

1. La autenticación IAM (Function URL + OAC) previene completamente el acceso directo fuera de CloudFront
2. Serverless significa cero costo durante períodos de inactividad
3. Despliegue CDK con un solo comando (incluyendo construcción de imagen Docker)
4. Next.js 15 App Router + Server Components permiten SSR/ISR

### Impacto

- El arranque en frío (3-5 segundos) ocurre en el primer acceso. Se puede mitigar con Provisioned Concurrency
- Optimización del tamaño de imagen Docker necesaria (construcción multi-etapa)
- Apple Silicon (M1/M2/M3) requiere modo de pre-construcción (compatibilidad Lambda x86_64)

---

## ADR-005: Sincronización de datos — KB Auto-Sync (método de sondeo)

| Elemento | Detalles |
|----------|----------|
| **Estado** | Aprobado |
| **Fecha** | 2026-04-15 |
| **Contexto** | Método para reflejar los cambios de archivos en FSx for ONTAP en Bedrock KB |

### Opciones consideradas

| Opción | Ventajas | Desventajas |
|--------|----------|-------------|
| Sondeo EventBridge Scheduler (adoptado) | Simple, no requiere eventos FSx, compatible con S3 AP | Retraso máximo 15 minutos, costo de ListObjectsV2 |
| CloudTrail + EventBridge (basado en eventos) | Casi tiempo real | Soporte CloudTrail limitado para S3 AP |
| FSx Audit Log + EventBridge | Eventos a nivel de archivo | Configuración compleja, alto volumen de logs |
| Solo activación manual | Lo más simple | Carga operativa, riesgo de sincronizaciones perdidas |

### Decisión

**Sondeo EventBridge Scheduler a intervalos de 5-15 minutos** como predeterminado, ejecutando `StartIngestionJob` solo cuando se detectan cambios.

### Justificación

1. FSx for ONTAP S3 Access Point tiene soporte limitado de eventos de datos CloudTrail
2. ListObjectsV2 + comparación de inventario DynamoDB detecta cambios de forma confiable
3. La deduplicación de trabajos IN_PROGRESS previene sincronizaciones innecesarias
4. 3 fallos consecutivos activan CloudWatch Alarm → notificación al equipo de operaciones

### Impacto

- Retraso máximo de sincronización de 15 minutos (depende del intervalo de sondeo)
- Entornos a gran escala (100,000+ archivos) deben considerar el tiempo de ejecución de ListObjectsV2
- La ruta Transfer Family también soporta el modo basado en eventos CloudTrail

---

## ADR-006: Smart Routing — Selección automática de modelo de 3 niveles

| Elemento | Detalles |
|----------|----------|
| **Estado** | Aprobado |
| **Fecha** | 2026-05-01 |
| **Contexto** | Estrategia de selección de modelo para optimización de costos |

### Opciones consideradas

| Opción | Ventajas | Desventajas |
|--------|----------|-------------|
| Enrutamiento automático de 3 niveles (adoptado) | Reducción de costos 60-80%, calidad mantenida | Depende de la precisión de clasificación, riesgo de clasificación errónea |
| Modelo único fijo | Simple, predecible | Costo ineficiente o calidad insuficiente |
| Selección manual del usuario | Control del usuario | UX degradada, gestión de costos difícil |

### Decisión

**Enrutamiento automático de 3 niveles** basado en la complejidad de la consulta (Simple → Haiku, Complex → Sonnet, Full-context → Opus) como predeterminado, con opción de selección manual también disponible.

### Justificación

1. En RAG empresarial, 60%+ de las preguntas son verificaciones de hechos simples (Haiku es suficiente)
2. El costo promedio ponderado ~$0.014/query mejora la calidad manteniendo un costo similar al todo-Sonnet (~$0.01)
3. Las métricas CloudWatch EMF visualizan la distribución de enrutamiento, permitiendo el ajuste de umbrales
4. El mecanismo de respaldo (cambio automático al siguiente nivel cuando el modelo no está disponible) asegura la disponibilidad

### Impacto

- La precisión del clasificador afecta directamente el costo y la calidad (ajuste periódico de umbrales recomendado)
- Atención a los picos de costo durante el uso de Opus (configuración de límite de costo diario recomendada)
- Cuando Smart Routing está desactivado, se usa un modelo único fijo como antes

---

## Documentos relacionados

| Documento | ADR relacionado |
|-----------|----------------|
| [s3-vectors-sid-architecture-guide.md](../s3-vectors-sid-architecture-guide.md) | ADR-001, ADR-002 |
| [SID-Filtering-Architecture.md](../SID-Filtering-Architecture.md) | ADR-002 |
| [auth-and-user-management.md](../auth-and-user-management.md) | ADR-003 |
| [stack-architecture-comparison.md](../stack-architecture-comparison.md) | ADR-001, ADR-004 |
| [permission-consistency.md](../permission-consistency.md) | ADR-005 |
| [evaluation.md](../evaluation.md) | ADR-006 |
