# SID-basierte Berechtigungsfilterung — Architektur

**🌐 Language:** [日本語](../SID-Filtering-Architecture.md) | [English](../en/SID-Filtering-Architecture.md) | [한국어](../ko/SID-Filtering-Architecture.md) | [简体中文](../zh-CN/SID-Filtering-Architecture.md) | [繁體中文](../zh-TW/SID-Filtering-Architecture.md) | [Français](../fr/SID-Filtering-Architecture.md) | **Deutsch** | [Español](../es/SID-Filtering-Architecture.md)

## Überblick

Dieses System nutzt NTFS ACL SIDs (Security Identifiers), um RAG-Suchergebnisse benutzerspezifisch zu filtern. Zugriffsberechtigungsinformationen aus dem FSx for NetApp ONTAP-Dateisystem werden als Metadaten in der Vektordatenbank gespeichert, und Berechtigungsprüfungen werden während der Suche in Echtzeit durchgeführt.

---

## Gesamtarchitekturdiagramm

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Datenaufnahmefluss                               │
│                                                                         │
│  ┌──────────────┐    ┌─────────────────┐    ┌───────────────────────┐  │
│  │ FSx for ONTAP│    │ S3 Access Point │    │ Bedrock Knowledge Base│  │
│  │              │───▶│                 │───▶│                       │  │
│  │ NTFS ACL     │    │ Stellt FSx-     │    │ ・Vektorisiert mit    │  │
│  │ Datei-       │    │ Volumes über    │    │   Titan Embed v2      │  │
│  │ berechtigungen│   │ S3-kompatible   │    │ ・Metadaten (SID)     │  │
│  │ + .metadata  │    │ Schnittstelle   │    │   ebenfalls gespeichert│ │
│  │   .json      │    │ bereit          │    │                       │  │
│  └──────────────┘    └─────────────────┘    └───────────┬───────────┘  │
│                                                         │              │
│                                                         ▼              │
│                                          ┌──────────────────────────┐  │
│                                          │ Vektorspeicher           │  │
│                                          │ (Ausgewählt durch        │  │
│                                          │  vectorStoreType)        │  │
│                                          │ ・S3 Vectors (Standard)  │  │
│                                          │ ・OpenSearch Serverless   │  │
│                                          │                          │  │
│                                          │ Vektordaten +            │  │
│                                          │ Metadaten (SID usw.)     │  │
│                                          │ gespeichert              │  │
│                                          └──────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                        Such- und Filterungsfluss                        │
│                                                                         │
│  ┌──────────┐    ┌──────────────────┐    ┌──────────────────────────┐  │
│  │ Benutzer  │───▶│ Next.js          │───▶│ Bedrock KB               │  │
│  │ (Browser) │    │ KB Retrieve API  │    │ Retrieve API             │  │
│  └──────────┘    └────────┬─────────┘    └────────────┬─────────────┘  │
│                           │                           │                │
│                           │                           ▼                │
│                           │              ┌──────────────────────────┐  │
│                           │              │ Suchergebnisse            │  │
│                           │              │ ・Zitat (Quelldokument)   │  │
│                           │              │   └─ Metadaten            │  │
│                           │              │       └─ allowed_group_sids│ │
│                           │              └────────────┬─────────────┘  │
│                           │                           │                │
│                           ▼                           ▼                │
│              ┌──────────────────┐    ┌──────────────────────────────┐  │
│              │ DynamoDB         │    │ SID-Filterungsprozess        │  │
│              │ user-access      │───▶│                              │  │
│              │ ・userId          │    │ Benutzer-SID ∩ Dokument-SID │  │
│              │ ・userSID         │    │ = Übereinstimmung → Zugriff │  │
│              │ ・groupSIDs       │    │   erlaubt                   │  │
│              └──────────────────┘    │ ≠ Keine Übereinstimmung →   │  │
│                                      │   Zugriff verweigert        │  │
│                                      └──────────────┬───────────────┘  │
│                                                     │                │
│                                                     ▼                │
│                                      ┌──────────────────────────────┐  │
│                                      │ Converse API                 │  │
│                                      │ ・Antwort nur mit erlaubten  │  │
│                                      │   Dokumenten generieren      │  │
│                                      │ ・Gefilterte Zitate zurück-  │  │
│                                      │   geben                      │  │
│                                      └──────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

> **Über S3 Access Point**: Der S3 Access Point für FSx for ONTAP stellt Dateien auf FSx-Volumes direkt über eine S3-kompatible Schnittstelle bereit. Es ist nicht erforderlich, Dateien in einen separaten S3-Bucket zu kopieren. Bedrock KB referenziert den S3 AP-Alias als Datenquelle und nimmt Dokumente (einschließlich `.metadata.json`) direkt vom FSx-Volume auf.

---

## Detaillierte SID-Filterungslogik

### Schritt 1: Abrufen der Benutzer-SIDs

Wenn ein Benutzer eine Frage im Chat stellt, ruft die KB Retrieve API die SID-Informationen des Benutzers aus der DynamoDB `user-access`-Tabelle ab.

```
DynamoDB user-access Tabelle
┌──────────────────────────────────────────────────────────────┐
│ userId (PK)          │ userSID              │ groupSIDs      │
├──────────────────────┼──────────────────────┼────────────────┤
│ {Cognito sub}        │ S-1-5-21-...-500     │ [S-1-5-21-...-512, │
│ (admin@example.com)  │ (Administrator)      │  S-1-1-0]      │
├──────────────────────┼──────────────────────┼────────────────┤
│ {Cognito sub}        │ S-1-5-21-...-1001    │ [S-1-1-0]      │
│ (user@example.com)   │ (Regulärer Benutzer) │                │
└──────────────────────┴──────────────────────┴────────────────┘

→ Vollständige SID-Liste des Benutzers = [userSID] + groupSIDs
   admin: [S-1-5-21-...-500, S-1-5-21-...-512, S-1-1-0]
   user:  [S-1-5-21-...-1001, S-1-1-0]
```

### Schritt 2: Abrufen der Dokumentmetadaten

Jedes Zitat in den Bedrock KB-Suchergebnissen enthält Metadaten, die aus den `.metadata.json`-Dateien auf S3 aufgenommen wurden.

> **Wie `.metadata.json` erstellt wird**: Dieses System enthält automatischen NTFS ACL-Abruf, implementiert durch die AD Sync Lambda (`lambda/agent-core-ad-sync/`) und den FSx Permission Service (`lambda/permissions/fsx-permission-service.ts`). In der Demo-Umgebung werden zu Verifizierungszwecken manuell platzierte Beispieldaten verwendet. Details finden Sie im Abschnitt "Metadaten-Struktur" in [docs/embedding-server-design.md](embedding-server-design.md).

```
Dokumentmetadaten (.metadata.json)
┌──────────────────────────┬──────────────────────────────────────┐
│ Dokument                 │ allowed_group_sids                   │
├──────────────────────────┼──────────────────────────────────────┤
│ public/product-catalog   │ ["S-1-1-0"]                          │
│                          │  └─ Everyone (alle Benutzer)         │
├──────────────────────────┼──────────────────────────────────────┤
│ public/company-overview  │ ["S-1-1-0"]                          │
│                          │  └─ Everyone (alle Benutzer)         │
├──────────────────────────┼──────────────────────────────────────┤
│ confidential/financial   │ ["S-1-5-21-...-512"]                 │
│                          │  └─ Nur Domain Admins                │
├──────────────────────────┼──────────────────────────────────────┤
│ confidential/hr-policy   │ ["S-1-5-21-...-512"]                 │
│                          │  └─ Nur Domain Admins                │
├──────────────────────────┼──────────────────────────────────────┤
│ restricted/project-plan  │ ["S-1-5-21-...-1100",                │
│                          │  "S-1-5-21-...-512"]                 │
│                          │  └─ Engineering + Domain Admins      │
└──────────────────────────┴──────────────────────────────────────┘
```

### Schritt 3: SID-Abgleich

Die SID-Liste des Benutzers wird mit den `allowed_group_sids` des Dokuments verglichen.

```
Abgleichsregel: Benutzer-SID ∩ Dokument-SID ≠ ∅ → ALLOW

■ Admin-Benutzer (admin@example.com)
  Benutzer-SIDs: [S-1-5-21-...-500, S-1-5-21-...-512, S-1-1-0]

  public/product-catalog    → S-1-1-0 ∈ Benutzer-SIDs → ✅ ALLOW
  public/company-overview   → S-1-1-0 ∈ Benutzer-SIDs → ✅ ALLOW
  confidential/financial    → S-1-5-21-...-512 ∈ Benutzer-SIDs → ✅ ALLOW
  confidential/hr-policy    → S-1-5-21-...-512 ∈ Benutzer-SIDs → ✅ ALLOW
  restricted/project-plan   → S-1-5-21-...-512 ∈ Benutzer-SIDs → ✅ ALLOW

■ Regulärer Benutzer (user@example.com)
  Benutzer-SIDs: [S-1-5-21-...-1001, S-1-1-0]

  public/product-catalog    → S-1-1-0 ∈ Benutzer-SIDs → ✅ ALLOW
  public/company-overview   → S-1-1-0 ∈ Benutzer-SIDs → ✅ ALLOW
  confidential/financial    → S-1-5-21-...-512 ∉ Benutzer-SIDs → ❌ DENY
  confidential/hr-policy    → S-1-5-21-...-512 ∉ Benutzer-SIDs → ❌ DENY
  restricted/project-plan   → {-1100, -512} ∩ {-1001, S-1-1-0} = ∅ → ❌ DENY
```

### Schritt 4: Fail-Safe-Fallback

Wenn SID-Informationen nicht abgerufen werden können (kein Eintrag in DynamoDB, Verbindungsfehler usw.), fällt das System auf die sichere Seite zurück und verweigert den Zugriff auf alle Dokumente.

```
Ablauf bei fehlgeschlagenem SID-Abruf:
  DynamoDB → Fehler oder kein Eintrag
    → allUserSIDs = [] (leer)
    → Alle Dokumente DENY
    → filterMethod: "DENY_ALL_FALLBACK"
```

---

## Über SID (Security Identifier)

### SID-Struktur

```
S-1-5-21-{DomainID1}-{DomainID2}-{DomainID3}-{RID}
│ │ │  │  └─────────────────────────────────────────┘  └─┘
│ │ │  │              Domain-Identifikator             Relative ID
│ │ │  └─ Anzahl der Sub-Autoritäten
│ │ └─ Identifier Authority (5 = NT Authority)
│ └─ Revision
└─ SID-Präfix
```

### Wichtige SIDs

| SID | Name | Beschreibung |
|-----|------|-------------|
| `S-1-1-0` | Everyone | Alle Benutzer |
| `S-1-5-21-...-500` | Administrator | Domänenadministrator |
| `S-1-5-21-...-512` | Domain Admins | Domänenadministratorengruppe |
| `S-1-5-21-...-1001` | User | Regulärer Benutzer |
| `S-1-5-21-...-1100` | Engineering | Engineering-Gruppe |

### SID in FSx for ONTAP

FSx for ONTAP unterstützt Windows ACLs auf NTFS Security Style-Volumes. Jede Datei/jedes Verzeichnis hat eine konfigurierte ACL (Access Control List), und Zugriffsberechtigungen werden auf SID-Basis verwaltet.

Beim Zugriff auf Dateien auf FSx über S3 Access Point werden NTFS ACL-Informationen als Metadaten bereitgestellt. Dieses System nimmt diese ACL-Informationen (SIDs) als Bedrock KB-Metadaten auf und verwendet sie zur Filterung während der Suche.

---

## Detaillierter Datenfluss

### 1. Während der Datenaufnahme (Embedding)

```
FSx for ONTAP                    S3 Access Point              Bedrock KB
┌─────────────┐                ┌──────────────┐             ┌──────────────┐
│ file.md     │  S3 Access     │ S3-kompatible│  KB Sync    │ Vektorisierung│
│ NTFS ACL:   │──Point──▶     │ Schnittstelle│────────▶   │ + Metadaten-  │
│  Admin:Full │                │              │             │ speicherung   │
│  Users:Read │                │ file.md      │             │              │
│             │                │ file.md      │             └──────┬───────┘
│ file.md     │                │ .metadata    │                    │
│ .metadata   │                │ .json        │                    ▼
│ .json       │                │ (Direkt von  │             ┌──────────────┐
│ {           │                │  FSx bereit- │             │ OpenSearch   │
│  "allowed_  │                │  gestellt)   │             │ Serverless   │
│   group_sids│                └──────────────┘             │ ・vector     │
│  :["S-1-.."]│                                             │ ・text_chunk │
│ }           │                                             │ ・metadata   │
└─────────────┘                                             │   (SID-Info) │
                                                            └──────────────┘
```

> S3 Access Point stellt FSx-Volume-Dateien direkt über eine S3-kompatible Schnittstelle bereit, sodass das Kopieren in einen S3-Bucket nicht erforderlich ist.

### Datenaufnahmepfad-Optionen

Dieses System bietet drei Datenaufnahmepfade. Da S3 Access Point für FlexCache Cache-Volumes ab März 2026 nicht verfügbar ist, ist eine Fallback-Konfiguration erforderlich.

| # | Pfad | Methode | CDK-Aktivierung | Anwendungsfall |
|---|------|---------|-----------------|----------------|
| 1 | Haupt | FSx ONTAP Volume → S3 Access Point → Bedrock KB | `post-deploy-setup.sh` | Standard-Volumes (S3 AP unterstützt) |
| 2 | Fallback | Manueller Upload in S3-Bucket → Bedrock KB | `upload-demo-data.sh` | FlexCache-Volumes und andere nicht von S3 AP unterstützte Fälle |
| 3 | Alternativ | CIFS-Mount → Embedding-Server → Direktes Schreiben in AOSS | `-c enableEmbeddingServer=true` | FlexCache-Volumes + Fälle, die direkte AOSS-Kontrolle erfordern |

Der S3-Bucket für Pfad 2 (`${prefix}-kb-data-${ACCOUNT_ID}`) wird immer von StorageStack erstellt. Wenn S3 AP nicht verfügbar ist, können Sie Dokumente + `.metadata.json` in diesen Bucket hochladen und ihn als KB-Datenquelle konfigurieren, um SID-Filterung zu ermöglichen.

### 2. Während der Suche (Zweistufige Methode: Retrieve + Converse)

```
Benutzer          Next.js API           DynamoDB          Bedrock KB       Converse API
  │                  │                    │                  │                │
  │ Frage stellen    │                    │                  │                │
  │─────────────────▶│                    │                  │                │
  │                  │ SIDs abrufen       │                  │                │
  │                  │───────────────────▶│                  │                │
  │                  │◀───────────────────│                  │                │
  │                  │ userSID + groupSIDs│                  │                │
  │                  │                    │                  │                │
  │                  │ Retrieve API (Vektorsuche + Metadaten)│                │
  │                  │─────────────────────────────────────▶│                │
  │                  │◀─────────────────────────────────────│                │
  │                  │ Suchergebnisse + Metadaten (SID)     │                │
  │                  │                    │                  │                │
  │                  │ SID-Abgleich       │                  │                │
  │                  │ (Benutzer-SID ∩    │                  │                │
  │                  │  Dokument-SID)     │                  │                │
  │                  │                    │                  │                │
  │                  │ Antwort nur mit erlaubten Dokumenten generieren        │
  │                  │──────────────────────────────────────────────────────▶│
  │                  │◀──────────────────────────────────────────────────────│
  │                  │                    │                  │                │
  │ Gefilterte       │                    │                  │                │
  │ Ergebnisse       │                    │                  │                │
  │◀─────────────────│                    │                  │                │
```

> Grund für die Verwendung der Retrieve API anstelle der RetrieveAndGenerate API: Die RetrieveAndGenerate API enthält `allowed_group_sids` aus `.metadata.json` nicht im `metadata`-Feld des Zitats, wodurch SID-Filterung unmöglich wird. Da die Retrieve API Metadaten korrekt zurückgibt, wird die zweistufige Methode (Retrieve → SID-Filter → Converse) verwendet.

### 3. Während der Agent-Modus-Suche (Hybridmethode)

Im Agent-Modus wird eine Hybridmethode verwendet, um berechtigungsbewusstes RAG zu erreichen. Da die InvokeAgent API keine SID-Filterung auf der Anwendungsseite ermöglicht, wird dies durch eine Kombination aus KB Retrieve API + SID-Filterung + Converse API (mit Agent-System-Prompt) realisiert.

```
Benutzer          Next.js API           Bedrock KB          DynamoDB         Converse API
  │                  │                    │                    │                │
  │ Frage stellen    │                    │                    │                │
  │─────────────────▶│                    │                    │                │
  │                  │ Retrieve API       │                    │                │
  │                  │───────────────────▶│                    │                │
  │                  │◀───────────────────│                    │                │
  │                  │ Ergebnisse + Meta  │                    │                │
  │                  │                    │                    │                │
  │                  │ SIDs abrufen                            │                │
  │                  │────────────────────────────────────────▶│                │
  │                  │◀────────────────────────────────────────│                │
  │                  │                    │                    │                │
  │                  │ SID-Filterung      │                    │                │
  │                  │ (Wie KB-Modus)     │                    │                │
  │                  │                    │                    │                │
  │                  │ Antwort mit erlaubten Docs + Agent-System-Prompt generieren│
  │                  │─────────────────────────────────────────────────────────▶│
  │                  │◀─────────────────────────────────────────────────────────│
  │                  │                    │                    │                │
  │ Agent-Antwort    │                    │                    │                │
  │ + Zitate         │                    │                    │                │
  │◀─────────────────│                    │                    │                │
```

> Die Bedrock Agent InvokeAgent API ist ebenfalls verfügbar, aber da die InvokeAgent API keine SID-Filterung auf der Anwendungsseite ermöglicht, wird sie nur als Fallback verwendet. Die Hybridmethode ist der Standard, um berechtigungsbewusstes Verhalten zu garantieren.

---

## API-Antwortbeispiel

### Filterungslog (filterLog)

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

## Sicherheitsdesign

### Fail-Safe-Fallback-Prinzip

Dieses System folgt dem "Fail-Closed"-Prinzip und verweigert den Zugriff auf alle Dokumente, wenn Berechtigungsprüfungen fehlschlagen.

| Situation | Verhalten |
|-----------|----------|
| DynamoDB-Verbindungsfehler | Alle Dokumente verweigern |
| Kein Benutzer-SID-Eintrag | Alle Dokumente verweigern |
| Keine SID-Informationen in Metadaten | Entsprechendes Dokument verweigern |
| Keine SID-Übereinstimmung | Entsprechendes Dokument verweigern |
| SID-Übereinstimmung gefunden | Entsprechendes Dokument erlauben |

### Berechtigungs-Cache

Filterungsergebnisse werden in der DynamoDB `permission-cache`-Tabelle zwischengespeichert, um wiederholte Prüfungen für die gleiche Benutzer-Dokument-Kombination zu beschleunigen (TTL: 5 Minuten).