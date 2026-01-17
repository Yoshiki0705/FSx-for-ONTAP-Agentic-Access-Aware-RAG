/**
 * ブランド設定管理
 * 
 * 画像パス・フォールバック設定の一元管理
 */

export interface BrandImageConfig {
  src: string;
  alt: string;
  fallbackClassName: string;
}

export interface BrandConfig {
  mainImage: BrandImageConfig;
  logo?: BrandImageConfig;
}

/**
 * デフォルトブランド設定
 */
export const DEFAULT_BRAND_CONFIG: BrandConfig = {
  mainImage: {
    src: '/images/main-image.jpg',
    alt: 'NetApp Permission-aware RAG System',
    fallbackClassName: 'bg-gradient-to-br from-blue-500 via-blue-600 to-blue-800',
  },
};

/**
 * 環境別ブランド設定取得
 */
export function getBrandConfig(): BrandConfig {
  // 環境変数による設定上書き
  const customImageSrc = process.env.NEXT_PUBLIC_BRAND_IMAGE_SRC;
  
  if (customImageSrc) {
    return {
      ...DEFAULT_BRAND_CONFIG,
      mainImage: {
        ...DEFAULT_BRAND_CONFIG.mainImage,
        src: customImageSrc,
      },
    };
  }
  
  return DEFAULT_BRAND_CONFIG;
}