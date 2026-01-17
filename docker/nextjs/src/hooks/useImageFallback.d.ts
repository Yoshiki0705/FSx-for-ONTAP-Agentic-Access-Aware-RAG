/**
 * 画像フォールバック処理カスタムフック
 *
 * 画像読み込みエラー時の処理を抽象化
 * 改善: 状態管理の統一、DOM操作の排除、型安全性の向上
 */
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
export declare function useImageFallback(config?: ImageFallbackConfig): ImageFallbackReturn;
export {};
