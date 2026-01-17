'use client';

import * as Accordion from '@radix-ui/react-accordion';
import { ChevronDown, Clock, Star, Archive } from 'lucide-react';
import { ReactNode } from 'react';
import { ChatSession } from '@/types/chat';
import { VirtualChatHistory } from './VirtualChatHistory';

interface SidebarSectionsProps {
  sessions: ChatSession[];
  activeSessionId?: string;
  onSessionSelect: (sessionId: string) => void;
  onSessionDelete?: (sessionId: string) => void;
  searchQuery?: string;
  defaultOpenSections?: string[];
}

export function SidebarSections({
  sessions,
  activeSessionId,
  onSessionSelect,
  onSessionDelete,
  searchQuery = '',
  defaultOpenSections = ['recent']
}: SidebarSectionsProps) {
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const safeSessions = Array.isArray(sessions) ? sessions : [];
  const recentSessions = safeSessions.filter(s => new Date(s.updatedAt) > oneDayAgo);
  const thisWeekSessions = safeSessions.filter(s => {
    const date = new Date(s.updatedAt);
    return date <= oneDayAgo && date > oneWeekAgo;
  });
  const olderSessions = safeSessions.filter(s => new Date(s.updatedAt) <= oneWeekAgo);

  if (searchQuery.trim()) {
    return (
      <div className="h-full">
        <div className="p-3 text-sm font-medium text-gray-700 dark:text-gray-300">
          検索結果
        </div>
        <VirtualChatHistory
          sessions={safeSessions}
          activeSessionId={activeSessionId}
          onSessionSelect={onSessionSelect}
          onSessionDelete={onSessionDelete}
          searchQuery={searchQuery}
        />
      </div>
    );
  }

  return (
    <Accordion.Root
      type="multiple"
      defaultValue={defaultOpenSections}
      className="h-full flex flex-col"
    >
      {recentSessions.length > 0 && (
        <AccordionSection
          value="recent"
          title="最近のチャット"
          icon={<Clock className="w-4 h-4" />}
          count={recentSessions.length}
        >
          <VirtualChatHistory
            sessions={recentSessions}
            activeSessionId={activeSessionId}
            onSessionSelect={onSessionSelect}
            onSessionDelete={onSessionDelete}
          />
        </AccordionSection>
      )}

      {thisWeekSessions.length > 0 && (
        <AccordionSection
          value="thisweek"
          title="今週のチャット"
          icon={<Star className="w-4 h-4" />}
          count={thisWeekSessions.length}
        >
          <VirtualChatHistory
            sessions={thisWeekSessions}
            activeSessionId={activeSessionId}
            onSessionSelect={onSessionSelect}
            onSessionDelete={onSessionDelete}
          />
        </AccordionSection>
      )}

      {olderSessions.length > 0 && (
        <AccordionSection
          value="older"
          title="過去のチャット"
          icon={<Archive className="w-4 h-4" />}
          count={olderSessions.length}
        >
          <VirtualChatHistory
            sessions={olderSessions}
            activeSessionId={activeSessionId}
            onSessionSelect={onSessionSelect}
            onSessionDelete={onSessionDelete}
          />
        </AccordionSection>
      )}

      {safeSessions.length === 0 && (
        <div className="flex flex-col items-center justify-center h-32 text-gray-500 dark:text-gray-400">
          <div className="text-sm">チャット履歴がありません</div>
          <div className="text-xs mt-1">新しいチャットを開始してください</div>
        </div>
      )}
    </Accordion.Root>
  );
}

interface AccordionSectionProps {
  value: string;
  title: string;
  icon: ReactNode;
  count: number;
  children: ReactNode;
}

function AccordionSection({ value, title, icon, count, children }: AccordionSectionProps) {
  return (
    <Accordion.Item value={value} className="flex flex-col">
      <Accordion.Header>
        <Accordion.Trigger className="
          flex items-center justify-between w-full p-3
          text-left text-sm font-medium
          text-gray-700 dark:text-gray-300
          hover:bg-gray-100 dark:hover:bg-gray-700
          transition-colors
          group
        ">
          <div className="flex items-center space-x-2">
            {icon}
            <span>{title}</span>
            <span className="
              px-2 py-0.5 text-xs rounded-full
              bg-gray-200 dark:bg-gray-600
              text-gray-600 dark:text-gray-300
            ">
              {count}
            </span>
          </div>
          <ChevronDown className="
            w-4 h-4 transition-transform duration-200
            group-data-[state=open]:rotate-180
          " />
        </Accordion.Trigger>
      </Accordion.Header>
      <Accordion.Content className="
        flex-1 overflow-hidden
        data-[state=open]:animate-accordion-down
        data-[state=closed]:animate-accordion-up
      ">
        <div className="h-64">
          {children}
        </div>
      </Accordion.Content>
    </Accordion.Item>
  );
}
