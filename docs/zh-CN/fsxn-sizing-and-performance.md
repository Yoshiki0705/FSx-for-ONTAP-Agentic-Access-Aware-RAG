# FSx for ONTAP 容量规划与性能指南

**🌐 Language:** [日本語](../fsxn-sizing-and-performance.md) | [English](../en/fsxn-sizing-and-performance.md) | [한국어](../ko/fsxn-sizing-and-performance.md) | **简体中文** | [繁體中文](../zh-TW/fsxn-sizing-and-performance.md) | [Français](../fr/fsxn-sizing-and-performance.md) | [Deutsch](../de/fsxn-sizing-and-performance.md) | [Español](../es/fsxn-sizing-and-performance.md)

**创建日期**: 2026-05-21  
**状态**: 草案  
**目标读者**: 基础设施架构师、存储管理员

---

## 概述

本文档提供了 Permission-aware RAG 系统中 FSx for ONTAP 的容量规划和性能设计指南。根据文件数量、文件大小、访问频率和重新同步频率整理了配置建议。

---

## 按规模推荐的配置

### 小规模（~10,000 个文件）— PoC / 部门使用

| 项目 | 推荐值 | 备注 |
|------|--------|------|
| FSx 吞吐量容量 | 128 MB/s | 最小配置 |
| SSD 存储容量 | 1,024 GiB | 最小配置 |
| 容量池分层 | 启用 | 成本优化 |
| 向量存储 | S3 Vectors | 低成本（每月数美元） |
| KB Auto-Sync 间隔 | 15 分钟 | 默认值 |
| 初始索引时间 | 5–15 分钟 | 取决于文档大小 |
| 月度预估（仅 FSx） | ~$300–$500 | 吞吐量 + SSD |

### 中规模（10,000–100,000 个文件）— 业务部门 / 全公司使用

| 项目 | 推荐值 | 备注 |
|------|--------|------|
| FSx 吞吐量容量 | 256–512 MB/s | 基于并发访问数 |
| SSD 存储容量 | 2,048–10,240 GiB | 基于热数据量 |
| 容量池分层 | 启用 | 自动将冷数据分层 |
| 向量存储 | S3 Vectors 或 OpenSearch Serverless | 根据 QPS 需求选择 |
| KB Auto-Sync 间隔 | 5–15 分钟 | 基于更新频率 |
| 初始索引时间 | 30–120 分钟 | 可通过并行处理缩短 |
| 月度预估（仅 FSx） | ~$1,000–$5,000 | 吞吐量 + SSD + 容量池 |

### 大规模（100,000–1,000,000 个文件）— 企业级

| 项目 | 推荐值 | 备注 |
|------|--------|------|
| FSx 吞吐量容量 | 1,024–4,096 MB/s | Multi-AZ + 高吞吐量 |
| SSD 存储容量 | 10,240+ GiB | 基于热数据量 |
| 容量池分层 | 启用 | 大部分数据在容量池中 |
| 向量存储 | OpenSearch Serverless | 高 QPS、低延迟 |
| KB Auto-Sync 间隔 | 需要增量同步设计 | 全量扫描不现实 |
| 初始索引时间 | 数小时到 1 天 | 建议批次拆分 |
| 月度预估（仅 FSx） | ~$5,000–$30,000+ | 高度依赖配置 |

---

## FSx for ONTAP 性能特征

### 吞吐量容量

FSx for ONTAP 吞吐量容量在文件系统级别配置。

| 吞吐量 | 读取 IOPS（SSD） | 写入 IOPS | 网络带宽 | 使用场景 |
|--------|-----------------|-----------|----------|----------|
| 128 MB/s | 6,000 | 1,500 | 最高 600 MB/s | PoC、小规模 |
| 256 MB/s | 12,000 | 3,000 | 最高 1.2 GB/s | 部门使用 |
| 512 MB/s | 40,000 | 10,000 | 最高 2.4 GB/s | 全公司 |
| 1,024 MB/s | 80,000 | 20,000 | 最高 4.8 GB/s | 大规模 |
| 2,048 MB/s | 160,000 | 40,000 | 最高 9.6 GB/s | 关键任务 |

> **参考**：Amazon FSx for ONTAP 支持最高 72 GB/s 吞吐量（12 HA 对配置）。

### 存储分层（容量池分层）

| 层级 | 特征 | 成本 | 使用场景 |
|------|------|------|----------|
| SSD | 亚毫秒级延迟 | 高 | 频繁访问的文件 |
| 容量池 | 数十毫秒级延迟 | 低（约 SSD 的 1/10） | 归档、不频繁访问 |

**RAG 系统建议**：
- `.metadata.json` 和频繁搜索的文档 → SSD 层
- 归档文档、旧版本 → 容量池

**分层策略**：
- `auto`：一段时间未访问后自动移动数据到容量池（推荐）
- `snapshot-only`：仅将快照数据移动到容量池
- `all`：将所有数据移动到容量池（成本优先）
- `none`：将所有数据保留在 SSD 上（性能优先）

---

## S3 Access Point 注意事项

### 性能特征

FSx for ONTAP 的 S3 Access Point 通过 S3 兼容接口暴露 FSx 卷上的文件。

| 操作 | 延迟 | 吞吐量 | 备注 |
|------|------|--------|------|
| ListObjectsV2 | 数百毫秒 | — | 与文件数量成正比 |
| GetObject（小文件） | 数十到数百毫秒 | — | 对于 SSD 层 |
| GetObject（大文件） | 与文件大小成正比 | 取决于 FSx 吞吐量 | 流式传输 |
| HeadObject | 数十毫秒 | — | 仅元数据 |

### Bedrock KB 同步期间的负载

KB 同步（StartIngestionJob）期间，Bedrock 通过 S3 Access Point 读取所有文档。

| 文档数量 | 同步期间读取负载 | 推荐吞吐量 |
|----------|-----------------|-----------|
| ~1,000 | 低（数 GB） | 128 MB/s 即可 |
| ~10,000 | 中（数十 GB） | 建议 256 MB/s |
| ~100,000 | 高（数百 GB） | 建议 512 MB/s 或更高 |

### 双层授权

通过 S3 Access Point 的访问需要 2 层认证：

1. **IAM 认证**：S3 Access Point 策略 + IAM 基于身份的策略
2. **文件系统认证**：NTFS ACL（Windows 用户映射）

```
Bedrock KB Role → S3 Access Point Policy (IAM) → FSx NTFS ACL (File System)
                   ↓                                ↓
                   IAM Allow                        ACL Allow
                   ↓                                ↓
                   Both Allow → Access Granted
```

---

## 向量存储选择标准

### S3 Vectors vs OpenSearch Serverless

| 方面 | S3 Vectors | OpenSearch Serverless |
|------|-----------|---------------------|
| 成本（小规模） | 每月数美元 | $700+/月（最少 2 OCU） |
| 成本（大规模） | 与向量数量成正比 | 与 OCU 数量成正比 |
| 查询延迟 | 冷启动：亚秒级，热：~100ms | 始终 ~50ms |
| 最大向量数 | 10,000 索引/bucket | 几乎无限制 |
| 元数据过滤 | 2KB/向量（可过滤） | 限制宽松 |
| 可扩展性 | 自动 | 手动/自动 OCU 扩展 |
| 运维开销 | 几乎为零 | 需要 OCU 监控 |
| 导出 | → OpenSearch Serverless（一键） | — |

### 选择流程图

```
并发用户 < 10 且文档数量 < 10,000？
  → 是：S3 Vectors（成本优先）
  → 否：
    延迟要求 < 100ms？
      → 是：OpenSearch Serverless
      → 否：
        月度预算 < $1,000？
          → 是：S3 Vectors（延迟可接受）
          → 否：OpenSearch Serverless
```

### 迁移路径

从 S3 Vectors → OpenSearch Serverless 的迁移可以通过控制台一键导出完成（约 15 分钟）。反向迁移通过 KB 重新同步实现。

---

## 初始索引设计

### 推荐方法

| 文档数量 | 方法 | 备注 |
|----------|------|------|
| ~1,000 | 批量 KB 同步 | 单次 `StartIngestionJob` 即可完成 |
| ~10,000 | 批量 KB 同步 | 等待同步完成（30–60 分钟） |
| ~100,000 | 批次拆分 | 拆分数据源并增量同步 |
| 100,000+ | 逐步导入 | 按文件夹导入 → 重复同步 |

### 初始索引注意事项

1. **临时增加 FSx 吞吐量**：初始索引期间读取负载高，考虑临时增加吞吐量容量
2. **S3 Access Point 并发连接**：Bedrock KB 并行读取文件，注意 FSx 并发连接限制
3. **预先准备 `.metadata.json`**：开始同步前确认所有文档都有 `.metadata.json`
4. **同步期间的文件变更**：同步期间修改文件可能导致不一致。建议初始同步期间冻结变更

---

## 增量同步设计

### KB Auto-Sync 行为

通过 `enableKbAutoSync=true` 启用的增量同步机制：

```
EventBridge Scheduler（5–15 分钟间隔）
  → Lambda：通过 ListObjectsV2 从 S3 AP 获取文件列表
  → DynamoDB：与之前的清单比较
  → 仅在检测到变更时：执行 StartIngestionJob
  → 如果存在 IN_PROGRESS 作业：跳过（去重）
```

### 变更检测机制

| 检测目标 | 方法 | 备注 |
|----------|------|------|
| 新文件 | LastModified 比较 | DynamoDB 清单中不存在的键 |
| 更新的文件 | ETag / LastModified 比较 | 值发生变化的键 |
| 删除的文件 | 清单差异 | DynamoDB 中存在但 S3 AP 中不存在的键 |

### 大规模增量同步挑战

| 文件数量 | ListObjectsV2 耗时 | 对策 |
|----------|-------------------|------|
| ~10,000 | 数秒 | 无问题 |
| ~100,000 | 数十秒 | 延长 Lambda 超时（15 分钟） |
| 100,000+ | 数分钟或更长 | 前缀拆分、Step Functions |

---

## QoS（服务质量）设计

当多个租户或工作负载共享 FSx 时，可以使用 QoS 策略控制性能。

### 推荐 QoS 设置

| 工作负载 | 优先级 | IOPS 限制 | 吞吐量限制 |
|----------|--------|-----------|-----------|
| RAG 搜索（通过 S3 AP） | 高 | 无限制 | 无限制 |
| KB 同步（批量） | 中 | 5,000 IOPS | 100 MB/s |
| 用户 CIFS/SMB 访问 | 高 | 无限制 | 无限制 |
| 备份 / SnapMirror | 低 | 2,000 IOPS | 50 MB/s |

### 应用 QoS 策略

```bash
# 通过 ONTAP CLI 创建 QoS 策略组
qos policy-group create -policy-group kb-sync-limit \
  -vserver svm1 -max-throughput 100MB/s -min-throughput 0

# 将 QoS 策略应用到卷
volume modify -vserver svm1 -volume kb_data \
  -qos-policy-group kb-sync-limit
```

---

## 容量监控与自动扩展

### 监控指标

| 指标 | 阈值 | 操作 |
|------|------|------|
| SSD 利用率 | > 80% | 扩展容量或审查分层策略 |
| 容量池利用率 | > 90% | 扩展容量 |
| IOPS 利用率 | > 80% | 增加吞吐量容量 |
| 网络带宽利用率 | > 70% | 增加吞吐量容量 |

### 自动扩展（FSx ONTAP Ops）

`automation/fsxn-ops/` 中包含的容量监控 Lambda 执行自动扩展：

- 通过 EventBridge 每 5 分钟监控卷利用率
- 超过阈值时自动扩展卷大小
- 容量护栏（每日限制、冷却期）防止过度扩展
- CloudWatch Dashboard 可视化扩展历史

---

## 成本优化技巧

### 1. 利用容量池分层

大多数 RAG 搜索目标文档在嵌入后很少被访问。将分层策略设置为 `auto`，自动将不频繁访问的数据移动到低成本层。

### 2. 合理调整吞吐量容量

初始索引后读取负载显著降低。初始时使用高吞吐量同步，然后在运维阶段降低吞吐量以削减成本。

```bash
# 变更吞吐量容量（无停机）
aws fsx update-file-system \
  --file-system-id fs-0123456789abcdef0 \
  --ontap-configuration ThroughputCapacity=128
```

### 3. 利用 S3 Vectors

对于中小规模环境，使用 S3 Vectors（每月数美元）以避免 OpenSearch Serverless 成本（$700+/月）。当性能需求增加时可一键导出。

---

## 相关文档

| 文档 | 描述 |
|------|------|
| [permission-consistency.md](permission-consistency.md) | 权限变更一致性模型 |
| [s3-vectors-sid-architecture-guide.md](s3-vectors-sid-architecture-guide.md) | S3 Vectors + SID 架构 |
| [stack-architecture-comparison.md](stack-architecture-comparison.md) | 3 种配置比较 |
| [automation/fsxn-ops/README.md](../automation/fsxn-ops/README.md) | FSx ONTAP 运维自动化 |
