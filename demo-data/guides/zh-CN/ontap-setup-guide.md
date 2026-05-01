# FSx ONTAP + Active Directory 集成与 CIFS 共享设置指南

**Last updated**: 2026-04-04

---

## 10. ONTAP Name-Mapping 配置（UNIX→Windows 用户映射）

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

## 运维自动化（可选）

使用 Lambda + Step Functions 的独立自动化套件位于 `automation/fsxn-ops/`。

### 前提条件

- VPC 端点（5 个必需）：`secretsmanager`、`fsx`、`monitoring`、`sns`（Interface）+ `s3`（Gateway）
- Secrets Manager：`{"username": "fsxadmin", "password": "xxx"}` 格式
- fsxadmin 密码必须在 Secrets Manager 和 FSx ONTAP 之间保持一致

### 功能

| 功能 | 说明 |
|------|------|
| 容量监控 | EventBridge 5 分钟间隔，自动扩展 + SNS 通知 |
| SnapMirror DR | Step Functions 故障转移/恢复编排 |
| ONTAP API 执行 | 通过 Lambda 安全执行 ONTAP REST API |
| 数据预处理 | 通过 FSx ONTAP S3 Access Point 进行 AI/分析预处理 |

详情：[automation/fsxn-ops/README.md](../../automation/fsxn-ops/README.md)
