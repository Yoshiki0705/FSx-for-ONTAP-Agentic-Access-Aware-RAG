'use client';

import React, { useId } from 'react';
import { useSidebarStore } from '@/store/useSidebarStore';

export interface CollapsiblePanelProps {
  title: string;
  icon?: string;
  defaultExpanded?: boolean;
  storageKey: string;
  children: React.ReactNode;
}

export const CollapsiblePanel: React.FC<CollapsiblePanelProps> = ({
  title,
  icon,
  defaultExpanded = false,
  storageKey,
  children,
}) => {
  const contentId = useId();
  const { isExpanded, toggle } = useSidebarStore();

  const expanded = isExpanded(storageKey);

  return (
    <div className="border-t border-gray-200 dark:border-gray-700">
      <button
        type="button"
        onClick={() => toggle(storageKey)}
        aria-expanded={expanded}
        aria-controls={contentId}
        className="flex w-full items-center justify-between px-3 py-2.5
          text-sm font-medium text-gray-700 dark:text-gray-200
          hover:bg-gray-100 dark:hover:bg-gray-700/50
          transition-colors duration-150 cursor-pointer select-none"
      >
        <span className="flex items-center gap-1.5">
          {icon && <span>{icon}</span>}
          <span>{title}</span>
        </span>
        <svg
          className={`h-4 w-4 shrink-0 text-gray-500 dark:text-gray-400
            transition-transform duration-200 ${expanded ? 'rotate-90' : 'rotate-0'}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>

      <div
        id={contentId}
        role="region"
        className={`overflow-hidden transition-all duration-200 ease-in-out
          ${expanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}
      >
        <div className="px-3 pb-3 pt-1">
          {children}
        </div>
      </div>
    </div>
  );
};

CollapsiblePanel.displayName = 'CollapsiblePanel';
