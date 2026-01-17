# テーマ切り替え機能実装ガイド

## 概要

このガイドでは、Next.js 15 + Tailwind CSS + Zustandを使用したテーマ切り替え機能の実装方法と、よくある問題の解決方法を説明します。

## アーキテクチャ

### コンポーネント構成

```
src/
├── store/
│   └── useThemeStore.ts          # Zustandストア（状態管理）
├── components/
│   ├── providers/
│   │   └── ThemeProvider.tsx     # テーマプロバイダー
│   └── ui/
│       └── ThemeToggle.tsx       # テーマ切り替えボタン
├── app/
│   └── globals.css               # グローバルCSS
└── tailwind.config.js            # Tailwind CSS設定
```

## 実装手順

### 1. Tailwind CSS設定（最重要）

**問題**: システムのダークモード設定（`prefers-color-scheme: dark`）がTailwindの`dark:`クラスに影響する

**解決策**: `darkMode`設定を明示的に指定

```javascript
// tailwind.config.js
module.exports = {
  darkMode: ['class', '[data-theme="dark"]'], // ← システム設定を無視
  // ...
}
```

**重要ポイント**:
- `darkMode: 'class'`だけでは不十分な場合がある
- 配列形式で`['class', '[data-theme="dark"]']`を指定することで、メディアクエリを完全に無効化
- これにより、システムがダークモードでもアプリケーションのライトモードが正しく表示される

### 2. Zustandストア実装

```typescript
// src/store/useThemeStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useThemeStore = create()(
  persist(
    (set, get) => ({
      theme: 'light', // デフォルトテーマ
      effectiveTheme: 'light',

      setTheme: (theme: ThemeMode) => {
        const effectiveTheme = getEffectiveTheme(theme);
        set({ theme, effectiveTheme });
        
        // DOMにクラスを適用
        if (typeof window !== 'undefined') {
          requestAnimationFrame(() => {
            const root = window.document.documentElement;
            const body = window.document.body;
            
            // 既存のテーマクラスを削除
            root.classList.remove('light', 'dark');
            body.classList.remove('light', 'dark');
            
            // 新しいテーマクラスを追加
            root.classList.add(effectiveTheme);
            body.classList.add(effectiveTheme);
            
            // data-theme属性も設定
            root.setAttribute('data-theme', effectiveTheme);
            body.setAttribute('data-theme', effectiveTheme);
          });
        }
      },
    }),
    {
      name: 'theme-storage',
      partialize: (state) => ({ theme: state.theme }),
    }
  )
);
```

**重要ポイント**:
- `requestAnimationFrame`を使用してDOM更新のタイミングを制御
- `light`と`dark`の両方のクラスを明示的に削除してから追加
- `data-theme`属性も設定して、Tailwind CSSの複数のセレクタに対応

### 3. ThemeProvider実装

```typescript
// src/components/providers/ThemeProvider.tsx
'use client';

import { useEffect } from 'react';
import { useThemeStore } from '@/store/useThemeStore';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { effectiveTheme, initializeTheme } = useThemeStore();

  useEffect(() => {
    initializeTheme();
  }, [initializeTheme]);

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;

    // 既存のテーマクラスを削除
    root.classList.remove('light', 'dark');
    body.classList.remove('light', 'dark');

    // 新しいテーマクラスを追加
    root.classList.add(effectiveTheme);
    body.classList.add(effectiveTheme);
  }, [effectiveTheme]);

  return <>{children}</>;
}
```

**重要ポイント**:
- `light`クラスも明示的に追加する（削除だけでは不十分）
- `effectiveTheme`の変更を監視してDOMを更新

### 4. グローバルCSS設定

```css
/* src/app/globals.css */

/* ライトモード時の明示的な背景色 */
html:not(.dark),
html:not(.dark) body {
  background-color: #ffffff !important;
  color: #0a0a0a !important;
}

/* ダークモード時の明示的な背景色 */
html.dark,
html.dark body {
  background-color: #111827 !important;
  color: #f9fafb !important;
}
```

**重要ポイント**:
- `!important`を使用してTailwindのデフォルトスタイルを上書き
- `html:not(.dark)`でライトモード時のスタイルを明示的に指定

## よくある問題と解決方法

### 問題1: システムのダークモード設定が優先される

**症状**:
- HTMLに`light`クラスが付いているのに、画面が暗いまま
- `window.matchMedia('(prefers-color-scheme: dark)').matches`が`true`

**原因**:
- Tailwind CSSが`@media (prefers-color-scheme: dark)`を生成している
- `darkMode: 'class'`設定が正しく機能していない

**解決策**:
```javascript
// tailwind.config.js
module.exports = {
  darkMode: ['class', '[data-theme="dark"]'], // ← 配列形式で指定
}
```

### 問題2: テーマ切り替えボタンが反応しない

**症状**:
- ボタンをクリックしても何も起こらない
- コンソールにエラーが出ない

**原因**:
- イベントハンドラーが正しく設定されていない
- Zustandストアの初期化タイミングの問題

**解決策**:
```typescript
// ThemeToggle.tsx
const handleClick = useCallback(() => {
  const currentTheme = theme === 'light' ? 'dark' : 'light';
  setTheme(currentTheme);
}, [theme, setTheme]);

return (
  <button onClick={handleClick}>
    {/* アイコン */}
  </button>
);
```

### 問題3: ページリロード後にテーマが戻る

**症状**:
- テーマを変更してもリロード後にデフォルトに戻る

**原因**:
- localStorageへの保存が機能していない
- Zustandの`persist`ミドルウェアの設定ミス

**解決策**:
```typescript
export const useThemeStore = create()(
  persist(
    (set, get) => ({
      // ...
    }),
    {
      name: 'theme-storage', // ← localStorageのキー名
      partialize: (state) => ({ theme: state.theme }), // ← 保存する状態を指定
    }
  )
);
```

## デバッグ方法

### ブラウザコンソールでの確認

```javascript
// 1. HTMLクラスの確認
const html = document.documentElement;
console.log('HTML classes:', html.className);
console.log('Has dark class:', html.classList.contains('dark'));
console.log('Has light class:', html.classList.contains('light'));

// 2. システムのダークモード設定を確認
console.log('System prefers dark:', window.matchMedia('(prefers-color-scheme: dark)').matches);

// 3. 実際の背景色を確認
const main = document.querySelector('.h-screen');
console.log('Computed background:', window.getComputedStyle(main).backgroundColor);

// 4. localStorageの確認
console.log('Stored theme:', localStorage.getItem('theme-storage'));
```

### よくあるエラーパターン

| 症状 | 原因 | 解決策 |
|------|------|--------|
| `light`クラスがあるのに暗い | システムのダークモード設定が優先 | `darkMode: ['class', '[data-theme="dark"]']`に変更 |
| ボタンが反応しない | イベントハンドラーの問題 | `useCallback`を使用 |
| リロード後に戻る | localStorageの問題 | `persist`ミドルウェアの設定確認 |
| 切り替えが遅い | DOM更新のタイミング | `requestAnimationFrame`を使用 |

## デプロイ時の注意事項

### 1. ビルド前の確認

```bash
# Tailwind設定の確認
cat docker/nextjs/tailwind.config.js | grep darkMode

# 期待される出力:
# darkMode: ['class', '[data-theme="dark"]'],
```

### 2. EC2同期とデプロイ

```bash
# 1. ファイルをEC2に同期
rsync -avz --exclude 'node_modules' --exclude '.next' \
  ./docker/nextjs/src/ \
  ubuntu@ec2:/home/ubuntu/project/docker/nextjs/src/

# 2. Tailwind設定も同期
rsync -avz \
  ./docker/nextjs/tailwind.config.js \
  ubuntu@ec2:/home/ubuntu/project/docker/nextjs/

# 3. EC2でビルド・デプロイ
ssh ec2 "cd project && bash deployment-script.sh"

# 4. CloudFrontキャッシュクリア
bash invalidate-cloudfront.sh
```

### 3. デプロイ後の検証

```bash
# Lambda関数の更新日時を確認
aws lambda get-function \
  --function-name YourFunction \
  --query 'Configuration.LastModified'

# CloudFrontキャッシュの状態を確認
aws cloudfront get-invalidation \
  --distribution-id YOUR_DIST_ID \
  --id YOUR_INVALIDATION_ID
```

## ベストプラクティス

### 1. デフォルトテーマの設定

```typescript
// useThemeStore.ts
export const useThemeStore = create()(
  persist(
    (set, get) => ({
      theme: 'light', // ← デフォルトはライトモード推奨
      effectiveTheme: 'light',
      // ...
    }),
    // ...
  )
);
```

### 2. アクセシビリティ対応

```typescript
// ThemeToggle.tsx
<button
  onClick={handleClick}
  aria-label={theme === 'light' ? 'ダークモードに切り替え' : 'ライトモードに切り替え'}
  className="..."
>
  {/* アイコン */}
</button>
```

### 3. パフォーマンス最適化

```typescript
// requestAnimationFrameを使用してDOM更新を最適化
requestAnimationFrame(() => {
  root.classList.add(effectiveTheme);
  body.classList.add(effectiveTheme);
});
```

## トラブルシューティングチェックリスト

デプロイ後にテーマが正しく動作しない場合、以下を確認：

- [ ] `tailwind.config.js`の`darkMode`設定が`['class', '[data-theme="dark"]']`になっているか
- [ ] `globals.css`に明示的な背景色設定があるか
- [ ] ThemeProviderが`light`クラスを追加しているか（削除だけでなく）
- [ ] Zustandストアの`persist`ミドルウェアが正しく設定されているか
- [ ] CloudFrontキャッシュがクリアされているか
- [ ] Lambda関数が最新のイメージで更新されているか
- [ ] ブラウザのキャッシュがクリアされているか

## 参考リンク

- [Tailwind CSS Dark Mode](https://tailwindcss.com/docs/dark-mode)
- [Zustand Persist Middleware](https://docs.pmnd.rs/zustand/integrations/persisting-store-data)
- [Next.js 15 App Router](https://nextjs.org/docs/app)

---

**最終更新**: 2025-11-29
**バージョン**: 1.0.0
