# 검증 데모 영상 녹화 가이드

**🌐 Language:** [日本語](../demo-recording-guide.md) | [English](../en/demo-recording-guide.md) | **한국어** | [简体中文](../zh-CN/demo-recording-guide.md) | [繁體中文](../zh-TW/demo-recording-guide.md) | [Français](../fr/demo-recording-guide.md) | [Deutsch](../de/demo-recording-guide.md) | [Español](../es/demo-recording-guide.md)

**최종 업데이트**: 2026-03-29  
**목적**: Permission-Aware RAG 시스템의 검증 데모 영상 녹화를 위한 단계별 가이드  
**사전 요구 사항**: AWS 계정 (AdministratorAccess 상당), EC2 인스턴스 (Ubuntu 22.04, t3.large 이상, 50GB EBS)

---

## 녹화할 증거 (6개 항목)

| # | 증거 | 내용 |
|---|------|------|
| (1) | RAG 기반 AI 챗봇 플랫폼 구축 | 아키텍처 설명 |
| (2) | AWS CDK를 사용한 챗봇 플랫폼 배포 | CDK 배포 절차 |
| (3) | FSx ONTAP 볼륨에 스토리지 데이터 배치 | S3 Access Point를 통한 데이터 수집 |
| (4) | 접근 권한 정보 반영 | `.metadata.json`의 SID 정보 설정 및 검증 |
| (5) | 사용자별 권한에 따른 데이터 접근 판정 | SID 필터링 검증 |
| (6) | 초기 검증 | 카드 UI, KB/Agent 모드, Citation 표시 검증 |

---

## 준비

### EC2 인스턴스 시작

```bash
aws ec2 run-instances \
  --region ap-northeast-1 \
  --image-id <UBUNTU_22_04_AMI_ID> \
  --instance-type t3.large \
  --subnet-id <PUBLIC_SUBNET_ID> \
  --security-group-ids <SG_ID> \
  --iam-instance-profile Name=<ADMIN_INSTANCE_PROFILE> \
  --associate-public-ip-address \
  --block-device-mappings '[{"DeviceName":"/dev/sda1","Ebs":{"VolumeSize":50,"VolumeType":"gp3"}}]' \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=cdk-deploy-server}]'
```

### EC2에 필수 도구 설치

```bash
sudo apt-get update -y
sudo apt-get install -y curl git unzip docker.io jq

curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

sudo systemctl enable docker && sudo systemctl start docker
sudo usermod -aG docker ubuntu && newgrp docker

sudo npm install -g aws-cdk typescript ts-node
```

### 리포지토리 클론

```bash
cd /home/ubuntu
git clone https://github.com/Yoshiki0705/FSx-for-ONTAP-Agentic-Access-Aware-RAG.git
cd FSx-for-ONTAP-Agentic-Access-Aware-RAG
npm install
```

---

## 증거 (1): RAG 기반 AI 챗봇 플랫폼 구축

**녹화 내용**: 시스템 아키텍처 설명

### 아키텍처 다이어그램

```
┌──────────┐     ┌──────────┐     ┌────────────┐     ┌─────────────────────┐
│ Browser  │────▶│ AWS WAF  │────▶│ CloudFront │────▶│ Lambda Web Adapter  │
└──────────┘     └──────────┘     │ (OAC+Geo)  │     │ (Next.js, IAM Auth) │
                                   └────────────┘     └──────┬──────────────┘
                                                             │
                       ┌─────────────────────┬───────────────┼────────────────────┐
                       ▼                     ▼               ▼                    ▼
              ┌─────────────┐    ┌──────────────────┐ ┌──────────────┐   ┌──────────────┐
              │ Cognito     │    │ Bedrock KB       │ │ DynamoDB     │   │ DynamoDB     │
              │ User Pool   │    │ + S3 Vectors /   │ │ user-access  │   │ perm-cache   │
              └─────────────┘    │   OpenSearch SL  │ │ (SID data)   │   │ (Perm Cache) │
                                 └────────┬─────────┘ └──────────────┘   └──────────────┘
                                          │
                                          ▼
                                 ┌──────────────────┐
                                 │ FSx for ONTAP    │
                                 │ (SVM + Volume)   │
                                 │ + S3 Access Point│
                                 └──────────────────┘
```

### 설명할 8가지 구성 요소

1. **AWS Lambda 기반 Next.js RAG 챗봇** — Lambda Web Adapter를 통한 서버리스 실행. 카드 기반 태스크 지향 UI
2. **AWS WAF** — 속도 제한, IP 평판, OWASP 준수 규칙, SQLi 보호
3. **IAM 인증** — Lambda Function URL IAM Auth + CloudFront OAC (SigV4)
4. **벡터 스토어** — S3 Vectors (기본값, 저비용) / OpenSearch Serverless (고성능, `vectorStoreType`으로 선택)
5. **FSx ONTAP + S3 Access Point** — S3 AP를 통해 Bedrock KB에 직접 문서 제공
6. **Titan Embed Text v2** — Amazon Bedrock 텍스트 벡터화 모델 (1024차원)
7. **SID 필터링** — NTFS ACL SID 정보를 사용한 문서 수준 접근 제어
8. **KB/Agent 모드 전환** — KB 모드 (문서 검색)와 Agent 모드 (동적 Agent 생성 + 다단계 추론)

### 녹화 절차

1. 화면에 `docs/implementation-overview.md` 표시
2. 아키텍처 다이어그램을 보여주며 각 구성 요소 설명
3. CDK 스택 구조 설명 (7개 스택)
4. SID 필터링 흐름도 설명

---

## 증거 (2): AWS CDK를 사용한 챗봇 플랫폼 배포

**녹화 내용**: CDK 배포 실행 및 완료 확인

### 단계 1: 배포 전 설정 (ECR 이미지 준비)

```bash
cd /home/ubuntu/Permission-aware-RAG-FSxN-CDK

# ECR 리포지토리 생성 + Docker 이미지 빌드 + 푸시
bash demo-data/scripts/pre-deploy-setup.sh
```

### 단계 2: CDK 배포 (전체 6개 스택)

```bash
npx cdk deploy --all \
  --app "npx ts-node bin/demo-app.ts" \
  -c enableAgent=true \
  --require-approval never
```

> **예상 소요 시간**: 약 30~40분 (FSx ONTAP 생성에 20~30분)

### 단계 3: 배포 후 설정 (단일 명령)

```bash
bash demo-data/scripts/post-deploy-setup.sh
```

자동 실행되는 작업:
1. S3 Access Point 생성 + 정책 구성
2. FSx ONTAP에 데모 데이터 업로드 (S3 AP 경유)
3. Bedrock KB 데이터 소스 추가 + 동기화
4. DynamoDB에 사용자 SID 데이터 등록
5. Cognito에 데모 사용자 생성

### 단계 4: 배포 검증

```bash
bash demo-data/scripts/verify-deployment.sh
```

### 녹화 포인트

- `pre-deploy-setup.sh` 실행 (ECR 이미지 준비)
- `cdk deploy --all` 실행 화면
- `post-deploy-setup.sh` 실행 (S3 AP 생성 → KB 동기화 → 사용자 생성)
- `verify-deployment.sh`의 테스트 결과

---

## 증거 (3): FSx ONTAP 볼륨에 스토리지 데이터 배치

**녹화 내용**: S3 Access Point를 통한 데이터 수집 검증

`post-deploy-setup.sh`가 S3 AP를 통해 데모 데이터를 자동 업로드합니다. 수동 검증:

```bash
STACK_PREFIX="perm-rag-demo-demo"
S3AP_NAME=$(aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-Storage --region ap-northeast-1 \
  --query 'Stacks[0].Outputs[?OutputKey==`S3AccessPointName`].OutputValue' --output text)
S3AP_ALIAS=$(aws fsx describe-s3-access-point-attachments --region ap-northeast-1 \
  --query "S3AccessPointAttachments[?Name=='${S3AP_NAME}'].S3AccessPoint.Alias" --output text)

# S3 AP를 통한 파일 목록 조회
aws s3 ls "s3://${S3AP_ALIAS}/" --recursive --region ap-northeast-1
```

### 녹화 포인트

- S3 AP를 통한 파일 목록 표시
- 문서 내용 확인 (3가지 유형: public / confidential / restricted)

---

## 증거 (4): 접근 권한 정보 반영

**녹화 내용**: `.metadata.json`을 통한 SID 정보 검증

```bash
# S3 AP를 통한 .metadata.json 확인
aws s3 cp "s3://${S3AP_ALIAS}/public/company-overview.md.metadata.json" - | python3 -m json.tool
aws s3 cp "s3://${S3AP_ALIAS}/confidential/financial-report.md.metadata.json" - | python3 -m json.tool
aws s3 cp "s3://${S3AP_ALIAS}/restricted/project-plan.md.metadata.json" - | python3 -m json.tool
```

### SID와 접근 권한 매핑

| 디렉토리 | allowed_group_sids | 관리자 | 일반 사용자 |
|----------|-------------------|--------|-----------|
| `public/` | `S-1-1-0` (Everyone) | ✅ 열람 가능 | ✅ 열람 가능 |
| `confidential/` | `...-512` (Domain Admins) | ✅ 열람 가능 | ❌ 열람 불가 |
| `restricted/` | `...-1100` + `...-512` | ✅ 열람 가능 | ❌ 열람 불가 |

### 녹화 포인트

- 화면에 `.metadata.json` 내용 표시
- SID의 의미 설명 (Everyone, Domain Admins 등)

---

## 증거 (5): 사용자별 권한에 따른 데이터 접근 판정

**녹화 내용**: 관리자와 일반 사용자에게 다른 검색 결과가 반환되는지 검증

### DynamoDB SID 데이터 확인

```bash
USER_ACCESS_TABLE=$(aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-Storage --region ap-northeast-1 \
  --query 'Stacks[0].Outputs[?OutputKey==`UserAccessTableName`].OutputValue' --output text)

aws dynamodb get-item --table-name ${USER_ACCESS_TABLE} \
  --key '{"userId":{"S":"admin@example.com"}}' --region ap-northeast-1 --output json | python3 -m json.tool

aws dynamodb get-item --table-name ${USER_ACCESS_TABLE} \
  --key '{"userId":{"S":"user@example.com"}}' --region ap-northeast-1 --output json | python3 -m json.tool
```

### curl을 통한 SID 필터링 검증

```bash
LAMBDA_URL=$(aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-WebApp --region ap-northeast-1 \
  --query 'Stacks[0].Outputs[?OutputKey==`LambdaFunctionUrl`].OutputValue' --output text)
KB_ID=$(aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-AI --region ap-northeast-1 \
  --query 'Stacks[0].Outputs[?OutputKey==`KnowledgeBaseId`].OutputValue' --output text)

# 관리자 사용자
echo "=== admin@example.com ==="
curl -s -X POST "${LAMBDA_URL}api/bedrock/kb/retrieve" \
  -H "Content-Type: application/json" \
  -d '{"query":"会社の売上はいくらですか？","userId":"admin@example.com","knowledgeBaseId":"'${KB_ID}'"}' \
  | python3 -c "import sys,json;fl=json.load(sys.stdin).get('filterLog',{});print(f'  {fl.get(\"allowedDocuments\",0)}/{fl.get(\"totalDocuments\",0)} documents allowed')"

# 일반 사용자
echo "=== user@example.com ==="
curl -s -X POST "${LAMBDA_URL}api/bedrock/kb/retrieve" \
  -H "Content-Type: application/json" \
  -d '{"query":"会社の売上はいくらですか？","userId":"user@example.com","knowledgeBaseId":"'${KB_ID}'"}' \
  | python3 -c "import sys,json;fl=json.load(sys.stdin).get('filterLog',{});print(f'  {fl.get(\"allowedDocuments\",0)}/{fl.get(\"totalDocuments\",0)} documents allowed')"
```

### 녹화 포인트

- 화면에 DynamoDB SID 데이터 표시
- 관리자는 모든 문서에 접근 가능하고 일반 사용자는 공개 문서에만 접근 가능함을 강조

---

## 증거 (6): 초기 검증 — 카드 UI, KB/Agent 모드, Citation 표시

**녹화 내용**: 브라우저에서의 엔드투엔드 검증

### 단계 1: 브라우저로 접속

```bash
CF_URL=$(aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-WebApp --region ap-northeast-1 \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontUrl`].OutputValue' --output text)
echo "Access URL: ${CF_URL}/ja/signin"
```

### 단계 2: 관리자 사용자로 검증 (KB 모드)

1. `admin@example.com`으로 로그인
2. 카드 그리드 표시 (14개 카드: 리서치 8개 + 출력 6개)
3. InfoBanner에 권한 정보 표시 (3개 디렉토리, 읽기 ✅, 쓰기 ✅)
4. "문서 검색" 카드 클릭 → 입력 필드에 프롬프트 설정
5. "회사의 매출은 얼마입니까?" 질문
6. 응답에 Citation 표시 (FSx 파일 경로 + 접근 수준 배지)
   - `confidential/financial-report.md` — 관리자 전용 (빨간색 배지)
   - `public/company-overview.md` — 모든 사용자 접근 가능 (녹색 배지)
7. "🔄 워크플로우 선택으로 돌아가기" 버튼 클릭하여 카드 그리드로 복귀

### 단계 3: 관리자 사용자로 검증 (Agent 모드)

1. 헤더의 "🤖 Agent" 버튼으로 Agent 모드 전환
2. Agent 모드 카드 그리드 표시 (14개 카드: 리서치 8개 + 출력 6개)
3. "재무 보고서 분석" 카드 클릭
4. Bedrock Agent가 자동으로 검색되어 동적 생성 (첫 사용 시 몇 초 대기)
5. 질문에 대한 Agent 응답 + Citation 표시

### 단계 4: 일반 사용자로 검증

1. 로그아웃 → `user@example.com`으로 로그인
2. InfoBanner에 권한 정보 표시 (1개 디렉토리만)
3. "회사의 매출은 얼마입니까?" 질문
4. 응답에 기밀 문서의 Citation이 포함되지 않았는지 확인
5. "제품 개요를 알려주세요" 질문
6. 공개 문서의 Citation이 표시되는지 확인

### 검증 결과 요약

| 질문 | admin | user | 이유 |
|------|-------|------|------|
| 회사 매출 | ✅ 재무 보고서 참조 | ❌ 공개 정보만 | financial-report.md는 Domain Admins 전용 |
| 재택근무 정책 | ✅ HR 정책 참조 | ❌ 접근 거부 | hr-policy.md는 Domain Admins 전용 |
| 제품 개요 | ✅ 제품 카탈로그 참조 | ✅ 제품 카탈로그 참조 | product-catalog.md는 Everyone |

### 녹화 포인트

- KB 모드: 카드 그리드 → 질문 → Citation (파일 경로 + 접근 수준 배지)
- Agent 모드: 카드 클릭 → 동적 Agent 생성 → 응답
- 관리자 vs. 일반 사용자 결과 비교
- "워크플로우 선택으로 돌아가기" 버튼 동작

---

## 리소스 정리

```bash
bash demo-data/scripts/cleanup-all.sh
```

---

## 문제 해결

| 증상 | 원인 | 해결 방법 |
|------|------|----------|
| CDK 배포 시 schema version mismatch | CDK CLI 버전 불일치 | `npm install aws-cdk@latest` + `npx cdk` 사용 |
| KB 검색 결과 없음 | 데이터 소스 미동기화 | `post-deploy-setup.sh` 재실행 |
| 모든 문서 거부됨 | SID 데이터 미등록 | `post-deploy-setup.sh` 재실행 |
| 페이지 미표시 | CloudFront 캐시 | `aws cloudfront create-invalidation --distribution-id <ID> --paths "/*"` |
| Docker 권한 오류 | docker 그룹 미소속 | `sudo usermod -aG docker ubuntu && newgrp docker` |
| 동적 Agent 생성 실패 | Lambda IAM 권한 부족 | CDK에서 `enableAgent=true` 지정하여 배포 |
