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
export declare const DEFAULT_BRAND_CONFIG: BrandConfig;
/**
 * 環境別ブランド設定取得
 */
export declare function getBrandConfig(): BrandConfig;
