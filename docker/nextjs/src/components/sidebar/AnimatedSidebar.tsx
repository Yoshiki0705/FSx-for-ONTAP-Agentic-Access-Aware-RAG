'use client';

import { motion } from 'framer-motion';
import { ReactNode } from 'react';

interface AnimatedSidebarProps {
  isOpen: boolean;
  children: ReactNode;
  className?: string;
}

/**
 * アニメーション付きサイドバーコンポーネント（固定幅320px）
 * 
 * Phase 12/15 Feature Restoration:
 * - サイドバー幅変更機能を削除
 * - 固定幅320pxに統一
 * - リサイズハンドル削除
 * - localStorageからの幅復元削除
 * 
 * v20 Phase 2 Task 2.7:
 * - ssr: false削除に伴うSSR対応
 * - isMountedステートでクライアント側のみレンダリング
 * - Hydration Mismatch回避
 * 
 * Round 5修正:
 * - useSidebarStoreへの依存を削除
 * - isOpenをpropsから受け取る
 */
export function AnimatedSidebar({ 
  isOpen,
  children, 
  className = ''
}: AnimatedSidebarProps) {
  const FIXED_WIDTH = 320; // 固定幅

  return (
    <motion.div
      initial={false}
      animate={{ 
        x: isOpen ? 0 : -FIXED_WIDTH,
        opacity: isOpen ? 1 : 0
      }}
      transition={{ 
        type: "spring", 
        stiffness: 300, 
        damping: 30,
        duration: 0.3 
      }}
      className={`fixed left-0 top-0 h-full bg-white dark:bg-gray-800 shadow-lg z-50 ${className}`}
      style={{
        width: `${FIXED_WIDTH}px`,
        pointerEvents: isOpen ? 'auto' : 'none'
      }}
    >
      {children}
    </motion.div>
  );
}

/**
 * サイドバーコンテンツのアニメーション
 */
export function AnimatedSidebarContent({ 
  children, 
  delay = 0 
}: { 
  children: ReactNode; 
  delay?: number; 
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
    >
      {children}
    </motion.div>
  );
}

/**
 * サイドバーアイテムのホバーアニメーション
 */
export function AnimatedSidebarItem({ 
  children, 
  onClick,
  className = '' 
}: { 
  children: ReactNode; 
  onClick?: () => void;
  className?: string;
}) {
  return (
    <motion.div
      whileHover={{ scale: 1.02, x: 5 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
      onClick={onClick}
      className={`cursor-pointer ${className}`}
    >
      {children}
    </motion.div>
  );
}
