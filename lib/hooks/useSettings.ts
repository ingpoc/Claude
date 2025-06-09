'use client';

import { useState, useEffect } from 'react';

type FeatureName = 'naturalLanguageQuery' | 'smartEntityExtraction' | 'intelligentSuggestions' | 'conversationAnalysis';

interface AIConfiguration {
  provider: string;
  enabled: boolean;
  config: {
    apiKey?: string;
    model?: string;
    maxTokens?: number;
    temperature?: number;
  };
}

interface SavedSettings {
  aiConfiguration?: AIConfiguration;
  features?: Record<FeatureName, boolean>;
}

export function useSettings() {
  const [features, setFeatures] = useState<Record<FeatureName, boolean>>({
    naturalLanguageQuery: true,  // Enable by default for local use
    smartEntityExtraction: true,
    intelligentSuggestions: true,
    conversationAnalysis: true,
  });
  const [aiConfig, setAiConfig] = useState<AIConfiguration>({
    provider: 'openrouter',
    enabled: true,
    config: {
      apiKey: '',
      model: 'meta-llama/llama-3.2-3b-instruct:free',
      maxTokens: 2048,
      temperature: 0.7
    }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('mcp-knowledge-graph-settings');
      if (saved) {
        const parsed = JSON.parse(saved) as SavedSettings;
        if (parsed.features) {
          setFeatures(parsed.features);
        }
        if (parsed.aiConfiguration) {
          setAiConfig(parsed.aiConfiguration);
        }
      } else {
        // Set default enabled features and save to localStorage
        const defaultFeatures = {
          naturalLanguageQuery: true,
          smartEntityExtraction: true,
          intelligentSuggestions: true,
          conversationAnalysis: true,
        };
        const defaultAiConfig = {
          provider: 'openrouter',
          enabled: true,
          config: {
            apiKey: '',
            model: 'meta-llama/llama-3.2-3b-instruct:free',
            maxTokens: 2048,
            temperature: 0.7
          }
        };
        localStorage.setItem('mcp-knowledge-graph-settings', JSON.stringify({ 
          features: defaultFeatures,
          aiConfiguration: defaultAiConfig
        }));
        setFeatures(defaultFeatures);
        setAiConfig(defaultAiConfig);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const isAIFeatureEnabled = (feature: FeatureName): boolean => {
    return !!features[feature] && aiConfig.enabled && !!aiConfig.config.apiKey;
  };

  const getAIConfig = (): AIConfiguration => {
    return aiConfig;
  };

  return { isAIFeatureEnabled, getAIConfig, loading };
}
