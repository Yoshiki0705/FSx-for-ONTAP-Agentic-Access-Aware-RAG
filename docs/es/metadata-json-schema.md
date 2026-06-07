# Especificación formal del esquema .metadata.json

**🌐 Language:** [日本語](../metadata-json-schema.md) | [English](../en/metadata-json-schema.md) | **Español**

**Fecha de creación**: 2026-06-08  
**Estado**: Especificación formal  
**Audiencia**: Desarrolladores, Ingenieros de datos, Socios

---

## Descripción general

Especificación formal del archivo de metadatos (`.metadata.json`) que adjunta información de permisos a los documentos en FSx for ONTAP. Funciona con el filtrado de metadatos de Bedrock Knowledge Base para habilitar RAG con reconocimiento de permisos (Permission-Aware RAG).

---

## Convención de nombres de archivos

```
Documento objetivo:    {path}/{filename}.{ext}
Archivo de metadatos:  {path}/{filename}.{ext}.metadata.json
```

**Ejemplo:**
```
reports/esg/2026-06-06/report-abc.json
reports/esg/2026-06-06/report-abc.json.metadata.json  ← metadatos
```

---

## Definición del esquema

```json
{
  "metadataAttributes": {
    "allowed_group_sids": ["S-1-1-0", "S-1-5-21-xxx-512"],
    "category": "esg",
    "owner": "sustainability-team",
    "classification": "internal"
  }
}
```

### Lista de campos

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `metadataAttributes` | Object | ✅ | Contenedor de atributos de metadatos |
| `metadataAttributes.allowed_group_sids` | `string[]` (formal) o `string` (retrocompatible) | ✅ | Lista de SIDs con acceso permitido |
| `metadataAttributes.category` | `string` | ❌ | Categoría del documento |
| `metadataAttributes.owner` | `string` | ❌ | Propietario (equipo/departamento) |
| `metadataAttributes.classification` | `string` enum | ❌ | Nivel de confidencialidad |

### Formatos de `allowed_group_sids`

| Formato | Ejemplo | Estado |
|---------|---------|--------|
| **Array (formal)** | `["S-1-1-0", "S-1-5-21-xxx-512"]` | ✅ Recomendado |
| Separado por comas | `"S-1-1-0,S-1-5-21-xxx-512"` | ⚠️ Retrocompatible (obsoleto) |
| Cadena JSON | `"[\"S-1-1-0\"]"` | ⚠️ Retrocompatible (obsoleto) |
| Valor único | `"S-1-1-0"` | ⚠️ Retrocompatible |

> **Importante**: Utilice siempre el **formato de array** al crear nuevos archivos.

### Valores válidos de `classification`

| Valor | Descripción |
|-------|-------------|
| `public` | Información pública (accesible por todos los usuarios) |
| `internal` | Solo uso interno |
| `confidential` | Confidencial (solo grupos específicos) |
| `restricted` | Ultra secreto (requiere aprobación individual) |

---

## Formato SID

Formato estándar de Windows Security Identifier (SID):

```
S-{revision}-{authority}-{sub1}-{sub2}-...-{RID}
```

| SID | Significado |
|-----|-------------|
| `S-1-1-0` | Everyone (todos) |
| `S-1-5-21-xxx-512` | Domain Admins |
| `S-1-5-21-xxx-513` | Domain Users |
| `S-1-5-32-544` | Administrators (Builtin) |

---

## Principio Fail-Closed

| Estado | Comportamiento |
|--------|----------------|
| `.metadata.json` no existe | **Acceso denegado** (Fail-Closed) |
| `allowed_group_sids` es un array vacío | **Acceso denegado** |
| `allowed_group_sids` no tiene coincidencia con los SIDs del usuario | **Acceso denegado** |
| `allowed_group_sids` tiene coincidencia con los SIDs del usuario | **Acceso concedido** |

---

## Reglas de validación

1. `metadataAttributes` es obligatorio
2. `allowed_group_sids` es obligatorio y no puede estar vacío
3. Cada SID debe comenzar con `S-` en formato válido (solo advertencia, no bloqueante)
4. El formato separado por comas emite una advertencia recomendando la migración al formato de array

---

## Herramienta de creación

```bash
# Crear metadatos en formato formal mediante script
python3 -c "
import json
metadata = {
    'metadataAttributes': {
        'allowed_group_sids': ['S-1-1-0', 'S-1-5-21-xxx-512'],
        'category': 'esg',
        'classification': 'internal'
    }
}
print(json.dumps(metadata, indent=2))
" > document.json.metadata.json
```

---

## Documentos relacionados

- [Pruebas de Permission Matrix](../../tests/permission-matrix/) — 31 escenarios de verificación de permisos
- [Manejo de errores KB Auto-Sync](../kb-auto-sync-error-handling.md) — Ingesta de documentos con metadatos
- [Lista de verificación de producción](../production-readiness-checklist.md) — Requisitos operativos de gestión de metadatos
