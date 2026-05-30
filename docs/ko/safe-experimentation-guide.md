# 안전한 실험 가이드

**🌐 Language:** [日本語](../safe-experimentation-guide.md) | [English](../en/safe-experimentation-guide.md) | **한국어** | [简体中文](../zh-CN/safe-experimentation-guide.md) | [繁體中文](../zh-TW/safe-experimentation-guide.md) | [Français](../fr/safe-experimentation-guide.md) | [Deutsch](../de/safe-experimentation-guide.md) | [Español](../es/safe-experimentation-guide.md)

**작성일**: 2026-05-21  
**상태**: 초안  
**대상**: PoC 사용자, 개발자, 평가자

---

## 개요

이 문서는 Permission-aware RAG 시스템을 안전하게 실험하기 위한 범위 정의, 금지 사항, 롤백 절차를 제공합니다. "Responsible AI 정책과 보안의 경계 내에서 시행착오할 수 있는 환경"을 명확히 합니다.

---

## 안전한 실험 범위

### ✅ 권장: 데모 데이터로만 실험

| 작업 | 위험도 | 비고 |
|------|--------|------|
| 데모 데이터로 검색 테스트 | 없음 | 번들된 샘플 데이터로 동작 확인 |
| 사용자 전환을 통한 권한 확인 | 없음 | admin / user 간 검색 결과 차이 확인 |
| Agent 모드 실험 | 없음 | Agent Directory에서 Agent 생성 및 테스트 |
| UI 커스터마이징 | 없음 | Next.js 소스 변경 |
| CDK 매개변수 변경 | 낮음 | `cdk.context.json` 변경 → 재배포 |
| 새 문서 추가 | 낮음 | 데모 데이터 폴더에 추가 |
| Guardrails 정책 조정 | 낮음 | `guardrailsConfig` 변경 |
| Smart Routing ON/OFF | 없음 | 사이드바 토글 |
| 모델 선택 변경 | 낮음 | 비용 변동 가능 |
| 음성 채팅 실험 | 낮음 | `enableVoiceChat=true`로 활성화 |

### ⚠️ 주의: 실제 데이터 수집 전 체크리스트

실제 비즈니스 데이터를 수집하기 전에 다음을 확인하십시오:

- [ ] **데이터 분류 완료**: 수집할 데이터의 기밀 수준이 분류됨
- [ ] **PII 확인**: 개인정보가 포함된 경우 마스킹 또는 승인 완료
- [ ] **권한 설계 확인**: `.metadata.json`의 `allowed_group_sids`가 올바르게 구성됨
- [ ] **감사 로깅 활성화**: CloudWatch Logs / CloudTrail이 활성화됨
- [ ] **접근 제한 확인**: WAF / Geo 제한 / IP 제한이 적절히 구성됨
- [ ] **백업 확인**: FSx 자동 백업이 활성화됨
- [ ] **사용자 통지**: PoC 참가자에게 데이터 처리 규칙이 안내됨
- [ ] **데이터 삭제 절차 확인**: PoC 완료 후 데이터 삭제 절차가 확인됨

### ❌ 금지 사항

| 금지 사항 | 이유 | 대안 |
|-----------|------|------|
| 프로덕션 AD에 직접 연결 (PoC 단계) | 프로덕션 환경 영향 위험 | 테스트 AD / Cognito 이메일 인증 사용 |
| PII 미분류 데이터 수집 | 개인정보 유출 위험 | PII 스캔 후 수집 |
| 감사 로깅 없이 기밀 데이터 사용 | 컴플라이언스 위반 | 감사 로그 활성화 후 수집 |
| 암호화 없이 기밀 데이터 저장 | 데이터 유출 위험 | `enableKmsEncryption=true` 설정 |
| 공용 인터넷에서 접근 허용 | 비인가 접근 위험 | IP 제한 / VPN 사용 |
| 프로덕션 계정에서 PoC 실행 | 프로덕션 환경 영향 | 샌드박스 계정 사용 |
| Guardrails 비활성화 상태에서 기밀 데이터 사용 | 부적절한 답변 생성 위험 | `enableGuardrails=true` 설정 |

---

## 데모 데이터로만 실험하는 절차

### 단계 1: 최소 구성으로 배포

```bash
# 최소 cdk.context.json
cat > cdk.context.json << 'EOF'
{
  "projectName": "rag-poc",
  "environment": "poc",
  "imageTag": "latest",
  "allowedIps": ["YOUR_IP/32"],
  "allowedCountries": ["JP"]
}
EOF

# 배포
npx cdk deploy --all --require-approval never

# 테스트 데이터 + 사용자 생성
bash demo-data/scripts/post-deploy-setup.sh
```

### 단계 2: 동작 확인

```bash
# CloudFront URL 가져오기
URL=$(aws cloudformation describe-stacks \
  --stack-name rag-poc-poc-WebApp \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontUrl`].OutputValue' \
  --output text)

echo "접근 URL: $URL"
```

### 단계 3: 권한 필터링 확인

1. `admin@example.com`으로 로그인 → 모든 문서 검색 가능
2. `user@example.com`으로 로그인 → 공개 문서만 검색 가능
3. 동일한 질문에 대해 다른 답변이 반환되는지 확인

### 단계 4: 평가

[evaluation.md](evaluation.md)의 평가 템플릿을 사용하여 PoC 평가를 수행합니다.

---

## 실제 데이터 수집 절차 (체크리스트 완료 후)

### 단계 1: 데이터 준비

```bash
# 1. 문서 분류
# 각 문서에 대해 .metadata.json 생성
cat > document.metadata.json << 'EOF'
{
  "metadataAttributes": {
    "allowed_group_sids": ["S-1-5-21-...-512", "S-1-1-0"],
    "access_level": "confidential",
    "doc_type": "report"
  }
}
EOF

# 2. PII 스캔 (권장)
# Amazon Comprehend로 PII 감지
aws comprehend detect-pii-entities \
  --text "$(cat document.txt)" \
  --language-code ja
```

### 단계 2: 데이터 수집

```bash
# FSx 볼륨에 파일 배치 (SMB 경유)
# 또는 S3 버킷 폴백 경로 사용
aws s3 cp ./documents/ s3://rag-poc-poc-kb-data-ACCOUNT_ID/ --recursive
```

### 단계 3: KB 동기화

```bash
# KB 동기화 실행
aws bedrock-agent start-ingestion-job \
  --knowledge-base-id <KB_ID> \
  --data-source-id <DS_ID>

# 동기화 완료 대기
aws bedrock-agent get-ingestion-job \
  --knowledge-base-id <KB_ID> \
  --data-source-id <DS_ID> \
  --ingestion-job-id <JOB_ID>
```

### 단계 4: 권한 테스트

```bash
# 권한 매트릭스 테스트 실행
cd tests/permission-matrix
python3 -m pytest test_permission_scenarios.py -v
```

---

## 롤백 / 환경 삭제 절차

### 부분 롤백 (데이터만 삭제)

```bash
# 1. KB 데이터 소스 동기화 삭제
aws bedrock-agent delete-data-source \
  --knowledge-base-id <KB_ID> \
  --data-source-id <DS_ID>

# 2. S3 버킷 데이터 삭제
aws s3 rm s3://rag-poc-poc-kb-data-ACCOUNT_ID/ --recursive

# 3. DynamoDB 사용자 데이터 삭제
aws dynamodb scan --table-name rag-poc-poc-user-access \
  --projection-expression "userId" \
  | jq -r '.Items[].userId.S' \
  | xargs -I {} aws dynamodb delete-item \
    --table-name rag-poc-poc-user-access \
    --key '{"userId": {"S": "{}"}}'
```

### 완전 삭제 (모든 리소스)

```bash
# 1. S3 버킷 비우기 (버전 관리 활성화 시)
aws s3 rm s3://rag-poc-poc-kb-data-ACCOUNT_ID/ --recursive
aws s3api list-object-versions --bucket rag-poc-poc-kb-data-ACCOUNT_ID \
  | jq -r '.Versions[]? | "--key \(.Key) --version-id \(.VersionId)"' \
  | xargs -I {} aws s3api delete-object --bucket rag-poc-poc-kb-data-ACCOUNT_ID {}

# 2. CDK destroy (모든 스택 삭제)
npx cdk destroy --all --force

# 3. CDK Bootstrap 리소스 삭제 (필요 시)
# ⚠️ 다른 CDK 프로젝트가 있으면 삭제하지 마십시오
# aws cloudformation delete-stack --stack-name CDKToolkit
```

### 비용 정리 확인

```bash
# 잔여 리소스 확인
aws resourcegroupstaggingapi get-resources \
  --tag-filters Key=Project,Values=rag-poc \
  --region ap-northeast-1

# FSx 파일 시스템 확인 (삭제에 시간 소요)
aws fsx describe-file-systems --region ap-northeast-1

# OpenSearch Serverless 컬렉션 확인
aws opensearchserverless list-collections --region ap-northeast-1
```

---

## 문제 해결

### 일반적인 문제와 해결 방법

| 문제 | 원인 | 해결 방법 |
|------|------|-----------|
| 배포에 40분 이상 소요 | FSx for ONTAP 생성에 시간 소요 | 정상. FSx 생성에 20~30분 소요 |
| 검색 결과 0건 | KB 동기화 미완료 또는 데이터 소스 미구성 | `StartIngestionJob` 실행 확인 |
| 모든 사용자에게 동일한 결과 | SID 데이터 미등록 | DynamoDB `user-access` 테이블 확인 |
| Fail-Closed가 모든 것을 거부 | DynamoDB 연결 오류 또는 SID 레코드 없음 | Lambda 로그 확인 |
| Agent가 작동하지 않음 | Agent 미생성 또는 PREPARED 상태가 아님 | Bedrock 콘솔에서 Agent 상태 확인 |
| 예상보다 높은 비용 | OpenSearch Serverless OCU | `vectorStoreType=s3vectors`로 전환 |

### 지원 리소스

| 리소스 | URL |
|--------|-----|
| GitHub Issues | 리포지토리 Issues 탭 |
| AWS 문서 (Bedrock) | https://docs.aws.amazon.com/bedrock/ |
| AWS 문서 (FSx for ONTAP) | https://docs.aws.amazon.com/fsx/latest/ONTAPGuide/ |

---

## 관련 문서

| 문서 | 설명 |
|------|------|
| [evaluation.md](evaluation.md) | RAG / Agent 평가 지표 |
| [production-readiness-checklist.md](production-readiness-checklist.md) | 프로덕션 준비 체크리스트 |
| [governance-and-audit.md](governance-and-audit.md) | 거버넌스 및 감사 설계 |
| [permission-consistency.md](permission-consistency.md) | 권한 변경 일관성 모델 |
