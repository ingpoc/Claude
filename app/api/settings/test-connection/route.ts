import { NextRequest, NextResponse } from 'next/server';
import { AIService } from '../../../../lib/services/AIService';
import { logger } from '../../../../lib/services/Logger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, aiConfiguration, aiFeatures } = body;

    if (!aiConfiguration) {
      return NextResponse.json(
        { success: false, message: 'AI configuration is required' },
        { status: 400 }
      );
    }

    if (!aiConfiguration.enabled) {
      return NextResponse.json({
        success: true,
        message: 'AI is disabled'
      });
    }

    // Create AIService with the configuration from frontend
    const aiService = new AIService({ aiConfiguration, aiFeatures: aiFeatures || {} });
    
    // Test the connection using our fixed logic
    const result = await aiService.testConnection();
    
    logger.info('Connection test completed', { 
      userId, 
      provider: aiConfiguration.provider,
      success: result.success,
      hasError: !!result.error
    });

    return NextResponse.json({
      success: result.success,
      message: result.error || result.data?.message || 'Connection test completed',
      provider: aiConfiguration.provider
    });

  } catch (error) {
    logger.error('API: Connection test failed', error);
    
    return NextResponse.json(
      { 
        success: false, 
        message: error instanceof Error ? error.message : 'Connection test failed' 
      },
      { status: 500 }
    );
  }
} 