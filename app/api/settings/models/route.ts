import { NextRequest, NextResponse } from 'next/server';
import { getOpenRouterModels, getOpenRouterFreeModels, getOpenRouterModelDetails } from '../../../../lib/models/Settings';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const provider = searchParams.get('provider');
    const freeOnly = searchParams.get('freeOnly') === 'true';
    const includeDetails = searchParams.get('includeDetails') === 'true';
    const apiKey = searchParams.get('apiKey');

    if (provider !== 'openrouter') {
      return NextResponse.json(
        { error: 'Only OpenRouter provider is supported' },
        { status: 400 }
      );
    }

    let models: string[] | any[] = [];
    
    if (includeDetails) {
      const detailedModels = await getOpenRouterModelDetails(apiKey || undefined);
      models = freeOnly ? detailedModels.filter(m => m.pricing?.prompt === '0') : detailedModels;
    } else {
      if (freeOnly) {
        models = await getOpenRouterFreeModels(apiKey || undefined);
      } else {
        models = await getOpenRouterModels({ 
          apiKey: apiKey || undefined,
          freeOnly: false,
          includeVariants: true,
          maxResults: 100
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        models,
        count: models.length,
        provider,
        freeOnly,
        includeDetails
      }
    });

  } catch (error) {
    console.error('Failed to fetch models:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch models',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { provider, freeOnly = false, apiKey, includeDetails = false } = body;

    if (provider !== 'openrouter') {
      return NextResponse.json(
        { error: 'Only OpenRouter provider is supported' },
        { status: 400 }
      );
    }

    let models: string[] | any[] = [];
    
    if (includeDetails) {
      const detailedModels = await getOpenRouterModelDetails(apiKey);
      models = freeOnly ? detailedModels.filter(m => m.pricing?.prompt === '0') : detailedModels;
    } else {
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
    }

    return NextResponse.json({
      success: true,
      data: {
        models,
        count: models.length,
        provider,
        freeOnly,
        includeDetails
      }
    });

  } catch (error) {
    console.error('Failed to fetch models:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch models',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 