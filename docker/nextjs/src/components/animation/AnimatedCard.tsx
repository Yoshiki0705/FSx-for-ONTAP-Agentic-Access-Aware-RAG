'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';

export interface AnimatedCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  whileHover?: boolean;
  whileTap?: boolean;
}

/**
 * アニメーション付きカードコンポーネント
 * ホバー時のスケール変化（scale: 1.02）を提供
 * 
 * Requirements: 11.4
 */
export const AnimatedCard: React.FC<AnimatedCardProps> = ({
  children,
  className = '',
  onClick,
  whileHover = true,
  whileTap = true,
}) => {
  const prefersReducedMotion = useReducedMotion();

  // アニメーション無効化時は通常のdivを返す
  if (prefersReducedMotion) {
    return (
      <div className={className} onClick={onClick}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      className={className}
      onClick={onClick}
      whileHover={whileHover ? { scale: 1.02 } : undefined}
      whileTap={whileTap ? { scale: 0.98 } : undefined}
      transition={{
        duration: 0.2,
        ease: 'easeInOut',
      }}
    >
      {children}
    </motion.div>
  );
};

export interface AnimatedButtonProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
}

/**
 * アニメーション付きボタンコンポーネント
 * ホバー時のスケール変化を提供
 * 
 * Requirements: 11.4
 */
export const AnimatedButton: React.FC<AnimatedButtonProps> = ({
  children,
  className = '',
  onClick,
  disabled = false,
  type = 'button',
}) => {
  const prefersReducedMotion = useReducedMotion();

  // アニメーション無効化時は通常のbuttonを返す
  if (prefersReducedMotion) {
    return (
      <button
        type={type}
        className={className}
        onClick={onClick}
        disabled={disabled}
      >
        {children}
      </button>
    );
  }

  return (
    <motion.button
      type={type}
      className={className}
      onClick={onClick}
      disabled={disabled}
      whileHover={!disabled ? { scale: 1.02 } : undefined}
      whileTap={!disabled ? { scale: 0.98 } : undefined}
      transition={{
        duration: 0.2,
        ease: 'easeInOut',
      }}
    >
      {children}
    </motion.button>
  );
};
