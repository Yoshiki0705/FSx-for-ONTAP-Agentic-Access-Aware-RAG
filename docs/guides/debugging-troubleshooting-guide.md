# デバッグ・トラブルシューティングガイド

**最終更新**: 2025年12月13日  
**対象**: Permission-aware RAG System with Amazon FSx for NetApp ONTAP

## 📋 概要

このガイドは、Phase 0.8 Bedrock Agent作成UI機能の実装とデバッグで得られた知見を基に、今後の開発・運用で発生する可能性のある問題への対処法をまとめています。

## 🚨 緊急時対応フロー

### 1. UI要素が表示されない問題

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

### 2. ECRプッシュ権限エラー

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

### 3. Lambda関数の環境変数問題

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

## 🔧 開発時のベストプラクティス

### 1. コンポーネント開発

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

### 2. API開発

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

### 3. デプロイメント

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

## 🔍 Chrome DevToolsを活用したデバッグ

### 1. コンソールログの活用

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

### 2. DOM要素の検査

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

### 3. React DevToolsの活用

#### コンポーネント状態の確認
```javascript
// React DevToolsでコンポーネントを選択後
$r.props  // プロパティの確認
$r.state  // 状態の確認（クラスコンポーネント）
$r.hooks  // フックの確認（関数コンポーネント）
```

## 📊 パフォーマンス監視

### 1. ビルド時間の最適化

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

### 2. Lambda関数の最適化

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

## 🚨 よくある問題と解決策

### 1. "Agent作成ボタンが表示されない"

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

### 2. "ECRプッシュが失敗する"

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

### 3. "Lambda関数が古いコードを実行している"（Phase 0.8 実体験）

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

**Phase 0.8での学習ポイント**:
- ECRプッシュ成功 ≠ Lambda関数への反映
- Lambda関数の強制更新が必要な場合がある
- CloudFrontキャッシュの無効化も重要
- Chrome DevToolsでの実際の動作確認が最終的な検証手段

## 📋 Phase 0.8 実証済みチェックリスト

### デプロイ前チェック（Phase 0.8で検証済み）
- [ ] ローカルでビルドが成功する（`npm run build`）
- [ ] TypeScriptエラーがない（`npx tsc --noEmit`）
- [ ] CDK構文チェックが通る（`npx cdk synth --quiet`）
- [ ] テストが通る（`npm test`）
- [ ] EC2に最新コードが同期されている（`rsync`実行済み）
- [ ] 環境変数が正しく設定されている
- [ ] ECR認証が有効である（`aws ecr get-login-password`）

### デプロイ後チェック（Phase 0.8で検証済み）
- [ ] CloudFrontでページが表示される
- [ ] API エンドポイントが応答する（`/api/health`）
- [ ] Chrome DevToolsでエラーがない
- [ ] 主要機能が動作する（Agent作成ボタン等）
- [ ] Lambda関数のログにエラーがない
- [ ] Lambda関数の最終更新時刻が最新である
- [ ] ECRイメージのプッシュ時刻とLambda更新時刻が一致する

### UI要素表示問題のチェック（Phase 0.8 実体験）
- [ ] Chrome DevToolsのコンソールログを確認
- [ ] DOM要素の存在確認（`document.querySelectorAll('button').length`）
- [ ] ボタンの可視性確認（`btn.offsetParent !== null`）
- [ ] React DevToolsでコンポーネント状態を確認
- [ ] Network タブでAPI呼び出しを確認
- [ ] Elements タブでDOM構造を確認
- [ ] CloudWatch Logsでサーバーサイドエラーを確認

### 緊急時対応チェック（Phase 0.8で実証済み）
- [ ] Lambda関数の強制更新を実行
- [ ] CloudFrontキャッシュの無効化を実行
- [ ] ECR認証の再実行
- [ ] Chrome DevToolsでの実際の動作確認
- [ ] カスタムイベントでのテスト実行

## 🔗 関連リソース

### 内部ドキュメント
- [デプロイメントガイド](DEPLOYMENT_GUIDE_UNIFIED.md)
- [フロントエンド開発ガイド](frontend-development-guide.md)
- [運用・保守ガイド](OPERATIONS_MAINTENANCE_GUIDE_JA.md)

### 外部リソース
- [Next.js デバッグガイド](https://nextjs.org/docs/advanced-features/debugging)
- [React DevTools](https://react.dev/learn/react-developer-tools)
- [Chrome DevTools](https://developer.chrome.com/docs/devtools/)
- [AWS Lambda トラブルシューティング](https://docs.aws.amazon.com/lambda/latest/dg/troubleshooting.html)

---

**このガイドは Phase 0.8 の実装経験を基に作成されており、実際の問題解決で検証済みの手法を含んでいます。**
## 🎯 Phase 0.8 実体験: 10時間のデバッグから学んだ教訓

### 完全なデバッグ・解決プロセス

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

### 根本原因の詳細分析

#### 技術的根本原因
1. **ECRプッシュ権限エラー**: AWS認証情報の期限切れ
2. **Lambda関数の古いイメージ**: 最新のコンテナイメージが反映されていない
3. **CloudFrontキャッシュ**: 古いバージョンのキャッシュが残存

#### 見落としていた重要なポイント
- ECRプッシュの成功 ≠ Lambda関数への反映
- CDKデプロイの成功 ≠ 最新コードの反映
- ローカルビルドの成功 ≠ 本番環境での動作

### 効果的だった解決手法

#### 1. 段階的デバッグアプローチ
```typescript
// Phase 0.8で効果的だったデバッグログ
useEffect(() => {
  const debugInfo = {
    timestamp: new Date().toISOString(),
    component: 'AgentInfoSection',
    renderCount: renderCountRef.current++,
    props: { agentId, status, model },
    domState: {
      componentMounted: !!componentRef.current,
      totalElements: componentRef.current?.querySelectorAll('*').length || 0,
      buttonElements: componentRef.current?.querySelectorAll('button').length || 0,
      visibleButtons: componentRef.current ? 
        Array.from(componentRef.current.querySelectorAll('button'))
          .filter(btn => btn.offsetParent !== null).length : 0
    }
  };
  
  console.log('🔍 [AgentInfoSection] 詳細デバッグ:', debugInfo);
  
  // ボタンの個別確認
  if (componentRef.current) {
    const buttons = Array.from(componentRef.current.querySelectorAll('button'));
    buttons.forEach((btn, index) => {
      console.log(`🔍 [AgentInfoSection] ボタン${index + 1}:`, {
        text: btn.textContent?.trim(),
        testId: btn.getAttribute('data-testid'),
        visible: btn.offsetParent !== null,
        clickable: !btn.disabled,
        className: btn.className,
        style: window.getComputedStyle(btn).display
      });
    });
  }
}, [agentId, status, model]);
```

#### 2. Chrome DevToolsでの実動作確認
```javascript
// Phase 0.8で最終的に成功したテストスクリプト
function verifyAgentCreationUI() {
  console.log('🚀 Agent作成UI検証開始:', new Date().toISOString());
  
  // 基本DOM確認
  const totalButtons = document.querySelectorAll('button').length;
  console.log('総ボタン数:', totalButtons);
  
  // Agent作成ボタンの確認
  const agentButtons = Array.from(document.querySelectorAll('button')).filter(btn => 
    btn.textContent.includes('Agent作成') || 
    btn.textContent.includes('➕') ||
    btn.textContent.includes('🚀')
  );
  
  console.log('Agent作成ボタン数:', agentButtons.length);
  agentButtons.forEach((btn, index) => {
    console.log(`ボタン${index + 1}:`, {
      text: btn.textContent.trim(),
      visible: btn.offsetParent !== null,
      uid: btn.getAttribute('uid')
    });
  });
  
  // ウィザードテスト
  if (agentButtons.length > 0) {
    console.log('🚀 ウィザードテスト実行');
    agentButtons[0].click();
    
    setTimeout(() => {
      const wizard = document.querySelector('h2:contains("Bedrock Agent作成")');
      console.log('ウィザード表示:', !!wizard);
      if (wizard) {
        console.log('✅ Agent作成UI機能: 正常動作確認');
      }
    }, 1000);
  }
}

// 実行
verifyAgentCreationUI();
```

#### 3. Lambda関数の強制更新
```bash
# Phase 0.8で決定的だった解決コマンド
aws lambda update-function-code \
  --function-name TokyoRegion-permission-aware-rag-prod-WebApp-Function \
  --image-uri [ECR_URI]:latest

# 更新確認
aws lambda get-function \
  --function-name TokyoRegion-permission-aware-rag-prod-WebApp-Function \
  --query 'Configuration.LastModified'
```

### 今後の予防策

#### 1. デプロイ前チェックリスト
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

#### 2. デプロイ後検証スクリプト
```bash
#!/bin/bash
# Phase 0.8の経験を基にした包括的検証スクリプト

echo "🔍 Phase 0.8 学習済みデプロイ後検証開始"

# Lambda関数の更新確認
echo "1. Lambda関数更新確認..."
NEW_LAMBDA_TIME=$(aws lambda get-function \
  --function-name [FUNCTION_NAME] \
  --query 'Configuration.LastModified' --output text)
echo "新しいLambda更新時刻: $NEW_LAMBDA_TIME"

# CloudFront動作確認
echo "2. CloudFront動作確認..."
curl -f https://[CLOUDFRONT_DOMAIN]/ || echo "❌ CloudFront接続失敗"

# API エンドポイント確認
echo "3. API エンドポイント確認..."
curl -f https://[CLOUDFRONT_DOMAIN]/api/health || echo "❌ API接続失敗"

# Chrome DevToolsテスト用URL出力
echo "4. Chrome DevToolsテスト用URL:"
echo "https://[CLOUDFRONT_DOMAIN]/ja/genai?mode=agent"

echo "✅ デプロイ後検証完了"
echo "🔍 Chrome DevToolsで最終確認を実行してください"
```

### Phase 0.8から得られた重要な知見

#### 技術的知見
1. **ECRプッシュとLambda更新は別プロセス**: 自動的に反映されない場合がある
2. **CloudFrontキャッシュの影響**: 最新版が反映されない原因となる
3. **Chrome DevToolsの重要性**: 最終的な動作確認には必須
4. **段階的デバッグの効果**: 問題を細分化して解決する重要性

#### 運用的知見
1. **デバッグログの標準化**: 構造化されたログが問題特定を加速
2. **data-testid属性の重要性**: テスト・デバッグ時の要素特定に必須
3. **時系列での問題追跡**: タイムスタンプ付きログの重要性
4. **複数の検証手法**: ローカル、EC2、Chrome DevToolsでの多角的確認

#### プロセス改善
1. **デプロイフローの見直し**: ECR認証からLambda更新までの一連の流れ
2. **検証プロセスの標準化**: Chrome DevToolsテストの必須化
3. **緊急時対応の準備**: Lambda強制更新とキャッシュ無効化の手順化
4. **ドキュメント化の重要性**: 実体験の知見を再利用可能な形で保存

## 🏆 Phase 0.8 成功の要因分析

### 成功要因
1. **諦めない姿勢**: 10時間の継続的なデバッグ
2. **段階的アプローチ**: 問題を細分化して解決
3. **多角的な検証**: ローカル、EC2、Chrome DevToolsでの確認
4. **根本原因の追求**: 表面的な解決ではなく、根本原因の特定

### 学習効果
- **問題解決能力の向上**: 複雑な問題への対処法を習得
- **デバッグ技術の向上**: 効果的なデバッグ手法を確立
- **AWS サービスの理解深化**: ECR、Lambda、CloudFrontの連携理解
- **開発プロセスの改善**: より効率的な開発フローの確立

---

**Phase 0.8 の10時間のデバッグ経験は、今後の開発・運用において非常に価値のある資産となりました。この知見により、同様の問題が発生した場合の解決時間を大幅に短縮できます。**

## 🤖 AgentCore特有のトラブルシューティング

**最終更新**: 2026-01-05  
**対象**: Amazon Bedrock AgentCore機能（9つのConstruct）

このセクションでは、AgentCore機能特有の問題と解決策を提供します。

---

### 1. AgentCore Runtime問題

#### 問題1-1: Lambda実行エラー「Agent not found」

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

**予防策**:
- CDK設定ファイル（`cdk.context.json`）でAgent IDを管理
- デプロイ前にAgent IDの存在確認を実施
- CloudWatch Alarmsで404エラーを監視

---

#### 問題1-2: EventBridge統合エラー

**症状**:
```
Error: Failed to invoke Lambda function
EventBridge Rule: agent-core-runtime-rule
```

**原因**:
- Lambda関数の権限不足
- EventBridge Ruleのターゲット設定が誤っている
- DLQ（Dead Letter Queue）が満杯

**解決策**:
```bash
# 1. EventBridge Ruleの確認
aws events describe-rule \
  --name agent-core-runtime-rule

# 2. Lambda権限の確認
aws lambda get-policy \
  --function-name TokyoRegion-project-name-prod-AgentCoreRuntime-Function

# 3. DLQメッセージの確認
aws sqs receive-message \
  --queue-url [DLQ_URL] \
  --max-number-of-messages 10
```

**予防策**:
- IAM Roleに`lambda:InvokeFunction`権限を付与
- DLQのCloudWatch Alarmsを設定（メッセージ数 > 10）
- EventBridge Ruleのメトリクスを監視

---

### 2. AgentCore Gateway問題

#### 問題2-1: REST API変換エラー

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

**予防策**:
- OpenAPI仕様ファイルのCI/CD検証を追加
- FSxマウントポイントのヘルスチェックを実装
- S3バックアップからの自動復旧を設定

---

#### 問題2-2: MCP統合エラー「Connection timeout」

**症状**:
```
Error: Connection timeout to MCP server
Endpoint: https://mcp-server.example.com/tools
Timeout: 30s
```

**原因**:
- MCPサーバーがダウンしている
- ネットワーク接続の問題
- 認証トークンの有効期限切れ

**解決策**:
```bash
# 1. MCPサーバーのヘルスチェック
curl -X GET https://mcp-server.example.com/health

# 2. Lambda VPC設定の確認
aws lambda get-function-configuration \
  --function-name TokyoRegion-project-name-prod-AgentCoreGateway-McpIntegration \
  --query 'VpcConfig'

# 3. Secrets Managerの認証情報確認
aws secretsmanager get-secret-value \
  --secret-id mcp-server-credentials
```

**予防策**:
- MCPサーバーのヘルスチェックを定期実行
- タイムアウト値を60秒に延長
- OAuth2トークンの自動更新を実装

---

### 3. AgentCore Memory問題

#### 問題3-1: Memory Strategy設定エラー

**症状**:
```
Error: Invalid memory strategy configuration
Strategy: semantic
Error: Missing required parameter: extractionPrompt
```

**原因**:
- Memory Strategy設定が不完全
- カスタムExtraction Promptが未設定
- Memory Resourceが作成されていない

**解決策**:
```bash
# 1. Memory Resource確認
aws bedrock-agent list-memories \
  --agent-id [AGENT_ID] \
  --region ap-northeast-1

# 2. CDK設定ファイルの確認
cat cdk.context.json | jq '.agentCore.memory.strategies.semantic'

# 3. Memory Strategy再設定
aws bedrock-agent update-memory \
  --memory-id [MEMORY_ID] \
  --memory-configuration '{
    "strategies": {
      "semantic": {
        "enabled": true,
        "extractionPrompt": "Extract key information..."
      }
    }
  }'
```

**予防策**:
- Memory Strategy設定のバリデーションを追加
- デフォルトExtraction Promptを提供
- CloudWatch Logsでエラーを監視

---

#### 問題3-2: 短期メモリ取得エラー「No events found」

**症状**:
```
Error: No events found for session
SessionId: session-xxxxx
LastKTurns: 10
```

**原因**:
- セッションIDが誤っている
- イベントが書き込まれていない
- Memory APIの呼び出しエラー

**解決策**:
```bash
# 1. セッションIDの確認
aws bedrock-agent list-memory-sessions \
  --agent-id [AGENT_ID] \
  --region ap-northeast-1

# 2. イベント書き込みログの確認
aws logs filter-log-events \
  --log-group-name /aws/lambda/AgentCoreRuntime \
  --filter-pattern "writeEvent" \
  --start-time $(date -u -d '1 hour ago' +%s)000

# 3. Memory APIの手動テスト
aws bedrock-agent-runtime get-memory \
  --agent-id [AGENT_ID] \
  --session-id [SESSION_ID] \
  --memory-type EVENTS \
  --max-items 10
```

**予防策**:
- セッションID生成ロジックの標準化
- イベント書き込みの成功確認を追加
- Memory APIのリトライロジックを実装

---

### 4. AgentCore Identity問題

#### 問題4-1: RBAC権限エラー「Permission denied」

**症状**:
```
Error: Permission denied
User: user-xxxxx
Role: ReadOnly
Action: bedrock:InvokeAgent
```

**原因**:
- ユーザーのロールが不適切
- ロール権限マップが誤っている
- IAM Roleの権限不足

**解決策**:
```bash
# 1. ユーザーロールの確認
aws dynamodb get-item \
  --table-name AgentCoreIdentity \
  --key '{"agentId":{"S":"agent-xxxxx"},"userId":{"S":"user-xxxxx"}}'

# 2. ロール権限マップの確認
aws lambda invoke \
  --function-name TokyoRegion-project-name-prod-AgentCoreIdentity-Function \
  --payload '{"action":"getRolePermissions","role":"ReadOnly"}' \
  response.json

# 3. ロールの再割り当て
aws lambda invoke \
  --function-name TokyoRegion-project-name-prod-AgentCoreIdentity-Function \
  --payload '{"action":"assignRole","userId":"user-xxxxx","role":"User"}' \
  response.json
```

**予防策**:
- ロール権限マップのドキュメント化
- ユーザーロール変更のログ記録
- 権限エラーのCloudWatch Alarmsを設定

---

#### 問題4-2: ABAC属性評価エラー

**症状**:
```
Error: Attribute evaluation failed
Attribute: department
Value: undefined
Policy: require department=engineering
```

**原因**:
- ユーザー属性が未設定
- 属性ベースポリシーの構文エラー
- DynamoDBテーブルのデータ不整合

**解決策**:
```bash
# 1. ユーザー属性の確認
aws dynamodb get-item \
  --table-name AgentCoreIdentity \
  --key '{"agentId":{"S":"agent-xxxxx"},"userId":{"S":"user-xxxxx"}}' \
  --projection-expression "attributes"

# 2. 属性の追加
aws lambda invoke \
  --function-name TokyoRegion-project-name-prod-AgentCoreIdentity-Function \
  --payload '{
    "action":"updateAttributes",
    "userId":"user-xxxxx",
    "attributes":{"department":"engineering","project":"rag-system"}
  }' \
  response.json
```

**予防策**:
- ユーザー属性の必須項目を定義
- 属性ベースポリシーのバリデーションを追加
- DynamoDBテーブルのデータ整合性チェックを定期実行

---

### 5. AgentCore Browser問題

#### 問題5-1: Puppeteerタイムアウトエラー

**症状**:
```
Error: Navigation timeout exceeded
URL: https://example.com
Timeout: 30000ms
```

**原因**:
- ターゲットサイトの応答が遅い
- Lambda関数のタイムアウトが短い
- ネットワーク接続の問題

**解決策**:
```bash
# 1. Lambda関数のタイムアウト確認
aws lambda get-function-configuration \
  --function-name TokyoRegion-project-name-prod-AgentCoreBrowser-Function \
  --query 'Timeout'

# 2. タイムアウトを延長（最大900秒）
aws lambda update-function-configuration \
  --function-name TokyoRegion-project-name-prod-AgentCoreBrowser-Function \
  --timeout 300

# 3. Puppeteerタイムアウト設定の確認
aws lambda invoke \
  --function-name TokyoRegion-project-name-prod-AgentCoreBrowser-Function \
  --payload '{"action":"getConfig"}' \
  response.json
```

**予防策**:
- Puppeteerタイムアウトを60秒に設定
- Lambda関数タイムアウトを300秒に設定
- リトライロジックを実装（最大3回）

---

#### 問題5-2: スクリーンショット保存失敗

**症状**:
```
Error: Failed to save screenshot
Path: /tmp/screenshot-xxxxx.png
Error: No space left on device
```

**原因**:
- Lambda `/tmp`ディレクトリの容量不足（最大10GB）
- 古いスクリーンショットが削除されていない
- スクリーンショットサイズが大きすぎる

**解決策**:
```bash
# 1. Lambda Ephemeral Storage設定確認
aws lambda get-function-configuration \
  --function-name TokyoRegion-project-name-prod-AgentCoreBrowser-Function \
  --query 'EphemeralStorage'

# 2. Ephemeral Storageを拡張
aws lambda update-function-configuration \
  --function-name TokyoRegion-project-name-prod-AgentCoreBrowser-Function \
  --ephemeral-storage '{"Size": 2048}'

# 3. Lambda関数内でクリーンアップ実装
# /tmp内の古いファイルを削除するロジックを追加
```

**予防策**:
- スクリーンショット圧縮を有効化（quality: 80）
- 実行後に`/tmp`をクリーンアップ
- S3への自動アップロードを実装

---

### 6. AgentCore Code Interpreter問題

#### 問題6-1: コード実行タイムアウト

**症状**:
```
Error: Code execution timeout
Language: python
Timeout: 60s
Code: [長時間実行されるコード]
```

**原因**:
- 実行コードが無限ループしている
- 大量のデータ処理で時間がかかる
- Lambda関数のタイムアウトが短い

**解決策**:
```bash
# 1. 実行ログの確認
aws logs filter-log-events \
  --log-group-name /aws/lambda/AgentCoreCodeInterpreter \
  --filter-pattern "timeout" \
  --start-time $(date -u -d '1 hour ago' +%s)000

# 2. タイムアウト設定の確認
aws lambda get-function-configuration \
  --function-name TokyoRegion-project-name-prod-AgentCoreCodeInterpreter-Function \
  --query 'Timeout'

# 3. コード実行タイムアウトを延長
# CDK設定ファイルで codeExecutionTimeout を 120 に設定
```

**予防策**:
- コード実行前にタイムアウト推定を実装
- 無限ループ検出ロジックを追加
- 段階的タイムアウト（30秒 → 60秒 → 120秒）

---

#### 問題6-2: パッケージインストールエラー

**症状**:
```
Error: Failed to install package
Package: pandas==2.0.0
Error: No matching distribution found
```

**原因**:
- パッケージ名またはバージョンが誤っている
- PyPIへの接続エラー
- Lambda環境でサポートされていないパッケージ

**解決策**:
```bash
# 1. パッケージの存在確認
pip search pandas

# 2. Lambda Layerの確認
aws lambda list-layers \
  --compatible-runtime python3.11

# 3. 事前インストール済みパッケージの確認
aws lambda invoke \
  --function-name TokyoRegion-project-name-prod-AgentCoreCodeInterpreter-Function \
  --payload '{"action":"listPackages"}' \
  response.json
```

**予防策**:
- よく使うパッケージをLambda Layerに事前インストール
- パッケージバージョンの互換性チェックを追加
- PyPIミラーの設定（高速化）

---

### 7. AgentCore Observability問題

#### 問題7-1: X-Ray設定エラー「Segment not found」

**症状**:
```
Error: Segment not found
TraceId: 1-xxxxx-xxxxx
SegmentId: xxxxx
```

**原因**:
- X-Ray Daemonが起動していない
- Lambda関数でX-Rayトレーシングが無効
- IAM Roleに`xray:PutTraceSegments`権限がない

**解決策**:
```bash
# 1. Lambda関数のX-Ray設定確認
aws lambda get-function-configuration \
  --function-name TokyoRegion-project-name-prod-AgentCoreRuntime-Function \
  --query 'TracingConfig'

# 2. X-Rayトレーシングを有効化
aws lambda update-function-configuration \
  --function-name TokyoRegion-project-name-prod-AgentCoreRuntime-Function \
  --tracing-config Mode=Active

# 3. IAM Role権限の確認
aws iam get-role-policy \
  --role-name TokyoRegion-project-name-prod-AgentCoreRuntime-Role \
  --policy-name XRayPolicy
```

**予防策**:
- CDK設定で全Lambda関数のX-Rayを有効化
- IAM Roleに`AWSXRayDaemonWriteAccess`ポリシーを付与
- X-Rayサービスマップを定期確認

---

#### 問題7-2: CloudWatch Logs出力エラー

**症状**:
```
Error: Failed to write logs
LogGroup: /aws/lambda/AgentCoreRuntime
Error: ResourceNotFoundException
```

**原因**:
- CloudWatch Logsロググループが存在しない
- IAM Roleに`logs:CreateLogStream`権限がない
- ロググループの保持期間が0日に設定されている

**解決策**:
```bash
# 1. ロググループの存在確認
aws logs describe-log-groups \
  --log-group-name-prefix /aws/lambda/AgentCoreRuntime

# 2. ロググループを作成
aws logs create-log-group \
  --log-group-name /aws/lambda/AgentCoreRuntime

# 3. 保持期間を設定（30日）
aws logs put-retention-policy \
  --log-group-name /aws/lambda/AgentCoreRuntime \
  --retention-in-days 30
```

**予防策**:
- CDK設定でロググループを事前作成
- IAM Roleに`CloudWatchLogsFullAccess`ポリシーを付与
- ロググループの保持期間を30日に設定

---

### 8. AgentCore Evaluations問題

#### 問題8-1: 品質メトリクス計算エラー

**症状**:
```
Error: Failed to calculate quality metrics
Metric: accuracy
Error: Division by zero
```

**原因**:
- テストデータが空
- 期待値と実際の値の形式が一致しない
- メトリクス計算ロジックのバグ

**解決策**:
```bash
# 1. テストデータの確認
aws s3 ls s3://agentcore-evaluations-bucket/test-data/

# 2. 評価結果の確認
aws dynamodb query \
  --table-name AgentCoreEvaluations \
  --key-condition-expression "evaluationId = :id" \
  --expression-attribute-values '{":id":{"S":"eval-xxxxx"}}'

# 3. メトリクス計算の手動実行
aws lambda invoke \
  --function-name TokyoRegion-project-name-prod-AgentCoreEvaluations-Function \
  --payload '{
    "action":"calculateMetrics",
    "evaluationId":"eval-xxxxx",
    "metrics":["accuracy","precision","recall"]
  }' \
  response.json
```

**予防策**:
- テストデータのバリデーションを追加
- メトリクス計算前のゼロ除算チェック
- 計算エラー時のデフォルト値を設定

---

#### 問題8-2: A/Bテスト結果の不整合

**症状**:
```
Error: A/B test results inconsistent
Variant A: 100 requests
Variant B: 0 requests
Expected: 50/50 split
```

**原因**:
- トラフィック分割ロジックのバグ
- セッションIDのハッシュ計算エラー
- Variant B Lambda関数がダウンしている

**解決策**:
```bash
# 1. トラフィック分割設定の確認
aws lambda get-alias \
  --function-name TokyoRegion-project-name-prod-AgentCoreRuntime-Function \
  --name prod

# 2. Variant B Lambda関数の確認
aws lambda get-function \
  --function-name TokyoRegion-project-name-prod-AgentCoreRuntime-Function-VariantB

# 3. A/Bテスト統計の確認
aws cloudwatch get-metric-statistics \
  --namespace AgentCore/Evaluations \
  --metric-name VariantRequests \
  --dimensions Name=Variant,Value=A Name=Variant,Value=B \
  --start-time $(date -u -d '1 hour ago' --iso-8601) \
  --end-time $(date -u --iso-8601) \
  --period 3600 \
  --statistics Sum
```

**予防策**:
- トラフィック分割ロジックの単体テスト追加
- Variant B Lambda関数のヘルスチェック実装
- CloudWatch Alarmsでトラフィック不均衡を検出

---

### 9. AgentCore Policy問題

#### 問題9-1: Cedar検証エラー「Policy syntax error」

**症状**:
```
Error: Cedar policy validation failed
Policy: policy-xxxxx
Error: Unexpected token at line 5
```

**原因**:
- Cedar構文エラー
- 自然言語からCedarへの変換エラー
- ポリシーテンプレートのバグ

**解決策**:
```bash
# 1. Cedarポリシーの確認
aws s3 cp s3://agentcore-policy-bucket/policies/policy-xxxxx.cedar -

# 2. Cedar検証ツールで確認
# Cedar CLIをインストール
cargo install cedar-policy-cli

# ポリシーを検証
cedar validate --schema schema.json --policies policy-xxxxx.cedar

# 3. ポリシーの再生成
aws lambda invoke \
  --function-name TokyoRegion-project-name-prod-AgentCorePolicy-Function \
  --payload '{
    "action":"convertPolicy",
    "naturalLanguage":"Allow users in engineering department to invoke agent"
  }' \
  response.json
```

**予防策**:
- Cedar構文チェックをCI/CDに追加
- 自然言語パーサーの単体テスト強化
- ポリシーテンプレートのバリデーション追加

---

#### 問題9-2: ポリシー競合エラー

**症状**:
```
Error: Policy conflict detected
Policy A: Allow action=InvokeAgent
Policy B: Deny action=InvokeAgent
Result: Ambiguous
```

**原因**:
- 複数のポリシーが競合している
- ポリシー優先順位が未定義
- Cedarの評価順序が誤っている

**解決策**:
```bash
# 1. 全ポリシーの確認
aws s3 ls s3://agentcore-policy-bucket/policies/

# 2. ポリシー競合チェック
aws lambda invoke \
  --function-name TokyoRegion-project-name-prod-AgentCorePolicy-Function \
  --payload '{
    "action":"checkConflicts",
    "userId":"user-xxxxx",
    "action":"InvokeAgent"
  }' \
  response.json

# 3. ポリシー優先順位の設定
# CDK設定ファイルで policyPriority を設定
# 1. Explicit Deny（最優先）
# 2. Explicit Allow
# 3. Default Deny（デフォルト）
```

**予防策**:
- ポリシー競合検出ツールを実装
- ポリシー優先順位を明確化
- ポリシー変更時の影響分析を実施

---

### 10. パフォーマンス問題の診断手順

#### 診断フロー

**Phase 1: 問題の特定（5分以内）**

```bash
# 1. Lambda関数のメトリクス確認
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Duration \
  --dimensions Name=FunctionName,Value=TokyoRegion-project-name-prod-AgentCoreRuntime-Function \
  --start-time $(date -u -d '1 hour ago' --iso-8601) \
  --end-time $(date -u --iso-8601) \
  --period 300 \
  --statistics Average,Maximum

# 2. エラー率の確認
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Errors \
  --dimensions Name=FunctionName,Value=TokyoRegion-project-name-prod-AgentCoreRuntime-Function \
  --start-time $(date -u -d '1 hour ago' --iso-8601) \
  --end-time $(date -u --iso-8601) \
  --period 300 \
  --statistics Sum

# 3. スロットリング確認
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Throttles \
  --dimensions Name=FunctionName,Value=TokyoRegion-project-name-prod-AgentCoreRuntime-Function \
  --start-time $(date -u -d '1 hour ago' --iso-8601) \
  --end-time $(date -u --iso-8601) \
  --period 300 \
  --statistics Sum
```

**Phase 2: 根本原因の分析（15分以内）**

```bash
# 1. X-Rayトレースの確認
aws xray get-trace-summaries \
  --start-time $(date -u -d '1 hour ago' +%s) \
  --end-time $(date -u +%s) \
  --filter-expression 'service("TokyoRegion-project-name-prod-AgentCoreRuntime-Function")'

# 2. 最も遅いトレースの詳細確認
aws xray batch-get-traces \
  --trace-ids [TRACE_ID_1] [TRACE_ID_2]

# 3. CloudWatch Logs Insightsでクエリ
aws logs start-query \
  --log-group-name /aws/lambda/AgentCoreRuntime \
  --start-time $(date -u -d '1 hour ago' +%s) \
  --end-time $(date -u +%s) \
  --query-string '
    fields @timestamp, @duration, @message
    | filter @type = "REPORT"
    | stats avg(@duration), max(@duration), min(@duration) by bin(5m)
  '
```

**Phase 3: 最適化の実施（30分以内）**

```bash
# 1. Lambda関数のメモリ増加（パフォーマンス向上）
aws lambda update-function-configuration \
  --function-name TokyoRegion-project-name-prod-AgentCoreRuntime-Function \
  --memory-size 3008

# 2. Provisioned Concurrencyの設定（コールドスタート削減）
aws lambda put-provisioned-concurrency-config \
  --function-name TokyoRegion-project-name-prod-AgentCoreRuntime-Function \
  --provisioned-concurrent-executions 5 \
  --qualifier prod

# 3. タイムアウトの調整
aws lambda update-function-configuration \
  --function-name TokyoRegion-project-name-prod-AgentCoreRuntime-Function \
  --timeout 300
```

---

### 11. エラーログの読み方

#### Lambda関数のログ構造

**標準ログフォーマット**:
```
[TIMESTAMP] [REQUEST_ID] [LOG_LEVEL] [MESSAGE]
```

**例**:
```
2026-01-05T10:30:45.123Z abc123-def456-ghi789 INFO Agent invocation started
2026-01-05T10:30:45.456Z abc123-def456-ghi789 ERROR Failed to invoke agent: Agent not found
2026-01-05T10:30:45.789Z abc123-def456-ghi789 REPORT Duration: 234.56 ms Billed Duration: 300 ms Memory Size: 2048 MB Max Memory Used: 512 MB
```

#### ログレベルの意味

| レベル | 意味 | 対応 |
|--------|------|------|
| DEBUG | デバッグ情報 | 開発時のみ有効化 |
| INFO | 通常の情報 | 正常動作の確認 |
| WARN | 警告 | 注意が必要だが動作は継続 |
| ERROR | エラー | 即座の対応が必要 |
| FATAL | 致命的エラー | 緊急対応が必要 |

#### よくあるエラーパターン

**1. Agent not found**
```
ERROR Failed to invoke agent: Agent not found
```
→ 環境変数`BEDROCK_AGENT_ID`を確認

**2. Permission denied**
```
ERROR Permission denied: User user-xxxxx does not have permission to invoke agent
```
→ IAM RoleまたはRBAC/ABAC設定を確認

**3. Timeout**
```
ERROR Task timed out after 30.00 seconds
```
→ Lambda関数のタイムアウト設定を延長

**4. Memory exceeded**
```
ERROR Runtime exited with error: signal: killed
REPORT Max Memory Used: 2048 MB Memory Size: 2048 MB
```
→ Lambda関数のメモリサイズを増加

**5. Cold start**
```
REPORT Init Duration: 5000.00 ms Duration: 234.56 ms
```
→ Provisioned Concurrencyを設定

---

### 12. エスカレーション手順

#### レベル1: 自己解決（30分以内）

**対応者**: 開発者

**手順**:
1. このトラブルシューティングガイドを確認
2. CloudWatch Logsでエラーログを確認
3. 既知の問題と解決策を適用
4. 解決しない場合はレベル2へエスカレーション

---

#### レベル2: チーム内エスカレーション（2時間以内）

**対応者**: シニア開発者またはチームリーダー

**手順**:
1. X-Rayトレースで根本原因を分析
2. CloudWatch Metricsでパフォーマンス問題を確認
3. 複数のAgentCore機能にまたがる問題の可能性を検討
4. 解決しない場合はレベル3へエスカレーション

**エスカレーション情報**:
- エラーメッセージ全文
- CloudWatch Logsのリンク
- X-Ray Trace ID
- 再現手順
- 試した解決策

---

#### レベル3: AWS Supportエスカレーション（4時間以内）

**対応者**: システム管理者

**手順**:
1. AWS Support Caseを作成
2. 以下の情報を提供:
   - AWS Account ID
   - リージョン
   - Lambda関数名
   - エラーメッセージ
   - CloudWatch Logsのリンク
   - X-Ray Trace ID
   - 再現手順
3. AWS Supportからの回答を待つ
4. 解決策を実施し、結果を記録

**AWS Support Case作成コマンド**:
```bash
aws support create-case \
  --subject "AgentCore Runtime Lambda function error" \
  --service-code "amazon-bedrock" \
  --category-code "using-aws" \
  --severity-code "urgent" \
  --communication-body "
    Error: Agent not found
    Function: TokyoRegion-project-name-prod-AgentCoreRuntime-Function
    Region: ap-northeast-1
    Logs: https://console.aws.amazon.com/cloudwatch/...
  "
```

---

### 13. よくある問題のFAQ

#### Q1: AgentCore機能を有効化したが動作しない

**A**: 以下を確認してください:
1. CDK設定ファイル（`cdk.context.json`）で`enabled: true`になっているか
2. `cdk deploy`を実行したか
3. Lambda関数が正しくデプロイされているか
4. 環境変数が正しく設定されているか

```bash
# 確認コマンド
aws lambda list-functions --query 'Functions[?contains(FunctionName, `AgentCore`)].FunctionName'
```

---

#### Q2: Lambda関数のコールドスタートが遅い

**A**: 以下の対策を実施してください:
1. Provisioned Concurrencyを設定（推奨: 5インスタンス）
2. Lambda関数のメモリサイズを増加（推奨: 2048MB以上）
3. 不要な依存関係を削除
4. Lambda Layersを活用

```bash
# Provisioned Concurrency設定
aws lambda put-provisioned-concurrency-config \
  --function-name [FUNCTION_NAME] \
  --provisioned-concurrent-executions 5 \
  --qualifier prod
```

---

#### Q3: DynamoDBのスロットリングエラーが発生する

**A**: 以下を確認してください:
1. DynamoDBテーブルのAuto Scalingが有効か
2. Read/Write Capacity Unitsが適切か
3. GSI（Global Secondary Index）のキャパシティも確認

```bash
# Auto Scaling設定確認
aws application-autoscaling describe-scalable-targets \
  --service-namespace dynamodb \
  --resource-ids table/AgentCoreIdentity
```

---

#### Q4: Memory機能で長期メモリが抽出されない

**A**: 以下を確認してください:
1. Memory Strategiesが有効化されているか（Semantic, Summary, User Preference）
2. イベントが正しく書き込まれているか
3. Extraction Promptが適切か

```bash
# Memory Strategies確認
aws bedrock-agent get-memory \
  --memory-id [MEMORY_ID] \
  --query 'memoryConfiguration.strategies'
```

---

#### Q5: Browser機能でスクリーンショットが取得できない

**A**: 以下を確認してください:
1. Lambda関数のEphemeral Storageが十分か（推奨: 2048MB）
2. Puppeteerのタイムアウト設定が適切か（推奨: 60秒）
3. ターゲットサイトがアクセス可能か

```bash
# Ephemeral Storage確認
aws lambda get-function-configuration \
  --function-name [FUNCTION_NAME] \
  --query 'EphemeralStorage'
```

---

#### Q6: Code Interpreter機能でパッケージがインストールできない

**A**: 以下を確認してください:
1. パッケージ名とバージョンが正しいか
2. Lambda Layerに事前インストールされているか
3. PyPIへの接続が可能か

```bash
# Lambda Layer確認
aws lambda list-layers \
  --compatible-runtime python3.11
```

---

#### Q7: Observability機能でX-Rayトレースが表示されない

**A**: 以下を確認してください:
1. Lambda関数でX-Rayトレーシングが有効か
2. IAM Roleに`xray:PutTraceSegments`権限があるか
3. X-Ray SDKが正しく初期化されているか

```bash
# X-Ray設定確認
aws lambda get-function-configuration \
  --function-name [FUNCTION_NAME] \
  --query 'TracingConfig'
```

---

#### Q8: Evaluations機能でA/Bテストが動作しない

**A**: 以下を確認してください:
1. Variant A/B Lambda関数が両方デプロイされているか
2. トラフィック分割設定が正しいか（50/50）
3. セッションIDが正しく生成されているか

```bash
# Lambda Alias確認
aws lambda get-alias \
  --function-name [FUNCTION_NAME] \
  --name prod
```

---

#### Q9: Policy機能でCedarポリシーが適用されない

**A**: 以下を確認してください:
1. Cedarポリシーの構文が正しいか
2. ポリシーがS3バケットに保存されているか
3. ポリシー評価ロジックが正しく実装されているか

```bash
# Cedarポリシー確認
aws s3 ls s3://agentcore-policy-bucket/policies/
```

---

#### Q10: 複数のAgentCore機能を同時に使用するとエラーが発生する

**A**: 以下を確認してください:
1. Lambda関数のタイムアウトが十分か（推奨: 300秒）
2. Lambda関数のメモリサイズが十分か（推奨: 3008MB）
3. 各機能の依存関係が正しく設定されているか

```bash
# Lambda設定確認
aws lambda get-function-configuration \
  --function-name [FUNCTION_NAME] \
  --query '{Timeout:Timeout,MemorySize:MemorySize}'
```

---

## 📚 関連ドキュメント

- **運用手順書**: `docs/guides/agentcore-operations-manual.md`
- **監視・アラート設定ガイド**: `docs/guides/agentcore-monitoring-guide.md`（作成予定）
- **デプロイガイド**: `docs/guides/agentcore-deployment-guide.md`
- **実装ガイド**: `docs/guides/bedrock-agentcore-implementation-guide.md`

---

**このガイドは継続的に更新されます。新しい問題と解決策が見つかり次第、追加してください。**
