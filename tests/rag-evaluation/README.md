# RAG 評価パイプライン（RAGAS）

**🌐 Language:** **日本語** | [English](../../docs/en/evaluation.md)（評価フレームワーク全体）

Bedrock Knowledge Base の回答品質を RAGAS のメトリクスで測る手元用のパイプラインです。

**デプロイ済みの KB が必要です。** CI では実行しません（`model-quality-gate.yml` の RAGAS ジョブは閾値を表示するだけで、測定はしていません）。KB ID と AWS 認証情報を持つ環境で手動実行してください。

---

## 実行

```bash
cd tests/rag-evaluation
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt

.venv/bin/python evaluate.py \
  --kb-id <KB_ID> \
  --model-id <MODEL_ID> \
  --region ap-northeast-1 \
  --output-path evaluation-results.json
```

品質ゲートとして使う場合は下限を渡します。下回ると終了コードが 0 以外になります。

```bash
.venv/bin/python evaluate.py \
  --kb-id <KB_ID> --model-id <MODEL_ID> \
  --min-faithfulness 0.7 --min-relevance 0.7 \
  --min-precision 0.6 --min-recall 0.6
```

## 引数

| 引数 | 既定値 | 内容 |
|------|--------|------|
| `--kb-id` | （必須） | Bedrock Knowledge Base の ID |
| `--model-id` | （必須） | 回答生成に使うモデル ID |
| `--region` | `ap-northeast-1` | リージョン |
| `--output-path` | `evaluation-results.json` | 結果 JSON の出力先 |
| `--max-results` | `5` | KB から取得する件数 |
| `--min-faithfulness` / `--min-relevance` / `--min-precision` / `--min-recall` | （未指定なら判定しない） | 下限。下回ると失敗として終了する |

## メトリクス

| メトリクス | 意味 | `model-quality-gate.yml` が表示する目安 |
|-----------|------|----------------------------------------|
| Faithfulness | 回答が取得した文脈に忠実か | ≥ 0.85 |
| Answer Relevancy | 回答が質問に答えているか | ≥ 0.80 |
| Context Precision | 取得した文脈のうち有用な割合 | ≥ 0.75 |
| Context Recall | 必要な文脈を取りきれているか | — |

**この目安は測定値ではありません。** 自環境での値は上のコマンドで測り、`results/` に記録してください。既存の `results/*.json` は過去の実行結果で、環境が違えば再現しません。

## 権限との関係

このパイプラインは KB の Retrieve API を直接呼ぶため、**アプリ側の SID フィルタを通りません**。権限判定の検査は `tests/permission-matrix`（31 シナリオ、`make test-python` に含む）が担当します。RAGAS の値が良いことは、権限境界が守られていることを意味しません。

## 関連ドキュメント

- [RAG / Agent 評価フレームワーク](../../docs/evaluation.md)
- [チャンキング戦略選定ガイド](../../docs/chunking-strategy-guide.md) — 戦略変更後はここで再評価する
- [証跡の区分ポリシー](../../docs/evidence-policy.md) — 測定値を書くときの条件
