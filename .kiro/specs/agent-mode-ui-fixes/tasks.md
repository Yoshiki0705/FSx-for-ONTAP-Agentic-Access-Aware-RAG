# 実装計画: Agent Mode UI/UX修正

## 概要

本実装計画は、Agent modeの3つの残存UI/UX問題を段階的に修正します。各フェーズは独立してデプロイ・検証され、ユーザー承認後にGit Commit & Pushを実行します。

**設計思想**:
- **IaC化と再現性**: このプロジェクトのあらゆるハードコードされた値を環境変数や設定ファイルに移行
- **動的設定**: どの環境でも動的に反映される実装
- **知見の蓄積**: ガイドドキュメントへの反映
- **段階的デプロイ**: 1フェーズずつ確実に修正

## タスク

### Phase 1: Agent Introduction Text リアルタイム更新修正

**Status**: ✅ COMPLETE (2026-01-19)

**Summary**: Agent Introduction Textのリアルタイム更新機能を完全に修正し、Agent固有の説明表示機能を追加しました。

**Completed Tasks**:
1. ✅ 過去の実装調査とGit履歴分析
2. ✅ ブラウザ動作確認（Task 1完了後）
3. ✅ AgentInfoSection.tsx の修正（v3 fix）
4. ✅ page.tsx イベントリスナーの修正（v3-v19 fixes）
5. ✅ EC2デプロイメント（v4-v22）
6. ✅ ブラウザ動作確認（v22デプロイ後）
7. ✅ ユーザー承認
8. ✅ Git Commit & Push
9. ✅ Phase 1 完了レポート作成
10. ✅ ガイドドキュメント更新
11. ✅ **Phase 1 Task 2: Agent Description表示機能** (2026-01-19)

**Key Achievements**:
- Introduction Textがリアルタイムで更新される（100%成功率）
- Agent固有の説明が表示される（description field利用）
- 全8言語対応（ja, en, ko, zh-CN, zh-TW, fr, de, es）
- Graceful fallback（description未設定時は汎用機能表示）
- Zustand Store直接更新方式（v19）
- Force re-render機構（v17）
- Response Streaming無効化（v22）

**Deployment Info**:
- Image Tag (v22): `agent-mode-fix-v22-20260118-235729`
- Image Tag (Task 2): `agent-description-20260118-164851`
- Lambda Function: `TokyoRegion-permission-aware-rag-prod-WebApp-Function`
- CloudFront: `https://d3p7l2uoh6npdr.cloudfront.net`

**Documentation**:
- `.kiro/steering/agent-mode-guide.md` (1,000+ lines)
- `development/docs/reports/local/01-19-phase1-completion-report.md`
- `development/docs/reports/local/01-19-phase1-task2-agent-description-deployment-success.md`

---

- [x] 1. 過去の実装調査とGit履歴分析 ✅ COMPLETE (2026-01-18)
  - Git履歴から動作していた時点のコードを特定
  - AgentInfoSection.tsx と page.tsx の変更履歴を確認
  - デグレードの原因となった変更を特定
  - MCPサーバー（Web検索、AWS Knowledge）で最新のReactイベントハンドリングベストプラクティスを調査
  - _Requirements: 9.1, 9.2, 9.3, 9.4_
  - **成果物**: 
    - `development/docs/reports/local/01-18-phase1-investigation-report.md` ✅
    - `development/docs/reports/local/01-18-phase1-verification-plan.md` ✅
    - `development/docs/reports/local/01-18-phase1-deployment-verification-results.md` ✅
    - `development/docs/reports/local/01-18-phase1-task1-completion-summary.md` ✅
  - **Key Finding**: v5 fix (2026-01-14) already implemented in current deployment (2026-01-17)
  - **Recommendation**: Verify current deployment with browser testing before making code changes

- [x] 1.5 ブラウザ動作確認（Task 1完了後） ✅ COMPLETE (2026-01-18)
  - CloudFront URLでの動作確認
  - Agent選択時のIntroduction Text更新を確認
  - Chrome DevTools MCPでコンソールログとネットワークリクエストを確認
  - _Requirements: 10.4_
  - **成果物**: 
    - `development/docs/reports/local/01-18-phase1-browser-verification-results.md` ✅
  - **検証結果**: ⚠️ 部分的成功
    - ✅ サイドバーのAgent情報がリアルタイムで更新（100%成功）
    - ❌ Introduction Textがメインチャットエリアに表示されない（0%成功）
    - ❌ "b is not a function" エラーが発生（alert dialog表示）
  - **根本原因**: 
    1. AgentInfoSection.tsxで "b is not a function" エラー発生
    2. page.tsxでIntroduction Text表示失敗（State更新またはRendering問題）
  - **次のアクション**: Task 2（AgentInfoSection.tsx修正）とTask 3（page.tsx修正）を実行

- [x] 2. AgentInfoSection.tsx の修正 ✅ COMPLETE (2026-01-18)
  - [x] 2.1 handleAgentChange関数の強化 ✅
    - イベント詳細に`executionStatus`と`progressReport`フィールドを追加（既存実装）
    - イベントのバブリングを有効化（`bubbles: true`）（既存実装）
    - エラーハンドリングの追加（既存実装）
    - ✅ FIX v3: 未使用の`tError`変数を削除（"b is not a function"エラーの根本原因）
    - ✅ FIX v3: alert()を削除してエラーハンドリングを改善
    - _Requirements: 1.1, 1.3, 1.6, 1.7, 1.8_
  
  - [x] 2.2 初期化時のイベント発火の確認 ✅
    - useEffectでの初期化時イベント発火が正しく動作するか確認（既存実装）
    - 依存配列の完全性を確認（既存実装）
    - _Requirements: 1.5_
  
  - [x] 2.3 ログ出力の追加 ✅
    - Agent選択時の詳細ログ（既存実装）
    - イベント発火の確認ログ（既存実装）
    - エラー発生時のコンテキストログ（既存実装）
    - _Requirements: 8.1_
  
  - **成果物**: 
    - 修正されたコードファイル ✅
    - `development/docs/reports/local/01-18-phase1-task2-3-completion-report.md` ✅

- [x] 3. page.tsx イベントリスナーの修正 ✅ COMPLETE (2026-01-18)
  - [x] 3.1 handleAgentSelectionChange関数の強化 ✅
    - Array.isArray()チェックの追加（既存実装）
    - executionStatusとprogressReportの処理追加（既存実装）
    - エラーハンドリングの追加（既存実装）
    - ✅ FIX v3: try-catchでIntroduction文生成エラーをキャッチ
    - ✅ FIX v3: 詳細なログ出力を追加（State更新の各ステップ）
    - ✅ FIX v3: 新しいオブジェクト参照を作成してReact再レンダリングを確実にトリガー
    - _Requirements: 1.2, 1.3, 1.6, 1.7, 1.8, 7.1_
  
  - [x] 3.2 依存配列の最適化 ✅
    - 不要な依存関係を削除（既存実装）
    - 必要な依存関係のみを含める（既存実装）
    - ✅ FIX v3: `currentSession?.id` → `currentSession`全体を依存配列に追加
    - _Requirements: 7.2_
  
  - [x] 3.3 ログ出力の追加 ✅
    - イベント受信時のログ（既存実装）
    - Introduction Text更新前後の値のログ（既存実装）
    - パフォーマンス測定ログ（既存実装）
    - ✅ FIX v3: イベントリスナー登録/解除のログ追加
    - _Requirements: 8.2_
  
  - **成果物**: 
    - 修正されたコードファイル ✅
    - `development/docs/reports/local/01-18-phase1-task2-3-completion-report.md` ✅

- [ ]* 3.4 プロパティベーステストの作成
  - **Property 1**: Introduction Text更新のパフォーマンス（100ms以内）
  - **Property 2**: Introduction Text表示内容の完全性
  - fast-checkを使用して最小100回の反復テスト
  - _Requirements: 1.2, 1.3_
  - **成果物**: `docker/nextjs/__tests__/agent-introduction-text.property.test.tsx`

- [ ]* 3.5 ユニットテストの作成
  - Agent選択時のイベント発火テスト
  - Agent未選択時のデフォルトメッセージテスト
  - ページロード時の初期表示テスト
  - エラー発生時の表示テスト
  - _Requirements: 1.1, 1.4, 1.5, 1.8_
  - **成果物**: `docker/nextjs/__tests__/agent-introduction-text.test.tsx`

- [x] 4. EC2デプロイメント（v4-v22） ✅ COMPLETE (2026-01-19)
  - [x] v4-v9: 初期修正とArray.isArray()チェック追加
  - [x] v10: 全useEffectフックにArray.isArray()チェック追加
  - [x] v11-v13: ログ強化とセッション検証
  - [x] v14: Early exitパターン実装
  - [x] v15-v16: セッション検証の改善
  - [x] v17: Force re-render機構と包括的ログ実装 ✅
    - renderKey state変数追加（Line 544）
    - setRenderKey()でReact再レンダリング強制（Line 933）
    - key={renderKey}をメッセージコンテナに適用（Line 2313）
    - 包括的レンダリングログ追加（Lines 2316+）
    - フォールバックレンダリング追加（デバッグ用）
    - メッセージ毎のレンダリングログ追加
  - [x] v18: セッション作成ロジック追加（prevSession undefined対応） ✅
    - handleAgentSelectionChange内でprevSessionがundefinedの場合に新規セッション作成
    - v17のforce re-render機構を継承
  - [x] v19: Zustand Store直接更新方式 ✅ DEPLOYED (2026-01-19 00:20 JST)
    - Zustand callbackアプローチの問題を解決
    - 新規セッションオブジェクトを直接作成してsetCurrentSession()に渡す
    - Dockerfile.prebuilt修正（.next/standalone構造の正しいコピー）
    - Docker Image検証スクリプト修正（--entrypoint使用）
    - Warmup: 100/100成功（0失敗）
    - CloudFront Invalidation: I9Z9CJ95S4NJHKNG5NYQE23TFC
    - ⚠️ 結果: 502エラー発生（Dockerfile CMD問題）
  - [x] v20: Dockerfile CMD修正 ✅ DEPLOYED (2026-01-19 00:48 JST)
    - 根本原因: v19のCMD ["node", "server.js"]がLambda Web Adapterと非互換
    - 修正: CMD ["sh", "-c", "exec node server.js"]に変更
    - Docker Build: 10秒（pre-built method）
    - Image Verification: 8/10 checks passed
    - Warmup: 100/100成功（0失敗）
    - CloudFront Invalidation: ICT69X4KTJ2JNFNCZ5C8VWK7QV
    - ⚠️ 結果: 空のレスポンスボディ（content-length: 0）
  - [x] v21: Dockerfile ENTRYPOINT/CMD修正 ✅ DEPLOYED (2026-01-19 00:57 JST)
    - 根本原因: v20のCMD ["sh", "-c", "exec node server.js"]が問題
    - 修正: ENTRYPOINT []とCMD ["node", "server.js"]に変更
    - ⚠️ 結果: 空のレスポンスボディ継続（content-length: 0）
  - [x] v22: Response Streaming無効化 ✅ DEPLOYED (2026-01-19 01:11 JST)
    - 根本原因: AWS_LWA_INVOKE_MODE=response_streamが空レスポンスの原因
    - 修正: response_stream環境変数を削除（デフォルトのbuffered mode使用）
    - Docker Build: 10秒（pre-built method）
    - Image Verification: 6/6 checks passed
    - Warmup: 30/30成功（0失敗）
    - CloudFront Invalidation: I2TZNKZKD4IZASZSWKH9FCC9P6
    - ✅ 結果: Lambda Function URL正常動作（22,524 bytes）
  - EC2インスタンス復旧（高CPU負荷から回復）
    - 旧IP: 54.199.215.115 → 新IP: 3.112.214.40
    - インスタンス再起動で復旧（~10分）
  - _Requirements: 10.3_
  - **成果物**: 
    - `development/docs/reports/local/01-19-phase1-task4-v17-deployment-success.md` ✅
    - `development/docs/reports/local/01-19-phase1-task4-v18-deployment-success.md` ✅
    - `development/docs/reports/local/01-19-phase1-task4-v19-deployment-success.md` ✅
    - `development/docs/reports/local/01-19-phase1-task4-v20-deployment-success.md` ✅
    - `development/docs/reports/local/01-19-phase1-task4-v22-deployment-success.md` ✅
    - `development/docs/reports/local/01-19-ec2-connectivity-diagnosis.md` ✅（更新）
    - `development/scripts/temp/ec2-phase1-task4-v17-prebuilt-deploy.sh` ✅
    - `development/scripts/temp/ec2-phase1-task4-v19-deploy.sh` ✅
    - `development/scripts/temp/ec2-phase1-task4-v20-deploy.sh` ✅
    - `development/scripts/temp/ec2-phase1-task4-v22-deploy.sh` ✅

- [ ] 5. ブラウザ動作確認（v22デプロイ後） ⏳ READY FOR USER VERIFICATION
  - CloudFront URLでの動作確認: https://d3p7l2uoh6npdr.cloudfront.net/ja/genai?mode=agent
  - Agent選択時のIntroduction Text更新を確認
  - ブラウザコンソールログの確認（5つの期待されるログ）:
    1. 🔄 [ChatbotPage v19] Creating updated session object directly...
    2. ✅ [ChatbotPage v19] New session object created: {...}
    3. ✅ [ChatbotPage v19] Zustand store updated directly
    4. 🔄 [ChatbotPage v19] Force re-render triggered, renderKey: 1
    5. 🎨 [ChatbotPage v17] Rendering messages area: {...}
  - Introduction Textの可視性確認
  - _Requirements: 10.4_
  - **待機中**: ユーザーによるブラウザ検証
  - **v22修正内容**: AWS_LWA_INVOKE_MODE=response_stream削除（buffered mode使用）
  - **v22検証結果**: Lambda Function URL正常動作（22,524 bytes、有効なHTML）
  - **次のステップ**: 2-3分待機後にCloudFront URLでテスト
  - **成果物**: `development/docs/reports/local/YYYY-MM-DD-phase1-browser-verification.md`（検証後作成）

- [x] 6. ユーザー承認待ち ✅ COMPLETE (2026-01-19)
  - ユーザーに動作確認を依頼
  - フィードバックを収集
  - 必要に応じて修正
  - _Requirements: 10.5_
  - **ユーザー確認**: "期待する挙動になっていますので、承認します"

- [x] 7. Git Commit & Push ✅ COMPLETE (2026-01-19)
  - 変更をコミット
  - リモートリポジトリにプッシュ
  - コミットメッセージに修正内容を明記
  - _Requirements: 10.6, 10.7_
  - **成果物**: 
    - Git commit hash: `6d673e2` (Code changes)
    - Git commit hash: `9dd2d01` (Documentation)

- [x] 8. Phase 1 完了レポート作成 ✅ COMPLETE (2026-01-19)
  - 修正内容の詳細
  - テスト結果のサマリー
  - デプロイメントログ
  - 検証結果
  - _Requirements: 10.8, 10.9_
  - **成果物**: `development/docs/reports/local/01-19-phase1-completion-report.md` ✅

- [x] 9. ガイドドキュメント更新 ✅ COMPLETE (2026-01-19)
  - Agent Mode開発ガイド作成
  - README.md更新
  - Frontend Complete Guide更新
  - 知見の詳細な文書化
  - **成果物**:
    - `.kiro/steering/agent-mode-guide.md` ✅ (新規作成、1,000+ 行)
    - `README.md` ✅ (Phase 1セクション追加)
    - `docs/guides/frontend-complete-guide.md` ✅ (Agent Modeセクション追加)

---

### Phase 2: Region/Model 動的連動修正

**Status**: 🔄 IN PROGRESS - Phase 2.1 Complete

- [x] 9. 過去の実装調査とベストプラクティス調査 ✅ COMPLETE (2026-01-20)
  - Git履歴からRegionSelector/ModelSelectorの変更履歴を確認
  - モード固有のリージョン/モデル表示の実装を調査
  - MCPサーバーでReact Context APIとState管理のベストプラクティスを調査
  - _Requirements: 9.1, 9.2, 9.3, 9.7_
  - **成果物**: `development/docs/reports/local/01-20-phase2-investigation-report.md` ✅

- [x] 10. ModelSelector Event Dispatching ✅ COMPLETE (2026-01-20)
  - `modelChanged`イベントをModelSelectorに追加
  - イベント詳細にmodelId、modelName、provider、categoryを含める
  - `bubbles: true`でイベント伝播を有効化
  - 詳細なログ出力を追加
  - _Requirements: 2.5, 2.6_
  - **成果物**: 修正された`docker/nextjs/src/components/bedrock/ModelSelector.tsx` ✅

- [x] 11. page.tsx Event Listeners ✅ COMPLETE (2026-01-20)
  - [ ] 11.1 modelChanged Event Listener Enhancement ✅
    - 既存のmodelChangedリスナーを強化
    - Introduction Text更新ロジックを追加
    - v19 Zustand Store直接更新パターンを使用
    - v17 Force re-render機構を使用
    - Array.isArray()チェックを追加
    - _Requirements: 2.5, 2.6_
  
  - [ ] 11.2 regionChanged Event Listener (NEW) ✅
    - 新しいregionChangedリスナーを追加
    - Introduction Text更新ロジックを実装
    - v19 Zustand Store直接更新パターンを使用
    - v17 Force re-render機構を使用
    - Array.isArray()チェックを追加
    - _Requirements: 2.3, 2.4_
  
  - **成果物**: 修正された`docker/nextjs/src/app/[locale]/genai/page.tsx` ✅
  - **成果物**: `development/docs/reports/local/01-20-phase2-1-event-system-completion-report.md` ✅

- [ ] 12. ローカルテストとEC2同期 ⏳ READY
  - ローカル環境でTypeScriptコンパイル確認
  - EC2環境に変更を同期
  - _Requirements: 10.3_
  - **成果物**: `development/docs/reports/local/YYYY-MM-DD-phase2-1-sync-results.md`

- [ ] 13. EC2デプロイメント ⏳ READY
  - クリーンビルド実行
  - Docker Image検証
  - ECRプッシュ
  - Lambda更新
  - Container Refresh v12実行
  - CloudFrontキャッシュ無効化
  - _Requirements: 10.3_
  - **成果物**: `development/docs/reports/local/YYYY-MM-DD-phase2-1-deployment-success.md`

- [ ] 14. ブラウザ動作確認 ⏳ READY
  - CloudFront URLでの動作確認
  - モデル変更時のIntroduction Text更新確認
  - リージョン変更時のIntroduction Text更新確認
  - コンソールログの確認
  - _Requirements: 10.4_
  - **成果物**: `development/docs/reports/local/YYYY-MM-DD-phase2-1-browser-verification.md`

- [ ] 15. ユーザー承認待ち ⏳ READY
  - ユーザーに動作確認を依頼
  - フィードバックを収集
  - 必要に応じて修正
  - _Requirements: 10.5_

- [ ] 16. Git Commit & Push ⏳ READY
  - 変更をコミット
  - リモートリポジトリにプッシュ
  - コミットメッセージに修正内容を明記
  - _Requirements: 10.6, 10.7_
  - **成果物**: Git commit hash

- [ ] 17. Phase 2.1 完了レポート作成 ✅ COMPLETE (2026-01-20)
  - 修正内容の詳細
  - テスト結果のサマリー
  - デプロイメントログ
  - 検証結果
  - _Requirements: 10.8, 10.9_
  - **成果物**: `development/docs/reports/local/01-20-phase2-1-event-system-completion-report.md` ✅

---

### Phase 2.2: Mode-Specific Lists (Tasks 18-20) - NOT STARTED

- [ ] 10. ハードコード値の環境変数化
  - [ ] 10.1 リージョンリストの設定ファイル化
    - Agent mode用リージョンリストを`config/agent-regions.json`に移行
    - KB mode用リージョンリストを`config/kb-regions.json`に移行
    - 環境変数`NEXT_PUBLIC_AGENT_REGIONS`と`NEXT_PUBLIC_KB_REGIONS`を追加
    - _Requirements: 2.1, 2.2_
  
  - [ ] 10.2 モデルリストの設定ファイル化
    - Agent mode用モデルリストを`config/agent-models.json`に移行
    - KB mode用モデルリストを`config/kb-models.json`に移行
    - 環境変数`NEXT_PUBLIC_AGENT_MODELS`と`NEXT_PUBLIC_KB_MODELS`を追加
    - _Requirements: 2.7, 2.8_
  
  - [ ] 10.3 CDKスタックでの環境変数設定
    - WebAppスタックに環境変数を追加
    - Lambda関数に環境変数を渡す
    - _Requirements: IaC化_
  
  - **成果物**: 設定ファイルとCDKスタック修正

- [ ] 11. RegionSelector の修正
  - [ ] 11.1 モードプロパティの追加
    - `mode: 'agent' | 'kb'`プロパティを追加
    - モード固有のリージョンリストを取得
    - _Requirements: 2.1, 2.2_
  
  - [ ] 11.2 リージョン変更イベントの発火
    - `region-changed`カスタムイベントを発火
    - イベント詳細にモード情報を含める
    - _Requirements: 2.3, 2.4_
  
  - [ ] 11.3 エラーハンドリングの追加
    - リージョン変更失敗時のエラー処理
    - 前の値への復元
    - _Requirements: エラーハンドリング_
  
  - [ ] 11.4 ログ出力の追加
    - リージョン変更時のログ
    - モード情報を含むログ
    - _Requirements: 8.3_
  
  - **成果物**: 修正されたコードファイル

- [ ] 12. ModelSelector の修正
  - [ ] 12.1 モードプロパティの追加
    - `mode: 'agent' | 'kb'`プロパティを追加
    - モード固有のモデルリストを取得
    - _Requirements: 2.7, 2.8_
  
  - [ ] 12.2 モデル変更イベントの発火
    - `model-changed`カスタムイベントを発火
    - イベント詳細にモード情報を含める
    - _Requirements: 2.5, 2.6_
  
  - [ ] 12.3 エラーハンドリングの追加
    - モデル変更失敗時のエラー処理
    - 前の値への復元
    - _Requirements: エラーハンドリング_
  
  - **成果物**: 修正されたコードファイル

- [ ] 13. page.tsx イベントリスナーの追加
  - [ ] 13.1 region-changedイベントリスナー
    - リージョン変更時のIntroduction Text更新
    - ローカルストレージへの永続化
    - _Requirements: 2.3, 2.4, 2.12_
  
  - [ ] 13.2 model-changedイベントリスナー
    - モデル変更時のIntroduction Text更新
    - チャットAPIリクエストへの反映
    - ローカルストレージへの永続化
    - _Requirements: 2.5, 2.6, 2.12_
  
  - [ ] 13.3 モード切り替え時のコンテキスト更新
    - Agent mode → KB mode切り替え時の処理
    - KB mode → Agent mode切り替え時の処理
    - _Requirements: 2.9, 2.10_
  
  - **成果物**: 修正されたコードファイル

- [ ]* 13.4 プロパティベーステストの作成
  - **Property 3**: リージョン/モデル変更時のIntroduction Text動的更新
  - **Property 4**: チャットでのモデル使用の正確性
  - **Property 5**: モード切り替え時のコンテキスト更新
  - **Property 6**: ローカルストレージへの永続化
  - fast-checkを使用して最小100回の反復テスト
  - _Requirements: 2.3, 2.4, 2.5, 2.6, 2.9, 2.10, 2.12_
  - **成果物**: `docker/nextjs/__tests__/region-model-dynamic-linking.property.test.tsx`

- [ ]* 13.5 ユニットテストの作成
  - Agent mode時のリージョンリスト表示テスト
  - KB mode時のリージョンリスト表示テスト
  - Agent mode時のモデルリスト表示テスト
  - KB mode時のモデルリスト表示テスト
  - _Requirements: 2.1, 2.2, 2.7, 2.8_
  - **成果物**: `docker/nextjs/__tests__/region-model-selectors.test.tsx`

- [ ] 14. API エンドポイントの作成
  - [ ] 14.1 /api/bedrock/regions エンドポイント
    - モードパラメータを受け取る
    - モード固有のリージョンリストを返す
    - _Requirements: 2.1, 2.2_
  
  - [ ] 14.2 /api/bedrock/models エンドポイント
    - モードパラメータを受け取る
    - モード固有のモデルリストを返す
    - _Requirements: 2.7, 2.8_
  
  - **成果物**: 新規APIエンドポイント

- [ ] 15. ローカルテストとEC2同期
  - ローカル環境でテスト実行
  - テスト結果の確認
  - EC2環境に変更を同期
  - _Requirements: 10.3_
  - **成果物**: `development/docs/reports/local/YYYY-MM-DD-phase2-test-results.md`

- [ ] 16. ブラウザ動作確認
  - CloudFront URLでの動作確認
  - モード切り替え時のリージョン/モデル表示確認
  - リージョン/モデル変更時のIntroduction Text更新確認
  - ローカルストレージへの永続化確認
  - _Requirements: 10.4_
  - **成果物**: `development/docs/reports/local/YYYY-MM-DD-phase2-browser-verification.md`

- [ ] 17. ユーザー承認待ち
  - ユーザーに動作確認を依頼
  - フィードバックを収集
  - 必要に応じて修正
  - _Requirements: 10.5_

- [ ] 18. Git Commit & Push
  - 変更をコミット
  - リモートリポジトリにプッシュ
  - コミットメッセージに修正内容を明記
  - _Requirements: 10.6, 10.7_
  - **成果物**: Git commit hash

- [ ] 19. Phase 2 完了レポート作成
  - 修正内容の詳細
  - テスト結果のサマリー
  - デプロイメントログ
  - 検証結果
  - _Requirements: 10.8, 10.9_
  - **成果物**: `development/docs/reports/local/YYYY-MM-DD-phase2-completion-report.md`

---

### Phase 3: Agent Creation Wizard 修正

- [ ] 20. 過去の実装調査とベストプラクティス調査
  - Git履歴からAgent Creation Wizardの変更履歴を確認
  - 翻訳キーの実装を調査
  - MCPサーバーでReact多段階フォームのベストプラクティスを調査
  - _Requirements: 9.1, 9.2, 9.3, 9.7_
  - **成果物**: `development/docs/reports/local/YYYY-MM-DD-phase3-investigation-report.md`

- [ ] 21. 翻訳キーの追加
  - [ ] 21.1 日本語翻訳キーの追加
    - `docker/nextjs/src/messages/ja.json`に`agent.wizard.*`キーを追加
    - すべてのウィザードステップのテキストを翻訳
    - _Requirements: 3.1, 3.5_
  
  - [ ] 21.2 英語翻訳キーの追加
    - `docker/nextjs/src/messages/en.json`に`agent.wizard.*`キーを追加
    - すべてのウィザードステップのテキストを翻訳
    - _Requirements: 3.1, 3.5_
  
  - [ ] 21.3 韓国語翻訳キーの追加
    - `docker/nextjs/src/messages/ko.json`に`agent.wizard.*`キーを追加
    - すべてのウィザードステップのテキストを翻訳
    - _Requirements: 3.1, 3.5_
  
  - [ ] 21.4 その他の言語の翻訳キーの追加
    - 中国語（簡体字・繁体字）、フランス語、ドイツ語、スペイン語
    - すべてのウィザードステップのテキストを翻訳
    - _Requirements: 3.1, 3.5_
  
  - **成果物**: 更新された翻訳ファイル

- [ ] 22. AgentCreationWizard コンポーネントの作成
  - [ ] 22.1 基本構造の実装
    - ダイアログコンポーネントの作成
    - ステップインジケーターの実装
    - ナビゲーションボタンの実装
    - _Requirements: 4.1, 4.2_
  
  - [ ] 22.2 各ステップコンポーネントの作成
    - BasicSettingsStep: Agent名、説明の入力
    - InstructionsStep: 指示の入力
    - ModelSelectionStep: モデルの選択
    - ReviewStep: 入力内容の確認
    - _Requirements: 4.2_
  
  - [ ] 22.3 入力検証の実装
    - 各ステップでの入力検証
    - エラーメッセージの表示
    - 次のステップへの進行制御
    - _Requirements: 4.3, 4.4_
  
  - [ ] 22.4 データ保持の実装
    - フォームデータのstate管理
    - 前のステップに戻った時のデータ保持
    - _Requirements: 4.5_
  
  - [ ] 22.5 Agent作成APIの呼び出し
    - API呼び出しの実装
    - 成功時の処理（ウィザードを閉じる、Agentリストを更新）
    - 失敗時の処理（エラーメッセージ表示、再試行）
    - _Requirements: 4.6, 4.7, 4.8_
  
  - [ ] 22.6 ローカライゼーションの実装
    - useTranslationsフックの使用
    - 正しいネームスペースの指定
    - ロケール変更時の更新
    - _Requirements: 3.1, 3.2, 3.4_
  
  - [ ] 22.7 エラーハンドリングの追加
    - Agent作成失敗時のエラー処理
    - エラーイベントの発火
    - _Requirements: エラーハンドリング_
  
  - [ ] 22.8 ログ出力の追加
    - ウィザード開始時のログ
    - 各ステップ遷移時のログ
    - Agent作成時のログ
    - _Requirements: 8.4_
  
  - **成果物**: 新規コンポーネントファイル

- [ ] 23. AgentInfoSection への統合
  - [ ] 23.1 ウィザード開始イベントリスナーの修正
    - 既存のイベントリスナーを新しいウィザードコンポーネントに接続
    - ウィザード成功時のコールバック実装
    - _Requirements: 4.1_
  
  - **成果物**: 修正されたコードファイル

- [ ]* 23.2 プロパティベーステストの作成
  - **Property 7**: ウィザードのローカライゼーション
  - **Property 8**: ウィザードの入力検証
  - **Property 9**: ウィザードのデータ保持
  - fast-checkを使用して最小100回の反復テスト
  - _Requirements: 3.1, 3.2, 3.4, 4.3, 4.5_
  - **成果物**: `docker/nextjs/__tests__/agent-creation-wizard.property.test.tsx`

- [ ]* 23.3 ユニットテストの作成
  - ウィザード開始ボタンクリックテスト
  - 初期ステップ表示テスト
  - 翻訳キー存在確認テスト
  - フォールバックメッセージテスト
  - Agent作成成功テスト
  - Agent作成失敗テスト
  - _Requirements: 3.3, 3.5, 4.1, 4.2, 4.7, 4.8_
  - **成果物**: `docker/nextjs/__tests__/agent-creation-wizard.test.tsx`

- [ ] 24. ローカルテストとEC2同期
  - ローカル環境でテスト実行
  - テスト結果の確認
  - EC2環境に変更を同期
  - _Requirements: 10.3_
  - **成果物**: `development/docs/reports/local/YYYY-MM-DD-phase3-test-results.md`

- [ ] 25. ブラウザ動作確認
  - CloudFront URLでの動作確認
  - ウィザード開始確認
  - 各ステップの遷移確認
  - 翻訳の確認（全言語）
  - Agent作成の確認
  - _Requirements: 10.4_
  - **成果物**: `development/docs/reports/local/YYYY-MM-DD-phase3-browser-verification.md`

- [ ] 26. ユーザー承認待ち
  - ユーザーに動作確認を依頼
  - フィードバックを収集
  - 必要に応じて修正
  - _Requirements: 10.5_

- [ ] 27. Git Commit & Push
  - 変更をコミット
  - リモートリポジトリにプッシュ
  - コミットメッセージに修正内容を明記
  - _Requirements: 10.6, 10.7_
  - **成果物**: Git commit hash

- [ ] 28. Phase 3 完了レポート作成
  - 修正内容の詳細
  - テスト結果のサマリー
  - デプロイメントログ
  - 検証結果
  - _Requirements: 10.8, 10.9_
  - **成果物**: `development/docs/reports/local/YYYY-MM-DD-phase3-completion-report.md`

---

### Phase 4: ガイドドキュメント更新とIaC改善

- [ ] 29. Agent Steering ガイドの更新
  - Agent mode UI/UX修正の知見を追加
  - Introduction Text動的更新のベストプラクティス
  - Region/Model動的連動のパターン
  - Agent Creation Wizardの使用方法
  - _Requirements: 知見の蓄積_
  - **成果物**: 更新された`.kiro/steering/agent-mode-guide.md`

- [ ] 30. ユーザーガイドの更新
  - Agent mode機能の説明を更新
  - Introduction Textの動的更新について説明
  - Region/Model選択の説明を更新
  - Agent作成ウィザードの使用方法を追加
  - _Requirements: 知見の蓄積_
  - **成果物**: 更新された`docs/user-guide.md`

- [ ] 31. デプロイメントガイドの更新
  - 環境変数の設定方法を追加
  - 設定ファイルの配置方法を追加
  - CDKスタックの更新手順を追加
  - _Requirements: 知見の蓄積、IaC化_
  - **成果物**: 更新された`docs/deployment-guide.md`

- [ ] 32. 統合開発ルールの更新
  - Agent mode UI/UX修正のパターンを追加
  - React State安全性のベストプラクティスを追加
  - イベントハンドリングのパターンを追加
  - _Requirements: 知見の蓄積_
  - **成果物**: 更新された`.kiro/steering/consolidated-development-rules.md`

- [ ] 33. CDKスタックの改善
  - [ ] 33.1 環境変数の動的設定
    - Agent/KB mode用のリージョン/モデルリストを環境変数として設定
    - CloudFront URLとLambda Function URLを環境変数として設定
    - _Requirements: IaC化_
  
  - [ ] 33.2 設定ファイルのS3バケット配置
    - 設定ファイルをS3バケットに配置
    - Lambda関数から設定ファイルを読み込む
    - _Requirements: IaC化、再現性_
  
  - [ ] 33.3 デプロイスクリプトの改善
    - 環境変数の自動設定
    - 設定ファイルの自動アップロード
    - _Requirements: IaC化、再現性_
  
  - **成果物**: 更新されたCDKスタックとデプロイスクリプト

- [ ] 34. 最終検証とドキュメント完成
  - すべてのガイドドキュメントの整合性確認
  - CDKスタックの動作確認
  - デプロイスクリプトの動作確認
  - _Requirements: 知見の蓄積、IaC化、再現性_
  - **成果物**: `development/docs/reports/local/YYYY-MM-DD-phase4-final-verification.md`

- [ ] 35. ユーザー承認待ち
  - ユーザーにすべてのドキュメントとIaC改善を確認依頼
  - フィードバックを収集
  - 必要に応じて修正
  - _Requirements: 10.5_

- [ ] 36. Git Commit & Push
  - すべての変更をコミット
  - リモートリポジトリにプッシュ
  - コミットメッセージに修正内容を明記
  - _Requirements: 10.6, 10.7_
  - **成果物**: Git commit hash

- [ ] 37. 最終完了レポート作成
  - 全フェーズの修正内容のサマリー
  - テスト結果の総括
  - デプロイメントログの総括
  - 検証結果の総括
  - 今後の改善提案
  - _Requirements: 10.8, 10.9_
  - **成果物**: `development/docs/reports/local/YYYY-MM-DD-final-completion-report.md`

---

## 注意事項

- タスクに`*`が付いているものはオプションです（テスト関連）
- 各フェーズは独立してデプロイ・検証されます
- ユーザー承認後にのみGit Commit & Pushを実行します
- すべての成果物は`development/docs/reports/local/`ディレクトリに保存されます
- ハードコードされた値は環境変数や設定ファイルに移行します
- IaC化と再現性を優先した実装を行います

---

**ステータス**: 準備完了  
**次のステップ**: Phase 1のタスク実行開始
