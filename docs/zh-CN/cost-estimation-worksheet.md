# 成本估算工作表

**🌐 Language:** [日本語](../cost-estimation-worksheet.md) | [English](../en/cost-estimation-worksheet.md) | [한국어](../ko/cost-estimation-worksheet.md) | **简体中文** | [繁體中文](../zh-TW/cost-estimation-worksheet.md) | [Français](../fr/cost-estimation-worksheet.md) | [Deutsch](../de/cost-estimation-worksheet.md) | [Español](../es/cost-estimation-worksheet.md)

**创建日期**: 2026-05-23  
**状态**: 草稿  
**目标读者**: 项目经理、合作伙伴提案负责人、预算制定者

> **⚠️ 注意**: 本工作表中的价格是基于 2026 年 5 月 ap-northeast-1 区域公开价格的参考值。实际成本因区域、使用量、折扣和价格调整而异。最新价格请参阅 [AWS Pricing](https://aws.amazon.com/pricing/)。

---

## 输入参数

请填写以下值以估算月度成本。

| 参数 | 值 | 备注 |
|------|-----|------|
| 文档数量 | _____ 个 | FSx 卷上的文件数 |
| 平均文档大小 | _____ KB | 文本换算 |
| 每日查询数 | _____ 次/天 | 所有用户合计 |
| 并发用户数 | _____ 人 | 峰值 |
| 注册用户数 | _____ 人 | Cognito User Pool |
| KB 同步频率 | _____ 次/天 | 由 Auto-Sync 间隔计算 |
| Agent 模式使用率 | _____ % | 所有查询中 Agent 使用比例 |
| 可用性要求 | Single-AZ / Multi-AZ | FSx 配置 |

---

## 成本计算公式

### 1. FSx for ONTAP

```
月费 = throughput 费用 + SSD 费用 + Capacity Pool 费用 + 备份费用

throughput 费用:
  128 MB/s: ~$210/月
  256 MB/s: ~$420/月
  512 MB/s: ~$840/月
  1,024 MB/s: ~$1,680/月

SSD 费用: $0.125/GiB/月 × SSD 容量 (GiB)
Capacity Pool 费用: $0.0125/GiB/月 × Capacity Pool 使用量 (GiB)
备份费用: $0.025/GiB/月 × 备份容量 (GiB)

Multi-AZ 情况下: throughput + SSD 费用约为 2 倍
```

**计算示例**:
- 128 MB/s + 1 TiB SSD + 500 GiB CP (Single-AZ): $210 + $128 + $6.25 = **~$344/月**
- 512 MB/s + 5 TiB SSD + 2 TiB CP (Multi-AZ): $1,680 + $640 + $25 = **~$2,345/月**

### 2. 向量存储

```
S3 Vectors:
  存储: $0.023/GB/月 × 向量数据大小
  请求: $0.005/1,000 PUT + $0.0004/1,000 GET
  估算: 10,000 个文档 → ~$5/月

OpenSearch Serverless:
  OCU: $0.24/OCU/小时 × 24 × 30 = $172.80/OCU/月
  最少 2 OCU (搜索 + 索引): ~$346/月
  推荐 4 OCU: ~$691/月
```

### 3. Bedrock (Embedding)

```
Titan Embed Text v2: $0.0001/1,000 tokens

初始 Embedding:
  = 文档数 × 平均大小(KB) × 1,000 / 4 × $0.0001/1K
  示例: 10,000 个 × 10 KB × 250 tokens/KB × $0.0001/1K = $2.50

每月增量 Embedding:
  = 变更文档数 × 平均大小 × $0.0001/1K
  示例: 500 个/月 × 10 KB × 250 tokens/KB × $0.0001/1K = $0.13
```

### 4. Bedrock (生成模型)

```
Smart Routing 分布 (默认假设):
  Simple (Haiku): 60% → $0.001/query
  Complex (Sonnet): 30% → $0.01/query
  Full-context (Opus): 10% → $0.10/query

加权平均成本/查询:
  = 0.6 × $0.001 + 0.3 × $0.01 + 0.1 × $0.10
  = $0.0006 + $0.003 + $0.01
  = ~$0.014/query

月费:
  = 每日查询数 × 30 × $0.014
  示例: 100 queries/天 × 30 × $0.014 = $42/月
  示例: 1,000 queries/天 × 30 × $0.014 = $420/月
```

### 5. Lambda

```
WebApp Lambda:
  请求: $0.20/100万请求
  计算: $0.0000166667/GB-秒
  内存: 1,024 MB, 平均执行时间: 3 秒
  
  月费 = 请求数 × (内存GB × 执行秒 × $0.0000166667 + $0.0000002)
  示例: 100,000 req/月 × (1 × 3 × $0.0000166667 + $0.0000002) = ~$5/月

同步 Lambda (KB Auto-Sync, AD Sync):
  5 分钟间隔 × 30 天 = 8,640 次/月
  128 MB × 5 秒 = ~$0.60/月
```

### 6. 其他

```
CloudFront: $0.114/GB (日本) × 传输量
  示例: 10 GB/月 = $1.14/月

WAF: $5/WebACL + $1/规则 × 6 + $0.60/100万请求
  基本: $11/月 + 请求按量

DynamoDB (按需):
  写入: $1.25/100万 WRU
  读取: $0.25/100万 RRU
  存储: $0.25/GB/月
  示例: ~$5/月 (小规模)

Cognito:
  前 50,000 MAU: 免费
  50,001–100,000: $0.0055/MAU
  示例: 100 MAU = $0 (免费额度内)

CloudWatch:
  日志摄取: $0.76/GB
  日志存储: $0.033/GB/月
  指标: $0.30/指标/月 (前 10,000)
  示例: ~$10–$30/月
```

---

## 按配置的月度成本估算模板

### 模板 A: 小规模 PoC

| 资源 | 配置 | 月费 |
|------|------|------|
| FSx for ONTAP | 128 MB/s, 1 TiB SSD, Single-AZ | $344 |
| S3 Vectors | ~10,000 向量 | $5 |
| Bedrock Embedding | 初始 + 增量 | $3 |
| Bedrock 生成 | 100 queries/天, Smart Routing | $42 |
| Lambda | WebApp + Sync | $6 |
| CloudFront + WAF | 基本 | $15 |
| DynamoDB | 按需 | $5 |
| Cognito | ~50 MAU | $0 |
| CloudWatch | 基本 | $10 |
| **合计** | | **~$430/月** |

### 模板 B: 中规模生产

| 资源 | 配置 | 月费 |
|------|------|------|
| FSx for ONTAP | 512 MB/s, 5 TiB SSD, Multi-AZ | $2,345 |
| OpenSearch Serverless | 4 OCU | $691 |
| Bedrock Embedding | 定期同步 | $10 |
| Bedrock 生成 | 1,000 queries/天, Smart Routing | $420 |
| Lambda | WebApp + Sync + 监控 | $30 |
| CloudFront + WAF | 生产流量 | $50 |
| DynamoDB | 预置 | $30 |
| Cognito | ~500 MAU | $0 |
| CloudWatch | 日志 + 指标 + 告警 | $50 |
| **合计** | | **~$3,626/月** |

### 模板 C: 大规模企业

| 资源 | 配置 | 月费 |
|------|------|------|
| FSx for ONTAP | 1,024 MB/s, 10 TiB SSD, Multi-AZ | $4,480 |
| OpenSearch Serverless | 8 OCU | $1,382 |
| Bedrock Embedding | 大规模同步 | $50 |
| Bedrock 生成 | 5,000 queries/天, Smart Routing | $2,100 |
| Lambda | 全功能 | $100 |
| CloudFront + WAF | 高流量 | $200 |
| DynamoDB | 预置 + DAX | $100 |
| Cognito | ~2,000 MAU | $0 |
| CloudWatch | 全面监控 | $100 |
| **合计** | | **~$8,512/月** |

---

## 成本优化要点

| 方法 | 节省效果 | 适用条件 |
|------|---------|---------|
| S3 Vectors (替代 AOSS) | -$700/月 | QPS < 10, 可容忍延迟 |
| Smart Routing (Haiku 优先) | -30~50% | 简单问题居多的情况 |
| Capacity Pool Tiering | -50~80% (存储) | 访问频率低的数据较多的情况 |
| throughput 缩减 (运营阶段) | -50% | 初始索引完成后 |
| Savings Plans (Lambda) | -17% | 1 年承诺 |
| Reserved Capacity (AOSS) | 需咨询 | 确定长期使用时 |

---

## 相关文档

| 文档 | 内容 |
|------|------|
| [fsxn-sizing-and-performance.md](../fsxn-sizing-and-performance.md) | FSx for ONTAP 性能与容量规划 |
| [partner-deployment-patterns.md](../partner-deployment-patterns.md) | 合作伙伴部署模式 (含成本比较) |
| [evaluation.md](../evaluation.md) | RAG / Agent 评估指标 |
