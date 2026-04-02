# CDK Stack-Architekturleitfaden

**🌐 Language:** [日本語](../stack-architecture-comparison.md) | [English](../en/stack-architecture-comparison.md) | [한국어](../ko/stack-architecture-comparison.md) | [简体中文](../zh-CN/stack-architecture-comparison.md) | [繁體中文](../zh-TW/stack-architecture-comparison.md) | [Français](../fr/stack-architecture-comparison.md) | **Deutsch** | [Español](../es/stack-architecture-comparison.md)

**Letzte Aktualisierung**: 2026-03-31  
**Status**: Konsolidiert auf Demo-Stack-Linie, S3 Vectors-Integration verifiziert

---

## Überblick

Alle CDK-Stacks sind unter `lib/stacks/demo/` konsolidiert. Der einzige Einstiegspunkt ist `bin/demo-app.ts`. Optionale Funktionen können über CDK-Kontextparameter aktiviert werden.

---

## Funktionsvergleich

| Funktion | Demo Stack (Aktuell) | CDK-Kontext | Hinweise |
|----------|---------------------|-------------|----------|
| Authentifizierung | Cognito + AD (optional) | `adPassword`, `adDomainName` | Nur Cognito, wenn AD nicht konfiguriert ist |
| Automatischer SID-Abruf | AD Sync Lambda | `adType=managed\|self-managed` | Manuell (`setup-user-access.sh`), wenn AD nicht konfiguriert ist |
| NTFS ACL-Abruf | Automatisch generiert im Embedding-Server | `ontapMgmtIp`, `ontapSvmUuid` | Manuelle `.metadata.json`, wenn nicht konfiguriert |
| Berechtigungsfilterung | Innerhalb der Next.js API Route (Standard) | `usePermissionFilterLambda=true` | Kann auch auf eine dedizierte Lambda migriert werden |
| Bedrock Agent | Dynamische Agent-Erstellung + Action Group | `enableAgent=true` | Erstellt automatisch kategoriespezifischen Agent bei Kartenklick |
| Bedrock Guardrails | Inhaltssicherheit + PII-Schutz | `enableGuardrails=true` | |
| KMS-Verschlüsselung | S3 / DynamoDB CMK-Verschlüsselung | `enableKmsEncryption=true` | Schlüsselrotation aktiviert |
| CloudTrail | S3-Datenzugriff + Lambda-Audit | `enableCloudTrail=true` | 90 Tage Aufbewahrung |
| VPC Endpoints | S3, DynamoDB, Bedrock usw. | `enableVpcEndpoints=true` | Unterstützt 6 Dienste |
| Embedding-Server | FlexCache CIFS-Mount + direktes Schreiben in den Vektorspeicher | `enableEmbeddingServer=true` | Fallback-Pfad, wenn S3 AP nicht verfügbar ist (nur AOSS-Konfiguration) |
| Erweiterte Berechtigungskontrolle | Zeitbasierte Zugriffskontrolle + Berechtigungsentscheidungs-Auditprotokoll | `enableAdvancedPermissions=true` | DynamoDB-Tabelle `permission-audit` + GSI |

---

## Datenaufnahmepfade

| Pfad | Methode | Aktivierung | Anwendungsfall |
|------|---------|-------------|----------------|
| Haupt | FSx ONTAP → S3 Access Point → Bedrock KB | `post-deploy-setup.sh` | Standard-Volumes |
| Fallback | Direkter S3-Bucket-Upload → Bedrock KB | `upload-demo-data.sh` | Wenn S3 AP nicht verfügbar ist |
| Alternativ | CIFS-Mount → Embedding-Server → Direktes Schreiben in den Vektorspeicher | `enableEmbeddingServer=true` | FlexCache-Volumes (nur AOSS-Konfiguration) |

---

## Bedrock KB Ingestion Job — Kontingente und Designüberlegungen

Bedrock KB Ingestion Job ist ein verwalteter Dienst, der Dokumentenabruf, Chunking, Vektorisierung und Speicherung übernimmt. Er liest Daten direkt von FSx ONTAP über S3 Access Point und verarbeitet nur geänderte Dateien durch inkrementelle Synchronisierung. Keine benutzerdefinierte Embedding-Pipeline (wie AWS Batch) ist erforderlich.

### Service-Kontingente (Stand März 2026, alle nicht anpassbar)

| Kontingent | Wert | Design-Auswirkung |
|-----------|------|-------------------|
| Datengröße pro Job | 100GB | Überschüssige Daten werden nicht verarbeitet. Datenquellen über 100GB müssen auf mehrere Datenquellen aufgeteilt werden |
| Dateigröße pro Datei | 50MB | Große PDFs müssen aufgeteilt werden |
| Hinzugefügte/aktualisierte Dateien pro Job | 5.000.000 | Ausreichend für typische Unternehmensdokumentenvolumen |
| Gelöschte Dateien pro Job | 5.000.000 | Wie oben |
| Dateien bei Verwendung des BDA-Parsers | 1.000 | Limit bei Verwendung des Bedrock Data Automation-Parsers |
| Dateien bei Verwendung des FM-Parsers | 1.000 | Limit bei Verwendung des Foundation Model-Parsers |
| Datenquellen pro KB | 5 | Obergrenze bei Registrierung mehrerer Volumes als einzelne Datenquellen |
| KBs pro Konto | 100 | Überlegung für Multi-Tenant-Design |
| Gleichzeitige Jobs pro Konto | 5 | Einschränkung für parallele Synchronisierung über mehrere KBs |
| Gleichzeitige Jobs pro KB | 1 | Parallele Synchronisierung zur gleichen KB nicht möglich. Muss auf Abschluss des vorherigen Jobs warten |
| Gleichzeitige Jobs pro Datenquelle | 1 | Wie oben |

### Ausführungsauslöser und Häufigkeitsbeschränkungen

| Element | Wert | Hinweise |
|---------|------|----------|
| StartIngestionJob API-Rate | 0,1 Req/Sek (einmal alle 10 Sekunden) | **Nicht anpassbar**. Nicht geeignet für hochfrequente automatische Synchronisierung |
| Ausführungsauslöser | Manuell (API/CLI/Konsole) | Keine automatische Planungsfunktion auf Bedrock KB-Seite |
| Sync-Methode | Inkrementelle Synchronisierung | Verarbeitet nur Hinzufügungen, Änderungen und Löschungen. Vollständige Neuverarbeitung nicht erforderlich |
| Sync-Dauer | Abhängig vom Datenvolumen (Sekunden bis Stunden) | Kleiner Maßstab (Dutzende Dateien): 30 Sek.–2 Min., Großer Maßstab: Stunden |

### Planung automatischer Synchronisierung

Da Bedrock KB keine integrierte geplante Synchronisierungsfunktion hat, implementieren Sie bei Bedarf periodische Synchronisierung mit den folgenden Methoden:

```bash
# Periodic execution with EventBridge Scheduler (e.g., every hour)
aws scheduler create-schedule \
  --name kb-sync-hourly \
  --schedule-expression "rate(1 hour)" \
  --target '{"Arn":"arn:aws:bedrock:ap-northeast-1:ACCOUNT_ID:knowledge-base/KB_ID","RoleArn":"arn:aws:iam::ACCOUNT_ID:role/scheduler-role","Input":"{\"dataSourceId\":\"DS_ID\"}"}' \
  --flexible-time-window '{"Mode":"OFF"}'
```

Alternativ können Sie Dateiänderungen auf FSx ONTAP über S3-Ereignisbenachrichtigungen erkennen und einen Ingestion Job auslösen. Beachten Sie jedoch das StartIngestionJob API Rate-Limit (einmal alle 10 Sekunden).

### Designempfehlungen

1. **Sync-Häufigkeit**: Echtzeit-Synchronisierung ist nicht möglich. Mindestintervall beträgt 10 Sekunden; praktisch werden 15 Minuten bis 1 Stunde empfohlen
2. **Große Datenmengen**: Datenquellen über 100GB sollten auf mehrere FSx ONTAP-Volumes aufgeteilt werden (= mehrere S3 APs = mehrere Datenquellen)
3. **Parallele Verarbeitung**: Parallele Synchronisierung zur gleichen KB nicht möglich. Mehrere Datenquellen sequentiell synchronisieren
4. **Fehlerbehandlung**: Retry-Logik für Job-Fehler implementieren (Status mit `GetIngestionJob` überwachen)
5. **Keine benutzerdefinierte Embedding-Pipeline erforderlich**: Da Bedrock KB Chunking, Vektorisierung und Speicherung verwaltet, sind benutzerdefinierte Pipelines wie AWS Batch unnötig

---

## CDK Stack-Struktur (7 Stacks)

| # | Stack | Erforderlich/Optional | Beschreibung |
|---|-------|----------------------|-------------|
| 1 | WafStack | Erforderlich | WAF für CloudFront (us-east-1) |
| 2 | NetworkingStack | Erforderlich | VPC, Subnetze, SG |
| 3 | SecurityStack | Erforderlich | Cognito User Pool |
| 4 | StorageStack | Erforderlich | FSx ONTAP + SVM + Volume (oder bestehende Referenz), S3, DynamoDB×2 |
| 5 | AIStack | Erforderlich | Bedrock KB, S3 Vectors oder OpenSearch Serverless, Agent (optional) |
| 6 | WebAppStack | Erforderlich | Lambda Web Adapter + CloudFront |
| 7 | EmbeddingStack | Optional | FlexCache CIFS-Mount + Embedding-Server |

### Referenzmodus für bestehende FSx for ONTAP

StorageStack kann bestehende FSx ONTAP-Ressourcen über die Parameter `existingFileSystemId`/`existingSvmId`/`existingVolumeId` referenzieren. In diesem Fall:
- Überspringt die Erstellung neuer FSx/SVM/Volume (reduziert die Deployment-Zeit um 30-40 Minuten)
- Überspringt auch die Managed AD-Erstellung (verwendet die AD-Konfiguration der bestehenden Umgebung)
- S3-Buckets, DynamoDB-Tabellen und S3 AP Custom Resources werden wie gewohnt erstellt
- `cdk destroy` löscht FSx/SVM/Volume nicht (außerhalb der CDK-Verwaltung)

---

## Vergleich der Vektorspeicher-Konfigurationen

Die Vektorspeicher-Konfiguration kann über den CDK-Kontextparameter `vectorStoreType` umgeschaltet werden. Die dritte Konfiguration (S3 Vectors + AOSS-Export) wird als Betriebsverfahren für On-Demand-Export auf Basis der S3 Vectors-Konfiguration bereitgestellt.

> **Regionsunterstützung**: S3 Vectors ist in `ap-northeast-1` (Tokio-Region) verfügbar.

| Element | OpenSearch Serverless | S3 Vectors Standalone | S3 Vectors + AOSS-Export |
|---------|----------------------|----------------------|--------------------------|
| **CDK-Parameter** | `vectorStoreType=opensearch-serverless` | `vectorStoreType=s3vectors` (Standard) | `export-to-opensearch.sh` auf Konfiguration 2 ausführen |
| **Kosten** | ~700$/Monat (2 OCUs immer aktiv) | Wenige Dollar/Monat (kleiner Maßstab) | S3 Vectors + AOSS OCU (nur während des Exports) |
| **Latenz** | ~10ms | Sub-Sekunde (kalt), ~100ms (warm) | ~10ms (AOSS-Suche nach Export) |
| **Filterung** | Metadatenfilter (`$eq`, `$ne`, `$in` usw.) | Metadatenfilter (`$eq`, `$in`, `$and`, `$or`) | AOSS-Filterung nach Export |
| **Metadaten-Einschränkungen** | Keine Einschränkungen | filterable 2KB/Vektor (effektiv 1KB für benutzerdefiniert), non-filterable Schlüssel max 10 | Folgt AOSS-Einschränkungen nach Export |
| **Anwendungsfall** | Produktionsumgebungen mit hohen Leistungsanforderungen | Kostenoptimierung, Demo, Entwicklungsumgebungen | Temporärer Hochleistungsbedarf |
| **Betriebsverfahren** | Nur CDK deploy | Nur CDK deploy | `export-to-opensearch.sh` nach CDK deploy ausführen. Export-IAM-Rolle wird automatisch erstellt |

> **S3 Vectors Metadaten-Einschränkung**: Bei Verwendung von Bedrock KB + S3 Vectors sind benutzerdefinierte Metadaten effektiv auf 1KB oder weniger begrenzt (Bedrock KB-interne Metadaten verbrauchen ~1KB des 2KB filterbaren Metadatenlimits). Der CDK-Code setzt alle Metadaten auf non-filterable, um das 2KB-Limit zu umgehen. Die SID-Filterung wird auf der Anwendungsseite durchgeführt, sodass der S3 Vectors QueryVectors-Filter nicht benötigt wird. Siehe [docs/s3-vectors-sid-architecture-guide.md](s3-vectors-sid-architecture-guide.md) für Details.

### Hinweise zum Export

- Export ist eine **Momentaufnahme**. Nach Aktualisierungen der S3 Vectors-Daten ist ein erneuter Export erforderlich (keine kontinuierliche Synchronisierung)
- Während des Exports werden automatisch eine AOSS-Collection, OSI-Pipeline, IAM-Servicerolle und DLQ S3-Bucket erstellt
- Die Konsolenoption "Create and use a new service role" erstellt automatisch die IAM-Rolle, sodass keine vorherige Rollenerstellung erforderlich ist
- Der Export dauert ca. 15 Minuten (AOSS-Collection-Erstellung 5 Min. + Pipeline-Erstellung 5 Min. + Datentransfer 5 Min.)
- Die OSI-Pipeline **stoppt automatisch** nach Abschluss des Datentransfers (kosteneffizient)
- Die AOSS-Collection bleibt nach dem Pipeline-Stopp durchsuchbar
- **AOSS-Collections manuell löschen, wenn nicht mehr benötigt** (werden nicht durch `cdk destroy` gelöscht, da außerhalb der CDK-Verwaltung. OCU-Abrechnung läuft weiter)

---

## Erkenntnisse aus der S3 Vectors-Implementierung (Verifiziert)

Die folgenden Erkenntnisse stammen aus der tatsächlichen Deployment-Verifizierung in ap-northeast-1 (Tokio-Region) am 2026-03-29.

### SDK/API-bezogen

| Element | Erkenntnis |
|---------|-----------|
| SDK v3-Antwort | `CreateVectorBucketCommand`/`CreateIndexCommand`-Antworten enthalten kein `vectorBucketArn`/`indexArn`. Nur `$metadata` wird zurückgegeben. ARN muss nach dem Muster `arn:aws:s3vectors:{region}:{account}:bucket/{name}` konstruiert werden |
| API-Befehlsnamen | `CreateIndexCommand`/`DeleteIndexCommand` sind korrekt. `CreateVectorBucketIndexCommand` existiert nicht |
| CreateIndex erforderliche Parameter | `dataType: 'float32'` ist erforderlich. Auslassen verursacht einen Validierungsfehler |
| Metadaten-Design | Alle Metadatenschlüssel sind standardmäßig filterbar. `metadataConfiguration` gibt nur `nonFilterableMetadataKeys` an. Keine explizite Konfiguration erforderlich, um `allowed_group_sids` filterbar zu machen |

### Bedrock KB-bezogen

| Element | Erkenntnis |
|---------|-----------|
| S3VectorsConfiguration | `indexArn` und `indexName` schließen sich gegenseitig aus. Beide anzugeben verursacht einen `2 subschemas matched instead of one`-Fehler. Nur `indexArn` verwenden |
| IAM-Berechtigungsvalidierung | Bedrock KB validiert die `s3vectors:QueryVectors`-Berechtigung der KB-Rolle bei der Erstellung. Die IAM-Policy muss vor der KB-Erstellung angewendet werden |
| Erforderliche IAM-Aktionen | 5 Aktionen erforderlich: `s3vectors:QueryVectors`, `s3vectors:PutVectors`, `s3vectors:DeleteVectors`, `s3vectors:GetVectors`, `s3vectors:ListVectors` |

### CDK/CloudFormation-bezogen

| Element | Erkenntnis |
|---------|-----------|
| IAM-Policy-Ressourcen-ARN | Explizite ARN-Muster anstelle von Custom Resource `GetAtt`-Tokens verwenden. Dies vermeidet Abhängigkeitsprobleme |
| CloudFormation Hook | Organization-Level `AWS::EarlyValidation::ResourceExistenceCheck` Hook, der Change-Sets blockiert, kann mit `--method=direct` umgangen werden |
| Deployment-Zeit | AI-Stack (S3 Vectors-Konfiguration) Deployment-Zeit beträgt ca. 83 Sekunden (deutlich reduziert im Vergleich zu ~5 Minuten für AOSS-Konfiguration) |

---

---

## Zukünftige Erweiterungsoptionen

Die folgenden Funktionen sind derzeit nicht implementiert, aber so konzipiert, dass sie als optionale Funktionen über CDK-Kontextparameter hinzugefügt werden können.

| Funktion | Überblick | Erwarteter Parameter |
|----------|----------|---------------------|
| Monitoring & Alarme | CloudWatch-Dashboard (Stack-übergreifende Metriken), SNS-Alarme (Fehlerrate / Latenz-Schwellenwert überschritten) | `enableMonitoring=true` |
| Erweiterte Berechtigungskontrolle | Zeitbasierte Zugriffskontrolle (nur während der Geschäftszeiten erlauben), geografische Zugriffsbeschränkung (IP-Geolokalisierung), DynamoDB-Audit-Log | `enableAdvancedPermissions=true` |

---

## Verwandte Dokumente

| Dokument | Inhalt |
|----------|--------|
| [README.md](../../README.de.md) | Deployment-Verfahren und CDK-Kontextparameterliste |
| [SID-Filtering-Architecture.md](SID-Filtering-Architecture.md) | SID-Filterung-Design und Details zu Datenaufnahmepfaden |
| [embedding-server-design.md](embedding-server-design.md) | Embedding-Server-Design (einschließlich ONTAP ACL-Auto-Abruf) |
| [ui-specification.md](ui-specification.md) | UI-Spezifikation (Karten-UI, KB/Agent-Modusumschaltung) |
