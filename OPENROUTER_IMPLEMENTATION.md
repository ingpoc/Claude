# OpenRouter Implementation Guide

## Overview

OpenRouter is now fully implemented in GraphMemory, providing access to 300+ AI models through a unified API. This implementation includes dynamic model fetching, free model prioritization, cost tracking, and comprehensive error handling.

## Features

### ✅ Implemented Features

1. **Full Provider Implementation**
   - Complete `OpenRouterProvider` class with all required methods
   - OpenAI-compatible API integration
   - Proper error handling and response parsing

2. **Dynamic Model Management** ✅ **ENHANCED**
   - **Real-time fetching** of 300+ models from OpenRouter's API
   - **Intelligent 5-minute caching** to reduce API calls and improve performance
   - **Free-only filtering** - Get ONLY free models with `getOpenRouterFreeModels()`
   - **Smart free detection** - Identifies naturally free models + `:free` variants
   - **Flexible options** - Configure `freeOnly`, `includeVariants`, `maxResults`
   - **Graceful fallback** to static model list if API fails
   - **API endpoints** for frontend integration (`/api/settings/models`)

3. **Free Model Support**
   - Automatic detection of free models from OpenRouter's pricing data
   - Adds `:free` variants for popular models (GPT-3.5, Claude Haiku, Llama-3)
   - Zero-cost calculation for free models

4. **Cost Tracking**
   - Real-time cost calculation based on token usage
   - Model-specific pricing estimates
   - Free model cost tracking (always $0)

5. **Robust Connection Testing** ✅ **FULLY FIXED**
   - **Complete end-to-end authentication** - Frontend ↔ API ↔ Backend all properly integrated
   - **Authentic API key validation** - Makes actual chat completion request (not just /models endpoint)
   - **Configuration validation** - Validates empty/missing API keys before making requests  
   - **Network error detection** - Properly detects wrong base URLs and connection failures
   - **Authentication failure detection** - Detects 401/403 errors with specific messages
   - **Model validation** - Verifies selected model works with the API key
   - **Minimal cost testing** - Uses only 1 token for testing (~$0.001 cost)
   - **Detailed error messages** - Provides specific feedback for each failure type
   - **No false positives** - Cannot be fooled by public endpoints that don't require auth
   - **Full-stack integration** - UI properly calls backend via `/api/settings/test-connection`

6. **Configuration Validation**
   - API key requirement validation
   - Model selection validation
   - Base URL format validation

## Usage

### Basic Configuration

```javascript
const config = {
  provider: 'openrouter',
  enabled: true,
  config: {
    apiKey: 'sk-or-v1-your-api-key',
    model: 'openai/gpt-3.5-turbo:free', // Free model
    baseUrl: 'https://openrouter.ai/api/v1', // Optional
    maxTokens: 1000
  }
};
```

### Fetching Available Models

```javascript
import { getOpenRouterModels, getOpenRouterFreeModels, getOpenRouterModelDetails } from './lib/models/Settings';

// Get ONLY free models (recommended for development)
const freeModels = await getOpenRouterFreeModels();
console.log(`Found ${freeModels.length} free models`); // Found 50+ free models

// Get all models with options
const allModels = await getOpenRouterModels({
  freeOnly: false,      // Include paid models
  includeVariants: true, // Include :free variants  
  maxResults: 100       // Limit results
});

// Get only free models with API key (more models available when authenticated)
const authFreeModels = await getOpenRouterFreeModels('sk-or-v1-your-key');

// Get detailed model information including pricing and context length
const detailedModels = await getOpenRouterModelDetails('sk-or-v1-your-key');
const freeDetailed = detailedModels.filter(m => m.pricing?.prompt === '0');
```

### Using the AI Service

```javascript
import { AIService } from './lib/services/AIService';

const aiService = new AIService(config, features);

// Test connection
const connectionTest = await aiService.testConnection();

// Query the AI
const response = await aiService.queryNaturalLanguage(
  "Explain the relationship between these entities",
  { entities: ['User', 'Project', 'Graph'] }
);

// Extract entities
const entities = await aiService.extractEntities(
  "This React component uses hooks and manages state"
);

// Generate suggestions
const suggestions = await aiService.generateSuggestions(
  context,
  knowledgeGraph,
  userHistory
);
```

## Model Categories

### Premium Models (Recommended - Always Available)
- `openai/gpt-3.5-turbo` ⭐ **Default**
- `openai/gpt-4-turbo`
- `anthropic/claude-3-haiku`
- `anthropic/claude-3-sonnet`
- `anthropic/claude-3-opus`
- `meta-llama/llama-3-8b-instruct`
- `meta-llama/llama-3-70b-instruct`
- And 290+ other models

### Free Models (Availability Varies)
- `mistralai/devstral-small:free` ✅ **Currently Available**
- `openai/gpt-3.5-turbo:free` ❓ **May not be available**
- `anthropic/claude-3-haiku:free` ❓ **May not be available**
- `meta-llama/llama-3-8b-instruct:free` ❓ **May not be available**
- Plus other naturally free models from providers

## API Integration Details

### Headers Required
```javascript
{
  'Authorization': 'Bearer sk-or-v1-your-key',
  'HTTP-Referer': 'https://localhost:3000',
  'X-Title': 'GraphMemory Knowledge Graph',
  'Content-Type': 'application/json'
}
```

### Supported Endpoints
- `GET /models` - List available models
- `POST /chat/completions` - Chat completions (OpenAI-compatible)

### Model Variants Supported
- `:free` - Free tier with rate limits
- `:beta` - Beta models (unmoderated)
- `:extended` - Extended context length
- `:thinking` - Reasoning-enabled models

## Error Handling

The implementation includes comprehensive error handling:

1. **API Connection Errors** - Network issues, invalid URLs
2. **Authentication Errors** - Invalid or missing API keys
3. **Model Errors** - Unavailable or invalid model selection
4. **Rate Limiting** - Graceful handling of rate limits
5. **Parsing Errors** - Malformed responses with fallback parsing

## Cost Management

### Cost Calculation
```javascript
// Automatic cost calculation for all models
const response = await aiService.query(request);
console.log(`Cost: $${response.usage?.cost || 0}`);
```

### Free Model Benefits
- Zero cost for all `:free` variant models
- Lower rate limits but no billing
- Perfect for development and testing

## Configuration Examples

### Development Setup (Free Models)
```javascript
{
  provider: 'openrouter',
  config: {
    apiKey: 'sk-or-v1-dev-key',
    model: 'openai/gpt-3.5-turbo:free',
    maxTokens: 500
  }
}
```

### Production Setup (Premium Models)
```javascript
{
  provider: 'openrouter',
  config: {
    apiKey: 'sk-or-v1-prod-key',
    model: 'anthropic/claude-3-sonnet',
    maxTokens: 2000
  }
}
```

### High-Performance Setup
```javascript
{
  provider: 'openrouter',
  config: {
    apiKey: 'sk-or-v1-key',
    model: 'openai/gpt-4-turbo:nitro', // Fastest routing
    maxTokens: 4000
  }
}
```

## Testing

Run the test script to verify implementation:

```bash
node test-openrouter.js
```

This will test:
- Model fetching functionality
- Provider initialization
- Configuration validation
- Basic functionality

## Best Practices

1. **Use Free Models for Development** - Start with `:free` variants
2. **Cache Model Lists** - Models are cached for 5 minutes automatically
3. **Handle Errors Gracefully** - Always check `response.success`
4. **Monitor Costs** - Track `response.usage?.cost` for budget management
5. **Prefer Specific Models** - Choose models based on your use case

## Integration with Settings UI

The settings interface automatically:
- Loads available models dynamically
- Prioritizes free models in the dropdown
- Validates configuration in real-time
- Tests connections with live feedback

## Troubleshooting

### Common Issues

1. **API Key Not Working**
   - Verify key format: `sk-or-v1-...`
   - Check OpenRouter dashboard for key status

2. **Model Not Available**
   - Use model fetching to get current list
   - Check for typos in model names

3. **Rate Limiting**
   - Switch to paid models for higher limits
   - Use `:free` variants for testing only

4. **High Costs**
   - Use free models for development
   - Set appropriate `maxTokens` limits
   - Monitor usage in OpenRouter dashboard

## Future Enhancements

Potential improvements:
- Real-time pricing updates from OpenRouter API
- Model performance metrics integration
- Auto-routing based on performance/cost preferences
- Enhanced cost tracking and budgeting features 