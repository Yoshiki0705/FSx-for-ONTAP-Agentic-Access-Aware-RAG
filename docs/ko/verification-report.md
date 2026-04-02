# 검증 가이드

**🌐 Language:** [日本語](../verification-report.md) | [English](../en/verification-report.md) | **한국어** | [简体中文](../zh-CN/verification-report.md) | [繁體中文](../zh-TW/verification-report.md) | [Français](../fr/verification-report.md) | [Deutsch](../de/verification-report.md) | [Español](../es/verification-report.md)

이 문서는 CDK 배포 후 시스템이 올바르게 작동하는지 검증하는 절차를 설명합니다.

---

## 1. CDK 배포 결과 확인

모든 6개 스택이 `CREATE_COMPLETE` 또는 `UPDATE_COMPLETE` 상태인지 확인합니다.

```bash
# projectName에 맞게 프레픽스를 변경 (예: perm-rag-demo)
aws cloudformation list-stacks \
  --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE \
  --query 'StackSummaries[?starts_with(StackName, `perm-rag-demo`)].{Name:StackName,Status:StackStatus}' \
  --output table
```

| 스택 | 리전 | 주요 리소스 |
|------|------|-----------|
| WafStack | us-east-1 | WebACL (6개 규칙), IP Set |
| NetworkingStack | ap-northeast-1 | VPC, Subnets, Security Groups |
| SecurityStack | ap-northeast-1 | Cognito User Pool, Client |
| StorageStack | ap-northeast-1 | FSx ONTAP, S3, DynamoDB×2, AWS Managed AD |
| AIStack | ap-northeast-1 | Bedrock KB, S3 Vectors / OpenSearch Serverless (`vectorStoreType`으로 선택), Bedrock Agent (선택 사항) |
| WebAppStack | ap-northeast-1 | Lambda (Web Adapter), CloudFront |

---

## 2. 리소스 ID 조회

배포 후 CloudFormation 출력에서 리소스 ID를 조회하여 이후 검증 단계에서 사용합니다.

```bash
# 스택 프레픽스 (cdk.context.json의 projectName-environment에 맞춤)
STACK_PREFIX="perm-rag-demo-demo"

# CloudFront URL
CF_URL=$(aws cloudformation describe-stacks \
  --stack-name ${STACK_PREFIX}-WebApp \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontUrl`].OutputValue' --output text)

# Lambda Function URL
LAMBDA_URL=$(aws cloudformation describe-stacks \
  --stack-name ${STACK_PREFIX}-WebApp \
  --query 'Stacks[0].Outputs[?OutputKey==`LambdaFunctionUrl`].OutputValue' --output text)

# Cognito User Pool ID
COGNITO_POOL=$(aws cloudformation describe-stacks \
  --stack-name ${STACK_PREFIX}-Security \
  --query 'Stacks[0].Outputs[?contains(OutputKey,`UserPool`)].OutputValue' --output text)

# Knowledge Base ID
KB_ID=$(aws cloudformation describe-stacks \
  --stack-name ${STACK_PREFIX}-AI \
  --query 'Stacks[0].Outputs[?OutputKey==`KnowledgeBaseId`].OutputValue' --output text)

echo "CloudFront: ${CF_URL}"
echo "Lambda URL: ${LAMBDA_URL}"
echo "Cognito:    ${COGNITO_POOL}"
echo "KB ID:      ${KB_ID}"
```

---

## 3. 웹 애플리케이션 HTTP 검증

```bash
# 로그인 페이지가 200을 반환하는지 확인
curl -s -o /dev/null -w "HTTP %{http_code}, Size: %{size_download} bytes\n" \
  "${LAMBDA_URL}/ja/signin"

# CloudFront 경유
curl -s -o /dev/null -w "HTTP %{http_code}\n" "${CF_URL}/ja/signin"
```

예상 결과: `HTTP 200`과 0이 아닌 Content-Length.

---

## 4. 인증 검증

```bash
# 로그인 (admin)
curl -s -X POST "${CF_URL}/api/auth/signin" \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin@example.com","password":"DemoAdmin123!"}' \
  -c /tmp/cookies.txt | python3 -m json.tool

# 세션 확인
curl -s "${CF_URL}/api/auth/session" -b /tmp/cookies.txt | python3 -m json.tool
```

예상 결과: 응답에 `role: "administrator"`가 포함됨.

---

## 5. SID 필터링 검증

SID 필터링이 올바르게 작동하는지 확인하기 위한 4가지 테스트 케이스입니다.

### 테스트 1: 관리자 → 기밀 문서 (허용)

```bash
curl -s -X POST "${CF_URL}/api/bedrock/kb/retrieve" \
  -H 'Content-Type: application/json' -b /tmp/cookies.txt \
  -d '{"query":"会社の売上はいくらですか？","userId":"admin@example.com","region":"ap-northeast-1"}' \
  | python3 -c "
import sys, json
r = json.load(sys.stdin)
fl = r.get('filterLog', {})
print(f'검색: {fl.get(\"totalDocuments\",0)}건, 허용: {fl.get(\"allowedDocuments\",0)}건, 거부: {fl.get(\"deniedDocuments\",0)}건')
print(f'필터 방식: {fl.get(\"filterMethod\",\"N/A\")}')
for d in fl.get('details', []):
    print(f'  {d.get(\"fileName\",\"?\")}: {\"ALLOW\" if d.get(\"matched\") else \"DENY\"}')"
```

예상: `financial-report.md`가 ALLOW.

### 테스트 2: 일반 사용자 → 기밀 문서 (거부)

```bash
# 일반 사용자로 로그인
curl -s -X POST "${CF_URL}/api/auth/signin" \
  -H 'Content-Type: application/json' \
  -d '{"username":"user@example.com","password":"DemoUser123!"}' \
  -c /tmp/cookies-user.txt > /dev/null

curl -s -X POST "${CF_URL}/api/bedrock/kb/retrieve" \
  -H 'Content-Type: application/json' -b /tmp/cookies-user.txt \
  -d '{"query":"会社の売上はいくらですか？","userId":"user@example.com","region":"ap-northeast-1"}' \
  | python3 -c "
import sys, json
r = json.load(sys.stdin)
fl = r.get('filterLog', {})
print(f'검색: {fl.get(\"totalDocuments\",0)}건, 허용: {fl.get(\"allowedDocuments\",0)}건, 거부: {fl.get(\"deniedDocuments\",0)}건')
print(f'필터 방식: {fl.get(\"filterMethod\",\"N/A\")}')
for d in fl.get('details', []):
    print(f'  {d.get(\"fileName\",\"?\")}: {\"ALLOW\" if d.get(\"matched\") else \"DENY\"}')"
```

예상: `financial-report.md`가 DENY.

### 테스트 3: 일반 사용자 → 공개 문서 (허용)

```bash
curl -s -X POST "${CF_URL}/api/bedrock/kb/retrieve" \
  -H 'Content-Type: application/json' -b /tmp/cookies-user.txt \
  -d '{"query":"製品の概要を教えてください","userId":"user@example.com","region":"ap-northeast-1"}' \
  | python3 -c "
import sys, json
r = json.load(sys.stdin)
fl = r.get('filterLog', {})
print(f'검색: {fl.get(\"totalDocuments\",0)}건, 허용: {fl.get(\"allowedDocuments\",0)}건, 거부: {fl.get(\"deniedDocuments\",0)}건')
for d in fl.get('details', []):
    print(f'  {d.get(\"fileName\",\"?\")}: {\"ALLOW\" if d.get(\"matched\") else \"DENY\"}')"
```

예상: `product-catalog.md`가 ALLOW.

### 테스트 4: 관리자 → 공개 문서 (허용)

```bash
curl -s -X POST "${CF_URL}/api/bedrock/kb/retrieve" \
  -H 'Content-Type: application/json' -b /tmp/cookies.txt \
  -d '{"query":"製品の概要を教えてください","userId":"admin@example.com","region":"ap-northeast-1"}' \
  | python3 -c "
import sys, json
r = json.load(sys.stdin)
fl = r.get('filterLog', {})
print(f'검색: {fl.get(\"totalDocuments\",0)}건, 허용: {fl.get(\"allowedDocuments\",0)}건')
for d in fl.get('details', []):
    print(f'  {d.get(\"fileName\",\"?\")}: {\"ALLOW\" if d.get(\"matched\") else \"DENY\"}')"
```

예상: `product-catalog.md`가 ALLOW.

---

## 6. 사양 구현 상태

| # | 사양 | 상태 | 비고 |
|---|------|------|------|
| 1 | Lambda 기반 Next.js RAG 챗봇 | ✅ | Lambda Web Adapter + CloudFront |
| 2 | AWS WAF (IP/Geo 보호) | ✅ | 6개 규칙 + Geo 제한 |
| 3 | API IAM 인증 | ⚠️ | CDK 코드에서 IAM Auth + OAC 구성 사용. POST 요청의 SigV4 서명 문제 (아래 참조) |
| 4 | 벡터 DB | ✅ | S3 Vectors (기본값) / OpenSearch Serverless (`vectorStoreType`으로 선택) |
| 5 | Embedding (Bedrock KB 경유) | ✅ | Titan Embeddings v2 |
| 6 | SID 기반 권한 필터링 | ✅ | DynamoDB + 메타데이터 SID 매칭 |

### IAM 인증의 알려진 제한 사항

CloudFront OAC + Lambda Function URL IAM 인증 조합에서 POST 요청의 SigV4 서명이 올바르게 계산되지 않는 문제가 있습니다 (CloudFront가 POST 본문의 SHA256 해시를 자동으로 계산하지 않음).

- CDK 코드에서 IAM Auth 구성은 유지됨
- 검증 환경에서는 Function URL AuthType=NONE으로 변경하고 WAF + Geo 제한으로 보호 가능
- 프로덕션 환경에서는 클라이언트 측에서 `x-Amz-Content-Sha256` 헤더를 포함해야 함

---

## 7. WebApp 컨테이너 업데이트 절차

프론트엔드 코드 변경 후 Lambda 컨테이너 이미지를 업데이트하는 절차입니다.

```bash
# 변수 설정 (환경에 맞게 변경)
ACCOUNT_ID="<ACCOUNT_ID>"
FUNCTION_NAME="<LAMBDA_FUNCTION_NAME>"
DISTRIBUTION_ID="<CLOUDFRONT_DISTRIBUTION_ID>"
IMAGE_TAG="v$(date +%Y%m%d-%H%M%S)"

# 1. ECR 인증
aws ecr get-login-password --region ap-northeast-1 | \
  docker login --username AWS --password-stdin \
  ${ACCOUNT_ID}.dkr.ecr.ap-northeast-1.amazonaws.com

# 2. Docker 이미지 빌드 & 푸시
docker build --no-cache \
  -t permission-aware-rag-webapp:${IMAGE_TAG} \
  -f docker/nextjs/Dockerfile docker/nextjs/

docker tag permission-aware-rag-webapp:${IMAGE_TAG} \
  ${ACCOUNT_ID}.dkr.ecr.ap-northeast-1.amazonaws.com/permission-aware-rag-webapp:${IMAGE_TAG}

docker push \
  ${ACCOUNT_ID}.dkr.ecr.ap-northeast-1.amazonaws.com/permission-aware-rag-webapp:${IMAGE_TAG}

# 3. Lambda 함수 이미지 업데이트
aws lambda update-function-code \
  --function-name ${FUNCTION_NAME} \
  --image-uri ${ACCOUNT_ID}.dkr.ecr.ap-northeast-1.amazonaws.com/permission-aware-rag-webapp:${IMAGE_TAG} \
  --region ap-northeast-1

aws lambda wait function-updated \
  --function-name ${FUNCTION_NAME} --region ap-northeast-1

# 4. 컨테이너 리프레시 (이전 컨테이너 캐시 강제 업데이트)
aws lambda put-function-concurrency \
  --function-name ${FUNCTION_NAME} --region ap-northeast-1 \
  --reserved-concurrent-executions 0
sleep 15
aws lambda delete-function-concurrency \
  --function-name ${FUNCTION_NAME} --region ap-northeast-1

# 5. CloudFront 캐시 무효화
aws cloudfront create-invalidation \
  --distribution-id ${DISTRIBUTION_ID} --paths "/*"
```

---

## 8. KB Retrieve API 모델 호환성

Bedrock KB `RetrieveAndGenerate` API는 Anthropic 모델만 지원합니다. KB Retrieve API (`route.ts`)는 프론트엔드에서 전송된 모델 ID에 대해 다음과 같은 자동 변환을 수행합니다.

| 전송된 모델 | 변환 대상 | 이유 |
|------------|----------|------|
| `apac.amazon.nova-pro-v1:0` | `anthropic.claude-3-haiku-20240307-v1:0` | Nova 모델은 KB API에서 지원되지 않음 |
| `us.anthropic.claude-3-5-sonnet-20241022-v2:0` | `anthropic.claude-3-5-sonnet-20241022-v2:0` | 추론 프로파일 프레픽스 제거 |
| `anthropic.claude-3-haiku-20240307-v1:0` | 그대로 | 변환 불필요 |

구현: `docker/nextjs/src/app/api/bedrock/kb/retrieve/route.ts`


---

## 9. Bedrock Agent 검증 (enableAgent=true)

### Agent 생성 확인

```bash
# Agent ID와 Alias ID 가져오기
aws cloudformation describe-stacks --stack-name perm-rag-demo-demo-AI --region ap-northeast-1 \
  --query 'Stacks[0].Outputs[?contains(OutputKey, `Agent`)].{Key:OutputKey,Value:OutputValue}' --output table
```

### 권한 인식 Action Group 검증

```bash
LAMBDA_URL="<Lambda Function URL>"

# 관리자 테스트 (모든 문서 접근 가능)
curl -s -X POST "${LAMBDA_URL}/api/bedrock/agent" \
  -H "Content-Type: application/json" \
  -d '{"message":"会社の財務状況を教えてください","userId":"admin@example.com","sessionId":"test-admin","action":"invoke"}'

# 일반 사용자 테스트 (공개 문서만)
curl -s -X POST "${LAMBDA_URL}/api/bedrock/agent" \
  -H "Content-Type: application/json" \
  -d '{"message":"会社の財務状況を教えてください","userId":"user@example.com","sessionId":"test-user","action":"invoke"}'
```

### 예상 결과

| 사용자 | Action Group SID 필터 | Agent 응답 |
|--------|----------------------|-----------|
| admin@example.com | 6/6 허용 (SID: 3) | 재무 수치를 포함한 상세 응답 |
| user@example.com | 2/6 허용 (SID: 2) | "상세 내용을 공개할 수 없습니다" 등 |

### Action Group Lambda 로그 확인

```bash
# 최신 로그 확인
aws logs get-log-events \
  --log-group-name /aws/lambda/perm-rag-demo-demo-perm-search \
  --log-stream-name $(aws logs describe-log-streams \
    --log-group-name /aws/lambda/perm-rag-demo-demo-perm-search \
    --order-by LastEventTime --descending --limit 1 \
    --region ap-northeast-1 --query 'logStreams[0].logStreamName' --output text) \
  --region ap-northeast-1 --query 'events[].message' --output text | grep "PermSearch"
```

예상 로그:
```
[PermSearch] KB: 6 SIDs: 3        # admin: 3개 SID
[PermSearch] Allowed: 6 / 6       # admin: 모든 문서 허용

[PermSearch] KB: 6 SIDs: 2        # user: 2개 SID
[PermSearch] Allowed: 2 / 6       # user: 공개 문서만
```

### UI 검증

1. 브라우저에서 CloudFront URL에 접속
2. admin@example.com으로 로그인
3. 헤더의 "🤖 Agent" 버튼 클릭 → Agent 모드로 전환
4. 사이드바에서 Agent 선택
5. 워크플로우 "📊 재무 보고서 분석" 클릭 → 프롬프트 자동 입력
6. 전송 → Agent 응답에 재무 데이터가 포함되어 있는지 확인
7. 로그아웃 → user@example.com으로 로그인
8. 동일한 질문 → 기밀 데이터가 포함되지 않았는지 확인
