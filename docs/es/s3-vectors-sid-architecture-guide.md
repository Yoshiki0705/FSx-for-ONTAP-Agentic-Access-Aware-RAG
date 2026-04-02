# Guía de Arquitectura de S3 Vectors + Filtrado SID

**🌐 Language:** [日本語](../s3-vectors-sid-architecture-guide.md) | [English](../en/s3-vectors-sid-architecture-guide.md) | [한국어](../ko/s3-vectors-sid-architecture-guide.md) | [简体中文](../zh-CN/s3-vectors-sid-architecture-guide.md) | [繁體中文](../zh-TW/s3-vectors-sid-architecture-guide.md) | [Français](../fr/s3-vectors-sid-architecture-guide.md) | [Deutsch](../de/s3-vectors-sid-architecture-guide.md) | **Español**

**Creado**: 2026-03-29
**Entorno de verificación**: ap-northeast-1 (Tokio)
**Estado**: Despliegue CDK verificado, filtrado SID verificado

---

## Descripción general

Este documento resume las decisiones arquitectónicas para adoptar Amazon S3 Vectors como almacén vectorial para un sistema RAG con permisos, junto con patrones de integración para control de acceso basado en SID. Incluye resultados de verificación y recomendaciones en respuesta a comentarios de expertos.

---

## Evaluación de patrones de filtrado SID

### Enfoque actual en este sistema

Este sistema utiliza la API Bedrock KB Retrieve para realizar búsquedas vectoriales y coincide el campo `allowed_group_sids` en los metadatos devueltos en el lado de la aplicación. Este enfoque es agnóstico al almacén vectorial.

```
Bedrock KB Retrieve API → Resultados de búsqueda + Metadatos (allowed_group_sids)
→ Coincidencia en el lado de la aplicación: SID del usuario ∩ SID del documento
→ Llamar a Converse API solo con documentos coincidentes
```

### Patrón A: Adjuntar SID como metadatos filtrables (Patrón recomendado)

Dado que todos los metadatos en S3 Vectors son filtrables por defecto, `allowed_group_sids` puede filtrarse sin configuración adicional.

#### Aplicación en este sistema

Dado que este sistema accede a S3 Vectors a través de Bedrock KB, el parámetro de filtro `QueryVectors` no puede controlarse directamente. La API Bedrock KB Retrieve realiza la búsqueda vectorial y devuelve resultados incluyendo metadatos. El filtrado SID se realiza en el lado de la aplicación.

Ventajas de este enfoque:
- La API Bedrock KB Retrieve es agnóstica al almacén vectorial, por lo que el mismo código de aplicación funciona tanto con S3 Vectors como con AOSS
- `allowed_group_sids` de `.metadata.json` se almacena y devuelve tal cual como metadatos
- La lógica de filtrado SID del lado de la aplicación (`route.ts`) no requiere cambios

#### Respuesta a comentarios de expertos

> Por favor, asegúrese mediante pruebas de que la aplicación siempre aplica el filtro SID. El filtro de metadatos de S3 Vectors es conveniente, pero no es un sustituto del control de acceso en sí.

Este sistema asegura esto mediante lo siguiente:
1. El filtrado SID está integrado en la ruta de la API KB Retrieve (`route.ts`) y no puede ser evitado
2. Si la información SID no puede recuperarse de DynamoDB, todos los documentos son denegados (principio Fail-Closed)
3. Las pruebas basadas en propiedades (Propiedad 5) han verificado la independencia del almacén vectorial del filtrado SID

### Patrón B: Separación de índices por SID/Inquilino

#### Evaluación para este sistema

Los SIDs en este sistema son SIDs de grupo basados en ACL NTFS de Active Directory, y se asignan múltiples SIDs por documento (ej., `["S-1-5-21-...-512", "S-1-1-0"]`). La separación de índices por SID es inapropiada por las siguientes razones:

1. **Relaciones SID de muchos a muchos**: Un solo documento pertenece a múltiples grupos SID, y un solo usuario tiene múltiples SIDs. La separación de índices requeriría almacenamiento duplicado de documentos
2. **Cambios dinámicos en el conteo de SIDs**: El número de SIDs fluctúa a medida que se agregan o modifican grupos AD. La gestión de índices se vuelve compleja
3. **Límite de 10.000 índices/bucket**: En entornos AD grandes, el número de SIDs puede acercarse a este límite

---

## Resultados de verificación de la lista de verificación de migración

### 1. Verificación de modelo de Embedding / Dimensión / Métrica

| Elemento | Actual (AOSS) | S3 Vectors | Compatibilidad |
|----------|---------------|-----------|----------------|
| Modelo de Embedding | Amazon Titan Embed Text v2 | Igual | ✅ |
| Dimensión | 1024 | 1024 | ✅ |
| Métrica de distancia | l2 (AOSS/faiss) | cosine (S3 Vectors) | ⚠️ Necesita verificación |
| Tipo de datos | - | float32 (requerido) | ✅ |

### 2. Diseño de metadatos

| Clave de metadatos | Propósito | Filtrable | Notas |
|--------------------|-----------|-----------|-------|
| `allowed_group_sids` | Filtrado SID | non-filterable recomendado | El filtro de S3 Vectors no es necesario ya que el filtrado del lado de la aplicación se realiza a través de la API Bedrock KB Retrieve |
| `access_level` | Visualización de nivel de acceso | non-filterable recomendado | Para visualización en UI |
| `doc_type` | Tipo de documento | non-filterable recomendado | Para filtrado futuro |

#### Restricciones de metadatos de S3 Vectors (Valores reales descubiertos durante la verificación)

| Restricción | Valor nominal | Valor efectivo con Bedrock KB | Mitigación |
|------------|---------------|-------------------------------|------------|
| Metadatos filtrables | 2KB/vector | **Metadatos personalizados hasta 1KB** (1KB restante consumido por metadatos internos de Bedrock KB) | Minimizar metadatos personalizados |
| Claves de metadatos non-filterable | Máx 10 claves/índice | 10 claves (5 claves auto de Bedrock KB + 5 claves personalizadas) | Priorizar claves auto de Bedrock KB como non-filterable |
| Total de claves de metadatos | Máx 50 claves/vector | 35 claves (al usar Bedrock KB) | Sin problema |

### 3. Verificación previa de permisos insuficientes

Acciones IAM requeridas confirmadas mediante verificación:

```
KB Role (para Bedrock KB):
  s3vectors:QueryVectors   ← Requerido para búsqueda
  s3vectors:PutVectors     ← Requerido para sincronización de datos
  s3vectors:DeleteVectors  ← Requerido para sincronización de datos
  s3vectors:GetVectors     ← Requerido para recuperación de metadatos
  s3vectors:ListVectors    ← Encontrado como requerido durante la verificación
```

### 4. Verificación de rendimiento

> **Estado**: Verificación de despliegue CDK completada. Verificación de latencia de API Retrieve completada.

Rendimiento nominal de S3 Vectors:
- Consulta fría: Sub-segundo (dentro de 1 segundo)
- Consulta caliente: ~100ms o menos
- Consultas de alta frecuencia: Latencia reducida

### 5. Diseño de migración por fases

Este sistema soporta migración por fases mediante cambio a través del parámetro de contexto CDK `vectorStoreType`:

1. **Fase 1**: Nuevo despliegue con `vectorStoreType=s3vectors` (entorno de verificación) ← Actualmente aquí
2. **Fase 2**: Adición/sincronización de fuente de datos, verificación de recuperación de metadatos SID a través de API Retrieve
3. **Fase 3**: Verificación de rendimiento (latencia, concurrencia)
4. **Fase 4**: Decisión sobre adopción en entorno de producción

---

## Resultados de verificación de despliegue CDK

### Entorno de verificación

- Región: ap-northeast-1 (Tokio)
- Nombres de stack: s3v-test-val-AI (verificación independiente), perm-rag-demo-demo-* (verificación de stack completo)
- vectorStoreType: s3vectors
- Tiempo de despliegue: AI stack independiente ~83 segundos, stack completo (6 stacks) ~30 minutos

### Resultados de verificación E2E de stack completo (2026-03-30)

Se realizó verificación E2E de la configuración S3 Vectors con los 6 stacks desplegados (Networking, Security, Storage, AI, WebApp + WAF).

#### Verificación de operación de filtrado SID

| Usuario | SID | Pregunta | Documentos referenciados | Resultado |
|---------|-----|----------|-------------------------|-----------|
| admin@example.com | Domain Admins (-512) + Everyone (S-1-1-0) | "Cuéntame sobre las ventas de la empresa" | confidential/financial-report.txt + public/product-catalog.txt (2 docs) | ✅ La respuesta incluye información de ventas de 15 mil millones de yenes |
| user@example.com | Usuario regular (-1001) + Everyone (S-1-1-0) | "Cuéntame sobre las ventas de la empresa" | public/product-catalog.txt (solo 1 doc) | ✅ Sin información de ventas (documento confidencial correctamente excluido) |

---

## Documentos relacionados

| Documento | Contenido |
|-----------|-----------|
| [SID-Filtering-Architecture.md](SID-Filtering-Architecture.md) | Detalles del diseño de filtrado SID |
| [stack-architecture-comparison.md](stack-architecture-comparison.md) | Tabla comparativa de 3 configuraciones y lecciones de implementación |
| [.kiro/specs/s3-vectors-integration/design.md](../.kiro/specs/s3-vectors-integration/design.md) | Documento de diseño técnico |
| [.kiro/specs/s3-vectors-integration/requirements.md](../.kiro/specs/s3-vectors-integration/requirements.md) | Documento de requisitos |