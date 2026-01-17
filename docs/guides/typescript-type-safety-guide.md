# TypeScript型安全性ガイド

**最終更新**: 2025-11-25  
**対象**: CDK開発者全員  
**目的**: 型安全なコードベースの維持

---

## 🎯 基本原則

### 1. `any`型の使用禁止

**❌ 禁止**:
```typescript
export interface WebAppStackProps {
  readonly networkingStack?: any; // 絶対禁止
  readonly securityStack?: any;   // 絶対禁止
}
```

**✅ 推奨**:
```typescript
import { INetworkingStack, ISecurityStack } from './interfaces/stack-interfaces';

export interface WebAppStackProps {
  readonly networkingStack?: INetworkingStack; // 型安全
  readonly securityStack?: ISecurityStack;     // 型安全
}
```

---

## 📚 Stack間インターフェース定義

### インターフェースファイルの場所

```
lib/stacks/integrated/interfaces/stack-interfaces.ts
```

### 定義済みインターフェース

#### INetworkingStack
```typescript
export interface INetworkingStack {
  readonly vpc: ec2.IVpc;
  readonly publicSubnets: ec2.ISubnet[];
  readonly privateSubnets: ec2.ISubnet[];
  readonly isolatedSubnets: ec2.ISubnet[];
  readonly securityGroups: { [key: string]: ec2.ISecurityGroup };
  readonly webAppSecurityGroup?: ec2.ISecurityGroup;
}
```

#### ISecurityStack
```typescript
export interface ISecurityStack {
  readonly kmsKey: kms.IKey;
  readonly wafWebAclArn?: string;
  readonly lambdaExecutionRole?: iam.IRole;
  readonly guardrailArn?: string;
  readonly guardrailId?: string;
}
```

#### IDataStack
```typescript
export interface IDataStack {
  readonly tableArns: string[];
  readonly bucketArns: string[];
  readonly opensearchCollectionName?: string;
  readonly fsxFileSystemId?: string;
}
```

#### IEmbeddingStack
```typescript
export interface IEmbeddingStack {
  readonly embeddingFunctionArn: string;
  readonly batchJobDefinitionArn?: string;
  readonly batchJobQueueArn?: string;
}
```

#### IOperationsStack
```typescript
export interface IOperationsStack {
  readonly logGroupName: string;
  readonly alertTopicArn: string;
  readonly xrayEnabled: boolean;
}
```

---

## 🔍 なぜ型安全性が重要なのか

### 問題点：`any`型の危険性

#### ❌ 修正前（`any`型）

```typescript
constructor(scope: Construct, id: string, props: WebAppStackProps) {
  // ❌ タイポしてもエラーにならない
  const vpc = props.networkingStack.vcp; // 正しくは vpc
  
  // ❌ 存在しないプロパティでもエラーにならない
  const subnet = props.networkingStack.myCustomSubnet;
  
  // ❌ IDEの補完が効かない
  props.networkingStack. // ← 何も候補が出ない
}
```

**結果**: コンパイルは通るが、実行時に `undefined` エラーでクラッシュ 💥

---

#### ✅ 修正後（インターフェース定義）

```typescript
constructor(scope: Construct, id: string, props: WebAppStackProps) {
  // ✅ タイポするとコンパイルエラー
  const vpc = props.networkingStack.vcp;
  // ↑ Error: Property 'vcp' does not exist on type 'INetworkingStack'
  
  // ✅ 存在しないプロパティはエラー
  const subnet = props.networkingStack.myCustomSubnet;
  // ↑ Error: Property 'myCustomSubnet' does not exist
  
  // ✅ IDEの補完が効く
  props.networkingStack. // ← vpc, publicSubnets, privateSubnets... が候補に出る
}
```

**結果**: コンパイル時にエラーを検出、実行前に問題を発見 ✅

---

## 🏗️ 依存性逆転の原則（DIP）

### ❌ 悪い例：具象クラスへの依存

```typescript
import { NetworkingStack } from './networking-stack';

export interface WebAppStackProps {
  readonly networkingStack?: NetworkingStack; // 具象クラス
}
```

**問題点**:
- NetworkingStackの実装変更がWebAppStackに影響
- テストが困難（モックを作りにくい）
- 循環依存のリスク

---

### ✅ 良い例：インターフェースへの依存

```typescript
import { INetworkingStack } from './interfaces/stack-interfaces';

export interface WebAppStackProps {
  readonly networkingStack?: INetworkingStack; // インターフェース
}
```

**メリット**:
1. **疎結合** - 実装の詳細を隠蔽
2. **テスト容易** - モックを簡単に作成可能
3. **拡張性** - 異なる実装を差し替え可能
4. **保守性** - 変更の影響範囲を限定

---

## 📋 開発ガイドライン

### 新しいStackを作成する場合

#### Step 1: インターフェースを定義

```typescript
// lib/stacks/integrated/interfaces/stack-interfaces.ts に追加

export interface IMyNewStack {
  readonly myResource: SomeType;
  readonly myOptionalResource?: AnotherType;
}
```

#### Step 2: Stackクラスで実装

```typescript
// lib/stacks/integrated/my-new-stack.ts

import { IMyNewStack } from './interfaces/stack-interfaces';

export class MyNewStack extends cdk.Stack implements IMyNewStack {
  public readonly myResource: SomeType;
  public readonly myOptionalResource?: AnotherType;
  
  constructor(scope: Construct, id: string, props: MyNewStackProps) {
    super(scope, id, props);
    // 実装...
  }
}
```

#### Step 3: 他のStackから参照

```typescript
// lib/stacks/integrated/another-stack.ts

import { IMyNewStack } from './interfaces/stack-interfaces';

export interface AnotherStackProps extends cdk.StackProps {
  readonly myNewStack?: IMyNewStack; // ✅ インターフェースを使用
}
```

---

### 既存のStackを修正する場合

#### Step 1: 現在の公開プロパティを確認

```typescript
export class ExistingStack extends cdk.Stack {
  public readonly resource1: Type1;
  public readonly resource2: Type2;
  // ...
}
```

#### Step 2: インターフェースを定義

```typescript
export interface IExistingStack {
  readonly resource1: Type1;
  readonly resource2: Type2;
}
```

#### Step 3: `any`型を置き換え

```typescript
// Before
readonly existingStack?: any;

// After
readonly existingStack?: IExistingStack;
```

---

## ✅ チェックリスト

新しいコードを書く際は、以下を確認してください：

- [ ] `any`型を使用していない
- [ ] Stack間の依存はインターフェースを使用
- [ ] 公開プロパティは明示的に型定義
- [ ] オプショナルプロパティは`?`を使用
- [ ] IDEの補完が正しく動作する
- [ ] TypeScriptビルドエラーが0件

---

## 🚨 コードレビュー時の確認事項

レビュアーは以下を確認してください：

1. **`any`型の使用**
   - `any`型が使用されている場合は差し戻し
   - 正当な理由がある場合のみ例外を認める

2. **インターフェースの使用**
   - Stack間の依存は必ずインターフェースを使用
   - 具象クラスへの直接依存は禁止

3. **型定義の完全性**
   - 全てのプロパティに型が定義されている
   - オプショナルプロパティは適切に`?`を使用

4. **コンパイルエラー**
   - TypeScriptビルドエラーが0件
   - 統合スタック（lib/stacks/integrated/）にエラーがない

---

## 📊 効果測定

### 型安全性指標

- **目標**: `any`型使用率 0%
- **現状**: 統合スタックで100%達成 ✅
- **測定方法**: `grep -r "any" lib/stacks/integrated/`

### ビルドエラー指標

- **目標**: 統合スタックでエラー0件
- **現状**: 0件 ✅
- **測定方法**: `npm run build 2>&1 | grep "lib/stacks/integrated"`

---

## 🔗 関連ドキュメント

- [CDKアーキテクチャ統廃合 - 実装タスク](.kiro/specs/cdk-architecture-consolidation/tasks.md)
- [Phase 7: コード品質向上レポート](../development/docs/reports/local/phase-7-code-quality-improvement-20251125.md)
- [Stack間インターフェース定義](../lib/stacks/integrated/interfaces/stack-interfaces.ts)

---

## 💡 ベストプラクティス

### 1. インターフェースファーストで設計

新しいStackを作る前に、まずインターフェースを定義する。

### 2. 最小限の公開プロパティ

必要最小限のプロパティのみを公開する。

### 3. 不変性の保持

全てのプロパティに`readonly`を使用する。

### 4. 明示的な型定義

型推論に頼らず、明示的に型を定義する。

### 5. ドキュメントコメント

公開インターフェースには必ずJSDocコメントを追加する。

---

## 🎓 学習リソース

- [TypeScript公式ドキュメント - Interfaces](https://www.typescriptlang.org/docs/handbook/interfaces.html)
- [SOLID原則 - 依存性逆転の原則](https://en.wikipedia.org/wiki/Dependency_inversion_principle)
- [AWS CDK TypeScript Workshop](https://cdkworkshop.com/20-typescript.html)

---

**このガイドに従うことで、型安全で保守しやすいコードベースを維持できます。**
