# 設定パラメータ完全リファレンス

## 📋 概要

このドキュメントは、Embedding Batch Workload Template で使用される全ての設定パラメータの完全なリファレンスです。各パラメータの詳細な説明、デフォルト値、推奨値、制約事項を提供します。

## 🎯 対象読者

- システム管理者
- DevOps エンジニア
- インフラ設計者
- 設定を調整する全てのユーザー

## 📁 設定ファイルの場所

```
config/
├── dev.json              # 開発環境設定
├── staging.json          # ステージング環境設定
├── prod.json             # 本番環境設定
└── examples/
    ├── basic-config.json
    ├── enterprise-config.json
    └── existing-vpc-config.json
```

## 🔧 基本設定パラメータ

### projectName

**説明**: プロジェクトの一意な識別子

**型**: `string`

**必須**: ✅ はい

**制約**:
- 英数字とハイフンのみ使用可能
- 3-32 文字
- 小文字推奨
- AWS リソース名に使用されるため、一意である必要がある

**デフォルト値**: なし

**推奨値**:
- 開発環境: `embedding-dev`
- 本番環境: `embedding-prod`

**例**:
```json
{
  "projectName": "my-embedding-project"
}
```

---

### environment

**説明**: デプロイメント環境の識別子

**型**: `'dev' | 'test' | 'staging' | 'prod'`

**必須**: ✅ はい

**制約**:
- 指定された値のみ使用可能

**デフォルト値**: なし

**推奨値**:
- 開発: `dev`
- テスト: `test`
- ステージング: `staging`
- 本番: `prod`

**例**:
```json
{
  "environment": "prod"
}
```

**影響**:
- リソース命名規則
- セキュリティ設定の厳格度
- 監視・アラート設定
- コスト最適化戦略

---

### region

**説明**: AWS リージョン

**型**: `string`

**必須**: ✅ はい

**制約**:
- 有効な AWS リージョンコード

**デフォルト値**: なし

**推奨値**:
- 日本: `ap-northeast-1` (東京)
- 米国: `us-east-1` (バージニア)
- 欧州: `eu-west-1` (アイルランド)

**例**:
```json
{
  "region": "ap-northeast-1"
}
```

**注意事項**:
- Bedrock は一部リージョンでのみ利用可能
- FSx for NetApp ONTAP の可用性を確認

---

### version

**説明**: 設定ファイルのバージョン

**型**: `string`

**必須**: ❌ いいえ

**制約**:
- セマンティックバージョニング推奨

**デフォルト値**: `1.0.0`

**推奨値**: `1.0.0`

**例**:
```json
{
  "version": "1.0.0"
}
```

