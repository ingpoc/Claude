'use client';

import { useState, useEffect } from 'react';

type FeatureName = 'naturalLanguageQuery' | 'smartEntityExtraction' | 'intelligentSuggestions' | 'conversationAnalysis';

interface FeatureSettings {
  features: Record<FeatureName, boolean>;
}

export function useSettings() {
  const [features, setFeatures] = useState<Record<FeatureName, boolean>>({
    naturalLanguageQuery: false,
    smartEntityExtraction: false,
    intelligentSuggestions: false,
    conversationAnalysis: false,
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
