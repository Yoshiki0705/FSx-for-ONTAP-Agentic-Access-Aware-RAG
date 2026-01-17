# テストガイドライン - Permission-aware RAG System

## 📁 テスト構造

```
src/__tests__/
├── components/           # コンポーネントテスト
│   ├── AgentModeSidebar/ # 分離されたテストスイート
│   │   ├── AgentModeSidebar.test.tsx           # 基本テスト
│   │   ├── AgentModeSidebar.error.test.tsx     # エラーハンドリング
│   │   ├── AgentModeSidebar.performance.test.tsx # パフォーマンス
│   │   └── index.ts                            # エクスポート
│   └── AgentModeSidebar.integration.test.tsx   # 統合テスト
├── hooks/                # カスタムフックテスト
├── utils/                # ユーティリティテスト
└── utils/                # テストヘルパー
    ├── test-helpers.tsx          # 共通ヘルパー
    ├── performance-helpers.ts    # パフォーマンステスト用
    └── README.md                 # このファイル
```

## 🧪 テストカテゴリ

### 1. 基本テスト (`*.test.tsx`)
- **目的**: 基本的なレンダリングとProps受け渡し
- **対象**: 正常系の動作確認
- **実行頻度**: 毎回

### 2. エラーハンドリングテスト (`*.error.test.tsx`)
- **目的**: エラー状態と警告の表示
- **対象**: 異常系の動作確認
- **実行頻度**: 毎回

### 3. パフォーマンステスト (`*.performance.test.tsx`)
- **目的**: レンダリング速度とメモリ使用量
- **対象**: パフォーマンス要件の確認
- **実行頻度**: CI/CD時

### 4. 統合テスト (`*.integration.test.tsx`)
- **目的**: コンポーネント間の連携
- **対象**: エンドツーエンドの動作確認
- **実行頻度**: リリース前

## 🛠️ テストヘルパー使用方法

### 基本的なレンダリング
```typescript
import { renderWithIntl, createMockAgentInfo } from '../utils/test-helpers';

const mockAgentInfo = createMockAgentInfo({ agentId: 'TEST123' });
renderWithIntl(<MyComponent agentInfo={mockAgentInfo} />);
```

### パフォーマンステスト
```typescript
import { measureRenderTime, expectRenderTimeWithin } from '../utils/performance-helpers';

const renderTime = await measureRenderTime(() => {
  renderWithIntl(<MyComponent />);
});
expectRenderTimeWithin(renderTime, 50); // 50ms以内
```

## 📊 カバレッジ要件

- **全体**: 80%以上
- **重要コンポーネント**: 90%以上
- **ユーティリティ関数**: 90%以上

## 🚀 実行コマンド

```bash
# 全テスト実行
npm test

# ウォッチモード
npm run test:watch

# カバレッジ付き実行
npm run test:coverage

# 特定ファイルのテスト
npm test AgentModeSidebar

# パフォーマンステストのみ
npm test -- --testNamePattern="パフォーマンス"
```

## 🔧 モック戦略

### 1. 軽量モック
- 基本テストとエラーテストで使用
- 最小限の実装で高速実行

### 2. 詳細モック
- 統合テストで使用
- 実際の動作に近い実装

### 3. パフォーマンス用モック
- React.memo を使用した最適化モック
- レンダリング回数の測定が可能

## ⚠️ 注意事項

1. **テストファイル分離**: 1ファイル200行以下を目安
2. **モック管理**: 各テストファイルで適切なモックを使用
3. **型安全性**: `any` 型の使用を避け、適切な型定義を使用
4. **セキュリティ**: テストデータのサニタイズを実施
5. **パフォーマンス**: 重いテストは専用ファイルに分離