# FSx for NetApp ONTAP Ops Automation

**[日本語](README.ja.md)**

Serverless automation for Amazon FSx for NetApp ONTAP using Lambda, Step Functions, and EventBridge. Uses [FSx for ONTAP S3 Access Points](https://docs.aws.amazon.com/fsx/latest/ONTAPGuide/accessing-data-via-s3-access-points.html) for data-path operations and ONTAP REST API for control-plane/storage management.

**Verified**: ONTAP 9.17.1P4D3, all phases PASS ([verification report](docs/aws-verification-report.md)).

## Use Cases

| # | Use Case | Implementation | Trigger |
|---|----------|----------------|---------|
| 1 | AI/analytics data preprocessing | Lambda + S3 Access Point + ONTAP REST API | EventBridge / App |
| 2 | Capacity monitoring & auto-expansion | Lambda + EventBridge (5-min interval) | Scheduled |
| 3 | Volume-level SnapMirror failover/failback | Step Functions + Lambda | Manual / API |
| 4 | Generic ONTAP REST API execution | Lambda | API Gateway / Manual |

## Quick Start

### Prerequisites

- FSx for NetApp ONTAP filesystem (any deployment type)
- `fsxadmin` password stored in Secrets Manager: `{"username": "fsxadmin", "password": "xxx"}`
- VPC with private subnet and security group allowing HTTPS (443) to ONTAP management LIF
- **No dependency on the parent RAG project** — this directory is self-contained

### Deploy

```bash
# Clone just this directory (or the full repo)
git clone https://github.com/Yoshiki0705/FSx-for-ONTAP-Agentic-Access-Aware-RAG.git
cd FSx-for-ONTAP-Agentic-Access-Aware-RAG/automation/fsxn-ops

# Deploy CloudFormation stack
aws cloudformation deploy \
  --template-file cfn/fsxn-ops-stack.yaml \
  --stack-name fsxn-ops \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    FsxFilesystemId=<FSX_FILESYSTEM_ID> \
    ManagementLif=<MANAGEMENT_LIF_IP> \
    OntapSecretId=<SECRETS_MANAGER_SECRET_ARN> \
    VpcId=<VPC_ID> \
    SubnetIds=<PRIVATE_SUBNET_ID> \
    SecurityGroupId=<SECURITY_GROUP_ID> \
    NotificationEmail=<YOUR_EMAIL>

# Deploy Lambda code (CFn creates functions with placeholder code)
cd lambda
for module in capacity_monitor snapmirror_ops ontap_api_executor data_preprocessor; do
  zip -r /tmp/${module}.zip common/ ${module}/
  aws lambda update-function-code \
    --function-name "fsxn-ops-${module//_/-}" \
    --zip-file "fileb:///tmp/${module}.zip"
done
```

### Test

```bash
# Unit tests (38 tests)
pip install -r requirements.txt
pytest tests/ -v

# AWS integration tests (auto-deploys, tests, cleans up)
bash tests/integration/run_aws_verification.sh
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Orchestration: EventBridge Scheduler / Step Functions   │
├─────────────────────────────────────────────────────────┤
│  Compute: Lambda (Python 3.12, VPC-deployed)            │
├──────────────────────┬──────────────────────────────────┤
│  Data Path:          │  Control Plane:                  │
│  FSx ONTAP S3 AP     │  ONTAP REST API                  │
│  (ListObjectsV2,     │  (volumes, snapmirror,           │
│   GetObject,         │   snapshots, exports,            │
│   PutObject)         │   security style, ACLs)          │
├──────────────────────┴──────────────────────────────────┤
│  Storage: FSx for NetApp ONTAP (SMB/NFS + S3 AP)       │
└─────────────────────────────────────────────────────────┘
```

**Design principles:**
- **Scheduled polling, not file-change triggers** — FSx ONTAP S3 Access Points [do not support `GetBucketNotificationConfiguration`](https://docs.aws.amazon.com/fsx/latest/ONTAPGuide/access-points-for-fsxn-object-api-support.html)
- **S3 Access Points for data-path** — file listing, content access, sidecar writes via supported S3 object APIs
- **ONTAP REST API for control-plane** — volume resize, SnapMirror, snapshots, ACLs, export policies
- **TLS verification enabled by default** — `ONTAP_VERIFY_SSL=true` with optional `ONTAP_CA_CERT_PATH` for production; `false` for lab/PoC only

## VPC Endpoints (Private-Subnet Deployment)

Required when Lambda is deployed in a private subnet with no NAT Gateway:

| Service | Type | Purpose |
|---------|------|---------|
| `com.amazonaws.{region}.secretsmanager` | Interface | ONTAP credentials |
| `com.amazonaws.{region}.fsx` | [Interface](https://docs.aws.amazon.com/fsx/latest/ONTAPGuide/fsx-vpc-endpoints.html) | FSx API |
| `com.amazonaws.{region}.monitoring` | Interface | CloudWatch metrics |
| `com.amazonaws.{region}.sns` | Interface | SNS notifications |
| `com.amazonaws.{region}.s3` | [Gateway](https://docs.aws.amazon.com/AmazonS3/latest/userguide/privatelink-interface-endpoints.html) | S3 Access Point data-path |

> S3 Gateway endpoint must be associated with the Lambda subnet's route table.
> Set `CreateVpcEndpoints=true` in CFn parameters to auto-create, or `false` if endpoints already exist.

## Capacity Monitoring Guardrails

| Parameter | Default | Purpose |
|-----------|---------|---------|
| `DRY_RUN` | `true` | Safe default — logs without executing |
| `MAX_GROW_PER_ACTION_PCT` | 50% | Max growth rate per single action |
| `MAX_GROW_PER_DAY_GIB` | 500 GiB | Max total daily expansion |
| `VOL_THRESHOLD_PCT` | 80% | Aligned with [AWS recommendation](https://docs.aws.amazon.com/fsx/latest/ONTAPGuide/managing-storage-capacity.html) |

## SnapMirror Scope

This automation handles **volume-level SnapMirror planned failover/failback**. It is not a complete SVM-DR solution. See [NetApp SVM-DR docs](https://docs.netapp.com/us-en/ontap/data-protection/snapmirror-svm-replication-concept.html) for full SVM disaster recovery.

## Directory Structure

```
fsxn-ops/
├── README.md                    # This file
├── README.ja.md                 # Japanese version
├── requirements.txt             # Python dependencies (test)
├── pytest.ini                   # Test configuration
├── cfn/
│   └── fsxn-ops-stack.yaml     # CloudFormation template (VPC endpoints + Lambda + SFn + EventBridge)
├── stepfunctions/
│   ├── snapmirror-failover.asl.json
│   └── snapmirror-failback.asl.json
├── lambda/
│   ├── common/
│   │   ├── ontap_client.py     # ONTAP REST API client (Secrets Manager auth, TLS options)
│   │   └── fsx_helpers.py      # FSx API helper (describe, resize, CloudWatch metrics)
│   ├── capacity_monitor/       # Scheduled capacity monitoring with guardrails
│   ├── ontap_api_executor/     # Generic ONTAP REST API executor with security controls
│   ├── snapmirror_ops/         # 10 SnapMirror actions (discover, initialize, break, resync, etc.)
│   └── data_preprocessor/      # S3 AP scan + ONTAP metadata collection + task generation
├── tests/
│   ├── test_*.py               # 38 unit tests
│   └── integration/
│       ├── run_aws_verification.sh    # Auto-deploy, test, cleanup
│       ├── test_ontap_connectivity.py # ONTAP API connectivity test Lambda
│       └── test_snapmirror_e2e.py     # SnapMirror E2E test Lambda
├── iam/
│   └── roles.yaml              # IAM role definitions (reference)
├── eventbridge/
│   └── schedules.yaml          # EventBridge schedule definitions (reference)
└── docs/
    ├── aws-verification-report.md
    └── why-this-makes-fsxn-easier.md
```

## Cost

| Component | Monthly |
|-----------|---------|
| Lambda + Step Functions + EventBridge + Secrets Manager + CloudWatch | **~$2.60** |
| VPC Interface Endpoints (4 × ~$7.30/AZ) | ~$29-58 |
| S3 Gateway Endpoint | $0.00 |

> VPC endpoints are the dominant cost if created solely for this suite. If your VPC already has them, incremental cost is ~$2.60/month.

## References

- [FSx ONTAP S3 Access Points](https://docs.aws.amazon.com/fsx/latest/ONTAPGuide/accessing-data-via-s3-access-points.html)
- [S3 AP Supported Operations](https://docs.aws.amazon.com/fsx/latest/ONTAPGuide/access-points-for-fsxn-object-api-support.html)
- [SnapMirror Failover Orchestration (aws-samples)](https://github.com/aws-samples/sample-fsx-ontap-failover-and-failback-orchestration)
- [FSx ONTAP Samples & Scripts (NetApp)](https://github.com/NetApp/FSx-ONTAP-samples-scripts)
- [FSx ONTAP Monitoring & Auto-Resizing (NetApp)](https://docs.netapp.com/us-en/netapp-solutions-dataops/automation/fsxn-monitoring-resizing.html)

## Troubleshooting

See [README.ja.md](README.ja.md#トラブルシューティング-検証で得た知見) for detailed troubleshooting guide (Japanese).

Key issues:
- **Lambda timeout on AWS API calls** → Missing VPC endpoints (see table above)
- **ONTAP REST API 401** → fsxadmin password mismatch between Secrets Manager and FSx ONTAP
- **SnapMirror stays uninitialized** → Explicit `POST /transfers` needed after relationship creation
- **CloudWatch metrics unavailable** → Normal for new filesystems; monitor falls back to ONTAP REST API

## License

Apache License 2.0 — see [LICENSE](../../LICENSE) in the parent repository.
