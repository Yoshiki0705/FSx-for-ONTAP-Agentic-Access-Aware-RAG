'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown, CheckCircle, XCircle, Clock, BookOpen } from 'lucide-react';
import Link from 'next/link';

export interface AgentListItem {
  agentId: string;
  agentName: string;
  status: 'PREPARED' | 'NOT_PREPARED' | 'FAILED';
}

export interface HeaderAgentSelectorProps {
  selectedAgentId: string | null;
  onAgentChange: (agentId: string) => void;
  agents: AgentListItem[];
  disabled?: boolean;
  locale?: string;
}

const STATUS_CONFIG: Record<
  AgentListItem['status'],
  { icon: typeof CheckCircle; className: string }
> = {
  PREPARED: { icon: CheckCircle, className: 'text-green-500' },
  NOT_PREPARED: { icon: Clock, className: 'text-yellow-500' },
  FAILED: { icon: XCircle, className: 'text-red-500' },
};

/**
 * ヘッダー内に配置するコンパクトなAgent選択ドロップダウン。
 *
 * - 現在選択中のAgent名を表示し、クリックでドロップダウンリストを展開
 * - Agent名とステータス（PREPARED / NOT_PREPARED / FAILED）を表示
 * - `aria-expanded` で展開/折りたたみ状態を通知
 * - Agent名は `text-overflow: ellipsis` で切り詰め
 * - 外側クリックおよびEscapeキーでドロップダウンを閉じる
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 9.2
 */
export default function HeaderAgentSelector({
  selectedAgentId,
  onAgentChange,
  agents,
  disabled = false,
  locale = 'ja',
}: HeaderAgentSelectorProps) {
  const t = useTranslations('agentSelector');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const selectedAgent = agents.find((a) => a.agentId === selectedAgentId) ?? null;

  const toggleDropdown = useCallback(() => {
    if (disabled) return;
    setIsOpen((prev) => !prev);
  }, [disabled]);

  const handleSelect = useCallback(
    (agentId: string) => {
      onAgentChange(agentId);
      setIsOpen(false);
      triggerRef.current?.focus();
    },
    [onAgentChange],
  );

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const displayName = selectedAgent?.agentName ?? t('placeholder');

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={t('label')}
        disabled={disabled}
        onClick={toggleDropdown}
        className={`
          inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5
          text-sm font-medium transition-colors
          bg-gray-100 dark:bg-gray-800
          hover:bg-gray-200 dark:hover:bg-gray-700
          focus-visible:outline-none focus-visible:ring-2
          focus-visible:ring-blue-500 focus-visible:ring-offset-1
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
      >
        <span
          className="truncate max-w-[120px]"
        >
          {displayName}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <ul
          role="listbox"
          aria-label={t('label')}
          className="absolute left-0 top-full mt-1 z-50 min-w-[220px] max-w-[320px]
                     rounded-md border border-gray-200 dark:border-gray-700
                     bg-white dark:bg-gray-900 shadow-lg py-1
                     max-h-60 overflow-y-auto"
        >
          {agents.length === 0 ? (
            <li className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
              {t('noAgents')}
            </li>
          ) : (
            agents.map((agent) => {
              const isSelected = agent.agentId === selectedAgentId;
              const { icon: StatusIcon, className: statusClassName } =
                STATUS_CONFIG[agent.status];

              return (
                <li
                  key={agent.agentId}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(agent.agentId)}
                  className={`
                    flex items-center gap-2 px-3 py-2 text-sm cursor-pointer
                    transition-colors
                    ${
                      isSelected
                        ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }
                  `}
                >
                  <span
                    className="truncate flex-1 min-w-0"
                  >
                    {agent.agentName}
                  </span>
                  <StatusIcon
                    className={`w-4 h-4 flex-shrink-0 ${statusClassName}`}
                    aria-label={agent.status}
                  />
                </li>
              );
            })
          )}
          {/* Agent Directory リンク */}
          <li className="border-t border-gray-200 dark:border-gray-700 mt-1 pt-1">
            <Link
              href={`/${locale}/genai/agents`}
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer transition-colors
                         text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
            >
              <BookOpen className="w-4 h-4 flex-shrink-0" />
              <span>Agent Directory</span>
            </Link>
          </li>
        </ul>
      )}
    </div>
  );
}
