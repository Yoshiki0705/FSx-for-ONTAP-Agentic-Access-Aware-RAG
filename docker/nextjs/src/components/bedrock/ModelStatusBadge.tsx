import React from 'react';

interface ModelStatusBadgeProps {
  isAvailable: boolean;
  count?: number;
  className?: string;
}

export function ModelStatusBadge({ isAvailable, count, className = '' }: ModelStatusBadgeProps) {
  const bgColor = isAvailable ? 'bg-green-100' : 'bg-red-100';
  const textColor = isAvailable ? 'text-green-700' : 'text-red-700';
  const icon = isAvailable ? '✅' : '❌';
  
  return (
    <span className={`px-1.5 py-0.5 ${bgColor} ${textColor} rounded-full text-xs ${className}`}>
      {icon} {count !== undefined ? count : (isAvailable ? '利用可能' : '利用不可')}
    </span>
  );
}