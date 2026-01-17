/**
 * Bedrock パラメータ設定パネル
 * 
 * パラメータ設定のみに特化（モデル選択機能は完全に削除）
 */

import React, { useState } from 'react';
import { useChatStore } from '../../store/useChatStore';

// パラメータプリセット設定
const PARAMETER_PRESETS = {
  creative: { 
    name: 'creative',
    description: '創造性重視型 - 創造的な出力を促進する設定',
    temperature: 0.9, 
    topP: 0.95 
  },
  balanced: { 
    name: 'balanced',
    description: 'バランス型 - 汎用的な用途に適したバランスの取れた設定',
    temperature: 0.7, 
    topP: 0.9 
  },
  precise: { 
    name: 'precise',
    description: '高精度型 - 正確性を重視した保守的な設定',
    temperature: 0.3, 
    topP: 0.7 
  },
} as const;

// デフォルトパラメータ設定
const DEFAULT_PARAMETERS = {
  temperature: 0.7,
  maxTokens: 4000,
  topP: 0.9,
} as const;

// パラメータ制約設定
const PARAMETER_CONSTRAINTS = {
  temperature: { min: 0.0, max: 1.0, step: 0.1 },
  maxTokens: { min: 100, max: 8000, step: 100 },
  topP: { min: 0.1, max: 1.0, step: 0.05 },
} as const;

type PresetName = keyof typeof PARAMETER_PRESETS;

interface BedrockParameterPanelProps {
  selectedModelId?: string;
}

export const BedrockParameterPanel: React.FC<BedrockParameterPanelProps> = ({ 
  selectedModelId 
}) => {
  // チャット履歴設定
  const { saveHistory, setSaveHistory } = useChatStore();

  // パラメータ状態管理
  const [parameters, setParameters] = useState(DEFAULT_PARAMETERS);
  const [selectedPreset, setSelectedPreset] = useState<PresetName | 'custom'>('balanced');

  // プリセット適用
  const applyPreset = (presetName: PresetName) => {
    const preset = PARAMETER_PRESETS[presetName];
    setParameters(prev => ({
      ...prev,
      temperature: preset.temperature,
      topP: preset.topP
    }));
    setSelectedPreset(presetName);
  };

  // リセット機能
  const handleReset = () => {
    setParameters(DEFAULT_PARAMETERS);
    setSelectedPreset('balanced');
  };

  // プリセット変更ハンドラー
  const handlePresetChange = (value: string) => {
    if (value === 'custom') {
      setSelectedPreset('custom');
    } else {
      applyPreset(value as PresetName);
    }
  };

  // パラメータ変更ハンドラー
  const handleParameterChange = (key: keyof typeof parameters, value: number) => {
    setParameters(prev => ({ ...prev, [key]: value }));
    setSelectedPreset('custom');
  };

  return (
    <div className="space-y-4">
      {/* ヘッダー */}
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium text-gray-700">パラメータ調整</span>
        <button
          onClick={handleReset}
          className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
        >
          リセット
        </button>
      </div>

      {/* チャット履歴保存設定 */}
      <div className="border-b border-gray-200 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              チャット履歴保存
            </label>
            <p className="text-xs text-gray-500 mt-1">
              会話履歴をサーバーに保存します（デフォルト: 無効）
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={saveHistory}
              onChange={(e) => setSaveHistory(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>
        {saveHistory && (
          <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-xs text-blue-700">
              ✅ チャット履歴が保存されます。過去の会話を後から参照できます。
            </p>
          </div>
        )}
        {!saveHistory && (
          <div className="mt-2 p-2 bg-gray-50 border border-gray-200 rounded-md">
            <p className="text-xs text-gray-600">
              ℹ️ チャット履歴は保存されません。セッション終了時に削除されます。
            </p>
          </div>
        )}
      </div>

      {/* プリセット選択 */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          プリセット設定
        </label>
        <select
          value={selectedPreset}
          onChange={(e) => handlePresetChange(e.target.value)}
          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-900"
        >
          <option value="custom">カスタム設定</option>
          {Object.entries(PARAMETER_PRESETS).map(([key, preset]) => (
            <option key={key} value={key}>
              {preset.description}
            </option>
          ))}
        </select>
      </div>

      {/* Temperature */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Temperature: {parameters.temperature}
        </label>
        <input
          type="range"
          min={PARAMETER_CONSTRAINTS.temperature.min}
          max={PARAMETER_CONSTRAINTS.temperature.max}
          step={PARAMETER_CONSTRAINTS.temperature.step}
          value={parameters.temperature}
          onChange={(e) => handleParameterChange('temperature', parseFloat(e.target.value))}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>保守的 ({PARAMETER_CONSTRAINTS.temperature.min})</span>
          <span>創造的 ({PARAMETER_CONSTRAINTS.temperature.max})</span>
        </div>
      </div>

      {/* Max Tokens */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          最大トークン数: {parameters.maxTokens.toLocaleString()}
        </label>
        <input
          type="range"
          min={PARAMETER_CONSTRAINTS.maxTokens.min}
          max={PARAMETER_CONSTRAINTS.maxTokens.max}
          step={PARAMETER_CONSTRAINTS.maxTokens.step}
          value={parameters.maxTokens}
          onChange={(e) => handleParameterChange('maxTokens', parseInt(e.target.value))}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>短い ({PARAMETER_CONSTRAINTS.maxTokens.min})</span>
          <span>長い ({PARAMETER_CONSTRAINTS.maxTokens.max.toLocaleString()})</span>
        </div>
      </div>

      {/* Top P */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Top P: {parameters.topP}
        </label>
        <input
          type="range"
          min={PARAMETER_CONSTRAINTS.topP.min}
          max={PARAMETER_CONSTRAINTS.topP.max}
          step={PARAMETER_CONSTRAINTS.topP.step}
          value={parameters.topP}
          onChange={(e) => handleParameterChange('topP', parseFloat(e.target.value))}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>集中的 ({PARAMETER_CONSTRAINTS.topP.min})</span>
          <span>多様性 ({PARAMETER_CONSTRAINTS.topP.max})</span>
        </div>
      </div>

      {/* パラメータ情報 */}
      <div className="p-2 bg-gray-50 rounded-md">
        <div className="text-xs text-gray-600">
          <div className="font-medium mb-1">現在の設定</div>
          <div className="space-y-1">
            <div>Temperature: {parameters.temperature} (創造性レベル)</div>
            <div>Max Tokens: {parameters.maxTokens.toLocaleString()} (応答長)</div>
            <div>Top P: {parameters.topP} (語彙多様性)</div>
          </div>
        </div>
      </div>

      {/* 注意事項 */}
      <div className="p-2 bg-blue-50 border border-blue-200 rounded-md">
        <div className="text-xs text-blue-700">
          <div className="font-medium mb-1">💡 ヒント</div>
          <div>AIモデルの変更は上部の「AIモデル選択」セクションで行ってください。</div>
        </div>
      </div>
    </div>
  );
};
