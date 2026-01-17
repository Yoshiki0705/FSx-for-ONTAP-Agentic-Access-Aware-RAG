'use client';

import React from 'react';
import { BedrockModel } from '@/config/bedrock-models';
import { ModelCard } from './ModelCard';

interface ModelGridProps {
  models: BedrockModel[];
  selectedModelId: string;
  availableModels: string[];
  onModelSelect: (modelId: string) => void;
  providerFilter: string;
  modalityFilter: string;
  availabilityFilter: string;
}

export const ModelGrid: React.FC<ModelGridProps> = ({
  models,
  selectedModelId,
  availableModels,
  onModelSelect,
  providerFilter,
  modalityFilter,
  availabilityFilter,
}) => {
  const filteredModels = models.filter(model => {
    if (providerFilter && model.provider !== providerFilter) return false;
    if (modalityFilter && !model.modality.includes(modalityFilter)) return false;
    if (availabilityFilter === 'available' && !model.available) return false;
    if (availabilityFilter === 'unavailable' && model.available) return false;
    return true;
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {filteredModels.map((model) => (
        <ModelCard
          key={model.id}
          model={model}
          isSelected={selectedModelId === model.id}
          isAvailable={availableModels.includes(model.id)}
          onSelect={() => onModelSelect(model.id)}
        />
      ))}
    </div>
  );
};