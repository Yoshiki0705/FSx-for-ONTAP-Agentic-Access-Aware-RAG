# 프로덕션 준비 체크리스트

**🌐 Language:** [日本語](../production-readiness-checklist.md) | [English](../en/production-readiness-checklist.md) | **한국어** | [简体中文](../zh-CN/production-readiness-checklist.md) | [繁體中文](../zh-TW/production-readiness-checklist.md) | [Français](../fr/production-readiness-checklist.md) | [Deutsch](../de/production-readiness-checklist.md) | [Español](../es/production-readiness-checklist.md)

**작성일**: 2026-05-21  
**상태**: 초안  
**대상**: PoC → 프로덕션 마이그레이션을 검토하는 팀

---

## 개요

이 문서는 Permission-aware RAG 시스템을 PoC 환경에서 프로덕션 환경으로 마이그레이션할 때 확인해야 할 항목의 체크리스트를 제공합니다.

---

## 성숙도 레벨 정의

| 레벨 | 이름 | 설명 | 대상 |
|-------|------|------|------|
| L1 | 데모 | 번들된 샘플 데이터와 사용자로 동작 확인. 가장 빠른 배포 | 기술 검증, 내부 데모 |
| L2 | PoC | 고객 AD/IdP 연결, 실제 파일 수집, 평가 로그 수집 | 고객 제안, 효과 검증 |
| L3 | 프로덕션 | 멀티 계정, 감사 로그 보존, DR, SLO, 위협 모델, 운영 Runbook | 프로덕션 비즈니스 사용 |

---

## L1 → L2 (데모 → PoC) 체크리스트

### 인증 & ID 페더레이션

- [ ] Cognito User Pool을 고객 IdP에 연결 (OIDC / SAML / LDAP)
- [ ] 테스트 사용자로 SSO 로그인 성공 확인
- [ ] 자동 SID / UID+GID 검색이 작동하는지 확인
- [ ] `authFailureMode`를 `fail-closed`로 설정하고 권한 검색 실패 시 차단 동작 확인

### 데이터 수집

- [ ] FSx for ONTAP 볼륨에 실제 파일(10~100개) 배치
- [ ] `.metadata.json`이 올바르게 생성되는지 확인
- [ ] Bedrock KB 데이터 소스 동기화가 성공적으로 완료되는지 확인
- [ ] 다른 권한을 가진 사용자에 대해 검색 결과가 올바르게 필터링되는지 확인

### 평가

- [ ] 답변 정확도 정성 평가 (10개 이상의 질문)
- [ ] 권한 위반 제로 확인
- [ ] 응답 시간 측정 (P50 / P95 / P99)

---

## L2 → L3 (PoC → 프로덕션) 체크리스트

### 1. 보안

#### 암호화

- [ ] S3 / DynamoDB / FSx에 KMS CMK 암호화 (`enableKmsEncryption=true`)
- [ ] KMS 키 로테이션 활성화
- [ ] TLS 1.2 이상 적용 (CloudFront, ALB, FSx)
- [ ] Secrets Manager로 비밀번호 및 API 키 관리 (`cdk.context.json`에 하드코딩 금지)

#### 네트워크

- [ ] VPC 엔드포인트 활성화 (`enableVpcEndpoints=true`)
  - S3, DynamoDB, Bedrock, Bedrock Agent, CloudWatch Logs, STS
- [ ] 보안 그룹 권한 최소화 (불필요한 인바운드 규칙 제거)
- [ ] NAT Gateway를 통한 아웃바운드 트래픽 제한
- [ ] 적절한 CloudFront Geo 제한 구성

#### WAF

- [ ] 프로덕션 속도 제한 값 설정 (기본값: 2000 req/5min)
- [ ] IP 허용 목록 구성 (내부 IP만)
- [ ] WAF 로그를 S3에 저장 활성화
- [ ] Bot Control 규칙 추가 검토

#### IAM

- [ ] Lambda 실행 역할 권한 최소화
- [ ] Bedrock KB 역할 권한 최소화
- [ ] 교차 계정 접근 제한
- [ ] IAM Access Analyzer로 미사용 권한 감지

### 2. 감사 & 로깅

- [ ] CloudTrail 활성화 (모든 리전, 관리 이벤트 + 데이터 이벤트)
- [ ] CloudWatch Logs 보존 기간 설정 (최소 1년)
- [ ] S3 접근 로깅 활성화
- [ ] DynamoDB Streams를 통한 권한 변경 추적
- [ ] Bedrock 모델 호출 로깅 활성화
- [ ] 감사 로그 변조 방지 (S3 Object Lock / Glacier Vault Lock)
- [ ] RAG 검색 로그 저장 (사용자 ID, 쿼리, 참조 문서, 필터링 결과)

### 3. 가용성 & DR

- [ ] FSx for ONTAP Multi-AZ 구성 확인
- [ ] DynamoDB Point-in-Time Recovery (PITR) 활성화
- [ ] S3 버전 관리 활성화
- [ ] 백업 스케줄 구성 (FSx 자동 백업)
- [ ] RTO / RPO 정의 및 검증
- [ ] DR 리전 선택 및 SnapMirror 복제 설계
- [ ] 수동 페일오버 절차 문서 작성

### 4. 운영

- [ ] CloudWatch 대시보드 구성 (`enableMonitoring=true`)
- [ ] 알림 임계값 설정
  - Lambda 오류율 > 1%
  - Bedrock 지연 시간 P95 > 10s
  - DynamoDB 스로틀링
  - FSx 스토리지 사용률 > 80%
- [ ] 운영 Runbook 작성
  - KB 재동기화 절차
  - 권한 캐시 강제 삭제 절차
  - 긴급 권한 취소 절차
  - 롤백 절차
- [ ] 인시던트 대응 플로우 정의
- [ ] 온콜 체계 수립

### 5. 비용 관리

- [ ] AWS Budgets로 비용 알림 설정
- [ ] 태깅 전략 정의 (Environment, Project, CostCenter)
- [ ] S3 수명 주기 정책 (로그의 Glacier 마이그레이션)
- [ ] 적절한 Lambda 메모리 및 타임아웃 값 설정
- [ ] Bedrock 모델 사용량 모니터링
- [ ] 월간 비용 검토 프로세스 수립

### 6. 확장성

- [ ] DynamoDB 용량 모드 선택 (On-Demand vs Provisioned)
- [ ] Lambda 동시성 제한 구성
- [ ] Bedrock 처리량 확인 (Provisioned Throughput 검토)
- [ ] 적절한 FSx 처리량 용량 설정
- [ ] CloudFront 캐싱 전략 최적화

### 7. 컴플라이언스

- [ ] 데이터 분류 정책 수립 (기밀, 내부, 공개)
- [ ] 개인정보 처리 규칙 정의
- [ ] 데이터 보존 기간 정의
- [ ] 이용약관 및 개인정보 처리방침 준비
- [ ] 산업별 규정 대응 (의료: HIPAA, 금융: FISC, 공공: ISMAP)

### 8. 테스트

- [ ] 권한 매트릭스 테스트 실행 ([tests/permission-matrix/](../tests/permission-matrix/) 참조)
- [ ] 부하 테스트 (예상 동시 사용자의 2배)
- [ ] 보안 테스트 (침투 테스트)
- [ ] DR 테스트 (페일오버 / 페일백)
- [ ] 권한 변경 전파 테스트 (ACL 변경 → 검색 결과 반영)

---

## 프로덕션 배포 전 최종 확인

```bash
# 1. CDK diff로 변경 사항 확인
npx cdk diff --all

# 2. 보안 스캔
npx cdk synth --quiet | cfn-nag

# 3. 테스트 실행
npx jest --no-coverage
cd automation/fsxn-ops && python3 -m pytest tests/ -v

# 4. 배포 (승인 포함)
npx cdk deploy --all --require-approval broadening
```

---

## 관련 문서

| 문서 | 설명 |
|------|------|
| [permission-consistency.md](permission-consistency.md) | 권한 변경 일관성 모델 |
| [governance-and-audit.md](governance-and-audit.md) | 거버넌스 및 감사 설계 |
| [partner-deployment-patterns.md](partner-deployment-patterns.md) | 멀티 테넌트 배포 패턴 |
| [safe-experimentation-guide.md](safe-experimentation-guide.md) | 안전한 실험 가이드 |
| [evaluation.md](evaluation.md) | RAG / Agent 평가 지표 |
