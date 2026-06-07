# 운용 Runbook

**🌐 언어:** [日本語](../operations-runbook.md) | [English](../en/operations-runbook.md) | **한국어**

**작성일**: 2026-06-08  
**상태**: 운용 중  
**대상**: 운용 담당자, 개발자, 파트너

---

## 개요

Permission-aware RAG 시스템의 일상 운용, 검증, 트러블슈팅 절차를 통합한 Runbook입니다. 배포 검증에서 얻은 지식을 재현 가능한 절차로 체계화했습니다.

---

## 1. ONTAP 버전 확인

### 배경

S3 Access Points는 ONTAP 9.14.1 이상이 필요합니다. FSx for ONTAP AWS API(`describe-file-systems`)는 버전 정보를 반환하지 않으므로, ONTAP REST API에 직접 접근해야 합니다.

### 사전 조건

- FSx Management 엔드포인트 IP (예: `10.0.3.72`)
- `fsxadmin` 비밀번호 (Secrets Manager에 저장)
- 동일 VPC 내 SSM 지원 인스턴스 (Management 엔드포인트는 Private IP 전용)

### 절차

```bash
# Step 1: Retrieve fsxadmin password from Secrets Manager
FSX_PASS=$(aws secretsmanager get-secret-value \
  --secret-id fsx-ontap-fsxadmin-credentials \
  --region ap-northeast-1 \
  --query SecretString --output text \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['password'])")

# Step 2: Access ONTAP REST API from instance in same VPC
INSTANCE_ID="<SSM-enabled-instance-id>"
MGMT_IP="10.0.3.72"

CMD_ID=$(aws ssm send-command \
  --instance-ids $INSTANCE_ID \
  --document-name "AWS-RunShellScript" \
  --parameters "commands=[\"curl -sk -u 'fsxadmin:${FSX_PASS}' 'https://${MGMT_IP}/api/cluster?fields=version'\"]" \
  --region ap-northeast-1 \
  --query 'Command.CommandId' --output text)

# Step 3: Get results (wait 5-10 seconds)
sleep 5
aws ssm get-command-invocation \
  --command-id $CMD_ID \
  --instance-id $INSTANCE_ID \
  --region ap-northeast-1 \
  --query 'StandardOutputContent' --output text | python3 -m json.tool
```

### 예상 출력

```json
{
  "version": {
    "full": "NetApp Release 9.17.1P6: Wed Mar 25 15:38:10 UTC 2026",
    "generation": 9,
    "major": 17,
    "minor": 1
  }
}
```

### 참고 사항

- Management 엔드포인트 Security Group에서 HTTPS(443) 인바운드를 허용해야 합니다
- SSM 인스턴스 IAM 역할에는 `secretsmanager:GetSecretValue` 권한이 필요하지 않습니다 (비밀번호는 로컬에서 가져와 SSM 명령에 포함)
- `curl -sk`: `-s` (사일런트), `-k` (자체 서명 인증서 허용)

---

## 2. Industry-Packs 데모 데이터 수집

### 배경

7개 업종 × 5개 문서 = 35개 문서 + 35개 메타데이터 파일로 구성된 업종별 Permission-aware RAG 데모 데이터입니다.

### 절차

```bash
S3AP_ALIAS="<S3 AP Alias>"
KB_ID="<Knowledge Base ID>"
DS_ID="<DataSource ID>"

# Step 1: Upload industry-packs via S3 AP
aws s3 sync demo-data/industry-packs/ \
  "s3://${S3AP_ALIAS}/industry-packs/" \
  --region ap-northeast-1 \
  --exclude "README.md" --exclude "DISCLAIMER.md"

# Step 2: Verify upload
aws s3 ls "s3://${S3AP_ALIAS}/industry-packs/" --recursive --region ap-northeast-1 | wc -l
# Expected: 70 files

# Step 3: Trigger KB sync (ingestion)
JOB_ID=$(aws bedrock-agent start-ingestion-job \
  --knowledge-base-id $KB_ID \
  --data-source-id $DS_ID \
  --region ap-northeast-1 \
  --query 'ingestionJob.ingestionJobId' --output text)

# Step 4: Wait for completion
for i in $(seq 1 60); do
  sleep 10
  STATUS=$(aws bedrock-agent get-ingestion-job \
    --knowledge-base-id $KB_ID --data-source-id $DS_ID \
    --ingestion-job-id $JOB_ID --region ap-northeast-1 \
    --query 'ingestionJob.status' --output text)
  echo "[$i] $STATUS"
  if [ "$STATUS" = "COMPLETE" ] || [ "$STATUS" = "FAILED" ]; then break; fi
done
```

### 업종 SID 매핑

| 업종 | 폴더 | SID (Domain Admins 외) |
|------|------|----------------------|
| 건설 | `construction/` | `-8100` |
| 교육 | `education/` | `-2200` |
| 공공기관 | `government/` | `-2100` |
| 의료 | `healthcare/` | `-2200` |
| 보험 | `insurance/` | `-8200` |
| 법률 | `legal/` | `-8300` |
| 제조 | `manufacturing/` | `-2300` |

---

## 3. WebApp Docker 빌드 & 배포

### 배경

소스 코드 변경 후, Docker 레이어 캐시가 이전 소스를 재사용합니다. 기본적으로 `--no-cache`를 사용하면 이 문제가 해결됩니다.

### 권장 절차

```bash
# Use the local script (development/ is gitignored)
./development/scripts/deploy-webapp.sh

# Default: builds with --no-cache
# To use cache: ./development/scripts/deploy-webapp.sh --use-cache
```

### 트러블슈팅: 변경 사항 미반영

| 원인 | 확인 방법 | 해결 방법 |
|------|----------|----------|
| Docker 레이어 캐시 | `docker images` 타임스탬프 | `--no-cache`로 재빌드 |
| ECR `latest` 태그 미갱신 | `aws ecr describe-images` digest | 명시적 태그 사용 |
| Lambda 업데이트 진행 중 | `get-function` LastUpdateStatus | `wait function-updated` |
| CloudFront 캐시 | 브라우저 DevTools 네트워크 탭 | `create-invalidation` |
| `.next` 캐시 | `docker/nextjs/.next/` 존재 여부 | `rm -rf docker/nextjs/.next` 후 재빌드 |

---

## 4. Permission Filter 디버그

### 검증 절차

```bash
# Check user SIDs in DynamoDB
aws dynamodb get-item \
  --table-name "<user-access-table>" \
  --key '{"userId":{"S":"admin@example.com"}}' \
  --region ap-northeast-1

# Retrieve document metadata from KB
aws bedrock-agent-runtime retrieve \
  --knowledge-base-id $KB_ID \
  --region ap-northeast-1 \
  --retrieval-query '{"text":"test query"}' \
  --retrieval-configuration '{"vectorSearchConfiguration":{"numberOfResults":5}}' \
  --query 'retrievalResults[].metadata.allowed_group_sids'
```

### 메타데이터 형식 차이

| 형식 | 예시 | 파싱 방법 |
|------|------|----------|
| 배열 | `["S-1-1-0", "S-1-5-21-xxx-512"]` | 직접 사용 |
| 쉼표 구분 문자열 | `"S-1-1-0,S-1-5-21-xxx-512"` | `.split(',')` |
| JSON 문자열 | `"[\"S-1-1-0\"]"` | `JSON.parse()` |
| 단일 값 | `"S-1-1-0"` | `[value]` |

---

## 5. Prompt Caching 검증

### 사전 조건

- **Anthropic Claude 모델 전용** (Nova, OpenAI 미지원)
- UI에서 Claude Sonnet 4.6 또는 Opus 4.8 선택
- Bedrock Prompt Cache TTL: 5분 (ephemeral)

### 확인 절차

```bash
# Check CloudWatch Logs for cache hits
aws logs filter-log-events \
  --log-group-name "/aws/lambda/<webapp-function>" \
  --filter-pattern '"Cache hit"' \
  --start-time $(date -u -d '10 minutes ago' +%s000) \
  --region ap-northeast-1
```

### 캐시가 동작하지 않는 경우

| 원인 | 확인 방법 |
|------|----------|
| Nova / OpenAI 모델 사용 중 | 응답의 `modelId` 확인 |
| 시스템 프롬프트 < 2048자 | `prompt-templates.ts` 크기 확인 |
| 쿼리 간격 > 5분 | CloudWatch 로그 타임스탬프 확인 |
| 다른 사용자 세션 | Prompt Cache는 사용자×모델 단위 |

---

## 6. 전체 배포 검증 체크리스트

```bash
# === Basic Operation ===
# [ ] CDK deploy all stacks success
# [ ] Lambda update confirmed
# [ ] CloudFront health check

# === Permission-Aware RAG ===
# [ ] KB Retrieve (admin SID — full access)
# [ ] KB Retrieve (regular user SID — restricted)
# [ ] Fail-Closed (no metadata → access denied)

# === Model & Routing ===
# [ ] Default model (Nova 2 Lite) response
# [ ] Claude model Prompt Caching
# [ ] Smart Routing Auto Mode

# === UI/UX ===
# [ ] Sign-in page
# [ ] Chat input & response
# [ ] Citation display
# [ ] Permission badge
# [ ] Model indicator

# === Audit & Security ===
# [ ] CloudWatch Logs output
# [ ] DynamoDB user access table
# [ ] EMF metrics (RAG/TokenUsage, SmartRouting)
```

---

## 관련 문서

- [Deployment Troubleshooting](../deployment-troubleshooting.md) — 오류별 해결 방법
- [Production Readiness Checklist](../production-readiness-checklist.md) — 운용 전 요건
- [Cost Estimation Worksheet](../cost-estimation-worksheet.md) — 월간 비용 견적
- [metadata-json-schema](../metadata-json-schema.md) — .metadata.json 정식 사양
