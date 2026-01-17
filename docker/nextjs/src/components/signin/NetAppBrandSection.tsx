/**
 * NetAppブランドセクションコンポーネント
 * 左側のブランド表示エリアを担当
 * 
 * 機能:
 * - Next.js Image最適化
 * - 設定外部化
 * - エラーハンドリング
 */

import Image from 'next/image';
import { useState } from 'react';
import { getBrandConfig } from '../../config/brand-config';

interface NetAppBrandSectionProps {
  className?: string;
}

export default function NetAppBrandSection({ className = "" }: NetAppBrandSectionProps) {
  const brandConfig = getBrandConfig();
  const [imageError, setImageError] = useState(false);

  const handleImageError = () => {
    setImageError(true);
    console.warn('ブランド画像の読み込みに失敗しました');
  };

  return (
    <div className={`hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 to-blue-800 relative overflow-hidden ${className}`}>
      {/* 最適化された画像表示 */}
      <div className="absolute inset-0">
        {!imageError ? (
          <Image
            src={brandConfig.mainImage.src}
            alt={brandConfig.mainImage.alt}
            fill
            className="object-cover"
            quality={85}
            priority
            sizes="(max-width: 1024px) 0px, 50vw"
            onError={handleImageError}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-blue-600 via-blue-700 to-blue-900" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/30 to-transparent" />
      </div>
      
      <div className="relative z-10 flex flex-col justify-center items-center h-full text-white p-12">
        <div className="text-center">
          <BrandTitle />
          <BrandDescription />
          <TechnologyShowcase />
        </div>
      </div>
    </div>
  );
}



function BrandTitle() {
  return (
    <>
      <div className="mb-8">
        <div className="text-6xl font-bold mb-4 tracking-wider">
          <span className="text-white">Net</span>
          <span className="text-blue-300">App</span>
        </div>
        <h2 className="text-2xl font-light mb-6 tracking-wide">
          DATA INFRASTRUCTURE INTELLIGENT
        </h2>
      </div>
    </>
  );
}

function BrandDescription() {
  return (
    <p className="text-lg opacity-90 max-w-md">
      Permission-aware RAG System powered by FSx for NetApp ONTAP
    </p>
  );
}

function TechnologyShowcase() {
  const technologies = [
    { name: 'FSx', subtitle: 'ONTAP' },
    { name: 'AI', subtitle: 'Bedrock' },
    { name: 'RAG', subtitle: 'Search' }
  ];

  return (
    <div className="mt-8 grid grid-cols-3 gap-4 text-center">
      {technologies.map((tech) => (
        <div key={tech.name} className="bg-white bg-opacity-10 rounded-lg p-4 backdrop-blur-sm">
          <div className="text-2xl font-bold">{tech.name}</div>
          <div className="text-sm opacity-80">{tech.subtitle}</div>
        </div>
      ))}
    </div>
  );
}