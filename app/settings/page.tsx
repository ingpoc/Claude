"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Badge } from '../../components/ui/badge';
import { Separator } from '../../components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { 
  Settings as SettingsIcon, 
  Brain, 
  Shield, 
  Zap, 
  Palette, 
  TestTube,
  CheckCircle2,
  AlertTriangle,
  Eye,
  EyeOff,
  Download,
  Upload,
  RotateCcw,
  Save,
  Loader2
} from 'lucide-react';
import { AI_PROVIDERS, AIProvider, AIConfiguration, AIFeatures, getOpenRouterModels, getOpenRouterFreeModels } from '../../lib/models/Settings';
import { useSettings } from '../../lib/hooks/useSettings';

export default function SettingsPage() {
  const {
    settings,
    loading,
    error,
    updateAIConfiguration,
    updateAIFeatures,
    toggleAIFeature,
    testConnection,
    saveSettings,
    resetSettings
  } = useSettings();

  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  
  // State for dynamic model loading
  const [showFreeOnly, setShowFreeOnly] = useState(true);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);

  const handleTestConnection = async () => {
    try {
      setTesting(true);
      const result = await testConnection();
      setConnectionStatus(result);
    } catch (error) {
      setConnectionStatus({ 
        success: false, 
        message: 'Connection test failed' 
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSaveSettings = async () => {
    try {
      setSaving(true);
      setErrors([]);
      await saveSettings();
    } catch (error) {
      console.error('Failed to save settings:', error);
      setErrors(['Failed to save settings. Please try again.']);
    } finally {
      setSaving(false);
    }
  };

  const updateAIProvider = (providerId: string) => {
    if (!settings) return;
    
    const provider = AI_PROVIDERS.find(p => p.id === providerId);
    if (!provider) return;

    const newConfig: AIConfiguration = {
      provider: providerId,
      enabled: providerId !== 'none',
      config: {}
    };

    // Set default values for the provider
    provider.configFields.forEach(field => {
      if (field.defaultValue !== undefined) {
        newConfig.config[field.key] = field.defaultValue;
      }
    });

    updateAIConfiguration(newConfig);
    setConnectionStatus(null);
  };

  const updateAIConfig = (key: string, value: any) => {
    if (!settings) return;
    
    const newConfig: AIConfiguration = {
      ...settings.aiConfiguration,
      config: {
        ...settings.aiConfiguration.config,
        [key]: value
      }
    };

    updateAIConfiguration(newConfig);
  };

  const handleToggleAIFeature = async (feature: keyof AIFeatures, enabled: boolean) => {
    try {
      await toggleAIFeature(feature, enabled);
    } catch (error) {
      console.error('Failed to toggle AI feature:', error);
    }
  };

  const handleResetSettings = async () => {
    if (!confirm('Are you sure you want to reset all settings to defaults? This cannot be undone.')) {
      return;
    }

    try {
      setSaving(true);
      await resetSettings();
    } catch (error) {
      console.error('Failed to reset settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const currentProvider = AI_PROVIDERS.find(p => p.id === settings?.aiConfiguration.provider);

  // Function to load OpenRouter models dynamically
  const loadOpenRouterModels = useCallback(async (freeOnly: boolean = false) => {
    if (currentProvider?.id !== 'openrouter') return;
    
    try {
      setLoadingModels(true);
      const apiKey = settings?.aiConfiguration.config.apiKey;
      
      let models: string[];
      if (freeOnly) {
        models = await getOpenRouterFreeModels(apiKey);
      } else {
        models = await getOpenRouterModels({ 
          apiKey, 
          freeOnly: false, 
          includeVariants: true, 
          maxResults: 100 
        });
      }
      
      setAvailableModels(models);
      console.log(`Loaded ${models.length} ${freeOnly ? 'free' : 'all'} OpenRouter models`);
    } catch (error) {
      console.error('Failed to load OpenRouter models:', error);
      setErrors(prev => [...prev, 'Failed to load models. Using fallback list.']);
    } finally {
      setLoadingModels(false);
    }
  }, [currentProvider?.id, settings?.aiConfiguration.config.apiKey]);

  // Toggle between free and all models
  const handleToggleFreeOnly = async (freeOnly: boolean) => {
    setShowFreeOnly(freeOnly);
    await loadOpenRouterModels(freeOnly);
  };

  // Load models when OpenRouter is selected
  useEffect(() => {
    if (currentProvider?.id === 'openrouter') {
      loadOpenRouterModels(showFreeOnly);
    }
  }, [currentProvider?.id, settings?.aiConfiguration.config.apiKey, loadOpenRouterModels, showFreeOnly]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-slate-600" />
          <p className="text-slate-600">Loading settings...</p>
        </div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="h-8 w-8 mx-auto mb-4 text-red-500" />
          <p className="text-red-600">Failed to load settings</p>
          <Button onClick={() => window.location.reload()} className="mt-4">Try Again</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <SettingsIcon className="h-6 w-6 text-slate-600" />
            <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
          </div>
          <p className="text-slate-600">Configure your AI features and system preferences</p>
        </div>

        {/* Error Display */}
        {errors.length > 0 && (
          <Alert className="mb-6 border-red-200 bg-red-50">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-700">
              {errors.map((error, index) => (
                <div key={index}>{error}</div>
              ))}
            </AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="ai" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="ai" className="flex items-center gap-2">
              <Brain className="h-4 w-4" />
              AI Settings
            </TabsTrigger>
            <TabsTrigger value="privacy" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Privacy
            </TabsTrigger>
            <TabsTrigger value="performance" className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Performance
            </TabsTrigger>
            <TabsTrigger value="appearance" className="flex items-center gap-2">
              <Palette className="h-4 w-4" />
              Appearance
            </TabsTrigger>
          </TabsList>

          {/* AI Settings Tab */}
          <TabsContent value="ai" className="space-y-6">
            {/* AI Provider Configuration */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5" />
                  AI Provider Configuration
                </CardTitle>
                <p className="text-sm text-slate-600">
                  Choose your AI provider and configure connection settings
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Provider Selection */}
                <div className="space-y-2">
                  <Label htmlFor="ai-provider">AI Provider</Label>
                  <Select value={settings.aiConfiguration.provider} onValueChange={updateAIProvider}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select AI Provider" />
                    </SelectTrigger>
                    <SelectContent>
                      {AI_PROVIDERS.map((provider) => (
                        <SelectItem key={provider.id} value={provider.id}>
                          <div className="flex items-center gap-2">
                            <span>{provider.name}</span>
                            {provider.type === 'local' && (
                              <Badge variant="outline" className="text-xs">Local</Badge>
                            )}
                            {provider.requiresApiKey && (
                              <Badge variant="outline" className="text-xs">API Key</Badge>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {currentProvider && (
                    <p className="text-sm text-slate-500">{currentProvider.description}</p>
                  )}
                </div>

                {/* Provider Configuration */}
                {currentProvider && currentProvider.configFields.length > 0 && (
                  <div className="space-y-4 p-4 bg-slate-50 rounded-lg">
                    <h4 className="font-medium text-slate-900">Provider Configuration</h4>
                    {currentProvider.configFields.map((field) => (
                      <div key={field.key} className="space-y-2">
                        <Label htmlFor={field.key}>
                          {field.label}
                          {field.required && <span className="text-red-500 ml-1">*</span>}
                        </Label>
                        
                        {field.type === 'select' ? (
                          <div className="space-y-3">
                            {/* Free/Paid Toggle for OpenRouter Model Selection */}
                            {field.key === 'model' && currentProvider?.id === 'openrouter' && (
                              <div className="flex items-center justify-between p-3 bg-indigo-50 rounded-lg border border-indigo-200">
                                <div className="flex items-center gap-3">
                                  <Label className="text-sm font-medium text-indigo-900">Model Type:</Label>
                                  <div className="flex items-center gap-4">
                                    <button
                                      type="button"
                                      onClick={() => handleToggleFreeOnly(true)}
                                      className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                                        showFreeOnly
                                          ? 'bg-emerald-600 text-white shadow-sm'
                                          : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-50'
                                      }`}
                                    >
                                      🆓 Free Only
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleToggleFreeOnly(false)}
                                      className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                                        !showFreeOnly
                                          ? 'bg-indigo-600 text-white shadow-sm'
                                          : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-50'
                                      }`}
                                    >
                                      💰 All Models
                                    </button>
                                  </div>
                                </div>
                                {loadingModels && (
                                  <div className="flex items-center gap-2 text-indigo-600">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    <span className="text-sm">Loading models...</span>
                                  </div>
                                )}
                              </div>
                            )}
                            
                            <Select 
                              value={settings.aiConfiguration.config[field.key] || field.defaultValue?.toString()} 
                              onValueChange={(value) => updateAIConfig(field.key, value)}
                              disabled={loadingModels && field.key === 'model' && currentProvider?.id === 'openrouter'}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder={field.placeholder} />
                              </SelectTrigger>
                              <SelectContent>
                                {/* Use dynamic models for OpenRouter, fallback to static for others */}
                                {field.key === 'model' && currentProvider?.id === 'openrouter' && availableModels.length > 0 ? (
                                  availableModels.map((model) => (
                                    <SelectItem key={model} value={model}>
                                      <div className="flex items-center gap-2">
                                        {model.includes(':free') ? '🆓' : '💰'} {model}
                                      </div>
                                    </SelectItem>
                                  ))
                                ) : (
                                  field.options?.map((option) => (
                                    <SelectItem key={option} value={option}>
                                      {field.key === 'model' && currentProvider?.id === 'openrouter' ? (
                                        <div className="flex items-center gap-2">
                                          {option.includes(':free') ? '🆓' : '💰'} {option}
                                        </div>
                                      ) : (
                                        option
                                      )}
                                    </SelectItem>
                                  ))
                                )}
                              </SelectContent>
                            </Select>
                            
                            {/* Model Info for OpenRouter */}
                            {field.key === 'model' && currentProvider?.id === 'openrouter' && (
                              <div className="text-xs text-slate-500 space-y-1">
                                <p>
                                  <strong>{availableModels.length > 0 ? availableModels.length : field.options?.length || 0}</strong> models available
                                  {showFreeOnly ? ' (free only)' : ' (free + paid)'}
                                </p>
                                {showFreeOnly && (
                                  <p className="text-emerald-600">💡 Free models are perfect for development and testing</p>
                                )}
                              </div>
                            )}
                          </div>
                        ) : field.type === 'password' ? (
                          <div className="relative">
                            <Input
                              id={field.key}
                              type={showApiKey ? "text" : "password"}
                              value={settings.aiConfiguration.config[field.key] || ''}
                              onChange={(e) => updateAIConfig(field.key, e.target.value)}
                              placeholder={field.placeholder}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="absolute right-0 top-0 h-full px-3"
                              onClick={() => setShowApiKey(!showApiKey)}
                            >
                              {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                          </div>
                        ) : (
                          <Input
                            id={field.key}
                            type={field.type}
                            value={settings.aiConfiguration.config[field.key] || ''}
                            onChange={(e) => updateAIConfig(field.key, field.type === 'number' ? Number(e.target.value) : e.target.value)}
                            placeholder={field.placeholder}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Connection Test */}
                <div className="flex items-center gap-4">
                  <Button 
                    onClick={handleTestConnection} 
                    disabled={testing}
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    {testing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <TestTube className="h-4 w-4" />
                    )}
                    Test Connection
                  </Button>
                  
                  {connectionStatus && (
                    <div className={`flex items-center gap-2 ${connectionStatus.success ? 'text-green-600' : 'text-red-600'}`}>
                      {connectionStatus.success ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <AlertTriangle className="h-4 w-4" />
                      )}
                      <span className="text-sm">{connectionStatus.message}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* AI Features */}
            <Card>
              <CardHeader>
                <CardTitle>AI Features</CardTitle>
                <p className="text-sm text-slate-600">
                  Control which AI-powered features are enabled
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(settings.aiFeatures).map(([feature, enabled]) => (
                  <div key={feature} className="flex items-center justify-between py-2">
                    <div>
                      <Label className="font-medium">
                        {feature.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                      </Label>
                      <p className="text-sm text-slate-500 mt-1">
                        {getFeatureDescription(feature as keyof AIFeatures)}
                      </p>
                    </div>
                    <Switch
                      checked={enabled}
                      onCheckedChange={(checked) => handleToggleAIFeature(feature as keyof AIFeatures, checked)}
                      disabled={!settings.aiConfiguration.enabled}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Privacy Tab */}
          <TabsContent value="privacy" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Privacy Settings</CardTitle>
                <p className="text-sm text-slate-600">
                  Control data collection and privacy preferences
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between py-2">
                  <div>
                    <Label className="font-medium">Allow Data Collection</Label>
                    <p className="text-sm text-slate-500 mt-1">Help improve the service by sharing usage data</p>
                  </div>
                  <Switch
                    checked={settings.privacy.allowDataCollection}
                    onCheckedChange={(checked) => {
                      // TODO: Update privacy settings via hook
                      console.log('Privacy setting change:', { allowDataCollection: checked });
                    }}
                  />
                </div>
                
                <div className="flex items-center justify-between py-2">
                  <div>
                    <Label className="font-medium">Share Anonymous Usage</Label>
                    <p className="text-sm text-slate-500 mt-1">Share anonymous usage statistics</p>
                  </div>
                  <Switch
                    checked={settings.privacy.shareAnonymousUsage}
                    onCheckedChange={(checked) => {
                      // TODO: Update privacy settings via hook
                      console.log('Privacy setting change:', { shareAnonymousUsage: checked });
                    }}
                  />
                </div>
                
                <div className="flex items-center justify-between py-2">
                  <div>
                    <Label className="font-medium">Local Processing Only</Label>
                    <p className="text-sm text-slate-500 mt-1">Process data locally when possible</p>
                  </div>
                  <Switch
                    checked={settings.privacy.localProcessingOnly}
                    onCheckedChange={(checked) => {
                      // TODO: Update privacy settings via hook
                      console.log('Privacy setting change:', { localProcessingOnly: checked });
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Performance Tab */}
          <TabsContent value="performance" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Performance Settings</CardTitle>
                <p className="text-sm text-slate-600">
                  Configure performance and caching options
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between py-2">
                  <div>
                    <Label className="font-medium">Enable Caching</Label>
                    <p className="text-sm text-slate-500 mt-1">Cache data for faster access</p>
                  </div>
                  <Switch
                    checked={settings.performance.cacheEnabled}
                    onCheckedChange={(checked) => {
                      // TODO: Update performance settings via hook
                      console.log('Performance setting change:', { cacheEnabled: checked });
                    }}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="cache-size">Max Cache Size</Label>
                  <Input
                    id="cache-size"
                    type="number"
                    value={settings.performance.maxCacheSize}
                    onChange={(e) => {
                      // TODO: Update performance settings via hook
                      console.log('Performance setting change:', { maxCacheSize: Number(e.target.value) });
                    }}
                    placeholder="1000"
                  />
                </div>
                
                <div className="flex items-center justify-between py-2">
                  <div>
                    <Label className="font-medium">Auto Optimize</Label>
                    <p className="text-sm text-slate-500 mt-1">Automatically optimize performance</p>
                  </div>
                  <Switch
                    checked={settings.performance.autoOptimize}
                    onCheckedChange={(checked) => {
                      // TODO: Update performance settings via hook
                      console.log('Performance setting change:', { autoOptimize: checked });
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Appearance Tab */}
          <TabsContent value="appearance" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Appearance Settings</CardTitle>
                <p className="text-sm text-slate-600">
                  Customize the look and feel
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="theme">Theme</Label>
                  <Select 
                    value={settings.ui.theme} 
                    onValueChange={(value: 'light' | 'dark' | 'auto') => {
                      // TODO: Update UI settings via hook
                      console.log('UI setting change:', { theme: value });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto</SelectItem>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="dark">Dark</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex items-center justify-between py-2">
                  <div>
                    <Label className="font-medium">Compact Mode</Label>
                    <p className="text-sm text-slate-500 mt-1">Use a more compact layout</p>
                  </div>
                  <Switch
                    checked={settings.ui.compactMode}
                    onCheckedChange={(checked) => {
                      // TODO: Update UI settings via hook
                      console.log('UI setting change:', { compactMode: checked });
                    }}
                  />
                </div>
                
                <div className="flex items-center justify-between py-2">
                  <div>
                    <Label className="font-medium">Enable Animations</Label>
                    <p className="text-sm text-slate-500 mt-1">Show smooth animations and transitions</p>
                  </div>
                  <Switch
                    checked={settings.ui.animationsEnabled}
                    onCheckedChange={(checked) => {
                      // TODO: Update UI settings via hook
                      console.log('UI setting change:', { animationsEnabled: checked });
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Actions */}
        <div className="flex items-center justify-between pt-6 border-t border-slate-200">
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={handleResetSettings} disabled={saving}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset to Defaults
            </Button>
          </div>
          
          <div className="flex items-center gap-3">
            <Button variant="outline" disabled={saving}>
              <Download className="h-4 w-4 mr-2" />
              Export Settings
            </Button>
            <Button variant="outline" disabled={saving}>
              <Upload className="h-4 w-4 mr-2" />
              Import Settings
            </Button>
            <Button onClick={handleSaveSettings} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Settings
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function getFeatureDescription(feature: keyof AIFeatures): string {
  const descriptions: Record<keyof AIFeatures, string> = {
    naturalLanguageQuery: 'Ask questions about your knowledge graph in natural language',
    smartEntityExtraction: 'Automatically extract entities from conversations and text',
    intelligentSuggestions: 'Get AI-powered suggestions for improving your knowledge graph',
    conversationAnalysis: 'Analyze conversations for insights and patterns',
    conflictResolution: 'Automatically resolve conflicts in knowledge data',
    knowledgeGapDetection: 'Identify missing information in your knowledge graph',
    contextPrediction: 'Predict relevant context for better recommendations'
  };
  return descriptions[feature] || 'AI-powered feature';
} 