import { useCallback } from 'react';

// Translation keys type for better type safety
type TranslationKey = keyof typeof fallbackTranslations;

// Comprehensive fallback translations for CloudFront environment
const fallbackTranslations: Record<string, string> = {
  // Common
  'common.loading': 'Loading...',
  'common.search': 'Search...',
  'common.save': 'Save',
  'common.cancel': 'Cancel',
  'common.delete': 'Delete',
  'common.edit': 'Edit',
  'common.close': 'Close',
  'common.ok': 'OK',
  'common.yes': 'Yes',
  'common.no': 'No',
  
  // Theme
  'theme.toggle': 'Toggle Theme',
  'theme.current': 'Current Theme',
  'theme.light': 'Light',
  'theme.dark': 'Dark',
  
  // Model
  'model.foundationModel': 'Foundation Model',
  'model.model': 'model',
  'model.models': 'models',
  'model.availableModel': 'Available Model',
  'model.availableModelsTitle': 'Available Models',
  'model.showFilters': 'Show Filters',
  'model.requestAccess': 'Request Access',
  'model.info': 'Info',
  'model.select': 'Select',
  'model.noModelsFound': 'No models found',
  'model.noOtherModelsAvailable': 'No other models available',
  'model.modelId': 'Model ID',
  'model.provider': 'Provider',
  'model.description': 'Description',
  'model.inputModalities': 'Input Modalities',
  'model.outputModalities': 'Output Modalities',
  'model.streaming': 'Streaming',
  'model.supported': 'Supported',
  
  // Chat
  'chat.send': 'Send',
  'chat.placeholder': 'Type your message...',
  'chat.newChat': 'New Chat',
  'chat.thinking': 'Thinking...',
  'chat.error': 'Error occurred',
  
  // Sidebar
  'sidebar.newChat': 'New Chat',
  'sidebar.history': 'Chat History',
  'sidebar.settings': 'Settings',
  'sidebar.settingsPanel': 'Settings Panel',
  'sidebar.userInfo': 'User Information',
  'sidebar.accessPermissions': 'Access Permissions',
  'sidebar.noHistorySaving': 'No History Saving',
  'sidebar.deleteOnSessionEnd': 'Delete on Session End',
  'sidebar.kbFeatures': 'KB Features',
  'sidebar.permissionControl': 'Permission Control',
  
  // Region
  'region.region': 'Region',
  'regionSelector.bedrockRegion': 'Bedrock Region',
  'regionSelector.change': 'Change Region',
  
  // Agent
  'agent.information': 'Agent Information',
  'agent.createNew': 'Create New Agent',
  'agent.mode': 'Agent Mode',
  'agent.sessionActive': 'Session Active',
  'agent.creating': 'Creating agent...',
  'agent.createDescription': 'Agent creation functionality is available in the full application.',
  
  // Permissions
  'permissions.available': 'Available',
  'permissions.unavailable': 'Unavailable',
  
  // Error
  'error.generic': 'An error occurred',
  'error.loading': 'Loading failed',
  'error.network': 'Network error',
  'error.timeout': 'Request timeout',
  
  // Status
  'status.online': 'Online',
  'status.offline': 'Offline',
  'status.connecting': 'Connecting...',
  'status.connected': 'Connected',
  'status.disconnected': 'Disconnected',
  
  // Trace
  'trace.viewer.title': 'Trace Viewer',
  'trace.viewer.tracesCount': 'traces',
  'trace.viewer.featuresEnabled': 'features enabled',
  'trace.viewer.expandAll': 'Expand All',
  'trace.viewer.collapseAll': 'Collapse All',
  'trace.viewer.filter': 'Filter',
  'trace.viewer.export': 'Export',
  'trace.viewer.noTraces': 'No traces available',
  'trace.viewer.noTracesDescription': 'No trace data to display',
  'trace.card.query': 'Query',
  'trace.card.response': 'Response',
  'trace.card.steps': 'steps',
  'trace.card.tokens': 'tokens',
  'trace.step.startTime': 'Start Time',
  'trace.step.endTime': 'End Time',
  'trace.step.input': 'Input',
  'trace.step.output': 'Output',
  'trace.step.tokens': 'tokens',
};

export function useSafeTranslations() {
  const t = useCallback((key: TranslationKey | string, fallback?: string): string => {
    // In CloudFront environment, always use fallback translations
    // This ensures consistent English text display without i18n dependencies
    
    // First try: Use predefined fallback translations
    if (fallbackTranslations[key]) {
      return fallbackTranslations[key];
    }
    
    // Second try: Use provided fallback parameter
    if (fallback) {
      return fallback;
    }
    
    // Third try: Extract readable text from key (e.g., 'common.loading' -> 'Loading')
    const keyParts = key.split('.');
    if (keyParts.length > 1) {
      const lastPart = keyParts[keyParts.length - 1];
      // Convert camelCase to readable text
      const readable = lastPart
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, str => str.toUpperCase())
        .trim();
      return readable;
    }
    
    // Final fallback: Return the key itself
    return key;
  }, []);

  // Additional utility function for pluralization
  const tp = useCallback((key: TranslationKey | string, count: number, fallback?: string): string => {
    const baseTranslation = t(key, fallback);
    
    // Simple English pluralization
    if (count === 1) {
      return baseTranslation;
    } else {
      // Add 's' for plural (basic English pluralization)
      if (baseTranslation.endsWith('y')) {
        return baseTranslation.slice(0, -1) + 'ies';
      } else if (baseTranslation.endsWith('s') || baseTranslation.endsWith('sh') || baseTranslation.endsWith('ch')) {
        return baseTranslation + 'es';
      } else {
        return baseTranslation + 's';
      }
    }
  }, [t]);

  return { t, tp };
}
