'use client';

/**
 * Agent/KBモード切り替えコンポーネント
 * Bedrock AgentとKnowledge Baseの切り替えUI
 */

import { Bot, Library } from 'lucide-react';
import { useChatStore } from '@/store/useChatStore';

/**
 * Agent/KBモードトグルボタン
 */
export function AgentModeToggle() {
  const { agentMode, setAgentMode } = useChatStore();

  return (
    <button
      onClick={() => setAgentMode(!agentMode)}
      style={{ 
        backgroundColor: agentMode ? '#9333ea' : '#2563eb',
        color: 'white',
        padding: '8px 16px',
        borderRadius: '8px',
        fontSize: '14px',
        fontWeight: 'bold',
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}
      aria-label={agentMode ? 'Agent モード' : 'KB モード'}
      title={agentMode ? 'Bedrock Agent モード' : 'Knowledge Base モード'}
    >
      {agentMode ? <Bot className="w-4 h-4" aria-hidden="true" /> : <Library className="w-4 h-4" aria-hidden="true" />}
      {agentMode ? 'Agent' : 'KB'}
    </button>
  );
}
