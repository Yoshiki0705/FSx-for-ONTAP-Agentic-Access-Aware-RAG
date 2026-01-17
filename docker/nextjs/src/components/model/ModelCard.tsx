'use client';

import React from 'react';
import { BedrockModel } from '@/config/bedrock-models';
import { Check, Zap, Image, Type } from 'lucide-react';

interface ModelCardProps {
  model: BedrockModel;
  isSelected: boolean;
  isAvailable: boolean;
  onSelect: () => void;
}

export const ModelCard: React.FC<ModelCardProps> = ({
  model,
  isSelected,
  isAvailable,
  onSelect,
}) => {
  return (
    <div
      className={`
        relative p-4 rounded-lg border-2 cursor-pointer transition-all
        ${isSelected 
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
        }
        ${!isAvailable && 'opacity-50 cursor-not-allowed'}
      `}
      onClick={isAvailable ? onSelect : undefined}
    >
      {isSelected && (
        <div className="absolute top-2 right-2">
          <Check className="w-5 h-5 text-blue-500" />
        </div>
      )}
      
      <div className="flex items-center space-x-2 mb-2">
        <Zap className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        <h3 className="font-semibold text-gray-900 dark:text-gray-100">
          {model.name}
        </h3>
      </div>
      
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
        {model.description}
      </p>
      
      <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
        <span>{model.provider}</span>
        <div className="flex items-center space-x-1">
          {model.modality.includes('text') && <Type className="w-3 h-3" />}
          {model.modality.includes('image') && <Image className="w-3 h-3" />}
        </div>
        <span>{model.maxTokens.toLocaleString()} tokens</span>
      </div>
      
      {!isAvailable && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-gray-800/80 rounded-lg">
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
            利用不可
          </span>
        </div>
      )}
    </div>
  );
};