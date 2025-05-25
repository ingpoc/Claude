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

  // localStorage backup utilities
  const STORAGE_KEY = `settings_${userId}`;
  
  const saveToLocalStorage = (settingsData: UserSettings) => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settingsData));
      } catch (err) {
        console.warn('Failed to save to localStorage:', err);
      }
    }
  };

  const loadFromLocalStorage = (): UserSettings | null => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          // Convert date strings back to Date objects
          return {
            ...parsed,
            createdAt: new Date(parsed.createdAt),
            updatedAt: new Date(parsed.updatedAt)
          };
        }
      } catch (err) {
        console.warn('Failed to load from localStorage:', err);
      }
    }
    return null;
  };

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Try localStorage first for immediate loading
      const cachedSettings = loadFromLocalStorage();
      if (cachedSettings) {
        setSettings(cachedSettings);
        setLoading(false); // Show cached data immediately
      }
      
      // Then call the actual backend API to get latest data
      const response = await fetch(`/api/settings?userId=${userId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to load settings: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success) {
        setSettings(data.data);
        saveToLocalStorage(data.data); // Update localStorage cache
      } else {
        throw new Error(data.error || 'Failed to load settings');
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
      
      // If we have cached settings, use them and don't show error
      const cachedSettings = loadFromLocalStorage();
      if (cachedSettings) {
        setSettings(cachedSettings);
        console.log('Using cached settings due to API error');
      } else {
        setError('Failed to load settings');
        
        // Fallback to default settings
        const fallbackSettings: UserSettings = {
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
        setSettings(fallbackSettings);
      }
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const updateAIConfiguration = async (config: AIConfiguration) => {
    if (!settings) return;
    
    try {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          aiConfiguration: config
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to update AI configuration: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success) {
        setSettings(data.data);
        saveToLocalStorage(data.data);
      } else {
        throw new Error(data.error || 'Failed to update AI configuration');
      }
    } catch (err) {
      console.error('Failed to update AI configuration:', err);
      
      // Optimistic update even if save fails
      const updatedSettings = {
        ...settings,
        aiConfiguration: config,
        updatedAt: new Date()
      };
      setSettings(updatedSettings);
    }
  };

  const updateAIFeatures = async (features: AIFeatures) => {
    if (!settings) return;
    
    try {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          aiFeatures: features
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to update AI features: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success) {
        setSettings(data.data);
      } else {
        throw new Error(data.error || 'Failed to update AI features');
      }
    } catch (err) {
      console.error('Failed to update AI features:', err);
      
      // Optimistic update even if save fails
      const updatedSettings = {
        ...settings,
        aiFeatures: features,
        updatedAt: new Date()
      };
      setSettings(updatedSettings);
    }
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
      // Call the actual backend API endpoint
      const response = await fetch('/api/settings/test-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          aiConfiguration: settings.aiConfiguration,
          aiFeatures: settings.aiFeatures
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      return {
        success: result.success,
        message: result.message || 'Connection test completed'
      };
    } catch (err) {
      console.error('Connection test failed:', err);
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Connection test failed'
      };
    }
  };

  const saveSettings = async () => {
    if (!settings) return;
    
    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          settings
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to save settings: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success) {
        setSettings(data.data);
        console.log('Settings saved successfully');
      } else {
        throw new Error(data.error || 'Failed to save settings');
      }
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