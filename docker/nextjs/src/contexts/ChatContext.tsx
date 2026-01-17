'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface ChatContextType {
  // Agent/KBモード切り替え
  agentMode: boolean;
  setAgentMode: (mode: boolean) => void;
  
  // Agent関連状態
  agentTraces: any[];
  setAgentTraces: (traces: any[]) => void;
  sessionAttributes: Record<string, string>;
  setSessionAttributes: (attributes: Record<string, string>) => void;
  showAgentTrace: boolean;
  setShowAgentTrace: (show: boolean) => void;
  showSessionAttributes: boolean;
  setShowSessionAttributes: (show: boolean) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [agentMode, setAgentMode] = useState(false);
  const [agentTraces, setAgentTraces] = useState<any[]>([]);
  const [sessionAttributes, setSessionAttributes] = useState<Record<string, string>>({});
  const [showAgentTrace, setShowAgentTrace] = useState(false);
  const [showSessionAttributes, setShowSessionAttributes] = useState(false);

  return (
    <ChatContext.Provider
      value={{
        agentMode,
        setAgentMode,
        agentTraces,
        setAgentTraces,
        sessionAttributes,
        setSessionAttributes,
        showAgentTrace,
        setShowAgentTrace,
        showSessionAttributes,
        setShowSessionAttributes,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChatContext() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChatContext must be used within a ChatProvider');
  }
  return context;
}
