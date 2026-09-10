# 分块策略选型指南

**🌐 Language:** [日本語](../chunking-strategy-guide.md) | [English](../en/chunking-strategy-guide.md) | [한국어](../ko/chunking-strategy-guide.md) | **简体中文** | [繁體中文](../zh-TW/chunking-strategy-guide.md) | [Français](../fr/chunking-strategy-guide.md) | [Deutsch](../de/chunking-strategy-guide.md) | [Español](../es/chunking-strategy-guide.md)

**创建日期**: 2026-06-07  
**状态**: 第一版  
**读者**: RAG 质量调优负责人、数据工程师

---

## 概述

Bedrock Knowledge Base 的分块策略直接影响检索精度、回答质量和成本。本指南帮助你根据 FSx for ONTAP 上文档的特性选择合适的策略。

---

## 可用策略

通过 CDK context `kbChunkingStrategy` 设置：

```bash
npx cdk synth --quiet -c kbChunkingStrategy=FIXED_SIZE    # 默认
npx cdk synth --quiet -c kbChunkingStrategy=HIERARCHICAL
npx cdk synth --quiet -c kbChunkingStrategy=SEMANTIC
npx cdk synth --quiet -c kbChunkingStrategy=NONE
```

> ⚠️ **更改分块策略后必须重新同步数据源（重新摄取）。**

**这四个之外的值会在 synth 阶段抛出异常。** 若静默回退到默认值，`KbChunkingStrategy` 输出会显示写错的字符串，而实际下发的配置是 `FIXED_SIZE`，导致显示与部署配置不一致。大小写会被规范化（`semantic` → `SEMANTIC`）。

---

## 策略对比

| 策略 | 分块大小 | 重叠 | 检索精度 | 成本 | 适用场景 |
|---|---|---|---|---|---|
| **FIXED_SIZE** | 300 token | 10% | ⭐⭐⭐ | 💰 低 | 通用、初次部署、结构统一的文档 |
| **HIERARCHICAL** | parent 1500 / child 300 | 60 token | ⭐⭐⭐⭐ | 💰💰 中 | 长篇报告、层级结构文档、技术文档 |
| **SEMANTIC** | ≤300 token | 自动（按语义单元） | ⭐⭐⭐⭐⭐ | 💰💰💰 高 | 文档类型多样、FAQ、对话形式、会议记录 |
| **NONE** | 整篇文档 | 无 | ⭐⭐ | 💰 最低 | 短文档（<300 token）、仅元数据 |

---

## 文档特性与推荐策略

| 文档特性 | 推荐 | 理由 |
|---|---|---|
| **设计文档·规格书**（层级结构、长篇） | HIERARCHICAL | 保留章 → 节 → 段的层级，兼顾宽上下文与精确检索 |
| **合同·法律文书**（按条款） | SEMANTIC | 自动识别条款之间的语义边界，不切分条款 |
| **FAQ**（简短的问答对） | SEMANTIC | 将问题与答案保持在同一分块内 |
| **会议记录·邮件**（对话形式） | SEMANTIC | 在话题切换处自然分割 |
| **手册·操作步骤**（分步） | HIERARCHICAL | 整体流程作为 parent，各步骤作为 child |
| **财务报告**（含表格与数字） | FIXED_SIZE | 表格结构复杂时固定大小更稳定 |
| **简短通知**（不足一页） | NONE | 整篇能放入一个分块时无需切分 |
| **混合语料**（多种文档类型） | SEMANTIC | 无论类型都能得到语义上合理的切分 |

---

## 按行业

| 行业 | 主要文档 | 推荐 | 备注 |
|---|---|---|---|
| **制造** | 图纸（文本部分）、质量标准、作业指导书 | HIERARCHICAL | 图纸配合多模态 KB 使用 |
| **金融** | 监管文档、内部报告、合规报告 | SEMANTIC | 保持条款的语义完整性 |
| **公共部门** | 政策文件、通知、会议记录 | SEMANTIC | 会议记录按话题切分很重要 |
| **医疗** | 临床指南、操作规程、研究论文 | HIERARCHICAL | 利用章节结构 |
| **法务** | 合同、判例、法规 | SEMANTIC | 避免切分条款 |
| **教育** | 教材、教学大纲、研究资料 | FIXED_SIZE | 结构统一，注重成本 |
| **保险** | 核定标准、欺诈检测报告 | HIERARCHICAL | 契合层级化判定标准 |

---

## 性能特性

### 摄取时间

| 策略 | 1,000 篇文档（估算） | 10,000 篇文档（估算） |
|---|---|---|
| FIXED_SIZE | ~5 分钟 | ~30 分钟 |
| HIERARCHICAL | ~8 分钟 | ~50 分钟 |
| SEMANTIC | ~15 分钟 | ~90 分钟 |
| NONE | ~3 分钟 | ~15 分钟 |

> SEMANTIC 会在每个候选边界额外调用模型，因此摄取时间与成本都会上升。

### 检索延迟

分块策略不会直接影响检索延迟（向量检索性能取决于索引规模）。不过 HIERARCHICAL 会执行 parent/child 两阶段检索，可能增加少量延迟（约 50ms）。

---

## 与权限感知 RAG 的关系

**重要**：无论采用哪种分块策略，权限过滤始终**以文档为单位**生效。

```
文档 A (SID: [Admin, Engineering])
  ├── Chunk 1 → SID: [Admin, Engineering] (继承自文档)
  ├── Chunk 2 → SID: [Admin, Engineering] (继承自文档)
  └── Chunk 3 → SID: [Admin, Engineering] (继承自文档)
```

- `.metadata.json` 中的 SID 信息按文档附加。
- 无法按分块区分权限；整篇文档共用一套权限。
- 同一文档内需要不同权限时，请拆分为独立文件。

---

## 变更策略的步骤

```bash
# 1. 确认当前策略
grep kbChunkingStrategy cdk.context.json

# 2. 更新 CDK context
# 编辑 cdk.context.json，或在命令行指定

# 3. 查看 CDK 差异
npx cdk diff ${STACK_PREFIX}-AI -c kbChunkingStrategy=SEMANTIC

# 4. 部署（仅更新数据源配置）
npx cdk deploy ${STACK_PREFIX}-AI -c kbChunkingStrategy=SEMANTIC

# 5. 重新同步数据源（必需）
aws bedrock-agent start-ingestion-job \
  --knowledge-base-id <KB_ID> \
  --data-source-id <DS_ID> \
  --region ap-northeast-1

# 6. 等待重新摄取完成
aws bedrock-agent get-ingestion-job \
  --knowledge-base-id <KB_ID> \
  --data-source-id <DS_ID> \
  --ingestion-job-id <JOB_ID>

# 7. 质量评估（用 RAGAS 对比）
cd tests/rag-evaluation
python3 evaluate.py --kb-id <KB_ID> --model-id <MODEL_ID> --region ap-northeast-1
```

---

## 评估方法

变更策略后务必测量以下内容：

1. **RAGAS 评估**：用 `tests/rag-evaluation/` 对比 Faithfulness、Answer Relevancy 和 Context Precision。
2. **权限矩阵回归**：确认 31 个场景中的权限过滤仍然正常。
3. **响应时间**：在 CloudWatch 中查看 P50/P95/P99 延迟。
4. **成本**：按摄取成本与查询成本之和进行比较。

---

## CDK 实现

`lib/stacks/demo/demo-ai-stack.ts` 中的 `buildChunkingConfiguration()`：

```typescript
// FIXED_SIZE: maxTokens=300, overlapPercentage=10
// HIERARCHICAL: parent=1500, child=300, overlapTokens=60
// SEMANTIC: maxTokens=300, bufferSize=1, breakpointPercentileThreshold=95
# NONE：不分块（整篇文档向量化为一个向量）
```

---

## 相关文档

- [FSx for ONTAP 容量与性能设计](fsxn-sizing-and-performance.md)
- [RAG / Agent 评估框架](evaluation.md)
- [成本估算工作表](cost-estimation-worksheet.md)
- [Architecture Decision Records](architecture-decision-records.md)
