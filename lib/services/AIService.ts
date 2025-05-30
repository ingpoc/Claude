import { AIConfiguration, AIFeatures } from '../models/Settings';
import { LMStudioClient } from '@lmstudio/sdk';
import { logger } from './Logger';

export interface AIResponse {
  success: boolean;
  data?: any;
  error?: string;
  provider?: string;
  usage?: {
    tokens?: number;
    cost?: number;
  };
  query?: string;
  timestamp?: Date;
  entities?: string[];
  relationships?: string[];
  confidence?: number;
  queryType?: 'entity_search' | 'relationship_analysis' | 'pattern_discovery' | 'general';
}

export interface AIQueryRequest {
  prompt: string;
  context?: any;
  model?: string;
  max_tokens?: number;
  temperature?: number;
  systemPrompt?: string;
}

export interface EntityExtractionRequest {
  text: string;
  context?: any;
  existingEntities?: string[];
  projectContext?: any;
}

export interface SuggestionRequest {
  context: any;
  count?: number;
  knowledgeGraph?: any;
  userHistory?: any[];
  maxSuggestions?: number;
}

export abstract class BaseAIProvider {
  protected config: Record<string, any>;
  protected isConfigured: boolean = false;

  constructor(config: Record<string, any>) {
    this.config = config;
    this.isConfigured = this.validateConfig();
  }

  abstract validateConfig(): boolean;
  abstract testConnection(): Promise<AIResponse>;
  abstract query(request: AIQueryRequest): Promise<AIResponse>;
  abstract extractEntities(request: EntityExtractionRequest): Promise<AIResponse>;
  abstract generateSuggestions(request: SuggestionRequest): Promise<AIResponse>;

  isReady(): boolean {
    return this.isConfigured;
  }
}

// No AI Provider (Fallback)
class NoAIProvider extends BaseAIProvider {
  validateConfig(): boolean {
    return true;
  }

  async testConnection(): Promise<AIResponse> {
    return { success: true, data: { message: 'AI disabled' } };
  }

  async query(request: AIQueryRequest): Promise<AIResponse> {
    return {
      success: false,
      error: 'AI features are disabled. Enable AI in settings to use this feature.'
    };
  }

  async extractEntities(request: EntityExtractionRequest): Promise<AIResponse> {
    // Fallback to simple pattern matching
    const entities = this.simpleEntityExtraction(request.text);
    return {
      success: true,
      data: { entities },
      provider: 'pattern-matching'
    };
  }

  async generateSuggestions(request: SuggestionRequest): Promise<AIResponse> {
    return {
      success: false,
      error: 'AI-powered suggestions are disabled. Enable AI in settings.'
    };
  }

  private simpleEntityExtraction(text: string): string[] {
    // Simple pattern-based extraction as fallback
    const patterns = [
      /\b[A-Z][a-zA-Z]*(?:\s+[A-Z][a-zA-Z]*)*\b/g, // Title case words
      /\b(?:class|function|method|component|service|api|endpoint)\s+([A-Za-z][A-Za-z0-9]*)\b/gi, // Code entities
    ];

    const entities = new Set<string>();
    patterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(match => {
          if (match.length > 2 && match.length < 50) {
            entities.add(match.trim());
          }
        });
      }
    });

    return Array.from(entities);
  }
}

// OpenAI Provider - will only work if openai package is installed
class OpenAIProvider extends BaseAIProvider {
  private openai: any;

  validateConfig(): boolean {
    return !!(this.config.apiKey && this.config.model);
  }

  async initializeOpenAI() {
    return new Promise<boolean>((resolve) => {
      // For now, just return false to indicate OpenAI is not available
      // Users can install the openai package and restart to enable this
      console.warn('OpenAI integration requires installing the openai package: npm install openai');
      resolve(false);
    });
  }

  async testConnection(): Promise<AIResponse> {
    return {
      success: false,
      error: 'OpenAI integration requires installing the openai package. Run: npm install openai'
    };
  }

  async query(request: AIQueryRequest): Promise<AIResponse> {
    return {
      success: false,
      error: 'OpenAI integration requires installing the openai package. Run: npm install openai',
      provider: 'openai'
    };
  }

  async extractEntities(request: EntityExtractionRequest): Promise<AIResponse> {
    return {
      success: false,
      error: 'OpenAI integration requires installing the openai package. Run: npm install openai',
      provider: 'openai'
    };
  }

  async generateSuggestions(request: SuggestionRequest): Promise<AIResponse> {
    return {
      success: false,
      error: 'OpenAI integration requires installing the openai package. Run: npm install openai',
      provider: 'openai'
    };
  }
}

// Ollama Provider (Local)
class OllamaProvider extends BaseAIProvider {
  private baseUrl: string;
  private model: string;

  constructor(config: Record<string, any>) {
    super(config);
    this.baseUrl = config.baseUrl || 'http://localhost:11434';
    this.model = config.model;
  }

  validateConfig(): boolean {
    if (!this.baseUrl) {
      logger.error('OllamaProvider: Base URL is missing.');
      return false;
    }
    if (!this.model) {
      logger.error('OllamaProvider: Model is missing.');
      return false;
    }
    return true;
  }

  async testConnection(): Promise<AIResponse> {
    if (!this.isConfigured) {
      return { success: false, error: 'Ollama provider not configured correctly.' };
    }
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      if (!response.ok) {
        const errorText = await response.text();
        logger.error('Ollama connection test failed:', errorText);
        return { success: false, error: `Connection test failed: ${errorText}` };
      }
      // Check if the configured model exists
      const data = await response.json();
      const modelExists = data.models.some((m: any) => m.name.startsWith(this.model));
      if (!modelExists) {
        logger.warn(`Ollama model '${this.model}' not found. Available models: ${data.models.map((m:any) => m.name).join(', ')}`);
        return { success: false, error: `Model '${this.model}' not found in Ollama. Please ensure it's pulled.` };
      }

      logger.info('Ollama connection test successful.');
      return { success: true, data: 'Ollama connection successful and model found.' };
    } catch (error: any) {
      logger.error('Ollama connection test error:', error);
      return { success: false, error: error.message || 'Unknown error during connection test.' };
    }
  }

  async query(request: AIQueryRequest): Promise<AIResponse> {
    if (!this.isConfigured) {
      return { success: false, error: 'Ollama provider not configured correctly.' };
    }
    try {
      // Ollama uses a slightly different chat structure if system prompt is needed
      const messages = [];
      if (request.context) {
        messages.push({ role: 'system', content: request.context });
      }
      messages.push({ role: 'user', content: request.prompt });

      const body = JSON.stringify({
        model: this.model, // Model is specified in config for Ollama provider
        messages,
        stream: false, // For simplicity, not using streaming responses here
        options: {
          temperature: request.temperature || 0.7,
          num_predict: request.max_tokens // Ollama uses num_predict for max tokens
        }
      });
      
      logger.debug('Ollama query request body:', { body });

      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });

      const responseData = await response.json();
      logger.debug('Ollama query response data:', responseData);


      if (!response.ok || responseData.error) {
        logger.error('Ollama query failed:', responseData.error);
        return { success: false, error: responseData.error || 'Ollama API error' };
      }
      return { success: true, data: responseData.message?.content, usage: {tokens: responseData.eval_count} }; // eval_count is like prompt_tokens for Ollama
    } catch (error: any) {
      logger.error('Ollama query error:', error);
      return { success: false, error: error.message || 'Unknown error during Ollama query.' };
    }
  }

  async extractEntities(request: EntityExtractionRequest): Promise<AIResponse> {
    return { success: false, error: 'Entity extraction not implemented for Ollama yet.' };
  }

  async generateSuggestions(request: SuggestionRequest): Promise<AIResponse> {
    return { success: false, error: 'Suggestion generation not implemented for Ollama yet.' };
  }
}

// OpenRouter Provider
class OpenRouterProvider extends BaseAIProvider {
  private static cachedModels: any[] = [];
  private static cacheTime: number = 0;
  private static readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  validateConfig(): boolean {
    return !!(this.config.apiKey && this.config.model);
  }

  async testConnection(): Promise<AIResponse> {
    try {
      // Validate configuration first
      if (!this.config.apiKey || this.config.apiKey.trim() === '') {
        return {
          success: false,
          error: 'API key is required'
        };
      }

      if (!this.config.model) {
        return {
          success: false,
          error: 'Model selection is required'
        };
      }

      // Test authentication with a minimal chat completion request
      const baseUrl = this.config.baseUrl || 'https://openrouter.ai/api/v1';
      
      const testResponse = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
          'HTTP-Referer': 'https://localhost:3000',
          'X-Title': 'GraphMemory Knowledge Graph'
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [{ role: 'user', content: 'test' }],
          max_tokens: 1,
          temperature: 0
        })
      });

      if (!testResponse.ok) {
        const error = await testResponse.json().catch(() => ({}));
        
        // Handle specific error cases
        if (testResponse.status === 401) {
          return {
            success: false,
            error: `Authentication failed: ${error.error?.message || 'Invalid API key'}`
          };
        }
        
        if (testResponse.status === 403) {
          return {
            success: false,
            error: `Access forbidden: ${error.error?.message || 'API key lacks required permissions'}`
          };
        }
        
        if (testResponse.status === 404) {
          return {
            success: false,
            error: `Invalid base URL: ${baseUrl} - endpoint not found`
          };
        }
        
        if (testResponse.status === 400) {
          // Check for model-specific errors
          if (error.error?.message?.includes('model') || error.error?.message?.includes('Model')) {
            return {
              success: false,
              error: `Model '${this.config.model}' not available or invalid`
            };
          }
          return {
            success: false,
            error: `Bad request: ${error.error?.message || 'Invalid request parameters'}`
          };
        }
        
        return {
          success: false,
          error: `OpenRouter connection failed (${testResponse.status}): ${error.error?.message || testResponse.statusText}`
        };
      }

      // If we get here, the request was successful
      const responseData = await testResponse.json();
      
      // Verify we got a valid response
      if (!responseData.choices || !responseData.choices[0]) {
        return {
          success: false,
          error: 'Invalid response from OpenRouter API'
        };
      }

      // Optional: Get available models for display (but don't rely on this for authentication)
      let availableModels: string[] = [];
      try {
        const modelsResponse = await fetch(`${baseUrl}/models`, {
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'HTTP-Referer': 'https://localhost:3000',
            'X-Title': 'GraphMemory Knowledge Graph'
          }
        });
        
        if (modelsResponse.ok) {
          const modelsData = await modelsResponse.json();
          availableModels = modelsData.data?.slice(0, 10).map((m: any) => m.id) || [];
        }
      } catch (e) {
        // Models endpoint failure doesn't affect authentication test
      }

      return {
        success: true,
        data: { 
          message: 'Connection successful - API key and model are valid',
          availableModels,
          model: this.config.model,
          authenticated: true,
          usage: responseData.usage
        }
      };
    } catch (error: any) {
      // Handle network errors (wrong base URL, network issues, etc.)
      if (error.cause?.code === 'ENOTFOUND' || error.cause?.code === 'ECONNREFUSED') {
        return {
          success: false,
          error: `Invalid base URL: Cannot connect to ${this.config.baseUrl || 'https://openrouter.ai/api/v1'}`
        };
      }
      
      if (error.name === 'TypeError' && error.message.includes('fetch failed')) {
        return {
          success: false,
          error: `Network error: ${error.cause?.message || 'Unable to connect to OpenRouter API'}`
        };
      }
      
      return {
        success: false,
        error: `OpenRouter connection failed: ${error.message}`
      };
    }
  }

  async query(request: AIQueryRequest): Promise<AIResponse> {
    try {
      const messages = [];
      
      if (request.systemPrompt) {
        messages.push({
          role: 'system',
          content: request.systemPrompt
        });
      }

      if (request.context) {
        messages.push({
          role: 'system',
          content: `Context: ${JSON.stringify(request.context)}`
        });
      }

      messages.push({
        role: 'user',
        content: request.prompt
      });

      const requestBody = {
        model: this.config.model,
        messages,
        max_tokens: request.max_tokens || this.config.max_tokens || 1000,
        temperature: request.temperature || 0.7,
        stream: false
      };

      const response = await fetch(`${this.config.baseUrl || 'https://openrouter.ai/api/v1'}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
          'HTTP-Referer': 'https://localhost:3000',
          'X-Title': 'GraphMemory Knowledge Graph'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        return {
          success: false,
          error: `OpenRouter query failed: ${error.error?.message || response.statusText}`,
          provider: 'openrouter'
        };
      }

      const data = await response.json();

      return {
        success: true,
        data: { 
          response: data.choices?.[0]?.message?.content || 'No response generated',
          model: data.model,
          usage: data.usage
        },
        provider: 'openrouter',
        usage: {
          tokens: data.usage?.total_tokens || 0,
          cost: this.calculateCost(data.usage, data.model)
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: `OpenRouter query failed: ${error.message}`,
        provider: 'openrouter'
      };
    }
  }

  async extractEntities(request: EntityExtractionRequest): Promise<AIResponse> {
    const systemPrompt = `You are an expert at extracting entities from text. Extract relevant entities (functions, classes, components, APIs, etc.) from the provided text. Return only a clean list of entities, one per line, without bullets or numbering.`;

    const prompt = `Extract entities from this text:

"${request.text}"

Entities:`;

    const response = await this.query({ 
      prompt, 
      systemPrompt,
      max_tokens: 300,
      temperature: 0.3
    });

    if (!response.success) {
      return response;
    }

    const entities = response.data.response
      .split('\n')
      .map((line: string) => line.trim().replace(/^[-*]\s*/, ''))
      .filter((entity: string) => entity.length > 0 && entity.length < 100)
      .slice(0, 20); // Limit to 20 entities

    return {
      success: true,
      data: { entities },
      provider: 'openrouter',
      usage: response.usage
    };
  }

  async generateSuggestions(request: SuggestionRequest): Promise<AIResponse> {
    const systemPrompt = `You are a knowledge graph expert. Analyze the provided context and generate 3-5 specific, actionable suggestions to improve the knowledge graph structure, relationships, or content. Return suggestions in this exact JSON format:

[
  {
    "title": "suggestion title",
    "description": "detailed description",
    "priority": "high|medium|low",
    "category": "Architecture|Relationships|Content|Patterns|etc",
    "actionLabel": "specific action verb"
  }
]`;

    const prompt = `Analyze this knowledge graph context and provide improvement suggestions:

Context: ${JSON.stringify(request.context)}
Knowledge Graph: ${JSON.stringify(request.knowledgeGraph)}
${request.userHistory ? `User History: ${JSON.stringify(request.userHistory)}` : ''}

Provide ${request.maxSuggestions || 5} suggestions as JSON:`;

    const response = await this.query({ 
      prompt, 
      systemPrompt,
      max_tokens: 800,
      temperature: 0.7
    });

    if (!response.success) {
      return response;
    }

    try {
      // Try to parse JSON response
      const jsonMatch = response.data.response.match(/\[[\s\S]*\]/);
      let suggestions = [];
      
      if (jsonMatch) {
        suggestions = JSON.parse(jsonMatch[0]);
      } else {
        // Fallback to text parsing
        suggestions = this.parseTextSuggestions(response.data.response);
      }

      return {
        success: true,
        data: { suggestions },
        provider: 'openrouter',
        usage: response.usage
      };
    } catch (error) {
      // Fallback to text parsing if JSON fails
      const suggestions = this.parseTextSuggestions(response.data.response);
      return {
        success: true,
        data: { suggestions },
        provider: 'openrouter',
        usage: response.usage
      };
    }
  }

  private parseTextSuggestions(text: string): any[] {
    const suggestions: any[] = [];
    const lines = text.split('\n');
    let currentSuggestion: any = {};

    for (const line of lines) {
      const titleMatch = line.match(/(?:title|Title):\s*(.+)/i);
      const descMatch = line.match(/(?:description|Description):\s*(.+)/i);
      const priorityMatch = line.match(/(?:priority|Priority):\s*(.+)/i);
      const categoryMatch = line.match(/(?:category|Category):\s*(.+)/i);

      if (titleMatch) {
        if (currentSuggestion.title) {
          suggestions.push(currentSuggestion);
          currentSuggestion = {};
        }
        currentSuggestion.title = titleMatch[1].trim();
      } else if (descMatch) {
        currentSuggestion.description = descMatch[1].trim();
      } else if (priorityMatch) {
        currentSuggestion.priority = priorityMatch[1].trim().toLowerCase();
      } else if (categoryMatch) {
        currentSuggestion.category = categoryMatch[1].trim();
        currentSuggestion.actionLabel = 'Review';
      }
    }

    if (currentSuggestion.title) {
      suggestions.push(currentSuggestion);
    }

    return suggestions.slice(0, 5);
  }

  private calculateCost(usage: any, model: string): number {
    if (!usage) return 0;
    
    // Rough cost estimation - in a real implementation, you'd fetch pricing from OpenRouter's API
    const promptTokens = usage.prompt_tokens || 0;
    const completionTokens = usage.completion_tokens || 0;
    
    // Free models cost nothing
    if (model.includes(':free')) return 0;
    
    // Rough estimates for different model tiers (per 1M tokens)
    let promptCost = 0.0015; // $1.50 per 1M tokens
    let completionCost = 0.002; // $2.00 per 1M tokens
    
    if (model.includes('gpt-4')) {
      promptCost = 0.03;
      completionCost = 0.06;
    } else if (model.includes('claude-3-opus')) {
      promptCost = 0.015;
      completionCost = 0.075;
    } else if (model.includes('claude-3-sonnet')) {
      promptCost = 0.003;
      completionCost = 0.015;
    }
    
    return ((promptTokens * promptCost) + (completionTokens * completionCost)) / 1000000;
  }

  // Static method to fetch available models from OpenRouter
  static async fetchAvailableModels(apiKey?: string): Promise<string[]> {
    try {
      // Check cache first
      const now = Date.now();
      if (this.cachedModels.length > 0 && (now - this.cacheTime) < this.CACHE_DURATION) {
        return this.cachedModels.map(m => m.id);
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
        console.warn('Failed to fetch OpenRouter models, using fallback list');
        return this.getFallbackModels();
      }

      const data = await response.json();
      this.cachedModels = data.data || [];
      this.cacheTime = now;

      // Return models with free variants prioritized
      const models = this.cachedModels.map(m => m.id);
      const freeModels = models.filter(id => this.cachedModels.find(m => m.id === id)?.pricing?.prompt === '0');
      const paidModels = models.filter(id => !freeModels.includes(id));

      // Add :free variants for popular models
      const popularModels = ['openai/gpt-3.5-turbo', 'anthropic/claude-3-haiku', 'meta-llama/llama-3-8b-instruct'];
      const freeVariants = popularModels.map(model => `${model}:free`);

      return [...freeVariants, ...freeModels, ...paidModels].slice(0, 100); // Limit to 100 models
    } catch (error) {
      console.warn('Error fetching OpenRouter models:', error);
      return this.getFallbackModels();
    }
  }

  private static getFallbackModels(): string[] {
    return [
      // Working models (confirmed available)
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
    ];
  }
}

// NEW LMStudioProvider
class LMStudioProvider extends BaseAIProvider {
  private client: LMStudioClient | null = null;
  private modelIdentifier: string;
  private baseUrl: string; // This will store the HTTP URL for general reference
  private wsBaseUrl: string; // This will store the WebSocket URL for the client

  constructor(config: Record<string, any>) {
    super(config);
    logger.debug('LMStudioProvider constructor received config:', { config });
    
    // Store the original HTTP-like base URL (e.g., from settings UI)
    const httpBaseUrl = config.lmStudioServerUrl || config.baseUrl || 'http://localhost:1234';
    this.baseUrl = httpBaseUrl; 

    // Convert to WebSocket URL for the client
    if (httpBaseUrl.startsWith('http://')) {
      this.wsBaseUrl = httpBaseUrl.replace('http://', 'ws://');
    } else if (httpBaseUrl.startsWith('https://')) {
      this.wsBaseUrl = httpBaseUrl.replace('https://', 'wss://');
    } else {
      // If no protocol, assume ws for localhost, or log warning
      if (httpBaseUrl.includes('localhost') || httpBaseUrl.includes('127.0.0.1')) {
        this.wsBaseUrl = `ws://${httpBaseUrl.replace(/^ws:\/\/|wss:\/\//, '')}`;
      } else {
        logger.warn(`LMStudioProvider: Could not determine WebSocket protocol for baseUrl: ${httpBaseUrl}. Attempting as is.`);
        this.wsBaseUrl = httpBaseUrl; // Attempt as is, might fail
      }
    }
    logger.info(`LMStudioProvider: HTTP baseUrl: ${this.baseUrl}, WebSocket wsBaseUrl for client: ${this.wsBaseUrl}`);

    this.modelIdentifier = config.modelIdentifier;
    this.initializeClient(); 
  }

  private async initializeClient(): Promise<boolean> {
    if (this.client) return true;
    try {
      this.client = new LMStudioClient({ baseUrl: this.wsBaseUrl }); // Use wsBaseUrl
      logger.info(`LMStudioProvider: Client initialized for model ${this.modelIdentifier} at ${this.wsBaseUrl}`);
      return true;
    } catch (error: any) {
      logger.error('LMStudioProvider: Failed to initialize client:', error);
      this.client = null;
      return false;
    }
  }
  
  validateConfig(): boolean {
    if (!this.config.modelIdentifier) { 
      logger.error('LMStudioProvider: Model Identifier is missing in the provided config.');
      return false;
    }
    if (!this.baseUrl) {
        logger.warn('LMStudioProvider: Base URL not effectively set during validateConfig. This might be okay if default is used.');
    }
    return true;
  }

  async testConnection(): Promise<AIResponse> {
    if (!this.isConfigured) {
      return { success: false, error: 'LMStudio provider not configured (modelIdentifier missing).' };
    }
    if (!await this.initializeClient() || !this.client) {
        return { success: false, error: 'Failed to initialize LMStudio client.' };
    }

    try {
      // The SDK doesn't have a direct "list models" or "ping server" function easily exposed.
      // A simple way to test is to try to get a handle to the model.
      // This might implicitly check if the server is reachable and the model identifier is known.
      // Note: This might attempt to load the model, which could be slow.
      // A better test would be a lightweight health check if the LM Studio server API supports it.
      // For now, we assume getting the model object is a reasonable test.
      
      // Attempt to get the model. The SDK might throw if server is down or model is invalid.
      // We don't call .load() here, just get the model object.
      const model = await this.client.llm.model(this.modelIdentifier);

      if (!model) {
        logger.error(`LMStudioProvider: Model '${this.modelIdentifier}' not found or server unreachable at ${this.baseUrl}.`);
        return { success: false, error: `Model '${this.modelIdentifier}' not found or server unreachable. Ensure LM Studio is running and the model path is correct.` };
      }
      
      // To get more info like if it's loaded, you might use:
      // const loadedModel = await this.client.llm.getLoaded(this.modelIdentifier);
      // For a simple connection test, just getting the model object should suffice to check server reachability.

      logger.info(`LMStudioProvider: Connection test successful for model ${this.modelIdentifier} at ${this.baseUrl}. Model object retrieved.`);
      return { success: true, data: `LMStudio connection successful. Model '${this.modelIdentifier}' accessible.` };
    } catch (error: any) {
      logger.error('LMStudioProvider connection test error:', error);
      let errorMessage = error.message || 'Unknown error during connection test.';
      if (error.message && error.message.includes('fetch failed')) {
        errorMessage = `Failed to connect to LM Studio server at ${this.baseUrl}. Is it running?`;
      }
      return { success: false, error: errorMessage };
    }
  }

  async query(request: AIQueryRequest): Promise<AIResponse> {
    if (!this.isConfigured || !this.client) {
      return { success: false, error: 'LMStudio provider not configured or client not initialized.' };
    }
    try {
      const model = await this.client.llm.model(this.modelIdentifier);
      if (!model) {
        return { success: false, error: `LMStudio model '${this.modelIdentifier}' not found or could not be loaded.` };
      }

      const messages = [];
      if (request.systemPrompt) {
        messages.push({ role: 'system', content: request.systemPrompt });
      }
      if (request.context) {
        // Assuming context is a string or can be stringified for system message
        messages.push({ role: 'system', content: typeof request.context === 'string' ? request.context : JSON.stringify(request.context) });
      }
      messages.push({ role: 'user', content: request.prompt });

      const predictOptions: any = {
        max_tokens: request.max_tokens || this.config.max_tokens || 1000,
        temperature: request.temperature || this.config.temperature || 0.7,
      };
      // Add other compatible options from this.config or request if needed

      logger.debug(`LMStudioProvider: Querying model ${this.modelIdentifier} with messages:`, { messages, predictOptions });

      // Using model.respond based on SDK example, assuming it fits the general query purpose
      const llmResponse = await model.respond(messages, predictOptions);

      if (!llmResponse || (typeof llmResponse === 'object' && 'error' in llmResponse)) {
        const errorMsg = (typeof llmResponse === 'object' && llmResponse && 'error' in llmResponse) ? (llmResponse as any).error : 'Unknown error from LMStudio';
        logger.error('LMStudio query failed:', errorMsg);
        return { success: false, error: errorMsg, provider: 'lmstudio' };
      }
      
      const content = typeof llmResponse === 'string' ? llmResponse : (llmResponse as any).content;

      return {
        success: true,
        data: content, // Adjust based on actual llmResponse structure
        provider: 'lmstudio',
        // Add usage data if available from llmResponse
      };
    } catch (error: any) {
      logger.error('LMStudioProvider query error:', error);
      let errorMessage = error.message || 'Unknown error during LMStudio query.';
       if (error.message && error.message.includes('fetch failed')) {
        errorMessage = `Failed to connect to LM Studio server at ${this.baseUrl} for query. Is it running?`;
      }
      return { success: false, error: errorMessage };
    }
  }

  async extractEntities(request: EntityExtractionRequest): Promise<AIResponse> {
    // TODO: Implement proper entity extraction with LMStudio if supported
    // For now, falling back to a generic "not supported" or simple extraction.
    if (!this.isConfigured || !this.client) {
      return { success: false, error: 'LMStudio provider not configured or client not initialized.' };
    }
     // Fallback to simple pattern matching or a specific prompt
    const entities = this.simpleEntityExtraction(request.text, request.projectContext);
    return {
      success: true,
      data: { entities },
      provider: 'lmstudio-pattern-matching'
    };
  }

  async generateSuggestions(request: SuggestionRequest): Promise<AIResponse> {
    // TODO: Implement proper suggestion generation with LMStudio if supported
    if (!this.isConfigured || !this.client) {
      return { success: false, error: 'LMStudio provider not configured or client not initialized.' };
    }
    return {
      success: false,
      error: 'Suggestion generation not yet implemented for LMStudioProvider.',
      provider: 'lmstudio'
    };
  }
  
  // Added a simple helper for fallback, can be expanded
  private simpleEntityExtraction(text: string, projectContext?:any): string[] {
    // Simple pattern-based extraction as fallback
    // Consider using projectContext to refine patterns if needed
    const patterns = [
      /\b[A-Z][a-zA-Z]*(?:\s+[A-Z][a-zA-Z]*)*\b/g, // Title case words
      /\b(?:class|function|method|component|service|api|endpoint)\s+([A-Za-z][A-Za-z0-9]*)\b/gi, // Code entities
    ];

    const entities = new Set<string>();
    patterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(match => {
          if (match.length > 2 && match.length < 50) { // Basic filtering
            entities.add(match.trim());
          }
        });
      }
    });
    return Array.from(entities);
  }
}

// Main AI Service
export class AIService {
  private provider: BaseAIProvider;
  private config: AIConfiguration;
  private features: AIFeatures;

  constructor(settings: { aiConfiguration: AIConfiguration, aiFeatures: AIFeatures }) {
    this.config = settings.aiConfiguration;
    this.features = settings.aiFeatures;
    this.provider = this.createProvider();
    logger.info(`AIService initialized with provider: ${this.provider.constructor.name}`);
  }

  private createProvider(): BaseAIProvider {
    const providerType = this.config.provider || 'none';
    const providerConfig = this.config.config || {};
    logger.info(`Creating AI provider of type: ${providerType}`);

    switch (providerType) {
      case 'openai':
        // return new OpenAIProvider(providerConfig); // OpenAI not fully implemented
        logger.warn("OpenAI provider is selected but not fully implemented. Falling back to NoAIProvider.");
        return new NoAIProvider({});
      case 'ollama':
        return new OllamaProvider(providerConfig);
      case 'openrouter':
        return new OpenRouterProvider(providerConfig);
      case 'lmstudio':
        return new LMStudioProvider(providerConfig);
      case 'none':
      default:
        logger.info("No AI provider specified or 'none' selected. Using NoAIProvider.");
        return new NoAIProvider({});
    }
  }

  updateConfiguration(config: AIConfiguration, features: AIFeatures) {
    logger.info('Updating AI Service configuration and features', { newProvider: config.provider });
    this.config = config;
    this.features = features;
    this.provider = this.createProvider(); // Re-create provider with new config
    logger.info(`AIService re-initialized with provider: ${this.provider.constructor.name}`);
  }

  isFeatureEnabled(feature: keyof AIFeatures): boolean {
    return !!this.features[feature];
  }

  async testConnection(): Promise<AIResponse> {
    logger.info('Testing AI provider connection...');
    return this.provider.testConnection();
  }

  async queryNaturalLanguage(prompt: string, context?: any, systemPrompt?: string): Promise<AIResponse> {
    if (!this.isFeatureEnabled('naturalLanguageQuery')) {
      return { success: false, error: "Natural language queries are disabled." };
    }
    logger.info('Querying natural language with prompt:', { prompt, context, systemPrompt });
    return this.provider.query({ prompt, context, systemPrompt, max_tokens: this.config.config?.maxTokens || 1000 });
  }

  async extractEntities(text: string, existingEntities?: string[], projectContext?: any): Promise<AIResponse> {
    if (!this.isFeatureEnabled('smartEntityExtraction')) {
      return { success: false, error: "Entity extraction is disabled." };
    }
    logger.info('Extracting entities from text:', { text, existingEntities, projectContext });
    return this.provider.extractEntities({ text, existingEntities, projectContext });
  }

  async generateSuggestions(context: any, knowledgeGraph?: any, userHistory?: any[]): Promise<AIResponse> {
    if (!this.isFeatureEnabled('intelligentSuggestions')) {
      return { success: false, error: "Smart suggestions are disabled." };
    }
    logger.info('Generating suggestions with context:', { context, knowledgeGraph, userHistory });
    return this.provider.generateSuggestions({ context, knowledgeGraph, userHistory });
  }

  getProviderInfo(): { name: string; type: string; isReady: boolean } {
    return {
      name: this.config.provider,
      type: this.provider.constructor.name,
      isReady: this.provider.isReady()
    };
  }
}

// Export OpenRouterProvider for external use (e.g., model fetching)
export { OpenRouterProvider }; 