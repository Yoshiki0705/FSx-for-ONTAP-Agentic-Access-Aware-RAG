'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useCustomTranslations } from '@/hooks/useCustomTranslations';
import { AgentModeSidebar } from './AgentModeSidebar';
import { KBModeSidebar } from './KBModeSidebar';
import type { ChatSession } from '@/types/chat';

// リサイズ設定
const MIN_WIDTH = 240;
const MAX_WIDTH = 480;
const DEFAULT_WIDTH = 320;

interface ModeSwitchableSidebarProps {
  locale: string;
  agentMode: boolean;
  currentSessionId?: string;
  sessions?: ChatSession[];
  onNewChat: () => void;
  onSessionSwitch?: (sessionId: string) => void;
  onSessionDelete?: (sessionId: string) => void;
  userName?: string;
  userEmail?: string;
  isOpen?: boolean;
  onToggle?: () => void;
  selectedModelId?: string;
  onModelChange?: (modelId: string) => void;
  onCreateAgent?: () => void;
}

export function ModeSwitchableSidebar(props: ModeSwitchableSidebarProps) {
  const {
    locale,
    agentMode,
    currentSessionId,
    sessions: rawSessions,
    onNewChat,
    onSessionSwitch,
    onSessionDelete,
    userName = 'ユーザー',
    userEmail,
    isOpen = true,
    onToggle,
    selectedModelId = '',
    onModelChange = () => {},
    onCreateAgent = () => {}
  } = props;

  // ✅ Enhanced safe sessions handling with comprehensive validation
  const safeSessions = useMemo(() => {
    try {
      // Enhanced null/undefined checks
      if (rawSessions === null || rawSessions === undefined) {
        console.log('🔍 [ModeSwitchableSidebar] rawSessions is null/undefined, returning empty array');
        return [];
      }
      
      // Enhanced type checking
      if (!Array.isArray(rawSessions)) {
        console.warn('🚨 [ModeSwitchableSidebar] rawSessions is not an array:', {
          type: typeof rawSessions,
          value: rawSessions,
          constructor: rawSessions?.constructor?.name,
          isObject: typeof rawSessions === 'object',
          hasLength: 'length' in (rawSessions || {}),
          keys: rawSessions && typeof rawSessions === 'object' ? Object.keys(rawSessions) : []
        });
        return [];
      }
      
      // Enhanced array validation
      if (rawSessions.length === 0) {
        console.log('✅ [ModeSwitchableSidebar] rawSessions is empty array');
        return [];
      }
      
      // Enhanced element validation
      const validSessions = rawSessions.filter((session, index) => {
        try {
          const isValid = session && 
                         typeof session === 'object' && 
                         typeof session.id === 'string' &&
                         session.id.length > 0 &&
                         Array.isArray(session.messages) &&
                         typeof session.createdAt === 'number' &&
                         typeof session.updatedAt === 'number';
          
          if (!isValid) {
            console.warn(`🚨 [ModeSwitchableSidebar] Invalid session at index ${index}:`, {
              session,
              hasId: session && typeof session.id === 'string',
              hasMessages: session && Array.isArray(session.messages),
              hasCreatedAt: session && typeof session.createdAt === 'number',
              hasUpdatedAt: session && typeof session.updatedAt === 'number'
            });
          }
          
          return isValid;
        } catch (error) {
          console.error(`❌ [ModeSwitchableSidebar] Error validating session at index ${index}:`, error);
          return false;
        }
      });
      
      if (validSessions.length !== rawSessions.length) {
        console.warn('🚨 [ModeSwitchableSidebar] Some sessions were filtered out:', {
          original: rawSessions.length,
          valid: validSessions.length,
          filtered: rawSessions.length - validSessions.length
        });
      }
      
      console.log('✅ [ModeSwitchableSidebar] rawSessions processed successfully:', {
        total: rawSessions.length,
        valid: validSessions.length
      });
      
      return validSessions;
    } catch (error) {
      console.error('❌ [ModeSwitchableSidebar] Error processing rawSessions:', error);
      return [];
    }
  }, [rawSessions]);

  // アニメーション状態管理
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [displayMode, setDisplayMode] = useState(agentMode);
  
  // デバッグログ
  useEffect(() => {
    console.log('🔍 [ModeSwitchableSidebar] State:', { 
      agentMode, 
      displayMode, 
      isTransitioning, 
      locale,
      sessionsType: typeof rawSessions,
      sessionsIsArray: Array.isArray(rawSessions),
      safeSessionsLength: safeSessions?.length || 0
    });
  }, [agentMode, displayMode, isTransitioning, locale, rawSessions, safeSessions]);

  // Fixed width for sidebar (no resize functionality)
  const width = DEFAULT_WIDTH;

  // モード切り替え時のアニメーション処理
  useEffect(() => {
    if (displayMode !== agentMode) {
      console.log('🔄 [ModeSwitchableSidebar] Mode transition:', { from: displayMode, to: agentMode });
      setIsTransitioning(true);
      
      const switchTimer = setTimeout(() => {
        setDisplayMode(agentMode);
        
        const fadeInTimer = setTimeout(() => {
          setIsTransitioning(false);
        }, 150);
        
        return () => clearTimeout(fadeInTimer);
      }, 150);
      
      return () => clearTimeout(switchTimer);
    }
  }, [agentMode, displayMode]);

  // AgentModeSidebar用のProps
  const agentModeProps = useMemo(() => ({
    locale,
    isOpen: isOpen,
    onClose: onToggle || (() => {}),
    currentSessionId,
    sessions: safeSessions,
    onNewChat,
    onSessionSwitch,
    onSessionDelete,
    userName: userName || 'ユーザー',
    userEmail,
    onCreateAgent,
    selectedModelId: selectedModelId,
    onModelChange: onModelChange
  }), [locale, isOpen, onToggle, currentSessionId, safeSessions, onNewChat, onSessionSwitch, onSessionDelete, userName, userEmail, onCreateAgent, selectedModelId, onModelChange]);

  // KBModeSidebar用のProps
  const kbModeProps = useMemo(() => ({
    locale,
    isOpen: isOpen,
    onClose: onToggle || (() => {}),
    currentSessionId,
    onNewChat,
    userName: userName || 'ユーザー',
    userEmail,
    saveHistory: true,
    onSaveHistoryChange: () => {},
    chatSessions: safeSessions, // ✅ Use safeSessions instead of rawSessions
    onSessionSelect: (session: ChatSession) => {
      if (onSessionSwitch) {
        onSessionSwitch(session.id);
      }
    },
    // ✅ Issue 3: KBモードでも削除可能にする
    onSessionDelete: onSessionDelete,
    selectedModelId: selectedModelId,
    onModelChange: onModelChange,
    userDirectories: {
      accessibleDirectories: [],
      permissions: {
        read: false,
        write: false
      },
      directoryType: 'simulated' as const
    },
    isLoadingDirectories: false,
    userRole: 'user'
  }), [locale, isOpen, onToggle, currentSessionId, onNewChat, userName, userEmail, safeSessions, onSessionSwitch, onSessionDelete, selectedModelId, onModelChange]);

  return (
    <div
      className="fixed left-0 top-0 h-full bg-white dark:bg-gray-800 shadow-lg z-50 transition-all duration-300"
      style={{
        width: `${width}px`,
        transform: isOpen ? 'translateX(0)' : `translateX(-${width}px)`,
        opacity: isOpen ? 1 : 0,
        pointerEvents: isOpen ? 'auto' : 'none'
      }}
    >
      <div className="relative h-full">
        {/* トランジション中のオーバーレイ */}
        {isTransitioning && (
          <div className="absolute inset-0 bg-white dark:bg-gray-800 z-10 flex items-center justify-center">
            <div className="flex items-center space-x-3">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {agentMode ? 'エージェントモード' : 'ナレッジベースモード'}
              </span>
            </div>
          </div>
        )}
        
        {/* サイドバーコンテンツ */}
        <div 
          className={`h-full transition-opacity duration-300 ${
            isTransitioning ? 'opacity-0' : 'opacity-100'
          }`}
        >
          {displayMode ? (
            <>
            {console.log('🤖 [ModeSwitchableSidebar] Rendering AgentModeSidebar with props:', agentModeProps)}
            <AgentModeSidebar {...agentModeProps} />
            </>
          ) : (
            <>
            {console.log('📚 [ModeSwitchableSidebar] Rendering KBModeSidebar with props:', kbModeProps)}
            <KBModeSidebar {...kbModeProps} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export const MemoizedModeSwitchableSidebar = React.memo(ModeSwitchableSidebar);
