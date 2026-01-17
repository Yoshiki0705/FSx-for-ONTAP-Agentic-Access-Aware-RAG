# Bedrockモデルアダプター開発ガイド

## 📋 概要

このガイドでは、Permission-aware-RAG-FSxN-CDKプロジェクトにおける**Bedrockモデルアダプター**の仕組みと、新しいプロバイダーの追加方法について説明します。

## 🎯 実装内容まとめ

### 改善内容

#### Before（修正前）:
- ❌ if文で各モデルを個別に処理
- ❌ 新しいモデル追加時、複数箇所を修正必要
- ❌ メンテナンス性が低い

#### After（修正後）:
- ✅ アダプターパターンを導入
- ✅ 新しいプロバイダー追加時、`bedrock-model-adapters.ts`のみ修正
- ✅ `route.ts`は変更不要

### 対応プロバイダー（13社）

**AWS公式ページ（https://aws.amazon.com/jp/bedrock/model-choice/）に基づく全プロバイダー対応**

#### デフォルト対応プロバイダー（6社）
チャットボットUIでデフォルトで利用可能：

1. ✅ **Anthropic (Claude)** - Messages API対応
2. ✅ **Amazon (Nova, Titan)** - Inference Profile対応
3. ✅ **Meta (Llama)** - Llama API対応
4. ✅ **Cohere (Command)** - Cohere API対応
5. ✅ **Mistral AI** - Mistral API対応
6. ✅ **AI21 Labs (Jamba)** - AI21 API対応

#### Marketplaceプロバイダー（7社）
Amazon Bedrock Marketplace経由で利用可能：

7. ✅ **Stability AI (Stable Diffusion)** - 画像生成API対応
8. ✅ **TwelveLabs (Pegasus, Marengo)** - ビデオ・マルチモーダルAPI対応
9. ✅ **DeepSeek (R1, V3)** - DeepSeek API対応
10. ✅ **Luma AI (Ray)** - ビデオ生成API対応
11. ✅ **OpenAI (GPT-OSS)** - OpenAI API対応
12. ✅ **Qwen (Qwen3)** - Qwen API対応
13. ✅ **Writer (Palmyra)** - Writer API対応

### メリット

- 🎯 **動的対応**: 全プロバイダーのAPI仕様に自動対応
- 🔧 **メンテナンス性**: 新しいモデル追加が容易（1ファイルのみ修正）
- 🚀 **拡張性**: 新しいプロバイダー追加が簡単
- 📖 **可読性**: コードが明確で理解しやすい
- 🧪 **テスト容易性**: 各アダプターを独立してテスト可能

### 新しいプロバイダーの追加方法

たった3ステップで追加可能：

1. **アダプターを定義**
2. **アダプターマッピングに追加**
3. **プロバイダー判定ロジックに追加**

**重要**: `route.ts`は一切変更不要！

これで、将来的なAPI仕様変更や新しいモデルの追加に柔軟に対応できるようになりました。

## 🎯 目的

- 全てのBedrockプロバイダーのモデルに動的に対応
- API仕様変更に柔軟に対応
- メンテナンス性の向上
- 新しいモデル追加の容易化

## 🏗️ アーキテクチャ

### アダプターパターン

各プロバイダーのAPI仕様の違いを吸収し、統一的なインターフェースを提供します。

```
┌─────────────────┐
│   route.ts      │  ← 高レベルモジュール（変更不要）
│  (Chat API)     │
└────────┬────────┘
         │
         │ 統一インターフェース
         │
┌────────▼────────────────────────────────────┐
│  bedrock-model-adapters.ts                 │
│  (アダプター層)                             │
├────────────────────────────────────────────┤
│ • normalizeModelId()                       │
│ • buildPrompt()                            │
│ • parseResponse()                          │
│ • parseUsage()                             │
└────────┬───────────────────────────────────┘
         │
         │ プロバイダー固有のAPI仕様
         │
┌────────▼────────────────────────────────────┐
│  各プロバイダーのBedrockモデル              │
├────────────────────────────────────────────┤
│ • Anthropic (Claude)                       │
│ • Amazon (Nova, Titan)                     │
│ • Meta (Llama)                             │
│ • Cohere (Command)                         │
│ • Mistral AI                               │
│ • AI21 Labs (Jamba)                        │
│ • Stability AI (Stable Diffusion)          │
│ • TwelveLabs (Pegasus, Marengo)            │
│ • DeepSeek (R1, V3)                        │
│ • Luma AI (Ray)                            │
│ • OpenAI (GPT-OSS)                         │
│ • Qwen (Qwen3)                             │
│ • Writer (Palmyra)                         │
│ • Databricks (DBRX)                        │
└────────────────────────────────────────────┘
```

---

このガイドにより、Bedrockモデルアダプターの仕組みと、新しいプロバイダーの追加方法を理解できます。


---

## 🔍 プロバイダー検出エンジン

### 概要

プロバイダー検出エンジンは、モデルIDから正確にプロバイダーを識別するための中核コンポーネントです。

### 検出ロジック

3段階の優先順位で検出を行います：

1. **接頭辞マッチング（最優先）**
   - モデルIDの接頭辞（例: `anthropic.`, `twelvelabs.`）から検出
   - 最も確実な検出方法

2. **パターンマッチング**
   - 正規表現パターンでモデル名を検出
   - 接頭辞がない場合のフォールバック

3. **デフォルトプロバイダー**
   - 上記で検出できない場合、Amazonをデフォルトとして使用

### プロバイダー設定データ構造

```typescript
interface ProviderConfig {
  id: string;                    // 内部ID（例: 'anthropic'）
  displayName: string;           // 表示名（例: 'Anthropic'）
  prefixes: string[];            // モデルID接頭辞（例: ['anthropic.']）
  patterns: RegExp[];            // モデルIDパターン
  isMarketplace: boolean;        // Marketplace対応フラグ
  description?: string;          // プロバイダー説明
}
```

### モデルIDパターン例

| プロバイダー | 接頭辞 | パターン例 | モデルID例 |
|------------|--------|-----------|-----------|
| Anthropic | `anthropic.` | `claude` | `anthropic.claude-v2`, `claude-3-sonnet` |
| TwelveLabs | `twelvelabs.` | `pegasus`, `marengo` | `twelvelabs.pegasus-1.2`, `pegasus-1.2` |
| Amazon | `amazon.` | `nova`, `titan` | `amazon.nova-pro-v1:0`, `nova-lite-v1:0` |
| DeepSeek | `deepseek.` | `deepseek`, `r1`, `v3` | `deepseek.r1`, `deepseek-v3` |

### 使用方法

```typescript
import { 
  getProviderFromModelId,      // プロバイダーIDを取得
  getProviderDisplayName,       // プロバイダー表示名を取得
  getProviderInfo               // プロバイダー情報を取得
} from '@/lib/bedrock-model-adapters';

// プロバイダーIDを取得
const providerId = getProviderFromModelId('twelvelabs.pegasus-1.2');
// => 'twelvelabs'

// プロバイダー表示名を取得
const displayName = getProviderDisplayName('pegasus-1.2');
// => 'TwelveLabs'

// プロバイダー情報を取得
const info = getProviderInfo('anthropic.claude-v2');
// => { id: 'anthropic', displayName: 'Anthropic', ... }
```

---

## 🆕 新しいプロバイダーの追加方法

### ステップ1: プロバイダー設定を追加

`docker/nextjs/src/lib/bedrock-model-adapters.ts`の`PROVIDER_CONFIGS`配列に新しいプロバイダーを追加：

```typescript
const PROVIDER_CONFIGS: ProviderConfig[] = [
  // 既存のプロバイダー...
  
  // 新しいプロバイダー
  {
    id: 'newprovider',                    // 内部ID（小文字）
    displayName: 'New Provider',          // 表示名
    prefixes: ['newprovider.'],           // モデルID接頭辞
    patterns: [/newmodel/i, /newprovider\./i],  // 検出パターン
    isMarketplace: true,                  // Marketplace対応フラグ
    description: 'New Provider models'    // 説明
  }
];
```

### ステップ2: アダプターを実装

同じファイルに新しいアダプターを追加：

```typescript
const newproviderAdapter: ModelAdapter = {
  provider: 'newprovider',
  
  buildPrompt: (params: PromptParams) => ({
    // プロバイダー固有のプロンプト形式
    messages: [
      {
        role: 'user',
        content: params.message
      }
    ],
    max_tokens: params.maxTokens || 1000,
    temperature: params.temperature || 0.7
  }),
  
  parseResponse: (responseBody: any) => {
    // プロバイダー固有のレスポンス解析
    return responseBody.content?.[0]?.text || 
           responseBody.completion ||
           'レスポンスの解析に失敗しました。';
  }
};
```

### ステップ3: アダプターマッピングに追加

```typescript
const adapters: Record<string, ModelAdapter> = {
  // 既存のアダプター...
  'newprovider': newproviderAdapter
};
```

### 完了！

これだけで新しいプロバイダーが自動的に検出され、使用可能になります。

**重要**: 
- `route.ts`やUIコンポーネントの変更は不要
- プロバイダー検出エンジンが自動的に新しいプロバイダーを認識
- 表示名も自動的に適用される

---

## 🐛 トラブルシューティング

### プロバイダーが"Others"と表示される

**原因**: プロバイダー設定に該当するパターンがない

**解決策**:
1. `PROVIDER_CONFIGS`に該当プロバイダーが存在するか確認
2. `prefixes`と`patterns`が正しく設定されているか確認
3. モデルIDが期待通りの形式か確認

```typescript
// デバッグ用
console.log('Model ID:', modelId);
console.log('Detected Provider:', getProviderDisplayName(modelId));
```

### 新しいモデルが検出されない

**原因**: パターンマッチングが不完全

**解決策**:
1. モデルIDの形式を確認
2. `patterns`配列に新しいパターンを追加

```typescript
patterns: [
  /pegasus/i,      // 既存パターン
  /marengo/i,      // 既存パターン
  /newmodel/i      // 新しいパターンを追加
]
```

### プロバイダー表示名が正しくない

**原因**: `displayName`の設定ミス

**解決策**:
`PROVIDER_CONFIGS`の`displayName`を確認・修正

```typescript
{
  id: 'twelvelabs',
  displayName: 'TwelveLabs',  // ← ここを確認
  // ...
}
```

---

## 📚 参考資料

- [AWS Bedrock Model Choice](https://aws.amazon.com/jp/bedrock/model-choice/)
- [AWS Bedrock Marketplace](https://aws.amazon.com/bedrock/marketplace/)
- [Bedrock API Documentation](https://docs.aws.amazon.com/bedrock/)

---

**最終更新**: 2025年11月25日
**バージョン**: 2.0.0
