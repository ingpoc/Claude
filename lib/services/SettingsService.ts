import { UserSettings, DEFAULT_SETTINGS, AIConfiguration, AIFeatures } from '../models/Settings';
import { logger } from './Logger';
import { qdrantDataService } from './QdrantDataService';
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
      // Clear cache to ensure fresh database query
      this.clearCache(userId);
      
      // Initialize Qdrant and get settings
      await qdrantDataService.initialize();
      const qdrantSettings = await qdrantDataService.getUserSettings(userId);
      
      if (qdrantSettings) {
        const settings: UserSettings = {
          id: qdrantSettings.id,
          userId: qdrantSettings.userId,
          aiConfiguration: qdrantSettings.aiConfiguration || DEFAULT_SETTINGS.aiConfiguration,
          aiFeatures: qdrantSettings.aiFeatures || DEFAULT_SETTINGS.aiFeatures,
          privacy: qdrantSettings.privacy || DEFAULT_SETTINGS.privacy,
          performance: qdrantSettings.performance || DEFAULT_SETTINGS.performance,
          ui: qdrantSettings.ui || DEFAULT_SETTINGS.ui,
          createdAt: qdrantSettings.createdAt,
          updatedAt: qdrantSettings.updatedAt
        };

        // Cache the settings
        const cacheKey = `user:${userId}`;
        this.settingsCache.set(cacheKey, settings);
        logger.info(`Loaded settings from Qdrant for user ${userId}`);
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

      // Save to Qdrant
      await qdrantDataService.saveUserSettings({
        id: defaultSettings.id,
        userId: defaultSettings.userId,
        aiConfiguration: defaultSettings.aiConfiguration,
        aiFeatures: defaultSettings.aiFeatures,
        privacy: defaultSettings.privacy,
        performance: defaultSettings.performance,
        ui: defaultSettings.ui,
        createdAt: defaultSettings.createdAt,
        updatedAt: defaultSettings.updatedAt
      });

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

      // Save to Qdrant
      await qdrantDataService.initialize();
      await qdrantDataService.saveUserSettings({
        id: updatedSettings.id,
        userId: updatedSettings.userId,
        aiConfiguration: updatedSettings.aiConfiguration,
        aiFeatures: updatedSettings.aiFeatures,
        privacy: updatedSettings.privacy,
        performance: updatedSettings.performance,
        ui: updatedSettings.ui,
        createdAt: updatedSettings.createdAt,
        updatedAt: updatedSettings.updatedAt
      });

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

    return this.updateAIFeatures(userId, updatedFeatures);
  }

  async validateAIConfiguration(config: AIConfiguration): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Validate provider
    if (!config.provider || typeof config.provider !== 'string') {
      errors.push('Provider is required and must be a string');
    }

    // Validate config object
    if (!config.config || typeof config.config !== 'object') {
      errors.push('Config object is required');
    } else {
      // Validate API key
      if (!config.config.apiKey || typeof config.config.apiKey !== 'string') {
        errors.push('API key is required and must be a string');
      }

      // Validate model
      if (!config.config.model || typeof config.config.model !== 'string') {
        errors.push('Model is required and must be a string');
      }

      // Validate maxTokens
      if (config.config.maxTokens && (typeof config.config.maxTokens !== 'number' || config.config.maxTokens <= 0)) {
        errors.push('Max tokens must be a positive number');
      }

      // Validate baseUrl if provided
      if (config.config.baseUrl && typeof config.config.baseUrl !== 'string') {
        errors.push('Base URL must be a string');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  async testAIConnection(userId: string): Promise<{ success: boolean; message: string; provider?: string }> {
    try {
      const settings = await this.getUserSettings(userId);
      const { aiConfiguration } = settings;

      if (!aiConfiguration.enabled) {
        return {
          success: false,
          message: 'AI features are disabled'
        };
      }

      const validation = await this.validateAIConfiguration(aiConfiguration);
      if (!validation.isValid) {
        return {
          success: false,
          message: `Configuration invalid: ${validation.errors.join(', ')}`
        };
      }

      // For now, just return success if configuration is valid
      // In a real implementation, you would test the actual API connection
      return {
        success: true,
        message: 'Configuration appears valid',
        provider: aiConfiguration.provider
      };

    } catch (error) {
      logger.error(`Failed to test AI connection for user ${userId}:`, error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
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

      // Save to Qdrant
      await qdrantDataService.initialize();
      await qdrantDataService.saveUserSettings({
        id: defaultSettings.id,
        userId: defaultSettings.userId,
        aiConfiguration: defaultSettings.aiConfiguration,
        aiFeatures: defaultSettings.aiFeatures,
        privacy: defaultSettings.privacy,
        performance: defaultSettings.performance,
        ui: defaultSettings.ui,
        createdAt: defaultSettings.createdAt,
        updatedAt: defaultSettings.updatedAt
      });

      // Clear cache
      this.clearCache(userId);

      logger.info(`Reset settings for user ${userId}`);
      return defaultSettings;

    } catch (error) {
      logger.error(`Failed to reset settings for user ${userId}:`, error);
      throw error;
    }
  }

  async exportSettings(userId: string): Promise<Record<string, any>> {
    try {
      const settings = await this.getUserSettings(userId);
      
      // Remove sensitive data from export
      const exportData = {
        ...settings,
        aiConfiguration: {
          ...settings.aiConfiguration,
          config: {
            ...settings.aiConfiguration.config,
            apiKey: '[REDACTED]' // Don't export API keys
          }
        }
      };

      return exportData;
    } catch (error) {
      logger.error(`Failed to export settings for user ${userId}:`, error);
      throw error;
    }
  }

  async importSettings(userId: string, importData: Partial<UserSettings>): Promise<UserSettings> {
    try {
      // Validate import data
      if (!importData || typeof importData !== 'object') {
        throw new Error('Invalid import data');
      }

      // Don't import sensitive data or IDs
      const safeImportData = { ...importData };
      delete safeImportData.id;
      delete safeImportData.userId;
      if (safeImportData.aiConfiguration?.config?.apiKey === '[REDACTED]') {
        delete safeImportData.aiConfiguration.config.apiKey;
      }

      return this.updateUserSettings(userId, safeImportData);
    } catch (error) {
      logger.error(`Failed to import settings for user ${userId}:`, error);
      throw error;
    }
  }

  clearCache(userId?: string): void {
    if (userId) {
      const cacheKey = `user:${userId}`;
      this.settingsCache.delete(cacheKey);
    } else {
      this.settingsCache.clear();
    }
  }
}

export const settingsService = SettingsService.getInstance(); 