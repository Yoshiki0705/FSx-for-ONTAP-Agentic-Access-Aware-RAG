# Embedding-Server — Design- und Implementierungsdokument

**🌐 Language:** [日本語](../embedding-server-design.md) | [English](../en/embedding-server-design.md) | [한국어](../ko/embedding-server-design.md) | [简体中文](../zh-CN/embedding-server-design.md) | [繁體中文](../zh-TW/embedding-server-design.md) | [Français](../fr/embedding-server-design.md) | **Deutsch** | [Español](../es/embedding-server-design.md)

**Erstellt**: 2026-03-26  
**Zielgruppe**: Entwickler & Betreiber  
**Quellcode**: `docker/embed/`

---

## Überblick

Dieser Server liest Dokumente auf FSx ONTAP über CIFS/SMB-Mount, vektorisiert sie mit Amazon Bedrock Titan Embed Text v2 und indexiert sie in OpenSearch Serverless (AOSS).

### Vector Store & Embedding Server

| Configuration | Embedding Server | Description |
|--------------|-----------------|-------------|
| **S3 Vectors** (default) | **Not needed** | Bedrock KB auto-manages via S3 Access Point |
| **OpenSearch Serverless** | **Optional** | Alternative when S3 AP unavailable |

> **S3 Vectors (default): this document is for reference only.** Bedrock KB Ingestion Job handles all processing automatically.

Er wird als alternativer Pfad (Option B) verwendet, wenn die Bedrock KB S3-Datenquelle (Option A) oder der S3 Access Point (Option C) nicht genutzt werden können.

---

## Architektur

```
FSx ONTAP Volume (/data)
  │ CIFS/SMB Mount
  ▼
EC2 (m5.large) /tmp/data
  │
  ▼
Docker Container (embed-app)
  ├── 1. Dateiscan (rekursiv, .md/.txt/.html usw.)
  ├── 2. SID-Informationen aus .metadata.json lesen
  ├── 3. Text-Chunk-Aufteilung (1000 Zeichen, 200 Zeichen Überlappung)
  ├── 4. Vektorisierung mit Bedrock Titan Embed v2 (1024 Dimensionen)
  └── 5. Indexierung in AOSS (Bedrock KB-kompatibles Format)
          │
          ▼
      OpenSearch Serverless
      (bedrock-knowledge-base-default-index)
```

---

## Quellcode-Struktur

```
docker/embed/
├── src/
│   ├── index.ts       # Hauptverarbeitung (Scan → Chunk → Embedding → Index)
│   └── oss-client.ts  # AOSS SigV4-Signatur-Client (IMDS-Auth-Unterstützung)
├── Dockerfile         # node:22-slim + cifs-utils
├── buildspec.yml      # CodeBuild-Build-Definition
├── package.json       # AWS SDK v3, chokidar, dotenv
└── tsconfig.json
```

---

## Ausführungsmodi

| Modus | Umgebungsvariable | Verhalten |
|-------|-------------------|-----------|
| Batch-Modus | `ENV_WATCH_MODE=false` (Standard) | Verarbeitet alle Dateien einmal und beendet sich |
| Watch-Modus | `ENV_WATCH_MODE=true` | Erkennt Dateiänderungen mit chokidar und verarbeitet automatisch |

---

## Umgebungsvariablen

| Variable | Standard | Beschreibung |
|----------|----------|-------------|
| `ENV_REGION` | `ap-northeast-1` | AWS-Region |
| `ENV_DATA_DIR` | `/opt/netapp/ai/data` | CIFS-gemountetes Datenverzeichnis |
| `ENV_DB_DIR` | `/opt/netapp/ai/db` | Speicherort für verarbeitete Dateiaufzeichnungen |
| `ENV_EMBEDDING_MODEL_ID` | `amazon.titan-embed-text-v2:0` | Embedding-Modell |
| `ENV_INDEX_NAME` | `bedrock-knowledge-base-default-index` | AOSS-Indexname |
| `ENV_OPEN_SEARCH_SERVERLESS_COLLECTION_NAME` | (erforderlich) | AOSS-Collection-Name |
| `ENV_WATCH_MODE` | `false` | Watch-Modus aktivieren |
| `ENV_AUTO_METADATA` | `false` | Automatische Generierung von .metadata.json über ONTAP REST API |
| `ENV_ONTAP_MGMT_IP` | (leer) | ONTAP-Management-Endpunkt-IP |
| `ENV_ONTAP_SVM_UUID` | (leer) | SVM UUID |
| `ENV_ONTAP_USERNAME` | `fsxadmin` | ONTAP-Administrator-Benutzername |
| `ENV_ONTAP_PASSWORD` | (leer) | ONTAP-Administrator-Passwort |

---

## Verarbeitungsablauf

### Batch-Modus

```
1. AOSS-Client initialisieren (Collection-Endpunkt abrufen)
2. processed.json laden (für differentielle Verarbeitung)
3. DATA_DIR rekursiv scannen (.md, .txt, .html, .csv, .json, .xml)
4. Für jede Datei:
   a. Überspringen, wenn mtime mit processed.json übereinstimmt
   b. .metadata.json verwenden, falls vorhanden
   c. Falls .metadata.json nicht existiert und ENV_AUTO_METADATA=true:
      - ACL über ONTAP REST API abrufen (`GET /api/protocols/file-security/permissions/{SVM_UUID}/{PATH}`)
      - SID aus ACL extrahieren und .metadata.json automatisch generieren/schreiben
   d. Text lesen → in Chunks aufteilen (1000 Zeichen, 200 Zeichen Überlappung)
   e. Jeden Chunk mit Bedrock Titan Embed v2 vektorisieren
   f. In AOSS indexieren (Bedrock KB-kompatibles Format)
   g. processed.json aktualisieren
5. Verarbeitungszusammenfassung ausgeben und beenden
```

### Watch-Modus

```
1-5. Wie Batch-Modus (initialer Scan)
6. Dateiüberwachung mit chokidar starten
   - awaitWriteFinish: 2 Sekunden (auf Schreibabschluss warten)
7. Datei-Hinzufüge-/Änderungsereignisse → zur Warteschlange hinzufügen
8. Sequentiell aus der Warteschlange verarbeiten (parallele Ausführung verhindern)
   - processFile() → processed.json aktualisieren
9. In Endlosschleife warten
```

---

## Mechanismus der differentiellen Verarbeitung

Dateipfade und Änderungszeiten (mtime) werden in `processed.json` aufgezeichnet.

```json
{
  "public/company-overview.md": {
    "mtime": "2026-03-24T23:55:50.000Z",
    "indexedAt": "2026-03-25T05:30:00.000Z"
  }
}
```

- Überspringen, wenn sich die mtime der Datei nicht geändert hat
- Erneut verarbeiten, wenn die Datei aktualisiert wurde (Index überschreiben)
- `processed.json` löschen, um alle Dateien erneut zu verarbeiten

### Unterschiede zu früheren Versionen

| Element | Frühere Version | Aktuelle Version |
|---------|----------------|-----------------|
| Differentielle Verwaltung | SQLite (drizzle-orm + better-sqlite3) | JSON-Datei (processed.json) |
| Dateiidentifikation | Inode-Nummer (files.ino) | Dateipfad + mtime |
| Gleichzeitiger Massen-Upload | UNIQUE constraint failed | ✅ Sicher verarbeitet über sequentielle Warteschlange |
| Abhängigkeiten | drizzle-orm, better-sqlite3 | Keine (Standard-fs) |

---

## AOSS-Indexformat

Es werden nur 3 Bedrock KB-kompatible Felder geschrieben.

```json
{
  "bedrock-knowledge-base-default-vector": [0.123, -0.456, ...],  // 1024 Dimensionen
  "AMAZON_BEDROCK_TEXT_CHUNK": "Dokument-Text-Chunk",
  "AMAZON_BEDROCK_METADATA": "{\"source\":\"public/company-overview.md\",\"allowed_group_sids\":[\"S-1-1-0\"],\"access_level\":\"public\"}"
}
```

### Wichtig: AOSS-Index-Schema-Kompatibilität

Der AOSS-Index wird mit `dynamic: false` erstellt. Das bedeutet:
- Das Index-Mapping ändert sich nicht, auch wenn andere als die oben genannten 3 Felder geschrieben werden
- Bedrock KB-Sync verursacht keine "storage configuration invalid"-Fehler
- Metadaten (SID-Informationen usw.) werden als JSON-String im Feld `AMAZON_BEDROCK_METADATA` gespeichert

### Metadaten-Struktur

Jedes Dokument benötigt eine entsprechende `.metadata.json`-Datei. Durch die Aufnahme von NTFS ACL SID-Informationen in diese Datei wird die Zugriffskontrolle bei der RAG-Suche erreicht.

#### Wie man SID-Informationen für `.metadata.json` erhält

Dieses System verfügt über einen Mechanismus zur automatischen Abfrage von SIDs aus NTFS ACLs.

| Komponente | Implementierungsdatei | Funktion |
|------------|----------------------|----------|
| AD Sync Lambda | `lambda/agent-core-ad-sync/index.ts` | Führt PowerShell über SSM aus, um AD-Benutzer-SID-Informationen abzurufen und in DynamoDB zu speichern |
| FSx Permission Service | `lambda/permissions/fsx-permission-service.ts` | Führt Get-Acl über SSM aus, um NTFS ACL (SID) für Dateien/Verzeichnisse abzurufen |
| AD Sync-Konfiguration | `types/agentcore-config.ts` (`AdSyncConfig`) | Einstellungen für AD-Sync-Aktivierung, Cache-TTL, SSM-Timeout usw. |

Dies sind zukünftige Erweiterungsoptionen. In der aktuellen Demo-Stack-Konfiguration (`lib/stacks/demo/`) werden zu Verifizierungszwecken manuell platzierte `.metadata.json`-Beispieldateien verwendet.

#### SID-Auto-Abruf-Verarbeitungsablauf

```
1. AD Sync Lambda (Benutzer-SID-Abruf)
   SSM → Windows EC2 → PowerShell (Get-ADUser) → SID abrufen → In DynamoDB user-access speichern

2. FSx Permission Service (Datei-ACL-Abruf)
   SSM → Windows EC2 → PowerShell (Get-Acl) → NTFS ACL abrufen → SID extrahieren → Kann .metadata.json generieren
```

#### Vereinfachte Einrichtung für Demo-Umgebung

Der Demo-Stack verwendet die oben genannte Automatisierung nicht und richtet SID-Daten durch die folgenden manuellen Schritte ein:

- `.metadata.json`: Manuell platzierte Beispiele unter `demo-data/documents/`
- DynamoDB user-access: E-Mail-zu-SID-Zuordnungen manuell registrieren mit `demo-data/scripts/setup-user-access.sh`

#### Automatisierungsoptionen für Produktionsumgebung

| Methode | Beschreibung |
|---------|-------------|
| AD Sync Lambda | Ruft automatisch AD-Benutzer-SIDs über SSM ab und speichert sie in DynamoDB (implementiert) |
| FSx Permission Service | Ruft NTFS ACL über Get-Acl durch SSM ab (implementiert) |
| ONTAP REST API | Ruft ACL direkt über den FSx ONTAP-Management-Endpunkt ab (implementiert: `ENV_AUTO_METADATA=true`) |
| S3 Access Point | NTFS ACL wird automatisch angewendet, wenn auf Dateien über S3 AP zugegriffen wird (CDK-unterstützt: `useS3AccessPoint=true`) |

#### Bei Verwendung von S3 Access Point (Option C)

Wenn Bedrock KB Dokumente über S3 Access Point aufnimmt, wird NTFS ACL automatisch über die `FileSystemIdentity` (WINDOWS-Typ) des S3 Access Points angewendet. Ob die von der Bedrock KB Retrieve API zurückgegebenen Metadaten ACL-Informationen enthalten, hängt jedoch von der S3 Access Point-Implementierung ab. Derzeit ist die SID-Verwaltung über `.metadata.json` die zuverlässige Methode.

#### `.metadata.json`-Format

```json
// .metadata.json
{
  "metadataAttributes": {
    "allowed_group_sids": ["S-1-5-21-...-512"],
    "access_level": "confidential",
    "department": "finance"
  }
}

// → In AMAZON_BEDROCK_METADATA gespeicherter Wert
{
  "source": "confidential/financial-report.md",
  "x-amz-bedrock-kb-source-uri": "s3://fsx-ontap/confidential/financial-report.md",
  "allowed_group_sids": ["S-1-5-21-...-512"],
  "access_level": "confidential",
  "department": "finance"
}
```

---

## AOSS-Authentifizierung (SigV4-Signatur)

`oss-client.ts` greift auf AOSS mittels AWS SigV4-Signatur zu.

- Ruft automatisch Anmeldeinformationen vom EC2-Instanzprofil (IMDS) ab
- Verwendet defaultProvider von `@aws-sdk/credential-provider-node`
- Anmeldeinformationen werden automatisch 5 Minuten vor Ablauf aktualisiert
- Der Dienstname für AOSS ist `aoss`

---

## Handhabung gleichzeitiger Massen-Datei-Uploads

Wenn im Watch-Modus 20 oder mehr Dateien gleichzeitig hochgeladen werden:

1. Mit chokidars `awaitWriteFinish` auf Schreibabschluss warten (2 Sekunden)
2. Jedes Dateiereignis wird zur Warteschlange hinzugefügt
3. Eine Datei nach der anderen aus der Warteschlange verarbeiten (exklusive Steuerung über `processing`-Flag)
4. 200ms Wartezeit nach dem Embedding jedes Chunks (Bedrock API Rate-Limit-Gegenmaßnahme)
5. `processed.json` nach Abschluss der Verarbeitung aktualisieren

Dies stellt sicher:
- Keine Bedrock API Rate-Limit-Verletzungen
- Keine gleichzeitigen Schreibvorgänge auf `processed.json`
- Wenn der Prozess während der Verarbeitung stoppt, werden bereits in `processed.json` aufgezeichnete Dateien nicht erneut verarbeitet

---

## CDK Stack

`DemoEmbeddingStack` (`lib/stacks/demo/demo-embedding-stack.ts`) erstellt Folgendes:

| Ressource | Beschreibung |
|-----------|-------------|
| EC2-Instanz (m5.large) | IMDSv2 erzwungen, SSM aktiviert |
| ECR Repository | Für Embedding-Container-Images |
| IAM-Rolle | SSM, FSx, AOSS, Bedrock, ECR, Secrets Manager |
| Security Group | Kommunikation mit FSx SG + AD SG erlaubt |
| UserData | Automatischer CIFS-Mount + Docker-Autostart |

### Aktivierung

```bash
npx cdk deploy <PREFIX>-Embedding \
  --app "npx ts-node bin/demo-app.ts" \
  -c enableEmbeddingServer=true \
  -c embeddingAdSecretArn=<SECRETS_MANAGER_ARN> \
  --require-approval never
```

---

## Fehlerbehebung

| Symptom | Ursache | Lösung |
|---------|---------|--------|
| AOSS 403 Forbidden | EC2-Rolle nicht zur Data-Access-Policy hinzugefügt | Embedding EC2-Rolle zur AOSS-Policy hinzufügen |
| Bedrock ThrottlingException | API Rate-Limit überschritten | Wartezeit zwischen Chunks erhöhen (200ms → 500ms) |
| CIFS-Mount-Fehler | SVM nicht in AD eingebunden oder CIFS-Share nicht erstellt | AD-Beitritt verifizieren + CIFS-Share über ONTAP REST API erstellen |
| processed.json beschädigt | Prozess unterbrochen | `processed.json` löschen und erneut ausführen |
| KB-Sync-Fehler (storage config invalid) | KB-inkompatible Felder im AOSS-Index vorhanden | Index löschen → neu erstellen → Datenquelle neu erstellen → Sync |
| Alle Dokumente durch SID-Filterung DENIED | Dokumente über Embedding-Server haben keine Metadaten | Überprüfen, ob `.metadata.json` existiert und `allowed_group_sids` gesetzt ist |

---

## Verwandte Dokumente

| Dokument | Inhalt |
|----------|--------|
| [README.md](../../README.de.md) | Deployment-Schritte (Option B) |
| [docs/implementation-overview.md](implementation-overview.md) | Implementierungsübersicht (Punkt 5: Embedding-Server) |
| [docs/ui-specification.md](ui-specification.md) | UI-Spezifikation (Verzeichnisanzeige) |
| [docs/demo-environment-guide.md](demo-environment-guide.md) | Betriebsverfahren für die Verifizierungsumgebung |
