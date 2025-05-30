import { useState, useEffect, useCallback, useRef } from 'react';
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
  const settingsRef = useRef<UserSettings | null>(null);

  // Effect to keep settingsRef in sync with settings state after re-renders
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  // localStorage backup utilities
  const STORAGE_KEY = `settings_${userId}`;
  
  const saveToLocalStorage = useCallback((settingsData: UserSettings) => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settingsData));
      } catch (err) {
        console.warn('Failed to save to localStorage:', err);
      }
    }
  }, [STORAGE_KEY]);

  const loadFromLocalStorage = useCallback((): UserSettings | null => {
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
  }, [STORAGE_KEY]);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Load from localStorage first for instant display
      const cachedSettings = loadFromLocalStorage();
      if (cachedSettings) {
        // Ensure providerConfigs exists
        if (!cachedSettings.aiConfiguration.providerConfigs) {
          cachedSettings.aiConfiguration.providerConfigs = {};
        }
        setSettings(cachedSettings);
      }

      // Then load from API
      const response = await fetch(`/api/settings?userId=${encodeURIComponent(userId)}`);
      
      if (!response.ok) {
        throw new Error(`Failed to load settings: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success && data.data) {
        // Ensure providerConfigs exists in API response
        if (!data.data.aiConfiguration.providerConfigs) {
          data.data.aiConfiguration.providerConfigs = {};
        }
        setSettings(data.data);
        saveToLocalStorage(data.data);
      } else {
        // If no settings found, create default settings
        const fallbackSettings: UserSettings = {
        id: `settings-${userId}`,
        userId,
        aiConfiguration: {
          provider: 'openrouter',
          enabled: false,
          config: { // Active config
            apiKey: '',
            model: 'openai/gpt-3.5-turbo',
            baseUrl: 'https://openrouter.ai/api/v1',
            maxTokens: 2000
          },
          providerConfigs: {} // Initialize providerConfigs
        },
        aiFeatures: {
          naturalLanguageQuery: true,
          smartEntityExtraction: true,
          intelligentSuggestions: true,
          conversationAnalysis: true,
          conflictResolution: true,
          knowledgeGapDetection: true,
          contextPrediction: true
        },
        privacy: {
          allowDataCollection: false,
          shareAnonymousUsage: false,
          localProcessingOnly: true
        },
        performance: {
          cacheEnabled: true,
          maxCacheSize: 100,
          autoOptimize: true
        },
        ui: {
          theme: 'dark',
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
  }, [userId, loadFromLocalStorage, saveToLocalStorage]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const updateAIConfiguration = async (newAiConfig: AIConfiguration) => {
    const currentSettings = settingsRef.current; // Get latest known settings via ref
    if (!currentSettings) return;

    // Ensure providerConfigs exists on currentSettings and newAiConfig
    const providerConfigs = { 
      ...(currentSettings.aiConfiguration.providerConfigs || {}),
      [newAiConfig.provider]: { ...(newAiConfig.config || {}) } 
    };

    const updatedAiConfig: AIConfiguration = {
      ...newAiConfig,
      providerConfigs: providerConfigs,
      // Ensure the active 'config' matches the one for the current provider from providerConfigs
      config: providerConfigs[newAiConfig.provider] || newAiConfig.config || {} 
    };
    
    const optimisticSettings: UserSettings = {
      ...currentSettings,
      aiConfiguration: updatedAiConfig,
      updatedAt: new Date()
    };
    settingsRef.current = optimisticSettings; // Update ref immediately
    setSettings(optimisticSettings);          // Update state for re-render & to trigger useEffect
    saveToLocalStorage(optimisticSettings);

    try {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          aiConfiguration: updatedAiConfig // Send the fully updated aiConfiguration
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to update AI configuration: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success && data.data) {
        // Ensure providerConfigs exists in the response from the server
        if (data.data.aiConfiguration && !data.data.aiConfiguration.providerConfigs) {
          data.data.aiConfiguration.providerConfigs = {};
        }
        // Also, ensure the active config is correctly set from providerConfigs if available
        if (data.data.aiConfiguration && data.data.aiConfiguration.providerConfigs && data.data.aiConfiguration.provider) {
          const activeProvider = data.data.aiConfiguration.provider;
          data.data.aiConfiguration.config = data.data.aiConfiguration.providerConfigs[activeProvider] || data.data.aiConfiguration.config || {};
        }
        
        settingsRef.current = data.data; // Update ref with server response
        setSettings(data.data);
        saveToLocalStorage(data.data);
      } else {
        throw new Error(data.error || 'Failed to update AI configuration after successful call (unexpected response)');
      }
    } catch (err: any) {
      console.error('Failed to save AI configuration to backend:', err.message);
      setError(`Failed to save AI config to server: ${err.message}. Local changes applied.`);
    }
  };

  const updateAIFeatures = async (newFeatures: AIFeatures) => {
    const currentSettings = settingsRef.current; // Get latest known settings via ref
    if (!currentSettings) return;

    const optimisticSettings: UserSettings = {
        ...currentSettings,
        aiFeatures: newFeatures,
        updatedAt: new Date()
    };
    settingsRef.current = optimisticSettings; // Update ref immediately
    setSettings(optimisticSettings);          // Update state for re-render & to trigger useEffect
    // We save to localStorage optimistically here for consistency, though original only did on API success for this func.
    saveToLocalStorage(optimisticSettings);

    try {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          aiFeatures: newFeatures
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to update AI features: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success && data.data) { // Assuming data.data is full UserSettings
        settingsRef.current = data.data; // Update ref with server response
        setSettings(data.data);
        saveToLocalStorage(data.data); 
      } else {
        throw new Error(data.error || 'Failed to update AI features after successful call (unexpected response)');
      }
    } catch (err:any) {
      console.error('Failed to update AI features to backend:', err.message);
      setError(`Failed to save AI features to server: ${err.message}. Local changes applied.`);
    }
  };

  const toggleAIFeature = async (feature: keyof AIFeatures, enabled: boolean) => {
    const currentSettings = settingsRef.current; // Use ref to get current features
    if (!currentSettings) return;
    
    const updatedFeatures = {
      ...currentSettings.aiFeatures,
      [feature]: enabled
    };
    
    await updateAIFeatures(updatedFeatures);
  };

  const testConnection = async (): Promise<{ success: boolean; message: string }> => {
    const currentSettings = settingsRef.current;
    if (!currentSettings) {
      return { success: false, message: 'Settings not loaded' };
    }

    const baseAIConfig = currentSettings.aiConfiguration;
    const aiFeatures = currentSettings.aiFeatures || {};

    if (!baseAIConfig || !baseAIConfig.enabled) {
      // If AI is not configured or not enabled, still allow testing but indicate it's off.
      // The backend will also likely confirm this or handle it.
      // Alternatively, could return { success: true, message: 'AI is disabled' } directly.
      console.log('Testing connection for disabled/unconfigured AI');
    }

    const activeProvider = baseAIConfig?.provider;
    let providerSpecificConfig = baseAIConfig?.config || {}; // Default to current top-level config

    if (baseAIConfig?.providerConfigs && activeProvider && baseAIConfig.providerConfigs[activeProvider]) {
      providerSpecificConfig = baseAIConfig.providerConfigs[activeProvider];
    }

    const payload = {
      userId,
      aiConfiguration: {
        ...(baseAIConfig || {}), // Spread baseAIConfig or an empty object if it's null
        enabled: baseAIConfig?.enabled || false,
        provider: activeProvider || 'none',
        config: providerSpecificConfig || {},
        providerConfigs: baseAIConfig?.providerConfigs || {}
      },
      aiFeatures,
    };
    
    console.log('Testing connection with payload:', JSON.stringify(payload, null, 2));

    try {
      const response = await fetch('/api/settings/test-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
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
    const currentSettingsToSave = settingsRef.current; // Use the ref
    if (!currentSettingsToSave) return;
    
    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          settings: currentSettingsToSave // Use from ref
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to save settings: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success) {
        settingsRef.current = data.data; // Update ref with server response
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
    // Reading from state is fine here as it's usually for UI display after render
    return !!(settings?.aiConfiguration.enabled && settings.aiFeatures[feature]);
  };

  const isAIEnabled = (): boolean => {
    // Reading from state is fine here
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