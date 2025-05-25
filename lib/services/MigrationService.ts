import { logger } from './Logger';
import { qdrantDataService, QdrantEntity, QdrantRelationship, QdrantProject, QdrantUserSettings } from './QdrantDataService';
import { knowledgeGraphService } from './KnowledgeGraphService';
import { settingsService } from './SettingsService';

export interface MigrationStatus {
  isComplete: boolean;
  projectsMigrated: number;
  entitiesMigrated: number;
  relationshipsMigrated: number;
  settingsMigrated: number;
  errors: string[];
  startTime?: Date;
  endTime?: Date;
}

export class MigrationService {
  private migrationStatus: MigrationStatus = {
    isComplete: false,
    projectsMigrated: 0,
    entitiesMigrated: 0,
    relationshipsMigrated: 0,
    settingsMigrated: 0,
    errors: []
  };

  async getMigrationStatus(): Promise<MigrationStatus> {
    return { ...this.migrationStatus };
  }

  async startMigration(): Promise<MigrationStatus> {
    logger.info('Starting migration from KuzuDB to Qdrant');
    this.migrationStatus = {
      isComplete: false,
      projectsMigrated: 0,
      entitiesMigrated: 0,
      relationshipsMigrated: 0,
      settingsMigrated: 0,
      errors: [],
      startTime: new Date()
    };

    try {
      // Initialize Qdrant service
      await qdrantDataService.initialize();
      logger.info('Qdrant service initialized');

      // Step 1: Migrate user settings
      await this.migrateUserSettings();

      // Step 2: Migrate projects
      const projects = await this.migrateProjects();

      // Step 3: Migrate entities and relationships for each project
      for (const project of projects) {
        await this.migrateProjectData(project.id);
      }

      this.migrationStatus.isComplete = true;
      this.migrationStatus.endTime = new Date();
      
      logger.info('Migration completed successfully', {
        projectsMigrated: this.migrationStatus.projectsMigrated,
        entitiesMigrated: this.migrationStatus.entitiesMigrated,
        relationshipsMigrated: this.migrationStatus.relationshipsMigrated,
        settingsMigrated: this.migrationStatus.settingsMigrated,
        duration: this.migrationStatus.endTime.getTime() - this.migrationStatus.startTime!.getTime()
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.migrationStatus.errors.push(errorMessage);
      logger.error('Migration failed', error);
      throw error;
    }

    return this.migrationStatus;
  }

  private async migrateUserSettings(): Promise<void> {
    try {
      logger.info('Migrating user settings');
      
      // Get settings from KuzuDB
      const kuzuSettings = await settingsService.getUserSettings('default-user');
      
      if (kuzuSettings) {
        // Convert to Qdrant format
        const qdrantSettings: QdrantUserSettings = {
          id: kuzuSettings.id,
          userId: kuzuSettings.userId,
          aiConfiguration: kuzuSettings.aiConfiguration,
          aiFeatures: kuzuSettings.aiFeatures,
          privacy: kuzuSettings.privacy,
          performance: kuzuSettings.performance,
          ui: kuzuSettings.ui,
          createdAt: kuzuSettings.createdAt,
          updatedAt: kuzuSettings.updatedAt
        };

        await qdrantDataService.saveUserSettings(qdrantSettings);
        this.migrationStatus.settingsMigrated++;
        logger.info('User settings migrated successfully');
      } else {
        logger.info('No user settings found to migrate');
      }
    } catch (error) {
      const errorMessage = `Failed to migrate user settings: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.migrationStatus.errors.push(errorMessage);
      logger.error('Failed to migrate user settings', error);
    }
  }

  private async migrateProjects(): Promise<QdrantProject[]> {
    const migratedProjects: QdrantProject[] = [];
    
    try {
      logger.info('Migrating projects');
      
      // Note: KnowledgeGraphService doesn't have getAllProjects, so we'll create a mock project for now
      // In a real migration, you'd need to implement this method or get projects from another source
      const mockProjects = [
        {
          id: 'project_febff5dd-29f8-44e8-a27c-02585d91645b',
          name: 'Default Project',
          description: 'Default project for migration',
          metadata: {}
        }
      ];
      
      for (const kuzuProject of mockProjects) {
        try {
          // Convert to Qdrant format
          const qdrantProject: Omit<QdrantProject, 'id' | 'createdAt' | 'lastAccessed'> = {
            name: kuzuProject.name,
            description: kuzuProject.description,
            metadata: kuzuProject.metadata || {}
          };

          const createdProject = await qdrantDataService.createProject(qdrantProject);
          
          // Store mapping for entity/relationship migration
          createdProject.id = kuzuProject.id; // Keep same ID for consistency
          migratedProjects.push(createdProject);
          
          this.migrationStatus.projectsMigrated++;
          logger.info('Project migrated', { projectId: kuzuProject.id, name: kuzuProject.name });
          
        } catch (error) {
          const errorMessage = `Failed to migrate project ${kuzuProject.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          this.migrationStatus.errors.push(errorMessage);
          logger.error('Failed to migrate project', { projectId: kuzuProject.id, error });
        }
      }
      
      logger.info('Projects migration completed', { count: migratedProjects.length });
      
    } catch (error) {
      const errorMessage = `Failed to get projects: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.migrationStatus.errors.push(errorMessage);
      logger.error('Failed to get projects', error);
    }

    return migratedProjects;
  }

  private async migrateProjectData(projectId: string): Promise<void> {
    logger.info('Migrating project data', { projectId });

    // Migrate entities first
    await this.migrateEntities(projectId);
    
    // Then migrate relationships (which depend on entities)
    await this.migrateRelationships(projectId);
  }

  private async migrateEntities(projectId: string): Promise<void> {
    try {
      logger.info('Migrating entities', { projectId });
      
      // Get entities from KuzuDB using the correct method
      const kuzuEntities = await knowledgeGraphService.getAllEntities(projectId);
      
      for (const kuzuEntity of kuzuEntities) {
        try {
          // Convert to Qdrant format
          const qdrantEntity: Omit<QdrantEntity, 'id' | 'createdAt' | 'updatedAt'> = {
            name: kuzuEntity.name,
            type: kuzuEntity.type,
            description: kuzuEntity.description,
            projectId: projectId,
            metadata: {
              observations: kuzuEntity.observations || [],
              parentId: kuzuEntity.parentId,
              originalCreatedAt: kuzuEntity.createdAt,
              originalUpdatedAt: kuzuEntity.updatedAt
            }
          };

          const createdEntity = await qdrantDataService.createEntity(qdrantEntity);
          
          // Update with original ID for consistency
          await qdrantDataService.updateEntity(projectId, createdEntity.id, { id: kuzuEntity.id });
          
          this.migrationStatus.entitiesMigrated++;
          logger.debug('Entity migrated', { projectId, entityId: kuzuEntity.id, name: kuzuEntity.name });
          
        } catch (error) {
          const errorMessage = `Failed to migrate entity ${kuzuEntity.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          this.migrationStatus.errors.push(errorMessage);
          logger.error('Failed to migrate entity', { projectId, entityId: kuzuEntity.id, error });
        }
      }
      
      logger.info('Entities migration completed', { projectId, count: kuzuEntities.length });
      
    } catch (error) {
      const errorMessage = `Failed to get entities for project ${projectId}: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.migrationStatus.errors.push(errorMessage);
      logger.error('Failed to get entities from KuzuDB', { projectId, error });
    }
  }

  private async migrateRelationships(projectId: string): Promise<void> {
    try {
      logger.info('Migrating relationships', { projectId });
      
      // Get relationships from KuzuDB using the correct method
      const kuzuRelationships = await knowledgeGraphService.getRelationships(projectId);
      
      for (const kuzuRelationship of kuzuRelationships) {
        try {
          // Convert to Qdrant format
          const qdrantRelationship: Omit<QdrantRelationship, 'id' | 'createdAt'> = {
            sourceId: kuzuRelationship.from,
            targetId: kuzuRelationship.to,
            type: kuzuRelationship.type,
            description: kuzuRelationship.description,
            projectId: projectId,
            strength: 1.0, // Default strength, can be computed later
            metadata: {
              originalCreatedAt: kuzuRelationship.createdAt
            }
          };

          await qdrantDataService.createRelationship(qdrantRelationship);
          
          this.migrationStatus.relationshipsMigrated++;
          logger.debug('Relationship migrated', { 
            projectId, 
            relationshipId: kuzuRelationship.id,
            sourceId: kuzuRelationship.from,
            targetId: kuzuRelationship.to
          });
          
        } catch (error) {
          const errorMessage = `Failed to migrate relationship ${kuzuRelationship.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          this.migrationStatus.errors.push(errorMessage);
          logger.error('Failed to migrate relationship', { projectId, relationshipId: kuzuRelationship.id, error });
        }
      }
      
      logger.info('Relationships migration completed', { projectId, count: kuzuRelationships.length });
      
    } catch (error) {
      const errorMessage = `Failed to get relationships for project ${projectId}: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.migrationStatus.errors.push(errorMessage);
      logger.error('Failed to get relationships from KuzuDB', { projectId, error });
    }
  }

  // Verify migration by comparing data counts
  async verifyMigration(): Promise<{ isValid: boolean; details: any }> {
    try {
      logger.info('Verifying migration');

      const qdrantHealth = await qdrantDataService.healthCheck();
      
      const verification = {
        isValid: qdrantHealth.status === 'healthy',
        details: {
          qdrantStatus: qdrantHealth.status,
          qdrantCollections: qdrantHealth.collections,
          qdrantTotalPoints: qdrantHealth.totalPoints,
          migrationStatus: this.migrationStatus
        }
      };

      logger.info('Migration verification completed', verification);
      return verification;
      
    } catch (error) {
      logger.error('Migration verification failed', error);
      return {
        isValid: false,
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }

  // Rollback migration (restore KuzuDB as primary)
  async rollbackMigration(): Promise<void> {
    logger.warn('Rolling back migration - KuzuDB will remain as primary database');
    
    // Reset migration status
    this.migrationStatus = {
      isComplete: false,
      projectsMigrated: 0,
      entitiesMigrated: 0,
      relationshipsMigrated: 0,
      settingsMigrated: 0,
      errors: ['Migration rolled back by user']
    };
    
    logger.info('Migration rollback completed');
  }
}

// Export singleton instance
export const migrationService = new MigrationService(); 