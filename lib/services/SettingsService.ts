import { UserSettings, DEFAULT_SETTINGS, AIConfiguration, AIFeatures } from '../models/Settings';
import { logger } from './Logger';
import { databaseService } from './DatabaseService';
import { v4 as uuidv4 } from 'uuid';

export class SettingsService {
  private settingsCache = new Map<string, UserSettings>();
  private static instance: SettingsService;
  private readonly SETTINGS_PROJECT_ID = 'settings'; // Special project for settings storage

  static getInstance(): SettingsService {
    if (!SettingsService.instance) {
      SettingsService.instance = new SettingsService();
    }
    return SettingsService.instance;
  }

  async getUserSettings(userId: string): Promise<UserSettings> {
    try {
      // Clear cache to ensure fresh database query
      this.clearCache(userId);
      
      const query = `
        MATCH (s:UserSettings)
        WHERE s.userId = '${userId}'
        RETURN s.id, s.userId, s.aiProvider, s.aiEnabled, s.apiKey, s.model, s.baseUrl, s.maxTokens, s.aiFeatures, s.privacy, s.performance, s.ui, s.createdAt, s.updatedAt
      `;

      const result = await databaseService.executeQuery(this.SETTINGS_PROJECT_ID, query);
      
      if (result && (result as any).hasNext()) {
        // Parse settings from database
        const row = (result as any).getNextSync();
        
        const settings: UserSettings = {
          id: row['s.id'],
          userId: row['s.userId'],
          aiConfiguration: {
            provider: row['s.aiProvider'] || DEFAULT_SETTINGS.aiConfiguration.provider,
            enabled: row['s.aiEnabled'] || DEFAULT_SETTINGS.aiConfiguration.enabled,
            config: {
              apiKey: row['s.apiKey'] || '',
              model: row['s.model'] || DEFAULT_SETTINGS.aiConfiguration.config.model,
              baseUrl: row['s.baseUrl'] || DEFAULT_SETTINGS.aiConfiguration.config.baseUrl,
              maxTokens: row['s.maxTokens'] || DEFAULT_SETTINGS.aiConfiguration.config.maxTokens
            }
          },
          aiFeatures: row['s.aiFeatures'] ? JSON.parse(row['s.aiFeatures']) : DEFAULT_SETTINGS.aiFeatures,
          privacy: row['s.privacy'] ? JSON.parse(row['s.privacy']) : DEFAULT_SETTINGS.privacy,
          performance: row['s.performance'] ? JSON.parse(row['s.performance']) : DEFAULT_SETTINGS.performance,
          ui: row['s.ui'] ? JSON.parse(row['s.ui']) : DEFAULT_SETTINGS.ui,
          createdAt: new Date(row['s.createdAt']),
          updatedAt: new Date(row['s.updatedAt'])
        };

        // Cache the settings
        const cacheKey = `user:${userId}`;
        this.settingsCache.set(cacheKey, settings);
        logger.info(`Loaded settings from database for user ${userId}`);
        return settings;
      }

      // Create default settings if none exist
      const defaultSettings: UserSettings = {
        id: uuidv4(),
        userId,
        ...DEFAULT_SETTINGS,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Save to database
      await this.saveSettingsToDatabase(defaultSettings);

      // Cache the settings
      const cacheKey = `user:${userId}`;
      this.settingsCache.set(cacheKey, defaultSettings);
      logger.info(`Created default settings for user ${userId}`);
      return defaultSettings;

    } catch (error) {
      logger.error(`Failed to get user settings for ${userId}:`, error);
      
      // Return default settings as fallback
      return {
        id: uuidv4(),
        userId,
        ...DEFAULT_SETTINGS,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    }
  }

  // Save settings to database
  private async saveSettingsToDatabase(settings: UserSettings): Promise<boolean> {
    try {
      // First try to update existing settings
      const updateQuery = `
        MATCH (s:UserSettings)
        WHERE s.userId = '${settings.userId}'
        SET s.aiProvider = '${settings.aiConfiguration.provider}',
            s.aiEnabled = ${settings.aiConfiguration.enabled},
            s.apiKey = '${(settings.aiConfiguration.config.apiKey || '').replace(/'/g, "\\'")}',
            s.model = '${(settings.aiConfiguration.config.model || '').replace(/'/g, "\\'")}',
            s.baseUrl = '${(settings.aiConfiguration.config.baseUrl || '').replace(/'/g, "\\'")}',
            s.maxTokens = ${settings.aiConfiguration.config.maxTokens || 1000},
            s.aiFeatures = '${JSON.stringify(settings.aiFeatures).replace(/'/g, "\\'")}',
            s.privacy = '${JSON.stringify(settings.privacy).replace(/'/g, "\\'")}',
            s.performance = '${JSON.stringify(settings.performance).replace(/'/g, "\\'")}',
            s.ui = '${JSON.stringify(settings.ui).replace(/'/g, "\\'")}',
            s.updatedAt = timestamp('${settings.updatedAt.toISOString()}')
        RETURN s.id;
      `;
      
      let updateResult = await databaseService.executeQuery(this.SETTINGS_PROJECT_ID, updateQuery);

      // If no existing record found, create new one
      if (!updateResult || !(updateResult as any).hasNext()) {
        const createQuery = `
          CREATE (s:UserSettings {
            id: '${settings.id}',
            userId: '${settings.userId}',
            aiProvider: '${settings.aiConfiguration.provider}',
            aiEnabled: ${settings.aiConfiguration.enabled},
            apiKey: '${(settings.aiConfiguration.config.apiKey || '').replace(/'/g, "\\'")}',
            model: '${(settings.aiConfiguration.config.model || '').replace(/'/g, "\\'")}',
            baseUrl: '${(settings.aiConfiguration.config.baseUrl || '').replace(/'/g, "\\'")}',
            maxTokens: ${settings.aiConfiguration.config.maxTokens || 1000},
            aiFeatures: '${JSON.stringify(settings.aiFeatures).replace(/'/g, "\\'")}',
            privacy: '${JSON.stringify(settings.privacy).replace(/'/g, "\\'")}',
            performance: '${JSON.stringify(settings.performance).replace(/'/g, "\\'")}',
            ui: '${JSON.stringify(settings.ui).replace(/'/g, "\\'")}',
            createdAt: timestamp('${settings.createdAt.toISOString()}'),
            updatedAt: timestamp('${settings.updatedAt.toISOString()}')
          });
        `;

        updateResult = await databaseService.executeQuery(this.SETTINGS_PROJECT_ID, createQuery);
      }

      const result = updateResult;
      
      if (result) {
        logger.info(`Settings saved to database for user ${settings.userId}`);
        return true;
      }
      return false;
    } catch (error) {
      logger.error('Failed to save settings to database:', error);
      return false;
    }
  }

  async updateUserSettings(userId: string, updates: Partial<UserSettings>): Promise<UserSettings> {
    try {
      const currentSettings = await this.getUserSettings(userId);
      const updatedSettings: UserSettings = {
        ...currentSettings,
        ...updates,
        userId, // Ensure userId doesn't change
        id: currentSettings.id, // Ensure ID doesn't change
        updatedAt: new Date()
      };

      // Save to database first
      const saved = await this.saveSettingsToDatabase(updatedSettings);
      if (!saved) {
        logger.warn(`Failed to save settings to database for user ${userId}, using cache only`);
      }

      // Update cache
      const cacheKey = `user:${userId}`;
      this.settingsCache.set(cacheKey, updatedSettings);

      logger.info(`Updated settings for user ${userId}`);
      return updatedSettings;

    } catch (error) {
      logger.error(`Failed to update settings for user ${userId}:`, error);
      throw error;
    }
  }

  async updateAIConfiguration(userId: string, aiConfig: AIConfiguration): Promise<UserSettings> {
    return this.updateUserSettings(userId, {
      aiConfiguration: aiConfig
    });
  }

  async updateAIFeatures(userId: string, aiFeatures: AIFeatures): Promise<UserSettings> {
    return this.updateUserSettings(userId, {
      aiFeatures: aiFeatures
    });
  }

  async toggleAIFeature(userId: string, feature: keyof AIFeatures, enabled: boolean): Promise<UserSettings> {
    const currentSettings = await this.getUserSettings(userId);
    const updatedFeatures = {
      ...currentSettings.aiFeatures,
      [feature]: enabled
    };
    
    return this.updateUserSettings(userId, {
      aiFeatures: updatedFeatures
    });
  }

  async validateAIConfiguration(config: AIConfiguration): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];

    if (!config.provider) {
      errors.push('AI provider is required');
      return { isValid: false, errors };
    }

    if (config.provider === 'none') {
      return { isValid: true, errors: [] };
    }

    if (config.provider === 'openai') {
      if (!config.config.apiKey) {
        errors.push('OpenAI API key is required');
      }
      if (!config.config.model) {
        errors.push('OpenAI model is required');
      }
    }

    if (config.provider === 'ollama') {
      if (!config.config.baseUrl) {
        errors.push('Ollama base URL is required');
      }
      if (!config.config.model) {
        errors.push('Ollama model is required');
      }
    }

    if (config.provider === 'anthropic') {
      if (!config.config.apiKey) {
        errors.push('Anthropic API key is required');
      }
      if (!config.config.model) {
        errors.push('Anthropic model is required');
      }
    }

    if (config.provider === 'openrouter') {
      if (!config.config.apiKey) {
        errors.push('OpenRouter API key is required');
      }
      if (!config.config.model) {
        errors.push('OpenRouter model is required');
      }
      if (config.config.baseUrl && !config.config.baseUrl.startsWith('http')) {
        errors.push('OpenRouter base URL must be a valid HTTP/HTTPS URL');
      }
    }

    return { isValid: errors.length === 0, errors };
  }

  async testAIConnection(userId: string): Promise<{ success: boolean; message: string; provider?: string }> {
    try {
      const settings = await this.getUserSettings(userId);
      
      if (!settings.aiConfiguration.enabled) {
        return { success: true, message: 'AI is disabled' };
      }

      // Import AIService dynamically to avoid circular dependency
      const { AIService } = await import('./AIService');
      const aiService = new AIService(settings.aiConfiguration, settings.aiFeatures);
      
      const result = await aiService.testConnection();
      
      return {
        success: result.success,
        message: result.error || result.data?.message || 'Connection test completed',
        provider: settings.aiConfiguration.provider
      };

    } catch (error) {
      logger.error(`Failed to test AI connection for user ${userId}:`, error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Connection test failed'
      };
    }
  }

  async resetSettings(userId: string): Promise<UserSettings> {
    try {
      const defaultSettings: UserSettings = {
        id: uuidv4(),
        userId,
        ...DEFAULT_SETTINGS,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Update cache
      const cacheKey = `user:${userId}`;
      this.settingsCache.set(cacheKey, defaultSettings);

      logger.info(`Reset settings for user ${userId}`);
      return defaultSettings;

    } catch (error) {
      logger.error(`Failed to reset settings for user ${userId}:`, error);
      throw error;
    }
  }

  async exportSettings(userId: string): Promise<Record<string, any>> {
    const settings = await this.getUserSettings(userId);
    
    // Remove sensitive data like API keys for export
    const exportData = {
      aiFeatures: settings.aiFeatures,
      privacy: settings.privacy,
      performance: settings.performance,
      ui: settings.ui,
      aiConfiguration: {
        provider: settings.aiConfiguration.provider,
        enabled: settings.aiConfiguration.enabled,
        // Don't export sensitive config data
      }
    };

    return exportData;
  }

  async importSettings(userId: string, importData: Partial<UserSettings>): Promise<UserSettings> {
    const currentSettings = await this.getUserSettings(userId);
    
    // Merge imported settings with current settings
    const mergedSettings = {
      ...currentSettings,
      ...importData,
      // Preserve certain fields
      id: currentSettings.id,
      userId: currentSettings.userId,
      createdAt: currentSettings.createdAt,
      updatedAt: new Date()
    };

    return this.updateUserSettings(userId, mergedSettings);
  }

  clearCache(userId?: string): void {
    if (userId) {
      this.settingsCache.delete(`user:${userId}`);
    } else {
      this.settingsCache.clear();
    }
  }
}

export const settingsService = SettingsService.getInstance(); 