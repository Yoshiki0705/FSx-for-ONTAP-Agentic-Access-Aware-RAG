# Scénarios de benchmark (10K / 100K / 1M fichiers)

**🌐 Language:** [日本語](../benchmark-scenarios.md) | [English](../en/benchmark-scenarios.md) | [한국어](../ko/benchmark-scenarios.md) | [简体中文](../zh-CN/benchmark-scenarios.md) | [繁體中文](../zh-TW/benchmark-scenarios.md) | **Français** | [Deutsch](../de/benchmark-scenarios.md) | [Español](../es/benchmark-scenarios.md)

**Date de création** : 2026-05-23  
**Statut** : Framework terminé, en attente de mesures  
**Public cible** : Ingénieurs performance, planificateurs de capacité

> **⚠️ Distinction** : Les estimations de ce document sont des valeurs théoriques basées sur la documentation AWS. Pour les mesures réelles, exécutez `benchmarks/scripts/run-benchmark.sh` dans votre environnement de test. Ne confondez pas les valeurs théoriques avec les mesures réelles.

---

## Aperçu

Ce document définit les scénarios de benchmark pour évaluer les performances du système Permission-aware RAG à trois échelles différentes.

---

## Procédure d'exécution du benchmark

### Step 1 : Génération des données de test

```bash
# 10K fichiers (échelle PoC)
python3 benchmarks/scripts/generate-test-data.py --scale 10k --output /tmp/bench-10k

# 100K fichiers (échelle département)
python3 benchmarks/scripts/generate-test-data.py --scale 100k --output /tmp/bench-100k

# 1M fichiers (échelle entreprise)
python3 benchmarks/scripts/generate-test-data.py --scale 1m --output /tmp/bench-1m
```

### Step 2 : Upload des données & synchronisation KB

```bash
# Upload vers S3
aws s3 sync /tmp/bench-10k/ s3://${KB_DATA_BUCKET}/ --exclude "*.DS_Store"

# Synchronisation KB (mesure du temps d'indexation initiale)
time aws bedrock-agent start-ingestion-job \
  --knowledge-base-id ${KB_ID} \
  --data-source-id ${DS_ID}
```

### Step 3 : Exécution du benchmark

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

## Scénarios de mesure

### Scénario 1 : Latence de recherche (utilisateur unique)

| Paramètre | Valeur |
|-----------|--------|
| Objectif | Mesurer la latence de base de Retrieve API + filtre SID |
| Requêtes | 200 |
| Concurrence | 1 |
| Utilisateur | admin (accès à tous les documents) |
| Métriques | Retrieve API P50/P95/P99, SID Filter, End-to-End |

### Scénario 2 : Efficacité du filtrage par permissions

| Paramètre | Valeur |
|-----------|--------|
| Objectif | Mesurer l'efficacité du filtrage et la qualité des résultats par niveau de permission |
| Requêtes | 100 × 3 utilisateurs |
| Utilisateurs | admin (accès complet), engineer (partiel), general (public uniquement) |
| Métriques | Ratio du nombre de documents avant/après filtrage, qualité des réponses |

### Scénario 3 : Charge d'accès concurrent

| Paramètre | Valeur |
|-----------|--------|
| Objectif | Mesurer la dégradation de latence sous accès concurrent |
| Requêtes | 500 |
| Concurrence | 1, 5, 10, 20, 50 |
| Métriques | Variation de la latence P95 par niveau de concurrence |

### Scénario 4 : Performance de synchronisation KB

| Paramètre | Valeur |
|-----------|--------|
| Objectif | Mesurer la durée de l'indexation initiale et de la synchronisation incrémentale |
| Métriques | Temps de synchronisation initiale, temps de synchronisation incrémentale (5% de changement), temps ListObjectsV2 |

### Scénario 5 : Effet du cache

| Paramètre | Valeur |
|-----------|--------|
| Objectif | Mesurer l'effet du cache de permissions |
| Requêtes | 100 (même utilisateur, consécutives) |
| Métriques | Taux de hit du cache, différence de latence entre hit/miss |

---

## Estimations théoriques de référence

> Pour plus de détails, voir [benchmarks/results/baseline-estimates.md](../benchmarks/results/baseline-estimates.md)

| Échelle | Retrieve P50 (S3V) | Retrieve P50 (AOSS) | End-to-End P50 | KB Sync (initial) |
|---------|--------------------|--------------------|----------------|-------------------|
| 10K | 200–500 ms | 100–200 ms | 2–4 sec | 5–15 min |
| 100K | 300–800 ms | 100–200 ms | 3–6 sec | 30–90 min |
| 1M | 500–1 500 ms | 100–300 ms | 4–8 sec | Plusieurs heures |

---

## Modèle de rapport de résultats

Après l'exécution du benchmark, enregistrez les résultats avec le modèle suivant.

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

## Documents associés

| Document | Description |
|----------|-------------|
| [fsxn-sizing-and-performance.md](../fsxn-sizing-and-performance.md) | Performance et dimensionnement FSx for ONTAP |
| [cost-estimation-worksheet.md](../cost-estimation-worksheet.md) | Feuille d'estimation des coûts |
| [benchmarks/README.md](../../benchmarks/README.md) | Framework de benchmark |
| [benchmarks/results/baseline-estimates.md](../../benchmarks/results/baseline-estimates.md) | Estimations théoriques de référence |
