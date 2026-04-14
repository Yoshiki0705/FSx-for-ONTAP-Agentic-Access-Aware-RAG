/**
 * 音声機能の利用可否判定フック
 */

import { useState, useEffect } from 'react';

interface UseVoiceCapabilityReturn {
  /** 環境変数で音声チャットが有効か */
  isVoiceChatEnabled: boolean;
  /** ブラウザがマイクアクセスをサポートしているか */
  isMicrophoneSupported: boolean;
  /** マイクアクセスが許可されているか（null = 未確認） */
  isMicrophonePermitted: boolean | null;
  /** 総合判定: 音声チャットが利用可能か */
  canUseVoice: boolean;
}

export function useVoiceCapability(): UseVoiceCapabilityReturn {
  const [isVoiceChatEnabled, setIsVoiceChatEnabled] = useState(false);
  const [isMicrophoneSupported, setIsMicrophoneSupported] = useState(false);
  const [isMicrophonePermitted, setIsMicrophonePermitted] = useState<boolean | null>(null);

  useEffect(() => {
    // ブラウザ対応チェック
    const supported = typeof navigator !== 'undefined'
      && !!navigator.mediaDevices
      && typeof navigator.mediaDevices.getUserMedia === 'function';
    setIsMicrophoneSupported(supported);

    // 音声チャット設定を取得
    fetch('/api/voice/config')
      .then(res => res.json())
      .then(config => setIsVoiceChatEnabled(config.enabled))
      .catch(() => setIsVoiceChatEnabled(false));

    // マイク許可状態の確認（Permissions API対応ブラウザのみ）
    if (typeof navigator !== 'undefined' && navigator.permissions) {
      navigator.permissions.query({ name: 'microphone' as PermissionName })
        .then(status => {
          setIsMicrophonePermitted(status.state === 'granted');
          status.onchange = () => {
            setIsMicrophonePermitted(status.state === 'granted');
          };
        })
        .catch(() => {
          // Permissions API非対応 — 実際のgetUserMedia呼び出しで判定
          setIsMicrophonePermitted(null);
        });
    }
  }, []);

  const canUseVoice = isVoiceChatEnabled && isMicrophoneSupported && isMicrophonePermitted !== false;

  return { isVoiceChatEnabled, isMicrophoneSupported, isMicrophonePermitted, canUseVoice };
}
