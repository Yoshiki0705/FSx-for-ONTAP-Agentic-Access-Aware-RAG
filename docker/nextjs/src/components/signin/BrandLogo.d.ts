/**
 * NetAppブランドロゴコンポーネント
 * 再利用可能なブランド表示
 */
interface BrandLogoProps {
    size?: 'small' | 'medium' | 'large';
    showTagline?: boolean;
    className?: string;
}
export declare function BrandLogo({ size, showTagline, className }: BrandLogoProps): import("react").JSX.Element;
export {};
