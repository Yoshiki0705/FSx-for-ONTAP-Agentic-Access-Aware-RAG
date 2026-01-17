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

