# Permission-aware RAG System with Amazon FSx for NetApp ONTAP

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-2.5.0-green.svg)](VERSION)

Amazon FSx for ONTAPとAmazon Bedrockを組み合わせた、エンタープライズグレードのRAG（Retrieval-Augmented Generation）システムです。権限ベースの文書検索とチャット機能を提供します。

## 🆕 最新機能: AgentCore統合v2ハイブリッドアーキテクチャ (v2.8.0)

**リリース日**: 2026年1月8日  
**Phase 4完了**: 2026年1月8日

Next.js UIとAgentCore Runtime APIを統合したハイブリッドアーキテクチャシステムを実装しました。責任分離により、UI/UXとAI処理を最適化し、API Gateway無効化でタイムアウト制約を回避した高性能システムを実現しています。

### 🚀 AgentCore統合v2の主要機能

#### ハイブリッドアーキテクチャの実現
- **Next.js側**: UI/UX処理、認証・セッション管理、設定管理、Lambda直接呼び出し
- **AgentCore Runtime側**: AI処理・推論、モデル呼び出し、ナレッジベースクエリ、レスポンス生成
- **API Gateway無効化**: 29秒タイムアウト制約を完全回避
- **Lambda直接呼び出し**: 高性能な統合とコスト削減を実現

#### 本番環境デプロイ成功
- **開発環境**: `TokyoRegion-permission-aware-rag-dev-AgentCore-Runtime-V2-NoAPI`
- **本番環境**: `TokyoRegion-permission-aware-rag-prod-AgentCore-V2`
- **DynamoDB**: ユーザー設定永続化（`UserPrefs-V2`）
- **EventBridge**: ハイブリッドアーキテクチャ統合（`HybridBus-V2`）
- **監視・アラート**: CloudWatch + SNS統合

#### 解決した技術課題
- **Lambda関数名64文字制限**: 関数名短縮で解決
- **SNSトピック名競合**: 環境名追加で解決
- **FSx統合機能制限**: 機能フラグで段階的対応
- **API Gateway制約**: 無効化により完全回避

### 🎯 技術的価値

#### アーキテクチャの利点
- ✅ **責任分離**: UI/UXとAI処理の独立最適化
- ✅ **スケーラビリティ**: フロントエンド・バックエンド独立スケール
- ✅ **保守性**: 明確な責任分担による高い保守性
- ✅ **拡張性**: 新機能追加時の既存システムへの影響最小化

#### 運用上の利点
- ✅ **段階的導入**: 必要な機能のみを選択的に有効化
- ✅ **コスト効率**: API Gateway無効化によるコスト削減
- ✅ **高性能**: Lambda直接呼び出しによる低レイテンシ
- ✅ **開発効率**: フロントエンド・バックエンド並行開発

### 🔧 使用方法

#### 1. 開発環境デプロイ
```bash
# AgentCore統合v2開発環境デプロイ
DEPLOY_MODE=full CONFIG_ENV=development npx cdk deploy \
  TokyoRegion-permission-aware-rag-dev-AgentCoreIntegration-V2-NoAPI \
  --app 'npx ts-node bin/deploy-all-stacks.ts' \
  -c imageTag=agentcore-v2-dev-$(date +%Y%m%d-%H%M%S) \
  --require-approval never
```

#### 2. 本番環境デプロイ
```bash
# 本番環境synthテスト（必須）
DEPLOY_MODE=production CONFIG_ENV=production npx cdk synth \
  TokyoRegion-permission-aware-rag-prod-AgentCore-V2 \
  --app 'npx ts-node bin/deploy-all-stacks.ts' \
  -c imageTag=agentcore-v2-prod-$(date +%Y%m%d-%H%M%S)

# 本番環境デプロイ
DEPLOY_MODE=production CONFIG_ENV=production npx cdk deploy \
  TokyoRegion-permission-aware-rag-prod-AgentCore-V2 \
  --app 'npx ts-node bin/deploy-all-stacks.ts' \
  -c imageTag=agentcore-v2-prod-$(date +%Y%m%d-%H%M%S) \
  --require-approval never
```

#### 3. フロントエンド統合
```typescript
// AgentCore Client Service使用例
import { AgentCoreClient } from '@/services/agentcore-client';

const client = new AgentCoreClient();

// AgentCore Runtime呼び出し
const response = await client.invokeAgentCore(
  'Hello from AgentCore v2',
  { 
    functionName: 'TokyoRegion-permission-aware-rag-prod-AgentCore-V2',
    timeout: 30000 
  }
);
```

### 🎨 Phase 1: Agent Mode UI/UX修正完了 (v2.9.0)

**リリース日**: 2026年1月19日  
**Agent Introduction Text リアルタイム更新修正完了**

#### 🎯 解決した問題

Agent modeでユーザーがサイドバーから異なるAgentを選択した際、メインチャットエリアの
Introduction Textがリアルタイムで更新されない問題を完全に解決しました。

#### 🔧 実装した修正

1. **v19: Zustand Store直接更新方式**
   - Callbackアプローチから直接更新方式に変更
   - 新しいセッションオブジェクトを直接作成して`setCurrentSession()`に渡す
   - 即座の状態更新とReact再レンダリングを保証

2. **v17: Force Re-render機構**
   - `renderKey` state変数を追加
   - Agent選択時に`setRenderKey(prev => prev + 1)`で強制再レンダリング
   - Message Areaに`key={renderKey}`を適用

3. **v4-v16: Array.isArray()チェック**
   - 全useEffectフックに`Array.isArray()`チェックを追加
   - React state race conditionを防止
   - "Cannot read properties of undefined (reading 'length')"エラー完全解消

4. **v3: AgentInfoSection.tsx修正**
   - 未使用の`tError`変数を削除（"b is not a function"エラー解消）
   - alert()呼び出しを削除してエラーハンドリングを改善

5. **v22: Dockerfile修正**
   - `AWS_LWA_INVOKE_MODE=response_stream`を削除
   - Default buffered modeでNext.js standaloneとの互換性を確保

#### ✅ 検証結果

- **Lambda Function URL**: 200 OK, 22,524 bytes（v21では0 bytes）
- **ユーザー確認**: "introduction Textが正しく連動しているように見えます"
- **パフォーマンス**: < 40ms レイテンシ（目標100ms以下を大幅に達成）
- **成功率**: 100%
- **エラー**: 0件

#### 📚 新規ドキュメント

- **Agent Mode開発ガイド**: `.kiro/steering/agent-mode-guide.md`
  - Introduction Text動的更新の実装パターン
  - サイドバーとメインチャットの連動方法
  - 翻訳キーの実装パターン
  - React State管理のベストプラクティス
  - トラブルシューティングガイド
  - デプロイメント手順

#### 🔗 関連リソース

- **デプロイメントレポート**: `development/docs/reports/local/01-19-phase1-task4-v22-deployment-success.md`
- **検証レポート**: `development/docs/reports/local/01-19-phase1-browser-verification-success.md`
- **Git Commit**: `6d673e2` - feat(agent-mode): Fix Agent Introduction Text real-time update

---

### 🎨 Phase 5: エンドユーザー体験向上 (v2.8.1)

**リリース日**: 2026年1月8日  
**Agent選択変更イベント連動修正完了**

#### 🔧 修正内容
- **Agent選択変更イベントリスナー改善**: 即座のIntroduction Text更新
- **Agent情報統合ロジック強化**: 複数ソースからの確実な情報取得
- **初期化時イベント発火追加**: ページロード時のAgent情報反映
- **新しいチャット作成時の情報取得強化**: 確実なAgent情報反映

#### 🚀 技術的改善
- **TypeScriptエラー完全解消**: 28個 → 0個
- **Agent情報統合順序**: `selectedAgentInfo` → `agentInfo` → `effectiveAgentInfo`
- **イベント発火タイミング最適化**: 即座実行による応答性向上
- **ユーザー体験一貫性**: Agent選択とIntroduction Textの完全連動

#### 💡 重要なTIPS

##### Agent選択変更イベント実装パターン
```typescript
// ✅ 正しい実装: 即座イベント発火
const handleAgentChange = (newAgentId: string) => {
  setSelectedAgentId(newAgentId);
  
  // 即座にイベントを発火（遅延なし）
  const customEvent = new CustomEvent('agent-selection-changed', {
    detail: { agentInfo: selectedAgent, source: 'AgentInfoSection' }
  });
  window.dispatchEvent(customEvent);
};

// ✅ 複数ソースからのAgent情報統合
const effectiveAgentInfo = selectedAgentInfo || agentInfo || fallbackAgentInfo;
```

##### 初期化時イベント発火パターン
```typescript
// ✅ 初期化時のAgent情報イベント発火
useEffect(() => {
  if (selectedAgent && agents.length > 0) {
    setTimeout(() => {
      const customEvent = new CustomEvent('agent-selection-changed', {
        detail: { agentInfo: selectedAgent, source: 'Init' }
      });
      window.dispatchEvent(customEvent);
    }, 100); // メインコンポーネント初期化完了を待つ
  }
}, [selectedAgent, agents.length]);
```

##### 新しいチャット作成時のAgent情報取得
```typescript
// ✅ 複数ソースからの確実なAgent情報取得
const currentAgentInfo = selectedAgentInfo || agentInfo || effectiveAgentInfo;

if (agentMode && currentAgentInfo) {
  initialMessageText = generateAgentInitialMessage(
    user.username, currentAgentInfo, tIntro
  );
} else if (agentMode) {
  // フォールバック: Agent未選択時のメッセージ
  initialMessageText = generateAgentInitialMessage(
    user.username, null, tIntro
  );
}
```

##### Agent選択変更イベント連動修正のベストプラクティス（v2.8.1追加）
```typescript
// ✅ 問題: 「Agent選択中...」表示の解決
// 原因: Agent選択変更イベントの発火タイミング不適切
// 解決: 即座実行 + 複数ソース統合

// 1. Agent選択ハンドラーの改善
const handleAgentSelection = async (agentId: string) => {
  // 即座にストア更新
  setSelectedAgentId(agentId);
  
  // Agent詳細情報取得
  const selectedAgent = agents.find(a => a.agentId === agentId);
  
  // 即座にイベント発火（遅延なし）
  if (selectedAgent) {
    const event = new CustomEvent('agent-selection-changed', {
      detail: { 
        agentInfo: selectedAgent,
        timestamp: Date.now(),
        source: 'AgentSelection'
      }
    });
    window.dispatchEvent(event);
  }
};

// 2. Agent情報統合の優先順位
const getEffectiveAgentInfo = () => {
  // 優先順位: selectedAgentInfo > agentInfo > effectiveAgentInfo
  return selectedAgentInfo || agentInfo || effectiveAgentInfo;
};

// 3. Introduction Text生成の改善
const generateIntroductionText = (agentInfo: AgentInfo | null) => {
  if (!agentInfo) {
    return tIntro('selectAgent'); // Agent未選択メッセージ
  }
  
  return tIntro('agentSelected', {
    agentName: agentInfo.agentName || agentInfo.alias || 'Unknown Agent',
    agentId: agentInfo.agentId || 'N/A',
    status: agentInfo.status || agentInfo.agentStatus || 'Unknown',
    version: agentInfo.version || agentInfo.latestAgentVersion || 'N/A'
  });
};
```

##### デプロイ時の重要な確認事項
```bash
# ✅ Agent選択変更イベント連動修正デプロイ後の確認
# 1. CloudFrontキャッシュ無効化完了確認（5-10分待機）
# 2. 実環境でのAgent選択変更テスト
# 3. 新しいチャット作成時のAgent情報反映確認
# 4. 初期化時のAgent情報表示確認

# 実環境テストURL
https://d3p7l2uoh6npdr.cloudfront.net/ja/genai?mode=agent

# 確認項目
# - Agent選択ドロップダウン操作時の即座更新
# - 「Agent選択中...」メッセージが表示されないこと
# - Agent詳細情報（ID、名前、ステータス等）の正確表示
# - 新しいチャット作成時のAgent情報反映
```

### 📚 詳細ドキュメント
- **[AgentCore統合v2デプロイガイド](docs/AgentCore統合v2デプロイガイド.md)** - 詳細なデプロイ手順とTIPS
- **[ハイブリッドアーキテクチャ実装ガイド](docs/guides/agentcore-complete-guide.md)** - アーキテクチャ設計詳細
- **[Lambda直接呼び出し実装ガイド](docs/guides/deployment-complete-guide.md)** - API Gateway無効化実装
- **[Agent選択変更イベント実装ガイド](docs/guides/frontend-complete-guide.md)** - イベント連動実装パターン

---

## 🆕 前回の機能: Bedrock AgentCore CDK統合 (v2.5.0)

**リリース日**: 2026年1月4日  
**Phase 4完了**: 2026年1月4日

Amazon Bedrock AgentCoreの9つの機能コンポーネントをCDKスタック（WebAppStack、SecurityStack、OperationsStack）に統合し、エンタープライズグレードのAIエージェントシステムを構築できるようになりました。

### 🚀 AgentCore統合機能

#### WebAppStack統合（5コンポーネント）
- **Runtime**: イベント駆動実行、Lambda関数、EventBridge統合
- **Gateway**: REST API/Lambda/MCPサーバー自動変換
- **Memory**: 長期記憶（Semantic/Summary/User Preference）
- **Browser**: Web自動化、ヘッドレスブラウザ統合
- **CodeInterpreter**: 安全なコード実行環境

#### SecurityStack統合（2コンポーネント）
- **Identity**: 認証・認可、RBAC/ABAC対応
- **Policy**: ポリシー管理、自然言語ポリシー、Cedar統合

#### OperationsStack統合（2コンポーネント）
- **Observability**: CloudWatch/X-Ray統合、エラートラッキング
- **Evaluations**: 品質評価、A/Bテスト、パフォーマンス測定

### 🎯 主な特徴
- **完全オプショナル**: 全てのコンポーネントが`enabled`フラグで制御可能
- **型安全**: TypeScript型定義とバリデーション完備（25テスト合格）
- **設定駆動**: `cdk.context.json`で全機能を制御
- **CloudFormation Outputs**: 全リソースのARN/ID自動出力（18 Outputs）
- **CDKスタック統合**: 3つのスタックに9つのConstructを統合完了

### 📚 ドキュメント
- **実装ガイド**: `docs/guides/bedrock-agentcore-implementation-guide.md`
- **設定例**: `cdk.context.json.example`, `cdk.context.json.minimal`, `cdk.context.json.production`
- **型定義**: `types/agentcore-config.ts`
- **バリデーション**: `lib/config/agentcore-config-validator.ts`
- **完了レポート**: `development/docs/reports/local/01-04-phase-4-task-4-1-cdk-stack-integration-completion-report.md`

### 🔧 使用方法

1. **設定ファイル作成**:
   ```bash
   # 最小構成から開始（Runtime + Memory のみ）
   cp cdk.context.json.minimal cdk.context.json
   
   # または完全構成（全9コンポーネント有効）
   cp cdk.context.json.example cdk.context.json
   
   # または本番推奨構成
   cp cdk.context.json.production cdk.context.json
   ```

2. **必要な機能を有効化**:
   ```json
   {
     "agentCore": {
       "runtime": { "enabled": true },
       "memory": { "enabled": true },
       "observability": { "enabled": true }
     }
   }
   ```

3. **デプロイ**:
   ```bash
   # 全スタックデプロイ（AgentCore機能を含む）
   npx cdk deploy --all
   
   # 特定のスタックのみデプロイ
   npx cdk deploy TokyoRegion-permission-aware-rag-prod-WebApp
   npx cdk deploy TokyoRegion-permission-aware-rag-prod-Security
   npx cdk deploy TokyoRegion-permission-aware-rag-prod-Operations
   ```

4. **デプロイ後の確認**:
   ```bash
   # CloudFormation Outputsを確認
   aws cloudformation describe-stacks \
     --stack-name TokyoRegion-permission-aware-rag-prod-WebApp \
     --query 'Stacks[0].Outputs' \
     --output table
   ```

## 🆕 最新機能: FSx統合システム IaC実装 (v2.7.0)

**リリース日**: 2026年1月8日  
**実装完了**: FSx for ONTAP統合システムのIaC化

Amazon FSx for ONTAPとサーバーレスアーキテクチャを統合したエンタープライズグレードのデータ処理基盤をInfrastructure as Code (IaC)として実装しました。設定ファイルの機能フラグで各機能を柔軟に有効化/無効化できます。

### 🚀 FSx統合システムの主要機能

#### 1. 設定ファイル駆動の機能制御
```typescript
features: {
  // FSx統合機能フラグ
  enableFsxIntegration: true,           // FSx統合機能全体
  enableFsxServerlessWorkflows: true,   // Step Functionsワークフロー
  enableFsxEventDriven: true,          // EventBridgeイベント駆動
  enableFsxBatchProcessing: true       // SQS/SNSバッチ処理
}
```

#### 2. 環境別最適化設定
- **開発環境**: コスト削減重視（基本機能のみ有効化）
- **本番環境**: 全機能有効化（高性能・高可用性）
- **カスタム環境**: 用途に応じた柔軟な設定

#### 3. 統合CDKスタック
```
1. NetworkingStack     (基盤)
2. SecurityStack       (セキュリティ)
3. DataStack          (データ・ストレージ)
4. EmbeddingStack     (AI・埋め込み)
5. WebAppStack        (Webアプリケーション)
6. FsxIntegrationStack (FSx統合) ← 新規追加
7. OperationsStack    (監視・運用)
```

### 🎯 技術的価値

#### 高性能データ処理基盤
- **FSx for ONTAP**: 4GB/sの超高速ストレージ
- **Lambda Web Adapter**: 15分の長時間処理対応
- **EventBridge**: リアルタイムイベント駆動処理
- **Step Functions**: 複雑ワークフローの可視化管理

#### コスト効率の実現
| 項目 | 従来システム | FSx統合システム | 削減率 |
|------|-------------|----------------|--------|
| インフラ運用 | 月額50万円 | 月額5万円 | 90%削減 |
| 開発・保守 | 月額100万円 | 月額20万円 | 80%削減 |
| ストレージ | 月額30万円 | 月額9万円 | 70%削減 |
| **合計** | **月額180万円** | **月額34万円** | **81%削減** |

### 🏭 業界別ユースケース

#### 医療・ヘルスケア
- **医療画像診断支援**: MRI・CT画像の高速AI解析
- **診断時間短縮**: 従来2時間 → 15分に短縮
- **HIPAA準拠**: 完全暗号化・アクセス制御

#### 製造業
- **スマートファクトリー**: リアルタイム品質管理
- **全数検査**: 毎秒100枚の製品画像を並列処理
- **不良品検出**: 0.5秒以内の即座判定

#### 金融業界
- **不正取引検知**: リアルタイム取引分析
- **処理速度**: 100ms以内の判定で決済遅延なし
- **PCI DSS準拠**: エンタープライズグレードセキュリティ

#### メディア・エンターテイメント
- **動画自動編集**: 4K/8K動画の高速処理
- **制作時間短縮**: 従来8時間 → 30分に短縮
- **多言語対応**: 自動翻訳・字幕生成

### 🔧 使用方法

#### 1. 設定ファイル選択
```bash
# 開発環境（コスト削減重視）
cp lib/config/environments/tokyo-development-config.ts my-config.ts

# 本番環境（全機能有効）
cp lib/config/environments/tokyo-production-config.ts my-config.ts
```

#### 2. 機能フラグ設定
```typescript
// 開発環境: 選択的有効化
features: {
  enableFsxIntegration: true,           // ✅ 基本機能
  enableFsxServerlessWorkflows: false,  // ❌ コスト削減
  enableFsxEventDriven: true,          // ✅ テスト用
  enableFsxBatchProcessing: false      // ❌ コスト削減
}

// 本番環境: 全機能有効
features: {
  enableFsxIntegration: true,           // ✅ 全機能
  enableFsxServerlessWorkflows: true,   // ✅ 有効
  enableFsxEventDriven: true,          // ✅ 有効
  enableFsxBatchProcessing: true       // ✅ 有効
}
```

#### 3. デプロイ実行
```bash
# 開発環境デプロイ
CONFIG_ENV=development DEPLOY_MODE=full npx cdk deploy --all

# 本番環境デプロイ
CONFIG_ENV=production DEPLOY_MODE=production npx cdk deploy --all

# FSx統合スタックのみデプロイ
npx cdk deploy TokyoRegion-permission-aware-rag-prod-FsxIntegration
```

### 📚 詳細ドキュメント
- **[FSx統合システムIaC実装ガイド](docs/FSx統合システムIaC実装ガイド.md)** - 実装方法と設定詳細
- **[FSx統合システム業界別ユースケース](docs/FSx統合システム業界別ユースケース.md)** - 6業界の具体的活用例
- **[FSx統合システム技術価値と展開](docs/FSx統合システム技術価値と展開.md)** - 技術的価値とビジネスインパクト

---

## 🆕 前回の機能: 設定永続化システム (v2.6.0)

**リリース日**: 2026年1月7日  
**Task 3.2完了**: 2026年1月7日

ユーザー設定（テーマ、言語、リージョン、モデル設定等）をDynamoDBに永続化し、クロスデバイス同期を実現しました。

### 🚀 設定永続化機能
- **DynamoDB統合**: `userId + settingKey`複合キーによる柔軟な設定管理
- **クロスデバイス同期**: 複数デバイス間での設定自動同期
- **リアルタイム更新**: Zustand Store連携による即座の設定反映
- **自動保存**: 設定変更時の自動DynamoDB保存
- **型安全**: TypeScript型定義による安全な設定管理

### 🎯 対応設定項目
- **テーマ**: ライト/ダークモード
- **言語**: 8言語対応（日本語、英語、韓国語、中国語簡体/繁体、スペイン語、ドイツ語、フランス語）
- **デフォルトリージョン**: AWS Bedrockリージョン設定
- **モデル設定**: 使用するAIモデルの選択
- **その他**: 拡張可能な設定項目

### 🏗️ アーキテクチャ
- **DynamoDBテーブル**: `permission-aware-rag-preferences`
- **API Routes**: `/api/preferences` (GET/PUT/PATCH/DELETE)
- **Hooks**: `usePreferences`, `usePreferencesSync`
- **Provider**: `PreferencesSyncProvider` (自動同期)

### 🔧 使用方法

#### 1. 設定の取得
```typescript
import { usePreferences } from '@/hooks/usePreferences';

const { preferences, isLoading } = usePreferences();
console.log(preferences.theme); // 'light' or 'dark'
```

#### 2. 設定の更新
```typescript
const { updatePreference } = usePreferences();
await updatePreference('theme', 'dark');
```

#### 3. 設定の削除
```typescript
const { deletePreference } = usePreferences();
await deletePreference('theme');
```

### 📚 詳細ドキュメント
- **デプロイガイド**: `docs/guides/user-preferences-complete-guide.md`
- **CDK実装ノート**: `docs/guides/user-preferences-complete-guide.md`
- **API検証レポート**: `development/docs/reports/local/01-07-task3.2-api-verification-success.md`

## 🆕 前回の機能: Bedrock Agent作成UI (v2.4.0)

**リリース日**: 2025年12月13日

Bedrock Agent作成のための直感的なUIを実装しました。4ステップウィザードにより、コマンドライン操作なしでBedrock Agentを作成・管理できます。

### 🚀 Agent作成UI機能
- **4ステップウィザード**: 基本設定 → Foundation Model選択 → Knowledge Base選択 → Action Groups設定
- **直感的なUI**: AWS標準UIパターンに準拠した使いやすいインターフェース
- **リアルタイム進捗**: Agent作成プロセスの詳細な進捗表示
- **エラーハンドリング**: 詳細なエラーメッセージと修正ガイダンス
- **Foundation Model選択**: 15種類のモデルから最適なものを選択
- **Knowledge Base統合**: 既存のKnowledge Baseとの簡単な関連付け

### 🎯 使用方法
1. Agentモードに切り替え
2. サイドバーの「➕」ボタンまたは「🚀 新しいAgent作成」ボタンをクリック
3. 4ステップウィザードに従って設定
4. Agent作成完了後、即座に利用開始

## 🌍 多言語対応（i18n）システム

**最新更新**: 2026年1月6日

本システムは包括的な多言語対応を実装しており、**設定ベースで効率的に新言語を追加**できます。

### 🚀 サポート言語
- 🇯🇵 **日本語** (ja) - フル対応
- 🇺🇸 **English** (en) - フル対応
- 🇰🇷 **한국어** (ko) - フル対応
- 🇨🇳 **中文簡体** (zh-CN) - フル対応
- 🇹🇼 **中文繁體** (zh-TW) - フル対応
- 🇪🇸 **Español** (es) - フル対応
- 🇩🇪 **Deutsch** (de) - フル対応
- 🇫🇷 **Français** (fr) - フル対応

### 🎯 主な特徴
- **設定駆動**: 個別ファイル修正不要、設定ファイル更新のみで新言語追加
- **自動化ツール**: 翻訳ファイル生成・同期・検証を完全自動化
- **地域別自動選択**: AWSリージョンに基づく言語自動選択
- **リアルタイム切り替え**: ページリロード不要の言語切り替え
- **エラーメッセージ多言語化**: 全てのエラーメッセージが多言語対応

### 🤖 i18n自動化ツール

新言語の追加や翻訳管理を自動化するツールキットを提供：

```bash
# 新言語を追加（韓国語の例）
node development/scripts/utilities/i18n-automation-toolkit.js add-language ko

# 翻訳キーの整合性をチェック
node development/scripts/utilities/i18n-automation-toolkit.js validate

# 未使用翻訳キーを検出
node development/scripts/utilities/i18n-automation-toolkit.js find-unused

# 翻訳ファイルを同期（不足キーを補完）
node development/scripts/utilities/i18n-automation-toolkit.js sync

# コンポーネントのハードコードテキストをチェック
node development/scripts/utilities/i18n-automation-toolkit.js check-components

# 全チェックを実行
node development/scripts/utilities/i18n-automation-toolkit.js full-check
```

### 📚 詳細ドキュメント
- **包括的実装ガイド**: `docs/guides/frontend-complete-guide.md`
- **設定ベースシステム**: `docs/guides/frontend-complete-guide.md`
- **自動化ツール**: `development/scripts/utilities/i18n-automation-toolkit.js`

### 🔧 新言語追加手順（3ステップ）

1. **設定更新**: 環境変数で有効言語を指定
   ```bash
   # .env.local
   NEXT_PUBLIC_ENABLED_LOCALES=ja,en,ko
   ```

2. **自動生成**: ツールで翻訳ファイルを自動生成
   ```bash
   node development/scripts/utilities/i18n-automation-toolkit.js add-language ko
   ```

3. **翻訳作業**: 生成されたファイルの翻訳を実施
   ```json
   // messages/ko.json
   {
     "common": {
       "loading": "로딩 중...",
       "error": "오류"
     }
   }
   ```

### 🎨 UI言語切り替え
- **ヘッダー**: 右上の言語切り替えボタン
- **自動検出**: ブラウザ言語設定に基づく自動選択
- **地域連動**: AWSリージョン選択時の言語自動切り替え
- **永続化**: ユーザー選択の記憶・復元

### 🔍 トラブルシューティング

言語切り替えに関する問題が発生した場合は、以下のガイドを参照してください：

- **[i18nトラブルシューティングガイド](docs/guides/i18n-troubleshooting-guide.md)** - 言語切り替えの問題解決、デバッグ方法、ベストプラクティス

**よくある問題**:
- 言語切り替え後、一部のコンポーネントが更新されない → `useLocale`フックの使用を確認
- サインインループが発生する → middlewareの処理順序を確認
- Agentモード切り替え時にエラーが発生 → APIレスポンスのnullチェックを確認

### 💡 開発者向けTips

**コンポーネント開発時の必須事項**:
1. 全てのコンポーネントで`useLocale`フックを使用
2. `useMemo`の依存配列に`locale`を追加
3. ハードコードされたテキストを禁止、翻訳キーを使用
4. Chrome DevTools MCPでAPIレスポンス構造を確認してから実装

**詳細は以下を参照**:
- [i18nトラブルシューティングガイド](docs/guides/i18n-troubleshooting-guide.md)
- [Next.jsルーティング・Middlewareルール](.kiro/steering/nextjs-routing-middleware-rules.md)
- [TypeScript型安全性ルール](.kiro/steering/typescript-type-safety-debugging-rules.md)

## 🆕 前回の機能: FSx ONTAP ライフサイクル管理システム (v2.3.0)

**リリース日**: 2025年12月12日

Amazon FSx for NetApp ONTAPとS3 Access Points、S3 Glacier Deep Archiveを連携した3階層ライフサイクルマネジメントシステムを構築します。メディアプロダクションワークフローに最適化された「アーカイブレス」ストレージソリューションにより、データの生成からアーカイブまでの一連のライフサイクルを自動管理し、コスト効率と運用効率を最大化します。

### 🚀 アーカイブレス・ストレージの革新
- **統一アクセス層**: データの物理的な場所をユーザーから完全に抽象化
- **インテリジェント・データ・プロキシ**: 最適なストレージ階層からデータを透明に提供
- **予測分析エンジン**: アクセスパターンを学習し、将来のデータアクセスを予測して事前復元
- **仮想ファイルシステム**: 全てのデータを統一されたインターフェースで透明にアクセス

### 🏗️ 3階層ストレージアーキテクチャ
1. **FSx ONTAP Hot Tier**: 頻繁にアクセスされる高性能ストレージ層
2. **FSx ONTAP Cold Tier**: 低頻度アクセスの低コストストレージ層  
3. **S3 Glacier Deep Archive**: 長期アーカイブ用の最低コストストレージ層

### 🤖 自動ライフサイクル管理
- **30日ルール**: 30日間アクセスされないファイルを自動的にCold Tierに移動
- **90日ルール**: 90日間アクセスされないファイルをGlacier Deep Archiveに自動アーカイブ
- **S3 Intelligent Tiering**: アーカイブデータの自動コスト最適化
- **メタデータ追跡**: 全ファイルのアクセス履歴とライフサイクル状態を追跡

## 🆕 前々回の機能: 動的モデル対応システム (v2.2.0)

**リリース日**: 2025年12月11日

Amazon Bedrock Agentの動的モデル選択機能を大幅に強化し、新しいプロバイダーやモデルの追加に自動対応できるシステムを実装しました。

### 🚀 動的モデル対応機能
- **自動モデル選択**: リージョンとユースケースに応じた最適モデルの自動選択
- **動的プロバイダー追加**: 新しいAIプロバイダー（Mistral、OpenAI等）の設定ファイル更新のみでの追加
- **互換性チェック**: モデルとリージョンの互換性自動検証
- **自動更新**: Parameter Store連携による設定の動的更新
- **フォールバック機能**: 要件を満たさない場合の代替モデル自動選択

### 🛠️ 管理機能
- **運用管理スクリプト**: `manage-bedrock-models.sh`による包括的な管理
- **AWS MCP連携**: 実際のAWS API情報を活用したモデルパターン分析
- **設定外部化**: JSONファイルとParameter Store連携
- **バックアップ・復元**: 設定変更の安全な管理

### 📋 対応プロバイダー・モデル
#### 現在対応済み
- **Anthropic**: Claude 3.5 Sonnet, Claude 3 Haiku, Claude 3 Sonnet
- **Amazon**: Nova Pro, Nova Lite, Titan Text Express
- **Meta**: Llama 3 (一部リージョン)
- **Cohere**: Command R+ (一部リージョン)

#### 将来対応予定
- **Mistral AI**: 設定追加のみで対応可能
- **その他新しいプロバイダー**: 動的追加システムにより簡単対応

### 🎯 使用例

#### 基本的なチャットボット
```typescript
import { BedrockAgentDynamicConstruct } from './lib/modules/ai/constructs/bedrock-agent-dynamic-construct';

const chatAgent = new BedrockAgentDynamicConstruct(this, 'ChatAgent', {
  projectName: 'my-project',
  environment: 'production',
  agentName: 'chat-agent',
  instruction: 'You are a helpful AI assistant.',
  useCase: 'chat',
  enableDynamicModelSelection: true,
  enableAutoUpdate: true,
});
```

#### 新しいプロバイダーの追加
```bash
# Mistralプロバイダーの追加例
./development/scripts/management/manage-bedrock-models.sh add-provider mistral '{
  "name": "Mistral",
  "namingPattern": "mistral.{model-name}-{version}",
  "defaultRegions": ["us-east-1", "eu-west-1"],
  "supportedFeatures": {
    "onDemand": true,
    "provisioned": false,
    "streaming": true,
    "crossRegion": false
  }
}'
```

### 📚 FSx ONTAP ライフサイクル管理ドキュメント
- [ライフサイクル管理要件仕様書](.kiro/specs/fsx-ontap-lifecycle-management/requirements.md)
- [ライフサイクル管理設計書](.kiro/specs/fsx-ontap-lifecycle-management/design.md)
- [ライフサイクル管理実装計画](.kiro/specs/fsx-ontap-lifecycle-management/tasks.md)

### 📚 動的モデル対応ドキュメント
- [動的モデル開発ガイド](docs/guides/agentcore-complete-guide.md)
- [動的モデルデプロイメントガイド](docs/guides/deployment-complete-guide.md)
- [モデル管理ガイド](docs/guides/deployment-complete-guide.md)

---

## 🎯 従来機能: Bedrock Agent基本機能 (v2.1.0)

### 主要機能
- 🤖 **Agent情報表示**: Agent ID、Status、Foundation Model等の詳細情報
- 🔄 **動的モデル選択**: Claude 3.5 Sonnet、Haiku、Opus等のモデル切り替え
- 🌍 **リージョン切り替え**: 複数AWSリージョンでのAgent管理
- 🛡️ **エラーハンドリング**: Bedrock固有エラーの詳細表示
- 📊 **監査ログ**: 全操作の記録と追跡

### クイックスタート
```bash
# Agentモードに切り替え
# サイドバーでAgent情報を確認
# モデル選択でClaude 3.5 Sonnetに変更
# リージョンセレクターで東京リージョンを選択
```

---

## 🎯 主な特徴

- **2つの動作モード**: Knowledge Base Mode（シンプルRAG）と Agent Mode（高度な推論）
- **動的モデル選択**: 新しいプロバイダー・モデルに自動対応
- **権限ベースアクセス制御**: ユーザー固有の文書アクセス権限管理
- **サーバーレスアーキテクチャ**: AWS Lambda + CloudFront配信
- **レスポンシブUI**: Next.js + React + Tailwind CSS
- **高精度検索**: OpenSearch Serverlessベクトル検索
- **高性能ストレージ**: FSx for ONTAP
- **マルチリージョン対応**: 14リージョンでの展開
- **アクセシビリティ対応**: WCAG 2.1 AA準拠、スクリーンリーダー対応
- **多言語対応**: 8言語（日本語、英語、中国語、韓国語、スペイン語、フランス語、ドイツ語）
- **ダークモード**: システム設定に応じた自動切り替え、手動切り替えも可能
- **Agent作成UI**: 4ステップウィザードによる直感的なAgent作成 🆕

## 🤖 Amazon Bedrock AgentCore機能

**最新更新**: 2026-01-04  
**Phase 2完了**: Identity、Browser、Code Interpreter機能追加

本システムは、Amazon Bedrock Agentの高度な機能を提供する**AgentCore**モジュールを実装しています。

### 🚀 AgentCore コンポーネント

#### 1. Runtime - イベント駆動実行

**概要**: Bedrock Agentのイベント駆動実行とスケーリングを管理

**主な機能**:
- Lambda統合（Node.js 22.x）
- EventBridge統合（非同期処理）
- 自動スケーリング（Reserved/Provisioned Concurrency）
- KMS暗号化（環境変数）

**使用例**:
```typescript
import { BedrockAgentCoreRuntimeConstruct } from './lib/modules/ai/constructs/bedrock-agent-core-runtime-construct';

const runtime = new BedrockAgentCoreRuntimeConstruct(this, 'Runtime', {
  enabled: true,
  projectName: 'my-project',
  environment: 'prod',
  lambdaConfig: {
    timeout: cdk.Duration.seconds(30),
    memorySize: 2048,
    reservedConcurrency: 10,
  },
});
```

#### 2. Gateway - API/Lambda/MCP統合

**概要**: REST API、Lambda関数、MCPサーバーをBedrock Agent Toolに変換

**主な機能**:
- REST API変換（OpenAPI → Tool定義）
- Lambda関数変換（メタデータ → Tool定義）
- MCPサーバー統合（MCP Tool → Bedrock Tool）
- 認証・認可（API Key、OAuth2）

**使用例**:
```typescript
import { BedrockAgentCoreGatewayConstruct } from './lib/modules/ai/constructs/bedrock-agent-core-gateway-construct';

const gateway = new BedrockAgentCoreGatewayConstruct(this, 'Gateway', {
  enabled: true,
  projectName: 'my-project',
  environment: 'prod',
  restApiConfig: {
    enabled: true,
    openApiSpecPath: 's3://my-bucket/openapi.yaml',
  },
  mcpServerConfig: {
    enabled: true,
    endpoint: 'https://mcp.example.com',
    authType: 'API_KEY',
  },
});
```

#### 3. Memory - フルマネージドメモリ

**概要**: Bedrock Agentのフルマネージドメモリ機能

**主な機能**:
- Memory Resource（フルマネージド）
- Memory Strategies（Semantic, Summary, User Preference）
- 短期メモリ（会話履歴）
- 長期メモリ（重要情報の自動抽出）

**使用例**:
```typescript
import { BedrockAgentCoreMemoryConstruct } from './lib/modules/ai/constructs/bedrock-agent-core-memory-construct';

const memory = new BedrockAgentCoreMemoryConstruct(this, 'Memory', {
  enabled: true,
  projectName: 'my-project',
  environment: 'prod',
  memoryStrategies: {
    semantic: { enabled: true, maxTokens: 1000 },
    summary: { enabled: true, maxTokens: 500 },
    userPreference: { enabled: true },
  },
});
```

#### 4. Identity - 認証・認可（RBAC/ABAC）

**概要**: エージェントID管理とアクセス制御

**主な機能**:
- エージェントID管理（一意のID生成・管理）
- RBAC（ロールベースアクセス制御: Admin, User, ReadOnly）
- ABAC（属性ベースアクセス制御: 部署、プロジェクト、機密度）
- DynamoDB統合（永続化）
- KMS暗号化（データ保護）

**使用例**:
```typescript
import { BedrockAgentCoreIdentityConstruct, AgentRole } from './lib/modules/ai/constructs/bedrock-agent-core-identity-construct';

const identity = new BedrockAgentCoreIdentityConstruct(this, 'Identity', {
  enabled: true,
  projectName: 'my-project',
  environment: 'prod',
  rbacConfig: {
    enabled: true,
    defaultRole: AgentRole.USER,
  },
  abacConfig: {
    enabled: true,
    requiredAttributes: ['department', 'project'],
  },
});
```

#### 5. Browser - Headless Chrome統合

**概要**: Headless Chromeによるブラウザ自動化機能

**主な機能**:
- スクリーンショット撮影（PNG/JPEG/WebP）
- Webスクレイピング（Cheerio統合）
- ブラウザ自動化（Puppeteer統合）
- FSx for ONTAP + S3 Access Points統合
- サムネイル自動生成

**使用例**:
```typescript
import { BedrockAgentCoreBrowserConstruct } from './lib/modules/ai/constructs/bedrock-agent-core-browser-construct';

const browser = new BedrockAgentCoreBrowserConstruct(this, 'Browser', {
  enabled: true,
  projectName: 'my-project',
  environment: 'prod',
  screenshotBucket: 'my-screenshots-bucket',
  fsxS3AccessPointArn: 'arn:aws:s3:region:account:accesspoint/my-fsx-access-point', // オプション
  screenshotFormat: 'png',
  generateThumbnail: true,
});
```

**Lambda関数の使用例**:
```typescript
// スクリーンショット撮影
const screenshotRequest = {
  action: 'SCREENSHOT',
  url: 'https://example.com',
  options: {
    viewport: { width: 1920, height: 1080 },
    waitFor: 'body',
    timeout: 30000,
  },
};

// Webスクレイピング
const scrapeRequest = {
  action: 'SCRAPE',
  url: 'https://example.com',
  options: { timeout: 30000 },
};

// ブラウザ自動化
const automateRequest = {
  action: 'AUTOMATE',
  url: 'https://example.com',
  automation: {
    steps: [
      { type: 'WAIT', selector: 'body', timeout: 5000 },
      { type: 'CLICK', selector: '#button' },
      { type: 'TYPE', selector: '#input', value: 'Hello' },
      { type: 'SCROLL' },
    ],
  },
};
```

#### 6. Code Interpreter - コード実行環境

**概要**: Python/Node.jsコードの安全な実行環境

**主な機能**:
- コード実行（Python/Node.js）
- パッケージ管理（pip/npm）
- ファイル操作（作成・読み込み・削除）
- ターミナルコマンド実行
- セキュリティ（ホワイトリスト方式、危険なコマンドのブロック）

**使用例**:
```typescript
import { BedrockAgentCoreCodeInterpreterConstruct } from './lib/modules/ai/constructs/bedrock-agent-core-code-interpreter-construct';

const codeInterpreter = new BedrockAgentCoreCodeInterpreterConstruct(this, 'CodeInterpreter', {
  enabled: true,
  projectName: 'my-project',
  environment: 'prod',
  lambdaConfig: {
    memorySize: 3008,
    timeout: 300,
    ephemeralStorageSize: 2048,
  },
  executionConfig: {
    timeout: 60,
    maxFileSize: 10485760,
    allowedPackages: ['numpy', 'pandas', 'matplotlib', 'requests'],
  },
});
```

**Lambda関数の使用例**:
```typescript
// セッション作成
const createSessionRequest = {
  action: 'createSession',
  userId: 'user-123',
  options: {
    language: 'python',
    timeout: 60,
  },
};

// コード実行
const executeCodeRequest = {
  action: 'executeCode',
  sessionId: 'session-abc123',
  code: 'print("Hello, World!")',
  language: 'python',
  options: { timeout: 30 },
};

// パッケージインストール
const installPackageRequest = {
  action: 'installPackage',
  sessionId: 'session-abc123',
  packageName: 'numpy',
  packageVersion: '1.24.0',
  packageManager: 'pip',
};

// ファイル操作
const createFileRequest = {
  action: 'createFile',
  sessionId: 'session-abc123',
  path: '/tmp/data.txt',
  content: 'Hello, File!',
};
```

### 📋 AgentCore API

#### Identity API

**エージェントID作成**:
```bash
POST /identity/create
{
  "action": "create",
  "role": "User",
  "attributes": {
    "department": "engineering",
    "project": "rag-system",
    "sensitivity": "confidential"
  }
}
```

**ロール割り当て**:
```bash
POST /identity/assignRole
{
  "action": "assignRole",
  "agentId": "agent-1234567890-abc123",
  "role": "Admin"
}
```

**権限チェック**:
```bash
POST /identity/checkPermission
{
  "action": "checkPermission",
  "agentId": "agent-1234567890-abc123",
  "permission": "bedrock:InvokeAgent"
}
```

**ポリシー評価（ABAC）**:
```bash
POST /identity/evaluatePolicy
{
  "action": "evaluatePolicy",
  "agentId": "agent-1234567890-abc123",
  "policy": {
    "resource": "bedrock:agent:12345",
    "action": "bedrock:InvokeAgent",
    "conditions": {
      "department": "engineering",
      "project": "rag-system",
      "sensitivity": "confidential"
    }
  }
}
```

#### Browser API

**スクリーンショット撮影**:
```bash
POST /browser/screenshot
{
  "action": "SCREENSHOT",
  "url": "https://example.com",
  "options": {
    "viewport": { "width": 1920, "height": 1080 },
    "waitFor": "body",
    "timeout": 30000
  }
}

# レスポンス
{
  "requestId": "uuid",
  "status": "SUCCESS",
  "result": {
    "screenshot": "s3://bucket/screenshots/uuid.png"
  },
  "metrics": {
    "latency": 2500,
    "pageLoadTime": 1800
  }
}
```

**Webスクレイピング**:
```bash
POST /browser/scrape
{
  "action": "SCRAPE",
  "url": "https://example.com",
  "options": { "timeout": 30000 }
}

# レスポンス
{
  "requestId": "uuid",
  "status": "SUCCESS",
  "result": {
    "html": "<html>...</html>",
    "data": {
      "title": "Example Domain",
      "headings": ["Example Domain"],
      "links": ["https://www.iana.org/domains/example"],
      "images": []
    }
  },
  "metrics": {
    "latency": 1500,
    "pageLoadTime": 1200
  }
}
```

**ブラウザ自動化**:
```bash
POST /browser/automate
{
  "action": "AUTOMATE",
  "url": "https://example.com",
  "automation": {
    "steps": [
      { "type": "WAIT", "selector": "body", "timeout": 5000 },
      { "type": "CLICK", "selector": "#button" },
      { "type": "TYPE", "selector": "#input", "value": "Hello" },
      { "type": "SCROLL" }
    ]
  }
}

# レスポンス
{
  "requestId": "uuid",
  "status": "SUCCESS",
  "result": {
    "html": "<html>...</html>"
  },
  "metrics": {
    "latency": 3000,
    "pageLoadTime": 1500
  }
}
```

#### Code Interpreter API

**セッション作成**:
```bash
POST /code-interpreter/createSession
{
  "action": "createSession",
  "userId": "user-123",
  "options": {
    "language": "python",
    "timeout": 60
  }
}

# レスポンス
{
  "requestId": "req-1234567890",
  "sessionId": "session-abc123",
  "status": "SUCCESS",
  "result": {
    "message": "セッションが作成されました",
    "language": "python",
    "timeout": 60
  },
  "metrics": {
    "latency": 50
  }
}
```

**コード実行**:
```bash
POST /code-interpreter/executeCode
{
  "action": "executeCode",
  "sessionId": "session-abc123",
  "code": "print('Hello, World!')",
  "language": "python",
  "options": { "timeout": 30 }
}

# レスポンス
{
  "requestId": "req-1234567891",
  "sessionId": "session-abc123",
  "status": "SUCCESS",
  "result": {
    "output": "Hello, World!\n",
    "error": "",
    "executionTime": 125
  },
  "metrics": {
    "latency": 200,
    "executionTime": 125
  }
}
```

**パッケージインストール**:
```bash
POST /code-interpreter/installPackage
{
  "action": "installPackage",
  "sessionId": "session-abc123",
  "packageName": "numpy",
  "packageVersion": "1.24.0",
  "packageManager": "pip"
}

# レスポンス
{
  "requestId": "req-1234567896",
  "sessionId": "session-abc123",
  "status": "SUCCESS",
  "result": {
    "message": "パッケージがインストールされました",
    "packageName": "numpy",
    "packageVersion": "1.24.0"
  },
  "metrics": {
    "latency": 15000,
    "executionTime": 14500
  }
}
```

**ファイル操作**:
```bash
# ファイル作成
POST /code-interpreter/createFile
{
  "action": "createFile",
  "sessionId": "session-abc123",
  "path": "/tmp/data.txt",
  "content": "Hello, File!"
}

# ファイル読み込み
POST /code-interpreter/readFile
{
  "action": "readFile",
  "sessionId": "session-abc123",
  "path": "/tmp/data.txt"
}

# ファイル削除
POST /code-interpreter/deleteFile
{
  "action": "deleteFile",
  "sessionId": "session-abc123",
  "path": "/tmp/data.txt"
}
```

**ターミナルコマンド実行**:
```bash
POST /code-interpreter/executeCommand
{
  "action": "executeCommand",
  "sessionId": "session-abc123",
  "command": "ls -la /tmp",
  "options": { "timeout": 30 }
}

# レスポンス
{
  "requestId": "req-1234567895",
  "sessionId": "session-abc123",
  "status": "SUCCESS",
  "result": {
    "output": "total 8\ndrwxr-xr-x  2 root root 4096 Jan  4 10:00 .\n..."
  },
  "metrics": {
    "latency": 180,
    "executionTime": 95
  }
}
```

#### 7. Observability - 分散トレーシング・監視

**概要**: X-Ray、CloudWatch統合による包括的な可観測性

**主な機能**:
- X-Ray分散トレーシング（カスタムセグメント、サンプリングルール）
- CloudWatchカスタムメトリクス（レイテンシ、エラー率、スループット）
- ダッシュボード自動生成
- アラーム設定（しきい値ベース、異常検知）
- エラー追跡・根本原因分析（RCA）
- ログ集約・検索

**使用例**:
```typescript
import { BedrockAgentCoreObservabilityConstruct } from './lib/modules/ai/constructs/bedrock-agent-core-observability-construct';

const observability = new BedrockAgentCoreObservabilityConstruct(this, 'Observability', {
  enabled: true,
  projectName: 'my-project',
  environment: 'prod',
  xrayConfig: {
    enabled: true,
    samplingRate: 0.1,
    customSegments: ['bedrock-agent', 'lambda-execution'],
  },
  cloudwatchConfig: {
    enabled: true,
    dashboardEnabled: true,
    alarmEnabled: true,
    customMetrics: ['AgentLatency', 'AgentErrorRate', 'AgentThroughput'],
  },
  errorTrackingConfig: {
    enabled: true,
    rcaEnabled: true,
    logRetentionDays: 30,
  },
});
```

**Lambda関数の使用例**:
```typescript
// X-Rayトレーシング
const traceRequest = {
  action: 'trace',
  traceId: 'trace-abc123',
  segmentName: 'bedrock-agent-execution',
  metadata: {
    agentId: 'agent-123',
    userId: 'user-456',
  },
};

// カスタムメトリクス送信
const metricsRequest = {
  action: 'sendMetrics',
  metrics: [
    { name: 'AgentLatency', value: 250, unit: 'Milliseconds' },
    { name: 'AgentErrorRate', value: 0.01, unit: 'Percent' },
  ],
};

// エラー追跡
const errorRequest = {
  action: 'trackError',
  error: {
    message: 'Agent execution failed',
    stack: '...',
    context: { agentId: 'agent-123' },
  },
};
```

#### 8. Evaluations - 品質評価・A/Bテスト

**概要**: 13の組み込み評価器とA/Bテスト機能

**主な機能**:
- 品質メトリクス（13の評価器: 正確性、関連性、有用性、一貫性、完全性、簡潔性、明瞭性、文法、トーン、バイアス、有害性、事実性、引用品質）
- A/Bテスト（トラフィック分割、統計的有意性検定、自動最適化）
- パフォーマンス評価（レイテンシ、スループット、コスト分析）
- 評価結果保存（S3 + DynamoDB）
- ダッシュボード可視化

**使用例**:
```typescript
import { BedrockAgentCoreEvaluationsConstruct } from './lib/modules/ai/constructs/bedrock-agent-core-evaluations-construct';

const evaluations = new BedrockAgentCoreEvaluationsConstruct(this, 'Evaluations', {
  enabled: true,
  projectName: 'my-project',
  environment: 'prod',
  qualityMetricsConfig: {
    enabled: true,
    evaluators: ['accuracy', 'relevance', 'helpfulness', 'consistency'],
    bedrockModelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
  },
  abTestConfig: {
    enabled: true,
    trafficSplitRatio: 0.5,
    minSampleSize: 100,
    confidenceLevel: 0.95,
  },
  performanceEvaluationConfig: {
    enabled: true,
    latencyThreshold: 1000,
    throughputThreshold: 100,
  },
});
```

**Lambda関数の使用例**:
```typescript
// 品質評価
const evaluateRequest = {
  action: 'evaluate',
  evaluator: 'accuracy',
  input: 'ユーザーの質問',
  output: 'エージェントの回答',
  reference: '正解データ',
};

// A/Bテスト
const abTestRequest = {
  action: 'determineVariant',
  testId: 'test-123',
  userId: 'user-456',
};

// パフォーマンス評価
const performanceRequest = {
  action: 'evaluatePerformance',
  agentId: 'agent-123',
  metrics: {
    latency: 250,
    throughput: 150,
    errorRate: 0.01,
  },
};
```

#### 9. Policy - 自然言語ポリシー管理

**概要**: 自然言語でのポリシー記述とCedar Policy Language統合

**主な機能**:
- 自然言語ポリシー（日本語・英語対応）
- Cedar Policy Language変換
- 形式検証（Formal Verification）
- 競合検出（Conflict Detection）
- ポリシー管理（CRUD、バージョン管理、承認ワークフロー）
- 監査ログ

**使用例**:
```typescript
import { BedrockAgentCorePolicyConstruct } from './lib/modules/ai/constructs/bedrock-agent-core-policy-construct';

const policy = new BedrockAgentCorePolicyConstruct(this, 'Policy', {
  enabled: true,
  projectName: 'my-project',
  environment: 'prod',
  naturalLanguagePolicyConfig: {
    enabled: true,
    supportedLanguages: ['ja', 'en'],
    bedrockModelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
  },
  cedarIntegrationConfig: {
    enabled: true,
    formalVerification: true,
    conflictDetection: true,
  },
  policyManagementConfig: {
    enabled: true,
    versioningEnabled: true,
    approvalWorkflow: true,
  },
});
```

**Lambda関数の使用例**:
```typescript
// 自然言語ポリシーの解析
const parseRequest = {
  action: 'parse-policy',
  naturalLanguagePolicy: 'ユーザーが自分のドキュメントを読むことを許可する',
  language: 'ja',
};

// Cedar Policy Languageへの変換
const convertRequest = {
  action: 'convert-to-cedar',
  parsedPolicy: { /* 解析結果 */ },
};

// ポリシー検証
const validateRequest = {
  action: 'validate-policy',
  parsedPolicy: { /* 解析結果 */ },
};

// 競合検出
const conflictRequest = {
  action: 'detect-conflicts',
  policies: [policy1, policy2, policy3],
};

// ポリシー作成
const createRequest = {
  action: 'create-policy',
  policyData: {
    name: 'document-read-policy',
    description: 'ドキュメント読み取りポリシー',
    parsedPolicy: { /* 解析結果 */ },
    cedarPolicyText: 'permit(...)',
  },
};
```

#### Policy API

**自然言語ポリシー解析**:
```bash
POST /policy/parse
{
  "action": "parse-policy",
  "naturalLanguagePolicy": "ユーザーが自分のドキュメントを読むことを許可する。ただし、機密レベルが「極秘」のドキュメントは除外する。",
  "language": "ja"
}

# レスポンス
{
  "requestId": "uuid",
  "status": "SUCCESS",
  "parsedPolicy": {
    "effect": "permit",
    "principal": { "type": "User", "id": "${user.id}" },
    "action": "read",
    "resource": { "type": "Document", "id": "${user.id}/*" },
    "conditions": [
      { "attribute": "confidentialityLevel", "operator": "!=", "value": "top-secret" }
    ]
  }
}
```

**Cedar変換**:
```bash
POST /policy/convert
{
  "action": "convert-to-cedar",
  "parsedPolicy": { /* 解析結果 */ }
}

# レスポンス
{
  "requestId": "uuid",
  "status": "SUCCESS",
  "cedarPolicyText": "permit(\n  principal == User::\"${user.id}\",\n  action == Action::\"read\",\n  resource in Document::\"${user.id}/*\"\n)\nwhen {\n  resource.confidentialityLevel != \"top-secret\"\n};",
  "cedarPolicyJson": { /* Cedar JSON形式 */ }
}
```

**形式検証**:
```bash
POST /policy/verify
{
  "action": "formal-verification",
  "cedarPolicyText": "permit(...)"
}

# レスポンス
{
  "requestId": "uuid",
  "status": "SUCCESS",
  "isValid": true,
  "properties": {
    "safety": true,
    "liveness": true,
    "reachability": true
  }
}
```

**競合検出**:
```bash
POST /policy/conflicts
{
  "action": "detect-conflicts",
  "policies": [
    { "effect": "permit", "action": "read" },
    { "effect": "forbid", "action": "read" }
  ]
}

# レスポンス
{
  "requestId": "uuid",
  "status": "SUCCESS",
  "hasConflicts": true,
  "conflicts": [
    {
      "type": "permit-forbid",
      "affectedPolicies": [0, 1],
      "severity": "high",
      "resolution": "forbidポリシーが優先されます"
    }
  ]
}
```

**ポリシー管理**:
```bash
# ポリシー作成
POST /policy/create
{
  "action": "create-policy",
  "policyData": {
    "name": "document-read-policy",
    "description": "ドキュメント読み取りポリシー",
    "parsedPolicy": { /* 解析結果 */ },
    "cedarPolicyText": "permit(...)"
  }
}

# ポリシー取得
POST /policy/get
{
  "action": "get-policy",
  "policyId": "policy-123"
}

# ポリシー検索
POST /policy/search
{
  "action": "search-policies",
  "filters": {
    "tags": ["document", "read"],
    "status": "active"
  }
}

# ポリシー承認
POST /policy/approve
{
  "action": "approve-policy",
  "policyId": "policy-123",
  "approver": "user@example.com",
  "comment": "承認しました"
}
```

### 🎯 ユースケース

#### ユースケース1: マルチテナントSaaS

**要件**: 複数の顧客（テナント）が同じBedrock Agentを使用するが、データは完全に分離する必要がある

**実装**:
```typescript
// Identity Constructでテナント管理
const identity = new BedrockAgentCoreIdentityConstruct(this, 'Identity', {
  enabled: true,
  abacConfig: {
    enabled: true,
    requiredAttributes: ['tenantId', 'department'],
  },
});

// テナントごとにエージェントIDを作成
// テナントA: agentId = "agent-tenantA-123"
// テナントB: agentId = "agent-tenantB-456"

// ポリシー評価でテナント分離を実現
// テナントAのエージェントは、tenantId="tenantA"のリソースのみアクセス可能
```

#### ユースケース2: エンタープライズ権限管理

**要件**: 部署・プロジェクト・機密度レベルに応じたアクセス制御

**実装**:
```typescript
// Identity ConstructでRBAC + ABAC
const identity = new BedrockAgentCoreIdentityConstruct(this, 'Identity', {
  enabled: true,
  rbacConfig: {
    enabled: true,
    defaultRole: AgentRole.USER,
  },
  abacConfig: {
    enabled: true,
    requiredAttributes: ['department', 'project', 'sensitivity'],
  },
});

// エージェント作成時に属性を設定
// department: "engineering"
// project: "rag-system"
// sensitivity: "confidential"

// ポリシー評価で動的にアクセス制御
// engineering部署 + rag-systemプロジェクト + confidential以上の機密度
```

#### ユースケース3: 外部API統合

**要件**: 既存のREST APIをBedrock Agent Toolとして統合

**実装**:
```typescript
// Gateway ConstructでREST API変換
const gateway = new BedrockAgentCoreGatewayConstruct(this, 'Gateway', {
  enabled: true,
  restApiConfig: {
    enabled: true,
    openApiSpecPath: 's3://my-bucket/openapi.yaml',
  },
});

// OpenAPI仕様から自動的にTool定義を生成
// GET /users/{userId} → get_users_userId Tool
// POST /orders → create_order Tool
```

### 📚 詳細ドキュメント

- **[Bedrock AgentCore実装ガイド](docs/guides/bedrock-agentcore-implementation-guide.md)** - AgentCore機能の詳細な実装ガイド
- **[クイックスタートガイド](docs/guides/quick-start.md)** - AgentCore機能のクイックスタート
- **[FAQ](docs/guides/faq.md)** - AgentCore関連のよくある質問

---

## 🔧 設定永続化システム（v2.6.0）

**実装日**: 2026年1月7日  
**機能**: ユーザー設定のクロスデバイス同期とDynamoDB永続化

### 概要

ユーザーの設定情報（テーマ、リージョン、言語等）をDynamoDBに永続化し、クロスデバイス同期を実現するシステムです。

### 主要機能

#### 設定項目
- **テーマ設定**: ライト/ダーク/システムモード
- **リージョン設定**: デフォルトAWSリージョン
- **言語設定**: UI表示言語（8言語対応）
- **通知設定**: デスクトップ通知、サウンド設定
- **アクセシビリティ設定**: モーション削減、フォーカス表示等

#### 技術アーキテクチャ
- **DynamoDBテーブル**: `permission-aware-rag-preferences`
- **API Routes**: `/api/preferences` (GET/PUT/PATCH/DELETE)
- **フロントエンド**: usePreferencesフック、PreferencesSyncProvider
- **状態管理**: Zustand Store統合

#### AgentCore Memoryとの違い

| 項目 | User Preferences | AgentCore Memory |
|------|-----------------|------------------|
| **目的** | アプリケーション設定の永続化 | 会話履歴・コンテキストの保存 |
| **技術** | 独自DynamoDBテーブル | Amazon Bedrock Agent Runtime |
| **データ** | テーマ、リージョン、言語等 | AIとの対話履歴、会話コンテキスト |
| **制約** | なし（任意の設定データ） | Bedrock Agentの仕様に依存 |
| **同期** | クロスデバイス同期可能 | Agent内でのみ利用 |

**重要**: ユーザー設定データはAgentCore Memoryには保存できません。AgentCore MemoryはAmazon Bedrock Agent Runtimeの機能であり、会話履歴やコンテキストの保存に特化しているためです。

### 使用方法

#### テーマ切り替え
```typescript
import { useThemePreference } from '@/hooks/usePreferencesSync';

const { theme, setThemeWithSync } = useThemePreference();

// テーマ変更（ローカル + DynamoDB保存）
await setThemeWithSync('dark');
```

#### リージョン設定
```typescript
import { useRegionPreference } from '@/hooks/usePreferencesSync';

const { selectedRegion, setRegionWithSync } = useRegionPreference();

// リージョン変更（ローカル + DynamoDB保存）
await setRegionWithSync('us-east-1');
```

### 実装詳細

詳細な実装ガイドは以下を参照してください：
- **[ユーザー設定システムガイド](docs/guides/user-preferences-system-guide.md)** - 設定永続化システムの詳細
- **[フロントエンド開発ガイド](docs/guides/frontend-complete-guide.md)** - フロントエンド実装パターン

---

## 🤖 ハイブリッドアーキテクチャ: Next.js + AgentCore Runtime

**最新更新**: 2026年1月7日  
**アーキテクチャ**: ハイブリッド型（UI/UX + AI処理分離）

このシステムは、**Next.jsアプリケーション**と**Amazon Bedrock AgentCore Runtime**を組み合わせたハイブリッドアーキテクチャを採用しています。

### 🏗️ アーキテクチャ概要

```
┌─────────────────────────────────────────────────────────────────┐
│                        ユーザー                                   │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              Next.js アプリケーション                              │
│           (UI/UX、認証、設定管理、セッション管理)                    │
│  ┌──────────────┬──────────────┬──────────────┬──────────────┐ │
│  │   UI/UX      │    認証      │   設定管理    │ セッション管理 │ │
│  │   コンポーネント │   システム    │   永続化      │   履歴管理    │ │
│  └──────────────┴──────────────┴──────────────┴──────────────┘ │
└────────────────────────┬────────────────────────────────────────┘
                         │ API呼び出し
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│            Amazon Bedrock AgentCore Runtime                      │
│              (AI処理、推論、高度な機能)                            │
│  ┌──────────────┬──────────────┬──────────────┬──────────────┐ │
│  │   Runtime    │   Gateway    │    Memory    │   Browser    │ │
│  │ イベント駆動   │  API統合     │   長期記憶    │  Web自動化   │ │
│  └──────────────┼──────────────┼──────────────┼──────────────┘ │
│  ┌──────────────┬──────────────┬──────────────┬──────────────┐ │
│  │CodeInterpreter│  Identity   │    Policy    │Observability │ │
│  │ コード実行     │   認証認可    │ ポリシー管理  │   監視       │ │
│  └──────────────┴──────────────┴──────────────┴──────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 🎯 役割分担

#### Next.jsアプリケーション（フロントエンド）
- **UI/UX**: レスポンシブデザイン、アクセシビリティ、多言語対応
- **認証システム**: サインイン/サインアウト、セッション管理
- **設定管理**: テーマ、言語、リージョン設定の永続化
- **チャット履歴**: 会話履歴の表示・管理・検索
- **リアルタイム更新**: ストリーミングレスポンス、状態管理

#### AgentCore Runtime（バックエンド）
- **AI処理**: Bedrock Agent、Knowledge Base、推論処理
- **高度な機能**: コード実行、Web自動化、ブラウザ操作
- **データ処理**: ベクトル検索、文書処理、メモリ管理
- **セキュリティ**: 認証認可、ポリシー管理、監査ログ
- **運用機能**: 監視、評価、パフォーマンス測定

### 💡 ハイブリッドアーキテクチャの利点

#### 技術的利点
- ✅ **専門性の分離**: UI/UXとAI処理の最適化を独立して実現
- ✅ **スケーラビリティ**: フロントエンドとバックエンドを独立してスケール
- ✅ **保守性**: 各層の責任が明確で、メンテナンスが容易
- ✅ **拡張性**: 新機能の追加が既存システムに影響しない

#### 運用上の利点
- ✅ **運用負荷の最小化**: 既存のNext.jsアプリケーションを活用
- ✅ **段階的導入**: AgentCore機能を必要に応じて段階的に有効化
- ✅ **コスト効率**: 必要な機能のみを有効化してコスト最適化
- ✅ **開発効率**: フロントエンドとバックエンドの並行開発が可能

### 🚀 実装アプローチ

#### Phase 1: 基盤整備（完了）
- ✅ Next.jsアプリケーションの安定化
- ✅ AgentCore Constructsの実装完了
- ✅ API統合レイヤーの構築

#### Phase 2: 段階的統合（進行中）
- 🔄 AgentCore機能の選択的有効化
- 🔄 フロントエンドからのAPI呼び出し統合
- 🔄 ユーザー体験の最適化

#### Phase 3: 高度な機能統合（計画中）
- ⏳ リアルタイムコラボレーション
- ⏳ 高度な分析・レポート機能
- ⏳ エンタープライズ機能の統合

### 🔧 開発者向け実装ガイド

#### フロントエンド開発者
```typescript
// AgentCore APIの呼び出し例
import { useAgentCore } from '@/hooks/useAgentCore';

const { executeCode, takeScreenshot, searchMemory } = useAgentCore();

// コード実行
const result = await executeCode({
  language: 'python',
  code: 'print("Hello, World!")'
});

// スクリーンショット撮影
const screenshot = await takeScreenshot({
  url: 'https://example.com',
  viewport: { width: 1920, height: 1080 }
});

// メモリ検索
const memories = await searchMemory({
  query: 'プロジェクトの進捗',
  limit: 10
});
```

#### バックエンド開発者
```typescript
// AgentCore Constructの設定例
const agentCore = {
  runtime: { enabled: true },
  memory: { enabled: true },
  browser: { enabled: true },
  codeInterpreter: { enabled: true },
  observability: { enabled: true }
};
```

### 📚 詳細ドキュメント

- **[ハイブリッドアーキテクチャ実装ガイド](docs/guides/agentcore-complete-guide.md)** - 詳細な実装手順
- **[AgentCore統合ガイド](docs/guides/agentcore-complete-guide.md)** - AgentCore機能の統合方法
- **[フロントエンド開発ガイド](docs/guides/frontend-complete-guide.md)** - Next.js開発のベストプラクティス

## 🤖 2つの動作モード

ハイブリッドアーキテクチャ上で、**2つの異なる動作モード**を提供します。

### 📚 KBモード（Knowledge Base Mode）

**概要**: Amazon Bedrock Knowledge Base を使用した、シンプルで高速なRAGモードです。

**特徴**:
- ✅ **フロントエンドでモデル選択**: ユーザーがUIでモデルを自由に選択
- ✅ **動的モデル切り替え**: リクエストごとに異なるモデルを使用可能
- ✅ **リアルタイム対応**: 新しいモデルが追加されても自動的に表示
- ✅ **シンプルなRAG**: 文書検索と回答生成に特化

**使用サービス**:
- Amazon Bedrock Runtime API（直接呼び出し）
- Amazon Bedrock Knowledge Base
- OpenSearch Serverless

**API Endpoint**: `/api/bedrock/chat`

**対応モデル（動的検出）**:
- Anthropic Claude（3.5 Sonnet, 3 Haiku, 3 Opus）
- Amazon Nova（Pro, Lite, Micro）
- Meta Llama（リージョンによる）
- その他、新しいモデルが追加されても自動対応

**動的モデル検出の仕組み**:
1. `/api/bedrock/models/discovery` APIが利用可能なモデルを自動検出
2. プロバイダー情報を自動生成（カラーテーマ、表示名等）
3. DynamoDBにキャッシュ（1時間TTL）
4. フロントエンドに表示

### 🤖 Agentモード（Agent Mode）

**概要**: Amazon Bedrock Agent を使用した、高度な推論とマルチステップ処理が可能なモードです。

**特徴**:
- ✅ **Agent設定でモデル固定**: CDKでAgentを作成時にモデルを指定
- ✅ **高度な推論**: 複雑な問題を段階的に解決
- ✅ **Action Groups**: 外部APIとの連携
- ✅ **Multi-Agent Collaboration**: 複数Agentの協調動作

**使用サービス**:
- Amazon Bedrock Agent Runtime API
- Amazon Bedrock Agent
- Amazon Bedrock Knowledge Base
- Action Groups（Lambda関数）

**API Endpoint**: `/api/bedrock/agent`

**モデル管理**:
- CDK（BedrockAgentDynamicConstruct）で管理
- Parameter Storeに設定保存
- AWS CLIまたはCDKでモデル更新

**動的モデル選択の仕組み（CDK実装）**:
1. `BedrockAgentDynamicConstruct`がリージョン・ユースケースに応じて最適モデルを選択
2. `BedrockModelConfig`が14リージョン対応のモデル設定を管理
3. Parameter Storeに設定を保存
4. Agent作成時に自動的に最適モデルを適用

### 📊 モード比較表

| 項目 | KBモード | Agentモード |
|------|---------|------------|
| **使用サービス** | Bedrock Knowledge Base | Bedrock Agent |
| **モデル選択** | フロントエンドで動的選択 | Agent設定で固定 |
| **モデル切り替え** | リクエストごとに可能 | Agent更新が必要 |
| **API Endpoint** | `/api/bedrock/chat` | `/api/bedrock/agent` |
| **モデル管理** | フロントエンド（動的検出API） | CDK（BedrockAgentDynamicConstruct） |
| **推論方式** | 直接Bedrock Runtime API | Agent経由 |
| **検索機能** | Knowledge Base内蔵 | Agent内蔵 + Action Groups |
| **ユースケース** | シンプルなRAG | 複雑な推論・マルチステップ処理 |
| **新モデル対応** | 自動検出（コード変更不要） | 設定ファイル更新のみ |
| **プロバイダー追加** | 自動対応（コード変更不要） | 設定ファイル更新のみ |

### 🔄 ハイブリッドアーキテクチャでの動的モデル対応

#### 統一されたモデル管理
両モードとも、ハイブリッドアーキテクチャの利点を活用して効率的なモデル管理を実現：

**フロントエンド（Next.js）の役割**:
- モデル選択UI の提供
- ユーザー設定の永続化
- リアルタイムモデル切り替え

**バックエンド（AgentCore Runtime）の役割**:
- モデル互換性チェック
- 推論処理の実行
- パフォーマンス監視

#### KBモード: 完全自動対応

**新しいモデルが追加された場合**:
1. AgentCore Runtime が新しいモデルを検出
2. Next.js フロントエンドが動的にUI更新
3. ユーザーが即座に新モデルを利用可能
4. **コード変更不要**

#### Agentモード: 設定ベース対応

**新しいモデルが追加された場合**:
1. AgentCore Runtime の設定を更新
2. Next.js フロントエンドが設定変更を検知
3. UI に新モデルが自動反映
4. **設定ファイル更新のみ**

### 🚀 使い方

#### KBモード
1. ページ上部の「📚 KB Mode」ボタンをクリック
2. サイドバーでモデルを選択（Claude, Nova等）
3. メッセージを入力して送信
4. 必要に応じてモデルを切り替え（即座に反映）

**モデル切り替え例**:
```
Claude 3.5 Sonnet → Nova Pro → Claude 3 Haiku
（リクエストごとに異なるモデルを使用可能）
```

#### Agentモード
1. ページ上部の「🤖 Agent Mode」ボタンをクリック
2. サイドバーでAgent情報を確認（モデルは固定）
3. メッセージを入力して送信
4. モデル変更が必要な場合は、AWS CLIまたはCDKで更新

**モデル更新方法**:

**方法1: AWS CLI（即座に反映）**
```bash
# Agent情報取得
aws bedrock-agent get-agent \
  --agent-id YOUR_AGENT_ID \
  --region ap-northeast-1

# モデル更新
aws bedrock-agent update-agent \
  --agent-id YOUR_AGENT_ID \
  --agent-name "your-agent-name" \
  --foundation-model "anthropic.claude-3-5-sonnet-20240620-v1:0" \
  --region ap-northeast-1

# Agent準備
aws bedrock-agent prepare-agent \
  --agent-id YOUR_AGENT_ID \
  --region ap-northeast-1
```

**方法2: CDK Deploy（新規環境）**
```bash
# CDKデプロイ
npx cdk deploy --all \
  --app 'npx ts-node --transpile-only bin/deploy-webapp-only.ts'
```

### 📚 詳細ドキュメント

- **[アーキテクチャガイド](docs/ARCHITECTURE.md)** - 2つのモードの詳細なアーキテクチャ説明
- **[動的モデル開発ガイド](docs/guides/agentcore-complete-guide.md)** - 新しいモデル・プロバイダーの追加方法
- **[モデル管理ガイド](docs/guides/deployment-complete-guide.md)** - モデル設定の管理方法

## 🏗️ アーキテクチャ

CloudFrontをエントリーポイントとするサーバーレスアーキテクチャを採用。Lambda関数でAPI処理、DynamoDBでセッション管理、OpenSearch Serverlessでベクトル検索、FSx for ONTAPで高性能ファイルストレージを実現しています。

### アーキテクチャ図

```
┌─────────────────────────────────────────────────────────────────┐
│                        ユーザー                                   │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CloudFront (CDN)                              │
│                  + Lambda@Edge (認証)                            │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              Lambda Function URL (HTTPS)                         │
│                  + Lambda Web Adapter                            │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│         Lambda Function (Container - Next.js 14)                 │
│              Runtime: Node.js 20.x                               │
│              VPC配置: 設定可能（VPC内/VPC外）                    │
│  ┌──────────────┬──────────────┬──────────────┬──────────────┐ │
│  │ Chat Handler │ Auth Handler │ Doc Processor│ RAG Generator│ │
│  └──────────────┴──────────────┴──────────────┴──────────────┘ │
└────────┬────────────┬────────────┬────────────┬────────────────┘
         │            │            │            │
         ▼            ▼            ▼            ▼
┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────────┐
│  DynamoDB  │ │  Bedrock   │ │ OpenSearch │ │ FSx for ONTAP  │
│ (Session)  │ │  (Claude)  │ │ Serverless │ │ (Documents)    │
│ VPC EP可能 │ │ VPC EP可能 │ │            │ │                │
└────────────┘ └────────────┘ └────────────┘ └────────────────┘
```

**アーキテクチャの特徴**:
- **API Gateway不要**: Lambda Function URLを直接使用することで、シンプルかつ低コストな構成を実現
- **Lambda Web Adapter**: Next.jsアプリケーションをLambdaで実行するための変換レイヤー
- **コンテナベース**: ECRからコンテナイメージをデプロイ、柔軟な依存関係管理
- **Response Streaming**: Lambda Function URLのストリーミング機能を活用した高速レスポンス
- **柔軟なVPC配置**: Lambda関数をVPC内外に配置可能、VPC Endpointで最適化

### 🌐 Lambda VPC配置オプション

このシステムは、Lambda関数のVPC配置を柔軟に設定できます。

#### VPC外配置（デフォルト）

**特徴**:
- ✅ **シンプルな構成**: VPC設定不要
- ✅ **低コスト**: VPC Endpoint料金不要
- ✅ **高速起動**: Cold Start時間が短い
- ✅ **インターネット経由**: パブリックエンドポイント経由でAWSサービスにアクセス

**設定例**:
```typescript
lambda: {
  vpc: {
    enabled: false, // VPC外に配置（デフォルト）
  },
}
```

**推奨用途**:
- 開発環境
- プロトタイピング
- コスト最適化が優先される場合

#### VPC内配置（推奨）

**特徴**:
- ✅ **セキュリティ強化**: プライベートネットワーク内で動作
- ✅ **データ主権**: データがVPC外に出ない
- ✅ **低レイテンシ**: VPC Endpoint経由で直接アクセス
- ✅ **コンプライアンス**: 規制要件に対応

**設定例**:
```typescript
lambda: {
  vpc: {
    enabled: true, // VPC内に配置
    endpoints: {
      dynamodb: true,           // 無料
      bedrockRuntime: true,     // $7.2/月
      bedrockAgentRuntime: true, // $7.2/月
    },
  },
}
```

**VPC Endpoint料金**:
- **DynamoDB**: 無料（Gateway Endpoint）
- **Bedrock Runtime**: $7.2/月（Interface Endpoint）
- **Bedrock Agent Runtime**: $7.2/月（Interface Endpoint）
- **合計**: $14.4/月（Bedrock使用時）

**推奨用途**:
- 本番環境
- セキュリティ要件が高い場合
- コンプライアンス対応が必要な場合

#### VPC配置の切り替え方法

**Step 1: 設定ファイルを編集**

```typescript
// lib/config/environments/webapp-standalone-config.ts
export const webAppConfig: WebAppStackConfig = {
  lambda: {
    vpc: {
      enabled: true, // VPC内に配置
      endpoints: {
        dynamodb: true,
        bedrockRuntime: true,
        bedrockAgentRuntime: true,
      },
    },
  },
};
```

**Step 2: CDKデプロイ**

```bash
npx cdk deploy --all
```

**Step 3: 動作確認**

```bash
# Lambda関数のVPC設定を確認
aws lambda get-function-configuration \
  --function-name YOUR_FUNCTION_NAME \
  --query 'VpcConfig' \
  --output json

# VPC Endpointの確認
aws ec2 describe-vpc-endpoints \
  --filters "Name=vpc-id,Values=YOUR_VPC_ID" \
  --query 'VpcEndpoints[*].[ServiceName,State]' \
  --output table
```

#### VPC配置の比較表

| 項目 | VPC外配置 | VPC内配置 |
|------|----------|----------|
| **セキュリティ** | 標準 | 強化 |
| **コスト** | 低（$0/月） | 中（$14.4/月） |
| **Cold Start** | 高速（~1秒） | やや遅い（~2秒） |
| **レイテンシ** | 標準 | 低（VPC EP経由） |
| **設定複雑度** | 低 | 中 |
| **推奨環境** | 開発・プロトタイプ | 本番・コンプライアンス |

詳細は[Lambda VPC配置ガイド](docs/guides/deployment-complete-guide.md)を参照してください。

### モジュラーアーキテクチャ

このプロジェクトは**9つの機能別モジュール**と**6つの統合CDKスタック**で構成されています：

#### 9つの機能別モジュール

```
lib/modules/
├── networking/     # VPC・サブネット・ゲートウェイ・セキュリティグループ
├── security/       # IAM・KMS・WAF・GuardDuty・コンプライアンス
├── storage/        # FSx・バックアップ・ライフサイクル
├── database/       # DynamoDB・OpenSearch・RDS・移行・監視
├── embedding/      # Embedding処理・Batch・ベクトル化・パイプライン
├── ai/             # Bedrock・LLM・Model・推論・チャット
├── api/            # API Gateway・Cognito・CloudFront・認証
├── monitoring/     # CloudWatch・X-Ray・SNS・ログ・アラート
└── enterprise/     # アクセス制御・BI・組織管理・コンプライアンス
```

#### 6つの統合CDKスタック

```
lib/stacks/integrated/
├── networking-stack.ts   # ネットワーク基盤（VPC、サブネット、SG）
├── security-stack.ts     # セキュリティ統合（IAM、KMS、WAF）
├── data-stack.ts         # データ・ストレージ統合（DynamoDB、OpenSearch、FSx）
├── embedding-stack.ts    # Embedding・コンピュート・AI統合（Batch、Lambda、Bedrock）
├── webapp-stack.ts       # API・フロントエンド統合（API Gateway、CloudFront、Lambda）
├── fsx-integration-stack.ts  # FSx統合（FSx + Serverless統合）← 新規追加
└── operations-stack.ts   # 監視・エンタープライズ統合（CloudWatch、SNS、X-Ray）
```

**スタック間の依存関係**:
```
NetworkingStack (基盤)
    ↓
SecurityStack
    ↓
DataStack
    ↓
EmbeddingStack
    ↓
WebAppStack (スタンドアローンモード対応)
    ↓
FsxIntegrationStack (FSx統合) ← 新規追加
    ↓
OperationsStack
```

### 主要コンポーネント

- **フロントエンド**: Next.js 14.2.16 (App Router)
- **バックエンド**: AWS Lambda (Node.js 20.x)
- **データベース**: Amazon DynamoDB, OpenSearch Serverless
- **ストレージ**: Amazon FSx for ONTAP
- **AI/ML**: Amazon Bedrock (Claude, Nova Pro等)
- **CDN**: Amazon CloudFront
- **IaC**: AWS CDK v2 (TypeScript)

## 📋 前提条件

- **Node.js**: 20.x以上
- **AWS CDK**: 2.129.0以上
- **AWS CLI**: 最新版
- **Docker**: コンテナビルド用
- **AWS アカウント**: 適切な権限を持つアカウント

## 🚀 クイックスタート

### 1. リポジトリのクローン

```bash
git clone https://github.com/Yoshiki0705/RAG-FSxN-CDK.git
cd RAG-FSxN-CDK
```

### 2. 依存関係のインストール

```bash
npm install
```

### 3. AWS CDKのブートストラップ

```bash
npx cdk bootstrap
```

### 4. Bedrock Agent環境変数の自動設定（推奨）

デプロイ後、Bedrock Agent情報を自動的にLambda関数の環境変数に設定するスクリプトを実行します：

```bash
# デフォルト実行（東京リージョン）
./development/scripts/fixes/auto-update-agent-env-vars.sh

# カスタムリージョン・スタック
./development/scripts/fixes/auto-update-agent-env-vars.sh <region> <stack-prefix>

# 例: US East 1リージョン
./development/scripts/fixes/auto-update-agent-env-vars.sh us-east-1 USEast1-permission-aware-rag-prod
```

**自動設定される環境変数**:
- `BEDROCK_AGENT_ID`: Agent ID
- `BEDROCK_AGENT_ALIAS_ID`: Agent Alias ID
- `DYNAMODB_TABLE_NAME`: ユーザーアクセステーブル名
- `PERMISSION_CACHE_TABLE_NAME`: 権限キャッシュテーブル名

このスクリプトは、Bedrock Agent情報を自動取得し、Lambda関数の環境変数を更新します。手動設定は不要です。

### 5. Bedrock Agent管理権限の設定

**v2.4.0以降**: Bedrock Agentの作成・削除・管理権限がCDKで自動的に設定されます。

**付与される権限**:
- Agent作成・削除・更新
- Agent Alias管理
- Action Group管理
- Knowledge Base関連付け
- IAM PassRole（Agent作成時のサービスロール設定）

**CDKデプロイ時に自動設定**:
```bash
# WebAppStackデプロイ時に自動的に権限が付与されます
npx cdk deploy WebAppStack
```

**手動で権限を確認する場合**:
```bash
# IAMロールの確認
aws iam get-role \
  --role-name TokyoRegion-permission-aware-rag-prod-WebApp-Execution-Role \
  --region ap-northeast-1

# インラインポリシーの確認
aws iam list-role-policies \
  --role-name TokyoRegion-permission-aware-rag-prod-WebApp-Execution-Role \
  --region ap-northeast-1
```

詳細は[デプロイメントガイド](docs/guides/deployment-complete-guide.md#bedrock-agent管理権限)を参照してください。

### 6. デプロイ

このプロジェクトは、**6スタック統合デプロイ**と**WebAppスタンドアローンデプロイ**の2つのデプロイモードをサポートしています。

#### 6スタック統合デプロイ（推奨）

本番環境や完全な機能が必要な場合は、6スタック統合デプロイを使用します：

```bash
# 全6スタックのデプロイ（推奨）
npx cdk deploy --all

# または環境変数でデプロイモードを指定
DEPLOY_MODE=production npx cdk deploy --all  # 本番レベル統合版（デフォルト）
DEPLOY_MODE=full npx cdk deploy --all        # 完全6スタック構成
DEPLOY_MODE=minimal npx cdk deploy --all     # 最小構成（NetworkingStack + DataStack）

# 特定のスタックのみデプロイ
npx cdk deploy TokyoRegion-permission-aware-rag-prod-Networking
npx cdk deploy TokyoRegion-permission-aware-rag-prod-Security
npx cdk deploy TokyoRegion-permission-aware-rag-prod-Data
npx cdk deploy TokyoRegion-permission-aware-rag-prod-Embedding
npx cdk deploy TokyoRegion-permission-aware-rag-prod-WebApp
npx cdk deploy TokyoRegion-permission-aware-rag-prod-FsxIntegration  # FSx統合スタック
npx cdk deploy TokyoRegion-permission-aware-rag-prod-Operations
```

**6スタック統合デプロイの特徴**:
- 全6スタックが連携して動作
- 本番環境に最適
- 完全な監視・セキュリティ機能
- スタック間の依存関係を自動管理
- `cdk.json`のデフォルト設定（`bin/deploy-all-stacks.ts`）

#### WebAppスタック スタンドアローンデプロイ

開発環境やプロトタイピング、WebAppのみの更新が必要な場合は、スタンドアローンデプロイを使用します：

```bash
# スタンドアローンモードでデプロイ（2スタックのみ）
npx cdk deploy --all --app 'npx ts-node bin/deploy-webapp-with-permission-api.ts'

# または専用スクリプトを使用（推奨）
./development/scripts/deployment/deploy-webapp-standalone.sh
```

**スタンドアローンモードの特徴**:
- ✅ **独立デプロイ**: 他のスタック（Networking, Security等）に依存しない
- ✅ **自動リソース作成**: 必要なリソース（VPC、セキュリティグループ、IAMロール、ECRリポジトリ）を自動作成
- ✅ **既存リソース参照**: 既存のVPC・セキュリティグループを参照することも可能
- ✅ **ECRリポジトリの統一処理**（統合モードと完全に同じロジック）:
  - 既存リポジトリが存在する場合: 自動的に参照して使用
  - 既存リポジトリが存在しない場合: 新規作成（セキュリティスキャン・ライフサイクルルール付き）
  - **Dockerビルド・プッシュは実行されない**（手動プッシュが必要）
  - モードに関係なく同じ処理フローで動作（約98%のデプロイ時間削減）
- ✅ **迅速なデプロイ**: 約5分でデプロイ完了
- ✅ **開発に最適**: プロトタイピングや開発環境に最適

**スタンドアローンモードの設定**:

```typescript
// bin/deploy-webapp-with-permission-api.ts
// 2スタック構成（DataStack + WebAppStack）
const dataStack = new DataStack(app, 'TokyoRegion-PermissionAwareRAG-DataStack', {
  env,
  config: { storage: ..., database: ... },
  projectName: 'permission-aware-rag',
  environment: 'prod',
});

const webAppStack = new WebAppStack(app, 'TokyoRegion-PermissionAwareRAG-WebAppStack', {
  env,
  config: webAppConfig,
  projectName: 'permission-aware-rag',
  environment: 'prod',
  standaloneMode: true, // スタンドアローンモード
  userAccessTable: dataStack.userAccessTable,
  permissionCacheTable: dataStack.permissionCacheTable,
});

webAppStack.addDependency(dataStack);
```

**環境変数の設定**:

```bash
# スタンドアローンモードでデプロイ（2スタック）
npx cdk deploy --all --app 'npx ts-node bin/deploy-webapp-with-permission-api.ts'

# 既存リソースを使用する場合（オプション）
export EXISTING_VPC_ID=vpc-12345678
export EXISTING_SG_ID=sg-12345678

# 新規リソースを自動作成する場合（環境変数不要）
# スタンドアローンモードが自動的に最小限のリソースを作成します
```

#### デプロイモードの選択ガイド

| 用途 | デプロイモード | コマンド |
|------|--------------|---------|
| 本番環境 | 6スタック統合（production） | `npx cdk deploy --all` |
| 完全な機能テスト | 6スタック統合（full） | `DEPLOY_MODE=full npx cdk deploy --all` |
| 開発環境 | 6スタック統合（minimal） | `DEPLOY_MODE=minimal npx cdk deploy --all` |
| プロトタイピング | スタンドアローン（2スタック） | `npx cdk deploy --all --app 'npx ts-node bin/deploy-webapp-with-permission-api.ts'` |
| WebAppのみ更新 | スタンドアローン（2スタック） | `./development/scripts/deployment/deploy-webapp-standalone.sh` |

**重要**: `npx cdk deploy --all`は`cdk.json`のデフォルト設定（`bin/deploy-all-stacks.ts`）を使用し、6スタック全てをデプロイします。

詳細は[デプロイメントガイド](docs/guides/deployment-complete-guide.md)を参照してください。

### 7. DataStackデプロイの重要な注意事項

DataStack（FSx + DynamoDB）をデプロイする際は、以下の重要なポイントに注意してください。

#### TypeScript直接実行（必須）

**問題**: `npm run build`でコンパイルしたJavaScriptファイルを実行すると、古いバージョンが実行される可能性があります。

**解決**: `npx ts-node`を使用してTypeScriptを直接実行してください。

```bash
# ❌ 悪い例: 古いJavaScriptファイルが実行される可能性
npx cdk deploy --app 'node bin/deploy-production.js'

# ✅ 良い例: 最新のTypeScriptファイルが実行される
npx cdk deploy --app 'npx ts-node bin/deploy-production.ts'
```

#### FSx for ONTAPサブネット要件

FSx for ONTAPのデプロイメントタイプによって、必要なサブネット数が異なります。

| デプロイメントタイプ | 必要なサブネット数 | 説明 |
|-------------------|-----------------|------|
| `SINGLE_AZ_1` | **1つ** | 単一AZにデプロイ、コスト効率的 |
| `MULTI_AZ_1` | **2つ** | 2つのAZにデプロイ、高可用性 |

**エラー例**: "Exactly 1 subnet IDs are required for SINGLE_AZ_1"

**解決**: デプロイメントタイプに応じてサブネット数を動的に決定する実装が既に組み込まれています。

#### OpenSearch条件チェック

**問題**: `if (props.config.openSearch?.enabled)`では`false`と`undefined`を区別できません。

**解決**: `if (props.config.openSearch?.enabled === true)`で明示的にチェックする実装が既に組み込まれています。

#### 既存VPCインポート時の型安全性

**問題**: 既存VPCをインポートする場合は`IVpc`型を返しますが、`this.vpc`が`Vpc`型で宣言されていると型エラーが発生します。

**解決**: `this.vpc`の型を`IVpc`に変更する実装が既に組み込まれています。

#### リソース競合チェック（推奨）

DataStackデプロイ前に、リソース競合チェックを実行することを推奨します。

```bash
# 競合チェック + 自動修復 + デプロイ
./development/scripts/deployment/deploy-with-conflict-check.sh \
  TokyoRegion-permission-aware-rag-prod-Data --auto-fix
```

詳細は[デプロイメントガイド - リソース競合チェック](docs/guides/deployment-complete-guide.md#7-リソース競合チェックcdkデプロイ時)を参照してください。

---

### 7. リソース競合チェック（CDKデプロイ時）

CDKスタックをデプロイする際、既存リソースとの競合を事前に検出・防止するツールを提供しています。

#### 問題の背景

CloudFormationの`AWS::EarlyValidation::ResourceExistenceCheck`フックにより、既存リソースとの競合が検出されるとデプロイが失敗します。

**典型的なエラー**:
```
Failed to create ChangeSet: FAILED, The following hook(s)/validation failed: 
[AWS::EarlyValidation::ResourceExistenceCheck]
```

**主な原因**:
- DynamoDBテーブル名の重複
- CloudFormationスタックの問題のある状態（ROLLBACK_COMPLETE等）
- 既存リソースとの名前衝突

#### 推奨デプロイフロー

**フロー1: 自動修復デプロイ（推奨）**

```bash
# 統合スクリプトで自動修復 + デプロイ
./development/scripts/deployment/deploy-with-conflict-check.sh \
  TokyoRegion-permission-aware-rag-prod-Data --auto-fix

# 期待される動作:
# - 競合チェック実行
# - 競合が検出された場合、ユーザー確認後に自動削除
# - CDKデプロイ実行
# - デプロイ後確認
```

**フロー2: 手動確認デプロイ**

```bash
# 1. 競合チェックのみ実行
npx ts-node development/scripts/deployment/pre-deploy-check.ts \
  --stack-name TokyoRegion-permission-aware-rag-prod-Data

# 2. 競合があれば手動で解決
aws dynamodb delete-table --table-name prod-permission-cache
aws dynamodb delete-table --table-name prod-user-access-table

# 3. CDKデプロイ
npx cdk deploy TokyoRegion-permission-aware-rag-prod-Data \
  --app 'npx ts-node bin/data-stack-app.ts' \
  --require-approval never
```

#### 利用可能なツール

1. **リソース競合ハンドラー**（CDKコード内）
   - ファイル: `lib/utils/resource-conflict-handler.ts`
   - CDK Aspectとして`bin/data-stack-app.ts`に統合済み

2. **デプロイ前チェックスクリプト**
   ```bash
   # チェックのみ
   npx ts-node development/scripts/deployment/pre-deploy-check.ts \
     --stack-name TokyoRegion-permission-aware-rag-prod-Data
   
   # 自動修復
   npx ts-node development/scripts/deployment/pre-deploy-check.ts \
     --stack-name TokyoRegion-permission-aware-rag-prod-Data \
     --auto-fix
   ```

3. **統合デプロイスクリプト**
   ```bash
   # 自動修復してデプロイ
   ./development/scripts/deployment/deploy-with-conflict-check.sh \
     TokyoRegion-permission-aware-rag-prod-Data --auto-fix
   
   # ドライラン
   ./development/scripts/deployment/deploy-with-conflict-check.sh \
     TokyoRegion-permission-aware-rag-prod-Data --auto-fix --dry-run
   ```

---

## 🤖 Amazon Bedrock AgentCoreデプロイメント

### AgentCore機能の有効化/無効化

Amazon Bedrock AgentCoreの9つの機能は、`cdk.context.json`で個別に有効化/無効化できます。

#### クイックスタート

```bash
# 1. 設定ファイルを選択
cp cdk.context.json.minimal cdk.context.json      # 最小限の設定（開発環境向け）
cp cdk.context.json.example cdk.context.json      # 完全な設定（検証環境向け）
cp cdk.context.json.production cdk.context.json   # 本番推奨設定（本番環境向け）

# 2. デプロイ実行
npx cdk deploy --all -c imageTag=agentcore-$(date +%Y%m%d-%H%M%S)

# 3. デプロイ後の確認
aws cloudformation describe-stacks \
  --stack-name TokyoRegion-permission-aware-rag-prod-WebApp \
  --query 'Stacks[0].Outputs' \
  --region ap-northeast-1
```

#### AgentCore機能一覧

| 機能 | スタック | 説明 | 設定キー |
|------|---------|------|---------|
| Runtime | WebAppStack | イベント駆動実行 | `agentCore.runtime.enabled` |
| Gateway | WebAppStack | API/Lambda/MCP統合 | `agentCore.gateway.enabled` |
| Memory | WebAppStack | 長期記憶（フルマネージド） | `agentCore.memory.enabled` |
| Browser | WebAppStack | Web自動化 | `agentCore.browser.enabled` |
| CodeInterpreter | WebAppStack | コード実行 | `agentCore.codeInterpreter.enabled` |
| Identity | SecurityStack | 認証・認可 | `agentCore.identity.enabled` |
| Policy | SecurityStack | ポリシー管理 | `agentCore.policy.enabled` |
| Observability | OperationsStack | 監視・トレーシング | `agentCore.observability.enabled` |
| Evaluations | OperationsStack | 評価・テスト | `agentCore.evaluations.enabled` |

#### 設定例

**最小限の設定（開発環境向け）**:
```json
{
  "agentCore": {
    "runtime": { "enabled": true },
    "memory": { "enabled": true }
  }
}
```

**本番推奨設定**:
```json
{
  "agentCore": {
    "runtime": {
      "enabled": true,
      "lambdaConfig": {
        "provisionedConcurrentExecutions": 2
      }
    },
    "gateway": { "enabled": true },
    "memory": { "enabled": true },
    "identity": { "enabled": true },
    "policy": { "enabled": true },
    "observability": { "enabled": true },
    "evaluations": { "enabled": true }
  }
}
```

### 詳細ガイド

- **[AgentCoreデプロイメントガイド](docs/guides/agentcore-deployment-guide.md)** - 詳細なデプロイメント手順、トラブルシューティング、ロールバック手順
- **[AgentCore実装ガイド](docs/guides/bedrock-agentcore-implementation-guide.md)** - 各機能の実装詳細、設定オプション、使用例

---



### 主要ガイド
- **[デプロイメントガイド（統合版）](docs/guides/deployment-complete-guide.md)** - 統合デプロイメント手順（Phase 0.8知見反映）
- **[デバッグ・トラブルシューティングガイド](docs/guides/debugging-complete-guide.md)** - Phase 0.8実装・デバッグ経験を基にした包括的な問題解決ガイド 🆕
- **[Chrome DevToolsテストガイド](docs/guides/debugging-complete-guide.md)** - Phase 0.8で実証されたChrome DevToolsを活用したテスト手順 🆕

### 🎯 Phase 0.8 デバッグ・実装で得られた重要な知見

**10時間以上のデバッグ作業から学んだ教訓**:

#### 1. UI要素表示問題の根本原因と解決策
- **問題**: Agent作成ボタンが表示されない
- **根本原因**: ECRプッシュ権限エラーによる最新イメージの未反映
- **解決策**: 段階的デバッグ手順とLambda関数の強制更新
- **予防策**: デプロイ前のECR認証確認とビルド検証

#### 2. Chrome DevToolsを活用した効率的なデバッグ
- **DOM要素の存在確認**: `document.querySelectorAll('button').length`
- **React DevToolsでの状態確認**: コンポーネントプロパティとフックの監視
- **API通信の監視**: Network パネルでのリアルタイム確認
- **カスタムイベントでのテスト**: `window.dispatchEvent(new CustomEvent('test'))`

#### 3. 安全なデプロイメントフロー
- **必須手順**: ローカル修正 → EC2同期 → EC2ビルド → デプロイ → 検証
- **検証ポイント**: Lambda関数の最終更新時刻、CloudFrontキャッシュ、API応答
- **緊急時対応**: Lambda関数の強制更新とCloudFrontキャッシュ無効化

#### 4. 開発効率化のベストプラクティス
- **デバッグログの標準化**: 構造化されたログ出力とタイムスタンプ
- **data-testid属性の活用**: テスト・デバッグ用のID属性を必ず追加
- **段階的問題解決**: 基本確認 → デバッグ強化 → 根本的解決の3段階アプローチ

### 📖 完全ガイド（統合版）

#### AgentCore関連
- **[AgentCore完全ガイド](docs/guides/agentcore-complete-guide.md)** - AgentCoreの全機能（デプロイ、運用、テスト、ユーザーガイド、チュートリアル）
- **[AgentCoreセキュリティ・運用ガイド](docs/guides/agentcore-security-operations-guide.md)** - セキュリティベストプラクティス、インシデント対応、脆弱性管理
- **[AgentCore監視・トラブルシューティング](docs/guides/agentcore-monitoring-troubleshooting-guide.md)** - 監視・アラート、トラブルシューティング、FAQ（50問）

#### デプロイメント・開発
- **[デプロイメント完全ガイド](docs/guides/deployment-complete-guide.md)** - CDKデプロイ、Lambda VPC統合、環境設定、トラブルシューティング
- **[フロントエンド完全ガイド](docs/guides/frontend-complete-guide.md)** - Next.js/React開発、UI/UX、テーマ実装、TypeScript型安全性
- **[デバッグ完全ガイド](docs/guides/debugging-complete-guide.md)** - Chrome DevTools MCP、トラブルシューティング、Agent選択イベント

#### FSx統合・運用
- **[FSx統合完全ガイド](docs/guides/fsx-integration-complete-guide.md)** - FSx for ONTAP + S3統合、Access Points、マルチリージョン対応
- **[運用・設定ガイド](docs/guides/operations-configuration-guide.md)** - 運用・メンテナンス、Observability、Policy、Evaluations設定
- **[ユーザー設定完全ガイド](docs/guides/user-preferences-complete-guide.md)** - DynamoDB永続化、クロスデバイス同期、API仕様、CDK実装

### 📚 専門ガイド

#### 基本ガイド
- **[クイックスタート](docs/guides/quick-start.md)** - 初めての方向けガイド
- **[FAQ](docs/guides/faq.md)** - よくある質問と回答

#### Bedrock関連
- **[Bedrock Knowledge Baseガイド](docs/guides/bedrock-knowledge-base-guide.md)** - Knowledge Base設定と管理
- **[Bedrockモデルアダプターガイド](docs/guides/bedrock-model-adapters-guide.md)** - モデルアダプター実装

#### その他
- **[コスト配分タグガイド](docs/guides/cost-allocation-tagging-guide.md)** - コスト管理とタグ戦略
- **[モジュール開発ガイド（日本語）](docs/guides/module-development-guide-ja.md)** - モジュール開発方法
- **[モジュール開発ガイド（英語）](docs/guides/module-development-guide-en.md)** - Module Development Guide
- **[マルチリージョンデプロイメントガイド](docs/guides/deployment-complete-guide.md)** - 14リージョン対応、自動フォールバック機能

### 🗂️ その他のドキュメント
- **[アーキテクチャ](docs/architecture/ARCHITECTURE.md)** - システムアーキテクチャの詳細
- **[ドキュメント索引](docs/DOCUMENTATION_INDEX.md)** - 全ドキュメント一覧

```
Permission-aware-RAG-FSxN-CDK/
├── lib/                          # CDKライブラリ（モジュラー構成）
│   ├── modules/                  # 機能別モジュール（9モジュール）
│   │   ├── networking/           # VPC・サブネット・セキュリティグループ
│   │   ├── security/             # IAM・KMS・WAF・GuardDuty
│   │   ├── storage/              # FSx・バックアップ
│   │   ├── database/             # DynamoDB・OpenSearch・RDS
│   │   ├── embedding/            # Embedding処理・Batch・ベクトル化
│   │   ├── ai/                   # Bedrock・LLM・Model・推論
│   │   ├── api/                  # API Gateway・Cognito・CloudFront
│   │   ├── monitoring/           # CloudWatch・X-Ray・SNS・ログ
│   │   ├── enterprise/           # アクセス制御・BI・組織管理
│   │   └── integration/          # FSx統合モジュール ← 新規追加
│   │       └── constructs/       # FSx統合コンストラクト
│   ├── stacks/integrated/        # 統合CDKスタック（7スタック）
│   │   ├── networking-stack.ts   # ネットワーク基盤
│   │   ├── security-stack.ts     # セキュリティ統合
│   │   ├── data-stack.ts         # データ・ストレージ統合
│   │   ├── embedding-stack.ts    # Embedding・コンピュート・AI統合
│   │   ├── webapp-stack.ts       # API・フロントエンド統合（スタンドアローン対応）
│   │   ├── fsx-integration-stack.ts  # FSx統合スタック ← 新規追加
│   │   └── operations-stack.ts   # 監視・エンタープライズ統合
│   ├── constructs/               # 再利用可能なコンストラクト
│   └── config/                   # 設定管理
│       ├── interfaces/           # 型定義
│       │   ├── webapp-stack-config.ts  # WebAppスタック設定型定義
│       │   └── environment-config.ts   # 環境設定型定義（FSx統合対応）
│       └── environments/         # 環境別設定（14リージョン対応）
│           ├── webapp-standalone-config.ts  # WebAppスタンドアローン設定
│           ├── tokyo-development-config.ts  # 東京開発環境（FSx統合対応）
│           └── tokyo-production-config.ts   # 東京本番環境（FSx統合対応）
├── bin/                          # CDKエントリーポイント
│   ├── deploy-all-stacks.ts     # 全スタックデプロイ（統合モード、FSx統合対応）
│   └── deploy-webapp.ts         # WebAppスタンドアローンデプロイ
├── lambda/                       # Lambda関数コード
├── docker/                       # コンテナ定義
│   └── nextjs/                   # Next.jsアプリケーション
├── docs/                         # 公開ドキュメント
│   ├── guides/                   # ガイドドキュメント
│   ├── architecture/             # アーキテクチャドキュメント
│   ├── FSx統合システムIaC実装ガイド.md      # FSx統合実装ガイド ← 新規追加
│   ├── FSx統合システム業界別ユースケース.md  # 業界別ユースケース ← 新規追加
│   └── FSx統合システム技術価値と展開.md     # 技術価値と展開 ← 新規追加
├── development/                  # 開発環境固有ファイル
│   ├── scripts/                  # 開発スクリプト
│   │   └── deployment/           # デプロイスクリプト
│   │       ├── deploy-webapp-standalone.sh  # WebAppスタンドアローンデプロイ
│   │       └── deploy-webapp-on-ec2.sh      # EC2上でのWebAppデプロイ
│   └── docs/                     # 開発ドキュメント
└── tests/                        # テストコード
    └── unit/                     # 単体テスト
        └── stacks/               # スタックテスト
            ├── webapp-stack-standalone.test.ts  # スタンドアローンモードテスト
            ├── webapp-stack-integrated.test.ts  # 統合モードテスト
            └── fsx-integration-stack.test.ts    # FSx統合スタックテスト ← 新規追加
```

## 🔧 開発

### ローカル開発

```bash
# TypeScriptビルド
npm run build

# 開発用ウォッチモード
npm run watch

# テスト実行
npm test

# CDK差分確認
npx cdk diff
```

### 統合テスト

このプロジェクトには、2種類の統合テストが含まれています：

1. **全スタック統合テスト**: WebAppStack以外の5つのスタック（NetworkingStack、SecurityStack、DataStack、EmbeddingStack、OperationsStack）の統合テスト
2. **Permission-aware統合テスト**: FSx for ONTAPを使用したPermission-aware RAGシステムの統合テストとUIの動的権限表示機能のテスト（開発中）

#### 全スタック統合テスト実行方法

```bash
# 方法1: スクリプトで実行（推奨）
./development/scripts/testing/run-integration-tests.sh ap-northeast-1

# 方法2: npm scriptで実行
export AWS_REGION=ap-northeast-1
npm run test:integration:full-stack

# 方法3: Jestで直接実行
export AWS_REGION=ap-northeast-1
npx jest tests/integration/full-stack-integration.test.ts --verbose
```

#### Permission-aware統合テスト（開発中）

FSx for ONTAPを使用したPermission-aware RAGシステムの統合テストです。以下の機能をテストします：

- **FSx for ONTAPデータアクセステスト**: ドキュメントのアップロード・取得・権限確認
- **Embedding処理の権限管理テスト**: 権限メタデータの保存と検索結果のフィルタリング
- **UIの動的権限表示テスト**: ユーザー権限に基づく動的なディレクトリ表示
- **バックエンドAPI実装**: `/api/user/permissions` エンドポイント
- **パフォーマンステスト**: 権限チェックのレスポンスタイムと並行処理
- **エラーハンドリングテスト**: FSx障害時の動作とリトライ処理

詳細は[Permission-aware統合テスト仕様書](.kiro/specs/permission-aware-integration-testing/requirements.md)を参照してください。

#### テスト対象

統合テストでは、以下の22のテストケースを実行します：

1. **NetworkingStack** (5テスト)
   - スタックデプロイ状態確認
   - VPC作成確認
   - パブリック/プライベートサブネット作成確認
   - セキュリティグループ作成確認

2. **SecurityStack** (3テスト)
   - スタックデプロイ状態確認
   - KMSキー作成確認
   - IAMロール作成確認

3. **DataStack** (3テスト)
   - スタックデプロイ状態確認
   - FSx for ONTAP作成確認
   - DynamoDBテーブル作成確認

4. **EmbeddingStack** (4テスト)
   - スタックデプロイ状態確認
   - Embedding Lambda関数作成確認
   - Lambda関数実行可能性確認
   - Bedrockモデル情報出力確認

5. **OperationsStack** (3テスト)
   - スタックデプロイ状態確認
   - CloudWatchアラーム作成確認（オプション）
   - SNSトピック作成確認（オプション）

6. **スタック間連携** (4テスト)
   - NetworkingStack → DataStack連携確認
   - SecurityStack → DataStack連携確認
   - DataStack → EmbeddingStack連携確認
   - 全スタック正常連携確認

詳細は[統合テスト実行ガイド](docs/guides/debugging-complete-guide.md)を参照してください。

### Next.jsアプリケーション

```bash
cd docker/nextjs

# 依存関係インストール
npm install

# 開発サーバー起動
npm run dev

# ビルド
npm run build
```

## 🌍 マルチリージョン対応

このプロジェクトは複数のAWSリージョンに対応しています：

- **東京リージョン** (ap-northeast-1) - デフォルト
- **大阪リージョン** (ap-northeast-3)
- **その他のリージョン** - 設定ファイルで指定可能

## 🔒 セキュリティ

- **IAM権限管理**: 最小権限の原則に基づく設定
- **データ暗号化**: 保存時・転送時の暗号化
- **WAF統合**: Web Application Firewall による保護
- **VPC分離**: ネットワークレベルでの分離

## 📊 モニタリング

- **CloudWatch Logs**: アプリケーションログ
- **CloudWatch Metrics**: パフォーマンスメトリクス
- **X-Ray**: 分散トレーシング
- **CloudWatch Alarms**: アラート設定

## 📋 依存関係とセキュリティ

### 主要依存関係

#### CDK関連
- `aws-cdk`: 2.1033.0（最新CLI）
- `aws-cdk-lib`: 2.228.0（セキュリティ脆弱性修正済み）
- `constructs`: ^10.3.0
- `cdk-nag`: 2.37.55（セキュリティルール最新版）
- `cdk-docker-image-deployment`: 0.0.932（脆弱性修正済み）

#### 開発環境
- `typescript`: ~5.5.3
- `ts-node`: ^10.9.2
- `@types/node`: 20.16.13

### セキュリティ品質指標

- ✅ **セキュリティ脆弱性**: 0件
- ✅ **TypeScriptビルドエラー**: 0件（統合スタック）
- ✅ **CDK Synth**: 6スタック正常生成
- ✅ **依存関係**: 最新版に更新済み

### セキュリティ脆弱性修正（2025-11-25）

#### 修正された脆弱性

1. **aws-cdk**: 2.147.3 → 2.1033.0（+885バージョン）
   - ❌ RestApi authorizationScope生成の脆弱性
   - ✅ 修正完了

2. **aws-cdk-lib**: 2.147.3 → 2.228.0（+80バージョン）
   - ❌ IAM OIDC カスタムリソースの脆弱性
   - ❌ Cognito UserPoolClient ログ出力の脆弱性
   - ❌ CodePipeline trusted entities の脆弱性
   - ✅ 全て修正完了

3. **cdk-nag**: 2.28.195 → 2.37.55（+9バージョン）
   - セキュリティルールの最新化

4. **cdk-docker-image-deployment**: 0.0.10 → 0.0.932（+922バージョン）
   - ❌ xml2js プロトタイプ汚染の脆弱性
   - ❌ brace-expansion ReDoS脆弱性
   - ✅ 全て修正完了

#### 検証結果

```bash
# セキュリティ監査
npm audit
# → found 0 vulnerabilities ✅

# ビルド確認
npm run build
# → 正常動作確認 ✅

# CDK Synth確認
DEPLOY_MODE=full npx cdk synth --quiet
# → 6スタック正常生成 ✅
```

### セキュリティベストプラクティス

- **定期的な監査**: 月次でnpm auditを実行
- **依存関係の更新**: 四半期ごとにメジャーバージョンアップを検討
- **脆弱性の早期検出**: CI/CDパイプラインでの自動チェック
- **最小権限の原則**: IAMロールとポリシーの厳格な管理

## 🤝 コントリビューション

プルリクエストを歓迎します。大きな変更の場合は、まずissueを開いて変更内容を議論してください。

## 📝 ライセンス

このプロジェクトは[Apache License 2.0](LICENSE)の下でライセンスされています。

## 📞 サポート

問題が発生した場合は、[GitHub Issues](https://github.com/Yoshiki0705/RAG-FSxN-CDK/issues)で報告してください。

## 🎉 謝辞

このプロジェクトは以下の技術を使用しています：

- [AWS CDK](https://aws.amazon.com/cdk/)
- [Next.js](https://nextjs.org/)
- [Amazon Bedrock](https://aws.amazon.com/bedrock/)
- [FSx for ONTAP](https://aws.amazon.com/fsx/netapp-ontap/)

---