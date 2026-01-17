# Agent選択変更イベント連動 - トラブルシューティングガイド

**バージョン**: v2.8.1  
**最終更新**: 2026年1月8日  
**対象**: Agent選択変更イベント連動修正

## 🎯 概要

このガイドでは、Agent選択変更イベント連動機能で発生する可能性のある問題と、その解決方法を詳しく説明します。

## 🔍 よくある問題と解決方法

### 問題1: 「Agent選択中...」メッセージが表示される

#### 症状
- Agent選択ドロップダウンでAgentを選択しても、Introduction Textが「Agent選択中...」と表示される
- Agent情報が正しく反映されない

#### 原因
- Agent選択変更イベントの発火タイミングが不適切
- Agent情報の統合ロジックに問題がある
- イベントリスナーが正しく設定されていない

#### 解決方法

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

##### 3. ページリロードによるリセット
```bash
# 完全なページリロード
Cmd+R (Mac) / Ctrl+R (Windows)

# または、URLを直接入力
https://d3p7l2uoh6npdr.cloudfront.net/ja/genai?mode=agent
```

### 問題2: 新しいチャット作成時にAgent情報が反映されない

#### 症状
- 「新しいチャット」ボタンをクリックしても、Agent情報がIntroduction Textに反映されない
- 前のチャットでは正常に表示されていた

#### 原因
- 新しいチャット作成時のAgent情報取得ロジックに問題
- Agent情報の統合順序が不適切

#### 解決方法

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

##### 3. Agent情報の手動設定
```javascript
// 開発者ツールのConsoleで実行
const agentInfo = {
  agentId: 'permission-aware-rag-dev-rag-agent',
  agentName: 'RAG Agent',
  status: 'PREPARED',
  version: 'DRAFT'
};

localStorage.setItem('agentInfo', JSON.stringify(agentInfo));
localStorage.setItem('selectedAgentId', agentInfo.agentId);

// Agent選択変更イベントを発火
window.dispatchEvent(new CustomEvent('agent-selection-changed', {
  detail: { agentInfo, source: 'Manual-Fix' }
}));
```

### 問題3: 初期化時にAgent情報が表示されない

#### 症状
- ページロード時にAgent情報が表示されない
- 数秒後に表示される場合がある

#### 原因
- 初期化時のイベント発火タイミングが遅い
- Agent情報の読み込み完了前にコンポーネントが初期化される

#### 解決方法

##### 1. 初期化完了まで待機
```bash
# 症状が発生した場合:
# 1. 5-10秒待機してAgent情報の読み込み完了を確認
# 2. 自動的に表示されない場合は以下の対処を実行
```

##### 2. 初期化イベントの手動発火
```javascript
// 開発者ツールのConsoleで実行
setTimeout(() => {
  const agentInfo = JSON.parse(localStorage.getItem('agentInfo') || 'null');
  if (agentInfo) {
    window.dispatchEvent(new CustomEvent('agent-selection-changed', {
      detail: { agentInfo, source: 'Manual-Init' }
    }));
  }
}, 1000);
```

##### 3. Agent選択の再実行
```bash
# 手順:
# 1. サイドバーのAgent選択ドロップダウンを開く
# 2. 任意のAgentを選択（現在選択されているものでも可）
# 3. Introduction Textが更新されることを確認
```

### 問題4: イベントリスナーの重複

#### 症状
- Agent選択変更時に複数回イベントが発火する
- Consoleに同じログが複数回表示される

#### 原因
- ページ遷移時にイベントリスナーが適切にクリーンアップされていない
- 複数のコンポーネントが同じイベントリスナーを登録している

#### 解決方法

##### 1. ページリロードによるリセット
```bash
# 完全なページリロード
Cmd+R (Mac) / Ctrl+R (Windows)
```

##### 2. イベントリスナーの確認と削除
```javascript
// 開発者ツールのConsoleで実行

// 現在のイベントリスナーを確認
if (window.getEventListeners) {
  console.log('Event Listeners:', window.getEventListeners(window));
}

// 全てのagent-selection-changedイベントリスナーを削除
const events = window.getEventListeners ? window.getEventListeners(window) : {};
if (events['agent-selection-changed']) {
  events['agent-selection-changed'].forEach(listener => {
    window.removeEventListener('agent-selection-changed', listener.listener);
  });
}

// ページリロード
location.reload();
```

### 問題5: CloudFrontキャッシュによる古いコードの実行

#### 症状
- 修正内容が反映されない
- 古いバージョンのコードが実行されている

#### 原因
- CloudFrontのキャッシュが更新されていない
- ブラウザキャッシュが古い

#### 解決方法

##### 1. CloudFrontキャッシュ無効化の確認
```bash
# キャッシュ無効化の状況確認
aws cloudfront get-invalidation \
  --distribution-id E3J5C6S69J4ZQY \
  --id INVALIDATION_ID \
  --query 'Invalidation.Status'

# 結果が"Completed"になるまで待機（通常5-10分）
```

##### 2. ハードリロードの実行
```bash
# ブラウザキャッシュを無視してリロード
Cmd+Shift+R (Mac) / Ctrl+Shift+R (Windows)
```

##### 3. 開発者ツールでキャッシュ無効化
```bash
# 手順:
# 1. F12で開発者ツールを開く
# 2. Networkタブを選択
# 3. 「Disable cache」にチェック
# 4. ページをリロード
# 5. テスト完了後は「Disable cache」のチェックを外す
```

## 🧪 デバッグ手順

### ステップ1: 基本状態の確認

```javascript
// 開発者ツールのConsoleで実行
console.log('=== Agent選択状態確認 ===');
console.log('selectedAgentId:', localStorage.getItem('selectedAgentId'));
console.log('agentInfo:', JSON.parse(localStorage.getItem('agentInfo') || 'null'));
console.log('URL:', window.location.href);
console.log('Mode:', new URLSearchParams(window.location.search).get('mode'));
```

### ステップ2: イベントリスナーの確認

```javascript
// イベントリスナーの状況確認
console.log('=== イベントリスナー確認 ===');
if (window.getEventListeners) {
  const listeners = window.getEventListeners(window);
  console.log('agent-selection-changed listeners:', 
    listeners['agent-selection-changed'] ? listeners['agent-selection-changed'].length : 0
  );
} else {
  console.log('getEventListeners not available');
}
```

### ステップ3: Agent情報の手動テスト

```javascript
// Agent情報の手動設定とテスト
console.log('=== Agent情報手動テスト ===');
const testAgentInfo = {
  agentId: 'test-agent-123',
  agentName: 'Test Agent',
  alias: 'test-alias',
  status: 'PREPARED',
  version: 'DRAFT',
  latestAgentVersion: 'DRAFT'
};

// イベント発火
window.dispatchEvent(new CustomEvent('agent-selection-changed', {
  detail: { 
    agentInfo: testAgentInfo,
    timestamp: Date.now(),
    source: 'Manual-Test'
  }
}));

console.log('テストイベント発火完了');
```

### ステップ4: Introduction Text生成の確認

```javascript
// Introduction Text生成ロジックのテスト
console.log('=== Introduction Text生成テスト ===');

// 現在のIntroduction Textを確認
const introElement = document.querySelector('[data-testid="introduction-text"]') || 
                    document.querySelector('.introduction-text') ||
                    document.querySelector('div:contains("Agent選択中")');

if (introElement) {
  console.log('現在のIntroduction Text:', introElement.textContent);
} else {
  console.log('Introduction Text要素が見つかりません');
}
```

## 📊 ログ分析

### 正常な動作時のログパターン

```
🔄 初期化時のAgent情報発火: {agentId: "xxx", agentName: "xxx", agentsCount: 1}
✅ Agent情報を含むIntroduction Text生成: {agentId: "xxx", source: "selectedAgentInfo"}
🔍 Agent情報統合結果: {selectedAgentInfo: true, agentInfo: false, effectiveAgentInfo: false, finalInfo: true, source: "selected"}
```

### 問題発生時のログパターン

```
❌ Agent情報が見つかりません
⚠️ Agent選択中...
🔍 Agent情報統合結果: {selectedAgentInfo: false, agentInfo: false, effectiveAgentInfo: false, finalInfo: false, source: "none"}
```

## 🚨 緊急対処法

### 即座に実行すべき対処（1分以内）

```javascript
// 1. 全てのAgent関連データをクリア
localStorage.removeItem('selectedAgentId');
localStorage.removeItem('agentInfo');
localStorage.removeItem('effectiveAgentInfo');

// 2. ページリロード
location.reload();

// 3. Agent再選択（ページロード後）
// サイドバーのAgent選択ドロップダウンから任意のAgentを選択
```

### 根本的な解決（5分以内）

```bash
# 1. ハードリロード実行
Cmd+Shift+R (Mac) / Ctrl+Shift+R (Windows)

# 2. 開発者ツールでキャッシュ無効化
# F12 → Network → Disable cache → リロード

# 3. CloudFrontキャッシュ状況確認
# 管理者に確認依頼

# 4. 別ブラウザでのテスト
# Chrome、Safari、Firefoxで同様の問題が発生するか確認
```

## 📞 エスカレーション基準

以下の場合は開発チームにエスカレーション：

### レベル1: 軽微な問題（自己解決可能）
- 一時的な「Agent選択中...」表示
- ページリロードで解決する問題
- 特定のブラウザでのみ発生する問題

### レベル2: 中程度の問題（サポート必要）
- 複数のブラウザで同様の問題が発生
- ハードリロードでも解決しない
- Agent情報が全く表示されない

### レベル3: 重大な問題（緊急対応必要）
- 全ユーザーに影響する問題
- システム全体の機能停止
- データ損失の可能性

## 📋 チェックリスト

### 問題発生時の確認事項
- [ ] ブラウザキャッシュをクリアしたか
- [ ] ハードリロードを実行したか
- [ ] 開発者ツールでエラーを確認したか
- [ ] 他のブラウザでも同様の問題が発生するか
- [ ] CloudFrontキャッシュ無効化が完了しているか

### 解決後の確認事項
- [ ] Agent選択変更が即座に反映されるか
- [ ] 新しいチャット作成時にAgent情報が反映されるか
- [ ] 初期化時にAgent情報が表示されるか
- [ ] 「Agent選択中...」メッセージが表示されないか
- [ ] 複数回のAgent選択変更が正常に動作するか

## 🎯 予防策

### 定期的なメンテナンス
- ブラウザキャッシュの定期的なクリア
- 開発者ツールでのエラーログ確認
- 異なるブラウザでの動作確認

### 開発時の注意点
- イベントリスナーの適切なクリーンアップ
- Agent情報の統合ロジックの一貫性維持
- エラーハンドリングの充実

---

**このガイドで解決しない問題がある場合は、開発チームまでお問い合わせください。**

**作成者**: Kiro AI Assistant  
**最終更新**: 2026年1月8日 15:30:00 JST