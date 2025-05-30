// Test script to verify OpenRouter authentication fix
// Run with: npx tsx test-openrouter-auth.ts

import { AIService } from './lib/services/AIService';

async function testOpenRouterAuth() {
  console.log('🔐 Testing OpenRouter Authentication Fix (V2)...\n');

  const features = {
    naturalLanguageQuery: true,
    smartEntityExtraction: true,
    intelligentSuggestions: true,
    conversationAnalysis: false,
    conflictResolution: false,
    knowledgeGapDetection: false,
    contextPrediction: false
  };

  // Test 1: Invalid API key
  console.log('1. Testing with INVALID API key:');
  const invalidConfig = {
    provider: 'openrouter',
    enabled: true,
    config: {
      apiKey: 'sk-or-v1-invalid-key-test',
      model: 'openai/gpt-3.5-turbo:free',
      baseUrl: 'https://openrouter.ai/api/v1',
      maxTokens: 1000
    }
  };

  try {
    const invalidAIService = new AIService({aiConfiguration: invalidConfig, aiFeatures: features});
    const invalidResult = await invalidAIService.testConnection();
    
    console.log('Result:', invalidResult);
    if (invalidResult.success) {
      console.log('❌ FAILURE: Invalid key was accepted (this should not happen)');
    } else {
      console.log('✅ SUCCESS: Invalid key was properly rejected');
      console.log('   Error message:', invalidResult.error);
    }
  } catch (error: any) {
    console.log('✅ SUCCESS: Invalid key caused error (expected)');
    console.log('   Error:', error.message);
  }

  console.log('\n' + '='.repeat(60) + '\n');

  // Test 2: Wrong base URL
  console.log('2. Testing with WRONG BASE URL:');
  const wrongUrlConfig = {
    provider: 'openrouter',
    enabled: true,
    config: {
      apiKey: 'sk-or-v1-any-key',
      model: 'openai/gpt-3.5-turbo:free',
      baseUrl: 'https://wrong-openrouter-url.com/api/v1',
      maxTokens: 1000
    }
  };

  try {
    const wrongUrlService = new AIService({aiConfiguration: wrongUrlConfig, aiFeatures: features});
    const wrongUrlResult = await wrongUrlService.testConnection();
    
    console.log('Result:', wrongUrlResult);
    if (wrongUrlResult.success) {
      console.log('❌ FAILURE: Wrong URL was accepted (this should not happen)');
    } else {
      console.log('✅ SUCCESS: Wrong URL was properly rejected');
      console.log('   Error message:', wrongUrlResult.error);
    }
  } catch (error: any) {
    console.log('✅ SUCCESS: Wrong URL caused error (expected)');
    console.log('   Error:', error.message);
  }

  console.log('\n' + '='.repeat(60) + '\n');

  // Test 3: Empty API key
  console.log('3. Testing with EMPTY API key:');
  const emptyKeyConfig = {
    provider: 'openrouter',
    enabled: true,
    config: {
      apiKey: '',
      model: 'openai/gpt-3.5-turbo:free',
      baseUrl: 'https://openrouter.ai/api/v1',
      maxTokens: 1000
    }
  };

  try {
    const emptyKeyService = new AIService({aiConfiguration: emptyKeyConfig, aiFeatures: features});
    const emptyKeyResult = await emptyKeyService.testConnection();
    
    console.log('Result:', emptyKeyResult);
    if (emptyKeyResult.success) {
      console.log('❌ FAILURE: Empty key was accepted (this should not happen)');
    } else {
      console.log('✅ SUCCESS: Empty key was properly rejected');
      console.log('   Error message:', emptyKeyResult.error);
    }
  } catch (error: any) {
    console.log('❌ UNEXPECTED: Empty key caused exception');
    console.log('   Error:', error.message);
  }

  console.log('\n' + '='.repeat(60) + '\n');

  // Test 4: Invalid model
  console.log('4. Testing with INVALID MODEL:');
  const invalidModelConfig = {
    provider: 'openrouter',
    enabled: true,
    config: {
      apiKey: 'sk-or-v1-any-key', // Even with wrong key, we should get model error first
      model: 'invalid/non-existent-model',
      baseUrl: 'https://openrouter.ai/api/v1',
      maxTokens: 1000
    }
  };

  try {
    const invalidModelService = new AIService({aiConfiguration: invalidModelConfig, aiFeatures: features});
    const invalidModelResult = await invalidModelService.testConnection();
    
    console.log('Result:', invalidModelResult);
    if (invalidModelResult.success) {
      console.log('❌ FAILURE: Invalid model was accepted (this should not happen)');
    } else {
      console.log('✅ SUCCESS: Invalid model/key was properly rejected');
      console.log('   Error message:', invalidModelResult.error);
    }
  } catch (error: any) {
    console.log('✅ SUCCESS: Invalid model caused error (expected)');
    console.log('   Error:', error.message);
  }

  console.log('\n' + '='.repeat(60) + '\n');

  // Test 5: Test with actual API key (if you have one)
  console.log('5. Testing with VALID API key:');
  console.log('   (Replace "your-actual-key-here" with your real OpenRouter API key)');
  
  const validConfig = {
    provider: 'openrouter',
    enabled: true,
    config: {
      apiKey: 'your-actual-key-here', // Replace this
      model: 'openai/gpt-3.5-turbo:free',
      baseUrl: 'https://openrouter.ai/api/v1',
      maxTokens: 1000
    }
  };

  if (validConfig.config.apiKey === 'your-actual-key-here') {
    console.log('⚠️  SKIPPED: Please replace "your-actual-key-here" with your actual OpenRouter API key to test');
  } else {
    try {
      const validAIService = new AIService({aiConfiguration: validConfig, aiFeatures: features});
      const validResult = await validAIService.testConnection();
      
      console.log('Result:', validResult);
      if (validResult.success) {
        console.log('✅ SUCCESS: Valid key was accepted');
        console.log('   Message:', validResult.data?.message);
        console.log('   Available models:', validResult.data?.availableModels?.slice(0, 5));
        console.log('   Token usage:', validResult.data?.usage);
      } else {
        console.log('❌ UNEXPECTED: Valid key was rejected');
        console.log('   Error:', validResult.error);
      }
    } catch (error: any) {
      console.log('❌ UNEXPECTED: Valid key caused error');
      console.log('   Error:', error.message);
    }
  }

  console.log('\n🎉 Authentication test completed!');
  console.log('\n📋 Summary of improvements:');
  console.log('✅ Makes authenticated chat completion request (not just /models)');
  console.log('✅ Validates empty/missing API keys immediately');
  console.log('✅ Properly detects network errors (wrong base URL)');
  console.log('✅ Detects authentication failures (401/403 errors)');
  console.log('✅ Provides specific error messages for each failure type');
  console.log('✅ Validates API key AND model in one test');
  console.log('✅ Uses minimal token usage for testing (~1 token)');
  
  console.log('\n💡 Note: The test now makes a real authenticated API call');
  console.log('   which properly validates both the API key and model selection.');
}

testOpenRouterAuth().catch(console.error); 