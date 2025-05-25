import { NextRequest, NextResponse } from 'next/server';
import { qdrantDataService, QdrantUserSettings } from '../../../lib/services/QdrantDataService';
import { UserSettings } from '../../../lib/models/Settings';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || 'default-user';

    await qdrantDataService.initialize();
    const settings = await qdrantDataService.getUserSettings(userId);

    return NextResponse.json({
      success: true,
      data: settings
    });

  } catch (error) {
    console.error('Failed to load settings:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to load settings',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId = 'default-user', settings } = body;

    if (!settings) {
      return NextResponse.json(
        { error: 'Settings data is required' },
        { status: 400 }
      );
    }

    await qdrantDataService.initialize();
    
    // Get existing settings or create new ones
    const existingSettings = await qdrantDataService.getUserSettings(userId);
    const now = new Date();
    
    const updatedSettings: QdrantUserSettings = {
      id: existingSettings?.id || `settings_${userId}_${Date.now()}`,
      userId,
      aiConfiguration: settings.aiConfiguration || existingSettings?.aiConfiguration || {},
      aiFeatures: settings.aiFeatures || existingSettings?.aiFeatures || {},
      privacy: settings.privacy || existingSettings?.privacy || {},
      performance: settings.performance || existingSettings?.performance || {},
      ui: settings.ui || existingSettings?.ui || {},
      createdAt: existingSettings?.createdAt || now,
      updatedAt: now
    };

    await qdrantDataService.saveUserSettings(updatedSettings);

    return NextResponse.json({
      success: true,
      data: updatedSettings
    });

  } catch (error) {
    console.error('Failed to save settings:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to save settings',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId = 'default-user', aiConfiguration, aiFeatures } = body;

    if (!aiConfiguration && !aiFeatures) {
      return NextResponse.json(
        { error: 'Either aiConfiguration or aiFeatures (or both) is required' },
        { status: 400 }
      );
    }

    await qdrantDataService.initialize();
    
    // Get existing settings
    const existingSettings = await qdrantDataService.getUserSettings(userId);
    if (!existingSettings) {
      return NextResponse.json(
        { error: 'User settings not found. Please create settings first.' },
        { status: 404 }
      );
    }

    // Update specific fields
    const updatedSettings: QdrantUserSettings = {
      ...existingSettings,
      aiConfiguration: aiConfiguration || existingSettings.aiConfiguration,
      aiFeatures: aiFeatures || existingSettings.aiFeatures,
      updatedAt: new Date()
    };

    await qdrantDataService.saveUserSettings(updatedSettings);

    return NextResponse.json({
      success: true,
      data: updatedSettings
    });

  } catch (error) {
    console.error('Failed to update settings:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to update settings',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 