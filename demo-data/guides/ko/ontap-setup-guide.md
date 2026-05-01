# FSx ONTAP + Active Directory 연동 및 CIFS 공유 설정 가이드

**Last updated**: 2026-04-04

---

## 10. ONTAP Name-Mapping 설정 (UNIX→Windows 사용자 매핑)

```bash
# Get SVM UUID
SVM_UUID=$(aws fsx describe-storage-virtual-machines \
  --region ap-northeast-1 \
  --query 'StorageVirtualMachines[?FileSystemId==`<FS_ID>`].UUID' \
  --output text)

# Create name-mapping rule (UNIX→Windows)
MGMT_IP=<FSx Management Endpoint IP>
curl -sk -X POST -u "fsxadmin:${ADMIN_PASSWORD}" \
  -H "Content-Type: application/json" \
  "https://${MGMT_IP}/api/name-services/name-mappings" \
  -d '{
    "svm": {"uuid": "'${SVM_UUID}'"},
    "direction": "unix_win",
    "index": 1,
    "pattern": "alice",
    "replacement": "DEMO\\alice"
  }'

# Verify rules
curl -sk -u "fsxadmin:${ADMIN_PASSWORD}" \
  "https://${MGMT_IP}/api/name-services/name-mappings?svm.uuid=${SVM_UUID}&direction=unix_win&fields=pattern,replacement"
```

### cdk.context.json

```json
{
  "ontapNameMappingEnabled": true,
  "ontapMgmtIp": "<Management Endpoint IP>",
  "ontapSvmUuid": "<SVM UUID>",
  "ontapAdminSecretArn": "arn:aws:secretsmanager:ap-northeast-1:<ACCOUNT>:secret:<SECRET>"
}
```

### Setup Scripts

```bash
bash demo-data/scripts/setup-ontap-namemapping.sh
bash demo-data/scripts/verify-ontap-namemapping.sh
```

| Item | Details |
|------|---------|
| Management Endpoint | VPC internal access only |
| fsxadmin password | Must be set via `aws fsx update-file-system` |
| Security Group | Port 443 inbound required (VPC CIDR or Lambda SG) |
| Secrets Manager | fsxadmin password stored as plain text string |
| ONTAP version | Verified on ONTAP 9.17.1P4 |

---

## 운영 자동화 (선택 사항)

Lambda + Step Functions를 사용한 독립형 자동화 스위트가 `automation/fsxn-ops/`에 있습니다.

### 전제 조건

- VPC 엔드포인트 (5개 필수): `secretsmanager`, `fsx`, `monitoring`, `sns` (Interface) + `s3` (Gateway)
- Secrets Manager: `{"username": "fsxadmin", "password": "xxx"}` 형식
- fsxadmin 비밀번호가 Secrets Manager와 FSx ONTAP 간에 일치해야 함

### 기능

| 기능 | 설명 |
|------|------|
| 용량 모니터링 | EventBridge 5분 간격, 자동 확장 + SNS 알림 |
| SnapMirror DR | Step Functions 페일오버/페일백 오케스트레이션 |
| ONTAP API 실행 | Lambda를 통한 안전한 ONTAP REST API 실행 |
| 데이터 전처리 | FSx ONTAP S3 Access Point를 통한 AI/분석 전처리 |

자세한 내용: [automation/fsxn-ops/README.md](../../automation/fsxn-ops/README.md)
