# FSx for ONTAP + Active Directory Integration & CIFS Share Setup Guide

**Last updated**: 2026-04-04

---

## 10. ONTAP Name-Mapping Configuration (UNIX→Windows User Mapping)

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

## Ops Automation (Optional)

A standalone automation suite using Lambda + Step Functions is available at `automation/fsxn-ops/`. It can be deployed independently from the CDK stacks.

### Deploy

```bash
aws cloudformation deploy \
  --template-file automation/fsxn-ops/cfn/fsxn-ops-stack.yaml \
  --stack-name fsxn-ops \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    FsxFilesystemId=<FSX_FILESYSTEM_ID> \
    ManagementLif=<MANAGEMENT_LIF_IP> \
    OntapSecretId=<SECRETS_MANAGER_SECRET_ARN> \
    VpcId=<VPC_ID> SubnetIds=<PRIVATE_SUBNET_ID> \
    SecurityGroupId=<SECURITY_GROUP_ID> \
    NotificationEmail=<YOUR_EMAIL>
```

### Prerequisites

- VPC Endpoints (5 required): `secretsmanager`, `fsx`, `monitoring`, `sns` (Interface) + `s3` (Gateway)
  - S3 Gateway endpoint must be associated with Lambda subnet route table
- Secrets Manager: `{"username": "fsxadmin", "password": "xxx"}` format
- fsxadmin password must match between Secrets Manager and FSx for ONTAP

### Features

| Feature | Description |
|---------|-------------|
| Capacity Monitoring | EventBridge 5-min interval, auto-expansion + SNS notification |
| SnapMirror DR | Step Functions failover/failback orchestration |
| ONTAP API Execution | Safe ONTAP REST API execution via Lambda |
| Data Preprocessing | AI/analytics preprocessing via FSx for ONTAP S3 Access Point |

### FSx for ONTAP S3 Access Point

```bash
aws fsx create-and-attach-s3-access-point \
  --name my-s3ap --type ONTAP \
  --ontap-configuration '{"VolumeId":"<VOLUME_ID>","FileSystemIdentity":{"Type":"UNIX","UnixUser":{"Name":"root"}}}'
```

Details: [automation/fsxn-ops/README.md](../../automation/fsxn-ops/README.md)
