# FSx for ONTAP 사이징 및 성능 가이드

**🌐 Language:** [日本語](../fsxn-sizing-and-performance.md) | [English](../en/fsxn-sizing-and-performance.md) | **한국어** | [简体中文](../zh-CN/fsxn-sizing-and-performance.md) | [繁體中文](../zh-TW/fsxn-sizing-and-performance.md) | [Français](../fr/fsxn-sizing-and-performance.md) | [Deutsch](../de/fsxn-sizing-and-performance.md) | [Español](../es/fsxn-sizing-and-performance.md)

**작성일**: 2026-05-21  
**상태**: 초안  
**대상**: 인프라 아키텍트, 스토리지 관리자

---

## 개요

이 문서는 Permission-aware RAG 시스템에서 FSx for ONTAP의 사이징 및 성능 설계 가이드라인을 제공합니다. 파일 수, 파일 크기, 접근 빈도, 재동기화 빈도에 따른 구성 권장 사항을 정리합니다.

---

## 규모별 권장 구성

### 소규모 (~10,000 파일) — PoC / 부서 사용

| 항목 | 권장 값 | 비고 |
|------|---------|------|
| FSx 처리량 용량 | 128 MB/s | 최소 구성 |
| SSD 스토리지 용량 | 1,024 GiB | 최소 구성 |
| 용량 풀 티어링 | 활성화 | 비용 최적화 |
| 벡터 스토어 | S3 Vectors | 저비용 (월 수 달러) |
| KB Auto-Sync 간격 | 15분 | 기본값 |
| 초기 인덱싱 시간 | 5~15분 | 문서 크기에 따라 다름 |
| 월간 예상 비용 (FSx만) | ~$300~$500 | 처리량 + SSD |

### 중규모 (10,000~100,000 파일) — 사업부 / 전사 사용

| 항목 | 권장 값 | 비고 |
|------|---------|------|
| FSx 처리량 용량 | 256~512 MB/s | 동시 접근 수 기반 |
| SSD 스토리지 용량 | 2,048~10,240 GiB | 핫 데이터 볼륨 기반 |
| 용량 풀 티어링 | 활성화 | 콜드 데이터 자동 티어링 |
| 벡터 스토어 | S3 Vectors 또는 OpenSearch Serverless | QPS 요구사항에 따라 선택 |
| KB Auto-Sync 간격 | 5~15분 | 업데이트 빈도 기반 |
| 초기 인덱싱 시간 | 30~120분 | 병렬 처리로 단축 가능 |
| 월간 예상 비용 (FSx만) | ~$1,000~$5,000 | 처리량 + SSD + 용량 풀 |

### 대규모 (100,000~1,000,000 파일) — 엔터프라이즈

| 항목 | 권장 값 | 비고 |
|------|---------|------|
| FSx 처리량 용량 | 1,024~4,096 MB/s | Multi-AZ + 고처리량 |
| SSD 스토리지 용량 | 10,240+ GiB | 핫 데이터 볼륨 기반 |
| 용량 풀 티어링 | 활성화 | 대부분의 데이터가 용량 풀에 |
| 벡터 스토어 | OpenSearch Serverless | 높은 QPS, 낮은 지연 시간 |
| KB Auto-Sync 간격 | 증분 동기화 설계 필요 | 전체 스캔은 비현실적 |
| 초기 인덱싱 시간 | 수 시간~1일 | 배치 분할 권장 |
| 월간 예상 비용 (FSx만) | ~$5,000~$30,000+ | 구성에 크게 의존 |

---

## FSx for ONTAP 성능 특성

### 처리량 용량

FSx for ONTAP 처리량 용량은 파일 시스템 레벨에서 구성됩니다.

| 처리량 | 읽기 IOPS (SSD) | 쓰기 IOPS | 네트워크 대역폭 | 사용 사례 |
|--------|-----------------|-----------|----------------|----------|
| 128 MB/s | 6,000 | 1,500 | 최대 600 MB/s | PoC, 소규모 |
| 256 MB/s | 12,000 | 3,000 | 최대 1.2 GB/s | 부서 사용 |
| 512 MB/s | 40,000 | 10,000 | 최대 2.4 GB/s | 전사 |
| 1,024 MB/s | 80,000 | 20,000 | 최대 4.8 GB/s | 대규모 |
| 2,048 MB/s | 160,000 | 40,000 | 최대 9.6 GB/s | 미션 크리티컬 |

> **참고**: Amazon FSx for ONTAP은 최대 72 GB/s 처리량을 지원합니다 (12 HA 페어 구성).

### 스토리지 티어링 (Capacity Pool Tiering)

| 티어 | 특성 | 비용 | 사용 사례 |
|------|------|------|----------|
| SSD | 서브밀리초 지연 시간 | 높음 | 자주 접근하는 파일 |
| Capacity Pool | 수십 밀리초 지연 시간 | 낮음 (~SSD의 1/10) | 아카이브, 비빈번 접근 |

**RAG 시스템 권장 사항**:
- `.metadata.json` 및 자주 검색되는 문서 → SSD 티어
- 아카이브 문서, 이전 버전 → Capacity Pool

**티어링 정책**:
- `auto`: 접근이 없는 기간 후 자동으로 Capacity Pool로 이동 (권장)
- `snapshot-only`: 스냅샷 데이터만 Capacity Pool로 이동
- `all`: 모든 데이터를 Capacity Pool로 이동 (비용 우선)
- `none`: 모든 데이터를 SSD에 유지 (성능 우선)

---

## S3 Access Point 고려사항

### 성능 특성

FSx for ONTAP의 S3 Access Point는 FSx 볼륨의 파일을 S3 호환 인터페이스로 노출합니다.

| 작업 | 지연 시간 | 처리량 | 비고 |
|------|-----------|--------|------|
| ListObjectsV2 | 수백 밀리초 | — | 파일 수에 비례 |
| GetObject (소형 파일) | 수십~수백 밀리초 | — | SSD 티어의 경우 |
| GetObject (대형 파일) | 파일 크기에 비례 | FSx 처리량에 의존 | 스트리밍 |
| HeadObject | 수십 밀리초 | — | 메타데이터만 |

### Bedrock KB 동기화 시 부하

KB 동기화(StartIngestionJob) 시 Bedrock은 S3 Access Point를 통해 모든 문서를 읽습니다.

| 문서 수 | 동기화 시 읽기 부하 | 권장 처리량 |
|---------|-------------------|------------|
| ~1,000 | 낮음 (수 GB) | 128 MB/s로 충분 |
| ~10,000 | 중간 (수십 GB) | 256 MB/s 권장 |
| ~100,000 | 높음 (수백 GB) | 512 MB/s 이상 권장 |

### 이중 인증 레이어

S3 Access Point를 통한 접근은 2단계 인증이 필요합니다:

1. **IAM 인증**: S3 Access Point 정책 + IAM ID 기반 정책
2. **파일 시스템 인증**: NTFS ACL (Windows 사용자 매핑)

```
Bedrock KB Role → S3 Access Point Policy (IAM) → FSx NTFS ACL (File System)
                   ↓                                ↓
                   IAM Allow                        ACL Allow
                   ↓                                ↓
                   Both Allow → Access Granted
```

---

## 벡터 스토어 선택 기준

### S3 Vectors vs OpenSearch Serverless

| 측면 | S3 Vectors | OpenSearch Serverless |
|------|-----------|---------------------|
| 비용 (소규모) | 월 수 달러 | $700+/월 (최소 2 OCU) |
| 비용 (대규모) | 벡터 수에 비례 | OCU 수에 비례 |
| 쿼리 지연 시간 | 콜드: 1초 미만, 웜: ~100ms | 항상 ~50ms |
| 최대 벡터 수 | 10,000 인덱스/버킷 | 사실상 무제한 |
| 메타데이터 필터 | 2KB/벡터 (필터링 가능) | 완화된 제한 |
| 확장성 | 자동 | 수동/자동 OCU 스케일링 |
| 운영 오버헤드 | 거의 제로 | OCU 모니터링 필요 |
| 내보내기 | → OpenSearch Serverless (원클릭) | — |

### 선택 플로우차트

```
동시 사용자 < 10 AND 문서 수 < 10,000?
  → 예: S3 Vectors (비용 우선)
  → 아니오:
    지연 시간 요구사항 < 100ms?
      → 예: OpenSearch Serverless
      → 아니오:
        월간 예산 < $1,000?
          → 예: S3 Vectors (지연 시간 허용 가능)
          → 아니오: OpenSearch Serverless
```

### 마이그레이션 경로

S3 Vectors → OpenSearch Serverless 마이그레이션은 콘솔에서 원클릭 내보내기로 수행할 수 있습니다 (~15분 소요). 역방향 마이그레이션은 KB 재동기화로 달성합니다.

---

## 초기 인덱싱 설계

### 권장 접근 방식

| 문서 수 | 방법 | 비고 |
|---------|------|------|
| ~1,000 | 배치 KB 동기화 | 단일 `StartIngestionJob`으로 완료 |
| ~10,000 | 배치 KB 동기화 | 동기화 완료 대기 (30~60분) |
| ~100,000 | 배치 분할 | 데이터 소스를 분할하여 증분 동기화 |
| 100,000+ | 점진적 수집 | 폴더별 수집 → 동기화 반복 |

### 초기 인덱싱 고려사항

1. **임시 FSx 처리량 증가**: 초기 인덱싱 시 읽기 부하가 높으므로 처리량 용량을 임시로 증가시키는 것을 고려
2. **S3 Access Point 동시 연결**: Bedrock KB는 파일을 병렬로 읽으므로 FSx 동시 연결 제한에 주의
3. **`.metadata.json` 사전 준비**: 동기화 시작 전 모든 문서에 `.metadata.json`이 있는지 확인
4. **동기화 중 파일 변경**: 동기화 중 파일이 수정되면 불일치가 발생할 수 있음. 초기 동기화 중 변경 동결 권장

---

## 증분 동기화 설계

### KB Auto-Sync 동작

`enableKbAutoSync=true`로 활성화되는 증분 동기화 메커니즘:

```
EventBridge Scheduler (5~15분 간격)
  → Lambda: S3 AP에서 ListObjectsV2로 파일 목록 가져오기
  → DynamoDB: 이전 인벤토리와 비교
  → 변경 감지 시에만: StartIngestionJob 실행
  → IN_PROGRESS 작업이 있으면: 건너뛰기 (중복 제거)
```

### 변경 감지 메커니즘

| 감지 대상 | 방법 | 비고 |
|-----------|------|------|
| 새 파일 | LastModified 비교 | DynamoDB 인벤토리에 없는 키 |
| 업데이트된 파일 | ETag / LastModified 비교 | 값이 변경된 키 |
| 삭제된 파일 | 인벤토리 차이 | DynamoDB에는 있지만 S3 AP에는 없는 키 |

### 대규모 증분 동기화 과제

| 파일 수 | ListObjectsV2 소요 시간 | 대응책 |
|---------|------------------------|--------|
| ~10,000 | 수 초 | 문제 없음 |
| ~100,000 | 수십 초 | Lambda 타임아웃 연장 (15분) |
| 100,000+ | 수 분 이상 | 접두사 분할, Step Functions |

---

## QoS (Quality of Service) 설계

여러 테넌트 또는 워크로드가 FSx를 공유할 때 QoS 정책으로 성능을 제어할 수 있습니다.

### 권장 QoS 설정

| 워크로드 | 우선순위 | IOPS 제한 | 처리량 제한 |
|----------|----------|-----------|------------|
| RAG 검색 (S3 AP 경유) | 높음 | 무제한 | 무제한 |
| KB 동기화 (배치) | 중간 | 5,000 IOPS | 100 MB/s |
| 사용자 CIFS/SMB 접근 | 높음 | 무제한 | 무제한 |
| 백업 / SnapMirror | 낮음 | 2,000 IOPS | 50 MB/s |

### QoS 정책 적용

```bash
# ONTAP CLI를 통한 QoS 정책 그룹 생성
qos policy-group create -policy-group kb-sync-limit \
  -vserver svm1 -max-throughput 100MB/s -min-throughput 0

# 볼륨에 QoS 정책 적용
volume modify -vserver svm1 -volume kb_data \
  -qos-policy-group kb-sync-limit
```

---

## 용량 모니터링 및 자동 확장

### 모니터링 지표

| 지표 | 임계값 | 조치 |
|------|--------|------|
| SSD 사용률 | > 80% | 용량 확장 또는 티어링 정책 검토 |
| Capacity Pool 사용률 | > 90% | 용량 확장 |
| IOPS 사용률 | > 80% | 처리량 용량 증가 |
| 네트워크 대역폭 사용률 | > 70% | 처리량 용량 증가 |

### 자동 확장 (FSx ONTAP Ops)

`automation/fsxn-ops/`에 포함된 용량 모니터링 Lambda가 자동 확장을 수행합니다:

- EventBridge를 통해 5분마다 볼륨 사용률 모니터링
- 임계값 초과 시 자동으로 볼륨 크기 확장
- Capacity Guardrails (일일 제한, 쿨다운 기간)로 과도한 확장 방지
- CloudWatch Dashboard로 확장 이력 시각화

---

## 비용 최적화 팁

### 1. Capacity Pool Tiering 활용

RAG 검색 대상 문서의 대부분은 임베딩된 후 거의 접근되지 않습니다. 티어링 정책을 `auto`로 설정하여 비빈번 접근 데이터를 저비용 티어로 자동 이동합니다.

### 2. 처리량 용량 적정화

초기 인덱싱 후 읽기 부하가 크게 감소합니다. 초기에는 높은 처리량으로 동기화하고, 운영 단계에서는 처리량을 줄여 비용을 절감합니다.

```bash
# 처리량 용량 변경 (다운타임 없음)
aws fsx update-file-system \
  --file-system-id fs-0123456789abcdef0 \
  --ontap-configuration ThroughputCapacity=128
```

### 3. S3 Vectors 활용

소~중규모 환경에서는 S3 Vectors(월 수 달러)를 사용하여 OpenSearch Serverless 비용($700+/월)을 피합니다. 성능 요구사항이 증가하면 원클릭 내보내기가 가능합니다.

---

## 관련 문서

| 문서 | 설명 |
|------|------|
| [permission-consistency.md](permission-consistency.md) | 권한 변경 일관성 모델 |
| [s3-vectors-sid-architecture-guide.md](s3-vectors-sid-architecture-guide.md) | S3 Vectors + SID 아키텍처 |
| [stack-architecture-comparison.md](stack-architecture-comparison.md) | 3구성 비교 |
| [automation/fsxn-ops/README.md](../automation/fsxn-ops/README.md) | FSx ONTAP 운영 자동화 |
