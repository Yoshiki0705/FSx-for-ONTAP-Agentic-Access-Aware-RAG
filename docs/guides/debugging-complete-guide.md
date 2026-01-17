# デバッグ・トラブルシューティング完全ガイド

**最終更新**: 2026年1月18日  
**バージョン**: 3.0  
**対象**: Permission-aware RAG System デバッグ・トラブルシューティング

---

## 目次

1. [緊急時対応フロー](#1-緊急時対応フロー)
2. [開発時のベストプラクティス](#2-開発時のベストプラクティス)
3. [Chrome DevToolsを活用したデバッグ](#3-chrome-devtoolsを活用したデバッグ)
4. [Chrome DevTools MCP活用パターン](#4-chrome-devtools-mcp活用パターン)
5. [Chrome DevToolsテスト手順](#5-chrome-devtoolsテスト手順)
6. [Agent選択変更イベント連動](#6-agent選択変更イベント連動)
7. [AgentCore特有のトラブルシューティング](#7-agentcore特有のトラブルシューティング)
8. [パフォーマンス監視](#8-パフォーマンス監視)
9. [よくある問題と解決策](#9-よくある問題と解決策)
10. [Phase 0.8 実体験から学んだ教訓](#10-phase-08-実体験から学んだ教訓)

---

## 1. 緊急時対応フロー

### 1.1 UI要素が表示されない問題

**症状**: ボタンやコンポーネントがブラウザで表示されない

#### 即座実行可能な対策
```bash
# 1. Chrome DevToolsでコンソールログを確認
# ブラウザのF12 → Console タブ

# 2. DOM要素の存在確認
document.querySelectorAll('button').length

# 3. React Fiberの確認
window.React || window.__REACT_DEVTOOLS_GLOBAL_HOOK__
```

#### 段階的解決手順

**Phase 1: 基本確認（5分以内）**
```bash
# CloudFrontキャッシュ確認
aws cloudfront create-invalidation \
  --distribution-id [DISTRIBUTION_ID] \
  --paths "/*"

# Lambda関数の最終更新確認
aws lambda get-function \
  --function-name [FUNCTION_NAME] \
  --query 'Configuration.LastModified'
```

**Phase 2: デバッグ強化（15分以内）**
```typescript
// コンポーネントにデバッグログを追加
useEffect(() => {
  const debugInfo = {
    timestamp: new Date().toISOString(),
    componentMounted: !!componentRef.current,
    domElementCount: componentRef.current?.querySelectorAll('*').length || 0,
    buttonCount: componentRef.current?.querySelectorAll('button').length || 0
  };
  console.log('🔍 [ComponentName] デバッグ情報:', debugInfo);
}, []);
```

**Phase 3: 根本的解決（30分以内）**
```bash
# 完全なビルド・デプロイサイクル
cd docker/nextjs
rm -rf .next node_modules
npm install
npm run build

# ECRプッシュ・Lambda更新
docker build -t app .
aws ecr get-login-password --region ap-northeast-1 | docker login --username AWS --password-stdin [ECR_URI]
docker tag app:latest [ECR_URI]:latest
docker push [ECR_URI]:latest

# Lambda関数の強制更新
aws lambda update-function-code \
  --function-name [FUNCTION_NAME] \
  --image-uri [ECR_URI]:latest
```

### 1.2 ECRプッシュ権限エラー

**症状**: `no basic auth credentials` エラー

#### 解決手順
```bash
# 1. AWS認証情報の確認
aws sts get-caller-identity

# 2. ECRログイン
aws ecr get-login-password --region ap-northeast-1 | \
  docker login --username AWS --password-stdin [ECR_URI]

# 3. 権限確認
aws iam get-user
aws iam list-attached-user-policies --user-name [USERNAME]
```

### 1.3 Lambda関数の環境変数問題

**症状**: Agent情報が取得できない、API呼び出しエラー

#### 自動修正スクリプト
```bash
# development/scripts/fixes/auto-update-agent-env-vars.sh を実行
./development/scripts/fixes/auto-update-agent-env-vars.sh

# 手動設定の場合
aws lambda update-function-configuration \
  --function-name [FUNCTION_NAME] \
  --environment Variables='{
    "BEDROCK_AGENT_ID": "[AGENT_ID]",
    "BEDROCK_AGENT_ALIAS_ID": "[ALIAS_ID]",
    "DYNAMODB_TABLE_NAME": "[TABLE_NAME]"
  }'
```

---

## 2. 開発時のベストプラクティス

### 2.1 コンポーネント開発

#### デバッグ機能の標準実装（Phase 0.8 実証済み）
```typescript
'use client';

import React, { useEffect, useRef } from 'react';

export function MyComponent({ prop1, prop2 }: Props) {
  const componentRef = useRef<HTMLDivElement>(null);
  
  // Phase 0.8で実証された標準デバッグログ
  useEffect(() => {
    const debugInfo = {
      timestamp: new Date().toISOString(),
      component: 'MyComponent',
      props: { prop1, prop2 },
      componentMounted: !!componentRef.current,
      domElementCount: componentRef.current?.querySelectorAll('*').length || 0,
      buttonCount: componentRef.current?.querySelectorAll('button').length || 0,
      visibleButtons: componentRef.current ? 
        Array.from(componentRef.current.querySelectorAll('button')).filter(btn => btn.offsetParent !== null).length : 0
    };
    
    console.log('🔍 [MyComponent] デバッグ情報:', debugInfo);
    
    // DOM構造の出力（開発時のみ）
    if (process.env.NODE_ENV === 'development' && componentRef.current) {
      console.log('🔍 [MyComponent] DOM構造:', componentRef.current.innerHTML);
    }
    
    // Phase 0.8で追加: ボタンの詳細情報
    if (componentRef.current) {
      const buttons = Array.from(componentRef.current.querySelectorAll('button'));
      buttons.forEach((btn, index) => {
        console.log(`🔍 [MyComponent] ボタン${index + 1}:`, {
          text: btn.textContent?.trim(),
          testId: btn.getAttribute('data-testid'),
          visible: btn.offsetParent !== null,
          clickable: !btn.disabled,
          className: btn.className
        });
      });
    }
  }, [prop1, prop2]);

  return (
    <div ref={componentRef} data-testid="my-component">
      {/* コンポーネント内容 */}
    </div>
  );
}
```


#### data-testid属性の活用
```typescript
// テスト・デバッグ用のID属性を必ず追加
<button
  onClick={handleClick}
  data-testid="primary-action-button"
  className="..."
>
  アクション
</button>
```

### 2.2 API開発

#### エラーハンドリングの標準パターン
```typescript
// pages/api/example/route.ts
export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // バリデーション
    if (!body.requiredField) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'requiredField is required',
          code: 'VALIDATION_ERROR'
        },
        { status: 400 }
      );
    }

    // メイン処理
    const result = await processRequest(body);

    return NextResponse.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('API Error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal Server Error',
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    );
  }
}
```

### 2.3 デプロイメント

#### 安全なデプロイフロー
```bash
#!/bin/bash
set -euo pipefail

# Phase 1: ローカル検証
echo "🔍 ローカル検証を開始..."
npm run build
npm run test

# Phase 2: EC2同期
echo "📤 EC2に同期中..."
rsync -avz --exclude 'node_modules' --exclude '.next' --exclude '.git' \
  ./ ubuntu@[EC2_HOST]:/home/ubuntu/project/

# Phase 3: EC2でビルド・テスト
echo "🏗️ EC2でビルド中..."
ssh ubuntu@[EC2_HOST] "cd project && npm install && npm run build"

# Phase 4: デプロイ実行
echo "🚀 デプロイ実行中..."
ssh ubuntu@[EC2_HOST] "cd project && npx cdk deploy --all"

# Phase 5: 動作確認
echo "✅ 動作確認中..."
curl -f https://[CLOUDFRONT_DOMAIN]/api/health || exit 1

echo "🎉 デプロイ完了"
```

---

## 3. Chrome DevToolsを活用したデバッグ

### 3.1 コンソールログの活用

#### 効果的なログ出力
```typescript
// 構造化されたログ出力
console.log('🔍 [ComponentName] 状態変更:', {
  timestamp: new Date().toISOString(),
  action: 'state_change',
  before: previousState,
  after: newState,
  trigger: 'user_action'
});

// エラーログの詳細化
console.error('❌ [ComponentName] エラー発生:', {
  error: error.message,
  stack: error.stack,
  context: { userId, sessionId, currentPage }
});
```

### 3.2 DOM要素の検査

#### 要素の存在確認
```javascript
// コンソールで実行
// 特定のdata-testidを持つ要素を検索
document.querySelectorAll('[data-testid*="agent"]');

// ボタン要素の一覧
Array.from(document.querySelectorAll('button')).map(btn => ({
  text: btn.textContent,
  id: btn.id,
  testId: btn.getAttribute('data-testid'),
  visible: btn.offsetParent !== null
}));
```

### 3.3 React DevToolsの活用

#### コンポーネント状態の確認
```javascript
// React DevToolsでコンポーネントを選択後
$r.props  // プロパティの確認
$r.state  // 状態の確認（クラスコンポーネント）
$r.hooks  // フックの確認（関数コンポーネント）
```

---

## 4. Chrome DevTools MCP活用パターン

### 4.1 基本原則

#### 原則1: 推測でコーディングしない

**❌ 悪い例**:
```typescript
// APIレスポンスの構造を推測
const userData = data.session.user;     // 存在しないフィールド
const status = response.status;         // responseがnullの可能性
if ('status' in response) {             // responseがnullの場合エラー
  // ...
}
```

**✅ 良い例**:
```typescript
// Chrome DevTools MCPで実際の構造を確認してから実装
// 1. Network Requestsでレスポンスを確認
// 2. 実際のレスポンス構造を確認
// 3. その構造に基づいて実装

const userData = {
  username: data.session.username,  // 実際に存在するフィールド
  userId: data.session.userId,      // 実際に存在するフィールド
  role: 'user'
};

// nullチェックを追加
if (response && 'status' in response) {
  const status = response.status;
}
```

#### 原則2: デプロイ後は必ずChrome DevTools MCPで検証

**検証項目**:
- ✅ Console Logsにエラーがない
- ✅ Network Requestsに異常なリダイレクトがない
- ✅ APIレスポンスが期待通りの構造
- ✅ ページコンテンツが正しく表示される

#### 原則3: エラーログから根本原因を特定

**エラーログの読み方**:
```javascript
// エラー例:
Uncaught TypeError: Cannot use 'in' operator to search for 'status' in null
at U (page-8f539e1940ee8cad.js:1:25097)

// 読み取れる情報:
// 1. エラータイプ: TypeError
// 2. 原因: 'in' operatorをnullに対して使用
// 3. 問題のプロパティ: 'status'
// 4. 発生場所: page-8f539e1940ee8cad.js:1:25097

// 対策:
// 1. Chrome DevTools MCPでAPIレスポンスを確認
// 2. responseがnullを返していることを確認
// 3. nullチェックを追加
```

### 4.2 APIレスポンス構造の確認

**使用場面**:
- APIレスポンスを扱うコードを実装する前
- 型エラー「Cannot use 'in' operator to search for 'X' in null」が発生した場合
- 「Property 'X' does not exist on type 'Y'」エラーが発生した場合

**手順**:

```typescript
// Step 1: ページにアクセス
mcp_chrome_devtool_navigate_page({
  url: "https://your-domain.com/ja/genai",
  ignoreCache: true
})

// Step 2: Network Requestsを確認
mcp_chrome_devtool_list_network_requests({
  pageSize: 50,
  resourceTypes: ["xhr", "fetch"]
})

// Step 3: 特定のリクエストの詳細を確認
mcp_chrome_devtool_get_network_request({
  reqid: 123  // Step 2で取得したreqid
})

// Step 4: レスポンス構造を確認
// - responseBodyを確認
// - statusCodeを確認
// - headersを確認

// Step 5: 実際の構造に基づいて実装
```

### 4.3 Console Logsでの動作確認

**使用場面**:
- ページの動作を確認する場合
- ロケール検出の動作を確認する場合
- イベントリスナーの動作を確認する場合

**手順**:

```typescript
// Step 1: ページにアクセス
mcp_chrome_devtool_navigate_page({
  url: "https://your-domain.com/en/genai",
  ignoreCache: true
})

// Step 2: Console Logsを確認
mcp_chrome_devtool_list_console_messages({
  pageSize: 50
})

// Step 3: ログから動作を確認
// 例: [LanguageSwitcher] Mounted with currentLocale: en
// 例: [i18n/request] requestLocaleから取得: en

// Step 4: 期待通りの動作か確認
// ✅ 正常: currentLocale が en
// ❌ 異常: currentLocale が ja（URLは /en/genai なのに）
```

### 4.4 Network Requestsでのループ検出

**使用場面**:
- サインインループが発生している場合
- 無限リダイレクトが発生している場合
- ページが正常に表示されない場合

**手順**:

```typescript
// Step 1: サインインを実行
await mcp_chrome_devtool_fill_form({
  elements: [
    { uid: "username_field", value: "admin" },
    { uid: "password_field", value: "admin123" }
  ]
})
await mcp_chrome_devtool_click({ uid: "signin_button" })

// Step 2: Network Requestsを確認
const requests = await mcp_chrome_devtool_list_network_requests({
  pageSize: 50,
  resourceTypes: ["document"]
})

// Step 3: リダイレクトループを検出
// ✅ 正常: /signin へのリクエストが0回
// ❌ 異常: /signin へのリクエストが複数回

// Step 4: 307リダイレクトを確認
// 例: GET /signin?_rsc=plmlv [307 Redirect]
// 例: GET /ja/signin [200 OK]
// 例: GET /signin?_rsc=plmlv [307 Redirect] ← ループ！
```

---

## 5. Chrome DevToolsテスト手順

### 5.1 基本動作確認

#### ページ読み込み確認
```javascript
// Consoleで実行
console.log('ページ読み込み時刻:', new Date().toISOString());
console.log('React検出:', !!window.React || !!window.__REACT_DEVTOOLS_GLOBAL_HOOK__);
console.log('Next.js検出:', !!window.__NEXT_DATA__);
```

#### DOM要素の基本確認
```javascript
// 全体的なDOM構造確認
console.log('総要素数:', document.querySelectorAll('*').length);
console.log('ボタン数:', document.querySelectorAll('button').length);
console.log('入力フィールド数:', document.querySelectorAll('input, textarea, select').length);
```

### 5.2 Agent作成UI機能テスト（Phase 0.8 実証済み）

#### Agent情報セクションの確認
```javascript
// Phase 0.8で実証されたAgent情報セクションの存在確認
const agentSection = document.querySelector('[data-testid*="agent"]') || 
                    document.querySelector('h3:contains("Agent情報")');
console.log('🔍 Agent情報セクション:', agentSection);

// Phase 0.8で実際に確認されたAgent作成ボタンの詳細チェック
const createButtons = Array.from(document.querySelectorAll('button')).filter(btn => 
  btn.textContent.includes('Agent作成') || 
  btn.textContent.includes('➕') ||
  btn.textContent.includes('🚀')
);

console.log('🔍 Agent作成ボタン詳細:', createButtons.map((btn, index) => ({
  index: index + 1,
  text: btn.textContent.trim(),
  testId: btn.getAttribute('data-testid'),
  visible: btn.offsetParent !== null,
  clickable: !btn.disabled,
  className: btn.className,
  parentElement: btn.parentElement?.tagName,
  boundingRect: btn.getBoundingClientRect()
})));
```

### 5.3 API通信テスト

#### Network パネルでのAPI監視

1. **Network パネルを開く**
2. **Clear ボタンでログをクリア**
3. **Agent作成ボタンをクリック**
4. **以下のAPIコールを確認**:

```
期待されるAPI呼び出し:
- GET /api/bedrock/agent (Agent情報取得)
- GET /api/bedrock/knowledge-bases (KB一覧取得)
- POST /api/bedrock/create-agent (Agent作成)
- GET /api/bedrock/agent-creation-status (作成状況確認)
```

#### API レスポンスの確認
```javascript
// Fetch APIの監視
const originalFetch = window.fetch;
window.fetch = function(...args) {
  console.log('API呼び出し:', args[0]);
  return originalFetch.apply(this, args).then(response => {
    console.log('API応答:', response.status, response.url);
    return response;
  });
};
```

---

## 6. Agent選択変更イベント連動

### 6.1 よくある問題と解決方法

#### 問題1: 「Agent選択中...」メッセージが表示される

**症状**:
- Agent選択ドロップダウンでAgentを選択しても、Introduction Textが「Agent選択中...」と表示される
- Agent情報が正しく反映されない

**原因**:
- Agent選択変更イベントの発火タイミングが不適切
- Agent情報の統合ロジックに問題がある
- イベントリスナーが正しく設定されていない

**解決方法**:

##### 1. ブラウザキャッシュのクリア
```bash
# Chrome
Cmd+Shift+R (Mac) / Ctrl+Shift+R (Windows)

# Safari
Cmd+Option+R (Mac)

# Firefox
Ctrl+Shift+R (Windows/Linux) / Cmd+Shift+R (Mac)
```

##### 2. 開発者ツールでのデバッグ
```javascript
// 1. F12で開発者ツールを開く
// 2. Consoleタブで以下を実行

// 現在のAgent状態を確認
console.log('Agent State:', {
  selectedAgentId: localStorage.getItem('selectedAgentId'),
  agentInfo: JSON.parse(localStorage.getItem('agentInfo') || 'null')
});

// Agent選択変更イベントを手動発火
window.dispatchEvent(new CustomEvent('agent-selection-changed', {
  detail: { 
    agentInfo: { 
      agentId: 'test-agent',
      agentName: 'Test Agent',
      status: 'PREPARED'
    },
    source: 'Manual-Debug'
  }
}));
```

#### 問題2: 新しいチャット作成時にAgent情報が反映されない

**症状**:
- 「新しいチャット」ボタンをクリックしても、Agent情報がIntroduction Textに反映されない
- 前のチャットでは正常に表示されていた

**解決策**:

##### 1. Agent再選択
```bash
# 手順:
# 1. サイドバーのAgent選択ドロップダウンを開く
# 2. 現在選択されているAgentを再度選択
# 3. 「新しいチャット」ボタンをクリック
```

##### 2. ローカルストレージのクリア
```javascript
// 開発者ツールのConsoleで実行
localStorage.removeItem('selectedAgentId');
localStorage.removeItem('agentInfo');
location.reload();
```

---

## 7. AgentCore特有のトラブルシューティング

### 7.1 AgentCore Runtime問題

#### 問題: Lambda実行エラー「Agent not found」

**症状**: 
```
Error: Agent not found: agent-xxxxx
Status: 404
```

**原因**:
- 環境変数`BEDROCK_AGENT_ID`が未設定または誤っている
- Bedrock Agentが削除されている
- リージョンが一致していない

**解決策**:
```bash
# 1. Lambda環境変数を確認
aws lambda get-function-configuration \
  --function-name TokyoRegion-project-name-prod-AgentCoreRuntime-Function \
  --query 'Environment.Variables.BEDROCK_AGENT_ID'

# 2. Bedrock Agentの存在確認
aws bedrock-agent get-agent \
  --agent-id [AGENT_ID] \
  --region ap-northeast-1

# 3. 環境変数を修正
aws lambda update-function-configuration \
  --function-name TokyoRegion-project-name-prod-AgentCoreRuntime-Function \
  --environment "Variables={BEDROCK_AGENT_ID=[正しいAGENT_ID]}"
```

### 7.2 AgentCore Gateway問題

#### 問題: REST API変換エラー

**症状**:
```
Error: Failed to parse OpenAPI specification
File: /mnt/fsx/openapi/api-spec.yaml
```

**原因**:
- OpenAPI仕様ファイルが存在しない
- FSx for ONTAPマウントポイントが利用不可
- OpenAPI仕様の構文エラー

**解決策**:
```bash
# 1. FSxマウントポイントの確認
aws lambda get-function \
  --function-name TokyoRegion-project-name-prod-AgentCoreGateway-RestApiConverter \
  --query 'Configuration.FileSystemConfigs'

# 2. OpenAPI仕様ファイルの存在確認
aws lambda invoke \
  --function-name TokyoRegion-project-name-prod-AgentCoreGateway-RestApiConverter \
  --payload '{"action":"validate","specPath":"/mnt/fsx/openapi/api-spec.yaml"}' \
  response.json

# 3. OpenAPI仕様の検証
npx @apidevtools/swagger-cli validate /path/to/api-spec.yaml
```

---

## 8. パフォーマンス監視

### 8.1 ビルド時間の最適化

#### Next.jsビルドの高速化
```javascript
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  // 開発時のビルド高速化
  swcMinify: true,
  
  // 本番ビルドの最適化
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production'
  },
  
  // 実験的機能（高速化）
  experimental: {
    turbo: {
      loaders: {
        '.svg': ['@svgr/webpack']
      }
    }
  }
};

module.exports = nextConfig;
```

### 8.2 Lambda関数の最適化

#### コールドスタート対策
```typescript
// Lambda関数の外側で初期化（再利用される）
const bedrockClient = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'ap-northeast-1'
});

export const handler = async (event: any) => {
  // ハンドラー内では初期化済みのクライアントを使用
  const response = await bedrockClient.send(command);
  return response;
};
```

---

## 9. よくある問題と解決策

### 9.1 "Agent作成ボタンが表示されない"

**原因**: コンポーネントの条件分岐でボタンが除外されている

**解決策**:
```typescript
// 全ての状態でボタンを表示するよう修正
return (
  <div className="space-y-3">
    <div className="flex items-center justify-between">
      <h3>Agent情報</h3>
      {/* 常にボタンを表示 */}
      <button onClick={handleCreateAgent}>➕</button>
    </div>
    {/* その他のコンテンツ */}
  </div>
);
```

### 9.2 "ECRプッシュが失敗する"

**原因**: AWS認証情報の期限切れまたは権限不足

**解決策**:
```bash
# 認証情報の更新
aws configure
aws ecr get-login-password --region ap-northeast-1 | \
  docker login --username AWS --password-stdin [ECR_URI]

# 権限の確認
aws iam simulate-principal-policy \
  --policy-source-arn [USER_ARN] \
  --action-names ecr:BatchCheckLayerAvailability ecr:GetDownloadUrlForLayer ecr:BatchGetImage \
  --resource-arns [ECR_REPO_ARN]
```

### 9.3 "Lambda関数が古いコードを実行している"（Phase 0.8 実体験）

**原因**: ECRイメージの更新が反映されていない（Phase 0.8で実際に発生）

**Phase 0.8での実際の症状**:
- Agent作成ボタンが表示されない
- 最新のコンポーネントが反映されない
- ECRプッシュは成功しているが、Lambda関数が古いイメージを使用

**解決策**:
```bash
# Step 1: 現在のLambda関数の状態確認
aws lambda get-function \
  --function-name [FUNCTION_NAME] \
  --query 'Configuration.LastModified'

# Step 2: ECRリポジトリの最新イメージ確認
aws ecr describe-images \
  --repository-name [REPO_NAME] \
  --query 'imageDetails[0].imagePushedAt'

# Step 3: 強制的にLambda関数を更新（Phase 0.8で効果確認済み）
aws lambda update-function-code \
  --function-name [FUNCTION_NAME] \
  --image-uri [ECR_URI]:latest

# Step 4: 更新確認（必須）
aws lambda get-function \
  --function-name [FUNCTION_NAME] \
  --query 'Configuration.LastModified'

# Step 5: CloudFrontキャッシュの無効化
aws cloudfront create-invalidation \
  --distribution-id [DISTRIBUTION_ID] \
  --paths "/*"

# Step 6: 動作確認（Chrome DevToolsで確認）
# https://[CLOUDFRONT_DOMAIN]/ja/genai?mode=agent
```

---

## 10. Phase 0.8 実体験から学んだ教訓

### 10.1 完全なデバッグ・解決プロセス

**期間**: 2025年12月13日 14:00 - 23:47 (約10時間)  
**問題**: Agent作成ボタンが表示されない  
**最終結果**: 完全解決、Chrome DevToolsで動作確認済み

#### タイムライン詳細

**14:00 - 16:00: 問題発見と初期調査**
- Agent作成ボタンがブラウザで表示されない問題を発見
- Chrome DevToolsでDOM要素を確認、ボタン要素が存在しない
- 初期仮説: コンポーネントの条件分岐問題

**16:00 - 18:00: デバッグ強化とログ追加**
- AgentInfoSectionコンポーネントにデバッグログを追加
- DOM監視機能を実装
- EC2への同期を実行

**18:00 - 20:00: ビルド・デプロイサイクル**
- Next.jsの完全再ビルド
- CDKデプロイの実行
- 問題が継続、根本原因の特定に至らず

**20:00 - 22:00: ECRプッシュ問題の発見**
- ECRプッシュ権限エラーを発見
- `no basic auth credentials` エラーの解決
- AWS認証情報の再設定

**22:00 - 23:47: 根本的解決**
- Lambda関数の強制更新を実行
- CloudFrontキャッシュの無効化
- Chrome DevToolsで完全な動作確認

### 10.2 根本原因の詳細分析

#### 技術的根本原因
1. **ECRプッシュ権限エラー**: AWS認証情報の期限切れ
2. **Lambda関数の古いイメージ**: 最新のコンテナイメージが反映されていない
3. **CloudFrontキャッシュ**: 古いバージョンのキャッシュが残存

#### 見落としていた重要なポイント
- ECRプッシュの成功 ≠ Lambda関数への反映
- CDKデプロイの成功 ≠ 最新コードの反映
- ローカルビルドの成功 ≠ 本番環境での動作

### 10.3 今後の予防策

#### デプロイ前チェックリスト
```bash
#!/bin/bash
# Phase 0.8の経験を基にした包括的チェックスクリプト

echo "🔍 Phase 0.8 学習済みデプロイ前チェック開始"

# ECR認証確認
echo "1. ECR認証確認..."
aws ecr get-login-password --region ap-northeast-1 | \
  docker login --username AWS --password-stdin [ECR_URI]

# Lambda関数の現在の更新時刻
echo "2. Lambda関数の現在状態..."
CURRENT_LAMBDA_TIME=$(aws lambda get-function \
  --function-name [FUNCTION_NAME] \
  --query 'Configuration.LastModified' --output text)
echo "Lambda最終更新: $CURRENT_LAMBDA_TIME"

# ECRイメージの最新プッシュ時刻
echo "3. ECRイメージの状態..."
LATEST_ECR_TIME=$(aws ecr describe-images \
  --repository-name [REPO_NAME] \
  --query 'imageDetails[0].imagePushedAt' --output text)
echo "ECR最新プッシュ: $LATEST_ECR_TIME"

# CDK構文チェック
echo "4. CDK構文チェック..."
npx cdk synth --quiet

echo "✅ デプロイ前チェック完了"
```

---

## まとめ

このガイドでは、Permission-aware RAG Systemのデバッグ・トラブルシューティングにおける主要な手法とベストプラクティスを説明しました。

**実装済み機能**:
- ✅ 緊急時対応フロー
- ✅ 開発時のベストプラクティス
- ✅ Chrome DevToolsを活用したデバッグ
- ✅ Chrome DevTools MCP活用パターン
- ✅ Chrome DevToolsテスト手順
- ✅ Agent選択変更イベント連動
- ✅ AgentCore特有のトラブルシューティング
- ✅ パフォーマンス監視
- ✅ よくある問題と解決策
- ✅ Phase 0.8 実体験から学んだ教訓

新しい問題が発生した際は、このガイドのパターンに従い、段階的なデバッグアプローチを実施してください。

---

**最終更新**: 2026年1月18日  
**バージョン**: 3.0  
**全体進捗**: 100% (全デバッグ手法統合完了)
