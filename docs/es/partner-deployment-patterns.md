# Patrones de despliegue multi-inquilino / socios

**🌐 Language:** [日本語](../partner-deployment-patterns.md) | [English](../en/partner-deployment-patterns.md) | [한국어](../ko/partner-deployment-patterns.md) | [简体中文](../zh-CN/partner-deployment-patterns.md) | [繁體中文](../zh-TW/partner-deployment-patterns.md) | [Français](../fr/partner-deployment-patterns.md) | [Deutsch](../de/partner-deployment-patterns.md) | **Español**

**Creado**: 2026-05-21  
**Estado**: Borrador  
**Audiencia**: Empresas socias, proveedores SaaS, arquitectos multi-inquilino

---

## Descripción general

Este documento organiza los patrones de arquitectura para empresas socias que despliegan el sistema RAG con reconocimiento de permisos para múltiples clientes. Proporciona directrices de diseño para el aislamiento de datos por cliente, aislamiento de autenticación y aislamiento de costos.

---

## Clientes e industrias objetivo

| Industria | Caso de uso | Requisitos de permisos |
|-----------|-------------|------------------------|
| Manufactura | Búsqueda departamental de planos de diseño y documentos técnicos | Departamento × Proyecto × Nivel de confidencialidad |
| Finanzas | Búsqueda basada en permisos de documentos regulatorios e informes internos | Departamento × Rol × Aislamiento de información del cliente |
| Sector público | Búsqueda por oficina de documentos de políticas y materiales internos | Oficina × Cargo × Público/No público |
| Salud | Búsqueda departamental de manuales de procedimientos y materiales de investigación | Departamento × Profesión × Aislamiento de información del paciente |
| Legal | Búsqueda por caso de contratos y precedentes | Caso × Asignado × Aislamiento del cliente |
| Educación | Búsqueda por facultad de materiales didácticos y recursos de investigación | Facultad × Personal/Estudiante × Laboratorio |

---

## Comparación de patrones de despliegue

### Patrón A: Aislamiento de cuenta AWS por cliente (Recomendado: Empresarial)

```
┌─────────────────────────────────────────────────────────┐
│ Cuenta de gestión del socio                               │
│ ┌─────────────────┐  ┌─────────────────┐               │
│ │ CDK Pipelines   │  │ StackSets       │               │
│ │ / CodePipeline  │  │ (dist plantilla)│               │
│ └────────┬────────┘  └────────┬────────┘               │
└──────────┼────────────────────┼─────────────────────────┘
           │                    │
    ┌──────┴──────┐      ┌─────┴──────┐      ┌──────────────┐
    │ Cliente A   │      │ Cliente B   │      │ Cliente C    │
    │ Cuenta      │      │ Cuenta      │      │ Cuenta       │
    │             │      │             │      │              │
    │ ・FSx ONTAP │      │ ・FSx ONTAP │      │ ・FSx ONTAP  │
    │ ・Bedrock KB│      │ ・Bedrock KB│      │ ・Bedrock KB │
    │ ・Cognito   │      │ ・Cognito   │      │ ・Cognito    │
    │ ・DynamoDB  │      │ ・DynamoDB  │      │ ・DynamoDB   │
    │ ・CloudFront│      │ ・CloudFront│      │ ・CloudFront │
    └─────────────┘      └─────────────┘      └──────────────┘
```

**Ventajas**:
- Aislamiento completo de datos (límite de cuenta AWS)
- Separación de facturación por cliente
- Radio de impacto limitado para incidentes de seguridad
- Operaciones y escalado independientes por cliente

**Desventajas**:
- Sobrecarga operativa de gestión de cuentas
- Costos duplicados para componentes compartidos
- Complejidad del pipeline de despliegue

**Aplicable cuando**:
- Los clientes tienen sus propias cuentas AWS
- Existen requisitos estrictos de aislamiento de datos (finanzas, salud, sector público)
- La cantidad de clientes es 10 o menos

### Patrón B: Aislamiento de SVM / Volumen / Prefijo dentro de 1 cuenta

```
┌─────────────────────────────────────────────────────────────────┐
│ Cuenta AWS compartida                                             │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │ Sistema de archivos FSx for ONTAP                          │    │
│  │                                                            │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐               │    │
│  │  │ SVM-A    │  │ SVM-B    │  │ SVM-C    │               │    │
│  │  │(Cliente  │  │(Cliente  │  │(Cliente  │               │    │
│  │  │ A)       │  │ B)       │  │ C)       │               │    │
│  │  │ Vol-A1   │  │ Vol-B1   │  │ Vol-C1   │               │    │
│  │  │ Vol-A2   │  │ Vol-B2   │  │ Vol-C2   │               │    │
│  │  └──────────┘  └──────────┘  └──────────┘               │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                      │
│  │ KB-A     │  │ KB-B     │  │ KB-C     │  ← KB por inquilino  │
│  │ S3 AP-A  │  │ S3 AP-B  │  │ S3 AP-C  │  ← AP por inquilino │
│  └──────────┘  └──────────┘  └──────────┘                      │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │ Recursos compartidos                                       │    │
│  │ ・CloudFront + WAF (compartido, enrutamiento por ruta)    │    │
│  │ ・Cognito User Pool (aislado por atributo de inquilino)   │    │
│  │ ・DynamoDB (clave de partición por ID de inquilino)       │    │
│  └──────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

**Ventajas**:
- Operaciones consolidadas (gestión de cuenta única)
- Costo compartido para componentes comunes
- Despliegue simplificado

**Desventajas**:
- Aislamiento de datos a nivel de aplicación (riesgo de mala configuración)
- Se requiere prorrateo de facturación
- Posibles problemas de vecino ruidoso

**Aplicable cuando**:
- La cantidad de clientes es grande (10+ empresas)
- Se prioriza la eficiencia de costos
- Los requisitos de aislamiento de datos son relativamente relajados

### Patrón C: Híbrido (Plano de gestión compartido + Plano de datos aislado)

```
┌─────────────────────────────────────────────────────────┐
│ Cuenta de gestión del socio                               │
│ ┌─────────────────────────────────────────────────────┐  │
│ │ Plano de gestión (Compartido)                         │  │
│ │ ・CDK Pipelines / Automatización de despliegue       │  │
│ │ ・API de gestión de inquilinos                       │  │
│ │ ・Panel de monitoreo (agregado)                      │  │
│ │ ・Gestión de facturación                             │  │
│ └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
           │
    ┌──────┴──────────────────────────────────────┐
    │ Plano de datos (Aislado por cliente)          │
    │                                              │
    │  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
    │  │Cliente A │  │Cliente B │  │Cliente C │  │
    │  │ VPC      │  │ VPC      │  │ VPC      │  │
    │  │ FSx+KB   │  │ FSx+KB   │  │ FSx+KB   │  │
    │  └──────────┘  └──────────┘  └──────────┘  │
    └─────────────────────────────────────────────┘
```

---

## Elementos de diseño de aislamiento de inquilinos

### 1. Aislamiento de almacenamiento

| Nivel de aislamiento | Método | Fortaleza de aislamiento de datos | Costo |
|---------------------|--------|-----------------------------------|-------|
| Aislamiento de sistema de archivos | Sistema de archivos FSx por cliente | Máxima | Alto |
| Aislamiento de SVM | Aislamiento de SVM dentro de 1 sistema de archivos | Alta | Medio |
| Aislamiento de volumen | Aislamiento de volumen dentro de 1 SVM | Media | Bajo |
| Aislamiento de prefijo | Aislamiento de directorio dentro de 1 volumen | Baja | Mínimo |

**Recomendado**: Aislamiento de SVM (Patrón B) o aislamiento de sistema de archivos (Patrón A)

### 2. Aislamiento del almacén de vectores

| Método | S3 Vectors | OpenSearch Serverless |
|--------|-----------|---------------------|
| KB por inquilino | KB + Índice separados | KB + Colección separados |
| KB compartida + filtro de metadatos | Filtrar por metadatos `tenant_id` | Filtrar por campo `tenant_id` |

**Recomendado**: KB por inquilino (límite de seguridad claro)

### 3. Aislamiento de autenticación

| Método | Descripción | Patrón aplicable |
|--------|-------------|------------------|
| Aislamiento de Cognito User Pool | User Pool por inquilino | Patrón A |
| Aislamiento de grupo Cognito | User Pool compartido + grupos de inquilino | Patrón B |
| Aislamiento por atributo personalizado | Atributo `custom:tenant_id` | Patrón B |
| Aislamiento de IdP externo | IdP OIDC/SAML por inquilino | Patrón A/C |

### 4. Aislamiento de registros y auditoría

| Recurso | Método de aislamiento |
|---------|----------------------|
| CloudWatch Logs | Grupo de logs o prefijo por inquilino |
| CloudTrail | Trail por inquilino (Patrón A) o Trail compartido + filtro |
| Tabla de auditoría DynamoDB | Clave de partición `tenantId` |
| Bucket de logs S3 | Prefijo por inquilino + política de bucket |

### 5. Aislamiento de cifrado KMS

| Método | Descripción | Costo |
|--------|-------------|-------|
| CMK por inquilino | Aislamiento completo de cifrado | CMK × cantidad de inquilinos |
| CMK compartida + política de clave | Prioridad de eficiencia de costos | 1 CMK |
| CMK gestionada por inquilino (BYOK) | El cliente gestiona las claves | El cliente asume el costo |

---

## Despliegue automatizado con CDK

### Patrón StackSets (para Patrón A)

```typescript
// Desplegar desde la cuenta de gestión del socio a las cuentas de clientes
const stackSet = new CfnStackSet(this, 'TenantStackSet', {
  stackSetName: 'permission-aware-rag-tenant',
  templateBody: tenantTemplate,
  parameters: [
    { parameterKey: 'TenantId', parameterValue: tenantId },
    { parameterKey: 'TenantDomain', parameterValue: tenantDomain },
  ],
  permissionModel: 'SERVICE_MANAGED',
  autoDeployment: { enabled: true, retainStacksOnAccountRemoval: false },
});
```

### Patrón CDK Pipelines (para Patrón C)

```typescript
// Agregar una etapa para cada inquilino
for (const tenant of tenants) {
  pipeline.addStage(new TenantStage(this, `Tenant-${tenant.id}`, {
    env: { account: tenant.accountId, region: tenant.region },
    tenantConfig: tenant,
  }));
}
```

---

## Plantilla de propuesta

### Antes / Después

| Aspecto | Antes (Estado actual) | Después (Con este sistema) |
|---------|----------------------|---------------------------|
| Búsqueda de archivos | Exploración manual de carpetas compartidas, baja precisión de búsqueda | La IA presenta documentos óptimos dentro del alcance de permisos |
| Gestión de permisos | Riesgo de que los límites de permisos desaparezcan durante el uso de IA | Las ACL NTFS existentes se reflejan directamente en la IA |
| Utilización del conocimiento | Silos de conocimiento entre departamentos, dependencia de personas | Búsqueda de conocimiento inter-organizacional respetando permisos |
| Sobrecarga operativa | Se necesita copia de datos y reconfiguración de permisos para IA | Conectar datos en FSx directamente a la IA |

### Criterios de éxito del PoC

| Métrica | Valor objetivo | Método de medición |
|---------|---------------|-------------------|
| Precisión de respuestas | 80%+ (evaluación humana) | Evaluado con conjunto de 50 preguntas |
| Control de permisos | 0 violaciones | Verificado con prueba de matriz de permisos |
| Tiempo de respuesta | P95 < 10 segundos | Métricas de CloudWatch |
| Esfuerzo operativo | 50% de reducción vs. actual | Entrevistas con administradores |

### Consideraciones adicionales para producción

| Categoría | Consideraciones |
|-----------|----------------|
| Federación de identidades | Integración SSO con AD / IdP existente, requisitos de MFA |
| Auditoría | Retención de registros de búsqueda, rastro de acceso, revisión periódica |
| Clasificación de datos | Definiciones de nivel de confidencialidad, criterios de elegibilidad para uso de IA |
| Gestión de costos | Presupuesto mensual, plan de escalado, asignación de costos |
| SLA | Objetivos de disponibilidad, RPO/RTO, estructura de soporte |
| Legal | Términos de servicio, acuerdo de procesamiento de datos, límites de responsabilidad |

---

## Plantilla de estimación de costos

### Estimación mensual (PoC de pequeña escala)

| Recurso | Configuración | Estimación mensual |
|---------|---------------|-------------------|
| FSx for ONTAP | 128 MB/s, 1 TiB SSD, Single-AZ | $300 |
| S3 Vectors | ~10,000 vectores | $5 |
| Bedrock (Titan Embed) | Sincronización inicial + incremental | $10 |
| Bedrock (Claude) | 1,000 consultas/mes | $50 |
| Lambda | WebApp + sincronización | $20 |
| CloudFront + WAF | Tarifa base | $15 |
| DynamoDB | On-demand | $5 |
| Cognito | ~50 usuarios | $0 (nivel gratuito) |
| **Total** | | **~$400/mes** |

### Estimación mensual (Producción: Escala media)

| Recurso | Configuración | Estimación mensual |
|---------|---------------|-------------------|
| FSx for ONTAP | 512 MB/s, 5 TiB SSD, Multi-AZ | $3,000 |
| OpenSearch Serverless | 4 OCU | $1,400 |
| Bedrock (Titan Embed) | Sincronización periódica | $50 |
| Bedrock (Claude Sonnet) | 10,000 consultas/mes | $500 |
| Lambda | WebApp + sincronización + monitoreo | $100 |
| CloudFront + WAF | Tráfico de producción | $100 |
| DynamoDB | Provisioned | $50 |
| Cognito | ~500 usuarios | $25 |
| CloudWatch | Logs + métricas + alarmas | $50 |
| **Total** | | **~$5,300/mes** |

---

## Documentos relacionados

| Documento | Descripción |
|-----------|-------------|
| [production-readiness-checklist.md](production-readiness-checklist.md) | Lista de verificación de preparación para producción |
| [governance-and-audit.md](governance-and-audit.md) | Diseño de gobernanza y auditoría |
| [fsxn-sizing-and-performance.md](fsxn-sizing-and-performance.md) | Dimensionamiento y rendimiento de FSx for ONTAP |
