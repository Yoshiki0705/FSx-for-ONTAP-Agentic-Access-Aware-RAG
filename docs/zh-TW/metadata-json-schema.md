# .metadata.json 正式架構規範

**🌐 Language:** [日本語](../metadata-json-schema.md) | [English](../en/metadata-json-schema.md) | **繁體中文**

**建立日期**: 2026-06-08  
**狀態**: 正式規範  
**對象**: 開發者、資料工程師、合作夥伴

---

## 概述

用於為 FSx for ONTAP 上的文件附加權限資訊的中繼資料檔案（`.metadata.json`）正式規範。與 Bedrock Knowledge Base 的 metadata filtering 連動，實現 Permission-Aware RAG。

---

## 檔案命名規則

```
目標文件:     {path}/{filename}.{ext}
中繼資料檔案: {path}/{filename}.{ext}.metadata.json
```

**範例:**
```
reports/esg/2026-06-06/report-abc.json
reports/esg/2026-06-06/report-abc.json.metadata.json  ← 中繼資料
```

---

## 架構定義

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

### 欄位列表

| 欄位 | 型別 | 必填 | 說明 |
|------|------|------|------|
| `metadataAttributes` | Object | ✅ | 中繼資料屬性容器 |
| `metadataAttributes.allowed_group_sids` | `string[]`（正式）或 `string`（向後相容） | ✅ | 允許存取的 SID 清單 |
| `metadataAttributes.category` | `string` | ❌ | 文件類別 |
| `metadataAttributes.owner` | `string` | ❌ | 擁有者（團隊/部門） |
| `metadataAttributes.classification` | `string` enum | ❌ | 機密等級 |

### `allowed_group_sids` 格式

| 格式 | 範例 | 狀態 |
|------|------|------|
| **陣列（正式）** | `["S-1-1-0", "S-1-5-21-xxx-512"]` | ✅ 建議 |
| 逗號分隔 | `"S-1-1-0,S-1-5-21-xxx-512"` | ⚠️ 向後相容（已棄用） |
| JSON 字串 | `"[\"S-1-1-0\"]"` | ⚠️ 向後相容（已棄用） |
| 單一值 | `"S-1-1-0"` | ⚠️ 向後相容 |

> **重要**: 新建時請務必使用**陣列格式**。

### `classification` 有效值

| 值 | 說明 |
|----|------|
| `public` | 公開資訊（所有使用者可存取） |
| `internal` | 僅限內部 |
| `confidential` | 機密（僅限特定群組） |
| `restricted` | 極機密（需要個別核准） |

---

## SID 格式

Windows Security Identifier (SID) 標準格式：

```
S-{revision}-{authority}-{sub1}-{sub2}-...-{RID}
```

| SID | 含義 |
|-----|------|
| `S-1-1-0` | Everyone（所有人） |
| `S-1-5-21-xxx-512` | Domain Admins |
| `S-1-5-21-xxx-513` | Domain Users |
| `S-1-5-32-544` | Administrators (Builtin) |

---

## Fail-Closed 原則

| 狀態 | 行為 |
|------|------|
| `.metadata.json` 不存在 | **拒絕存取**（Fail-Closed） |
| `allowed_group_sids` 為空陣列 | **拒絕存取** |
| `allowed_group_sids` 中沒有與使用者 SID 符合的項目 | **拒絕存取** |
| `allowed_group_sids` 中有與使用者 SID 符合的項目 | **允許存取** |

---

## 驗證規則

1. `metadataAttributes` 為必填
2. `allowed_group_sids` 為必填且不能為空
3. 每個 SID 必須以 `S-` 開頭的有效格式（僅警告，不阻止）
4. 逗號分隔格式將輸出警告，建議遷移到陣列格式

---

## 建立工具

```bash
# 使用腳本建立正式格式的中繼資料
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

## 相關文件

- [Permission Matrix 測試](../../tests/permission-matrix/) — 31 個情境的權限驗證
- [KB Auto-Sync 錯誤處理](../kb-auto-sync-error-handling.md) — 含中繼資料文件的擷取
- [正式環境就緒清單](../production-readiness-checklist.md) — 中繼資料管理營運需求
