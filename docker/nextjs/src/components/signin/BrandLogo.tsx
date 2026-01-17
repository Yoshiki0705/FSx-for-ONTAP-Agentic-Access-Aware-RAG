/**
 * NetAppブランドロゴコンポーネント
 * 再利用可能なブランド表示
 */

interface BrandLogoProps {
  size?: 'small' | 'medium' | 'large';
  showTagline?: boolean;
  className?: string;
}

export function BrandLogo({ 
  size = 'large', 
  showTagline = true, 
  className = '' 
}: BrandLogoProps) {
  const sizeClasses = {
    small: 'text-2xl',
    medium: 'text-4xl',
    large: 'text-6xl'
  };

  const taglineClasses = {
    small: 'text-sm',
    medium: 'text-lg',
    large: 'text-2xl'
  };

  return (
    <div className={`text-center text-white ${className}`}>
      <div className={`${sizeClasses[size]} font-bold mb-4`}>
        <span className="text-white">Net</span>
        <span className="text-blue-300">App</span>
      </div>
      {showTagline && (
        <h2 className={`${taglineClasses[size]} font-light tracking-wide`}>
          INTELLIGENT DATA INFRASTRUCTURE
        </h2>
      )}
    </div>
  );
}