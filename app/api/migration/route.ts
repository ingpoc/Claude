import { NextRequest, NextResponse } from 'next/server';
import { migrationService } from '../../../lib/services/MigrationService';
import { logger } from '../../../lib/services/Logger';

// GET /api/migration - Get migration status
export async function GET() {
  try {
    const status = await migrationService.getMigrationStatus();
    
    return NextResponse.json({
      success: true,
      data: status
    });
  } catch (error) {
    logger.error('Failed to get migration status', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

// POST /api/migration - Start migration
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'start':
        logger.info('Starting migration via API');
        const migrationResult = await migrationService.startMigration();
        
        return NextResponse.json({
          success: true,
          data: migrationResult,
          message: 'Migration completed successfully'
        });

      case 'verify':
        logger.info('Verifying migration via API');
        const verificationResult = await migrationService.verifyMigration();
        
        return NextResponse.json({
          success: true,
          data: verificationResult,
          message: 'Migration verification completed'
        });

      case 'rollback':
        logger.info('Rolling back migration via API');
        await migrationService.rollbackMigration();
        
        return NextResponse.json({
          success: true,
          message: 'Migration rolled back successfully'
        });

      default:
        return NextResponse.json(
          { 
            success: false, 
            error: 'Invalid action. Use "start", "verify", or "rollback"' 
          },
          { status: 400 }
        );
    }
  } catch (error) {
    logger.error('Migration API error', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
} 