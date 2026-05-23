# Benchmark-Szenarien (10K / 100K / 1M Dateien)

**🌐 Language:** [日本語](../benchmark-scenarios.md) | [English](../en/benchmark-scenarios.md) | [한국어](../ko/benchmark-scenarios.md) | [简体中文](../zh-CN/benchmark-scenarios.md) | [繁體中文](../zh-TW/benchmark-scenarios.md) | [Français](../fr/benchmark-scenarios.md) | **Deutsch** | [Español](../es/benchmark-scenarios.md)

**Erstellt**: 2026-05-23  
**Status**: Framework abgeschlossen, Messungen ausstehend  
**Zielgruppe**: Performance-Ingenieure, Kapazitätsplaner

> **⚠️ Unterscheidung**: Die Schätzungen in diesem Dokument sind theoretische Werte basierend auf der AWS-Dokumentation. Für tatsächliche Messwerte führen Sie `benchmarks/scripts/run-benchmark.sh` in Ihrer Testumgebung aus. Verwechseln Sie theoretische Werte nicht mit tatsächlichen Messwerten.

---

## Überblick

Dieses Dokument definiert Benchmark-Szenarien zur Bewertung der Leistung des Permission-aware RAG-Systems in drei verschiedenen Größenordnungen.

---

## Benchmark-Ausführungsschritte

### Step 1: Testdaten generieren

```bash
# 10K Dateien (PoC-Größenordnung)
python3 benchmarks/scripts/generate-test-data.py --scale 10k --output /tmp/bench-10k

# 100K Dateien (Abteilungs-Größenordnung)
python3 benchmarks/scripts/generate-test-data.py --scale 100k --output /tmp/bench-100k

# 1M Dateien (Enterprise-Größenordnung)
python3 benchmarks/scripts/generate-test-data.py --scale 1m --output /tmp/bench-1m
```

### Step 2: Daten hochladen & KB synchronisieren

```bash
# Auf S3 hochladen
aws s3 sync /tmp/bench-10k/ s3://${KB_DATA_BUCKET}/ --exclude "*.DS_Store"

# KB synchronisieren (initiale Indexierungszeit messen)
time aws bedrock-agent start-ingestion-job \
  --knowledge-base-id ${KB_ID} \
  --data-source-id ${DS_ID}
```

### Step 3: Benchmark ausführen

```bash
bash benchmarks/scripts/run-benchmark.sh \
  --kb-id ${KB_ID} \
  --user-access-table ${USER_ACCESS_TABLE} \
  --scale 10k \
  --queries 200 \
  --concurrent 5 \
  --output benchmarks/results/10k-results.json
```

---

## Messszenarien

### Szenario 1: Suchlatenz (Einzelbenutzer)

| Parameter | Wert |
|-----------|------|
| Ziel | Basislatenz von Retrieve API + SID-Filter messen |
| Abfragen | 200 |
| Parallelität | 1 |
| Benutzer | admin (Zugriff auf alle Dokumente) |
| Metriken | Retrieve API P50/P95/P99, SID Filter, End-to-End |

### Szenario 2: Effizienz der Berechtigungsfilterung

| Parameter | Wert |
|-----------|------|
| Ziel | Filtereffizienz und Ergebnisqualität nach Berechtigungsstufe messen |
| Abfragen | 100 × 3 Benutzer |
| Benutzer | admin (Vollzugriff), engineer (teilweise), general (nur öffentlich) |
| Metriken | Dokumentanzahl-Verhältnis vor/nach Filterung, Antwortqualität |

### Szenario 3: Gleichzeitige Zugriffslast

| Parameter | Wert |
|-----------|------|
| Ziel | Latenzverschlechterung bei gleichzeitigem Zugriff messen |
| Abfragen | 500 |
| Parallelität | 1, 5, 10, 20, 50 |
| Metriken | P95-Latenzänderung nach Parallelitätsstufe |

### Szenario 4: KB-Synchronisationsleistung

| Parameter | Wert |
|-----------|------|
| Ziel | Dauer der initialen Indexierung und inkrementellen Synchronisation messen |
| Metriken | Initiale Synchronisationszeit, inkrementelle Synchronisationszeit (5% Änderung), ListObjectsV2-Zeit |

### Szenario 5: Cache-Effektivität

| Parameter | Wert |
|-----------|------|
| Ziel | Effekt des Berechtigungs-Caches messen |
| Abfragen | 100 (gleicher Benutzer, aufeinanderfolgend) |
| Metriken | Cache-Trefferquote, Latenzunterschied zwischen Treffer/Fehltreffer |

---

## Theoretische Baseline-Schätzungen

> Details siehe [benchmarks/results/baseline-estimates.md](../benchmarks/results/baseline-estimates.md)

| Größenordnung | Retrieve P50 (S3V) | Retrieve P50 (AOSS) | End-to-End P50 | KB Sync (initial) |
|---------------|--------------------|--------------------|----------------|-------------------|
| 10K | 200–500 ms | 100–200 ms | 2–4 Sek. | 5–15 Min. |
| 100K | 300–800 ms | 100–200 ms | 3–6 Sek. | 30–90 Min. |
| 1M | 500–1.500 ms | 100–300 ms | 4–8 Sek. | Mehrere Stunden |

---

## Ergebnisbericht-Vorlage

Erfassen Sie nach der Benchmark-Ausführung die Ergebnisse mit der folgenden Vorlage.

```markdown
# Benchmark Results — [SCALE] files

## Environment
- Region: ap-northeast-1
- Vector Store: S3 Vectors / OpenSearch Serverless
- FSx Throughput: XXX MB/s
- Document Count: XXX
- Chunk Count: XXX (estimated)
- Date: YYYY-MM-DD

## Results

### Retrieve API Latency
| Percentile | Value |
|-----------|-------|
| P50 | XXX ms |
| P95 | XXX ms |
| P99 | XXX ms |

### SID Filter Latency
| Percentile | Value |
|-----------|-------|
| P50 | XXX ms |
| P95 | XXX ms |

### End-to-End (Retrieve + SID + Converse)
| Percentile | Value |
|-----------|-------|
| P50 | XXX ms |
| P95 | XXX ms |

### KB Sync
| Operation | Duration |
|-----------|----------|
| Initial sync | XXX min |
| Incremental (5% change) | XXX min |

### Throughput
| Metric | Value |
|--------|-------|
| Queries/minute (single user) | XXX |
| Queries/minute (5 concurrent) | XXX |

## Observations
- 
- 

## Recommendations
- 
- 
```

---

## Verwandte Dokumente

| Dokument | Beschreibung |
|----------|--------------|
| [fsxn-sizing-and-performance.md](../fsxn-sizing-and-performance.md) | FSx for ONTAP Leistung & Kapazitätsplanung |
| [cost-estimation-worksheet.md](../cost-estimation-worksheet.md) | Kostenschätzungs-Arbeitsblatt |
| [benchmarks/README.md](../../benchmarks/README.md) | Benchmark-Framework |
| [benchmarks/results/baseline-estimates.md](../../benchmarks/results/baseline-estimates.md) | Theoretische Baseline-Schätzungen |
