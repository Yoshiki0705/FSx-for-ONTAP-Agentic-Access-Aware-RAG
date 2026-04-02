# Arquitectura de Filtrado de Permisos Basado en SID

**🌐 Language:** [日本語](../SID-Filtering-Architecture.md) | [English](../en/SID-Filtering-Architecture.md) | [한국어](../ko/SID-Filtering-Architecture.md) | [简体中文](../zh-CN/SID-Filtering-Architecture.md) | [繁體中文](../zh-TW/SID-Filtering-Architecture.md) | [Français](../fr/SID-Filtering-Architecture.md) | [Deutsch](../de/SID-Filtering-Architecture.md) | **Español**

## Descripción general

Este sistema aprovecha los SIDs (Security Identifiers) de ACL NTFS para filtrar los resultados de búsqueda RAG por usuario. La información de permisos de acceso del sistema de archivos FSx for NetApp ONTAP se almacena como metadatos en la base de datos vectorial, y las verificaciones de permisos se realizan en tiempo real durante las búsquedas.

---

## Diagrama de arquitectura general

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Flujo de ingesta de datos                        │
│                                                                         │
│  ┌──────────────┐    ┌─────────────────┐    ┌───────────────────────┐  │
│  │ FSx for ONTAP│    │ S3 Access Point │    │ Bedrock Knowledge Base│  │
│  │              │───▶│                 │───▶│                       │  │
│  │ NTFS ACL     │    │ Expone volúmenes│    │ ・Vectorizado con     │  │
│  │ Permisos de  │    │ FSx a través de │    │   Titan Embed v2      │  │
│  │ archivos     │    │ interfaz        │    │ ・Metadatos (SID)     │  │
│  │ + .metadata  │    │ compatible S3   │    │   también almacenados │  │
│  │   .json      │    └─────────────────┘    └───────────┬───────────┘  │
│  └──────────────┘                                       │              │
│                                                         ▼              │
│                                          ┌──────────────────────────┐  │
│                                          │ Almacén vectorial        │  │
│                                          │ (Seleccionado por        │  │
│                                          │  vectorStoreType)        │  │
│                                          │ ・S3 Vectors (predet.)   │  │
│                                          │ ・OpenSearch Serverless   │  │
│                                          │                          │  │
│                                          │ Datos vectoriales +      │  │
│                                          │ metadatos (SID etc.)     │  │
│                                          │ almacenados              │  │
│                                          └──────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

> **Sobre S3 Access Point**: El S3 Access Point para FSx for ONTAP expone directamente los archivos en volúmenes FSx a través de una interfaz compatible con S3. No es necesario copiar archivos a un bucket S3 separado. Bedrock KB referencia el alias del S3 AP como fuente de datos e ingiere directamente documentos (incluyendo `.metadata.json`) del volumen FSx.

---

## Lógica detallada de filtrado SID

### Paso 1: Recuperación de SIDs del usuario

Cuando un usuario envía una pregunta en el chat, la API KB Retrieve recupera la información SID del usuario de la tabla DynamoDB `user-access`.

```
Tabla DynamoDB user-access
┌──────────────────────────────────────────────────────────────┐
│ userId (PK)          │ userSID              │ groupSIDs      │
├──────────────────────┼──────────────────────┼────────────────┤
│ {Cognito sub}        │ S-1-5-21-...-500     │ [S-1-5-21-...-512, │
│ (admin@example.com)  │ (Administrador)      │  S-1-1-0]      │
├──────────────────────┼──────────────────────┼────────────────┤
│ {Cognito sub}        │ S-1-5-21-...-1001    │ [S-1-1-0]      │
│ (user@example.com)   │ (Usuario regular)    │                │
└──────────────────────┴──────────────────────┴────────────────┘

→ Lista completa de SIDs del usuario = [userSID] + groupSIDs
   admin: [S-1-5-21-...-500, S-1-5-21-...-512, S-1-1-0]
   user:  [S-1-5-21-...-1001, S-1-1-0]
```

### Paso 2: Recuperación de metadatos del documento

Cada cita en los resultados de búsqueda de Bedrock KB contiene metadatos ingeridos de los archivos `.metadata.json` en S3.

> **Cómo se crea `.metadata.json`**: Este sistema incluye recuperación automática de ACL NTFS implementada por la AD Sync Lambda (`lambda/agent-core-ad-sync/`) y el servicio de permisos FSx (`lambda/permissions/fsx-permission-service.ts`). En el entorno de demostración, se colocan datos de ejemplo manualmente con fines de verificación. Para más detalles, consulte la sección "Estructura de metadatos" en [docs/embedding-server-design.md](embedding-server-design.md).

```
Metadatos del documento (.metadata.json)
┌──────────────────────────┬──────────────────────────────────────┐
│ Documento                │ allowed_group_sids                   │
├──────────────────────────┼──────────────────────────────────────┤
│ public/product-catalog   │ ["S-1-1-0"]                          │
│                          │  └─ Everyone (todos los usuarios)    │
├──────────────────────────┼──────────────────────────────────────┤
│ public/company-overview  │ ["S-1-1-0"]                          │
│                          │  └─ Everyone (todos los usuarios)    │
├──────────────────────────┼──────────────────────────────────────┤
│ confidential/financial   │ ["S-1-5-21-...-512"]                 │
│                          │  └─ Solo Domain Admins               │
├──────────────────────────┼──────────────────────────────────────┤
│ confidential/hr-policy   │ ["S-1-5-21-...-512"]                 │
│                          │  └─ Solo Domain Admins               │
├──────────────────────────┼──────────────────────────────────────┤
│ restricted/project-plan  │ ["S-1-5-21-...-1100",                │
│                          │  "S-1-5-21-...-512"]                 │
│                          │  └─ Engineering + Domain Admins      │
└──────────────────────────┴──────────────────────────────────────┘
```

### Paso 3: Coincidencia de SID

La lista de SIDs del usuario se compara con los `allowed_group_sids` del documento.

```
Regla de coincidencia: SID del usuario ∩ SID del documento ≠ ∅ → ALLOW

■ Usuario administrador (admin@example.com)
  SIDs del usuario: [S-1-5-21-...-500, S-1-5-21-...-512, S-1-1-0]

  public/product-catalog    → S-1-1-0 ∈ SIDs del usuario → ✅ ALLOW
  public/company-overview   → S-1-1-0 ∈ SIDs del usuario → ✅ ALLOW
  confidential/financial    → S-1-5-21-...-512 ∈ SIDs del usuario → ✅ ALLOW
  confidential/hr-policy    → S-1-5-21-...-512 ∈ SIDs del usuario → ✅ ALLOW
  restricted/project-plan   → S-1-5-21-...-512 ∈ SIDs del usuario → ✅ ALLOW

■ Usuario regular (user@example.com)
  SIDs del usuario: [S-1-5-21-...-1001, S-1-1-0]

  public/product-catalog    → S-1-1-0 ∈ SIDs del usuario → ✅ ALLOW
  public/company-overview   → S-1-1-0 ∈ SIDs del usuario → ✅ ALLOW
  confidential/financial    → S-1-5-21-...-512 ∉ SIDs del usuario → ❌ DENY
  confidential/hr-policy    → S-1-5-21-...-512 ∉ SIDs del usuario → ❌ DENY
  restricted/project-plan   → {-1100, -512} ∩ {-1001, S-1-1-0} = ∅ → ❌ DENY
```

### Paso 4: Fallback de seguridad

Cuando no se puede recuperar la información SID (sin registro en DynamoDB, error de conexión, etc.), el sistema recurre al lado seguro y deniega el acceso a todos los documentos.

```
Flujo cuando falla la recuperación de SID:
  DynamoDB → Error o sin registro
    → allUserSIDs = [] (vacío)
    → Todos los documentos DENY
    → filterMethod: "DENY_ALL_FALLBACK"
```

---

## Sobre SID (Security Identifier)

### Estructura del SID

```
S-1-5-21-{DomainID1}-{DomainID2}-{DomainID3}-{RID}
│ │ │  │  └─────────────────────────────────────────┘  └─┘
│ │ │  │              Identificador de dominio          ID relativo
│ │ │  └─ Conteo de sub-autoridades
│ │ └─ Identifier Authority (5 = NT Authority)
│ └─ Revisión
└─ Prefijo SID
```

### SIDs clave

| SID | Nombre | Descripción |
|-----|--------|-------------|
| `S-1-1-0` | Everyone | Todos los usuarios |
| `S-1-5-21-...-500` | Administrator | Administrador de dominio |
| `S-1-5-21-...-512` | Domain Admins | Grupo de administradores de dominio |
| `S-1-5-21-...-1001` | User | Usuario regular |
| `S-1-5-21-...-1100` | Engineering | Grupo de ingeniería |

### SID en FSx for ONTAP

FSx for ONTAP soporta ACLs de Windows en volúmenes con estilo de seguridad NTFS. Cada archivo/directorio tiene una ACL (Access Control List) configurada, y los permisos de acceso se gestionan por SID.

Al acceder a archivos en FSx a través de S3 Access Point, la información de ACL NTFS se expone como metadatos. Este sistema ingiere esta información ACL (SIDs) como metadatos de Bedrock KB y la utiliza para el filtrado durante las búsquedas.

---

## Flujo de datos detallado

### Opciones de ruta de ingesta de datos

Este sistema proporciona tres rutas de ingesta de datos. Dado que S3 Access Point no está disponible para volúmenes FlexCache Cache a marzo de 2026, se requiere una configuración de respaldo.

| # | Ruta | Método | Activación CDK | Caso de uso |
|---|------|--------|----------------|-------------|
| 1 | Principal | FSx ONTAP Volume → S3 Access Point → Bedrock KB | `post-deploy-setup.sh` | Volúmenes estándar (S3 AP soportado) |
| 2 | Respaldo | Carga manual a bucket S3 → Bedrock KB | `upload-demo-data.sh` | Volúmenes FlexCache y otros casos no soportados por S3 AP |
| 3 | Alternativa | Montaje CIFS → Servidor de Embedding → Escritura directa a AOSS | `-c enableEmbeddingServer=true` | Volúmenes FlexCache + casos que requieren control directo de AOSS |

El bucket S3 para la Ruta 2 (`${prefix}-kb-data-${ACCOUNT_ID}`) siempre es creado por StorageStack. Cuando S3 AP no está disponible, puede cargar documentos + `.metadata.json` a este bucket y configurarlo como fuente de datos KB para habilitar el filtrado SID.

---

## Ejemplo de respuesta API

### Log de filtrado (filterLog)

```json
{
  "totalDocuments": 5,
  "allowedDocuments": 2,
  "deniedDocuments": 3,
  "userId": "4704eaa8-3041-70d9-672b-e4fbb65bec40",
  "userSIDs": [
    "S-1-5-21-0000000000-0000000000-0000000000-1001",
    "S-1-1-0"
  ],
  "filterMethod": "SID_MATCHING",
  "details": [
    {
      "fileName": "product-catalog.md",
      "documentSIDs": ["S-1-1-0"],
      "matched": true,
      "matchedSID": "S-1-1-0"
    },
    {
      "fileName": "financial-report.md",
      "documentSIDs": ["S-1-5-21-0000000000-0000000000-0000000000-512"],
      "matched": false
    }
  ]
}
```

---

## Diseño de seguridad

### Principio de Fallback Fail-Safe

Este sistema sigue el principio "Fail-Closed", denegando el acceso a todos los documentos cuando las verificaciones de permisos fallan.

| Situación | Comportamiento |
|-----------|---------------|
| Error de conexión DynamoDB | Denegar todos los documentos |
| Sin registro de SID del usuario | Denegar todos los documentos |
| Sin información SID en metadatos | Denegar el documento correspondiente |
| Sin coincidencia de SID | Denegar el documento correspondiente |
| Coincidencia de SID encontrada | Permitir el documento correspondiente |

### Caché de permisos

Los resultados de filtrado se almacenan en caché en la tabla DynamoDB `permission-cache` para acelerar las verificaciones repetidas para la misma combinación de usuario y documento (TTL: 5 minutos).