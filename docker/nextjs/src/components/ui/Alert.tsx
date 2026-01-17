'use client';

import React from 'react';
import { AlertCircle, CheckCircle, Info, XCircle, X } from 'lucide-react';

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  onClose?: () => void;
}

export const Alert: React.FC<AlertProps> = ({
  children,
  variant = 'info',
  title,
  onClose,
  className = '',
  ...props
}) => {
  // バリアント別スタイルとアイコン
  const variantConfig = {
    info: {
      styles: 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-200',
      icon: <Info className="w-5 h-5" />,
    },
    success: {
      styles: 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-200',
      icon: <CheckCircle className="w-5 h-5" />,
    },
    warning: {
      styles: 'bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-200',
      icon: <AlertCircle className="w-5 h-5" />,
    },
    error: {
      styles: 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-200',
      icon: <XCircle className="w-5 h-5" />,
    },
  };

  const config = variantConfig[variant];

  return (
    <div
      className={`rounded-lg border p-4 ${config.styles} ${className}`}
      role="alert"
      {...props}
    >
      <div className="flex items-start">
        <div className="flex-shrink-0">{config.icon}</div>
        <div className="ml-3 flex-1">
          {title && (
            <h3 className="text-sm font-medium mb-1">{title}</h3>
          )}
          <div className="text-sm">{children}</div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="flex-shrink-0 ml-3 inline-flex rounded-lg p-1.5 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            aria-label="閉じる"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};
