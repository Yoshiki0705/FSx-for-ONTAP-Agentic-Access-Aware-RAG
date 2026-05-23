# Kostenschätzungs-Arbeitsblatt

**🌐 Language:** [日本語](../cost-estimation-worksheet.md) | [English](../en/cost-estimation-worksheet.md) | [한국어](../ko/cost-estimation-worksheet.md) | [简体中文](../zh-CN/cost-estimation-worksheet.md) | [繁體中文](../zh-TW/cost-estimation-worksheet.md) | [Français](../fr/cost-estimation-worksheet.md) | **Deutsch** | [Español](../es/cost-estimation-worksheet.md)

**Erstellungsdatum**: 2026-05-23  
**Status**: Entwurf  
**Zielgruppe**: Projektmanager, Partner-Angebotsverantwortliche, Budgetplaner

> **⚠️ Hinweis**: Die Preise in diesem Arbeitsblatt sind Referenzwerte basierend auf den öffentlichen Preisen der Region ap-northeast-1 vom Mai 2026. Die tatsächlichen Kosten variieren je nach Region, Nutzung, Rabatten und Preisänderungen. Aktuelle Preise finden Sie unter [AWS Pricing](https://aws.amazon.com/pricing/).

---

## Eingabeparameter

Füllen Sie die folgenden Werte aus, um Ihre monatlichen Kosten zu schätzen.

| Parameter | Wert | Hinweise |
|-----------|------|----------|
| Anzahl der Dokumente | _____ | Dateien auf dem FSx-Volume |
| Durchschnittliche Dokumentgröße | _____ KB | Textäquivalent |
| Tägliche Abfragen | _____ /Tag | Alle Benutzer zusammen |
| Gleichzeitige Benutzer | _____ | Spitzenwert |
| Registrierte Benutzer | _____ | Cognito User Pool |
| KB-Synchronisierungsfrequenz | _____ /Tag | Aus Auto-Sync-Intervall berechnet |
| Agent-Modus-Nutzungsrate | _____ % | Anteil der Abfragen mit Agent |
| Verfügbarkeitsanforderung | Single-AZ / Multi-AZ | FSx-Konfiguration |

---

## Kostenberechnungsformeln

### 1. FSx for ONTAP

```
Monatlich = Throughput-Kosten + SSD-Kosten + Capacity-Pool-Kosten + Backup-Kosten

Throughput-Kosten:
  128 MB/s: ~$210/Monat
  256 MB/s: ~$420/Monat
  512 MB/s: ~$840/Monat
  1,024 MB/s: ~$1,680/Monat

SSD-Kosten: $0.125/GiB/Monat × SSD-Kapazität (GiB)
Capacity-Pool-Kosten: $0.0125/GiB/Monat × Capacity-Pool-Nutzung (GiB)
Backup-Kosten: $0.025/GiB/Monat × Backup-Kapazität (GiB)

Bei Multi-AZ: Throughput- + SSD-Kosten verdoppeln sich ungefähr
```

**Berechnungsbeispiele**:
- 128 MB/s + 1 TiB SSD + 500 GiB CP (Single-AZ): $210 + $128 + $6.25 = **~$344/Monat**
- 512 MB/s + 5 TiB SSD + 2 TiB CP (Multi-AZ): $1,680 + $640 + $25 = **~$2,345/Monat**

### 2. Vektorspeicher

```
S3 Vectors:
  Speicher: $0.023/GB/Monat × Vektordatengröße
  Anfragen: $0.005/1.000 PUT + $0.0004/1.000 GET
  Schätzung: 10.000 Dokumente → ~$5/Monat

OpenSearch Serverless:
  OCU: $0.24/OCU/Stunde × 24 × 30 = $172.80/OCU/Monat
  Minimum 2 OCU (Suche + Index): ~$346/Monat
  Empfohlen 4 OCU: ~$691/Monat
```

### 3. Bedrock (Embedding)

```
Titan Embed Text v2: $0.0001/1.000 Tokens

Initiales Embedding:
  = Dokumentanzahl × Durchschnittsgröße (KB) × 1.000 / 4 × $0.0001/1K
  Beispiel: 10.000 Docs × 10 KB × 250 Tokens/KB × $0.0001/1K = $2.50

Monatliches inkrementelles Embedding:
  = Geänderte Dokumente × Durchschnittsgröße × $0.0001/1K
  Beispiel: 500 Docs/Monat × 10 KB × 250 Tokens/KB × $0.0001/1K = $0.13
```

### 4. Bedrock (Generierungsmodelle)

```
Smart-Routing-Verteilung (Standardannahme):
  Simple (Haiku): 60% → $0.001/Query
  Complex (Sonnet): 30% → $0.01/Query
  Full-context (Opus): 10% → $0.10/Query

Gewichtete Durchschnittskosten/Abfrage:
  = 0.6 × $0.001 + 0.3 × $0.01 + 0.1 × $0.10
  = $0.0006 + $0.003 + $0.01
  = ~$0.014/Query

Monatlich:
  = Tägliche Abfragen × 30 × $0.014
  Beispiel: 100 Queries/Tag × 30 × $0.014 = $42/Monat
  Beispiel: 1.000 Queries/Tag × 30 × $0.014 = $420/Monat
```

### 5. Lambda

```
WebApp Lambda:
  Anfragen: $0.20/1 Million Anfragen
  Compute: $0.0000166667/GB-Sekunde
  Speicher: 1.024 MB, durchschnittliche Ausführungszeit: 3 Sekunden
  
  Monatlich = Anfragen × (Speicher_GB × Ausführungssek. × $0.0000166667 + $0.0000002)
  Beispiel: 100.000 Req/Monat × (1 × 3 × $0.0000166667 + $0.0000002) = ~$5/Monat

Sync-Lambda (KB Auto-Sync, AD Sync):
  5-Minuten-Intervall × 30 Tage = 8.640 Aufrufe/Monat
  128 MB × 5 Sekunden = ~$0.60/Monat
```

### 6. Sonstige Dienste

```
CloudFront: $0.114/GB (Japan) × Übertragungsvolumen
  Beispiel: 10 GB/Monat = $1.14/Monat

WAF: $5/WebACL + $1/Regel × 6 + $0.60/1 Million Anfragen
  Basis: $11/Monat + nutzungsbasierte Gebühren

DynamoDB (On-Demand):
  Schreibvorgänge: $1.25/1 Million WRU
  Lesevorgänge: $0.25/1 Million RRU
  Speicher: $0.25/GB/Monat
  Beispiel: ~$5/Monat (kleine Umgebung)

Cognito:
  Erste 50.000 MAU: Kostenlos
  50.001–100.000: $0.0055/MAU
  Beispiel: 100 MAU = $0 (im kostenlosen Kontingent)

CloudWatch:
  Log-Aufnahme: $0.76/GB
  Log-Speicher: $0.033/GB/Monat
  Metriken: $0.30/Metrik/Monat (erste 10.000)
  Beispiel: ~$10–$30/Monat
```

---

## Monatliche Kostenschätzungsvorlagen nach Konfiguration

### Vorlage A: Kleines PoC

| Ressource | Konfiguration | Monatlich |
|-----------|--------------|-----------|
| FSx for ONTAP | 128 MB/s, 1 TiB SSD, Single-AZ | $344 |
| S3 Vectors | ~10.000 Vektoren | $5 |
| Bedrock Embedding | Initial + inkrementell | $3 |
| Bedrock Generierung | 100 Queries/Tag, Smart Routing | $42 |
| Lambda | WebApp + Sync | $6 |
| CloudFront + WAF | Basis | $15 |
| DynamoDB | On-Demand | $5 |
| Cognito | ~50 MAU | $0 |
| CloudWatch | Basis | $10 |
| **Gesamt** | | **~$430/Monat** |

### Vorlage B: Mittlere Produktion

| Ressource | Konfiguration | Monatlich |
|-----------|--------------|-----------|
| FSx for ONTAP | 512 MB/s, 5 TiB SSD, Multi-AZ | $2,345 |
| OpenSearch Serverless | 4 OCU | $691 |
| Bedrock Embedding | Periodische Synchronisierung | $10 |
| Bedrock Generierung | 1.000 Queries/Tag, Smart Routing | $420 |
| Lambda | WebApp + Sync + Überwachung | $30 |
| CloudFront + WAF | Produktionstraffic | $50 |
| DynamoDB | Provisioniert | $30 |
| Cognito | ~500 MAU | $0 |
| CloudWatch | Logs + Metriken + Alarme | $50 |
| **Gesamt** | | **~$3,626/Monat** |

### Vorlage C: Großunternehmen

| Ressource | Konfiguration | Monatlich |
|-----------|--------------|-----------|
| FSx for ONTAP | 1.024 MB/s, 10 TiB SSD, Multi-AZ | $4,480 |
| OpenSearch Serverless | 8 OCU | $1,382 |
| Bedrock Embedding | Großsynchronisierung | $50 |
| Bedrock Generierung | 5.000 Queries/Tag, Smart Routing | $2,100 |
| Lambda | Alle Funktionen | $100 |
| CloudFront + WAF | Hoher Traffic | $200 |
| DynamoDB | Provisioniert + DAX | $100 |
| Cognito | ~2.000 MAU | $0 |
| CloudWatch | Vollständige Überwachung | $100 |
| **Gesamt** | | **~$8,512/Monat** |

---

## Tipps zur Kostenoptimierung

| Methode | Einsparung | Anwendungsbedingungen |
|---------|-----------|----------------------|
| S3 Vectors (statt AOSS) | -$700/Monat | QPS < 10, Latenz tolerierbar |
| Smart Routing (Haiku-Priorität) | -30–50% | Überwiegend einfache Fragen |
| Capacity Pool Tiering | -50–80% (Speicher) | Viele selten abgerufene Daten |
| Throughput-Reduzierung (Betriebsphase) | -50% | Nach Abschluss der initialen Indexierung |
| Savings Plans (Lambda) | -17% | 1-Jahres-Verpflichtung |
| Reserved Capacity (AOSS) | Auf Anfrage | Langfristige Nutzung bestätigt |

---

## Verwandte Dokumente

| Dokument | Beschreibung |
|----------|-------------|
| [fsxn-sizing-and-performance.md](../fsxn-sizing-and-performance.md) | FSx for ONTAP Leistung und Kapazitätsplanung |
| [partner-deployment-patterns.md](../partner-deployment-patterns.md) | Partner-Bereitstellungsmuster (inkl. Kostenvergleich) |
| [evaluation.md](../evaluation.md) | RAG / Agent Bewertungsmetriken |
