// Test script for OpenRouter implementation
// Run with: npx ts-node test-openrouter.ts  (or npx tsx test-openrouter.ts)

import { AIService } from './lib/services/AIService';
import { getOpenRouterModels } from './lib/models/Settings';
import { AIConfiguration, AIFeatures } from './lib/models/Settings';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

// This top-level config is for the Jest-like test suite
const jestSuiteConfig: AIConfiguration = {
  provider: 'openrouter',
  enabled: true,
  config: { // Provider specific config nested under 'config'
    apiKey: process.env.OPENROUTER_API_KEY || '',
    model: 'anthropic/claude-3-haiku:beta',
    // model: 'mistralai/mistral-7b-instruct',
    // model: 'nousresearch/nous-hermes-2-mixtral-8x7b-dpo',
    // You might add baseUrl or maxTokens here if OpenRouterProvider uses them from this.config.config
  },
  providerConfigs: {}
};

const jestSuiteFeatures: AIFeatures = {
  naturalLanguageQuery: true,
  smartEntityExtraction: true, // Corrected name
  intelligentSuggestions: true, // Corrected name
  conversationAnalysis: false, // Assuming false for tests if not used
  conflictResolution: false,
  knowledgeGapDetection: false,
  contextPrediction: false,
};

describe('AIService with OpenRouterProvider (Jest Suite)', () => {
  let aiService: AIService;

  beforeAll(() => {
    // Check if the API key is available from the jestSuiteConfig
    if (!jestSuiteConfig.config?.apiKey) {
      console.warn("Skipping OpenRouter Jest tests: OPENROUTER_API_KEY is not set in .env.local or jestSuiteConfig");
      return;
    }
    aiService = new AIService({aiConfiguration: jestSuiteConfig, aiFeatures: jestSuiteFeatures});
  });

  test('should test connection successfully via Jest suite', async () => {
    if (!aiService) return; // Skip if service wasn't initialized
    // Test 1: Model fetching (already global, but good to have a test point)
    console.log('1. Fetching OpenRouter models (Jest suite - no API key needed for getOpenRouterModels):');
    try {
      const models = await getOpenRouterModels(); // This function fetches all, not tied to aiService config
      console.log(`✅ Retrieved ${models.length} models`);
      console.log('📋 First 10 models:', models.slice(0, 10));
      console.log('🆓 Free models:', models.filter(m => m.includes(':free')));
    } catch (error: any) {
      console.log('❌ Error fetching models:', error.message);
    }

    // Test 2: Provider validation from initialized aiService
    console.log('\n2. Testing provider validation (Jest suite):');
    const providerInfo = aiService.getProviderInfo();
    expect(providerInfo.name).toBe('OpenRouterProvider');
    expect(providerInfo.isReady).toBe(true);
    console.log('✅ Provider info:', providerInfo);
    
    // Test 3: Feature checks (Jest suite)
    console.log('\n3. Testing feature availability (Jest suite):');
    expect(aiService.isFeatureEnabled('naturalLanguageQuery')).toBe(true);
    expect(aiService.isFeatureEnabled('smartEntityExtraction')).toBe(true);
    expect(aiService.isFeatureEnabled('intelligentSuggestions')).toBe(true);
    expect(aiService.isFeatureEnabled('conversationAnalysis')).toBe(false);
    console.log('Natural Language Query:', aiService.isFeatureEnabled('naturalLanguageQuery'));
    console.log('Smart Entity Extraction:', aiService.isFeatureEnabled('smartEntityExtraction'));
    console.log('Intelligent Suggestions:', aiService.isFeatureEnabled('intelligentSuggestions'));
  });

  test('should perform a simple query via Jest suite', async () => {
    if (!aiService) return;
    const response = await aiService.queryNaturalLanguage('Hello from Jest!');
    console.log('Query Response (Jest Suite):', response);
    expect(response.success).toBe(true);
    expect(response.data?.response).toBeTruthy();
  });
});

// This is the standalone test function, separate from Jest
async function testOpenRouterStandalone() {
  console.log('\n\n🔍 Testing OpenRouter Implementation (Standalone Function)...\n');

  // Test 1: Model fetching (uses OPENROUTER_API_KEY if provided to the function)
  console.log('1. Fetching OpenRouter models (Standalone - API key from env used by getOpenRouterModels if needed by underlying call):');
  try {
    const models = await getOpenRouterModels({apiKey: process.env.OPENROUTER_API_KEY});
    console.log(`✅ Retrieved ${models.length} models`);
    console.log('📋 First 10 models:', models.slice(0, 10));
    console.log('🆓 Free models:', models.filter(m => m.includes(':free')));
  } catch (error: any) {
    console.log('❌ Error fetching models:', error.message);
  }

  // Configuration for the standalone test function
  const standaloneConfig: AIConfiguration = {
    provider: 'openrouter',
    enabled: true,
    config: { // Correctly nested provider config
      apiKey: process.env.OPENROUTER_API_KEY || '',
      model: 'anthropic/claude-3-haiku:beta', // Or any other valid model
      // baseUrl: 'https://openrouter.ai/api/v1', // Default is usually fine
      maxTokens: 150 // Example specific maxTokens for this instance
    },
    providerConfigs: {}
  };

  const standaloneFeatures: AIFeatures = {
    naturalLanguageQuery: true,
    smartEntityExtraction: true, // Corrected
    intelligentSuggestions: true, // Corrected
    conversationAnalysis: false,
    conflictResolution: false,
    knowledgeGapDetection: false,
    contextPrediction: false
  };

  if (!standaloneConfig.config?.apiKey) {
    console.warn("Skipping Standalone OpenRouter AIService tests: OPENROUTER_API_KEY is not set.");
    return;
  }

  try {
    const aiService = new AIService({aiConfiguration: standaloneConfig, aiFeatures: standaloneFeatures});
    const providerInfo = aiService.getProviderInfo();
    console.log('\n2. Testing provider validation (Standalone):');
    console.log('✅ Provider info:', providerInfo);
    if (!providerInfo.isReady) {
      console.error('❌ AIService provider is not ready. Check config and API key.');
      const testResult = await aiService.testConnection();
      console.error('Connection Test Details:', testResult);
      return;
    }
    
    // Test 3: Feature checks (Standalone)
    console.log('\n3. Testing feature availability (Standalone):');
    console.log('Natural Language Query:', aiService.isFeatureEnabled('naturalLanguageQuery'));
    console.log('Smart Entity Extraction:', aiService.isFeatureEnabled('smartEntityExtraction'));
    console.log('Intelligent Suggestions:', aiService.isFeatureEnabled('intelligentSuggestions'));
    
    // Test 4: Simple Query (Standalone)
    console.log('\n4. Performing a simple query (Standalone):');
    const queryResponse = await aiService.queryNaturalLanguage('Translate "Hello World" to French.');
    console.log('Query Response (Standalone):', queryResponse);
    if (queryResponse.success && queryResponse.data?.response) {
      console.log('✅ Query successful. Response:', queryResponse.data.response);
    } else {
      console.error('❌ Query failed. Details:', queryResponse.error);
    }

  } catch (error: any) {
    console.log('❌ Error creating or using AIService (Standalone):', error.message);
  }

  console.log('\n🎉 Standalone OpenRouter test completed!');
}

// Decide which test to run or run both
// For Jest environment, describe block will be picked up.
// For direct execution (e.g. ts-node), call the standalone function.
if (process.env.NODE_ENV !== 'test') { // Simple check if not in a Jest-like env
  testOpenRouterStandalone().catch(console.error);
} 