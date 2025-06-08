"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Badge } from '../../components/ui/badge';
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
  Save,
  Loader2,
  RotateCcw,
  ExternalLink
} from 'lucide-react';

interface Settings {
  aiConfiguration: {
    provider: string;
    enabled: boolean;
    config: {
      apiKey?: string;
      model?: string;
      maxTokens?: number;
      temperature?: number;
    };
  };
  features: {
    naturalLanguageQuery: boolean;
    smartEntityExtraction: boolean;
    intelligentSuggestions: boolean;
    conversationAnalysis: boolean;
  };
  performance: {
    cacheEnabled: boolean;
    maxCacheSize: number;
    autoOptimize: boolean;
  };
  ui: {
    theme: 'light' | 'dark' | 'auto';
    compactMode: boolean;
    animationsEnabled: boolean;
  };
}

// OpenRouter free models (updated list)
const OPENROUTER_FREE_MODELS = [
  'meta-llama/llama-3.2-3b-instruct:free',
  'meta-llama/llama-3.2-1b-instruct:free',
  'mistralai/mistral-7b-instruct:free',
  'huggingfaceh4/zephyr-7b-beta:free',
  'openchat/openchat-7b:free',
  'gryphe/mythomist-7b:free',
  'undi95/toppy-m-7b:free',
  'nousresearch/nous-capybara-7b:free',
  'microsoft/DialoGPT-medium',
  'microsoft/DialoGPT-large'
];

// OpenRouter paid models (popular ones)
const OPENROUTER_PAID_MODELS = [
  'openai/gpt-4',
  'openai/gpt-4-turbo',
  'openai/gpt-3.5-turbo',
  'anthropic/claude-3.5-sonnet',
  'anthropic/claude-3-haiku',
  'anthropic/claude-3-opus',
  'meta-llama/llama-3-8b-instruct',
  'meta-llama/llama-3-70b-instruct',
  'google/gemini-pro',
  'cohere/command-r-plus'
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    aiConfiguration: {
      provider: 'openrouter',
      enabled: true,
      config: {
        apiKey: '',
        model: 'meta-llama/llama-3.2-3b-instruct:free',
        maxTokens: 2048,
        temperature: 0.7
      }
    },
    features: {
      naturalLanguageQuery: true,
      smartEntityExtraction: true,
      intelligentSuggestions: true,
      conversationAnalysis: false
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
    }
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [pythonServiceRunning, setPythonServiceRunning] = useState(false);
  const [showFreeOnly, setShowFreeOnly] = useState(true);

  // Load settings from localStorage on mount
  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem('mcp-knowledge-graph-settings');
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        // Ensure OpenRouter is the default provider
        if (parsed.aiConfiguration) {
          parsed.aiConfiguration.provider = 'openrouter';
        }
        setSettings(parsed);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
    
    checkPythonService();
  }, []);

  const checkPythonService = async () => {
    try {
      const response = await fetch('http://localhost:8000/health');
      setPythonServiceRunning(response.ok);
    } catch (error) {
      setPythonServiceRunning(false);
    }
  };

  const saveSettings = async () => {
    try {
      setSaving(true);
      localStorage.setItem('mcp-knowledge-graph-settings', JSON.stringify(settings));
      
      // Simulate save delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      console.log('Settings saved successfully');
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert('Failed to save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    if (!settings.aiConfiguration.config.apiKey) {
      setConnectionStatus({ success: false, message: 'OpenRouter API key required' });
      return;
    }

    try {
      setTesting(true);
      
      // Test OpenRouter API connection
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${settings.aiConfiguration.config.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': window.location.origin,
          'X-Title': 'MCP Knowledge Graph'
        },
        body: JSON.stringify({
          model: settings.aiConfiguration.config.model,
          messages: [{ role: 'user', content: 'test' }],
          max_tokens: 1
        })
      });

      if (response.ok) {
        setConnectionStatus({
          success: true,
          message: 'OpenRouter connection successful!'
        });
      } else if (response.status === 401) {
        setConnectionStatus({
          success: false,
          message: 'Invalid API key. Please check your OpenRouter API key.'
        });
      } else if (response.status === 429) {
        setConnectionStatus({
          success: false,
          message: 'Rate limit exceeded. Please try again later.'
        });
      } else {
        setConnectionStatus({
          success: false,
          message: `Connection failed (${response.status}). Please check your configuration.`
        });
      }
      
    } catch (error) {
      setConnectionStatus({ 
        success: false, 
        message: 'Network error. Please check your internet connection.' 
      });
    } finally {
      setTesting(false);
    }
  };

  const resetSettings = () => {
    if (!confirm('Are you sure you want to reset all settings to defaults? This cannot be undone.')) {
      return;
    }

    setSettings({
      aiConfiguration: {
        provider: 'openrouter',
        enabled: true,
        config: {
          apiKey: '',
          model: 'meta-llama/llama-3.2-3b-instruct:free',
          maxTokens: 2048,
          temperature: 0.7
        }
      },
      features: {
        naturalLanguageQuery: true,
        smartEntityExtraction: true,
        intelligentSuggestions: true,
        conversationAnalysis: false
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
      }
    });

    setConnectionStatus(null);
  };

  const updateAIConfig = (key: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      aiConfiguration: {
        ...prev.aiConfiguration,
        config: {
          ...prev.aiConfiguration.config,
          [key]: value
        }
      }
    }));
  };

  const toggleFeature = (feature: keyof typeof settings.features, enabled: boolean) => {
    setSettings(prev => ({
      ...prev,
      features: {
        ...prev.features,
        [feature]: enabled
      }
    }));
  };

  const availableModels = showFreeOnly ? OPENROUTER_FREE_MODELS : [...OPENROUTER_FREE_MODELS, ...OPENROUTER_PAID_MODELS];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/30 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-slate-600" />
          <p className="text-slate-600">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/30">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-200/20">
              <SettingsIcon className="h-6 w-6 text-blue-600" />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 via-blue-800 to-purple-800 bg-clip-text text-transparent">
              Settings
            </h1>
          </div>
          <p className="text-slate-600 text-lg">Configure your AI features and system preferences</p>
        </div>

        {/* Python Service Status Alert */}
        {!pythonServiceRunning && (
          <Alert className="mb-6 border-red-200 bg-red-50">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-700">
              <div className="flex items-center justify-between">
                <div>
                  <strong>Python Memvid Service Not Running</strong>
                  <p className="mt-1">Some features may not work without the Python service running.</p>
                </div>
                <Button variant="outline" size="sm" onClick={checkPythonService}>
                  Retry
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="ai" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="ai" className="flex items-center gap-2">
              <Brain className="h-4 w-4" />
              OpenRouter AI
            </TabsTrigger>
            <TabsTrigger value="features" className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Features
            </TabsTrigger>
            <TabsTrigger value="performance" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Performance
            </TabsTrigger>
            <TabsTrigger value="appearance" className="flex items-center gap-2">
              <Palette className="h-4 w-4" />
              Appearance
            </TabsTrigger>
          </TabsList>

          {/* OpenRouter AI Settings Tab */}
          <TabsContent value="ai" className="space-y-6">
            <Card className="bg-white/60 backdrop-blur-sm border-white/20 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-blue-600" />
                  OpenRouter Configuration
                  <Badge variant="outline" className="ml-auto text-green-600 border-green-200">
                    Recommended
                  </Badge>
                </CardTitle>
                <p className="text-sm text-slate-600">
                  Configure OpenRouter for access to 300+ AI models with free options
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                
                {/* OpenRouter Benefits */}
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <h4 className="font-medium text-blue-900 mb-2 flex items-center gap-2">
                    <ExternalLink className="h-4 w-4" />
                    Why OpenRouter?
                  </h4>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>• <strong>Free Models:</strong> Access to 10+ free models including Llama, Mistral</li>
                    <li>• <strong>300+ Models:</strong> Choose from OpenAI, Anthropic, Google, Meta, and more</li>
                    <li>• <strong>Cost Effective:</strong> Often cheaper than direct API access</li>
                    <li>• <strong>Rate Limits:</strong> Higher limits compared to free tiers</li>
                    <li>• <strong>No Setup:</strong> Single API key for all models</li>
                  </ul>
                  <div className="mt-3">
                    <Button variant="outline" size="sm" asChild>
                      <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer">
                        Get API Key <ExternalLink className="h-3 w-3 ml-1" />
                      </a>
                    </Button>
                  </div>
                </div>

                {/* API Key */}
                <div className="space-y-2">
                  <Label htmlFor="api-key">
                    OpenRouter API Key <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="api-key"
                      type={showApiKey ? "text" : "password"}
                      value={settings.aiConfiguration.config.apiKey || ''}
                      onChange={(e) => updateAIConfig('apiKey', e.target.value)}
                      placeholder="sk-or-v1-..."
                      className="pr-10"
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
                  <p className="text-xs text-slate-500">
                    Get your free API key from{' '}
                    <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      openrouter.ai/keys
                    </a>
                  </p>
                </div>

                {/* Model Selection */}
                <div className="space-y-3">
                  <Label htmlFor="model">Model Selection</Label>
                  
                  {/* Free/Paid Toggle */}
                  <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                    <div className="flex items-center gap-3">
                      <Label className="text-sm font-medium text-emerald-900">Model Type:</Label>
                      <div className="flex items-center gap-4">
                        <button
                          type="button"
                          onClick={() => setShowFreeOnly(true)}
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
                          onClick={() => setShowFreeOnly(false)}
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
                  </div>
                  
                  <Select 
                    value={settings.aiConfiguration.config.model} 
                    onValueChange={(value) => updateAIConfig('model', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a model" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {showFreeOnly && (
                        <>
                          <div className="px-2 py-1 text-xs font-medium text-emerald-600 bg-emerald-50">
                            🆓 Free Models (No Cost)
                          </div>
                          {OPENROUTER_FREE_MODELS.map((model) => (
                            <SelectItem key={model} value={model}>
                              <div className="flex items-center gap-2">
                                🆓 {model}
                              </div>
                            </SelectItem>
                          ))}
                        </>
                      )}
                      
                      {!showFreeOnly && (
                        <>
                          <div className="px-2 py-1 text-xs font-medium text-emerald-600 bg-emerald-50">
                            🆓 Free Models
                          </div>
                          {OPENROUTER_FREE_MODELS.map((model) => (
                            <SelectItem key={model} value={model}>
                              <div className="flex items-center gap-2">
                                🆓 {model}
                              </div>
                            </SelectItem>
                          ))}
                          <div className="px-2 py-1 text-xs font-medium text-indigo-600 bg-indigo-50 border-t">
                            💰 Premium Models
                          </div>
                          {OPENROUTER_PAID_MODELS.map((model) => (
                            <SelectItem key={model} value={model}>
                              <div className="flex items-center gap-2">
                                💰 {model}
                              </div>
                            </SelectItem>
                          ))}
                        </>
                      )}
                    </SelectContent>
                  </Select>
                  
                  <div className="text-xs text-slate-500 space-y-1">
                    <p>
                      <strong>{availableModels.length}</strong> models available
                      {showFreeOnly ? ' (free only)' : ' (free + paid)'}
                    </p>
                    {showFreeOnly && (
                      <p className="text-emerald-600">💡 Free models are perfect for development and testing</p>
                    )}
                  </div>
                </div>

                {/* Advanced Settings */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="max-tokens">Max Tokens</Label>
                    <Input
                      id="max-tokens"
                      type="number"
                      value={settings.aiConfiguration.config.maxTokens || 2048}
                      onChange={(e) => updateAIConfig('maxTokens', Number(e.target.value))}
                      min="100"
                      max="8192"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="temperature">Temperature</Label>
                    <Input
                      id="temperature"
                      type="number"
                      step="0.1"
                      value={settings.aiConfiguration.config.temperature || 0.7}
                      onChange={(e) => updateAIConfig('temperature', Number(e.target.value))}
                      min="0"
                      max="2"
                    />
                  </div>
                </div>

                {/* Connection Test */}
                <div className="flex items-center gap-4">
                  <Button 
                    onClick={testConnection} 
                    disabled={testing || !settings.aiConfiguration.config.apiKey}
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    {testing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <TestTube className="h-4 w-4" />
                    )}
                    Test OpenRouter Connection
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
          </TabsContent>

          {/* Features Tab */}
          <TabsContent value="features" className="space-y-6">
            <Card className="bg-white/60 backdrop-blur-sm border-white/20 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-emerald-600" />
                  AI Features
                </CardTitle>
                <p className="text-sm text-slate-600">
                  Control which AI-powered features are enabled
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(settings.features).map(([feature, enabled]) => (
                  <div key={feature} className="flex items-center justify-between py-2">
                    <div>
                      <Label className="font-medium">
                        {feature.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                      </Label>
                      <p className="text-sm text-slate-500 mt-1">
                        {getFeatureDescription(feature)}
                      </p>
                    </div>
                    <Switch
                      checked={enabled}
                      onCheckedChange={(checked) => toggleFeature(feature as keyof typeof settings.features, checked)}
                      disabled={!settings.aiConfiguration.enabled || !settings.aiConfiguration.config.apiKey}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Performance Tab */}
          <TabsContent value="performance" className="space-y-6">
            <Card className="bg-white/60 backdrop-blur-sm border-white/20 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-purple-600" />
                  Performance Settings
                </CardTitle>
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
                    onCheckedChange={(checked) => 
                      setSettings(prev => ({
                        ...prev,
                        performance: { ...prev.performance, cacheEnabled: checked }
                      }))
                    }
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="cache-size">Max Cache Size</Label>
                  <Input
                    id="cache-size"
                    type="number"
                    value={settings.performance.maxCacheSize}
                    onChange={(e) => 
                      setSettings(prev => ({
                        ...prev,
                        performance: { ...prev.performance, maxCacheSize: Number(e.target.value) }
                      }))
                    }
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
                    onCheckedChange={(checked) => 
                      setSettings(prev => ({
                        ...prev,
                        performance: { ...prev.performance, autoOptimize: checked }
                      }))
                    }
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Appearance Tab */}
          <TabsContent value="appearance" className="space-y-6">
            <Card className="bg-white/60 backdrop-blur-sm border-white/20 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="h-5 w-5 text-pink-600" />
                  Appearance Settings
                </CardTitle>
                <p className="text-sm text-slate-600">
                  Customize the look and feel
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="theme">Theme</Label>
                  <Select 
                    value={settings.ui.theme} 
                    onValueChange={(value: 'light' | 'dark' | 'auto') => 
                      setSettings(prev => ({
                        ...prev,
                        ui: { ...prev.ui, theme: value }
                      }))
                    }
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
                    onCheckedChange={(checked) => 
                      setSettings(prev => ({
                        ...prev,
                        ui: { ...prev.ui, compactMode: checked }
                      }))
                    }
                  />
                </div>
                
                <div className="flex items-center justify-between py-2">
                  <div>
                    <Label className="font-medium">Enable Animations</Label>
                    <p className="text-sm text-slate-500 mt-1">Show smooth animations and transitions</p>
                  </div>
                  <Switch
                    checked={settings.ui.animationsEnabled}
                    onCheckedChange={(checked) => 
                      setSettings(prev => ({
                        ...prev,
                        ui: { ...prev.ui, animationsEnabled: checked }
                      }))
                    }
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Actions */}
        <div className="flex items-center justify-between pt-6 border-t border-slate-200">
          <Button variant="outline" onClick={resetSettings} disabled={saving}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset to Defaults
          </Button>
          
          <Button onClick={saveSettings} disabled={saving}>
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
  );
}

function getFeatureDescription(feature: string): string {
  const descriptions: Record<string, string> = {
    naturalLanguageQuery: 'Ask questions about your knowledge graph in natural language',
    smartEntityExtraction: 'Automatically extract entities from conversations and text',
    intelligentSuggestions: 'Get AI-powered suggestions for improving your knowledge graph',
    conversationAnalysis: 'Analyze conversations for insights and patterns'
  };
  return descriptions[feature] || 'AI-powered feature';
}