# Permission-aware RAG 검증 환경 가이드

**🌐 Language:** [日本語](../demo-environment-guide.md) | [English](../en/demo-environment-guide.md) | **한국어** | [简体中文](../zh-CN/demo-environment-guide.md) | [繁體中文](../zh-TW/demo-environment-guide.md) | [Français](../fr/demo-environment-guide.md) | [Deutsch](../de/demo-environment-guide.md) | [Español](../es/demo-environment-guide.md)

**최종 업데이트**: 2026-03-25  
**리전**: ap-northeast-1 (도쿄)

---

## 1. 접속 정보

### 웹 애플리케이션 URL

| 엔드포인트 | URL |
|---|---|
| CloudFront (프로덕션) | `<CDK 배포 후 CloudFormation 출력에서 확인>` |
| Lambda Function URL (직접) | `<CDK 배포 후 CloudFormation 출력에서 확인>` |

```bash
# URL 조회 명령
STACK_PREFIX="perm-rag-demo-demo"
aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-WebApp \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontUrl`].OutputValue' --output text
aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-WebApp \
  --query 'Stacks[0].Outputs[?OutputKey==`LambdaFunctionUrl`].OutputValue' --output text
```

### 테스트 사용자

| 사용자 | 이메일 주소 | 비밀번호 | 역할 | 권한 |
|---|---|---|---|---|
| 관리자 | `admin@example.com` | `DemoAdmin123!` | administrator | 모든 문서 열람 가능 |
| 일반 사용자 | `user@example.com` | `DemoUser123!` | user | 공개 문서만 |

인증은 Amazon Cognito로 관리됩니다.

---

## 2. CDK 스택 구성 (6+1 스택)

| 스택 이름 | 리전 | 설명 |
|---|---|---|
| `${prefix}-Waf` | us-east-1 | CloudFront용 WAF WebACL |
| `${prefix}-Networking` | ap-northeast-1 | VPC, Subnets, Security Groups |
| `${prefix}-Security` | ap-northeast-1 | Cognito User Pool, 인증 |
| `${prefix}-Storage` | ap-northeast-1 | FSx ONTAP + SVM + Volume + S3 + DynamoDB + AD |
| `${prefix}-AI` | ap-northeast-1 | Bedrock KB + S3 Vectors / OpenSearch Serverless (`vectorStoreType`으로 선택) |
| `${prefix}-WebApp` | ap-northeast-1 | Lambda Web Adapter (Next.js) + CloudFront |
| `${prefix}-Embedding` (선택 사항) | ap-northeast-1 | Embedding EC2 + ECR (FlexCache CIFS 마운트) |

### 리소스 ID 조회

```bash
STACK_PREFIX="perm-rag-demo-demo"

# 모든 스택의 출력을 한 번에 조회
for stack in Waf Networking Security Storage AI WebApp Embedding; do
  echo "=== ${STACK_PREFIX}-${stack} ==="
  aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-${stack} \
    --query 'Stacks[0].Outputs[*].{Key:OutputKey,Value:OutputValue}' --output table 2>/dev/null || echo "  (미배포)"
done
```

---

## 3. 검증 시나리오

### 기본 흐름

1. CloudFront URL에 접속 → `/ja/signin`
2. 테스트 사용자로 로그인
3. **KB 모드**: 채팅 화면에서 모델 선택 → RAG 검색의 권한 필터링 검증
4. **Agent 모드**: 헤더의 "🤖 Agent" 버튼 클릭 → Agent 선택 → 워크플로우 선택 또는 자유 채팅

### 권한 차이 검증

관리자와 일반 사용자가 동일한 질문을 하면 SID 필터링에 의해 다른 결과가 반환됩니다.
KB 모드와 Agent 모드 모두에서 동일한 권한 제어가 적용됩니다.

| 예시 질문 | admin (KB/Agent) | user (KB/Agent) |
|----------|------------------|-----------------|
| "회사의 매출은 얼마입니까?" | ✅ 재무 보고서 참조 (6/6 허용) | ❌ 공개 정보만 (2/6 허용) |
| "재택근무 정책은 무엇입니까?" | ✅ HR 정책 참조 | ❌ 접근 거부 |
| "프로젝트 계획은 무엇입니까?" | ✅ 프로젝트 계획 참조 | ❌ 접근 거부 |

### Agent 모드 검증

1. 헤더의 "🤖 Agent" 버튼 클릭
2. 사이드바에서 Agent 선택 (`perm-rag-demo-demo-agent`)
3. 워크플로우 선택 (📊 재무 보고서 분석 등) 또는 채팅 메시지 입력
4. Agent 응답 검증 (Permission-aware Action Group을 통한 SID 필터링 적용)

### 동적 Agent 생성 기능

Agent 모드에서 워크플로우 카드를 클릭하면 카테고리에 해당하는 Bedrock Agent가 자동으로 검색 및 생성됩니다.

| 항목 | 설명 |
|------|------|
| 트리거 | 워크플로우 카드 클릭 |
| 동작 | AGENT_CATEGORY_MAP을 통한 카테고리 판정 → 기존 Agent 검색 → 미발견 시 CreateAgent API로 동적 생성 |
| 소요 시간 | 초기 생성 시 30~60초 (로딩 UI 표시), 두 번째부터는 localStorage 캐시로 즉시 |
| Action Group | 동적 생성된 Agent에 Permission-aware Action Group 자동 첨부 (`PERM_SEARCH_LAMBDA_ARN` 환경 변수로 지정) |
| 캐시 | 카드-Agent 매핑이 `useCardAgentMappingStore` (Zustand + localStorage)를 통해 영속화 |
| 필요 권한 | Lambda IAM 역할에 `bedrock:CreateAgent`, `bedrock:PrepareAgent`, `bedrock:CreateAgentAlias`, `bedrock:CreateAgentActionGroup`, `iam:PassRole` 필요 |

### CDK 배포 옵션

```bash
# Agent + 모든 옵션 활성화
npx cdk deploy --all --app "npx ts-node bin/demo-app.ts" \
  -c enableAgent=true \
  -c enableGuardrails=true \
  --require-approval never
```
| "제품 개요를 알려주세요" | ✅ 제품 카탈로그 참조 | ✅ 제품 카탈로그 참조 |

자세한 내용은 [demo-data/guides/demo-scenario.md](../../demo-data/guides/demo-scenario.md)를 참조하세요.

---

## 4. Active Directory 통합

### AD 정보

| 항목 | 값 |
|---|---|
| 도메인 이름 | `demo.local` |
| 에디션 | Standard |
| DNS IP | `<AD 배포 후 확인>` |

```bash
# AD 정보 조회
aws ds describe-directories --region ap-northeast-1 \
  --query 'DirectoryDescriptions[?Name==`demo.local`].{Id:DirectoryId,Stage:Stage,DnsIps:DnsIpAddrs}' \
  --output table
```

### SVM AD 가입 절차

CDK는 AD 구성 없이 SVM을 생성합니다. 배포 후 CLI를 통해 AD 도메인에 가입합니다.

#### 사전 요구 사항: 보안 그룹 구성

SVM AD 가입에는 FSx SG와 AD SG 간의 통신이 필요합니다. CDK는 `allowAllOutbound: true`를 설정하지만, 다음 인바운드 규칙도 필요합니다.

```bash
# FSx SG ID와 AD SG ID 조회
FSX_SG_ID=$(aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-Networking \
  --query 'Stacks[0].Outputs[?OutputKey==`FsxSgId`].OutputValue' --output text)
AD_SG_ID=$(aws ds describe-directories --region ap-northeast-1 \
  --query 'DirectoryDescriptions[?Name==`demo.local`].VpcSettings.SecurityGroupId' --output text)

# FSx SG에 AD 통신 포트 추가 (CDK에 누락된 경우)
aws ec2 authorize-security-group-ingress --group-id $FSX_SG_ID \
  --protocol tcp --port 135 --source-group $AD_SG_ID --region ap-northeast-1
aws ec2 authorize-security-group-ingress --group-id $FSX_SG_ID \
  --protocol tcp --port 464 --source-group $AD_SG_ID --region ap-northeast-1
aws ec2 authorize-security-group-ingress --group-id $FSX_SG_ID \
  --protocol udp --port 464 --source-group $AD_SG_ID --region ap-northeast-1
aws ec2 authorize-security-group-ingress --group-id $FSX_SG_ID \
  --protocol tcp --port 636 --source-group $AD_SG_ID --region ap-northeast-1
aws ec2 authorize-security-group-ingress --group-id $FSX_SG_ID \
  --protocol udp --port 123 --source-group $AD_SG_ID --region ap-northeast-1
aws ec2 authorize-security-group-ingress --group-id $FSX_SG_ID \
  --protocol tcp --port 1024-65535 --source-group $AD_SG_ID --region ap-northeast-1

# 양방향 통신: AD SG ↔ FSx SG 모든 트래픽 허용
aws ec2 authorize-security-group-ingress --group-id $AD_SG_ID \
  --protocol -1 --source-group $FSX_SG_ID --region ap-northeast-1
aws ec2 authorize-security-group-ingress --group-id $FSX_SG_ID \
  --protocol -1 --source-group $AD_SG_ID --region ap-northeast-1
```

#### SVM AD 가입 명령

```bash
SVM_ID=$(aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-Storage \
  --query 'Stacks[0].Outputs[?OutputKey==`SvmId`].OutputValue' --output text)
AD_DNS_IPS=$(aws ds describe-directories --region ap-northeast-1 \
  --query 'DirectoryDescriptions[?Name==`demo.local`].DnsIpAddrs' --output json)

# 중요: AWS Managed AD의 경우 OrganizationalUnitDistinguishedName을 명시적으로 지정
aws fsx update-storage-virtual-machine \
  --storage-virtual-machine-id $SVM_ID \
  --active-directory-configuration '{
    "NetBiosName": "RAGSVM",
    "SelfManagedActiveDirectoryConfiguration": {
      "DomainName": "demo.local",
      "UserName": "Admin",
      "Password": "<AD_PASSWORD>",
      "DnsIps": '"$AD_DNS_IPS"',
      "OrganizationalUnitDistinguishedName": "OU=Computers,OU=demo,DC=demo,DC=local",
      "FileSystemAdministratorsGroup": "Domain Admins"
    }
  }' --region ap-northeast-1
```

> **중요**: AWS Managed AD에서 `OrganizationalUnitDistinguishedName`을 생략하면 MISCONFIGURED 상태가 됩니다. `OU=Computers,OU=<NetBIOS 짧은 이름>,DC=<domain>,DC=<tld>` 형식으로 지정하세요.

#### AD 가입 상태 확인

```bash
aws fsx describe-storage-virtual-machines \
  --storage-virtual-machine-ids $SVM_ID \
  --query 'StorageVirtualMachines[0].ActiveDirectoryConfiguration' \
  --region ap-northeast-1 --output json
```

`NetBiosName`이 표시되고 `SelfManagedActiveDirectoryConfiguration`에 도메인 정보가 포함되어 있으면 가입 성공입니다.

자세한 절차는 [demo-data/guides/ontap-setup-guide.md](../../demo-data/guides/ontap-setup-guide.md)를 참조하세요.

---

## 5. Knowledge Base 데이터

### 옵션 A: S3 버킷 경유 (기본값)

다음 문서가 S3 버킷에 등록되어 있습니다. 각 문서에는 `.metadata.json`을 통해 SID 정보가 첨부되어 있습니다.

| 파일 | 접근 수준 | allowed_group_sids | admin | user |
|---|---|---|---|---|
| `public/company-overview.md` | public | S-1-1-0 (Everyone) | ✅ | ✅ |
| `public/product-catalog.md` | public | S-1-1-0 (Everyone) | ✅ | ✅ |
| `restricted/project-plan.md` | restricted | ...-1100, ...-512 | ✅ | ❌ |
| `confidential/financial-report.md` | confidential | ...-512 (Domain Admins) | ✅ | ❌ |
| `confidential/hr-policy.md` | confidential | ...-512 (Domain Admins) | ✅ | ❌ |

### 옵션 B: Embedding 서버 경유 (FlexCache CIFS 마운트)

FlexCache Cache 볼륨을 CIFS로 마운트하고 Embedding 서버로 문서를 직접 벡터화한 후 OpenSearch Serverless (AOSS)에 인덱싱합니다. S3 Access Point를 사용할 수 없는 경우의 대체 경로입니다 (2026년 3월 기준 FlexCache Cache 볼륨에서는 지원되지 않음). AOSS 구성(`vectorStoreType=opensearch-serverless`)에서만 사용 가능합니다.

자세한 내용은 [6. Embedding 서버](#6-embedding-서버-선택-사항)를 참조하세요.

---

## 6. Embedding 서버 (선택 사항)

### 개요

EmbeddingStack (7번째 CDK 스택)은 FSx ONTAP의 CIFS 공유 문서를 직접 읽고, Amazon Bedrock Titan Embed Text v2로 벡터화하여 OpenSearch Serverless (AOSS)에 인덱싱하는 EC2 기반 서버입니다. AOSS 구성(`vectorStoreType=opensearch-serverless`)에서만 사용 가능합니다.

### 아키텍처

```
┌──────────────────┐     CIFS/SMB      ┌──────────────────┐
│ FSx ONTAP        │◀──────────────────│ Embedding EC2    │
│ (SVM + Volume)   │    Mount          │ (m5.large)       │
│ /data            │                   │                  │
└──────────────────┘                   │ Docker Container │
                                       │ ┌──────────────┐ │
                                       │ │ embed-app    │ │
                                       │ │ - scan docs  │ │
                                       │ │ - embedding  │ │
                                       │ │ - indexing   │ │
                                       │ └──────┬───────┘ │
                                       └────────┼─────────┘
                                                │
                              ┌─────────────────┼─────────────────┐
                              ▼                                   ▼
                    ┌──────────────────┐              ┌──────────────────┐
                    │ Bedrock          │              │ OpenSearch       │
                    │ Titan Embed v2   │              │ Serverless       │
                    │ (Vector Gen)     │              │ (Indexing)       │
                    └──────────────────┘              └──────────────────┘
```

### 배포 절차

#### 단계 1: Secrets Manager에 비밀번호 등록

```bash
AD_SECRET_ARN=$(aws secretsmanager create-secret \
  --name perm-rag-demo-ad-password \
  --secret-string '{"password":"<AD_PASSWORD>"}' \
  --region ap-northeast-1 \
  --query 'ARN' --output text)
echo "Secret ARN: $AD_SECRET_ARN"
```

#### 단계 2: EmbeddingStack 배포

```bash
npx cdk deploy ${STACK_PREFIX}-Embedding \
  --app "npx ts-node bin/demo-app.ts" \
  -c enableEmbeddingServer=true \
  -c embeddingAdSecretArn=$AD_SECRET_ARN \
  -c embeddingAdUserName=Admin \
  -c embeddingAdDomain=demo.local \
  --require-approval never
```

#### 단계 3: Docker 이미지 빌드 및 푸시

EC2 인스턴스에서 Docker를 사용할 수 없는 경우 CodeBuild를 사용합니다.

```bash
# ECR 리포지토리 URI 조회
ECR_URI=$(aws cloudformation describe-stacks \
  --stack-name ${STACK_PREFIX}-Embedding \
  --query 'Stacks[0].Outputs[?OutputKey==`EmbeddingEcrRepoUri`].OutputValue' \
  --output text)

# CodeBuild로 빌드 (docker/embed/buildspec.yml 사용)
# 소스를 zip으로 압축하여 S3에 업로드
pushd docker/embed && zip -r /tmp/embed-source.zip . -x "node_modules/*" && popd
aws s3 cp /tmp/embed-source.zip s3://<DATA_BUCKET>/codebuild/embed-source.zip

# CodeBuild 프로젝트 생성 및 실행 (최초 1회만)
aws codebuild start-build --project-name embed-image-builder --region ap-northeast-1
```

Docker 환경이 있는 경우 직접 빌드할 수 있습니다:

```bash
aws ecr get-login-password --region ap-northeast-1 | \
  docker login --username AWS --password-stdin <ACCOUNT_ID>.dkr.ecr.ap-northeast-1.amazonaws.com
docker build -t ${ECR_URI}:latest docker/embed/
docker push ${ECR_URI}:latest
```

#### 단계 4: CIFS 공유 생성

FSx ONTAP 관리자 비밀번호를 설정하고 REST API를 통해 CIFS 공유를 생성합니다.

```bash
# FSx 관리자 비밀번호 설정
FS_ID=$(aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-Storage \
  --query 'Stacks[0].Outputs[?OutputKey==`FileSystemId`].OutputValue' --output text)
aws fsx update-file-system --file-system-id $FS_ID \
  --ontap-configuration '{"FsxAdminPassword":"<ADMIN_PASSWORD>"}' \
  --region ap-northeast-1

# SVM UUID 조회 (REST API용)
MGMT_IP=$(aws fsx describe-file-systems --file-system-ids $FS_ID \
  --query 'FileSystems[0].OntapConfiguration.Endpoints.Management.IpAddresses[0]' --output text)

# EC2에서 ONTAP REST API를 통해 CIFS 공유 생성 (SSM 경유)
# SVM UUID 조회
SVM_UUID=$(curl -sk -u fsxadmin:<ADMIN_PASSWORD> \
  "https://${MGMT_IP}/api/svm/svms" | python3 -c "import sys,json; print(json.load(sys.stdin)['records'][0]['uuid'])")

# CIFS 공유 생성
curl -sk -u fsxadmin:<ADMIN_PASSWORD> \
  -X POST "https://${MGMT_IP}/api/protocols/cifs/shares" \
  -H "Content-Type: application/json" \
  -d "{\"svm\":{\"uuid\":\"${SVM_UUID}\"},\"name\":\"data\",\"path\":\"/data\"}"
```

#### 단계 5: CIFS 마운트 및 데이터 수집

```bash
# SSM을 통해 Embedding EC2에 접속
EMBED_INSTANCE_ID=$(aws cloudformation describe-stacks \
  --stack-name ${STACK_PREFIX}-Embedding \
  --query 'Stacks[0].Outputs[?OutputKey==`EmbeddingInstanceId`].OutputValue' --output text)

# CIFS 마운트
SMB_IP=$(aws fsx describe-storage-virtual-machines --storage-virtual-machine-ids $SVM_ID \
  --query 'StorageVirtualMachines[0].Endpoints.Smb.IpAddresses[0]' --output text)

sudo mkdir -p /mnt/cifs-data
sudo mount -t cifs //${SMB_IP}/data /mnt/cifs-data \
  -o user=Admin,password=<AD_PASSWORD>,domain=demo.local,iocharset=utf8

# 문서 수집 (demo-data/documents와 동일한 구조)
sudo mkdir -p /mnt/cifs-data/{public,confidential,restricted}
# 각 문서와 .metadata.json 복사
```

#### 단계 6: OpenSearch Serverless 데이터 접근 정책 업데이트

Embedding EC2 IAM 역할을 AOSS 데이터 접근 정책에 추가해야 합니다.

```bash
# 현재 정책 버전 조회
POLICY_VERSION=$(aws opensearchserverless get-access-policy \
  --name "<COLLECTION_NAME>-dat" --type data \
  --query 'accessPolicyDetail.policyVersion' --output text --region ap-northeast-1)

# Embedding EC2 역할을 추가하여 정책 업데이트
# Principal 배열에 "arn:aws:iam::<ACCOUNT_ID>:role/<prefix>-embedding-role" 추가
aws opensearchserverless update-access-policy \
  --name "<COLLECTION_NAME>-dat" --type data \
  --policy-version "$POLICY_VERSION" \
  --policy '<updated_policy_json>' \
  --region ap-northeast-1
```

#### 단계 7: Embedding 컨테이너 실행

```bash
# ECR에서 이미지 풀
sudo aws ecr get-login-password --region ap-northeast-1 | \
  sudo docker login --username AWS --password-stdin <ACCOUNT_ID>.dkr.ecr.ap-northeast-1.amazonaws.com
sudo docker pull ${ECR_URI}:latest

# 컨테이너 실행
sudo docker run -d --name embed-app \
  -v /mnt/cifs-data:/opt/netapp/ai/data \
  -v /tmp/embed-db:/opt/netapp/ai/db \
  -e ENV_REGION=ap-northeast-1 \
  -e ENV_OPEN_SEARCH_SERVERLESS_COLLECTION_NAME=<COLLECTION_NAME> \
  -e ENV_EMBEDDING_MODEL_ID=amazon.titan-embed-text-v2:0 \
  -e ENV_INDEX_NAME=bedrock-knowledge-base-default-index \
  ${ECR_URI}:latest

# 로그 확인
sudo docker logs -f embed-app
```

### Embedding 애플리케이션 구조

```
docker/embed/
├── Dockerfile          # node:22-slim 기반, cifs-utils 포함
├── package.json        # AWS SDK v3, chokidar, dotenv
├── tsconfig.json
├── buildspec.yml       # CodeBuild 빌드 정의
├── .env                # 기본 환경 변수
└── src/
    ├── index.ts        # 메인: 문서 스캔 → 청크 분할 → embedding → 인덱싱
    └── oss-client.ts   # OpenSearch Serverless SigV4 서명 클라이언트 (IMDS 인증 지원)
```

### 처리 흐름

1. CIFS 마운트된 디렉토리를 재귀적으로 스캔 (.md, .txt, .html 등)
2. 각 문서의 `.metadata.json`에서 SID 정보 읽기
3. 텍스트를 1000자 청크로 분할 (200자 오버랩)
4. Bedrock Titan Embed Text v2로 1024차원 벡터 생성
5. Bedrock KB 호환 형식으로 OpenSearch Serverless에 인덱싱
6. 처리된 파일을 `processed.json`에 기록 (증분 처리 지원)

---

## 7. API 엔드포인트

| 메서드 | 경로 | 설명 |
|---|---|---|
| POST | `/api/auth/signin` | 로그인 (Cognito 인증) |
| POST | `/api/auth/signout` | 로그아웃 |
| GET | `/api/auth/session` | 세션 정보 조회 |
| GET | `/api/bedrock/models` | 사용 가능한 모델 목록 |
| POST | `/api/bedrock/chat` | 채팅 |
| POST | `/api/bedrock/kb/retrieve` | RAG 검색 (SID 필터링 포함) |
| GET | `/api/health` | 헬스 체크 |

---

## 8. 설정 절차 (배포 후)

```bash
STACK_PREFIX="perm-rag-demo-demo"

# 1. 리소스 ID 조회
COGNITO_USER_POOL_ID=$(aws cloudformation describe-stacks \
  --stack-name ${STACK_PREFIX}-Security \
  --query 'Stacks[0].Outputs[?contains(OutputKey,`UserPoolId`)].OutputValue' --output text)
USER_ACCESS_TABLE_NAME=$(aws cloudformation describe-stacks \
  --stack-name ${STACK_PREFIX}-Storage \
  --query 'Stacks[0].Outputs[?OutputKey==`UserAccessTableName`].OutputValue' --output text)
DATA_BUCKET_NAME=$(aws cloudformation describe-stacks \
  --stack-name ${STACK_PREFIX}-Storage \
  --query 'Stacks[0].Outputs[?OutputKey==`DataBucketName`].OutputValue' --output text)
BEDROCK_KB_ID=$(aws cloudformation describe-stacks \
  --stack-name ${STACK_PREFIX}-AI \
  --query 'Stacks[0].Outputs[?OutputKey==`KnowledgeBaseId`].OutputValue' --output text)

# 2. 테스트 사용자 생성
export COGNITO_USER_POOL_ID
bash demo-data/scripts/create-demo-users.sh

# 3. SID 데이터 등록 (앱의 JWT에서 이메일 주소가 userId로 사용됨)
export USER_ACCESS_TABLE_NAME
bash demo-data/scripts/setup-user-access.sh

# 4. 테스트 데이터 업로드
export DATA_BUCKET_NAME
bash demo-data/scripts/upload-demo-data.sh

# 5. KB 동기화
export BEDROCK_KB_ID
bash demo-data/scripts/sync-kb-datasource.sh
```

---

## 9. 문제 해결

| 증상 | 원인 | 해결 방법 |
|------|------|----------|
| 로그인 불가 | Cognito 사용자 미생성 | `create-demo-users.sh` 실행 |
| KB 검색 결과 없음 | 데이터 소스 미동기화 | `sync-kb-datasource.sh` 실행 |
| 모든 문서 거부됨 | SID 데이터 미등록 | `setup-user-access.sh` 실행 |
| SVM AD 가입이 MISCONFIGURED | OU 미지정 또는 SG 부족 | OU 경로 명시적 지정 + FSx/AD SG 간 통신 허용 |
| Embedding 403 Forbidden | AOSS 데이터 접근 정책 누락 | AOSS 정책에 Embedding EC2 역할 추가 |
| Embedding 컨테이너 인증 오류 | IMDS hop limit 부족 | EC2 메타데이터 hop limit = 2 확인 |
| 페이지 미표시 | CloudFront 캐시 | `aws cloudfront create-invalidation --distribution-id <ID> --paths "/*"` |
| 콜드 스타트 지연 | Lambda 초기 시작 | 10~15초 대기 (정상 동작) |


---

## 환경 삭제

### 삭제 시 주의사항

`cdk destroy --all`로 모든 리소스를 삭제할 수 있지만, 다음 의존성으로 인해 수동 개입이 필요할 수 있습니다.

| 문제 | 원인 | CDK 처리 |
|------|------|---------|
| AI 스택 삭제 실패 | KB에 데이터 소스 잔존 | ✅ KbCleanup 커스텀 리소스가 자동 삭제 |
| Storage 스택 삭제 실패 | 볼륨에 S3 AP 첨부됨 | ✅ S3 AP 커스텀 리소스 Delete 핸들러가 자동 삭제 |
| Networking 스택 삭제 실패 | AD Controller SG가 고아 상태 | ❌ 수동 삭제 필요 (아래 스크립트 참조) |
| Embedding 스택 미인식 | CDK 컨텍스트에 의존 | ❌ 먼저 수동 삭제 |
| 수동 생성 리소스 잔존 | CodeBuild, ECR, IAM 정책 | ❌ 아래 스크립트로 삭제 |

### 권장 삭제 절차

```bash
# 1. Embedding 스택 삭제 (존재하는 경우)
aws cloudformation delete-stack --stack-name perm-rag-demo-demo-Embedding --region ap-northeast-1 2>/dev/null
aws cloudformation wait stack-delete-complete --stack-name perm-rag-demo-demo-Embedding --region ap-northeast-1 2>/dev/null

# 2. KB 데이터 소스 삭제
KB_ID=$(aws cloudformation describe-stacks --stack-name perm-rag-demo-demo-AI --region ap-northeast-1 \
  --query 'Stacks[0].Outputs[?OutputKey==`KnowledgeBaseId`].OutputValue' --output text 2>/dev/null)
if [ -n "$KB_ID" ] && [ "$KB_ID" != "None" ]; then
  for DS_ID in $(aws bedrock-agent list-data-sources --knowledge-base-id $KB_ID --region ap-northeast-1 \
    --query 'dataSourceSummaries[].dataSourceId' --output text 2>/dev/null); do
    aws bedrock-agent delete-data-source --knowledge-base-id $KB_ID --data-source-id $DS_ID --region ap-northeast-1
  done
  sleep 10
fi

# 3. S3 AP 삭제
aws fsx detach-and-delete-s3-access-point --name perm-rag-demo-s3ap --region ap-northeast-1 2>/dev/null
sleep 30

# 4. CDK destroy
npx cdk destroy --all --app "npx ts-node bin/demo-app.ts" --force

# 5. 고아 AD SG 삭제 (Managed AD 사용 시)
VPC_ID=$(aws ec2 describe-vpcs --filters "Name=tag:Name,Values=*perm-rag*" --region ap-northeast-1 \
  --query 'Vpcs[0].VpcId' --output text 2>/dev/null)
if [ -n "$VPC_ID" ] && [ "$VPC_ID" != "None" ]; then
  for SG_ID in $(aws ec2 describe-security-groups --filters "Name=vpc-id,Values=$VPC_ID" "Name=group-name,Values=d-*_controllers" \
    --region ap-northeast-1 --query 'SecurityGroups[].GroupId' --output text 2>/dev/null); do
    aws ec2 delete-security-group --group-id $SG_ID --region ap-northeast-1
  done
  # Networking 스택 삭제 재시도
  aws cloudformation delete-stack --stack-name perm-rag-demo-demo-Networking --region ap-northeast-1
  aws cloudformation wait stack-delete-complete --stack-name perm-rag-demo-demo-Networking --region ap-northeast-1
fi
```