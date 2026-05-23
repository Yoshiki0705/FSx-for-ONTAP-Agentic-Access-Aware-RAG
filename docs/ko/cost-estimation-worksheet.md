# 비용 추정 워크시트

**🌐 Language:** [日本語](../cost-estimation-worksheet.md) | [English](../en/cost-estimation-worksheet.md) | **한국어** | [简体中文](../zh-CN/cost-estimation-worksheet.md) | [繁體中文](../zh-TW/cost-estimation-worksheet.md) | [Français](../fr/cost-estimation-worksheet.md) | [Deutsch](../de/cost-estimation-worksheet.md) | [Español](../es/cost-estimation-worksheet.md)

**작성일**: 2026-05-23  
**상태**: 초안  
**대상**: 프로젝트 매니저, 파트너 제안 담당자, 예산 수립자

> **⚠️ 참고**: 본 워크시트의 요금은 2026년 5월 기준 ap-northeast-1 리전의 공개 요금에 기반한 참고값입니다. 실제 비용은 리전, 사용량, 할인, 요금 개정에 따라 변동됩니다. 최신 요금은 [AWS Pricing](https://aws.amazon.com/pricing/)을 참조하세요.

---

## 입력 파라미터

아래 값을 입력하여 월간 비용을 추정하세요.

| 파라미터 | 값 | 비고 |
|---------|-----|------|
| 문서 수 | _____ 건 | FSx 볼륨의 파일 수 |
| 평균 문서 크기 | _____ KB | 텍스트 환산 |
| 일일 쿼리 수 | _____ 회/일 | 전체 사용자 합계 |
| 동시 사용자 수 | _____ 명 | 피크 시 |
| 등록 사용자 수 | _____ 명 | Cognito User Pool |
| KB 동기화 빈도 | _____ 회/일 | Auto-Sync 간격에서 산출 |
| Agent 모드 사용률 | _____ % | 전체 쿼리 중 Agent 사용 비율 |
| 가용성 요건 | Single-AZ / Multi-AZ | FSx 구성 |

---

## 비용 계산식

### 1. FSx for ONTAP

```
월액 = throughput 요금 + SSD 요금 + Capacity Pool 요금 + 백업 요금

throughput 요금:
  128 MB/s: ~$210/월
  256 MB/s: ~$420/월
  512 MB/s: ~$840/월
  1,024 MB/s: ~$1,680/월

SSD 요금: $0.125/GiB/월 × SSD 용량 (GiB)
Capacity Pool 요금: $0.0125/GiB/월 × Capacity Pool 사용량 (GiB)
백업 요금: $0.025/GiB/월 × 백업 용량 (GiB)

Multi-AZ의 경우: throughput + SSD 요금이 약 2배
```

**계산 예시**:
- 128 MB/s + 1 TiB SSD + 500 GiB CP (Single-AZ): $210 + $128 + $6.25 = **~$344/월**
- 512 MB/s + 5 TiB SSD + 2 TiB CP (Multi-AZ): $1,680 + $640 + $25 = **~$2,345/월**

### 2. 벡터 스토어

```
S3 Vectors:
  스토리지: $0.023/GB/월 × 벡터 데이터 크기
  요청: $0.005/1,000 PUT + $0.0004/1,000 GET
  추정: 문서 10,000건 → ~$5/월

OpenSearch Serverless:
  OCU: $0.24/OCU/시간 × 24 × 30 = $172.80/OCU/월
  최소 2 OCU (검색 + 인덱스): ~$346/월
  권장 4 OCU: ~$691/월
```

### 3. Bedrock (Embedding)

```
Titan Embed Text v2: $0.0001/1,000 tokens

초기 Embedding:
  = 문서 수 × 평균 크기(KB) × 1,000 / 4 × $0.0001/1K
  예: 10,000건 × 10 KB × 250 tokens/KB × $0.0001/1K = $2.50

월간 차분 Embedding:
  = 변경 문서 수 × 평균 크기 × $0.0001/1K
  예: 500건/월 × 10 KB × 250 tokens/KB × $0.0001/1K = $0.13
```

### 4. Bedrock (생성 모델)

```
Smart Routing 분포 (기본 가정):
  Simple (Haiku): 60% → $0.001/query
  Complex (Sonnet): 30% → $0.01/query
  Full-context (Opus): 10% → $0.10/query

가중 평균 비용/쿼리:
  = 0.6 × $0.001 + 0.3 × $0.01 + 0.1 × $0.10
  = $0.0006 + $0.003 + $0.01
  = ~$0.014/query

월액:
  = 일일 쿼리 수 × 30 × $0.014
  예: 100 queries/일 × 30 × $0.014 = $42/월
  예: 1,000 queries/일 × 30 × $0.014 = $420/월
```

### 5. Lambda

```
WebApp Lambda:
  요청: $0.20/100만 요청
  컴퓨팅: $0.0000166667/GB-초
  메모리: 1,024 MB, 평균 실행 시간: 3초
  
  월액 = 요청 수 × (메모리GB × 실행초 × $0.0000166667 + $0.0000002)
  예: 100,000 req/월 × (1 × 3 × $0.0000166667 + $0.0000002) = ~$5/월

동기화 Lambda (KB Auto-Sync, AD Sync):
  5분 간격 × 30일 = 8,640회/월
  128 MB × 5초 = ~$0.60/월
```

### 6. 기타

```
CloudFront: $0.114/GB (일본) × 전송량
  예: 10 GB/월 = $1.14/월

WAF: $5/WebACL + $1/규칙 × 6 + $0.60/100만 요청
  기본: $11/월 + 요청 종량

DynamoDB (온디맨드):
  쓰기: $1.25/100만 WRU
  읽기: $0.25/100만 RRU
  스토리지: $0.25/GB/월
  예: ~$5/월 (소규모)

Cognito:
  처음 50,000 MAU: 무료
  50,001–100,000: $0.0055/MAU
  예: 100 MAU = $0 (무료 티어 내)

CloudWatch:
  로그 수집: $0.76/GB
  로그 스토리지: $0.033/GB/월
  메트릭: $0.30/메트릭/월 (처음 10,000)
  예: ~$10–$30/월
```

---

## 구성별 월간 비용 추정 템플릿

### 템플릿 A: 소규모 PoC

| 리소스 | 구성 | 월액 |
|--------|------|------|
| FSx for ONTAP | 128 MB/s, 1 TiB SSD, Single-AZ | $344 |
| S3 Vectors | ~10,000 벡터 | $5 |
| Bedrock Embedding | 초기 + 차분 | $3 |
| Bedrock 생성 | 100 queries/일, Smart Routing | $42 |
| Lambda | WebApp + Sync | $6 |
| CloudFront + WAF | 기본 | $15 |
| DynamoDB | 온디맨드 | $5 |
| Cognito | ~50 MAU | $0 |
| CloudWatch | 기본 | $10 |
| **합계** | | **~$430/월** |

### 템플릿 B: 중규모 프로덕션

| 리소스 | 구성 | 월액 |
|--------|------|------|
| FSx for ONTAP | 512 MB/s, 5 TiB SSD, Multi-AZ | $2,345 |
| OpenSearch Serverless | 4 OCU | $691 |
| Bedrock Embedding | 정기 동기화 | $10 |
| Bedrock 생성 | 1,000 queries/일, Smart Routing | $420 |
| Lambda | WebApp + Sync + 모니터링 | $30 |
| CloudFront + WAF | 프로덕션 트래픽 | $50 |
| DynamoDB | 프로비저닝 | $30 |
| Cognito | ~500 MAU | $0 |
| CloudWatch | 로그 + 메트릭 + 알람 | $50 |
| **합계** | | **~$3,626/월** |

### 템플릿 C: 대규모 엔터프라이즈

| 리소스 | 구성 | 월액 |
|--------|------|------|
| FSx for ONTAP | 1,024 MB/s, 10 TiB SSD, Multi-AZ | $4,480 |
| OpenSearch Serverless | 8 OCU | $1,382 |
| Bedrock Embedding | 대규모 동기화 | $50 |
| Bedrock 생성 | 5,000 queries/일, Smart Routing | $2,100 |
| Lambda | 전체 기능 | $100 |
| CloudFront + WAF | 고트래픽 | $200 |
| DynamoDB | 프로비저닝 + DAX | $100 |
| Cognito | ~2,000 MAU | $0 |
| CloudWatch | 전체 모니터링 | $100 |
| **합계** | | **~$8,512/월** |

---

## 비용 최적화 포인트

| 방법 | 절감 효과 | 적용 조건 |
|------|---------|---------|
| S3 Vectors (AOSS 대신) | -$700/월 | QPS < 10, 레이턴시 허용 |
| Smart Routing (Haiku 우선) | -30~50% | 간단한 질문이 많은 경우 |
| Capacity Pool Tiering | -50~80% (스토리지) | 접근 빈도가 낮은 데이터가 많은 경우 |
| throughput 축소 (운영 단계) | -50% | 초기 인덱싱 완료 후 |
| Savings Plans (Lambda) | -17% | 1년 커밋 |
| Reserved Capacity (AOSS) | 문의 필요 | 장기 사용 확정 시 |

---

## 관련 문서

| 문서 | 내용 |
|------|------|
| [fsxn-sizing-and-performance.md](../fsxn-sizing-and-performance.md) | FSx for ONTAP 성능 및 용량 설계 |
| [partner-deployment-patterns.md](../partner-deployment-patterns.md) | 파트너 배포 패턴 (비용 비교 포함) |
| [evaluation.md](../evaluation.md) | RAG / Agent 평가 메트릭 |
