/**
 * 遅延読み込み対応NetAppブランドセクション
 * パフォーマンス最適化のための遅延読み込み実装
 */

import { lazy, Suspense } from 'react';

// 遅延読み込み用のコンポーネント
const NetAppBrandSection = lazy(() => import('./NetAppBrandSection'));

interface LazyNetAppBrandSectionProps {
  className?: string;
}

export default function LazyNetAppBrandSection({ className }: LazyNetAppBrandSectionProps) {
  return (
    <Suspense fallback={<BrandSectionSkeleton />}>
      <NetAppBrandSection className={className} />
    </Suspense>
  );
}

/**
 * ローディング中のスケルトンUI
 */
function BrandSectionSkeleton() {
  return (
    <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 to-blue-800 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500 via-blue-600 to-blue-800">
        <div className="absolute inset-0 bg-black bg-opacity-20"></div>
        <div className="relative z-10 flex flex-col justify-center items-center h-full text-white p-12">
          <div className="text-center">
            {/* ロゴスケルトン */}
            <div className="mb-8">
              <div className="w-32 h-32 mx-auto bg-white bg-opacity-20 rounded-full animate-pulse"></div>
            </div>
            
            {/* タイトルスケルトン */}
            <div className="mb-4 h-12 bg-white bg-opacity-20 rounded animate-pulse"></div>
            <div className="mb-6 h-8 bg-white bg-opacity-20 rounded animate-pulse"></div>
            
            {/* 説明スケルトン */}
            <div className="mb-8 h-6 bg-white bg-opacity-20 rounded animate-pulse max-w-md mx-auto"></div>
            
            {/* 技術ショーケーススケルトン */}
            <div className="grid grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white bg-opacity-10 rounded-lg p-4 animate-pulse">
                  <div className="h-8 bg-white bg-opacity-20 rounded mb-2"></div>
                  <div className="h-4 bg-white bg-opacity-20 rounded"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}