# RAG / Agent Evaluation Metrics

**🌐 Language:** [日本語](../evaluation.md) | **English** | [한국어](../ko/evaluation.md) | [简体中文](../zh-CN/evaluation.md) | [繁體中文](../zh-TW/evaluation.md) | [Français](../fr/evaluation.md) | [Deutsch](../de/evaluation.md) | [Español](../es/evaluation.md)

**Created**: 2026-05-21  
**Status**: Draft  
**Audience**: PoC evaluators, project managers, quality assurance personnel

---

## Overview

This document provides metric definitions and evaluation methods for quantitatively assessing the quality and effectiveness of the Permission-aware RAG system. Evaluation is conducted across 4 axes: Business KPIs, RAG Quality, Permission Control, and Agent Performance.

---

## Evaluation Framework

```
┌─────────────────────────────────────────────────────────────┐
│                    4 Evaluation Axes                           │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ Business KPI │  │ RAG Quality  │  │ Permission   │       │
│  │              │  │              │  │ Control      │       │
│  │ ・Search time│  │ ・Answer     │  │ ・Violation  │       │
│  │   reduction  │  │   accuracy   │  │   rate       │       │
│  │ ・First-call │  │ ・Faithful-  │  │ ・False Pos  │       │
│  │   resolution │  │   ness       │  │ ・False Neg  │       │
│  │ ・Inquiry    │  │ ・Context    │  │ ・Propagation│       │
│  │   reduction  │  │   precision  │  │   delay      │       │
│  │ ・Usage rate │  │ ・Response   │  │              │       │
│  │              │  │   time       │  │              │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│                                                               │
│  ┌──────────────┐                                            │
│  │ Agent Perf.  │                                            │
│  │              │                                            │
│  │ ・Task       │                                            │
│  │   success    │                                            │
│  │ ・Tool       │                                            │
│  │   accuracy   │                                            │
│  │ ・Escalation │                                            │
│  │   rate       │                                            │
│  │ ・Cost/task  │                                            │
│  └──────────────┘                                            │
└─────────────────────────────────────────────────────────────┘
```

---

## 1. Business KPIs

### Definitions and Measurement Methods

| KPI | Definition | Target (PoC) | Measurement Method |
|-----|-----------|--------------|-------------------|
| Search time reduction rate | Time savings compared to traditional manual search | 50%+ | User survey + timestamp comparison |
| First-call resolution rate | Percentage resolved by AI answer alone | 60%+ | User feedback (👍/👎) |
| Inquiry reduction rate | Decrease in helpdesk inquiries | 30%+ | Before/After ticket count comparison |
| Citation rate | Percentage of answers with citations | 90%+ | Automatic citation presence aggregation |
| Permission violation count | Count of unauthorized documents displayed | 0 | Permission matrix test + audit logs |
| Monthly active user rate | Monthly usage rate among registered users | 70%+ | Cognito + access logs |

### Measurement Dashboard

Visualize the following on CloudWatch dashboard (`enableMonitoring=true`):

- Daily/weekly search request count
- Usage frequency by user
- Answer generation success rate
- Average response time (P50/P95/P99)
- Guardrails intervention rate

---

## 2. RAG Quality Metrics

### 2.1 Answer Relevance

**Definition**: How relevant the generated answer is to the user's question

**Evaluation method**:
- Human evaluation: 5-point scale (1: Irrelevant – 5: Completely relevant)
- Automated evaluation: LLM-as-Judge (automatic scoring by Claude)

**Target**: Average 4.0+ (5-point scale)

### 2.2 Faithfulness

**Definition**: Whether the generated answer is faithful to the content of retrieved documents (no hallucination)

**Evaluation method**:
- Cross-reference each claim in the answer with citation documents
- Measure the proportion of unsupported claims

**Formula**:
```
Faithfulness = (Number of supported claims) / (Total claims in answer)
```

**Target**: 0.90+

### 2.3 Context Precision

**Definition**: Proportion of retrieved documents that actually contributed to answer generation

**Evaluation method**:
- Determine whether each document in search results was used in the answer
- Higher-ranked documents are weighted more heavily

**Formula**:
```
Context Precision = Σ(Precision@k × relevance@k) / (Number of relevant documents)
```

**Target**: 0.80+

### 2.4 Permission Violation Rate

**Definition**: Proportion of search results containing unauthorized documents

**Evaluation method**:
- Execute the same query with test users (different permission levels)
- Verify no unauthorized documents appear in each user's search results

**Formula**:
```
Permission Violation Rate = (Unauthorized document display count) / (Total search count)
```

**Target**: 0% (zero tolerance)

### 2.5 Response Latency

| Percentile | Target (KB Mode) | Target (Agent Mode) |
|-----------|-----------------|-------------------|
| P50 | < 3 sec | < 8 sec |
| P95 | < 8 sec | < 20 sec |
| P99 | < 15 sec | < 30 sec |

---

## 3. Permission Control Metrics

### 3.1 Test Matrix

| Test Case | Expected Result | Verification Method |
|-----------|----------------|-------------------|
| Admin searches confidential documents | Displayed | Confirm SID match |
| General user searches confidential documents | Not displayed | Confirm SID mismatch |
| All users search Everyone documents | Displayed for all | Confirm S-1-1-0 match |
| User without SID searches | Deny all (Fail-Closed) | Behavior when no DynamoDB record |
| User searches immediately after group addition | New group documents displayed | Verify behavior after AD Sync |
| User searches immediately after group removal | Old group documents hidden | Verify behavior after cache TTL |

### 3.2 Edge Case Tests

| Case | Expected Behavior | Notes |
|------|-------------------|-------|
| Allow / Deny conflict | Deny takes priority (this system uses Allow list only) | NTFS ACL Deny ACE is not reflected in `.metadata.json` by design |
| Group nesting | Allowed by parent group SID | AD nested groups managed as expanded SID list |
| Inherited vs explicit permissions | Both SIDs included in `.metadata.json` | All effective permission SIDs enumerated |
| Permissions after Rename / Move | Destination inherited permissions apply | `.metadata.json` regeneration required |
| Mixed SMB and NFS access | Depends on security style | NTFS style: SID, UNIX style: UID/GID |
| User with unresolvable SID | Fail-Closed (deny all) | No SID data in DynamoDB |
| Search immediately after permission removal | Searchable with old permissions within cache TTL | Max 5-min delay (manual clear for emergencies) |

---

## 4. Agent Evaluation Metrics

### 4.1 Task Success Rate

**Definition**: Percentage of tasks correctly completed by the Agent

**Formula**:
```
Task Success Rate = (Correctly completed tasks) / (Total tasks)
```

**Target**: 80%+

### 4.2 Tool-Call Accuracy

**Definition**: Percentage of appropriate tool calls with appropriate parameters by the Agent

**Evaluation items**:
- Correct tool selection
- Correct parameter setting
- Avoidance of unnecessary tool calls

**Target**: 90%+

### 4.3 Human Escalation Rate

**Definition**: Percentage of cases where the Agent deferred judgment to a human

**Formula**:
```
Escalation Rate = (Escalation count) / (Total tasks)
```

**Target**: 20% or less (acceptable for complex tasks)

### 4.4 Cost per Task

**Formula**:
```
Cost per Task = (Input tokens × input price + Output tokens × output price) / Task count
```

**Estimates**:
| Model | Input Price | Output Price | Average Task Cost |
|-------|------------|-------------|-------------------|
| Claude Haiku | $0.001/1K | $0.005/1K | $0.005–$0.02 |
| Claude Sonnet | $0.003/1K | $0.015/1K | $0.02–$0.10 |
| Claude Opus | $0.015/1K | $0.075/1K | $0.10–$0.50 |

---

## Evaluation Template (1-Page Summary)

### PoC Evaluation Report Template

```markdown
# Permission-aware RAG PoC Evaluation Report

## Evaluation Period: YYYY/MM/DD – YYYY/MM/DD
## Evaluator: [Name]
## Target User Count: XX users

### Business KPIs
| Metric | Target | Actual | Judgment |
|--------|--------|--------|----------|
| Search time reduction rate | 50% | __% | ⬜ |
| First-call resolution rate | 60% | __% | ⬜ |
| Permission violation count | 0 | __ | ⬜ |
| Citation rate | 90% | __% | ⬜ |

### RAG Quality
| Metric | Target | Actual | Judgment |
|--------|--------|--------|----------|
| Answer Relevance | 4.0/5 | __/5 | ⬜ |
| Faithfulness | 0.90 | __ | ⬜ |
| Context Precision | 0.80 | __ | ⬜ |
| Permission Violation | 0% | __% | ⬜ |

### Response Performance
| Metric | Target | Actual | Judgment |
|--------|--------|--------|----------|
| P50 Latency | < 3s | __s | ⬜ |
| P95 Latency | < 8s | __s | ⬜ |

### Agent Performance (when Agent mode is used)
| Metric | Target | Actual | Judgment |
|--------|--------|--------|----------|
| Task Success Rate | 80% | __% | ⬜ |
| Tool-Call Accuracy | 90% | __% | ⬜ |
| Cost per Task | < $0.05 | $__ | ⬜ |

### Overall Judgment
- [ ] PoC Success (production recommended)
- [ ] Conditional Success (re-evaluate after improvements)
- [ ] Additional verification needed

### Improvement Items / Next Actions
1. 
2. 
3. 
```

---

## Model Selection / Cost / Latency Comparison

### Vector Store Selection

| Aspect | S3 Vectors | OpenSearch Serverless |
|--------|-----------|---------------------|
| Monthly cost (small scale) | $5–$20 | $700+ |
| Query latency | 100ms–1s | 50ms–200ms |
| Recommended scale | ~10,000 documents | 10,000+ documents |
| Recommended use | PoC, small-scale production | High-QPS production |

### Embedding Model Selection

| Model | Dimensions | Multilingual | Cost | Recommended Use |
|-------|-----------|-------------|------|-----------------|
| Titan Embed Text v2 | 1024 | ✅ | $0.0001/1K tokens | Default (cost efficient) |
| Nova Multimodal | 1024 | ✅ | $0.0002/image | Multimodal search |

### Generation Model Selection

| Model | Use Case | Input Cost | Output Cost | Latency |
|-------|----------|-----------|-------------|---------|
| Claude Haiku | Simple questions, Smart Routing: simple | $0.001/1K | $0.005/1K | ~2s |
| Claude Sonnet | Analytical questions, Smart Routing: complex | $0.003/1K | $0.015/1K | ~5s |
| Claude Opus | Large context, Smart Routing: full-context | $0.015/1K | $0.075/1K | ~10s |

### Monthly Cost Estimation Template

```
Input Parameters:
  Document count: _____ files
  Average document size: _____ KB
  Chunk count (estimated): Document count × Average size / 512
  Daily query count: _____ queries
  Average input tokens/query: _____ tokens
  Average output tokens/query: _____ tokens

Cost Calculation:
  Embedding (initial): Chunk count × Average chunk size × $0.0001/1K = $____
  Embedding (monthly incremental): Changed chunk count × Average chunk size × $0.0001/1K = $____
  Generation (monthly): Daily queries × 30 × (input tokens × input price + output tokens × output price) = $____
  Vector store: S3 Vectors $____ or OpenSearch Serverless $____
  FSx for ONTAP: throughput + SSD + capacity pool = $____
  Other (Lambda, CloudFront, DynamoDB): $____
  
  Monthly total: $____
```

---

## Related Documents

| Document | Description |
|----------|-------------|
| [production-readiness-checklist.md](production-readiness-checklist.md) | Production Readiness Checklist |
| [governance-and-audit.md](governance-and-audit.md) | Governance and Audit Design |
| [safe-experimentation-guide.md](safe-experimentation-guide.md) | Safe Experimentation Guide |
| [fsxn-sizing-and-performance.md](fsxn-sizing-and-performance.md) | FSx for ONTAP Sizing and Performance |
