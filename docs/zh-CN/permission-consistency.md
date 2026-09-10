# 权限元数据变更一致性模型

**🌐 Language:** [日本語](../permission-consistency.md) | [English](../en/permission-consistency.md) | [한국어](../ko/permission-consistency.md) | **简体中文** | [繁體中文](../zh-TW/permission-consistency.md) | [Français](../fr/permission-consistency.md) | [Deutsch](../de/permission-consistency.md) | [Español](../es/permission-consistency.md)

**创建日期**: 2026-05-21
**更新日期**: 2026-09-07（依据实现核实，撤回以 ACL 为起点的自动反映流程的描述）
**状态**: 草案
**目标读者**: 运维设计人员、安全工程师

---

## 概述

本文档定义检索时用于权限判定的数据发生变更后，何时反映到检索结果中。用于判定的有两项：文档侧的 `.metadata.json` 与用户侧的 DynamoDB `user-access`。

**不存在自动跟随 FSx for ONTAP 上文件 NTFS ACL 变更的机制。** 权限索引并非 ACL 的投影，而是单独构建与维护的索引。原因与运维含义见「ACL 变更无法到达的原因」。

---

## 用于权限判定的数据

| 数据 | 存放位置 | 生成·更新主体 | 检索时的作用 |
|------|---------|------------|------------|
| `.metadata.json`（`allowed_group_sids` / `allowed_uids` / `allowed_gids`） | S3 AP 上的相邻对象 → Bedrock KB 的元数据属性 | 因路径而异（见下表） | 取得区块的许可 SID / UID / GID 集合 |
| `user-access`（`userSID` / `groupSIDs` / `uid` / `gid` / `unixGroups`） | DynamoDB | AD / LDAP 同步 Lambda（`lambda/agent-core-ad-sync/`） | 调用者的 SID / UID / GID 集合 |
| `perm-cache` | DynamoDB（TTL 5 分钟） | 权限过滤器 | 判定结果的缓存 |

`.metadata.json` 的生成来源：

| 路径 | 生成来源 | 契机 |
|------|--------|------|
| Transfer Family SFTP（`enableTransferFamily=true`） | 管理员维护的 DynamoDB 映射（以上传用户名为键） | 文件上传时 |
| 自建嵌入服务器（`ENV_AUTO_METADATA=true`，可选·非默认） | 通过 ONTAP REST API 获取真实 NTFS ACL | 检测到未处理文件时（以 mtime 判定） |
| 演示环境 | 手动放置仓库自带的示例 | 手动 |

SFTP 用户被授予对 `*.metadata.json` 的 IAM Deny，因此上传者无法编写自己的权限。

---

## 反映路径

自动反映的路径有 2 条。

### 路径 A：文档侧权限变更

| 阶段 | 承担者 | 延迟 |
|------|-------|------|
| ① `.metadata.json` 更新 | 上表的生成来源，或管理员直接更新 | 取决于契机 |
| ② 差异检测 | KB Auto-Sync（EventBridge Scheduler，比较 `size` / `lastModified` / `ETag`） | 轮询间隔（默认 15 分钟） |
| ③ 向量存储更新 | `StartIngestionJob` | 1~15 分钟（取决于件数） |
| ④ 判定结果缓存失效 | `perm-cache` 的 TTL | 最长 5 分钟 |

### 路径 B：用户侧权限变更

| 阶段 | 承担者 | 延迟 |
|------|-------|------|
| ① AD 组成员关系变更 | AD 复制 | 通常 15 分钟以内 |
| ② `user-access` 更新 | AD / LDAP 同步 Lambda。**由 Cognito 的 PostAuthentication / PostConfirmation 触发，没有定时执行** | 直到该用户下次登录（不定） |
| ③ 判定结果缓存失效 | `perm-cache` 的 TTL，或通过 `user-access` 的 DynamoDB Streams 显式失效 | 最长 5 分钟 |

路径 B 的 ② 对会话仍在持续的用户不会到达。若需可靠吊销，请使用「紧急权限吊销步骤」。

---

## ACL 变更无法到达的原因

即使变更文件的 NTFS ACL，在任何部署配置下 `.metadata.json` 都不会被重新生成。实现核实结果如下。

| 机制 | ACL 变更时是否运行 | 依据 |
|------|---------------|------|
| AD / LDAP 同步 Lambda | 不运行 | 既未实现 ACL 获取，也未实现 `.metadata.json` 写入。获取的仅为 AD 上的用户 SID |
| Transfer Family 的元数据生成 | 不运行 | 契机为文件上传。生成来源是管理员维护的 DynamoDB 映射，不参照 ACL |
| 自建嵌入服务器（`ENV_AUTO_METADATA=true`） | 不运行 | 重新处理的判定基于 `mtime`。仅变更 ACL 不会改变 `mtime` |
| KB Auto-Sync | 不运行 | 差异判定基于 `size` / `lastModified` / `ETag`。ACL 变更不会改变其中任何一项 |
| FSx 权限服务（`lambda/permissions/fsx-permission-service.ts`） | 不在范围内 | 读取 ACL 的代码存在，但没有任何 CDK 堆栈部署它 |

**含义**：要把 ACL 变更反映到检索结果，需由运维人员重新生成 `.metadata.json` 并放置到 S3 AP。该索引的正确性依赖运维，与 ACL 的一致并非自动保证。紧急阻断访问请在用户侧执行（删除 `user-access` + 清除缓存 + 使会话失效），而不是变更 ACL。

---

## 各阶段的详细

### 向量存储更新（KB 重新同步）

| 方式 | 触发 | 延迟 | 备注 |
|------|-----|------|------|
| KB Auto-Sync | EventBridge Scheduler（轮询） | 配置间隔（默认：15 分钟） | `enableKbAutoSync=true` 时。仅在检测到文件变更时执行 StartIngestionJob |
| 手动 KB 同步 | AWS 控制台 / CLI | 立即开始，完成需数分钟 | `aws bedrock-agent start-ingestion-job` |
| CloudTrail 事件 | S3 PutObject | 数分钟 | Transfer Family 路径下 `enableCloudTrailIngestion=true` 时 |

**KB 同步耗时参考：**

| 文档数 | 同步时间（参考） |
|-------|--------------|
| ~100 件 | 1~3 分钟 |
| ~1,000 件 | 5~15 分钟 |
| ~10,000 件 | 30~60 分钟 |
| ~100,000 件 | 数小时（建议增量同步） |

### 权限缓存失效

| 缓存 | TTL | 失效方式 | 备注 |
|------|-----|--------|------|
| DynamoDB `perm-cache` | 5 分钟 | TTL 自动过期 / 通过 `user-access` 的 Streams 显式删除 | 过滤结果的缓存 |
| DynamoDB `user-access` | 无（持久） | 需要显式更新 | 用户 SID / 组 SID |
| 浏览器会话 | 会话期间 | 登出 / 会话过期 | 前端的内存缓存 |

---

## 最大延迟（Permission Propagation Delay）

| 起点 | 最大延迟 | 明细 |
|------|--------|------|
| 文档侧权限变更（路径 A，Auto-Sync 15 分钟间隔） | 约 35 分钟 | 轮询 15 分钟 + KB 同步 15 分钟 + 缓存 5 分钟 |
| 文档侧权限变更（Auto-Sync 5 分钟间隔） | 约 25 分钟 | 轮询 5 分钟 + KB 同步 15 分钟 + 缓存 5 分钟 |
| 文档侧权限变更（手动 KB 同步） | 约 20 分钟 | KB 同步 15 分钟 + 缓存 5 分钟 |
| 用户侧权限变更（路径 B） | 无法定义 | AD 复制 15 分钟 + 直到下次登录（不定）+ 缓存 5 分钟 |
| 紧急权限吊销（下述步骤） | 最长 5 分钟 | 强制清除缓存 + Fail-Closed |
| 文件的 ACL 变更 | **无法定义** | 没有自动跟随的机制。前提是运维人员重新生成 `.metadata.json` |

KB 同步的 15 分钟取决于文档数（参见上文耗时参考）。1 万件规模为 30~60 分钟，合计延迟也相应增加。

---

## 紧急权限吊销步骤

需要立即吊销用户访问权限时：

### 步骤 1：从 DynamoDB 删除用户 SID（立即生效）

```bash
# 删除用户的 SID 数据 → 依据 Fail-Closed 拒绝全部文档
aws dynamodb delete-item \
  --table-name perm-rag-demo-demo-user-access \
  --key '{"userId": {"S": "target-user@example.com"}}'
```

### 步骤 2：强制清除权限缓存

```bash
# 删除该用户的缓存条目
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

### 步骤 3：禁用 Cognito 用户（使会话失效）

```bash
# 禁用 Cognito 用户
aws cognito-idp admin-disable-user \
  --user-pool-id <USER_POOL_ID> \
  --username target-user@example.com
```

### 效果

- 执行步骤 1 后：新的检索请求立即拒绝全部文档（Fail-Closed）
- 执行步骤 2 后：防止使用已缓存的旧权限信息
- 执行步骤 3 后：使用户的会话本身失效

**请注意该步骤阻断的是用户侧，而非文档侧。** 只对某一个人隐藏某一份文档的操作，需要等待 `.metadata.json` 更新与 KB 重新同步，因此会受到路径 A 的延迟影响。

---

## 各权限变更场景的行为

### 场景 1：文档的权限元数据变更

```
管理员从文件 A 的 .metadata.json 中删除 User X 的 SID
  → KB Auto-Sync 检测到差异（ETag 变化）
  → 通过 StartIngestionJob 更新向量存储的元数据
  → perm-cache 的 TTL 失效后，User X 的检索中排除文件 A
```

**延迟**：最长约 35 分钟（Auto-Sync 15 分钟间隔时）

### 场景 2：AD 组成员关系变更

```
管理员将 User X 从 Engineering 组中删除
  → AD 复制（~15 分钟）
  → 在 User X 下次登录时，AD 同步 Lambda 更新 user-access 的 groupSIDs
  → perm-cache 失效后，排除仅限 Engineering 的文档
```

**延迟**：AD 复制 + 直到下次登录（不定）+ 缓存 TTL。**会话持续期间不会反映。** 需要即时性时请使用紧急权限吊销步骤。

### 场景 3：文件移动（rename / move）

```
管理员将文件 A 从 /public/ 移动到 /confidential/
  → 在 FSx 上重新计算继承权限（仅 ONTAP 侧的有效权限）
  → .metadata.json 不会自动跟随目标位置的权限
  → 需由运维人员重新生成并放置 .metadata.json
```

**注意**：源位置的许可 SID 仍然保留，因此仅移动不会改变检索上的可见性。若将目录结构用作权限边界，请把移动与 `.metadata.json` 更新合并为一个步骤。

### 场景 4：上级文件夹的 ACL 批量变更

```
管理员变更 /confidential/ 文件夹的 ACL（启用继承）
  → 其下全部文件在 ONTAP 上的有效权限发生变更
  → .metadata.json 不跟随（参见「ACL 变更无法到达的原因」）
  → 需要重新生成其下文件的 .metadata.json 并重新同步 KB
```

**注意**：大量文件的批量变更会使 KB 同步耗时。建议分阶段变更。

---

## 一致性保证级别

**基于时间的访问控制（`enableAdvancedPermissions`）在失败时分为两种方向。** 配置缺陷（无效时区、无法按 `HH:mm` 解析的时刻）为 fail-open：解除时间限制并允许访问（避免将用户锁在外面）。而**当时钟本身无法读取时则拒绝** —— 在无法判断是否处于时间窗口内的情况下允许访问，会使时间限制被静默解除。两种情况下 SID 比对都独立生效，因此该分支不会削弱权限索引的判定。

| 级别 | 保证内容 | 实现方式 |
|------|--------|--------|
| **Fail-Closed** | 无法获取 SID 信息时全部拒绝 | DynamoDB 出错时 / 无记录时 |
| **Eventually Consistent** | 权限元数据（`.metadata.json` / `user-access`）的变更最终反映到检索结果 | KB Auto-Sync + 缓存 TTL + Streams 失效 |
| **No False Positive** | 不显示无权限的文档 | SID 匹配（集合的交集） |
| **Metadata Required** | 排除没有元数据的文档 | 必须有 `.metadata.json` |
| **ACL 跟随的不成立** | 文件的 ACL 变更不会自动反映 | 前提是运维人员重新生成 `.metadata.json` |

### 注意：False Negative 的可能性

以下情况下，本应可访问的文档可能暂时不显示（False Negative）：

- 授权后立即（`.metadata.json` 未更新，或在 KB 重新同步之前）
- KB 同步中（旧元数据仍残留）
- AD 复制延迟中，或目标用户重新登录之前

**设计方针**：出于安全考虑，允许 False Negative（应当可见的看不到），并以 False Positive（不应可见的被看到）为零为目标。

但**该方针以权限索引正确为前提。** 若收紧了 ACL 却未更新 `.metadata.json`，索引侧仍会返回许可，从而产生 False Positive。索引的维护本身就是边界。

---

## 监控·告警推荐配置

```yaml
# CloudWatch Alarm 推荐配置
Alarms:
  - Name: PermCacheHighMissRate
    Metric: CacheMissRate
    Threshold: 80%  # 缓存未命中率高 = 权限数据更新频率高

  - Name: KBSyncFailure
    Metric: IngestionJobFailureCount
    Threshold: 3  # 连续 3 次失败告警

  - Name: SIDResolutionFailure
    Metric: SIDResolutionErrorCount
    Threshold: 1  # SID 解析失败立即告警

  - Name: PermissionDenyAllFallback
    Metric: DenyAllFallbackCount
    Threshold: 5  # Fail-Closed 触发较多时需要调查
```

---

## 相关文档

| 文档 | 内容 |
|------|------|
| [SID-Filtering-Architecture.md](SID-Filtering-Architecture.md) | SID 过滤设计详情 |
| [production-readiness-checklist.md](production-readiness-checklist.md) | 生产化检查清单 |
| [fsxn-sizing-and-performance.md](fsxn-sizing-and-performance.md) | FSx for ONTAP 性能·容量设计 |
