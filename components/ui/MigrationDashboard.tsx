"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './card';
import { Button } from './button';
import { Badge } from './badge';
import { Alert, AlertDescription } from './alert';
import { 
  Database, 
  ArrowRight, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  RefreshCw,
  Play,
  RotateCcw,
  Shield
} from 'lucide-react';

interface MigrationStatus {
  isComplete: boolean;
  projectsMigrated: number;
  entitiesMigrated: number;
  relationshipsMigrated: number;
  settingsMigrated: number;
  errors: string[];
  startTime?: string;
  endTime?: string;
}

interface MigrationDashboardProps {
  className?: string;
}

export function MigrationDashboard({ className }: MigrationDashboardProps) {
  const [migrationStatus, setMigrationStatus] = useState<MigrationStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastAction, setLastAction] = useState<string>('');

  // Fetch migration status
  const fetchMigrationStatus = async () => {
    try {
      const response = await fetch('/api/migration');
      const result = await response.json();
      
      if (result.success) {
        setMigrationStatus(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch migration status:', error);
    }
  };

  // Start migration
  const startMigration = async () => {
    setIsLoading(true);
    setLastAction('Starting migration...');
    
    try {
      const response = await fetch('/api/migration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start' })
      });
      
      const result = await response.json();
      
      if (result.success) {
        setLastAction('Migration completed successfully!');
        await fetchMigrationStatus();
      } else {
        setLastAction(`Migration failed: ${result.error}`);
      }
    } catch (error) {
      setLastAction(`Migration error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Verify migration
  const verifyMigration = async () => {
    setIsLoading(true);
    setLastAction('Verifying migration...');
    
    try {
      const response = await fetch('/api/migration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify' })
      });
      
      const result = await response.json();
      
      if (result.success) {
        setLastAction(`Verification completed: ${result.data.isValid ? 'Valid' : 'Invalid'}`);
      } else {
        setLastAction(`Verification failed: ${result.error}`);
      }
    } catch (error) {
      setLastAction(`Verification error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Rollback migration
  const rollbackMigration = async () => {
    setIsLoading(true);
    setLastAction('Rolling back migration...');
    
    try {
      const response = await fetch('/api/migration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rollback' })
      });
      
      const result = await response.json();
      
      if (result.success) {
        setLastAction('Migration rolled back successfully');
        await fetchMigrationStatus();
      } else {
        setLastAction(`Rollback failed: ${result.error}`);
      }
    } catch (error) {
      setLastAction(`Rollback error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Load status on mount
  useEffect(() => {
    fetchMigrationStatus();
  }, []);

  const totalMigrated = migrationStatus ? 
    migrationStatus.projectsMigrated + 
    migrationStatus.entitiesMigrated + 
    migrationStatus.relationshipsMigrated + 
    migrationStatus.settingsMigrated : 0;

  const hasErrors = migrationStatus?.errors && migrationStatus.errors.length > 0;

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Database Migration</h2>
          <p className="text-slate-600 mt-1">Migrate from KuzuDB to Qdrant-only architecture</p>
        </div>
        <Button 
          onClick={fetchMigrationStatus}
          variant="outline"
          size="sm"
          disabled={isLoading}
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Migration Flow Visualization */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Database className="w-5 h-5 mr-2 text-slate-600" />
            Migration Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center space-x-8 py-6">
            {/* KuzuDB */}
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-3">
                <Database className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="font-medium text-slate-900">KuzuDB</h3>
              <p className="text-sm text-slate-500">Current Database</p>
            </div>

            {/* Arrow */}
            <ArrowRight className="w-8 h-8 text-slate-400" />

            {/* Qdrant */}
            <div className="text-center">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-3">
                <Database className="w-8 h-8 text-emerald-600" />
              </div>
              <h3 className="font-medium text-slate-900">Qdrant</h3>
              <p className="text-sm text-slate-500">Vector Database</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Migration Status */}
      {migrationStatus && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Migration Status</span>
              <Badge variant={migrationStatus.isComplete ? "default" : "secondary"}>
                {migrationStatus.isComplete ? 'Complete' : 'Pending'}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Progress Overview */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-slate-50 rounded-lg">
                <div className="text-2xl font-bold text-slate-900">{migrationStatus.projectsMigrated}</div>
                <div className="text-sm text-slate-600">Projects</div>
              </div>
              <div className="text-center p-3 bg-slate-50 rounded-lg">
                <div className="text-2xl font-bold text-slate-900">{migrationStatus.entitiesMigrated}</div>
                <div className="text-sm text-slate-600">Entities</div>
              </div>
              <div className="text-center p-3 bg-slate-50 rounded-lg">
                <div className="text-2xl font-bold text-slate-900">{migrationStatus.relationshipsMigrated}</div>
                <div className="text-sm text-slate-600">Relationships</div>
              </div>
              <div className="text-center p-3 bg-slate-50 rounded-lg">
                <div className="text-2xl font-bold text-slate-900">{migrationStatus.settingsMigrated}</div>
                <div className="text-sm text-slate-600">Settings</div>
              </div>
            </div>

            {/* Migration Timeline */}
            {migrationStatus.startTime && (
              <div className="text-sm text-slate-600">
                <div>Started: {new Date(migrationStatus.startTime).toLocaleString()}</div>
                {migrationStatus.endTime && (
                  <div>Completed: {new Date(migrationStatus.endTime).toLocaleString()}</div>
                )}
              </div>
            )}

            {/* Errors */}
            {hasErrors && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <div className="font-medium mb-2">Migration Errors:</div>
                  <ul className="list-disc list-inside space-y-1">
                    {migrationStatus.errors.map((error, index) => (
                      <li key={index} className="text-sm">{error}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <Card>
        <CardHeader>
          <CardTitle>Migration Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button 
              onClick={startMigration}
              disabled={isLoading || migrationStatus?.isComplete}
              className="flex items-center"
            >
              <Play className="w-4 h-4 mr-2" />
              Start Migration
            </Button>

            <Button 
              onClick={verifyMigration}
              variant="outline"
              disabled={isLoading}
              className="flex items-center"
            >
              <Shield className="w-4 h-4 mr-2" />
              Verify Migration
            </Button>

            <Button 
              onClick={rollbackMigration}
              variant="destructive"
              disabled={isLoading}
              className="flex items-center"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Rollback
            </Button>
          </div>

          {/* Last Action Status */}
          {lastAction && (
            <div className="mt-4 p-3 bg-slate-50 rounded-lg">
              <div className="text-sm font-medium text-slate-900">Last Action:</div>
              <div className="text-sm text-slate-600">{lastAction}</div>
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="mt-4">
              <div className="flex items-center space-x-2 text-sm text-slate-600">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Processing...</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Benefits of Migration */}
      <Card>
        <CardHeader>
          <CardTitle>Benefits of Qdrant-Only Architecture</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <CheckCircle className="w-5 h-5 text-emerald-600 mt-0.5" />
                <div>
                  <div className="font-medium text-slate-900">Simplified Architecture</div>
                  <div className="text-sm text-slate-600">Single database system instead of dual complexity</div>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <CheckCircle className="w-5 h-5 text-emerald-600 mt-0.5" />
                <div>
                  <div className="font-medium text-slate-900">Better Semantic Search</div>
                  <div className="text-sm text-slate-600">Everything becomes searchable by semantic similarity</div>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <CheckCircle className="w-5 h-5 text-emerald-600 mt-0.5" />
                <div>
                  <div className="font-medium text-slate-900">Unified Data Model</div>
                  <div className="text-sm text-slate-600">All data in vector space enables semantic relationships</div>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <CheckCircle className="w-5 h-5 text-emerald-600 mt-0.5" />
                <div>
                  <div className="font-medium text-slate-900">Reduced Complexity</div>
                  <div className="text-sm text-slate-600">No need to sync between two databases</div>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <CheckCircle className="w-5 h-5 text-emerald-600 mt-0.5" />
                <div>
                  <div className="font-medium text-slate-900">Cost Efficiency</div>
                  <div className="text-sm text-slate-600">One database to maintain, monitor, and scale</div>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <CheckCircle className="w-5 h-5 text-emerald-600 mt-0.5" />
                <div>
                  <div className="font-medium text-slate-900">Modern AI-First</div>
                  <div className="text-sm text-slate-600">Vector databases are the standard for AI applications</div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 