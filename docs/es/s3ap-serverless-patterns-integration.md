# Arquitectura de integración de S3AP Serverless Patterns

**🌐 Language:** [日本語](../s3ap-serverless-patterns-integration.md) | [English](../en/s3ap-serverless-patterns-integration.md) | [한국어](../ko/s3ap-serverless-patterns-integration.md) | [简体中文](../zh-CN/s3ap-serverless-patterns-integration.md) | [繁體中文](../zh-TW/s3ap-serverless-patterns-integration.md) | [Français](../fr/s3ap-serverless-patterns-integration.md) | [Deutsch](../de/s3ap-serverless-patterns-integration.md) | **Español**

**Fecha de creación**: 2026-05-23  
**Estado**: Borrador  
**Audiencia**: Arquitectos, SA de socios

---

## Descripción general

Este documento describe la arquitectura de integración entre [FSx for ONTAP S3 Access Points Serverless Patterns](https://github.com/Yoshiki0705/FSx-for-ONTAP-S3AccessPoints-Serverless-Patterns) (patrones de procesamiento serverless para 17 UC) y este proyecto (Permission-aware Agentic RAG).

---

## Posicionamiento de los dos proyectos

```
┌─────────────────────────────────────────────────────────────────────────┐
│ FSx for ONTAP (servidor de archivos empresarial)                        │
│                                                                         │
│  Datos NAS: planos, contratos, historiales médicos...                   │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │ S3 Access Point
                    ┌────────────┴────────────┐
                    │                         │
                    ▼                         ▼
┌──────────────────────────────┐  ┌──────────────────────────────┐
│ S3AP Serverless Patterns     │  │ Permission-aware RAG         │
│ (Procesamiento /             │  │ (Búsqueda y diálogo de IA    │
│  Transformación / Análisis)  │  │  basados en permisos)        │
│                              │  │                              │
│ • Step Functions (lotes)     │  │ • Bedrock KB + Converse API  │
│ • Integración AI/ML          │  │ • Filtrado SID               │
│ • Reescritura en FSx         │  │ • UI de chat (Next.js)       │
│                              │  │ • Modo Agent                 │
│ 17 UC sectoriales            │  │ 14 plantillas Agent          │
└──────────────────────────────┘  └──────────────────────────────┘
```

---

## Patrones de integración

### Patrón A: hacer consultables los resultados de procesamiento a través del RAG

Los resultados procesados y analizados por los S3AP Serverless Patterns se utilizan como documentos consultables en el RAG.

```
FSx for ONTAP (datos sin procesar: imágenes DICOM, PDF de contratos, registros IoT)
  ↓ S3 AP (lectura)
S3AP Serverless Patterns
  ├─ UC5: DICOM → extracción de metadatos y anonimización
  ├─ UC1: contratos → extracción y clasificación de entidades
  └─ UC3: registros IoT → detección de anomalías y generación de informes
  ↓ S3 AP (reescritura) o bucket de S3
FSx for ONTAP (datos procesados + .metadata.json)
  ↓ S3 AP (lectura)
Permission-aware RAG (Bedrock KB)
  ↓ Filtrado SID
Usuario: «¿Qué productos presentaron anomalías en la inspección de calidad el mes pasado?»
```

**Ventajas**:
- Los datos sin procesar (imágenes, binarios) se convierten en texto comprensible para la IA antes de su incorporación al RAG
- Se añaden metadatos de permisos a los resultados de procesamiento, manteniendo el control de acceso por departamento
- Ambos sistemas comparten el mismo volumen de FSx for ONTAP (no se requiere copiar datos)

### Patrón B: activar canalizaciones de procesamiento desde el RAG

Cuando el usuario indica «Ejecutar un análisis» en el modo Agent, se activan las Step Functions del patrón S3AP.

```
Usuario: «Analiza las imágenes más recientes de inspección de calidad y crea un informe»
  ↓
Agent (Permission-aware RAG)
  ↓ Action Group: triggerAnalysisPipeline
Step Functions (S3AP UC3: análisis de fabricación)
  ↓ Procesamiento completado
Agent: «El análisis se ha completado. Estos son los resultados: ...»
```

### Patrón C: integración de auditoría y cumplimiento

Los resultados de auditoría de S3AP UC1 (legal/cumplimiento) se hacen consultables a través del RAG, lo que permite verificar el estado de cumplimiento de forma interactiva.

```
S3AP UC1: auditoría del servidor de archivos → generación del informe de auditoría
  ↓
RAG: «¿Existen archivos con infracciones de cumplimiento?»
  → Responde con información dentro del ámbito de permisos del usuario, a partir de los informes de auditoría
```

---

## Mapeo de integración por sector

| S3AP UC | Sector | Uso en el RAG | Plantilla Agent |
|---------|------|----------------|------------------|
| UC1 | Legal | Búsqueda de informes de auditoría, verificación del estado de cumplimiento | `legalCompliance` |
| UC2 | Finanzas | Búsqueda de facturas y contratos procesados por OCR | `financial` |
| UC3 | Fabricación | Búsqueda de informes de inspección de calidad y resultados de detección de anomalías | `search` |
| UC5 | Salud | Búsqueda de metadatos DICOM y hallazgos anonimizados | `medicalGuideline` |
| UC10 | Construcción | Búsqueda de metadatos BIM e informes de cumplimiento de seguridad | `project` |
| UC13 | Educación | Búsqueda de resultados de clasificación de artículos y redes de citas | `search` |
| UC14 | Seguros | Búsqueda de informes de tasación y resultados de evaluación de daños | `insuranceClaim` |
| UC16 | Sector público | Búsqueda de clasificación de documentos y documentos censurados | `publicDocument` |

---

## Ejemplos de configuración de implementación

### Configuración mínima (cuenta única)

```
AWS Account
├── FSx for ONTAP (volumen compartido)
│   └── S3 Access Point
├── S3AP Serverless Patterns (CloudFormation)
│   └── UC1 / UC3 / UC5 (implementación selectiva)
└── Permission-aware RAG (CDK)
    └── Bedrock KB → S3 AP → FSx for ONTAP
```

### Configuración empresarial (multicuenta)

```
Management Account
├── StackSets (distribución de patrones S3AP)
└── CDK Pipelines (distribución del RAG)

Data Account
├── FSx for ONTAP
└── S3 Access Points

Processing Account
└── S3AP Serverless Patterns (Step Functions)

RAG Account
└── Permission-aware RAG (Bedrock KB + WebApp)
```

---

## Documentos relacionados

| Documento | Contenido |
|----------|---------|
| [partner-deployment-patterns.md](partner-deployment-patterns.md) | Patrones de implementación multiinquilino |
| [architecture-decision-records.md](architecture-decision-records.md) | ADR (almacén de vectores, filtro de permisos, etc.) |
| [S3AP Serverless Patterns README](https://github.com/Yoshiki0705/FSx-for-ONTAP-S3AccessPoints-Serverless-Patterns) | Detalles de los 17 UC |
