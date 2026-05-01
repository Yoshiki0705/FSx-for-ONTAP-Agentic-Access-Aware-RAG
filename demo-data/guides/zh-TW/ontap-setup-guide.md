# FSx ONTAP + Active Directory 整合與 CIFS 共享設定指南

**Last updated**: 2026-04-04

---

## 10. ONTAP Name-Mapping 設定（UNIX→Windows 使用者對應）

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

## 維運自動化（選用）

使用 Lambda + Step Functions 的獨立自動化套件位於 `automation/fsxn-ops/`。

### 前提條件

- VPC 端點（5 個必需）：`secretsmanager`、`fsx`、`monitoring`、`sns`（Interface）+ `s3`（Gateway）
- Secrets Manager：`{"username": "fsxadmin", "password": "xxx"}` 格式
- fsxadmin 密碼必須在 Secrets Manager 和 FSx ONTAP 之間保持一致

### 功能

| 功能 | 說明 |
|------|------|
| 容量監控 | EventBridge 5 分鐘間隔，自動擴展 + SNS 通知 |
| SnapMirror DR | Step Functions 故障轉移/恢復編排 |
| ONTAP API 執行 | 透過 Lambda 安全執行 ONTAP REST API |
| 資料預處理 | 透過 FSx ONTAP S3 Access Point 進行 AI/分析預處理 |

詳情：[automation/fsxn-ops/README.md](../../automation/fsxn-ops/README.md)
