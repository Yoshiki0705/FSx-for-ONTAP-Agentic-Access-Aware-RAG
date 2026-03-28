'use client';

import { useTranslations } from 'next-intl';
import { getCardsByMode, CardData } from '@/constants/card-constants';
import { useAgentStore } from '@/store/useAgentStore';

interface WorkflowSectionProps {
  locale: string;
  selectedAgentId: string | null;
  onWorkflowSelect: (prompt: string, label: string, agentId?: string) => void;
}

export function WorkflowSection({
  locale: _locale,
  selectedAgentId,
  onWorkflowSelect,
}: WorkflowSectionProps) {
  const tSidebar = useTranslations('sidebar');
  const tCards = useTranslations('cards');

  const agentCards = getCardsByMode('agent');

  const handleCardClick = (card: CardData) => {
    const title = tCards(card.titleKey.replace(/^cards\./, ''));
    const prompt = tCards(card.promptTemplateKey.replace(/^cards\./, ''));

    // agentId付きカード: AgentStoreを更新してからコールバック
    if (card.agentId) {
      useAgentStore.getState().setSelectedAgentId(card.agentId);
      onWorkflowSelect(prompt, title, card.agentId);
    } else {
      // agentIdなし: 現在のAgentを維持、プロンプトのみ
      onWorkflowSelect(prompt, title);
    }

    // agent-workflow-selected CustomEvent発火（既存互換）
    if (typeof window !== 'undefined') {
      const event = new CustomEvent('agent-workflow-selected', {
        detail: { prompt, label: title },
        bubbles: true,
      });
      window.dispatchEvent(event);
    }
  };

  const isHighlighted = (card: CardData): boolean => {
    return card.agentId !== undefined && card.agentId === selectedAgentId;
  };

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
        🔧 {tSidebar('workflow')}
      </h3>
      <div className="space-y-1">
        {agentCards.map((card) => {
          const title = tCards(card.titleKey.replace(/^cards\./, ''));
          const highlighted = isHighlighted(card);

          return (
            <button
              key={card.id}
              onClick={() => handleCardClick(card)}
              className={`w-full text-left px-2 py-1.5 text-xs rounded-md transition-colors flex items-center space-x-2
                ${
                  highlighted
                    ? 'border border-blue-400 bg-blue-50 dark:border-blue-500 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                    : 'hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-700 dark:text-gray-300'
                }`}
            >
              <span>{card.icon}</span>
              <span>{title}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
