# Transfer Family 파트너 온보딩 가이드

**🌐 Language:** [日本語](../transfer-family-partner-onboarding.md) | [English](../en/transfer-family-partner-onboarding.md) | **한국어** | [简体中文](../zh-CN/transfer-family-partner-onboarding.md) | [繁體中文](../zh-TW/transfer-family-partner-onboarding.md) | [Français](../fr/transfer-family-partner-onboarding.md) | [Deutsch](../de/transfer-family-partner-onboarding.md) | [Español](../es/transfer-family-partner-onboarding.md)

**최종 업데이트**: 2026-05-23  
**대상**: 외부 파트너(법무 법인, 감사 법인, 규제 기관 등)의 SFTP 액세스 설정

---

## 개요

이 가이드에서는 AWS Transfer Family를 사용하여 외부 파트너가 SFTP를 통해 문서를 업로드하고 Permission-aware RAG Knowledge Base에 자동으로 수집되기까지의 설정 절차를 설명합니다.

### 아키텍처

```
파트너 (SFTP) → Transfer Family → FSx for ONTAP S3 AP → Metadata Generator → Bedrock KB
```

파트너는 SFTP 클라이언트만으로 작업할 수 있습니다. 웹 UI나 AWS 콘솔에 대한 액세스는 필요하지 않습니다.

---

## 1. 사전 조건

### 시스템 관리자 측

- [x] `enableTransferFamily=true` 로 CDK 배포 완료
- [x] S3 Access Point 가 FSx for ONTAP 볼륨에 연결 완료
- [x] DynamoDB 권한 매핑 테이블에 파트너의 권한 설정 등록 완료

### 파트너 측

- [x] SFTP 클라이언트(FileZilla, WinSCP, OpenSSH 등)
- [x] SSH 키 페어(RSA 4096bit 또는 Ed25519)

---

## 2. SSH 키 준비

### 파트너가 키를 생성하는 경우

```bash
# RSA 4096bit（推奨: 互換性が高い）
ssh-keygen -t rsa -b 4096 -f ~/.ssh/transfer-family-key -N ""

# Ed25519（推奨: より安全、短い鍵長）
ssh-keygen -t ed25519 -f ~/.ssh/transfer-family-key -N ""
```

생성된 **공개 키**(`~/.ssh/transfer-family-key.pub`)를 시스템 관리자에게 전송하십시오.

> **보안 주의**: 개인 키(`~/.ssh/transfer-family-key`)는 절대로 공유하지 마십시오.

### 시스템 관리자가 키를 등록하는 경우

```bash
# パートナーから受け取った公開鍵を Transfer Family ユーザーに登録
aws transfer import-ssh-public-key \
  --server-id s-XXXXXXXXXXXXXXXXX \
  --user-name partner-a \
  --ssh-public-key-body "$(cat partner-a-public-key.pub)" \
  --region ap-northeast-1
```

---

## 3. SFTP 연결 파라미터

파트너에게 다음 연결 정보를 제공하십시오:

| 파라미터 | 값 |
|-----------|-----|
| 호스트 | `s-XXXXXXXXXXXXXXXXX.server.transfer.ap-northeast-1.amazonaws.com` |
| 포트 | `22` |
| 프로토콜 | SFTP |
| 사용자 이름 | `partner-a`(관리자가 할당) |
| 인증 방식 | SSH 공개 키 인증 |
| 홈 디렉터리 | `/uploads/partner-a/` |

### 연결 명령(OpenSSH)

```bash
sftp -i ~/.ssh/transfer-family-key \
  -o StrictHostKeyChecking=no \
  -o HostKeyAlgorithms=rsa-sha2-256,rsa-sha2-512 \
  -o PubkeyAcceptedAlgorithms=+ssh-rsa \
  partner-a@s-XXXXXXXXXXXXXXXXX.server.transfer.ap-northeast-1.amazonaws.com
```

### FileZilla 설정

1. **사이트 관리자** → 새 사이트
2. 프로토콜: **SFTP**
3. 호스트: `s-XXXXXXXXXXXXXXXXX.server.transfer.ap-northeast-1.amazonaws.com`
4. 로그온 유형: **키 파일**
5. 사용자: `partner-a`
6. 키 파일: 개인 키의 경로 지정

### WinSCP 설정

1. **새 세션**
2. 파일 프로토콜: **SFTP**
3. 호스트 이름: Transfer Family 엔드포인트
4. 사용자 이름: `partner-a`
5. **고급 설정** → SSH → 인증 → 개인 키 파일 지정

---

## 4. 파일 업로드 절차

### 디렉터리 구조

파트너의 홈 디렉터리는 `/uploads/partner-a/` 로 제한됩니다.

```
/uploads/partner-a/
├── contracts/          ← 계약서
├── reports/            ← 보고서
├── correspondence/     ← 통신 문서
└── misc/               ← 기타
```

### 업로드 작업

```bash
# SFTP接続後
sftp> cd /uploads/partner-a/contracts
sftp> put local-contract.pdf
sftp> put -r local-folder/    # ディレクトリごとアップロード
sftp> ls                      # アップロード確認
```

### 파일 명명 규칙

| 규칙 | 설명 |
|--------|------|
| 확장자 | `.pdf`, `.docx`, `.txt`, `.md`, `.html` 권장 |
| 파일 이름 | 영숫자, 하이픈, 밑줄 사용 |
| 크기 상한 | 5 GB(S3 Access Point 의 제한) |
| 금지 작업 | 파일 이름 변경(rename), 추가 기록(append)은 미지원 |

### 제한 사항

- **`.metadata.json` 파일의 생성·변경·삭제는 금지**되어 있습니다(IAM Deny)
- 권한 메타데이터는 시스템이 자동 생성합니다
- 파일의 rename/append 작업은 S3 Access Point 의 제한으로 인해 미지원입니다

---

## 5. 인제스트(수집) 확인

업로드 후 다음 타임라인으로 처리됩니다:

| 단계 | 소요 시간 | 설명 |
|---------|---------|------|
| 파일 감지 | 최대 5분 | EventBridge Scheduler 에 의한 폴링 |
| 메타데이터 생성 | 수 초 | `.metadata.json` 자동 생성 |
| KB 인제스트 | 1-5분 | Bedrock Knowledge Base 로의 수집 |
| RAG 검색 가능 | 즉시 | 인제스트 완료 후 |

### 확인 방법(시스템 관리자용)

```bash
# 最新のインジェスションジョブ確認
aws bedrock-agent list-ingestion-jobs \
  --knowledge-base-id XXXXXXXXXX \
  --data-source-id XXXXXXXXXX \
  --region ap-northeast-1 \
  --query 'ingestionJobSummaries[0]'
```

---

## 6. 문제 해결

### 연결할 수 없음

| 증상 | 원인 | 대처 |
|------|------|------|
| `Permission denied (publickey)` | SSH 키가 미등록이거나 불일치 | 관리자에게 공개 키 재등록 요청 |
| `Connection timed out` | 네트워크 제한(IP 허용 목록) | 관리자에게 IP 주소 추가 요청 |
| `no matching host key type found` | HostKeyAlgorithms 불일치 | `-o HostKeyAlgorithms=rsa-sha2-256,rsa-sha2-512` 추가 |

### 업로드할 수 없음

| 증상 | 원인 | 대처 |
|------|------|------|
| `put` 시 `Permission denied` | 홈 디렉터리 외부에 대한 액세스 | `/uploads/partner-a/` 하위에 업로드 |
| `.metadata.json` 에 대한 `Permission denied` | IAM Deny 정책 | 메타데이터 파일 작업은 금지(정상 동작) |
| `File too large` | 5GB 제한 초과 | 파일을 분할하여 업로드 |

### 파일이 RAG 에 반영되지 않음

| 증상 | 원인 | 대처 |
|------|------|------|
| 5분 이상 경과해도 반영되지 않음 | 폴링 간격 대기 또는 Lambda 오류 | 관리자에게 CloudWatch Logs 확인 요청 |
| 인제스트 작업이 FAILED | 파일 형식 미지원 | 지원 형식(PDF, DOCX, TXT, MD, HTML) 확인 |

---

## 7. 보안 모델

### 파트너의 액세스 범위

```
✅ 許可: /uploads/partner-a/ 配下の読み書き
❌ 拒否: 他パートナーのディレクトリ
❌ 拒否: .metadata.json の作成・変更・削除
❌ 拒否: ホームディレクトリ外のアクセス
```

### 권한 메타데이터의 자동 생성

파트너가 파일을 업로드하면 시스템이 자동으로 `.metadata.json` 을 생성합니다:

```json
{
  "allowed_sids": ["S-1-5-21-xxx-1001"],
  "allowed_uids": ["1001"],
  "allowed_gids": ["1001"],
  "source": "transfer-family",
  "uploaded_by": "partner-a",
  "uploaded_at": "2026-05-23T10:30:00Z"
}
```

이 권한 정보는 DynamoDB 의 관리자 설정 테이블에서 도출됩니다. 파트너가 직접 권한을 지정할 수는 없습니다.

---

## 8. 관리자용: 파트너 추가 절차

### 신규 파트너 추가

```bash
# 1. DynamoDB 権限マッピングに登録
aws dynamodb put-item \
  --table-name ${PREFIX}-transfer-permission-mapping \
  --item '{
    "userName": {"S": "partner-b"},
    "allowed_sids": {"L": [{"S": "S-1-5-21-xxx-2001"}]},
    "allowed_uids": {"L": [{"S": "2001"}]},
    "allowed_gids": {"L": [{"S": "2001"}]},
    "description": {"S": "Partner B - Audit Firm"}
  }' \
  --region ap-northeast-1

# 2. Transfer Family ユーザー作成（CDK再デプロイ or CLI）
# cdk.context.json の transferFamilyUsers に追加してデプロイ
# または CLI で直接作成:
aws transfer create-user \
  --server-id s-XXXXXXXXXXXXXXXXX \
  --user-name partner-b \
  --role arn:aws:iam::ACCOUNT:role/${PREFIX}-transfer-user-role \
  --home-directory-type LOGICAL \
  --home-directory-mappings '[{"Entry":"/","Target":"/${S3_AP_ALIAS}/uploads/partner-b"}]' \
  --region ap-northeast-1

# 3. SSH公開鍵の登録
aws transfer import-ssh-public-key \
  --server-id s-XXXXXXXXXXXXXXXXX \
  --user-name partner-b \
  --ssh-public-key-body "$(cat partner-b-public-key.pub)" \
  --region ap-northeast-1
```

### 파트너 비활성화

```bash
# SSH鍵を削除（接続不可にする）
aws transfer delete-ssh-public-key \
  --server-id s-XXXXXXXXXXXXXXXXX \
  --user-name partner-b \
  --ssh-public-key-id key-XXXXXXXXXXXXXXXXX \
  --region ap-northeast-1
```

---

## 관련 문서

- [Transfer Family E2E 검증 보고서](transfer-family-e2e-verification.md)
- [Transfer Family 네트워킹 사전 조건](transfer-family-networking-prerequisites.md)
- [AWS Transfer Family + FSx S3 AP 문서](https://docs.aws.amazon.com/transfer/latest/userguide/fsx-s3-access-points.html)
- [AWS Storage Blog: Secure SFTP file sharing](https://aws.amazon.com/blogs/storage/secure-sftp-file-sharing-with-aws-transfer-family-amazon-fsx-for-netapp-ontap-and-s3-access-points/)
