import { UserSettings, DEFAULT_SETTINGS, AIConfiguration, AIFeatures } from '../models/Settings';
import { logger } from './Logger';
import { v4 as uuidv4 } from 'uuid';

export class SettingsService {
  private settingsCache = new Map<string, UserSettings>();
  private static instance: SettingsService;

  static getInstance(): SettingsService {
    if (!SettingsService.instance) {
      SettingsService.instance = new SettingsService();
    }
    return SettingsService.instance;
  }

  async getUserSettings(userId: string): Promise<UserSettings> {
    try {
      // Check cache first
      const cacheKey = `user:${userId}`;
      if (this.settingsCache.has(cacheKey)) {
        return this.settingsCache.get(cacheKey)!;
      }

      // For now, return default settings
      // TODO: Implement database storage in future
      const defaultSettings: UserSettings = {
        id: uuidv4(),
        userId,
        ...DEFAULT_SETTINGS,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Cache the settings
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

    return { isValid: errors.length === 0, errors };
  }

  async testAIConnection(userId: string): Promise<{ success: boolean; message: string; provider?: string }> {
    try {
      const settings = await this.getUserSettings(userId);
      
      if (!settings.aiConfiguration.enabled) {
        return { success: true, message: 'AI is disabled' };
      }

      // TODO: Implement actual AI connection testing with AIService
      // For now, return a mock response based on provider
      return {
        success: true,
        message: `Connected to ${settings.aiConfiguration.provider}`,
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