/**
 * 画像フォールバック処理カスタムフック
 * 
 * 画像読み込みエラー時の処理を抽象化
 * 改善: 状態管理の統一、DOM操作の排除、型安全性の向上
 */

import { useCallback, useState } from 'react';

export type ImageLoadState = 'loading' | 'loaded' | 'error';

interface ImageFallbackConfig {
  fallbackClassName?: string;
  onError?: (error: Event) => void;
  onLoad?: () => void;
}

interface ImageFallbackReturn {
  imageState: ImageLoadState;
  isLoading: boolean;
  isLoaded: boolean;
  hasError: boolean;
  showImage: boolean;
  handleImageError: (event: React.SyntheticEvent<HTMLImageElement>) => void;
  handleImageLoad: () => void;
  resetState: () => void;
}

export function useImageFallback(config: ImageFallbackConfig = {}): ImageFallbackReturn {
  const [imageState, setImageState] = useState<ImageLoadState>('loading');

  const handleImageError = useCallback((event: React.SyntheticEvent<HTMLImageElement>) => {
    // DOM操作を排除し、状態管理のみで制御
    setImageState('error');
    
    // カスタムエラーハンドラーを実行
    if (config.onError) {
      config.onError(event.nativeEvent);
    }
  }, [config.onError]);

  const handleImageLoad = useCallback(() => {
    setImageState('loaded');
    
    // カスタムロードハンドラーを実行
    if (config.onLoad) {
      config.onLoad();
    }
  }, [config.onLoad]);

  const resetState = useCallback(() => {
    setImageState('loading');
  }, []);

  return {
    imageState,
    isLoading: imageState === 'loading',
    isLoaded: imageState === 'loaded',
    hasError: imageState === 'error',
    showImage: imageState !== 'error',
    handleImageError,
    handleImageLoad,
    resetState,
  };
}