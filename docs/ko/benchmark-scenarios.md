# 벤치마크 시나리오 (10K / 100K / 1M 파일)

**🌐 Language:** [日本語](../benchmark-scenarios.md) | [English](../en/benchmark-scenarios.md) | **한국어** | [简体中文](../zh-CN/benchmark-scenarios.md) | [繁體中文](../zh-TW/benchmark-scenarios.md) | [Français](../fr/benchmark-scenarios.md) | [Deutsch](../de/benchmark-scenarios.md) | [Español](../es/benchmark-scenarios.md)

**작성일**: 2026-05-23  
**상태**: 프레임워크 완성, 실측 대기 중  
**대상**: 성능 엔지니어, 용량 계획 담당자

> **⚠️ 구분**: 본 문서의 추정값은 AWS 문서에 기반한 이론값입니다. 실측값은 테스트 환경에서 `benchmarks/scripts/run-benchmark.sh`를 실행하여 취득하십시오. 이론값과 실측값을 혼동하지 마십시오.

---

## 개요

본 문서는 Permission-aware RAG 시스템의 성능을 3가지 규모에서 평가하기 위한 벤치마크 시나리오를 정의합니다.

---

## 벤치마크 실행 절차

### Step 1: 테스트 데이터 생성

```bash
# 10K 파일 (PoC 규모)
python3 benchmarks/scripts/generate-test-data.py --scale 10k --output /tmp/bench-10k

# 100K 파일 (부서 규모)
python3 benchmarks/scripts/generate-test-data.py --scale 100k --output /tmp/bench-100k

# 1M 파일 (엔터프라이즈 규모)
python3 benchmarks/scripts/generate-test-data.py --scale 1m --output /tmp/bench-1m
```

### Step 2: 데이터 업로드 & KB 동기화

```bash
# S3에 업로드
aws s3 sync /tmp/bench-10k/ s3://${KB_DATA_BUCKET}/ --exclude "*.DS_Store"

# KB 동기화 (초기 인덱싱 시간 측정)
time aws bedrock-agent start-ingestion-job \
  --knowledge-base-id ${KB_ID} \
  --data-source-id ${DS_ID}
```

### Step 3: 벤치마크 실행

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

## 측정 시나리오

### 시나리오 1: 검색 레이턴시 (단일 사용자)

| 파라미터 | 값 |
|---------|-----|
| 목적 | Retrieve API + SID 필터의 기본 레이턴시 측정 |
| 쿼리 수 | 200 |
| 동시 실행 | 1 |
| 사용자 | admin (전체 문서 접근 가능) |
| 측정 대상 | Retrieve API P50/P95/P99, SID Filter, End-to-End |

### 시나리오 2: 권한 필터링 효율

| 파라미터 | 값 |
|---------|-----|
| 목적 | 권한 수준별 필터링 효율 및 결과 품질 측정 |
| 쿼리 수 | 100 × 3 사용자 |
| 사용자 | admin (전체 접근), engineer (부분), general (공개만) |
| 측정 대상 | 필터 전/후 문서 수 비율, 응답 품질 |

### 시나리오 3: 동시 접근 부하

| 파라미터 | 값 |
|---------|-----|
| 목적 | 동시 접근 시 레이턴시 저하 측정 |
| 쿼리 수 | 500 |
| 동시 실행 | 1, 5, 10, 20, 50 |
| 측정 대상 | 동시 실행 수별 P95 레이턴시 변화 |

### 시나리오 4: KB 동기화 성능

| 파라미터 | 값 |
|---------|-----|
| 목적 | 초기 인덱싱 및 차분 동기화 소요 시간 측정 |
| 측정 대상 | 초기 동기화 시간, 차분 동기화 시간 (5% 변경), ListObjectsV2 시간 |

### 시나리오 5: 캐시 효과

| 파라미터 | 값 |
|---------|-----|
| 목적 | 권한 캐시의 효과 측정 |
| 쿼리 수 | 100 (동일 사용자 연속) |
| 측정 대상 | 캐시 히트율, 히트/미스 시 레이턴시 차이 |

---

## 이론적 베이스라인 추정값

> 상세 내용은 [benchmarks/results/baseline-estimates.md](../benchmarks/results/baseline-estimates.md) 참조

| 규모 | Retrieve P50 (S3V) | Retrieve P50 (AOSS) | End-to-End P50 | KB Sync (초기) |
|------|--------------------|--------------------|----------------|---------------|
| 10K | 200~500 ms | 100~200 ms | 2~4 초 | 5~15 분 |
| 100K | 300~800 ms | 100~200 ms | 3~6 초 | 30~90 분 |
| 1M | 500~1,500 ms | 100~300 ms | 4~8 초 | 수 시간 |

---

## 결과 보고서 템플릿

벤치마크 실행 후 아래 템플릿으로 결과를 기록하십시오.

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

## 관련 문서

| 문서 | 내용 |
|------|------|
| [fsxn-sizing-and-performance.md](../fsxn-sizing-and-performance.md) | FSx for ONTAP 성능 및 용량 설계 |
| [cost-estimation-worksheet.md](../cost-estimation-worksheet.md) | 비용 견적 워크시트 |
| [benchmarks/README.md](../../benchmarks/README.md) | 벤치마크 프레임워크 |
| [benchmarks/results/baseline-estimates.md](../../benchmarks/results/baseline-estimates.md) | 이론적 베이스라인 추정값 |
