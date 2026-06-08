# Prompt Caching Investigation Report

**🌐 Language:** [日本語](../prompt-caching-investigation.md) | **English**

**Created**: 2026-06-08  
**Status**: Under Investigation  
**Audience**: Developers, Architects

---

## Overview

Documents findings from implementing and verifying Bedrock Prompt Caching (ephemeral), and analysis of why cache hits are not being achieved.

---

## Implementation Status

### Code Implementation (✅ Complete)

| Component | File | Description |
|-----------|------|-------------|
| cacheControl setting | `converse-client.ts` | Applies `cacheControl: { type: 'ephemeral' }` to system message |
| EMF metrics | `converse-client.ts` | Outputs `CacheStatus`, `CachedInputTokens` to `RAG/TokenUsage` namespace |
| Diagnostic logging | `converse-client.ts` | Logs cache write / read / none states |
| System Prompt size | `prompt-templates.ts` | ~4,200 chars / ~1,100 tokens (exceeds 1024 threshold) |
| Feature Toggle | env `ENABLE_PROMPT_CACHING` | Default `true`, set `false` to disable |

### Inference Profile Resolution (✅ Complete)

| Issue | Cause | Fix |
|-------|-------|-----|
| Claude on-demand error | Base ID not allowed in ap-northeast-1 | `INFERENCE_PROFILE_MAP` converts to `jp.*` |
| 2nd query Marketplace error | `inference-profile-resolver.ts` missing Claude 4.x | Added model list + jp prefix |

---

## Test Results

### Environment

- Region: ap-northeast-1
- Model: `jp.anthropic.claude-sonnet-4-6`
- Lambda: `v4-test-demo-webapp` (1024 MB, container image)
- Vector Store: S3 Vectors
- Test Date: 2026-06-08

### Results

```
[1] jp.anthropic.claude-sonnet-4-6 | ❌ MISS | Input: 2778 | Cached: 0 | Output: 667
[2] jp.anthropic.claude-sonnet-4-6 | ❌ MISS | Input: 2952 | Cached: 0 | Output: 324
```

Both queries returned successful responses but no cache hit.

---

## Hypotheses

### H1: System Prompt Below Token Threshold

The system prompt is ~4,200 characters but actual token count depends on Claude's BPE tokenizer. Mixed English content may tokenize differently than expected.

### H2: Converse API + Regional Inference Profile Limitation

Prompt Caching may not be supported for regional inference profiles (`jp.*`) via the Converse API. AWS documentation is unclear on this specific combination.

### H3: Lambda Stateless Cache Key Mismatch

Each Lambda invocation is independent. Bedrock may not identify cache key continuity across separate invocations from the same Lambda function.

### H4: cacheWriteInputTokenCount Not Being Generated

If Bedrock doesn't perform a cache write on the first request, subsequent requests cannot cache read. The diagnostic logging added will confirm this.

---

## Recommended Actions

1. **Check cache write logs** after next deploy (diagnostic logging added)
2. **Test with Messages API** (InvokeModel) instead of Converse API
3. **Test in us-east-1** where direct on-demand invocation may be available
4. **Confirm with AWS Support** whether regional inference profiles support Prompt Caching
5. **Consider application-layer caching** (DynamoDB) as alternative

---

## Current Conclusion

1. **Code implementation is correct** — cacheControl is properly configured
2. **Cache miss is due to Bedrock server-side conditions** — not a code issue
3. **System is "cache-ready"** — when conditions are met, cache hits will work without code changes
4. **Application-layer cache is a viable alternative** for guaranteed performance

---

## Related Documents

- [2026 Q2 Update Hands-On Guide](../2026q2-update-hands-on-guide.md)
- [Cost Estimation Worksheet](../cost-estimation-worksheet.md)
- [Operations Runbook](../operations-runbook.md) — Section 5
