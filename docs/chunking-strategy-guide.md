# チャンキング戦略選定ガイド

**🌐 Language:** **日本語** | [English](en/chunking-strategy-guide.md) | [한국어](ko/chunking-strategy-guide.md) | [简体中文](zh-CN/chunking-strategy-guide.md) | [繁體中文](zh-TW/chunking-strategy-guide.md) | [Français](fr/chunking-strategy-guide.md) | [Deutsch](de/chunking-strategy-guide.md) | [Español](es/chunking-strategy-guide.md)

**作成日**: 2026-06-07  
**ステータス**: 初版  
**対象**: RAG品質チューニング担当、データエンジニア

---

## 概要

Bedrock Knowledge Base のチャンキング戦略は、RAG の検索精度・応答品質・コストに直接影響する。本ガイドでは、FSx for ONTAP 上のドキュメント特性に応じた最適な戦略選択を支援する。

---

## 利用可能な戦略

CDKコンテキスト `kbChunkingStrategy` で設定:

```bash
npx cdk synth --quiet -c kbChunkingStrategy=FIXED_SIZE    # デフォルト
npx cdk synth --quiet -c kbChunkingStrategy=HIERARCHICAL
npx cdk synth --quiet -c kbChunkingStrategy=SEMANTIC
npx cdk synth --quiet -c kbChunkingStrategy=NONE
```

> ⚠️ **チャンキング戦略を変更した場合、DataSource の再同期（re-ingestion）が必須です。**

---

## 戦略比較マトリクス

| 戦略 | チャンクサイズ | オーバーラップ | 検索精度 | コスト | 適用シナリオ |
|------|-------------|-------------|---------|--------|------------|
| **FIXED_SIZE** | 300トークン | 10% | ⭐⭐⭐ | 💰 低 | 汎用、初期デプロイ、構造が均一な文書 |
| **HIERARCHICAL** | Parent: 1500 / Child: 300 | 60トークン | ⭐⭐⭐⭐ | 💰💰 中 | 長文レポート、階層構造文書、技術文書 |
| **SEMANTIC** | 最大300トークン | 自動（意味単位） | ⭐⭐⭐⭐⭐ | 💰💰💰 高 | 多様な文書、FAQ、対話形式、議事録 |
| **NONE** | 文書全体 | なし | ⭐⭐ | 💰 最低 | 短い文書（<300トークン）、メタデータのみ |

---

## データ特性×戦略 推奨マトリクス

| ドキュメント特性 | 推奨戦略 | 理由 |
|----------------|---------|------|
| **設計書・仕様書**（階層構造、長文） | HIERARCHICAL | 章→節→段落の階層を維持し、広いコンテキストと精密な検索を両立 |
| **契約書・法的文書**（条文単位） | SEMANTIC | 条文間の意味的境界を自動検出し、条文を分割しない |
| **FAQ・Q&A集**（短い質問-回答ペア） | SEMANTIC | 質問と回答を同一チャンクに保持 |
| **議事録・メール**（対話形式） | SEMANTIC | 話題の切り替わりで自然に分割 |
| **マニュアル・手順書**（ステップバイステップ） | HIERARCHICAL | 手順全体（Parent）と個別ステップ（Child）を階層化 |
| **財務レポート**（表・数値データ含む） | FIXED_SIZE | 表構造が複雑な場合、固定サイズが安定 |
| **短い通知・お知らせ**（<1ページ） | NONE | 文書全体が1チャンクに収まる場合、分割不要 |
| **混在コーパス**（多種多様な文書） | SEMANTIC | 文書タイプを問わず意味的に適切な分割 |

---

## 業種別推奨

| 業種 | 主要ドキュメント | 推奨戦略 | 備考 |
|------|----------------|---------|------|
| **製造** | 設計図面（テキスト部分）、品質規格、作業手順書 | HIERARCHICAL | 図面はマルチモーダルKBと併用 |
| **金融** | 規制文書、内部レポート、コンプライアンス報告 | SEMANTIC | 条文の意味的完全性を維持 |
| **公共** | 政策文書、通達、議事録 | SEMANTIC | 議事録の話題単位分割が重要 |
| **医療** | 臨床ガイドライン、手順書、研究論文 | HIERARCHICAL | 章立て構造を活用 |
| **法務** | 契約書、判例、法令 | SEMANTIC | 条文分割を避ける |
| **教育** | 教材、シラバス、研究資料 | FIXED_SIZE | 均一な構造、コスト重視 |
| **保険** | 査定基準、不正検知レポート | HIERARCHICAL | 階層的な判定基準に適合 |

---

## パフォーマンス特性

### インジェスション時間

| 戦略 | 1,000ドキュメント（推定） | 10,000ドキュメント（推定） |
|------|------------------------|--------------------------|
| FIXED_SIZE | ~5分 | ~30分 |
| HIERARCHICAL | ~8分 | ~50分 |
| SEMANTIC | ~15分 | ~90分 |
| NONE | ~3分 | ~15分 |

> SEMANTIC戦略は各チャンク境界で追加のモデル呼び出しを行うため、インジェスション時間とコストが増加する。

### 検索レイテンシ

チャンキング戦略は検索レイテンシに直接影響しない（ベクトル検索のパフォーマンスはインデックスサイズに依存）。ただし、HIERARCHICAL は Parent/Child の2段階検索を行うため、わずかに（~50ms）レイテンシが増加する可能性がある。

---

## Permission-Aware RAG との関係

**重要**: チャンキング戦略に関わらず、Permission filtering は常に**ドキュメント単位**で適用される。

> ⚠️ **検索タイプの制約**: `kbSearchType=HYBRID` を設定しても、S3 Vectors ベクトルストアでは HYBRID 検索はサポートされていません。S3 Vectors 使用時は自動的に SEMANTIC 検索にフォールバックします。HYBRID 検索を使用するには `vectorStoreType=opensearch-serverless` が必要です。

```
文書A (SID: [Admin, Engineering])
  ├── Chunk 1 → SID: [Admin, Engineering] (親文書から継承)
  ├── Chunk 2 → SID: [Admin, Engineering] (親文書から継承)
  └── Chunk 3 → SID: [Admin, Engineering] (親文書から継承)
```

- `.metadata.json` のSID情報は文書単位で付与される
- チャンクレベルのPermission差別化は不可（ドキュメント全体に同一Permission）
- 同一ドキュメント内で異なるPermissionが必要な場合、ドキュメントを分割して別ファイルにする

---

## 戦略変更手順

```bash
# 1. 現在の戦略を確認
grep kbChunkingStrategy cdk.context.json

# 2. CDKコンテキスト更新
# cdk.context.json を編集するか、コマンドラインで指定

# 3. CDK差分確認
npx cdk diff ${STACK_PREFIX}-AI -c kbChunkingStrategy=SEMANTIC

# 4. デプロイ（DataSource設定更新のみ）
npx cdk deploy ${STACK_PREFIX}-AI -c kbChunkingStrategy=SEMANTIC

# 5. DataSource再同期（必須！）
aws bedrock-agent start-ingestion-job \
  --knowledge-base-id <KB_ID> \
  --data-source-id <DS_ID> \
  --region ap-northeast-1

# 6. 再インジェスション完了を待機
aws bedrock-agent get-ingestion-job \
  --knowledge-base-id <KB_ID> \
  --data-source-id <DS_ID> \
  --ingestion-job-id <JOB_ID>

# 7. 品質評価（RAGASで比較）
cd tests/rag-evaluation
python3 evaluate.py --kb-id <KB_ID> --model-id <MODEL_ID> --region ap-northeast-1
```

---

## 評価方法

戦略変更後は必ず以下で品質を測定:

1. **RAGAS評価**: `tests/rag-evaluation/` で Faithfulness, Answer Relevancy, Context Precision を比較
2. **Permission-matrix回帰テスト**: 31シナリオで権限フィルタリングが正常か確認
3. **応答時間測定**: P50/P95/P99 レイテンシを CloudWatch で確認
4. **コスト比較**: インジェスションコスト + クエリコストの合計で比較

---

## CDK実装詳細

`lib/stacks/demo/demo-ai-stack.ts` の `buildChunkingConfiguration()` 関数:

```typescript
// FIXED_SIZE: maxTokens=300, overlapPercentage=10
// HIERARCHICAL: parent=1500, child=300, overlapTokens=60
// SEMANTIC: maxTokens=300, bufferSize=1, breakpointPercentileThreshold=95
// NONE: チャンキングなし（文書全体を1ベクトル化）
```

---

## 関連ドキュメント

- [FSx for ONTAP サイジング・性能設計](fsxn-sizing-and-performance.md)
- [RAG / Agent 評価フレームワーク](evaluation.md)
- [コスト見積もりワークシート](cost-estimation-worksheet.md)
- [Architecture Decision Records](architecture-decision-records.md)
