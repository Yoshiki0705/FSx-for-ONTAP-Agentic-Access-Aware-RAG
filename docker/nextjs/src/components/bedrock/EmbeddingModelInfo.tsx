'use client';

import { useState, useEffect } from 'react';

interface EmbeddingModel {
  id: string;
  name: string;
  provider: string;
  dimensions: number;
  maxTokens: number;
}

export function EmbeddingModelInfo() {
  const [embeddingModel, setEmbeddingModel] = useState<EmbeddingModel | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // デフォルトの埋め込みモデル情報を設定
    const defaultEmbeddingModel: EmbeddingModel = {
      id: 'amazon.titan-embed-text-v1',
      name: 'Titan Text Embeddings',
      provider: 'Amazon',
      dimensions: 1536,
      maxTokens: 8192
    };

    setEmbeddingModel(defaultEmbeddingModel);
    setIsLoading(false);
  }, []);

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
          <div className="h-3 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (!embeddingModel) {
    return (
      <div className="bg-yellow-50 rounded-lg border border-yellow-200 p-4">
        <p className="text-yellow-800 text-sm">埋め込みモデル情報を取得できませんでした。</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <h3 className="text-sm font-medium text-gray-900 mb-3">埋め込みモデル情報</h3>
      
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">モデル名:</span>
          <span className="font-medium text-gray-900">{embeddingModel.name}</span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-gray-600">プロバイダー:</span>
          <span className="font-medium text-gray-900">{embeddingModel.provider}</span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-gray-600">次元数:</span>
          <span className="font-medium text-gray-900">{embeddingModel.dimensions}</span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-gray-600">最大トークン:</span>
          <span className="font-medium text-gray-900">{embeddingModel.maxTokens.toLocaleString()}</span>
        </div>
      </div>
      
      <div className="mt-3 pt-3 border-t border-gray-100">
        <p className="text-xs text-gray-500">
          文書の埋め込み処理に使用されるモデルです。
        </p>
      </div>
    </div>
  );
}
