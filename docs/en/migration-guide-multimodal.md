# Migration Guide: Multimodal RAG Search

**🌐 Language:** [日本語](../migration-guide-multimodal.md) | **English**

This guide explains the migration steps from `titan-text-v2` (text-only) to `nova-multimodal` (multimodal).

## Prerequisites

- The embedding model is a deploy-time configuration at the Knowledge Base level and cannot be switched at runtime
- Changing the model requires recreating the KB and fully re-ingesting all data
- `nova-multimodal` is only available in us-east-1 and us-west-2

## Pre-Migration Checklist

- [ ] Confirm your current deployment region supports `nova-multimodal` (us-east-1 / us-west-2)
- [ ] Check the current KB data volume (for estimating re-ingestion time)
- [ ] Confirm whether multimodal content (images, video, audio) exists in the S3 data source
- [ ] Confirm acceptable downtime window

## Estimated Re-Ingestion Time

| Data Volume | Text Only | Including Multimodal |
|-------------|-----------|---------------------|
| ~100 documents | 5-10 min | 15-30 min |
| ~1,000 documents | 30-60 min | 1-3 hours |
| ~10,000 documents | 3-6 hours | 6-12 hours |

※ Multimodal files (video, audio) take longer due to additional BDA Parser processing.

---

## Method 1: Gradual Migration with Dual KB (Recommended)

This approach lets you test multimodal search in parallel without interrupting existing text search.

### Step 1: Deploy in Dual KB Mode

```json
// cdk.context.json
{
  "embeddingModel": "nova-multimodal",
  "multimodalKbMode": "dual"
}
```

```bash
npx cdk deploy --all --require-approval never
```

This creates:
- Text-only KB (titan-text-v2) — identical to existing
- Multimodal KB (nova-multimodal) — new

### Step 2: Data Ingestion

Both KBs share the same S3 data source. Run KB ingestion:

```bash
bash demo-data/scripts/sync-kb-datasource.sh
```

### Step 3: Verification

- Use the UI toggle switch to compare text-only vs. multimodal search
- Confirm media type icons (📄🖼️🎥🔊) appear in multimodal search results
- Confirm permission filtering works correctly for both KBs

### Step 4: Switch to Single KB

After verifying multimodal search works correctly, switch to a single KB:

```json
// cdk.context.json
{
  "embeddingModel": "nova-multimodal",
  "multimodalKbMode": "replace"
}
```

```bash
npx cdk deploy --all --require-approval never
```

### Step 5: Clean Up the Old KB

When changing `multimodalKbMode` from `dual` to `replace`, the now-unnecessary text-only KB is not automatically deleted. A CfnOutput notification will indicate that manual deletion of the old KB is required.

Delete the old KB via the AWS Console or CLI:

```bash
aws bedrock-agent delete-knowledge-base --knowledge-base-id <OLD_KB_ID>
```

---

## Method 2: Direct Switch

A simpler procedure for cases where downtime is acceptable.

### Step 1: Update cdk.context.json

```json
{
  "embeddingModel": "nova-multimodal"
}
```

### Step 2: Deploy

```bash
npx cdk deploy --all --require-approval never
```

⚠️ The existing KB will be recreated, requiring full data re-ingestion. Search functionality will be unavailable until re-ingestion completes.

### Step 3: Data Ingestion

```bash
bash demo-data/scripts/sync-kb-datasource.sh
```

---

## Rollback Procedure

To revert from multimodal to text-only:

```json
// cdk.context.json
{
  "embeddingModel": "titan-text-v2"
}
```

```bash
npx cdk deploy --all --require-approval never
```

⚠️ The KB will be recreated, requiring data re-ingestion again.

---

## Troubleshooting

| Issue | Resolution |
|-------|-----------|
| Nova Multimodal not available in region | Deploy to us-east-1 or us-west-2 |
| Ingestion is slow | Multimodal files (video, audio) take longer due to BDA Parser processing. Recommend ingesting text files first |
| One KB fails in Dual KB mode | Check CloudWatch logs for each KB's ingestion status. Search continues on the healthy KB |
| Multimodal UI not showing | Confirm Lambda environment variable `MULTIMODAL_ENABLED=true` is set |
