'use client';

import React, { Suspense, lazy } from 'react';
import { Spinner } from '../ui/Spinner';

interface LazyLoadProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * 遅延読み込みラッパーコンポーネント
 * コンポーネントを必要になるまで読み込まない
 */
export const LazyLoad: React.FC<LazyLoadProps> = ({ 
  children, 
  fallback = <div className="flex items-center justify-center p-4"><Spinner size="md" /></div> 
}) => {
  return (
    <Suspense fallback={fallback}>
      {children}
    </Suspense>
  );
};

/**
 * 動的インポート用のヘルパー関数
 */
export function lazyLoadComponent<T extends React.ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>,
  fallback?: React.ReactNode
) {
  const LazyComponent = lazy(importFunc);
  
  return (props: React.ComponentProps<T>) => (
    <LazyLoad fallback={fallback}>
      <LazyComponent {...props} />
    </LazyLoad>
  );
}
