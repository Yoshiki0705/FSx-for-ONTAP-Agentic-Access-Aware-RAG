'use client';

import { useState, useEffect } from 'react';

interface PolicyConsentDialogProps {
  onConsent: () => void;
}

const CONSENT_KEY = 'ai-policy-consented';
const CONSENT_VERSION = '1.0'; // バージョン変更で再同意を要求

/**
 * AI利用ポリシー同意ダイアログ (T-2)
 *
 * 初回サインイン時に表示し、ユーザーの同意を記録する。
 * localStorage に同意状態を保存（バージョン管理付き）。
 */
export function PolicyConsentDialog({ onConsent }: PolicyConsentDialogProps) {
  const [visible, setVisible] = useState(false);
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(CONSENT_KEY);
    if (stored !== CONSENT_VERSION) {
      setVisible(true);
    }
  }, []);

  const handleConsent = () => {
    if (!agreed) return;
    localStorage.setItem(CONSENT_KEY, CONSENT_VERSION);
    setVisible(false);
    onConsent();
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-lg w-full mx-4 p-6">
        <h2 className="text-lg font-semibold mb-4">AI利用ポリシーへの同意</h2>

        <div className="text-sm text-gray-600 dark:text-gray-300 space-y-3 max-h-60 overflow-y-auto mb-4">
          <p>本システムをご利用いただくにあたり、以下の事項にご同意ください。</p>

          <div className="space-y-2">
            <p className="font-medium">1. AI回答の位置づけ</p>
            <p>AI回答は参考情報であり、最終判断は利用者ご自身の責任で行ってください。</p>

            <p className="font-medium">2. 使用制限</p>
            <p>法的判断、医療判断、人事判断、財務判断など、専門家の判断が必要な場面ではAI回答を最終根拠にしないでください。</p>

            <p className="font-medium">3. データの取り扱い</p>
            <p>入力した質問と回答は品質改善のために記録される場合があります。個人情報を含む質問は避けてください。</p>

            <p className="font-medium">4. フィードバック</p>
            <p>問題のある回答を発見した場合は、速やかに管理者に報告してください。</p>
          </div>
        </div>

        <label className="flex items-start gap-2 mb-4 cursor-pointer">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 rounded border-gray-300"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">
            上記のAI利用ポリシーに同意します
          </span>
        </label>

        <button
          onClick={handleConsent}
          disabled={!agreed}
          className={`w-full py-2 px-4 rounded-md text-white font-medium transition-colors ${
            agreed
              ? 'bg-blue-600 hover:bg-blue-700'
              : 'bg-gray-300 cursor-not-allowed'
          }`}
        >
          同意して利用を開始
        </button>
      </div>
    </div>
  );
}

/**
 * ポリシー同意状態を確認するユーティリティ
 */
export function hasPolicyConsent(): boolean {
  if (typeof window === 'undefined') return true; // SSR時はtrue
  return localStorage.getItem(CONSENT_KEY) === CONSENT_VERSION;
}
