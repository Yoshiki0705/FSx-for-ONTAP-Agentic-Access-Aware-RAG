'use client';

import React from 'react';
import { Settings, Sliders } from 'lucide-react';

interface AdvancedSettingsProps {
  temperature: number;
  maxTokens: number;
  topP: number;
  onTemperatureChange: (value: number) => void;
  onMaxTokensChange: (value: number) => void;
  onTopPChange: (value: number) => void;
}

export default function AdvancedSettings({
  temperature,
  maxTokens,
  topP,
  onTemperatureChange,
  onMaxTokensChange,
  onTopPChange
}: AdvancedSettingsProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-3">
        <Sliders className="w-4 h-4 text-gray-600" />
        <h3 className="text-sm font-medium text-gray-700">詳細設定</h3>
      </div>

      {/* Temperature */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm text-gray-700">Temperature</label>
          <span className="text-sm font-medium text-gray-900">{temperature}</span>
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={temperature}
          onChange={(e) => onTemperatureChange(parseFloat(e.target.value))}
          className="w-full"
        />
        <p className="text-xs text-gray-500">
          創造性の度合い（0: 保守的、1: 創造的）
        </p>
      </div>

      {/* Max Tokens */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm text-gray-700">Max Tokens</label>
          <span className="text-sm font-medium text-gray-900">{maxTokens}</span>
        </div>
        <input
          type="range"
          min="100"
          max="4000"
          step="100"
          value={maxTokens}
          onChange={(e) => onMaxTokensChange(parseInt(e.target.value))}
          className="w-full"
        />
        <p className="text-xs text-gray-500">
          最大応答トークン数
        </p>
      </div>

      {/* Top P */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm text-gray-700">Top P</label>
          <span className="text-sm font-medium text-gray-900">{topP}</span>
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={topP}
          onChange={(e) => onTopPChange(parseFloat(e.target.value))}
          className="w-full"
        />
        <p className="text-xs text-gray-500">
          応答の多様性（0: 決定的、1: 多様）
        </p>
      </div>
    </div>
  );
}
