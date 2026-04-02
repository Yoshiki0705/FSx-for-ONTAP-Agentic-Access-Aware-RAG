# CDK 스택 아키텍처 가이드

**🌐 Language:** [日本語](../stack-architecture-comparison.md) | [English](../en/stack-architecture-comparison.md) | **한국어** | [简体中文](../zh-CN/stack-architecture-comparison.md) | [繁體中文](../zh-TW/stack-architecture-comparison.md) | [Français](../fr/stack-architecture-comparison.md) | [Deutsch](../de/stack-architecture-comparison.md) | [Español](../es/stack-architecture-comparison.md)

**최종 업데이트**: 2026-03-31  
**상태**: 데모 스택 계열로 통합, S3 Vectors 통합 검증 완료

---

## 개요

모든 CDK 스택은 `lib/stacks/demo/` 아래에 통합되어 있습니다. 유일한 진입점은 `bin/demo-app.ts`입니다. 선택적 기능은 CDK 컨텍스트 파라미터를 통해 활성화할 수 있습니다.

---

## 기능 비교

| 기능 | 데모 스택 (현재) | CDK 컨텍스트 | 비고 |
|------|-----------------|-------------|------|
| 인증 | Cognito + AD (선택 사항) | `adPassword`, `adDomainName` | AD 미구성 시 Cognito만 사용 |
| 자동 SID 취득 | AD Sync Lambda | `adType=managed\|self-managed` | AD 미구성 시 수동 (`setup-user-access.sh`) |
| NTFS ACL 취득 | Embedding 서버 내 자동 생성 | `ontapMgmtIp`, `ontapSvmUuid` | 미구성 시 수동 `.metadata.json` |
| 권한 필터링 | Next.js API Route 내 (기본값) | `usePermissionFilterLambda=true` | 전용 Lambda로 이전 가능 |
| Bedrock Agent | 동적 Agent 생성 + Action Group | `enableAgent=true` | 카드 클릭 시 카테고리별 Agent 자동 생성 |
| Bedrock Guardrails | 콘텐츠 안전 + PII 보호 | `enableGuardrails=true` | |
| KMS 암호화 | S3 / DynamoDB CMK 암호화 | `enableKmsEncryption=true` | 키 로테이션 활성화 |
| CloudTrail | S3 데이터 접근 + Lambda 감사 | `enableCloudTrail=true` | 90일 보존 |
| VPC Endpoints | S3, DynamoDB, Bedrock 등 | `enableVpcEndpoints=true` | 6개 서비스 지원 |
| Embedding 서버 | FlexCache CIFS 마운트 + 벡터 스토어 직접 쓰기 | `enableEmbeddingServer=true` | S3 AP 사용 불가 시 대체 경로 (AOSS 구성만 해당) |
| 고급 권한 제어 | 시간 기반 접근 제어 + 권한 판정 감사 로그 | `enableAdvancedPermissions=true` | `permission-audit` DynamoDB 테이블 + GSI |

---

## 데이터 수집 경로

| 경로 | 방법 | 활성화 | 사용 사례 |
|------|------|--------|----------|
| 메인 | FSx ONTAP → S3 Access Point → Bedrock KB | `post-deploy-setup.sh` | 표준 볼륨 |
| 대체 | S3 버킷 직접 업로드 → Bedrock KB | `upload-demo-data.sh` | S3 AP 사용 불가 시 |
| 대안 | CIFS 마운트 → Embedding 서버 → 벡터 스토어 직접 쓰기 | `enableEmbeddingServer=true` | FlexCache 볼륨 (AOSS 구성만 해당) |

---

## Bedrock KB Ingestion Job — 할당량 및 설계 고려사항

Bedrock KB Ingestion Job은 문서 검색, 청크 분할, 벡터화, 저장을 처리하는 관리형 서비스입니다. S3 Access Point를 통해 FSx ONTAP에서 직접 데이터를 읽고, 증분 동기화를 통해 변경된 파일만 처리합니다. 커스텀 Embedding 파이프라인(AWS Batch 등)은 필요하지 않습니다.

### 서비스 할당량 (2026년 3월 기준, 모두 조정 불가)

| 할당량 | 값 | 설계 영향 |
|--------|-----|----------|
| 작업당 데이터 크기 | 100GB | 초과 데이터는 처리되지 않음. 100GB를 초과하는 데이터 소스는 여러 데이터 소스로 분할 필요 |
| 파일당 파일 크기 | 50MB | 대용량 PDF는 분할 필요 |
| 작업당 추가/업데이트 파일 수 | 5,000,000 | 일반적인 기업 문서 볼륨에 충분 |
| 작업당 삭제 파일 수 | 5,000,000 | 위와 동일 |
| BDA 파서 사용 시 파일 수 | 1,000 | Bedrock Data Automation 파서 사용 시 제한 |
| FM 파서 사용 시 파일 수 | 1,000 | Foundation Model 파서 사용 시 제한 |
| KB당 데이터 소스 수 | 5 | 여러 볼륨을 개별 데이터 소스로 등록할 때의 상한 |
| 계정당 KB 수 | 100 | 멀티 테넌트 설계 시 고려 사항 |
| 계정당 동시 작업 수 | 5 | 여러 KB의 병렬 동기화 시 제약 |
| KB당 동시 작업 수 | 1 | 동일 KB에 대한 병렬 동기화 불가. 이전 작업 완료 대기 필요 |
| 데이터 소스당 동시 작업 수 | 1 | 위와 동일 |

### 실행 트리거 및 빈도 제약

| 항목 | 값 | 비고 |
|------|-----|------|
| StartIngestionJob API 속도 | 0.1 req/sec (10초에 1회) | **조정 불가**. 고빈도 자동 동기화에 적합하지 않음 |
| 실행 트리거 | 수동 (API/CLI/콘솔) | Bedrock KB 측에 자동 스케줄링 기능 없음 |
| 동기화 방식 | 증분 동기화 | 추가, 변경, 삭제만 처리. 전체 재처리 불필요 |
| 동기화 소요 시간 | 데이터 볼륨에 따라 다름 (수십 초~수 시간) | 소규모 (수십 파일): 30초~2분, 대규모: 수 시간 |

### 자동 동기화 스케줄링

Bedrock KB에는 내장 스케줄 동기화 기능이 없으므로, 필요한 경우 다음 방법으로 정기 동기화를 구현합니다:

```bash
# EventBridge Scheduler를 사용한 정기 실행 (예: 매시간)
aws scheduler create-schedule \
  --name kb-sync-hourly \
  --schedule-expression "rate(1 hour)" \
  --target '{"Arn":"arn:aws:bedrock:ap-northeast-1:ACCOUNT_ID:knowledge-base/KB_ID","RoleArn":"arn:aws:iam::ACCOUNT_ID:role/scheduler-role","Input":"{\"dataSourceId\":\"DS_ID\"}"}' \
  --flexible-time-window '{"Mode":"OFF"}'
```

또는 FSx ONTAP의 파일 변경을 S3 이벤트 알림으로 감지하여 Ingestion Job을 트리거할 수 있습니다. 단, StartIngestionJob API 속도 제한(10초에 1회)에 주의하세요.

### 설계 권장 사항

1. **동기화 빈도**: 실시간 동기화는 불가능합니다. 최소 간격은 10초이며, 실질적으로 15분~1시간을 권장합니다
2. **대규모 데이터**: 100GB를 초과하는 데이터 소스는 여러 FSx ONTAP 볼륨(= 여러 S3 AP = 여러 데이터 소스)으로 분할해야 합니다
3. **병렬 처리**: 동일 KB에 대한 병렬 동기화는 불가능합니다. 여러 데이터 소스를 순차적으로 동기화하세요
4. **오류 처리**: 작업 실패 시 재시도 로직을 구현하세요 (`GetIngestionJob`으로 상태 모니터링)
5. **커스텀 Embedding 파이프라인 불필요**: Bedrock KB가 청크 분할, 벡터화, 저장을 관리하므로 AWS Batch 등의 커스텀 파이프라인은 불필요합니다

---

## CDK 스택 구조 (7개 스택)

| # | 스택 | 필수/선택 | 설명 |
|---|------|----------|------|
| 1 | WafStack | 필수 | CloudFront용 WAF (us-east-1) |
| 2 | NetworkingStack | 필수 | VPC, Subnets, SG |
| 3 | SecurityStack | 필수 | Cognito User Pool |
| 4 | StorageStack | 필수 | FSx ONTAP + SVM + Volume (또는 기존 참조), S3, DynamoDB×2 |
| 5 | AIStack | 필수 | Bedrock KB, S3 Vectors 또는 OpenSearch Serverless, Agent (선택 사항) |
| 6 | WebAppStack | 필수 | Lambda Web Adapter + CloudFront |
| 7 | EmbeddingStack | 선택 | FlexCache CIFS 마운트 + Embedding 서버 |

### 기존 FSx for ONTAP 참조 모드

StorageStack은 `existingFileSystemId`/`existingSvmId`/`existingVolumeId` 파라미터를 사용하여 기존 FSx ONTAP 리소스를 참조할 수 있습니다. 이 경우:
- 새 FSx/SVM/Volume 생성을 건너뜀 (배포 시간 30~40분 단축)
- Managed AD 생성도 건너뜀 (기존 환경의 AD 구성 사용)
- S3 버킷, DynamoDB 테이블, S3 AP 커스텀 리소스는 정상적으로 생성
- `cdk destroy`로 FSx/SVM/Volume이 삭제되지 않음 (CDK 관리 범위 외)

---

## 벡터 스토어 구성 비교

벡터 스토어 구성은 CDK 컨텍스트 파라미터 `vectorStoreType`으로 전환할 수 있습니다. 세 번째 구성(S3 Vectors + AOSS Export)은 S3 Vectors 구성 위에 온디맨드 내보내기를 위한 운영 절차로 제공됩니다.

> **리전 지원**: S3 Vectors는 `ap-northeast-1` (도쿄 리전)에서 사용 가능합니다.

| 항목 | OpenSearch Serverless | S3 Vectors 단독 | S3 Vectors + AOSS Export |
|------|----------------------|-----------------|--------------------------|
| **CDK 파라미터** | `vectorStoreType=opensearch-serverless` | `vectorStoreType=s3vectors` (기본값) | 구성 2 위에 `export-to-opensearch.sh` 실행 |
| **비용** | ~$700/월 (2 OCU 상시 가동) | 수 달러/월 (소규모) | S3 Vectors + AOSS OCU (내보내기 중에만) |
| **지연 시간** | ~10ms | 서브초 (콜드), ~100ms (웜) | ~10ms (내보내기 후 AOSS 검색) |
| **필터링** | 메타데이터 필터 (`$eq`, `$ne`, `$in` 등) | 메타데이터 필터 (`$eq`, `$in`, `$and`, `$or`) | 내보내기 후 AOSS 필터링 |
| **메타데이터 제약** | 제약 없음 | filterable 2KB/벡터 (실질적으로 커스텀 1KB), non-filterable 키 최대 10개 | 내보내기 후 AOSS 제약 적용 |
| **사용 사례** | 고성능이 필요한 프로덕션 환경 | 비용 최적화, 데모, 개발 환경 | 일시적 고성능 수요 |
| **운영 절차** | CDK 배포만 | CDK 배포만 | CDK 배포 후 `export-to-opensearch.sh` 실행. Export IAM 역할 자동 생성 |

> **S3 Vectors 메타데이터 제약**: Bedrock KB + S3 Vectors 사용 시, 커스텀 메타데이터는 실질적으로 1KB 이하로 제한됩니다 (Bedrock KB 내부 메타데이터가 2KB filterable 메타데이터 제한의 ~1KB를 소비). CDK 코드는 2KB 제한을 우회하기 위해 모든 메타데이터를 non-filterable로 설정합니다. SID 필터링은 애플리케이션 측에서 수행되므로 S3 Vectors QueryVectors 필터는 필요하지 않습니다. 자세한 내용은 [docs/s3-vectors-sid-architecture-guide.md](s3-vectors-sid-architecture-guide.md)를 참조하세요.

### 내보내기 관련 참고사항

- 내보내기는 **특정 시점 복사**입니다. S3 Vectors 데이터 업데이트 후 재내보내기가 필요합니다 (지속적 동기화는 수행되지 않음)
- 내보내기 중 AOSS 컬렉션, OSI 파이프라인, IAM 서비스 역할, DLQ S3 버킷이 자동 생성됩니다
- 콘솔의 "Create and use a new service role" 옵션이 IAM 역할을 자동 생성하므로 사전 역할 생성이 필요하지 않습니다
- 내보내기에는 약 15분이 소요됩니다 (AOSS 컬렉션 생성 5분 + 파이프라인 생성 5분 + 데이터 전송 5분)
- OSI 파이프라인은 데이터 전송 완료 후 **자동으로 중지**됩니다 (비용 효율적)
- 파이프라인 중지 후에도 AOSS 컬렉션은 검색 가능한 상태를 유지합니다
- **더 이상 필요하지 않은 AOSS 컬렉션은 수동으로 삭제하세요** (`cdk destroy`로 삭제되지 않음, CDK 관리 범위 외. OCU 과금 계속)

---

## S3 Vectors 구현에서 얻은 교훈 (검증 완료)

다음은 2026-03-29에 ap-northeast-1 (도쿄 리전)에서 실제 배포 검증을 통해 얻은 교훈입니다.

### SDK/API 관련

| 항목 | 교훈 |
|------|------|
| SDK v3 응답 | `CreateVectorBucketCommand`/`CreateIndexCommand` 응답에 `vectorBucketArn`/`indexArn`이 포함되지 않음. `$metadata`만 반환됨. ARN은 `arn:aws:s3vectors:{region}:{account}:bucket/{name}` 패턴으로 구성해야 함 |
| API 명령 이름 | `CreateIndexCommand`/`DeleteIndexCommand`가 올바름. `CreateVectorBucketIndexCommand`는 존재하지 않음 |
| CreateIndex 필수 파라미터 | `dataType: 'float32'`가 필수. 생략 시 유효성 검사 오류 발생 |
| 메타데이터 설계 | 모든 메타데이터 키는 기본적으로 filterable. `metadataConfiguration`은 `nonFilterableMetadataKeys`만 지정. `allowed_group_sids`를 filterable로 만들기 위한 명시적 구성 불필요 |

### Bedrock KB 관련

| 항목 | 교훈 |
|------|------|
| S3VectorsConfiguration | `indexArn`과 `indexName`은 상호 배타적. 둘 다 지정하면 `2 subschemas matched instead of one` 오류 발생. `indexArn`만 사용 |
| IAM 권한 검증 | Bedrock KB는 생성 시 KB Role의 `s3vectors:QueryVectors` 권한을 검증. KB 생성 전에 IAM 정책이 적용되어야 함 |
| 필수 IAM 액션 | 5개 액션 필요: `s3vectors:QueryVectors`, `s3vectors:PutVectors`, `s3vectors:DeleteVectors`, `s3vectors:GetVectors`, `s3vectors:ListVectors` |

### CDK/CloudFormation 관련

| 항목 | 교훈 |
|------|------|
| IAM 정책 리소스 ARN | 커스텀 리소스 `GetAtt` 토큰 대신 명시적 ARN 패턴 사용. 의존성 문제 방지 |
| CloudFormation Hook | 조직 수준의 `AWS::EarlyValidation::ResourceExistenceCheck` Hook이 change-set을 차단하는 경우 `--method=direct`로 우회 가능 |
| 배포 시간 | AI 스택 (S3 Vectors 구성) 배포 시간은 약 83초 (AOSS 구성의 ~5분에 비해 크게 단축) |

---

---

## 향후 확장 옵션

다음 기능은 현재 구현되어 있지 않지만, CDK 컨텍스트 파라미터를 통해 선택적 기능으로 추가할 수 있도록 설계되어 있습니다.

| 기능 | 개요 | 예상 파라미터 |
|------|------|-------------|
| 모니터링 및 알림 | CloudWatch 대시보드 (크로스 스택 메트릭), SNS 알림 (오류율 / 지연 시간 임계값 초과) | `enableMonitoring=true` |
| 고급 권한 제어 | 시간 기반 접근 제어 (업무 시간에만 허용), 지리적 접근 제한 (IP 지오로케이션), DynamoDB 감사 로그 | `enableAdvancedPermissions=true` |

---

## 관련 문서

| 문서 | 내용 |
|------|------|
| [README.md](../README.md) | 배포 절차 및 CDK 컨텍스트 파라미터 목록 |
| [SID-Filtering-Architecture.md](SID-Filtering-Architecture.md) | SID 필터링 설계 및 데이터 수집 경로 상세 |
| [embedding-server-design.md](embedding-server-design.md) | Embedding 서버 설계 (ONTAP ACL 자동 취득 포함) |
| [ui-specification.md](ui-specification.md) | UI 사양 (카드 UI, KB/Agent 모드 전환) |
