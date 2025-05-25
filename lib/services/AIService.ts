import { AIConfiguration, AIFeatures } from '../models/Settings';

export interface AIResponse {
  success: boolean;
  data?: any;
  error?: string;
  provider?: string;
  usage?: {
    tokens?: number;
    cost?: number;
  };
}

export interface AIQueryRequest {
  prompt: string;
  context?: any;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}

export interface EntityExtractionRequest {
  text: string;
  existingEntities?: string[];
  projectContext?: any;
}

export interface SuggestionRequest {
  context: any;
  knowledgeGraph: any;
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
  validateConfig(): boolean {
    return !!(this.config.baseUrl && this.config.model);
  }

  async testConnection(): Promise<AIResponse> {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/tags`);
      const data = await response.json();
      
      const modelExists = data.models?.some((m: any) => m.name.includes(this.config.model));
      
      return {
        success: modelExists,
        data: { 
          message: modelExists ? 'Connection successful' : 'Model not found',
          availableModels: data.models?.map((m: any) => m.name) || []
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Ollama connection failed: ${error.message}`
      };
    }
  }

  async query(request: AIQueryRequest): Promise<AIResponse> {
    try {
      let prompt = request.prompt;
      
      if (request.systemPrompt) {
        prompt = `${request.systemPrompt}\n\nUser: ${prompt}`;
      }

      if (request.context) {
        prompt = `Context: ${JSON.stringify(request.context)}\n\n${prompt}`;
      }

      const response = await fetch(`${this.config.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.config.model,
          prompt,
          stream: false,
          options: {
            temperature: request.temperature || 0.7,
            num_predict: request.maxTokens || 1000
          }
        })
      });

      const data = await response.json();

      return {
        success: response.ok,
        data: { response: data.response },
        provider: 'ollama'
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Ollama query failed: ${error.message}`,
        provider: 'ollama'
      };
    }
  }

  async extractEntities(request: EntityExtractionRequest): Promise<AIResponse> {
    const prompt = `Extract relevant entities (functions, classes, components, APIs, etc.) from this text and return them as a simple list:

Text: "${request.text}"

Entities:`;

    const response = await this.query({ prompt, maxTokens: 200 });

    if (!response.success) {
      return response;
    }

    const entities = response.data.response
      .split('\n')
      .map((line: string) => line.trim().replace(/^[-*]\s*/, ''))
      .filter((entity: string) => entity.length > 0 && entity.length < 50);

    return {
      success: true,
      data: { entities },
      provider: 'ollama'
    };
  }

  async generateSuggestions(request: SuggestionRequest): Promise<AIResponse> {
    const prompt = `Analyze this knowledge graph and suggest 3-5 improvements:

Context: ${JSON.stringify(request.context)}

Provide suggestions in this format:
- Title: [suggestion title]
- Description: [detailed description] 
- Priority: [high/medium/low]
- Category: [Architecture/Relationships/Patterns/etc.]

Suggestions:`;

    const response = await this.query({ prompt, maxTokens: 600 });

    if (!response.success) {
      return response;
    }

    // Parse the text response into structured suggestions
    const suggestions = this.parseOllamaSuggestions(response.data.response);

    return {
      success: true,
      data: { suggestions },
      provider: 'ollama'
    };
  }

  private parseOllamaSuggestions(text: string): any[] {
    // Parse Ollama's text response into structured format
    const suggestions: any[] = [];
    const blocks = text.split(/(?=- Title:)/);

    blocks.forEach(block => {
      const titleMatch = block.match(/- Title:\s*(.+)/);
      const descMatch = block.match(/- Description:\s*(.+)/);
      const priorityMatch = block.match(/- Priority:\s*(.+)/);
      const categoryMatch = block.match(/- Category:\s*(.+)/);

      if (titleMatch && descMatch) {
        suggestions.push({
          title: titleMatch[1].trim(),
          description: descMatch[1].trim(),
          priority: priorityMatch?.[1]?.trim().toLowerCase() || 'medium',
          category: categoryMatch?.[1]?.trim() || 'General',
          actionLabel: 'Review'
        });
      }
    });

    return suggestions;
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
        max_tokens: request.maxTokens || this.config.maxTokens || 1000,
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
    const systemPrompt = `You are an expert at extracting entities from text. Extract relevant entities (functions, classes, components, APIs, concepts, etc.) from the provided text. Return only a clean list of entities, one per line, without bullets or numbering.`;

    const prompt = `Extract entities from this text:

"${request.text}"

${request.existingEntities ? `Existing entities to consider: ${request.existingEntities.join(', ')}` : ''}

Entities:`;

    const response = await this.query({ 
      prompt, 
      systemPrompt,
      maxTokens: 300,
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
      maxTokens: 800,
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

// Main AI Service
export class AIService {
  private provider: BaseAIProvider;
  private config: AIConfiguration;
  private features: AIFeatures;

  constructor(config: AIConfiguration, features: AIFeatures) {
    this.config = config;
    this.features = features;
    this.provider = this.createProvider();
  }

  private createProvider(): BaseAIProvider {
    switch (this.config.provider) {
      case 'openai':
        return new OpenAIProvider(this.config.config);
      case 'ollama':
        return new OllamaProvider(this.config.config);
      case 'openrouter':
        return new OpenRouterProvider(this.config.config);
      // Add other providers here
      default:
        return new NoAIProvider({});
    }
  }

  updateConfiguration(config: AIConfiguration, features: AIFeatures) {
    this.config = config;
    this.features = features;
    this.provider = this.createProvider();
  }

  isFeatureEnabled(feature: keyof AIFeatures): boolean {
    return this.config.enabled && this.features[feature];
  }

  async testConnection(): Promise<AIResponse> {
    if (!this.config.enabled) {
      return { success: true, data: { message: 'AI is disabled' } };
    }
    return this.provider.testConnection();
  }

  async queryNaturalLanguage(prompt: string, context?: any): Promise<AIResponse> {
    if (!this.isFeatureEnabled('naturalLanguageQuery')) {
      return {
        success: false,
        error: 'Natural language query is disabled. Enable it in AI settings.'
      };
    }

    const systemPrompt = `You are a helpful AI assistant for a knowledge graph system. Answer questions about the knowledge graph data provided in the context. Be specific and reference the actual entities and relationships when possible.`;

    return this.provider.query({
      prompt,
      context,
      systemPrompt,
      maxTokens: 1000
    });
  }

  async extractEntities(text: string, existingEntities?: string[], projectContext?: any): Promise<AIResponse> {
    if (!this.isFeatureEnabled('smartEntityExtraction')) {
      // Fallback to pattern matching
      return this.provider.extractEntities({ text, existingEntities, projectContext });
    }

    return this.provider.extractEntities({ text, existingEntities, projectContext });
  }

  async generateSuggestions(context: any, knowledgeGraph: any, userHistory?: any[]): Promise<AIResponse> {
    if (!this.isFeatureEnabled('intelligentSuggestions')) {
      return {
        success: false,
        error: 'Intelligent suggestions are disabled. Enable them in AI settings.'
      };
    }

    return this.provider.generateSuggestions({
      context,
      knowledgeGraph,
      userHistory,
      maxSuggestions: 5
    });
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