import { NextRequest, NextResponse } from 'next/server';
import { settingsService } from '../../../lib/services/SettingsService';
import { UserSettings } from '../../../lib/models/Settings';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || 'default-user';

    const settings = await settingsService.getUserSettings(userId);

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

    const updatedSettings = await settingsService.updateUserSettings(userId, settings);

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

    let updatedSettings: UserSettings;
    
    if (aiConfiguration) {
      updatedSettings = await settingsService.updateAIConfiguration(userId, aiConfiguration);
    } else if (aiFeatures) {
      updatedSettings = await settingsService.updateAIFeatures(userId, aiFeatures);
    } else {
      return NextResponse.json(
        { error: 'Either aiConfiguration or aiFeatures is required' },
        { status: 400 }
      );
    }

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