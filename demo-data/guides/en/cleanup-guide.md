# Environment Cleanup Guide

This guide explains how to delete all resources in the Permission-aware RAG environment.

---

## Method 1: Automated Cleanup (Recommended)

Open a terminal and run the following commands in order.

### Step 1: Navigate to the project folder

```bash
cd ~/path/to/FSx-for-ONTAP-Agentic-Access-Aware-RAG
```

> 💡 Replace `~/path/to/` with the actual location where you cloned the project.

### Step 2: Preview what will be deleted (safe)

```bash
bash demo-data/scripts/cleanup-all.sh --dry-run
```

This command does not delete anything. It shows a list of resources that would be deleted.

### Step 3: Run the cleanup

```bash
bash demo-data/scripts/cleanup-all.sh
```

When prompted "続行しますか？ (yes/no):", type `yes` and press Enter.

> ⏱ Estimated time: 5–15 minutes depending on the number of resources.

### Step 4: Verify the result

If you see "✅ 全リソース削除完了" at the end, all resources have been successfully deleted.

If you see "⚠️ 一部リソースが残っています", check the error list and refer to Method 2 below.

---

## Method 2: Manual Deletion via AWS Console

If the automated script couldn't delete some resources, you can delete them manually from the AWS Console.

### Services to Check

Check the following AWS services in order. The region is **Tokyo (ap-northeast-1)** unless noted otherwise.

| # | Service | Where to Check | What to Delete |
|---|---------|---------------|----------------|
| 1 | CloudFormation | [Stacks](https://ap-northeast-1.console.aws.amazon.com/cloudformation/) | Stacks starting with `perm-rag-` |
| 2 | Bedrock | [Knowledge Bases](https://ap-northeast-1.console.aws.amazon.com/bedrock/home#/knowledge-bases) | KBs starting with `perm-rag-` |
| 3 | Bedrock | [Agents](https://ap-northeast-1.console.aws.amazon.com/bedrock/home#/agents) | Agents starting with `perm-rag-` |
| 4 | S3 | [Buckets](https://s3.console.aws.amazon.com/s3/buckets) | Buckets starting with `perm-rag-` |
| 5 | ECR | [Repositories](https://ap-northeast-1.console.aws.amazon.com/ecr/repositories) | `permission-aware-rag-webapp` |
| 6 | EC2 | [Instances](https://ap-northeast-1.console.aws.amazon.com/ec2/home#Instances) | Instances tagged with `perm-rag-` |

> ⚠️ The WAF stack is in **N. Virginia (us-east-1)**. Switch regions to check.

### If a Bedrock Knowledge Base Won't Delete

If you see "DELETE_UNSUCCESSFUL":

1. Open the Knowledge Base
2. Select the "Data sources" tab
3. Click "Edit" on each data source
4. Change "Data deletion policy" to "Retain" and save
5. Delete the data source
6. Once all data sources are gone, delete the Knowledge Base

---

## Post-Cleanup Verification

To verify all resources have been deleted:

```bash
bash demo-data/scripts/cleanup-all.sh --dry-run
```

If nothing is listed, all resources have been successfully removed.

---

## FAQ

### Q: Will FSx for ONTAP be deleted?

If you deployed with `existingFileSystemId`, the FSx for ONTAP file system itself will NOT be deleted (it's outside CDK management). Delete it manually from the AWS Console if needed.

### Q: Should I delete CDKToolkit?

CDKToolkit is shared across CDK projects. If this is a dedicated AWS account for this project, it's safe to delete. If you have other CDK projects, skip CDKToolkit deletion.

### Q: Does deletion cost anything?

The deletion operations themselves are free. However, resources continue to incur costs until deletion is complete.
