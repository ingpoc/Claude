import { useState, useEffect, useCallback } from 'react';
import { UserSettings, AIFeatures, AIConfiguration } from '../models/Settings';

export interface UseSettingsReturn {
  settings: UserSettings | null;
  loading: boolean;
  error: string | null;
  updateAIConfiguration: (config: AIConfiguration) => Promise<void>;
  updateAIFeatures: (features: AIFeatures) => Promise<void>;
  toggleAIFeature: (feature: keyof AIFeatures, enabled: boolean) => Promise<void>;
  testConnection: () => Promise<{ success: boolean; message: string }>;
  saveSettings: () => Promise<void>;
  resetSettings: () => Promise<void>;
  isAIFeatureEnabled: (feature: keyof AIFeatures) => boolean;
  isAIEnabled: () => boolean;
}

export function useSettings(userId: string = 'default-user'): UseSettingsReturn {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // TODO: Replace with actual API call
      // For now, return mock settings with AI disabled by default
      const mockSettings: UserSettings = {
        id: 'user-1',
        userId,
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
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      setSettings(mockSettings);
    } catch (err) {
      console.error('Failed to load settings:', err);
      setError('Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const updateAIConfiguration = async (config: AIConfiguration) => {
    if (!settings) return;
    
    const updatedSettings = {
      ...settings,
      aiConfiguration: config,
      updatedAt: new Date()
    };
    
    setSettings(updatedSettings);
    // TODO: Save to backend
  };

  const updateAIFeatures = async (features: AIFeatures) => {
    if (!settings) return;
    
    const updatedSettings = {
      ...settings,
      aiFeatures: features,
      updatedAt: new Date()
    };
    
    setSettings(updatedSettings);
    // TODO: Save to backend
  };

  const toggleAIFeature = async (feature: keyof AIFeatures, enabled: boolean) => {
    if (!settings) return;
    
    const updatedFeatures = {
      ...settings.aiFeatures,
      [feature]: enabled
    };
    
    await updateAIFeatures(updatedFeatures);
  };

  const testConnection = async (): Promise<{ success: boolean; message: string }> => {
    if (!settings?.aiConfiguration.enabled) {
      return { success: true, message: 'AI is disabled' };
    }

    try {
      // TODO: Implement actual connection test
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return {
        success: true,
        message: `Successfully connected to ${settings.aiConfiguration.provider}`
      };
    } catch (err) {
      return {
        success: false,
        message: 'Connection failed. Please check your configuration.'
      };
    }
  };

  const saveSettings = async () => {
    if (!settings) return;
    
    try {
      // TODO: Implement actual API call
      console.log('Saving settings:', settings);
    } catch (err) {
      console.error('Failed to save settings:', err);
      throw err;
    }
  };

  const resetSettings = async () => {
    try {
      // TODO: Implement actual reset API call
      await loadSettings(); // Reload default settings
    } catch (err) {
      console.error('Failed to reset settings:', err);
      throw err;
    }
  };

  const isAIFeatureEnabled = (feature: keyof AIFeatures): boolean => {
    return !!(settings?.aiConfiguration.enabled && settings.aiFeatures[feature]);
  };

  const isAIEnabled = (): boolean => {
    return !!(settings?.aiConfiguration.enabled);
  };

  return {
    settings,
    loading,
    error,
    updateAIConfiguration,
    updateAIFeatures,
    toggleAIFeature,
    testConnection,
    saveSettings,
    resetSettings,
    isAIFeatureEnabled,
    isAIEnabled
  };
} 