'use client';

import { useCustomTranslations } from '@/hooks/useCustomTranslations';
import { useLocale } from 'next-intl';

/**
 * アクセシビリティt("permissions.available")コンポーネントの使用例
 * 
 * このファイルは、実装したアクセシビリティt("permissions.available")コンポーネントの
 * 使用方法を示すサンプルです。
 */
import { Button } from '../ui/Button';
import { Link } from '../ui/Link';
import { useInteractiveStyles } from '../../hooks/useInteractiveStyles';
import { useTheme } from '../../contexts/ThemeContext';
import { getStateColor } from '../../lib/color-utils';

/**
 * ボタンコンポーネントの使用例
 */
  const locale = useLocale();
  const t = useCustomTranslations(locale);

export function ButtonExamples() {
  return (
    <div className="space-y-4 p-6">
      <h2 className="text-xl font-bold mb-4">ボタンの使用例</h2>
      
      {/* プライマリボタン */}
      <div className="space-x-2">
        <Button variant="default" size="sm">
          小サイズ
        </Button>
        <Button variant="default" size="default">
          中サイズ
        </Button>
        <Button variant="default" size="lg">
          大サイズ
        </Button>
      </div>

      {/* 各バリアント */}
      <div className="space-x-2">
        <Button variant="default">プライマリ</Button>
        <Button variant="secondary">セカンダリ</Button>
        <Button variant="destructive">削除</Button>
        <Button variant="ghost">ゴースト</Button>
      </div>

      {/* 無効状態 */}
      <div className="space-x-2">
        <Button variant="default" disabled>
          無効なボタン
        </Button>
      </div>

      {/* フルワイド */}
      <Button variant="default" className="w-full">
        フルワイドボタン
      </Button>
    </div>
  );
}

/**
 * リンクコンポーネントの使用例
 */

export function LinkExamples() {
  return (
    <div className="space-y-4 p-6">
      <h2 className="text-xl font-bold mb-4">リンクの使用例</h2>
      
      {/* 内部リンク */}
      <div>
        <Link href="/about">
          内部リンク
        </Link>
      </div>

      {/* 外部リンク */}
      <div>
        <Link href="https://example.com" external>
          外部リンク（新しいタブで開く）
        </Link>
      </div>
    </div>
  );
}

/**
 * カスタムインタラクティブ要素の使用例
 */

export function CustomInteractiveExample() {
  const { getInteractiveStyle } = useInteractiveStyles();
  const { theme } = useTheme();

  return (
    <div className="space-y-4 p-6">
      <h2 className="text-xl font-bold mb-4">カスタムインタラクティブ要素</h2>
      
      <div
        className={`
          p-4 rounded-lg cursor-pointer
          ${theme === 'dark' ? 'bg-gray-800 text-gray-100' : 'bg-white text-gray-900'}
          ${getInteractiveStyle()}
        `}
        onClick={() => alert('クリックされました！')}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            alert('クリックされました！');
          }
        }}
      >
        クリック可能なカスタム要素
      </div>
    </div>
  );
}

/**
 * 状態カラーの使用例
 */

export function StateColorExamples() {
  const { theme } = useTheme();

  const successColor = getStateColor('success', theme);
  const warningColor = getStateColor('warning', theme);
  const errorColor = getStateColor('error', theme);
  const infoColor = getStateColor('info', theme);

  return (
    <div className="space-y-4 p-6">
      <h2 className="text-xl font-bold mb-4">状態カラーの使用例</h2>
      
      {/* 成功メッセージ */}
      <div className={`p-4 rounded-lg border ${successColor.bg} ${successColor.text} ${successColor.border}`}>
        <div className="flex items-center space-x-2">
          <span className="text-xl">{successColor.icon}</span>
          <span className="font-medium">成功: 操作が完了しました</span>
        </div>
      </div>

      {/* 警告メッセージ */}
      <div className={`p-4 rounded-lg border ${warningColor.bg} ${warningColor.text} ${warningColor.border}`}>
        <div className="flex items-center space-x-2">
          <span className="text-xl">{warningColor.icon}</span>
          <span className="font-medium">警告: 注意が必要です</span>
        </div>
      </div>

      {/* エラーメッセージ */}
      <div className={`p-4 rounded-lg border ${errorColor.bg} ${errorColor.text} ${errorColor.border}`}>
        <div className="flex items-center space-x-2">
          <span className="text-xl">{errorColor.icon}</span>
          <span className="font-medium">エラー: 問題が発生しました</span>
        </div>
      </div>

      {/* 情報メッセージ */}
      <div className={`p-4 rounded-lg border ${infoColor.bg} ${infoColor.text} ${infoColor.border}`}>
        <div className="flex items-center space-x-2">
          <span className="text-xl">{infoColor.icon}</span>
          <span className="font-medium">情報: お知らせがあります</span>
        </div>
      </div>
    </div>
  );
}

/**
 * 全ての使用例を表示するコンポーネント
 */

export function AccessibilityExamples() {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <h1 className="text-3xl font-bold text-center my-8">
        アクセシビリティt("permissions.available")コンポーネント使用例
      </h1>
      
      <div className="space-y-8">
        <ButtonExamples />
        <LinkExamples />
        <CustomInteractiveExample />
        <StateColorExamples />
      </div>

      <div className="p-6 bg-blue-50 dark:bg-blue-900 rounded-lg">
        <h3 className="font-bold mb-2">アクセシビリティのポイント</h3>
        <ul className="space-y-2 text-sm">
          <li>✅ WCAG 2.1 AAレベルのコントラスト比を確保</li>
          <li>✅ キーボードナビゲーションt("permissions.available")（Tabキーで移動）</li>
          <li>✅ フォーカス表示の明確化（ring-2）</li>
          <li>✅ カラーブラインドネスt("permissions.available")（色+アイコン）</li>
          <li>✅ スクリーンリーダーt("permissions.available")（適切なARIA属性）</li>
        </ul>
      </div>
    </div>
  );
}
