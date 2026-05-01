# FSx for NetApp ONTAP × Lambda / Step Functions で「楽になる理由」

## 1. 課題: FSx for ONTAP 運用の現実

FSx for NetApp ONTAP は高機能なエンタープライズストレージだが、
運用面では以下の課題がある:

| 課題 | 従来の対応 | 問題点 |
|------|-----------|--------|
| 容量監視 | 手動で CloudWatch / ONTAP CLI 確認 | 見落とし → 容量枯渇 |
| SnapMirror DR | 手動で複数ステップ実行 | 手順ミス → データ不整合 |
| ONTAP 管理操作 | SSH で ONTAP CLI 実行 | 属人化・監査証跡なし |
| AI/分析前処理 | 手動でデータ準備 | 時間がかかる・再現性なし |

## 2. この構成で解決できること

### 2.1 容量監視・自動拡張 (Lambda + EventBridge Scheduler)

```
EventBridge Scheduler (5分間隔)
  → Lambda: capacity_monitor
    → ONTAP REST API: ボリューム使用率取得
    → FSx API: ファイルシステム容量取得
    → 閾値超過 → 自動拡張 + SNS 通知
```

**楽になるポイント:**
- **見落としゼロ**: 5分間隔の自動監視で容量枯渇を防止
- **自動拡張**: 閾値超過時に自動でボリューム/FS を拡張
- **通知**: SNS 経由でメール/Slack に即座に通知
- **ドライラン**: 本番適用前にドライランで影響確認可能

### 2.2 SnapMirror フェイルオーバー自動化 (Step Functions)

```
Step Functions: snapmirror-failover
  → Step 1: SnapMirror 関係の検出
  → Step 2: 最終転送の実行
  → Step 3: 転送完了の待機 (ポーリング)
  → Step 4: SnapMirror ブレーク
  → Step 5: CIFS/NFS 共有の再作成
  → Step 6: 状態検証
  → 通知
```

**楽になるポイント:**
- **手順ミス防止**: 複雑な DR 手順を ASL で定義し、確実に実行
- **並列処理**: Map ステートで複数の SnapMirror 関係を並列処理
- **自動リトライ**: Lambda エラー時の自動リトライ
- **監査証跡**: Step Functions の実行履歴が自動記録
- **ワンクリック DR**: API 呼び出し一つでフェイルオーバー完了

### 2.3 ONTAP 管理 API 実行 (Lambda)

```
API Gateway / Step Functions / 手動
  → Lambda: ontap_api_executor
    → ONTAP REST API: 任意の操作を実行
    → セキュリティ制御 (メソッド制限・パスブロック)
```

**楽になるポイント:**
- **SSH 不要**: ONTAP CLI に SSH する必要がない
- **セキュリティ**: IAM + Secrets Manager で認証管理
- **監査**: CloudWatch Logs に全操作が記録
- **API 化**: 他のシステムから REST API として呼び出し可能

### 2.4 AI/分析向けデータ前処理 (Lambda + Step Functions)

```
EventBridge / アプリ
  → Lambda: data_preprocessor
    → S3 Access Point: ソースデータ一覧取得
    → ONTAP REST API: メタデータ (ACL等) 収集
    → タスク生成 → Step Functions Map で並列処理
    → S3: 処理結果出力
```

**楽になるポイント:**
- **NFS マウント不要**: S3 Access Point を "境界" として使用
- **権限ベース**: ONTAP の ACL 情報を活用した権限ベース RAG
- **スケーラブル**: Step Functions Map で並列処理
- **再現性**: マニフェストファイルで処理内容を記録

## 3. アーキテクチャ上の設計判断

### 3.1 なぜイベント駆動ではないのか

| 観点 | イベント駆動 | 定期実行 (本構成) |
|------|------------|------------------|
| S3 Event Notification | 必要 | **不要** |
| FSx 側の設定 | FPolicy 等が必要 | **不要** |
| 常駐プロセス | 必要な場合あり | **不要** |
| 実装の複雑さ | 高い | **低い** |
| コスト予測 | 変動大 | **予測可能** |
| 障害時の影響 | イベント欠損リスク | **次回実行で検出** |

FSx for ONTAP の運用自動化において、イベント駆動は過剰な場合が多い。
5分間隔の定期実行で十分な即時性を確保しつつ、実装をシンプルに保てる。

### 3.2 なぜ Lambda から NFS マウントしないのか

| 観点 | NFS マウント | REST API (本構成) |
|------|------------|------------------|
| VPC 設定 | ENI + サブネット必須 | **管理 LIF への HTTPS のみ** |
| コールドスタート | 遅い (VPC + マウント) | **速い** |
| 同時実行 | NFS 接続数制限 | **制限なし** |
| セキュリティ | NFS エクスポート管理 | **Secrets Manager** |
| 操作範囲 | ファイル I/O のみ | **全 ONTAP 管理操作** |

ONTAP REST API を使うことで、ファイル操作だけでなく
SnapMirror、CIFS 共有、NFS エクスポート、スナップショットなど
すべての管理操作を Lambda から実行できる。

### 3.3 S3 Access Point の役割

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│   Lambda     │────▶│  S3 Access Point │────▶│  FSx ONTAP  │
│ (前処理)     │     │  (境界・制御点)   │     │  (データ)    │
└─────────────┘     └──────────────────┘     └─────────────┘
                           │
                    ┌──────┴──────┐
                    │ IAM ポリシー │
                    │ VPC 制限     │
                    │ アクセス制御  │
                    └─────────────┘
```

S3 Access Point は Lambda とデータの間の「境界」として機能する:
- **IAM ポリシー**: Lambda ロールに対するアクセス制御
- **VPC 制限**: VPC 内からのみアクセス可能
- **プレフィックス制限**: 特定のプレフィックスのみアクセス許可

## 4. コスト見積もり

| コンポーネント | 月額見積もり | 備考 |
|--------------|------------|------|
| Lambda (容量監視) | ~$0.50 | 5分間隔 × 30日 |
| Lambda (SnapMirror) | ~$0.10 | 月10回実行想定 |
| Lambda (API Executor) | ~$0.05 | オンデマンド |
| Lambda (前処理) | ~$1.00 | 日次実行想定 |
| Step Functions | ~$0.05 | 月10回実行想定 |
| EventBridge Scheduler | ~$0.00 | 無料枠内 |
| Secrets Manager | ~$0.40 | 1シークレット |
| SNS | ~$0.00 | メール通知 |
| CloudWatch Logs | ~$0.50 | ログ保存 |
| **合計** | **~$2.60/月** | |

## 5. セキュリティ設計

### 認証情報管理
- ONTAP 管理者パスワードは **Secrets Manager** に保存
- Lambda は IAM ロール経由で Secrets Manager にアクセス
- パスワードのローテーションは Secrets Manager の自動ローテーション機能を利用

### ネットワーク
- Lambda は **VPC 内** に配置し、管理 LIF に HTTPS でアクセス
- S3 Access Point は **VPC エンドポイント** 経由でアクセス
- インターネットアクセスは不要 (VPC エンドポイント使用)
- **必要な VPC エンドポイント (5 種)**:
  - Interface: `secretsmanager`, `fsx`, `monitoring`, `sns`
  - Gateway: `s3` (Lambda サブネットのルートテーブルに関連付け必要)

### 監査
- すべての Lambda 実行は **CloudWatch Logs** に記録
- Step Functions の実行履歴は **自動保存**
- ONTAP API Executor は操作ログを詳細に記録

### アクセス制御
- ONTAP API Executor は **メソッド制限** (GET のみ等) を設定可能
- **危険な API パス** (セキュリティアカウント操作等) はブロック
- IAM ロールは **最小権限** で設計

## 6. 運用フロー

### 日常運用 (自動)
```
毎5分: 容量監視 → 閾値超過時に自動拡張 + 通知
毎朝9時: 日次レポート → 管理者にメール送信
```

### DR 訓練 / 実行 (手動トリガー)
```
1. AWS Console or CLI で Step Functions を実行
2. パラメータ入力:
   - prod_management_lif: 本番管理 LIF
   - dr_management_lif: DR 管理 LIF
   - prod_svm: 本番 SVM 名
   - dr_svm: DR SVM 名
3. Step Functions が自動でフェイルオーバーを実行
4. 完了通知を受信
```

### ONTAP 管理操作 (オンデマンド)
```
1. API Gateway or Lambda 直接呼び出し
2. ONTAP REST API パスとメソッドを指定
3. 結果を JSON で受信
```

## 7. まとめ: なぜこの構成が「楽」なのか

| Before | After |
|--------|-------|
| 手動で容量確認 → 忘れて枯渇 | **自動監視 + 自動拡張** |
| DR 手順書を見ながら手動実行 | **ワンクリック DR** |
| SSH で ONTAP CLI 実行 | **REST API 経由で安全に実行** |
| データ準備に半日 | **自動前処理パイプライン** |
| 属人化した運用 | **コード化された運用** |
| 監査証跡なし | **全操作が自動記録** |

**核心**: FSx for ONTAP の運用を「人が覚えて手で実行する」から
「コードが定義して自動で実行する」に変える。
これにより、運用の信頼性・再現性・監査性が大幅に向上する。
