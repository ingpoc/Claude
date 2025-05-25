"use client";

import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    // Log the error to an error reporting service
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Card className="max-w-lg w-full">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center mb-4 text-red-500">
            <AlertCircle size={48} />
          </div>
          <CardTitle className="text-2xl font-semibold text-slate-900">
            Something Went Wrong
          </CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="bg-slate-100 rounded p-4">
            <h3 className="font-medium text-slate-900 mb-2">Error Details:</h3>
            <pre className="text-sm text-red-600 whitespace-pre-wrap overflow-auto max-h-32">
              {error.message}
            </pre>
            {error.digest && (
              <p className="text-xs text-slate-500 mt-2">
                Error ID: {error.digest}
              </p>
            )}
          </div>
          
          <p className="text-slate-600 text-center">
            This error has been logged. You can try refreshing the page or clicking the button below.
          </p>
          
          <div className="flex justify-center">
            <Button 
              onClick={() => reset()}
              className="flex items-center gap-2"
            >
              <RefreshCw size={16} />
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 