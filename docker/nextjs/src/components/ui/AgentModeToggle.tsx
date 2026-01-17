'use client';

/**
 * Agent/KBモード切り替えコンポーネント
 * Bedrock AgentとKnowledge Baseの切り替えUI
 */

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
        display: 'block'
      }}
      aria-label={agentMode ? 'Agent モード' : 'KB モード'}
      title={agentMode ? 'Bedrock Agent モード' : 'Knowledge Base モード'}
    >
      {agentMode ? '🤖 Agent' : '📚 KB'}
    </button>
  );
}
