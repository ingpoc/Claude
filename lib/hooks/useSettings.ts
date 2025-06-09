'use client';

import { useState, useEffect } from 'react';

type FeatureName = 'naturalLanguageQuery' | 'smartEntityExtraction' | 'intelligentSuggestions' | 'conversationAnalysis';

interface FeatureSettings {
  features: Record<FeatureName, boolean>;
}

export function useSettings() {
  const [features, setFeatures] = useState<Record<FeatureName, boolean>>({
    naturalLanguageQuery: true,  // Enable by default for local use
    smartEntityExtraction: true,
    intelligentSuggestions: true,
    conversationAnalysis: true,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('mcp-knowledge-graph-settings');
      if (saved) {
        const parsed = JSON.parse(saved) as { features?: Record<FeatureName, boolean> };
        if (parsed.features) {
          setFeatures(parsed.features);
        }
      } else {
        // Set default enabled features and save to localStorage
        const defaultFeatures = {
          naturalLanguageQuery: true,
          smartEntityExtraction: true,
          intelligentSuggestions: true,
          conversationAnalysis: true,
        };
        localStorage.setItem('mcp-knowledge-graph-settings', JSON.stringify({ features: defaultFeatures }));
        setFeatures(defaultFeatures);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const isAIFeatureEnabled = (feature: FeatureName): boolean => {
    return !!features[feature];
  };

  return { isAIFeatureEnabled, loading };
}
