export interface AIProvider {
  id: string;
  name: string;
  type: 'local' | 'api';
  description: string;
  requiresApiKey: boolean;
  configFields: AIProviderConfigField[];
}

export interface AIProviderConfigField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'select' | 'number';
  required: boolean;
  placeholder?: string;
  options?: string[];
  defaultValue?: string | number;
}

export interface AIConfiguration {
  provider: string;
  enabled: boolean;
  config: Record<string, any>;
  lastTested?: Date;
  isWorking?: boolean;
  errorMessage?: string;
}

export interface AIFeatures {
  naturalLanguageQuery: boolean;
  smartEntityExtraction: boolean;
  intelligentSuggestions: boolean;
  conversationAnalysis: boolean;
  conflictResolution: boolean;
  knowledgeGapDetection: boolean;
  contextPrediction: boolean;
}

export interface UserSettings {
  id: string;
  userId: string;
  aiConfiguration: AIConfiguration;
  aiFeatures: AIFeatures;
  privacy: {
    allowDataCollection: boolean;
    shareAnonymousUsage: boolean;
    localProcessingOnly: boolean;
  };
  performance: {
    cacheEnabled: boolean;
    maxCacheSize: number;
    autoOptimize: boolean;
  };
  ui: {
    theme: 'light' | 'dark' | 'auto';
    compactMode: boolean;
    animationsEnabled: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

// Available AI Providers
export const AI_PROVIDERS: AIProvider[] = [
  {
    id: 'none',
    name: 'No AI',
    type: 'local',
    description: 'Disable all AI features (pure knowledge graph)',
    requiresApiKey: false,
    configFields: []
  },
  {
    id: 'ollama',
    name: 'Ollama (Local)',
    type: 'local',
    description: 'Local AI models via Ollama - privacy-focused, no external API calls',
    requiresApiKey: false,
    configFields: [
      {
        key: 'baseUrl',
        label: 'Ollama Base URL',
        type: 'text',
        required: true,
        defaultValue: 'http://localhost:11434',
        placeholder: 'http://localhost:11434'
      },
      {
        key: 'model',
        label: 'Model Name',
        type: 'select',
        required: true,
        options: ['llama2', 'codellama', 'mistral', 'phi', 'neural-chat'],
        defaultValue: 'llama2'
      }
    ]
  },
  {
    id: 'openai',
    name: 'OpenAI',
    type: 'api',
    description: 'GPT models via OpenAI API - excellent performance, requires API key',
    requiresApiKey: true,
    configFields: [
      {
        key: 'apiKey',
        label: 'API Key',
        type: 'password',
        required: true,
        placeholder: 'sk-...'
      },
      {
        key: 'model',
        label: 'Model',
        type: 'select',
        required: true,
        options: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'],
        defaultValue: 'gpt-3.5-turbo'
      },
      {
        key: 'maxTokens',
        label: 'Max Tokens',
        type: 'number',
        required: false,
        defaultValue: 1000
      }
    ]
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    type: 'api',
    description: 'Claude models via Anthropic API - excellent reasoning, requires API key',
    requiresApiKey: true,
    configFields: [
      {
        key: 'apiKey',
        label: 'API Key',
        type: 'password',
        required: true,
        placeholder: 'sk-ant-...'
      },
      {
        key: 'model',
        label: 'Model',
        type: 'select',
        required: true,
        options: ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'],
        defaultValue: 'claude-3-haiku-20240307'
      },
      {
        key: 'maxTokens',
        label: 'Max Tokens',
        type: 'number',
        required: false,
        defaultValue: 1000
      }
    ]
  },
  {
    id: 'huggingface',
    name: 'Hugging Face',
    type: 'api',
    description: 'Open-source models via Hugging Face API - various specialized models',
    requiresApiKey: true,
    configFields: [
      {
        key: 'apiKey',
        label: 'API Token',
        type: 'password',
        required: true,
        placeholder: 'hf_...'
      },
      {
        key: 'model',
        label: 'Model',
        type: 'text',
        required: true,
        placeholder: 'microsoft/DialoGPT-large',
        defaultValue: 'microsoft/DialoGPT-large'
      }
    ]
  }
];

// Default Settings
export const DEFAULT_SETTINGS: Omit<UserSettings, 'id' | 'userId' | 'createdAt' | 'updatedAt'> = {
  aiConfiguration: {
    provider: 'none',
    enabled: false,
    config: {}
  },
  aiFeatures: {
    naturalLanguageQuery: false,
    smartEntityExtraction: false,
    intelligentSuggestions: false,
    conversationAnalysis: false,
    conflictResolution: false,
    knowledgeGapDetection: false,
    contextPrediction: false
  },
  privacy: {
    allowDataCollection: false,
    shareAnonymousUsage: false,
    localProcessingOnly: true
  },
  performance: {
    cacheEnabled: true,
    maxCacheSize: 1000,
    autoOptimize: true
  },
  ui: {
    theme: 'auto',
    compactMode: false,
    animationsEnabled: true
  }
}; 