'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';

export interface AnimatedListProps {
  children: React.ReactNode;
  className?: string;
}

export interface AnimatedListItemProps {
  children: React.ReactNode;
  id: string | number;
  className?: string;
}

/**
 * アニメーション付きリストコンテナ
 * layoutアニメーションを提供
 * 
 * Requirements: 11.3
 */
export const AnimatedList: React.FC<AnimatedListProps> = ({
  children,
  className = '',
}) => {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div layout className={className}>
      <AnimatePresence mode="popLayout">
        {children}
      </AnimatePresence>
    </motion.div>
  );
};

/**
 * アニメーション付きリストアイテム
 * スライドイン/スライドアウト（250ms）を提供
 * 
 * Requirements: 11.3
 */
export const AnimatedListItem: React.FC<AnimatedListItemProps> = ({
  children,
  id,
  className = '',
}) => {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      key={id}
      layout
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{
        duration: 0.25,
        ease: 'easeInOut',
        layout: {
          duration: 0.25,
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
};
