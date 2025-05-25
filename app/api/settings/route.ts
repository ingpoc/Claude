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

    if (!aiConfiguration && !aiFeatures) {
      return NextResponse.json(
        { error: 'Either aiConfiguration or aiFeatures (or both) is required' },
        { status: 400 }
      );
    }

    let updatedSettings: UserSettings;
    
    // If both are provided, update them together
    if (aiConfiguration && aiFeatures) {
      updatedSettings = await settingsService.updateUserSettings(userId, {
        aiConfiguration,
        aiFeatures
      });
    } else if (aiConfiguration) {
      updatedSettings = await settingsService.updateAIConfiguration(userId, aiConfiguration);
    } else {
      updatedSettings = await settingsService.updateAIFeatures(userId, aiFeatures);
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