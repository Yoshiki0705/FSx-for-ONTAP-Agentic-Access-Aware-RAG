# Chunking Strategy Selection Guide

**🌐 Language:** [日本語](../chunking-strategy-guide.md) | **English** | [한국어](../ko/chunking-strategy-guide.md) | [简体中文](../zh-CN/chunking-strategy-guide.md) | [繁體中文](../zh-TW/chunking-strategy-guide.md) | [Français](../fr/chunking-strategy-guide.md) | [Deutsch](../de/chunking-strategy-guide.md) | [Español](../es/chunking-strategy-guide.md)

**Created**: 2026-06-07  
**Status**: First Edition  
**Audience**: RAG quality tuning owners, data engineers

---

## Overview

The chunking strategy of a Bedrock Knowledge Base directly affects retrieval accuracy, answer quality, and cost. This guide helps pick a strategy that matches the characteristics of the documents held on FSx for ONTAP.

---

## Available strategies

Set through the CDK context `kbChunkingStrategy`:

```bash
npx cdk synth --quiet -c kbChunkingStrategy=FIXED_SIZE    # default
npx cdk synth --quiet -c kbChunkingStrategy=HIERARCHICAL
npx cdk synth --quiet -c kbChunkingStrategy=SEMANTIC
npx cdk synth --quiet -c kbChunkingStrategy=NONE
```

> ⚠️ **Changing the chunking strategy requires a DataSource re-sync (re-ingestion).**

**Any value outside these four throws at synth time.** Coercing silently to the default would leave the `KbChunkingStrategy` output showing the typo while the emitted configuration said `FIXED_SIZE`, so the displayed value and the deployed configuration would disagree. Case is normalized (`semantic` → `SEMANTIC`).

---

## Strategy comparison

| Strategy | Chunk size | Overlap | Retrieval accuracy | Cost | Suited to |
|----------|-----------|---------|--------------------|------|-----------|
| **FIXED_SIZE** | 300 tokens | 10% | ⭐⭐⭐ | 💰 low | general use, first deployment, documents with uniform structure |
| **HIERARCHICAL** | parent 1500 / child 300 | 60 tokens | ⭐⭐⭐⭐ | 💰💰 medium | long reports, hierarchical documents, technical documentation |
| **SEMANTIC** | up to 300 tokens | automatic (semantic units) | ⭐⭐⭐⭐⭐ | 💰💰💰 high | mixed documents, FAQs, dialogue, meeting minutes |
| **NONE** | whole document | none | ⭐⭐ | 💰 lowest | short documents (<300 tokens), metadata only |

---

## Document characteristics and recommended strategy

| Document characteristics | Recommended | Why |
|--------------------------|-------------|-----|
| **Design and specification documents** (hierarchical, long) | HIERARCHICAL | keeps the chapter → section → paragraph hierarchy, giving both broad context and precise retrieval |
| **Contracts and legal documents** (clause-based) | SEMANTIC | detects the semantic boundary between clauses and does not split a clause |
| **FAQs** (short question-answer pairs) | SEMANTIC | keeps a question and its answer in the same chunk |
| **Minutes and email** (dialogue) | SEMANTIC | splits naturally where the topic changes |
| **Manuals and procedures** (step by step) | HIERARCHICAL | the whole procedure becomes the parent and each step a child |
| **Financial reports** (tables and figures) | FIXED_SIZE | fixed size is more stable when table structure is complex |
| **Short notices** (under a page) | NONE | no split needed when the whole document fits one chunk |
| **Mixed corpus** (many document types) | SEMANTIC | produces a semantically reasonable split regardless of type |

---

## By industry

| Industry | Main documents | Recommended | Notes |
|----------|----------------|-------------|-------|
| **Manufacturing** | drawings (text parts), quality standards, work instructions | HIERARCHICAL | pair drawings with a multimodal KB |
| **Financial services** | regulatory documents, internal reports, compliance reports | SEMANTIC | preserves the semantic integrity of clauses |
| **Public sector** | policy documents, circulars, minutes | SEMANTIC | topic-level splitting of minutes matters |
| **Healthcare** | clinical guidelines, procedures, research papers | HIERARCHICAL | exploits the chapter structure |
| **Legal** | contracts, case law, statutes | SEMANTIC | avoids splitting clauses |
| **Education** | teaching material, syllabi, research material | FIXED_SIZE | uniform structure, cost-sensitive |
| **Insurance** | assessment criteria, fraud detection reports | HIERARCHICAL | fits hierarchical decision criteria |

---

## Performance characteristics

### Ingestion time

| Strategy | 1,000 documents (estimate) | 10,000 documents (estimate) |
|----------|----------------------------|------------------------------|
| FIXED_SIZE | ~5 min | ~30 min |
| HIERARCHICAL | ~8 min | ~50 min |
| SEMANTIC | ~15 min | ~90 min |
| NONE | ~3 min | ~15 min |

> SEMANTIC makes an additional model call at each candidate boundary, which increases both ingestion time and cost.

### Retrieval latency

The chunking strategy does not directly affect retrieval latency — vector search performance depends on index size. HIERARCHICAL performs a two-stage parent/child lookup, so it may add a small amount of latency (~50 ms).

---

## Relationship to Permission-Aware RAG

**Important**: whatever the chunking strategy, permission filtering is always applied **per document**.

```
Document A (SID: [Admin, Engineering])
  ├── Chunk 1 → SID: [Admin, Engineering] (inherited from the document)
  ├── Chunk 2 → SID: [Admin, Engineering] (inherited from the document)
  └── Chunk 3 → SID: [Admin, Engineering] (inherited from the document)
```

- The SID information in `.metadata.json` is attached per document.
- Chunk-level permission differences are not possible; the whole document carries one permission set.
- When one document needs different permissions in different parts, split it into separate files.

---

## Changing the strategy

```bash
# 1. Check the current strategy
grep kbChunkingStrategy cdk.context.json

# 2. Update the CDK context
# edit cdk.context.json, or pass it on the command line

# 3. Review the CDK diff
npx cdk diff ${STACK_PREFIX}-AI -c kbChunkingStrategy=SEMANTIC

# 4. Deploy (updates the DataSource configuration only)
npx cdk deploy ${STACK_PREFIX}-AI -c kbChunkingStrategy=SEMANTIC

# 5. Re-sync the DataSource (required)
aws bedrock-agent start-ingestion-job \
  --knowledge-base-id <KB_ID> \
  --data-source-id <DS_ID> \
  --region ap-northeast-1

# 6. Wait for re-ingestion to finish
aws bedrock-agent get-ingestion-job \
  --knowledge-base-id <KB_ID> \
  --data-source-id <DS_ID> \
  --ingestion-job-id <JOB_ID>

# 7. Evaluate quality (compare with RAGAS)
cd tests/rag-evaluation
python3 evaluate.py --kb-id <KB_ID> --model-id <MODEL_ID> --region ap-northeast-1
```

---

## How to evaluate a change

After changing the strategy, always measure:

1. **RAGAS evaluation**: compare faithfulness, answer relevancy, and context precision with `tests/rag-evaluation/`.
2. **Permission matrix regression**: confirm permission filtering still behaves across the 31 scenarios.
3. **Response time**: check P50/P95/P99 latency in CloudWatch.
4. **Cost**: compare the sum of ingestion cost and query cost.

---

## CDK implementation

`buildChunkingConfiguration()` in `lib/stacks/demo/demo-ai-stack.ts`:

```typescript
// FIXED_SIZE: maxTokens=300, overlapPercentage=10
// HIERARCHICAL: parent=1500, child=300, overlapTokens=60
// SEMANTIC: maxTokens=300, bufferSize=1, breakpointPercentileThreshold=95
// NONE: no chunking (the whole document becomes one vector)
```

---

## Related Documents

- [FSx for ONTAP Sizing and Performance](fsxn-sizing-and-performance.md)
- [RAG / Agent Evaluation Framework](evaluation.md)
- [Cost Estimation Worksheet](cost-estimation-worksheet.md)
- [Architecture Decision Records](architecture-decision-records.md)
