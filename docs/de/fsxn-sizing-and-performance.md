# FSx for ONTAP Dimensionierung und Leistungsleitfaden

**🌐 Language:** [日本語](../fsxn-sizing-and-performance.md) | [English](../en/fsxn-sizing-and-performance.md) | [한국어](../ko/fsxn-sizing-and-performance.md) | [简体中文](../zh-CN/fsxn-sizing-and-performance.md) | [繁體中文](../zh-TW/fsxn-sizing-and-performance.md) | [Français](../fr/fsxn-sizing-and-performance.md) | **Deutsch** | [Español](../es/fsxn-sizing-and-performance.md)

**Erstellt**: 2026-05-21  
**Status**: Entwurf  
**Zielgruppe**: Infrastrukturarchitekten, Speicheradministratoren

---

## Überblick

Dieses Dokument bietet Dimensionierungs- und Leistungsdesign-Richtlinien für FSx for ONTAP im Permission-aware RAG-System. Es organisiert Konfigurationsempfehlungen basierend auf Dateianzahl, Dateigröße, Zugriffshäufigkeit und Resynchronisierungsfrequenz.

---

## Empfohlene Konfigurationen nach Skalierung

### Klein (~10.000 Dateien) — PoC / Abteilungsnutzung

| Element | Empfohlener Wert | Hinweise |
|---------|------------------|----------|
| FSx-Durchsatzkapazität | 128 MB/s | Minimalkonfiguration |
| SSD-Speicherkapazität | 1.024 GiB | Minimalkonfiguration |
| Capacity Pool Tiering | Aktiviert | Kostenoptimierung |
| Vektorspeicher | S3 Vectors | Geringe Kosten (wenige Dollar/Monat) |
| KB Auto-Sync-Intervall | 15 Min. | Standard |
| Initiale Indexierungszeit | 5–15 Min. | Abhängig von der Dokumentgröße |
| Monatliche Schätzung (nur FSx) | ~300–500 $ | Durchsatz + SSD |

### Mittel (10.000–100.000 Dateien) — Geschäftsbereich / Unternehmensweite Nutzung

| Element | Empfohlener Wert | Hinweise |
|---------|------------------|----------|
| FSx-Durchsatzkapazität | 256–512 MB/s | Basierend auf gleichzeitiger Zugriffsanzahl |
| SSD-Speicherkapazität | 2.048–10.240 GiB | Basierend auf Hot-Data-Volumen |
| Capacity Pool Tiering | Aktiviert | Kalte Daten automatisch tiern |
| Vektorspeicher | S3 Vectors oder OpenSearch Serverless | Auswahl basierend auf QPS-Anforderungen |
| KB Auto-Sync-Intervall | 5–15 Min. | Basierend auf Aktualisierungshäufigkeit |
| Initiale Indexierungszeit | 30–120 Min. | Kann mit Parallelverarbeitung verkürzt werden |
| Monatliche Schätzung (nur FSx) | ~1.000–5.000 $ | Durchsatz + SSD + Capacity Pool |

### Groß (100.000–1.000.000 Dateien) — Enterprise

| Element | Empfohlener Wert | Hinweise |
|---------|------------------|----------|
| FSx-Durchsatzkapazität | 1.024–4.096 MB/s | Multi-AZ + hoher Durchsatz |
| SSD-Speicherkapazität | 10.240+ GiB | Basierend auf Hot-Data-Volumen |
| Capacity Pool Tiering | Aktiviert | Die meisten Daten im Capacity Pool |
| Vektorspeicher | OpenSearch Serverless | Hohe QPS, niedrige Latenz |
| KB Auto-Sync-Intervall | Inkrementelles Sync-Design erforderlich | Vollständiger Scan ist unpraktisch |
| Initiale Indexierungszeit | Mehrere Stunden bis 1 Tag | Batch-Aufteilung empfohlen |
| Monatliche Schätzung (nur FSx) | ~5.000–30.000+ $ | Stark konfigurationsabhängig |

---

## FSx for ONTAP Leistungsmerkmale

### Durchsatzkapazität

Die FSx for ONTAP-Durchsatzkapazität wird auf Dateisystemebene konfiguriert.

| Durchsatz | Lese-IOPS (SSD) | Schreib-IOPS | Netzwerkbandbreite | Anwendungsfall |
|-----------|-----------------|--------------|-------------------|----------------|
| 128 MB/s | 6.000 | 1.500 | Bis zu 600 MB/s | PoC, kleine Skalierung |
| 256 MB/s | 12.000 | 3.000 | Bis zu 1,2 GB/s | Abteilungsnutzung |
| 512 MB/s | 40.000 | 10.000 | Bis zu 2,4 GB/s | Unternehmensweit |
| 1.024 MB/s | 80.000 | 20.000 | Bis zu 4,8 GB/s | Große Skalierung |
| 2.048 MB/s | 160.000 | 40.000 | Bis zu 9,6 GB/s | Geschäftskritisch |

> **Referenz**: Amazon FSx for ONTAP unterstützt bis zu 72 GB/s Durchsatz (12 HA-Paar-Konfiguration).

### Speicher-Tiering (Capacity Pool Tiering)

| Tier | Eigenschaften | Kosten | Anwendungsfall |
|------|---------------|--------|----------------|
| SSD | Sub-Millisekunden-Latenz | Hoch | Häufig zugegriffene Dateien |
| Capacity Pool | Zehn Millisekunden Latenz | Niedrig (~1/10 von SSD) | Archiv, seltener Zugriff |

**Empfehlungen für RAG-Systeme**:
- `.metadata.json` und häufig gesuchte Dokumente → SSD-Tier
- Archivdokumente, alte Versionen → Capacity Pool

**Tiering-Richtlinien**:
- `auto`: Verschiebt Daten automatisch in den Capacity Pool nach einer Periode ohne Zugriff (empfohlen)
- `snapshot-only`: Verschiebt nur Snapshot-Daten in den Capacity Pool
- `all`: Verschiebt alle Daten in den Capacity Pool (Kostenpriorität)
- `none`: Behält alle Daten auf SSD (Leistungspriorität)

---

## S3 Access Point-Überlegungen

### Leistungsmerkmale

Der S3 Access Point von FSx for ONTAP stellt Dateien auf FSx-Volumes über eine S3-kompatible Schnittstelle bereit.

| Operation | Latenz | Durchsatz | Hinweise |
|-----------|--------|-----------|----------|
| ListObjectsV2 | Hunderte Millisekunden | — | Proportional zur Dateianzahl |
| GetObject (kleine Dateien) | Zehn bis Hunderte Millisekunden | — | Für SSD-Tier |
| GetObject (große Dateien) | Proportional zur Dateigröße | Abhängig vom FSx-Durchsatz | Streaming |
| HeadObject | Zehn Millisekunden | — | Nur Metadaten |

### Last während Bedrock KB-Synchronisierung

Während der KB-Synchronisierung (StartIngestionJob) liest Bedrock alle Dokumente über den S3 Access Point.

| Dokumentenanzahl | Leselast während Sync | Empfohlener Durchsatz |
|------------------|----------------------|----------------------|
| ~1.000 | Niedrig (einige GB) | 128 MB/s ist ausreichend |
| ~10.000 | Mittel (Zehn GB) | 256 MB/s empfohlen |
| ~100.000 | Hoch (Hunderte GB) | 512 MB/s oder höher empfohlen |

### Zweischichtige Autorisierung

Der Zugriff über S3 Access Point erfordert 2 Authentifizierungsschichten:

1. **IAM-Authentifizierung**: S3 Access Point-Richtlinie + IAM-identitätsbasierte Richtlinie
2. **Dateisystem-Authentifizierung**: NTFS ACL (Windows-Benutzerzuordnung)

```
Bedrock KB Role → S3 Access Point Policy (IAM) → FSx NTFS ACL (File System)
                   ↓                                ↓
                   IAM Allow                        ACL Allow
                   ↓                                ↓
                   Both Allow → Access Granted
```

---

## Auswahlkriterien für den Vektorspeicher

### S3 Vectors vs. OpenSearch Serverless

| Aspekt | S3 Vectors | OpenSearch Serverless |
|--------|-----------|---------------------|
| Kosten (kleine Skalierung) | Wenige Dollar/Monat | 700+ $/Monat (mindestens 2 OCU) |
| Kosten (große Skalierung) | Proportional zur Vektoranzahl | Proportional zur OCU-Anzahl |
| Abfragelatenz | Kalt: Sub-Sekunde, Warm: ~100ms | Immer ~50ms |
| Max. Vektoranzahl | 10.000 Indizes/Bucket | Praktisch unbegrenzt |
| Metadatenfilter | 2KB/Vektor (filterbar) | Gelockerte Grenzen |
| Skalierbarkeit | Automatisch | Manuelles/automatisches OCU-Scaling |
| Betriebsaufwand | Nahezu null | OCU-Überwachung erforderlich |
| Export | → OpenSearch Serverless (Ein-Klick) | — |

### Auswahl-Flussdiagramm

```
Gleichzeitige Benutzer < 10 UND Dokumentenanzahl < 10.000?
  → Ja: S3 Vectors (Kostenpriorität)
  → Nein:
    Latenzanforderung < 100ms?
      → Ja: OpenSearch Serverless
      → Nein:
        Monatliches Budget < 1.000 $?
          → Ja: S3 Vectors (Latenz akzeptabel)
          → Nein: OpenSearch Serverless
```

### Migrationspfad

Die Migration von S3 Vectors → OpenSearch Serverless kann mit Ein-Klick-Export aus der Konsole durchgeführt werden (dauert ~15 Min.). Die Rückmigration erfolgt über KB-Resync.

---

## Design der initialen Indexierung

### Empfohlener Ansatz

| Dokumentenanzahl | Methode | Hinweise |
|------------------|---------|----------|
| ~1.000 | Batch-KB-Sync | Abschluss mit einem einzelnen `StartIngestionJob` |
| ~10.000 | Batch-KB-Sync | Auf Sync-Abschluss warten (30–60 Min.) |
| ~100.000 | Batch-Aufteilung | Datenquellen aufteilen und inkrementell synchronisieren |
| 100.000+ | Schrittweise Aufnahme | Ordnerweise aufnehmen → Sync wiederholen |

### Überlegungen zur initialen Indexierung

1. **Temporäre FSx-Durchsatzerhöhung**: Die Leselast ist während der initialen Indexierung hoch, daher sollte eine temporäre Erhöhung der Durchsatzkapazität in Betracht gezogen werden
2. **S3 Access Point gleichzeitige Verbindungen**: Bedrock KB liest Dateien parallel, daher auf FSx-Limits für gleichzeitige Verbindungen achten
3. **`.metadata.json` vorab vorbereiten**: Bestätigen Sie, dass alle Dokumente `.metadata.json` haben, bevor Sie die Synchronisierung starten
4. **Dateiänderungen während der Synchronisierung**: Inkonsistenzen können auftreten, wenn Dateien während der Synchronisierung geändert werden. Ein Änderungsstopp während der initialen Synchronisierung wird empfohlen

---

## Design der inkrementellen Synchronisierung

### KB Auto-Sync-Verhalten

Inkrementeller Synchronisierungsmechanismus aktiviert mit `enableKbAutoSync=true`:

```
EventBridge Scheduler (5–15 Min. Intervall)
  → Lambda: Dateiliste von S3 AP über ListObjectsV2 abrufen
  → DynamoDB: Mit vorherigem Inventar vergleichen
  → Nur bei Änderungserkennung: StartIngestionJob ausführen
  → Wenn IN_PROGRESS-Job existiert: Überspringen (Deduplizierung)
```

### Änderungserkennungsmechanismus

| Erkennungsziel | Methode | Hinweise |
|----------------|---------|----------|
| Neue Dateien | LastModified-Vergleich | Schlüssel nicht im DynamoDB-Inventar vorhanden |
| Aktualisierte Dateien | ETag / LastModified-Vergleich | Schlüssel mit geänderten Werten |
| Gelöschte Dateien | Inventar-Diff | Schlüssel in DynamoDB vorhanden, aber nicht in S3 AP |

### Herausforderungen der inkrementellen Synchronisierung bei großer Skalierung

| Dateianzahl | ListObjectsV2-Dauer | Gegenmaßnahme |
|-------------|---------------------|----------------|
| ~10.000 | Einige Sekunden | Keine Probleme |
| ~100.000 | Zehn Sekunden | Lambda-Timeout verlängern (15 Min.) |
| 100.000+ | Mehrere Minuten oder mehr | Präfix-Aufteilung, Step Functions |

---

## QoS (Quality of Service) Design

Wenn mehrere Mandanten oder Workloads FSx gemeinsam nutzen, können QoS-Richtlinien die Leistung steuern.

### Empfohlene QoS-Einstellungen

| Workload | Priorität | IOPS-Limit | Durchsatz-Limit |
|----------|-----------|-----------|-----------------|
| RAG-Suche (über S3 AP) | Hoch | Unbegrenzt | Unbegrenzt |
| KB-Sync (Batch) | Mittel | 5.000 IOPS | 100 MB/s |
| Benutzer-CIFS/SMB-Zugriff | Hoch | Unbegrenzt | Unbegrenzt |
| Backup / SnapMirror | Niedrig | 2.000 IOPS | 50 MB/s |

### Anwenden von QoS-Richtlinien

```bash
# QoS-Richtliniengruppe über ONTAP CLI erstellen
qos policy-group create -policy-group kb-sync-limit \
  -vserver svm1 -max-throughput 100MB/s -min-throughput 0

# QoS-Richtlinie auf Volume anwenden
volume modify -vserver svm1 -volume kb_data \
  -qos-policy-group kb-sync-limit
```

---

## Kapazitätsüberwachung und automatische Erweiterung

### Überwachungsmetriken

| Metrik | Schwellenwert | Aktion |
|--------|---------------|--------|
| SSD-Auslastung | > 80% | Kapazität erweitern oder Tiering-Richtlinie überprüfen |
| Capacity Pool-Auslastung | > 90% | Kapazität erweitern |
| IOPS-Auslastung | > 80% | Durchsatzkapazität erhöhen |
| Netzwerkbandbreitenauslastung | > 70% | Durchsatzkapazität erhöhen |

### Automatische Erweiterung (FSx ONTAP Ops)

Die in `automation/fsxn-ops/` enthaltene Kapazitätsüberwachungs-Lambda führt die automatische Erweiterung durch:

- Überwacht die Volume-Auslastung alle 5 Minuten über EventBridge
- Erweitert automatisch die Volume-Größe bei Schwellenwertüberschreitung
- Capacity Guardrails (Tageslimit, Abkühlungsperiode) verhindern Überexpansion
- CloudWatch Dashboard visualisiert den Erweiterungsverlauf

---

## Tipps zur Kostenoptimierung

### 1. Capacity Pool Tiering nutzen

Die meisten für die RAG-Suche bestimmten Dokumente werden nach der Einbettung selten zugegriffen. Setzen Sie die Tiering-Richtlinie auf `auto`, um selten zugegriffene Daten automatisch in die kostengünstige Tier zu verschieben.

### 2. Durchsatzkapazität richtig dimensionieren

Die Leselast nimmt nach der initialen Indexierung deutlich ab. Synchronisieren Sie zunächst mit hohem Durchsatz und reduzieren Sie dann den Durchsatz in der Betriebsphase, um Kosten zu senken.

```bash
# Durchsatzkapazität ändern (keine Ausfallzeit)
aws fsx update-file-system \
  --file-system-id fs-0123456789abcdef0 \
  --ontap-configuration ThroughputCapacity=128
```

### 3. S3 Vectors nutzen

Für kleine bis mittlere Umgebungen verwenden Sie S3 Vectors (wenige Dollar/Monat), um OpenSearch Serverless-Kosten (700+ $/Monat) zu vermeiden. Ein-Klick-Export ist verfügbar, wenn die Leistungsanforderungen steigen.

---

## Verwandte Dokumente

| Dokument | Beschreibung |
|----------|--------------|
| [permission-consistency.md](permission-consistency.md) | Konsistenzmodell für Berechtigungsänderungen |
| [s3-vectors-sid-architecture-guide.md](s3-vectors-sid-architecture-guide.md) | S3 Vectors + SID-Architektur |
| [stack-architecture-comparison.md](stack-architecture-comparison.md) | 3-Konfigurationen-Vergleich |
| [automation/fsxn-ops/README.md](../automation/fsxn-ops/README.md) | FSx ONTAP Betriebsautomatisierung |
