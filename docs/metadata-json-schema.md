# .metadata.json 正式スキーマ仕様

**🌐 Language:** **日本語** | [English](en/metadata-json-schema.md) | [한국어](ko/metadata-json-schema.md) | [简体中文](zh-CN/metadata-json-schema.md) | [繁體中文](zh-TW/metadata-json-schema.md) | [Français](fr/metadata-json-schema.md) | [Deutsch](de/metadata-json-schema.md) | [Español](es/metadata-json-schema.md)

**作成日**: 2026-06-08  
**ステータス**: 正式仕様  
**対象**: 開発者、データエンジニア、パートナー

---

## 概要

FSx for ONTAP 上のドキュメントにPermission情報を付与するためのメタデータファイル（`.metadata.json`）の正式仕様。Bedrock Knowledge Base の metadata filtering と連携し、Permission-Aware RAG を実現する。

---

## ファイル命名規則

```
対象ドキュメント:  {path}/{filename}.{ext}
メタデータファイル: {path}/{filename}.{ext}.metadata.json
```

**例:**
```
reports/esg/2026-06-06/report-abc.json
reports/esg/2026-06-06/report-abc.json.metadata.json  ← メタデータ
```

---

## スキーマ定義

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

### フィールド一覧

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `metadataAttributes` | Object | ✅ | メタデータ属性のコンテナ |
| `metadataAttributes.allowed_group_sids` | `string[]` (正式) or `string` (後方互換) | ✅ | アクセス許可SIDリスト |
| `metadataAttributes.category` | `string` | ❌ | ドキュメントカテゴリ |
| `metadataAttributes.owner` | `string` | ❌ | 所有者（チーム/部門） |
| `metadataAttributes.classification` | `string` enum | ❌ | 機密レベル |

### `allowed_group_sids` 形式

| 形式 | 例 | ステータス |
|------|-----|-----------|
| **配列（正式）** | `["S-1-1-0", "S-1-5-21-xxx-512"]` | ✅ 推奨 |
| カンマ区切り | `"S-1-1-0,S-1-5-21-xxx-512"` | ⚠️ 後方互換（非推奨） |
| JSON文字列 | `"[\"S-1-1-0\"]"` | ⚠️ 後方互換（非推奨） |
| 単一値 | `"S-1-1-0"` | ⚠️ 後方互換 |

> **重要**: 新規作成時は必ず **配列形式** を使用してください。

### `classification` 有効値

| 値 | 説明 |
|----|------|
| `public` | 公開情報（全ユーザーアクセス可能） |
| `internal` | 社内限定 |
| `confidential` | 機密（特定グループのみ） |
| `restricted` | 極秘（個別承認必要） |

---

## SID フォーマット

Windows Security Identifier (SID) の標準フォーマット:

```
S-{revision}-{authority}-{sub1}-{sub2}-...-{RID}
```

| SID | 意味 |
|-----|------|
| `S-1-1-0` | Everyone（全員） |
| `S-1-5-21-xxx-512` | Domain Admins |
| `S-1-5-21-xxx-513` | Domain Users |
| `S-1-5-32-544` | Administrators (Builtin) |

---

## Fail-Closed 原則

| 状態 | 動作 |
|------|------|
| `.metadata.json` が存在しない | **アクセス拒否**（Fail-Closed） |
| `allowed_group_sids` が空配列 | **アクセス拒否** |
| `allowed_group_sids` にユーザーSIDと一致するものがない | **アクセス拒否** |
| `allowed_group_sids` にユーザーSIDと一致するものがある | **アクセス許可** |

---

## バリデーションルール

1. `metadataAttributes` は必須
2. `allowed_group_sids` は必須かつ非空
3. 各SIDは `S-` で始まる有効なフォーマット（警告のみ、ブロックしない）
4. カンマ区切り形式は警告を出力し、配列形式への移行を推奨

---

## 作成ツール

```bash
# スクリプトで正式形式のメタデータを作成
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

## 関連ドキュメント

- [Permission Matrix テスト](../tests/permission-matrix/) — 31シナリオのPermission検証
- [KB Auto-Sync エラーハンドリング](kb-auto-sync-error-handling.md) — メタデータ付きドキュメントのingestion
- [本番化チェックリスト](production-readiness-checklist.md) — メタデータ管理の運用要件
