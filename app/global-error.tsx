"use client";

import React from 'react';
import { AlertCircle } from 'lucide-react';
import { Button } from '../components/ui/button';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body className="bg-background text-foreground">
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="bg-card border rounded-lg p-8 max-w-lg w-full text-center shadow-sm">
            <div className="flex items-center justify-center mb-6 text-destructive">
              <AlertCircle size={48} />
            </div>
            
            <h1 className="text-2xl font-semibold text-foreground mb-4">Something Went Wrong</h1>
            
            <div className="bg-muted rounded p-4 mb-6 overflow-auto max-h-64 text-left">
              <h2 className="font-medium text-foreground mb-2">Error Details:</h2>
              <pre className="text-sm text-destructive whitespace-pre-wrap">
                {error.message}
              </pre>
            </div>
            
            <p className="text-muted-foreground mb-6">
              Try refreshing the page or clicking the button below to try again.
            </p>
            
            <div className="flex justify-center">
              <Button onClick={() => reset()}>
                Try Again
              </Button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}