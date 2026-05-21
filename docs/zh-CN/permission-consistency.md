# 权限变更一致性模型

**🌐 Language:** [日本語](../permission-consistency.md) | [English](../en/permission-consistency.md) | [한국어](../ko/permission-consistency.md) | **简体中文** | [繁體中文](../zh-TW/permission-consistency.md) | [Français](../fr/permission-consistency.md) | [Deutsch](../de/permission-consistency.md) | [Español](../es/permission-consistency.md)

**创建日期**: 2026-05-21  
**状态**: 草案  
**目标读者**: 运维设计人员、安全工程师

---

## 概述

本文档阐明了 FSx for ONTAP 上文件 ACL 变更何时以及如何反映到向量存储和权限缓存中，并定义了权限变更期间的一致性保证级别。

---

## 整体权限数据流

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         权限变更传播流程                                        │
│                                                                              │
│  ① ACL 变更       ② 元数据重新生成    ③ KB 重新同步       ④ 缓存失效          │
│                                                                              │
│  ┌──────────┐      ┌──────────────┐      ┌──────────────┐      ┌────────┐  │
│  │ FSx ONTAP│      │ .metadata    │      │ Bedrock KB   │      │DynamoDB│  │
│  │ NTFS ACL │─────▶│ .json 更新   │─────▶│ StartIngest  │─────▶│perm-   │  │
│  │ 变更     │      │              │      │ ionJob       │      │cache   │  │
│  └──────────┘      └──────────────┘      └──────────────┘      │TTL     │  │
│                                                                  │过期    │  │
│  管理员变更          服务角色              KB Auto-Sync          └────────┘  │
│  文件权限            Lambda 重新获取      （EventBridge           5 分钟 TTL  │
│                     ACL                   Scheduler）            自动失效    │
│                                           或手动触发                         │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 步骤详情

### 步骤 ①：ACL 变更（FSx for ONTAP）

| 操作 | 反映时间 | 备注 |
|------|----------|------|
| 文件 ACL 变更 | 即时（在 FSx 上） | NTFS ACL 立即反映在 FSx 卷上 |
| 组成员变更 | AD 传播后（通常 15 分钟内） | 取决于 AD 复制延迟 |
| 文件移动（重命名/移动） | 即时（在 FSx 上） | 继承权限被重新计算 |
| 继承权限变更 | 即时（在 FSx 上） | 父文件夹 ACL 变更传播到子项 |

### 步骤 ②：元数据重新生成

更新 `.metadata.json` 中 `allowed_group_sids` 的方法：

| 方法 | 触发条件 | 延迟 | 备注 |
|------|----------|------|------|
| 通过 Transfer Family 上传 | 文件上传时 | 即时 | 当 `enableTransferFamily=true` 时。自动为上传文件生成元数据 |
| AD Sync Lambda | 手动 / 定时 | 取决于配置 | `lambda/agent-core-ad-sync/` 重新获取 NTFS ACL |
| 手动更新 | 管理员操作 | 即时 | 对于 S3 bucket 回退路径，直接更新 `.metadata.json` |

### 步骤 ③：向量存储更新（KB 重新同步）

| 方法 | 触发条件 | 延迟 | 备注 |
|------|----------|------|------|
| KB Auto-Sync | EventBridge Scheduler（轮询） | 配置的间隔（默认：15 分钟） | 当 `enableKbAutoSync=true` 时。仅在检测到文件变更时执行 StartIngestionJob |
| 手动 KB 同步 | AWS 控制台 / CLI | 立即开始，数分钟内完成 | `aws bedrock-agent start-ingestion-job` |
| CloudTrail 事件 | S3 PutObject | 数分钟 | 当 Transfer Family 路径上 `enableCloudTrailIngestion=true` 时 |

**预估 KB 同步时间：**

| 文档数量 | 同步时间（预估） |
|----------|-----------------|
| ~100 | 1–3 分钟 |
| ~1,000 | 5–15 分钟 |
| ~10,000 | 30–60 分钟 |
| ~100,000 | 数小时（建议使用增量同步） |

### 步骤 ④：权限缓存失效

| 缓存 | TTL | 失效方法 | 备注 |
|------|-----|----------|------|
| DynamoDB `perm-cache` | 5 分钟 | 自动 TTL 过期 | 过滤结果缓存 |
| DynamoDB `user-access` | 无（持久化） | 需要显式更新 | 用户 SID / 组 SID |
| 浏览器会话 | 会话期间 | 登出 / 会话过期 | 前端内存缓存 |

---

## 最大权限传播延迟

### 正常运维

```
ACL 变更 → 元数据重新生成 → KB 重新同步 → 缓存过期
  0 分钟     0–15 分钟         1–15 分钟     0–5 分钟
                                              
最大延迟：~35 分钟（15 分钟轮询 + 15 分钟 KB 同步 + 5 分钟缓存）
```

### RPO 风格表达

| 场景 | 最大延迟 | 描述 |
|------|----------|------|
| 正常运维（KB Auto-Sync 15 分钟间隔） | 最大 35 分钟 | 轮询间隔 + KB 同步 + 缓存 TTL |
| 高频同步（KB Auto-Sync 5 分钟间隔） | 最大 15 分钟 | 缩短轮询间隔 |
| 手动即时同步 | 最大 10 分钟 | 手动 KB 同步 + 缓存 TTL |
| 紧急权限撤销 | 最大 5 分钟 | 强制缓存清除 + Fail-Closed |

---

## 紧急权限撤销流程

当需要立即撤销用户的访问权限时：

### 步骤 1：从 DynamoDB 删除用户 SID（立即生效）

```bash
# 删除用户的 SID 数据 → Fail-Closed 拒绝所有文档
aws dynamodb delete-item \
  --table-name perm-rag-demo-demo-user-access \
  --key '{"userId": {"S": "target-user@example.com"}}'
```

### 步骤 2：强制清除权限缓存

```bash
# 删除目标用户的缓存条目
aws dynamodb scan \
  --table-name perm-rag-demo-demo-perm-cache \
  --filter-expression "userId = :uid" \
  --expression-attribute-values '{":uid": {"S": "target-user@example.com"}}' \
  --projection-expression "cacheKey" \
  | jq -r '.Items[].cacheKey.S' \
  | xargs -I {} aws dynamodb delete-item \
    --table-name perm-rag-demo-demo-perm-cache \
    --key '{"cacheKey": {"S": "{}"}}'
```

### 步骤 3：禁用 Cognito 用户（会话失效）

```bash
# 禁用 Cognito 用户
aws cognito-idp admin-disable-user \
  --user-pool-id <USER_POOL_ID> \
  --username target-user@example.com
```

### 效果

- 步骤 1 之后：新的搜索请求立即拒绝所有文档（Fail-Closed）
- 步骤 2 之后：防止使用缓存的旧权限信息
- 步骤 3 之后：使用户的会话本身失效

---

## 按权限变更场景的行为

### 场景 1：文件 ACL 变更

```
管理员从文件 A 的 ACL 中移除用户 X
  → 从 .metadata.json 的 allowed_group_sids 中移除用户 X 的 SID
  → KB 重新同步更新向量存储元数据
  → 文件 A 从用户 X 的下次搜索结果中排除
```

**延迟**：最大 35 分钟（正常运维）

### 场景 2：AD 组成员变更

```
管理员从 Engineering 组中移除用户 X
  → AD 复制（~15 分钟）
  → DynamoDB user-access 的 groupSIDs 更新（在 AD Sync Lambda 执行时）
  → Engineering 组限制的文档从用户 X 的下次搜索中排除
```

**延迟**：AD 复制 + AD Sync Lambda 执行间隔 + 缓存 TTL

### 场景 3：文件移动（重命名 / 移动）

```
管理员将文件 A 从 /public/ 移动到 /confidential/
  → FSx 上重新计算继承权限
  → 需要重新生成 .metadata.json
  → KB 重新同步更新向量存储元数据
```

**注意**：文件移动时可能不会自动重新生成 `.metadata.json`。建议设计为 KB Auto-Sync 轮询检测文件路径变更并触发元数据重新生成。

### 场景 4：继承权限变更

```
管理员变更 /confidential/ 文件夹的 ACL（启用继承）
  → 下面所有文件的有效权限发生变化
  → 需要为每个文件重新生成 .metadata.json
  → KB 重新同步
```

**注意**：大量文件的批量权限变更需要时间进行 KB 同步。建议逐步变更。

---

## 一致性保证级别

| 级别 | 保证 | 实现方式 |
|------|------|----------|
| **Fail-Closed** | 无法获取 SID 信息时拒绝所有 | DynamoDB 错误 / 无记录时 |
| **最终一致性** | ACL 变更最终反映在搜索结果中 | KB Auto-Sync + 缓存 TTL |
| **无误报** | 无权限的文档永远不会被显示 | SID 匹配（集合交集） |
| **元数据必需** | 没有元数据的文档被排除 | 需要 `.metadata.json` |

### 注意：误拒的可能性

在以下情况下，应该可以访问的文档可能暂时不会显示（误拒）：

- 权限授予后立即（元数据尚未更新）
- KB 同步期间（旧元数据仍然存在）
- AD 复制延迟期间

**设计原则**：出于安全考虑，容忍误拒（可访问的项目不可见），而误报（受限项目可见）的目标是零发生。

---

## 推荐的监控与告警配置

```yaml
# 推荐的 CloudWatch Alarm 设置
Alarms:
  - Name: PermCacheHighMissRate
    Metric: CacheMissRate
    Threshold: 80%  # 高缓存未命中率 = 权限数据更新频率高
    
  - Name: KBSyncFailure
    Metric: IngestionJobFailureCount
    Threshold: 3  # 连续 3 次失败时告警
    
  - Name: SIDResolutionFailure
    Metric: SIDResolutionErrorCount
    Threshold: 1  # SID 解析失败时立即告警
    
  - Name: PermissionDenyAllFallback
    Metric: DenyAllFallbackCount
    Threshold: 5  # Fail-Closed 频繁触发时调查
```

---

## 相关文档

| 文档 | 描述 |
|------|------|
| [SID-Filtering-Architecture.md](SID-Filtering-Architecture.md) | SID 过滤架构详情 |
| [production-readiness-checklist.md](production-readiness-checklist.md) | 生产就绪检查清单 |
| [fsxn-sizing-and-performance.md](fsxn-sizing-and-performance.md) | FSx for ONTAP 容量规划与性能 |
