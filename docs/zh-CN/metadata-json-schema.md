# .metadata.json 正式架构规范

**🌐 Language:** [日本語](../metadata-json-schema.md) | [English](../en/metadata-json-schema.md) | **简体中文**

**创建日期**: 2026-06-08  
**状态**: 正式规范  
**受众**: 开发者、数据工程师、合作伙伴

---

## 概述

用于为 FSx for ONTAP 上的文档附加权限信息的元数据文件（`.metadata.json`）正式规范。与 Bedrock Knowledge Base 的 metadata filtering 联动，实现 Permission-Aware RAG。

---

## 文件命名规则

```
目标文档:   {path}/{filename}.{ext}
元数据文件: {path}/{filename}.{ext}.metadata.json
```

**示例:**
```
reports/esg/2026-06-06/report-abc.json
reports/esg/2026-06-06/report-abc.json.metadata.json  ← 元数据
```

---

## 架构定义

```json
{
  "metadataAttributes": {
    "allowed_group_sids": ["S-1-1-0", "S-1-5-21-xxx-512"],
    "category": "esg",
    "owner": "sustainability-team",
    "classification": "internal"
  }
}
```

### 字段列表

| 字段 | 类型 | 必须 | 说明 |
|------|------|------|------|
| `metadataAttributes` | Object | ✅ | 元数据属性容器 |
| `metadataAttributes.allowed_group_sids` | `string[]`（正式）或 `string`（向后兼容） | ✅ | 允许访问的 SID 列表 |
| `metadataAttributes.category` | `string` | ❌ | 文档类别 |
| `metadataAttributes.owner` | `string` | ❌ | 所有者（团队/部门） |
| `metadataAttributes.classification` | `string` enum | ❌ | 密级 |

### `allowed_group_sids` 格式

| 格式 | 示例 | 状态 |
|------|------|------|
| **数组（正式）** | `["S-1-1-0", "S-1-5-21-xxx-512"]` | ✅ 推荐 |
| 逗号分隔 | `"S-1-1-0,S-1-5-21-xxx-512"` | ⚠️ 向后兼容（已弃用） |
| JSON 字符串 | `"[\"S-1-1-0\"]"` | ⚠️ 向后兼容（已弃用） |
| 单值 | `"S-1-1-0"` | ⚠️ 向后兼容 |

> **重要**: 新建时请务必使用**数组格式**。

### `classification` 有效值

| 值 | 说明 |
|----|------|
| `public` | 公开信息（所有用户可访问） |
| `internal` | 仅限内部 |
| `confidential` | 机密（仅限特定组） |
| `restricted` | 绝密（需要个别审批） |

---

## SID 格式

Windows Security Identifier (SID) 标准格式：

```
S-{revision}-{authority}-{sub1}-{sub2}-...-{RID}
```

| SID | 含义 |
|-----|------|
| `S-1-1-0` | Everyone（所有人） |
| `S-1-5-21-xxx-512` | Domain Admins |
| `S-1-5-21-xxx-513` | Domain Users |
| `S-1-5-32-544` | Administrators (Builtin) |

---

## Fail-Closed 原则

| 状态 | 行为 |
|------|------|
| `.metadata.json` 不存在 | **拒绝访问**（Fail-Closed） |
| `allowed_group_sids` 为空数组 | **拒绝访问** |
| `allowed_group_sids` 中没有与用户 SID 匹配的项 | **拒绝访问** |
| `allowed_group_sids` 中有与用户 SID 匹配的项 | **允许访问** |

---

## 验证规则

1. `metadataAttributes` 为必填
2. `allowed_group_sids` 为必填且不能为空
3. 每个 SID 必须以 `S-` 开头的有效格式（仅警告，不阻止）
4. 逗号分隔格式将输出警告，建议迁移到数组格式

---

## 创建工具

```bash
# 使用脚本创建正式格式的元数据
python3 -c "
import json
metadata = {
    'metadataAttributes': {
        'allowed_group_sids': ['S-1-1-0', 'S-1-5-21-xxx-512'],
        'category': 'esg',
        'classification': 'internal'
    }
}
print(json.dumps(metadata, indent=2))
" > document.json.metadata.json
```

---

## 相关文档

- [Permission Matrix 测试](../../tests/permission-matrix/) — 31 个场景的权限验证
- [KB Auto-Sync 错误处理](../kb-auto-sync-error-handling.md) — 带元数据文档的摄取
- [生产就绪清单](../production-readiness-checklist.md) — 元数据管理运维要求
