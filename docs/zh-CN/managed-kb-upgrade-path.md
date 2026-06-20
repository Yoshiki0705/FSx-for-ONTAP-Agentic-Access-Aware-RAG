# Amazon Bedrock Managed Knowledge Base 升级路径（验证步骤）

**🌐 Language:** [日本語](../managed-kb-upgrade-path.md) | [English](../en/managed-kb-upgrade-path.md) | [한국어](../ko/managed-kb-upgrade-path.md) | **简体中文** | [繁體中文](../zh-TW/managed-kb-upgrade-path.md) | [Français](../fr/managed-kb-upgrade-path.md) | [Deutsch](../de/managed-kb-upgrade-path.md) | [Español](../es/managed-kb-upgrade-path.md)

**创建日期**: 2026-06-18
**目标区域**: ap-northeast-1（东京）— Managed KB 在东京区域可用（2026-06-17 GA）
**状态**: 验证步骤文档（未实施迁移 / 保留现有路径）
**相关**: [Managed KB 迁移评估](managed-kb-migration-evaluation.md)（判断标准 / 权衡）

---

## 0. 本文档的定位

本文档将 [Managed KB 迁移评估](managed-kb-migration-evaluation.md) 中整理的验证要点具体化为**可执行的验证步骤**。判断标准·权衡的讨论请参阅迁移评估文档，本文档聚焦于"如何验证"。

重要前提：

- 本文档为**验证步骤指南**，并非建议立即迁移。
- 现有路径（Bedrock KB + OpenSearch Serverless / S3 Vectors）**不会删除**。这是对并行选项的额外验证。
- Managed KB 并非比传统型 KB"更优"。这是**按用途选择**，能否满足本项目主要目的 Permission-aware RAG 的要求（ACL 严格应用）决定迁移可行性。
- 以下内容的证据层级分类如下。

| 层级 | 定义 | 本文档中的处理 |
|------|------|--------------|
| Public evidence | 可从 AWS 官方文档·博客验证 | 附出处链接记述 |
| Project-context expectation | 本项目内的设计判断·预期值（无法公开验证） | 明确标注为"本项目的假设" |

> ⚠️ **Validation Required**: 本文档的验证步骤包含将 AWS 官方教程（[面向传统型 KB](https://docs.aws.amazon.com/fsx/latest/ONTAPGuide/tutorial-build-rag-with-bedrock.html)）**改读为面向 Managed KB 的前提**。Managed KB 的 S3 连接器能否识别 FSx for ONTAP S3 Access Point 官方尚未确认，验证 V1 须首先确认此点。

---

## 1. 验证的整体概览

判断迁移可行性的验证由以下 3 个阶段构成。每个阶段以前一阶段的成功为前提。

```
Phase A: 连接验证 (V1, V2)
  └─ S3 AP 能否作为数据源 / 元数据是否保留
       │ PASS
       ▼
Phase B: 授权验证 (V3, V4, V5)
  └─ ACL 过滤是否生效 / 多跳中是否维持 / 反映延迟
       │ PASS
       ▼
Phase C: 审计·运维验证 (V6, V7)
  └─ lineage 记录 / 对话历史·缓存的 ACL
       │ PASS
       ▼
迁移可行性判断 (→ 迁移评估文档 §5)
```

> 任何阶段都针对**FlexClone 创建的验证用卷，而非生产数据**执行（参见 §4）。

---

## 2. Phase A: S3 Access Point 数据源连接验证

### 2.1 验证 V1: S3 连接器是否识别 S3 AP URI

⚠️ **Validation Required**: 官方教程面向传统型 KB，Managed KB 的 S3 连接器是否接受 S3 AP 的 alias 格式 URI 尚未确认。

**前提准备**：

1. 用 FlexClone 创建验证用卷（§4 的步骤）
2. 为验证用卷创建 S3 Access Point（参考现有 `setup-kb-datasource.sh` 的逻辑）
3. 确认 S3 AP alias（格式：`<alias>-<suffix>.s3-accesspoint.<region>.amazonaws.com` 或 ARN）

**验证步骤**：

```bash
# 1. 创建 Managed KB（托管向量存储）
#    ⚠️ 以下为假设命令。Managed KB 的准确 API 参数请在 GA 文档中确认
aws bedrock-agent create-knowledge-base \
  --name "managed-kb-validation" \
  --region ap-northeast-1 \
  --knowledge-base-configuration '{...managed configuration...}' \
  # ⚠️ managed storage 的指定方法需确认

# 2. 将 S3 连接器添加为数据源并指定 S3 AP URI
#    验证的核心：S3 AP 的 alias 格式 / ARN 格式哪个被接受
aws bedrock-agent create-data-source \
  --knowledge-base-id "<KB_ID>" \
  --data-source-configuration '{
    "type": "S3",
    "s3Configuration": {
      "bucketArn": "<S3_AP_ARN>"  # ⚠️ 此处是否被接受是 V1 的本质
    }
  }'
```

**判定标准**：

| 结果 | 判定 | 下一步行动 |
|------|------|----------|
| S3 AP ARN/alias 被接受，同步成功 | ✅ PASS | 进入 V2 |
| S3 AP 不可行但普通 S3 桶可行 | △ 有条件 | 考虑基于 DataSync 的 S3 中继路径（ACL 元数据保留需额外验证） |
| S3 连接器自身同步失败 | ❌ FAIL | 迁移不成立。保留现行配置 |

> **本项目的假设**: 假设 S3 兼容 API 则可连接，但 S3 AP 特有的约束（[FSx for ONTAP S3 AP 兼容性矩阵](https://github.com/Yoshiki0705/fsxn-lakehouse-integrations/blob/main/docs/en/compatibility-matrix.md) 中记述的 ListObjectsV2 延迟等）可能影响 Managed KB 的爬虫。

### 2.2 验证 V2: 元数据保留

**验证步骤**：

1. 在验证用卷上放置 `.metadata.json`（包含 `allowed_group_sids`）
2. 执行 Managed KB 的同步
3. 通过 `Retrieve` API 获取文档，确认响应中是否包含元数据

```bash
aws bedrock-agent-runtime retrieve \
  --knowledge-base-id "<KB_ID>" \
  --retrieval-query '{"text": "测试查询"}' \
  --region ap-northeast-1
# 确认响应的 metadata 字段中是否包含 allowed_group_sids
```

**判定标准**：

| 结果 | 判定 |
|------|------|
| `allowed_group_sids` 作为元数据保留且可获取 | ✅ PASS → 进入 Phase B |
| 元数据缺失或转换为其他格式 | ❌ FAIL → 无法 ACL 过滤。保留现行配置 |

> ⚠️ Managed KB 的 Smart Parsing 如何处理元数据尚未确认。请确认 `.metadata.json` 的 sidecar 方式是否与传统型 KB 同样生效，或是否需要其他元数据赋予方式（连接器属性等）。

---

## 3. Phase B: Permission-aware RAG 设计课题验证

本项目的主要目的是 Permission-aware RAG，ACL 严格应用是不可让步的要求。除非清除 Phase B 的验证，否则保留现行配置为默认方针。

### 3.1 与现有方式的不变条件

现行采用[与向量存储无关的方式](s3-vectors-sid-architecture-guide.md)。

```
Bedrock KB Retrieve → 检索结果 + allowed_group_sids
→ 应用端(route.ts)匹配 用户SID ∩ 文档SID（Fail-Closed）
→ 仅匹配的文档进入 Converse API
```

**迁移时须维持的不变条件**: "在应用端强制最终授权，SID 获取失败则全部拒绝（Fail-Closed）"。验证 Managed KB 不破坏这一不变条件。

### 3.2 验证 V3: 通过 `listContains` 的 SID 数组匹配

根据 [AgentCore Gateway connector target 文档](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/gateway-target-connector-managed-kb.html)，Managed KB 的 `Retrieve` 工具在 `managedSearchConfiguration.filter` 中支持 `listContains` 运算符（概括出处主旨）。

**验证步骤**：

```bash
# 仅获取用户 SID 包含在 allowed_group_sids 数组中的文档
aws bedrock-agent-runtime retrieve \
  --knowledge-base-id "<KB_ID>" \
  --retrieval-query '{"text": "机密文档测试"}' \
  --retrieval-configuration '{
    "vectorSearchConfiguration": {
      "filter": {
        "listContains": {
          "key": "allowed_group_sids",
          "value": "<USER_SID>"
        }
      }
    }
  }' \
  --region ap-northeast-1
```

**判定标准**：

| 测试用例 | 预期结果 |
|---------|---------|
| 用户 SID 在数组中的文档 | 被获取 |
| 用户 SID 不在数组中的文档 | 被排除 |
| 缺少 `allowed_group_sids` 的文档 | 被排除（Fail-Closed） |

> ⚠️ **重要**: 即使 `listContains` 在检索层过滤，本项目的设计原则是**应用端的重新授权**。建议将 Managed KB 的 filter 用作"一级过滤"，最终授权在应用端维持的两层防御（不仅依赖 filter）。

### 3.3 验证 V4: Agentic Retrieval 多跳中的过滤维持

这是 Managed KB 特有的最大风险。`AgenticRetrieveStream` 将查询分解为子查询，反复执行多次检索。**若每跳的元数据过滤未维持，则中间步骤会混入权限外数据。**

**验证步骤**：

1. 准备需要跨越多个不同权限文档的复杂查询（例如："比较部门 A 的机密设计书与公开规范"）
2. 以无法访问权限外文档（部门 A 机密）的用户执行 `AgenticRetrieveStream`
3. 检查每跳的跟踪（CloudWatch / 响应的中间步骤），验证权限外文档在**任何一跳都未被引用**

**判定标准**：

| 结果 | 判定 |
|------|------|
| 所有跳应用 `userContext` / filter，未引用权限外数据 | ✅ PASS |
| 中间跳过滤脱落，混入权限外数据 | ❌ FAIL → 禁用多跳，仅使用单次 `Retrieve` |

> ⚠️ **Validation Required**: 向多跳每步的过滤传播官方未明示。若验证无法确认，则不使用 `AgenticRetrieveStream`，仅限于单次 `Retrieve` + 应用端匹配（即使放弃多跳的优势也优先保证 ACL）。

### 3.4 验证 V5: 权限变更 / 删除的反映延迟

**验证步骤**：

1. 将用户的 SID 从组中删除（或更改文档的 `allowed_group_sids`）
2. Managed KB 同步完成后，以该用户重新检索
3. 计测旧权限数据不再返回为止的延迟

**判定标准**: 反映延迟是否在本项目 [权限一致性模型](permission-consistency.md) 定义的可接受范围内。若超出范围，则紧急吊销（emergency revocation）需通过应用端缓存失效另行保障的设计。

---

## 4. 使用 FlexClone 的安全验证模式

绝不能将生产数据直接作为 Managed KB 的爬取对象。用 FlexClone 创建与生产等同的验证用卷，在隔离环境中验证。

### 4.1 为何使用 FlexClone

| 视角 | 直接访问生产 | FlexClone 验证 |
|------|-------------|---------------|
| 对生产 I/O 的影响 | 爬取负载影响业务工作负载 | 无影响（克隆独立） |
| 数据一致性 | 爬取中的更新可能导致不一致 | 时间点一致 |
| 验证的可重现性 | 因生产数据变动难以重现 | 从同一快照可任意次重现 |
| 误操作风险 | 误写入生产数据的风险 | 克隆可丢弃 |
| 成本 | — | 仅快照差分（初期数 MB） |

### 4.2 验证用克隆创建步骤

```bash
# 1. 创建生产卷的快照（ONTAP REST API / CLI）
#    ⚠️ 从 VPC 内访问 ONTAP 管理端点
curl -X POST "https://<ontap-mgmt-ip>/api/storage/volumes/<volume-uuid>/snapshots" \
  -u "<user>:<pass>" \
  -d '{"name": "managed-kb-validation-snap"}'

# 2. 从快照创建 FlexClone
curl -X POST "https://<ontap-mgmt-ip>/api/storage/volumes" \
  -u "<user>:<pass>" \
  -d '{
    "name": "managed_kb_validation_clone",
    "clone": {
      "parent_volume": {"name": "<prod-volume-name>"},
      "parent_snapshot": {"name": "managed-kb-validation-snap"},
      "is_flexclone": true
    },
    "svm": {"name": "<svm-name>"}
  }'

# 3. 为克隆卷创建 S3 Access Point
#    （将现有 setup-kb-datasource.sh 的逻辑挪用于验证）

# 4. 验证完成后，丢弃克隆（不影响生产）
curl -X DELETE "https://<ontap-mgmt-ip>/api/storage/volumes/<clone-uuid>" \
  -u "<user>:<pass>"
```

> 准确的 ONTAP REST API 参数请参阅 [运维 Runbook](operations-runbook.md) 的 ONTAP 操作章节。SSH 密钥·管理端点信息遵循生产步骤。

### 4.3 验证环境的隔离原则

- 验证用 Managed KB 作为与生产 KB **独立的资源**创建，不更改生产 KB ID
- 验证用 S3 AP 仅指向验证用克隆（不引用生产卷）
- 验证用 IAM 角色以**最小权限**限定于验证资源（不授予对生产数据的读取权限）
- 验证完成后丢弃克隆·KB·S3 AP·IAM 角色全部

---

## 5. 审计·lineage 验证 (Phase C / Optional)

⚠️ **Validation Required**: 经由 Managed KB 的访问是否记录在联动对象（[fsxn-lakehouse-integrations](https://github.com/Yoshiki0705/fsxn-lakehouse-integrations)）的 Unity Catalog lineage 中尚未确认。

**验证视角**：

- Managed KB 的 `Retrieve` / `AgenticRetrieveStream` 调用是否记录在 CloudTrail 中
- 能否追踪"谁·何时·使用了哪些文档来源信息·在哪个响应中"
- 对话历史·缓存的 ACL 应用是否在应用端维持（由于 Managed 端缓存行为不明，在应用端显式控制）

审计要求的详情请参阅 [治理·审计设计](governance-and-audit.md)。

---

## 6. 验证清单（摘要）

在迁移可行性判断前，请清除以下所有项。

- [ ] **V1**: S3 连接器识别 FSx for ONTAP S3 AP（Phase A）
- [ ] **V2**: `allowed_group_sids` 作为元数据保留（Phase A）
- [ ] **V3**: `listContains` SID 数组匹配生效（Phase B）
- [ ] **V4**: Agentic Retrieval 多跳中维持过滤（Phase B）
- [ ] **V5**: 权限变更 / 删除的反映延迟在可接受范围内（Phase B）
- [ ] **V6**: 记录在 CloudTrail / lineage（Phase C）
- [ ] **V7**: 对话历史 / 缓存的 ACL 应用维持（Phase C）
- [ ] 所有验证在 **FlexClone 验证用卷**执行（不影响生产）
- [ ] 维持应用端 Fail-Closed 重新授权的不变条件

> 任何一项 FAIL 时，除非有能够容忍该风险的设计补充，否则**保留现行配置（OpenSearch Serverless / S3 Vectors）**为默认方针。向 CDK 堆栈的 Managed KB 集成仅在所有验证清除后着手。

---

## 7. 相关文档

| 文档 | 内容 |
|------|------|
| [Managed KB 迁移评估](managed-kb-migration-evaluation.md) | 判断标准 / 权衡 / 现有配置比较 |
| [CDK 堆栈架构指南](stack-architecture-comparison.md) | 向量存储配置对比（含 Managed KB 列） |
| [SID-Filtering-Architecture.md](SID-Filtering-Architecture.md) | SID 过滤设计 |
| [s3-vectors-sid-architecture-guide.md](s3-vectors-sid-architecture-guide.md) | 与向量存储无关的授权方式 |
| [权限一致性模型](permission-consistency.md) | ACL 变更反映流程 / 可接受延迟 |
| [治理·审计设计](governance-and-audit.md) | 审计日志 / lineage 要求 |
| [运维 Runbook](operations-runbook.md) | ONTAP 操作（FlexClone 创建步骤） |

---

## 参考链接

- [Amazon Bedrock Managed Knowledge Base GA 公告](https://aws.amazon.com/about-aws/whats-new/2026/06/amazon-bedrock-managed-knowledge-base/)
- [AWS 官方教程（传统型 KB）](https://docs.aws.amazon.com/fsx/latest/ONTAPGuide/tutorial-build-rag-with-bedrock.html)
- [AgentCore Gateway connector target（Managed KB）](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/gateway-target-connector-managed-kb.html)

> 为遵守许可限制，已对内容进行改写。AWS 官方信息在保留出处主旨的前提下进行了概括·改写。
