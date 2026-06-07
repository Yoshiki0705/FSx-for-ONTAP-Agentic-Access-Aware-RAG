# .metadata.json Formale Schema-Spezifikation

**🌐 Language:** [日本語](../metadata-json-schema.md) | [English](../en/metadata-json-schema.md) | **Deutsch**

**Erstellt**: 2026-06-08  
**Status**: Formale Spezifikation  
**Zielgruppe**: Entwickler, Dateningenieure, Partner

---

## Überblick

Formale Spezifikation der Metadaten-Datei (`.metadata.json`), die Berechtigungsinformationen an Dokumente auf FSx for ONTAP anhängt. Arbeitet mit Bedrock Knowledge Base Metadata-Filterung zusammen, um Permission-Aware RAG zu ermöglichen.

---

## Dateinamenskonvention

```
Zieldokument:    {path}/{filename}.{ext}
Metadaten-Datei: {path}/{filename}.{ext}.metadata.json
```

**Beispiel:**
```
reports/esg/2026-06-06/report-abc.json
reports/esg/2026-06-06/report-abc.json.metadata.json  ← Metadaten
```

---

## Schema-Definition

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

### Feldliste

| Feld | Typ | Erforderlich | Beschreibung |
|------|-----|-------------|--------------|
| `metadataAttributes` | Object | ✅ | Container für Metadaten-Attribute |
| `metadataAttributes.allowed_group_sids` | `string[]` (formal) oder `string` (abwärtskompatibel) | ✅ | Liste der zugelassenen SIDs |
| `metadataAttributes.category` | `string` | ❌ | Dokumentkategorie |
| `metadataAttributes.owner` | `string` | ❌ | Eigentümer (Team/Abteilung) |
| `metadataAttributes.classification` | `string` enum | ❌ | Vertraulichkeitsstufe |

### `allowed_group_sids` Formate

| Format | Beispiel | Status |
|--------|----------|--------|
| **Array (formal)** | `["S-1-1-0", "S-1-5-21-xxx-512"]` | ✅ Empfohlen |
| Kommagetrennt | `"S-1-1-0,S-1-5-21-xxx-512"` | ⚠️ Abwärtskompatibel (veraltet) |
| JSON-String | `"[\"S-1-1-0\"]"` | ⚠️ Abwärtskompatibel (veraltet) |
| Einzelwert | `"S-1-1-0"` | ⚠️ Abwärtskompatibel |

> **Wichtig**: Verwenden Sie bei der Neuerstellung immer das **Array-Format**.

### `classification` Gültige Werte

| Wert | Beschreibung |
|------|--------------|
| `public` | Öffentliche Information (für alle Benutzer zugänglich) |
| `internal` | Nur für internen Gebrauch |
| `confidential` | Vertraulich (nur bestimmte Gruppen) |
| `restricted` | Streng geheim (individuelle Genehmigung erforderlich) |

---

## SID-Format

Standard Windows Security Identifier (SID) Format:

```
S-{revision}-{authority}-{sub1}-{sub2}-...-{RID}
```

| SID | Bedeutung |
|-----|-----------|
| `S-1-1-0` | Everyone (Alle) |
| `S-1-5-21-xxx-512` | Domain Admins |
| `S-1-5-21-xxx-513` | Domain Users |
| `S-1-5-32-544` | Administrators (Builtin) |

---

## Fail-Closed-Prinzip

| Zustand | Verhalten |
|---------|-----------|
| `.metadata.json` existiert nicht | **Zugriff verweigert** (Fail-Closed) |
| `allowed_group_sids` ist leeres Array | **Zugriff verweigert** |
| `allowed_group_sids` enthält keine Übereinstimmung mit Benutzer-SIDs | **Zugriff verweigert** |
| `allowed_group_sids` enthält eine Übereinstimmung mit Benutzer-SIDs | **Zugriff gewährt** |

---

## Validierungsregeln

1. `metadataAttributes` ist erforderlich
2. `allowed_group_sids` ist erforderlich und darf nicht leer sein
3. Jede SID muss mit `S-` im gültigen Format beginnen (nur Warnung, nicht blockierend)
4. Kommagetrennte Formate geben eine Warnung aus und empfehlen die Migration zum Array-Format

---

## Erstellungstool

```bash
# Metadaten im formalen Format per Skript erstellen
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

## Verwandte Dokumente

- [Permission Matrix Tests](../../tests/permission-matrix/) — 31 Szenarien zur Berechtigungsüberprüfung
- [KB Auto-Sync Fehlerbehandlung](../kb-auto-sync-error-handling.md) — Aufnahme von Dokumenten mit Metadaten
- [Produktionsbereitschafts-Checkliste](../production-readiness-checklist.md) — Betriebliche Anforderungen für Metadaten-Management
