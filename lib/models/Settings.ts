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
  isDynamic?: boolean;
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
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    type: 'api',
    description: 'Access multiple AI models through OpenRouter - unified API for various providers',
    requiresApiKey: true,
    configFields: [
      {
        key: 'apiKey',
        label: 'API Key',
        type: 'password',
        required: true,
        placeholder: 'sk-or-...'
      },
      {
        key: 'model',
        label: 'Model',
        type: 'select',
        required: true,
        options: [
          // Premium models (most reliable)
          'openai/gpt-3.5-turbo',
          'openai/gpt-4-turbo', 
          'anthropic/claude-3-haiku',
          'anthropic/claude-3-sonnet',
          'anthropic/claude-3-opus',
          'meta-llama/llama-3-8b-instruct',
          'meta-llama/llama-3-70b-instruct',
          'mistralai/mistral-7b-instruct',
          'google/gemini-pro',
          'cohere/command-r-plus',
          // Free models (availability varies)
          'mistralai/devstral-small:free',
          'openai/gpt-3.5-turbo:free',
          'anthropic/claude-3-haiku:free',
          'meta-llama/llama-3-8b-instruct:free'
        ],
        defaultValue: 'openai/gpt-3.5-turbo',
        isDynamic: true
      },
      {
        key: 'baseUrl',
        label: 'Base URL',
        type: 'text',
        required: false,
        defaultValue: 'https://openrouter.ai/api/v1',
        placeholder: 'https://openrouter.ai/api/v1'
      },
      {
        key: 'maxTokens',
        label: 'Max Tokens',
        type: 'number',
        required: false,
        defaultValue: 1000
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

// Enhanced OpenRouter model fetching with caching and filtering
interface OpenRouterModel {
  id: string;
  name: string;
  pricing?: {
    prompt: string;
    completion: string;
  };
  context_length?: number;
  architecture?: {
    modality: string;
    tokenizer: string;
    instruct_type?: string;
  };
  top_provider?: {
    max_completion_tokens?: number;
  };
}

interface ModelCache {
  models: OpenRouterModel[];
  timestamp: number;
}

let modelCache: ModelCache = { models: [], timestamp: 0 };
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export interface ModelFetchOptions {
  apiKey?: string;
  freeOnly?: boolean;
  includeVariants?: boolean;
  maxResults?: number;
}

// Enhanced function to get dynamic models for OpenRouter with filtering
export async function getOpenRouterModels(options: ModelFetchOptions = {}): Promise<string[]> {
  const { apiKey, freeOnly = false, includeVariants = true, maxResults = 100 } = options;
  
  try {
    // Check cache first
    const now = Date.now();
    const isCacheValid = modelCache.models.length > 0 && (now - modelCache.timestamp) < CACHE_DURATION;
    
    let models: OpenRouterModel[] = [];
    
    if (isCacheValid) {
      models = modelCache.models;
      console.log(`Using cached OpenRouter models (${models.length} models)`);
    } else {
      // Fetch fresh models from API
      const headers: Record<string, string> = {
        'HTTP-Referer': 'https://localhost:3000',
        'X-Title': 'GraphMemory Knowledge Graph'
      };

      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }

      const response = await fetch('https://openrouter.ai/api/v1/models', { headers });
      
      if (!response.ok) {
        console.warn('Failed to fetch OpenRouter models, using fallback list');
        return freeOnly ? getOpenRouterFallbackFreeModels() : getOpenRouterFallbackModels();
      }

      const data = await response.json();
      models = data.data || [];
      
      // Update cache
      modelCache = { models, timestamp: now };
      console.log(`Fetched ${models.length} fresh OpenRouter models from API`);
    }

    // Filter and process models
    let filteredModels: string[] = [];
    
    if (freeOnly) {
      // Get only free models
      const naturallyFreeModels = models
        .filter((m: OpenRouterModel) => 
          m.pricing?.prompt === '0' || 
          m.pricing?.prompt === '0.0' ||
          (!m.pricing?.prompt) // Some free models might not have pricing info
        )
        .map((m: OpenRouterModel) => m.id);

      // Add verified free variants if requested
      if (includeVariants) {
        const verifiedFreeVariants = [
          'meta-llama/llama-3.2-3b-instruct:free',
          'meta-llama/llama-3.2-1b-instruct:free',
          'google/gemma-2-9b-it:free',
          'microsoft/phi-3-medium-128k-instruct:free',
          'microsoft/phi-3-mini-128k-instruct:free',
          'nousresearch/nous-capybara-7b:free',
          'mistralai/mistral-7b-instruct:free'
        ];
        
        filteredModels = [...naturallyFreeModels, ...verifiedFreeVariants];
      } else {
        filteredModels = naturallyFreeModels;
      }
      
      console.log(`Found ${filteredModels.length} free models`);
    } else {
      // Get all models, but prioritize free ones
      const freeModels = models
        .filter((m: OpenRouterModel) => m.pricing?.prompt === '0')
        .map((m: OpenRouterModel) => m.id);
        
      const paidModels = models
        .filter((m: OpenRouterModel) => m.pricing?.prompt !== '0')
        .map((m: OpenRouterModel) => m.id);

      // Add popular :free variants
      const popularFreeVariants = includeVariants ? [
        'openai/gpt-3.5-turbo:free',
        'anthropic/claude-3-haiku:free', 
        'meta-llama/llama-3-8b-instruct:free',
        'meta-llama/llama-3.2-3b-instruct:free',
        'google/gemma-2-9b-it:free'
      ] : [];

      filteredModels = [...popularFreeVariants, ...freeModels, ...paidModels];
    }

    // Remove duplicates and apply limit
    const uniqueModels = Array.from(new Set(filteredModels));
    return uniqueModels.slice(0, maxResults);

  } catch (error) {
    console.warn('Error fetching OpenRouter models:', error);
    return freeOnly ? getOpenRouterFallbackFreeModels() : getOpenRouterFallbackModels();
  }
}

// Get only free OpenRouter models
export async function getOpenRouterFreeModels(apiKey?: string): Promise<string[]> {
  return getOpenRouterModels({ 
    apiKey, 
    freeOnly: true, 
    includeVariants: true, 
    maxResults: 50 
  });
}

// Get detailed model information
export async function getOpenRouterModelDetails(apiKey?: string): Promise<OpenRouterModel[]> {
  try {
    const now = Date.now();
    const isCacheValid = modelCache.models.length > 0 && (now - modelCache.timestamp) < CACHE_DURATION;
    
    if (isCacheValid) {
      return modelCache.models;
    }

    const headers: Record<string, string> = {
      'HTTP-Referer': 'https://localhost:3000',
      'X-Title': 'GraphMemory Knowledge Graph'
    };

    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const response = await fetch('https://openrouter.ai/api/v1/models', { headers });
    
    if (!response.ok) {
      throw new Error(`API response: ${response.status}`);
    }

    const data = await response.json();
    const models = data.data || [];
    
    // Update cache
    modelCache = { models, timestamp: now };
    
    return models;
  } catch (error) {
    console.warn('Error fetching detailed OpenRouter models:', error);
    return [];
  }
}

function getOpenRouterFallbackModels(): string[] {
  return [
    // Working models (confirmed available)
    'openai/gpt-3.5-turbo',
    'openai/gpt-4-turbo',
    'anthropic/claude-3-opus',
    'anthropic/claude-3-sonnet',
    'anthropic/claude-3-haiku',
    'meta-llama/llama-3-70b-instruct',
    'meta-llama/llama-3-8b-instruct',
    'mistralai/mistral-7b-instruct',
    'google/gemini-pro',
    'cohere/command-r-plus',
    // Free models (may or may not exist - will be dynamically fetched)
    'mistralai/devstral-small:free',
    'openai/gpt-3.5-turbo:free',
    'anthropic/claude-3-haiku:free',
    'meta-llama/llama-3-8b-instruct:free'
  ];
}

function getOpenRouterFallbackFreeModels(): string[] {
  return [
    // Verified free models and variants
    'meta-llama/llama-3.2-3b-instruct:free',
    'meta-llama/llama-3.2-1b-instruct:free',
    'google/gemma-2-9b-it:free',
    'microsoft/phi-3-medium-128k-instruct:free',
    'microsoft/phi-3-mini-128k-instruct:free',
    'nousresearch/nous-capybara-7b:free',
    'mistralai/mistral-7b-instruct:free',
    'mistralai/devstral-small:free',
    'openai/gpt-3.5-turbo:free',
    'anthropic/claude-3-haiku:free',
    'meta-llama/llama-3-8b-instruct:free'
  ];
} 