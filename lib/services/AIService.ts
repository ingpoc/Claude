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