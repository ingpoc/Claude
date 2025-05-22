"use client";

import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from './button';
import { Card } from './card';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; resetError: () => void }>;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  resetError = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return <FallbackComponent error={this.state.error} resetError={this.resetError} />;
      }

      return <DefaultErrorFallback error={this.state.error} resetError={this.resetError} />;
    }

    return this.props.children;
  }
}

function DefaultErrorFallback({ error, resetError }: { error: Error; resetError: () => void }) {
  return (
    <Card className="p-6 m-4 border-destructive">
      <div className="flex items-start gap-4">
        <AlertTriangle className="w-6 h-6 text-destructive mt-1" />
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-destructive mb-2">
            Something went wrong
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            {error.message || 'An unexpected error occurred. Please try again.'}
          </p>
          {process.env.NODE_ENV === 'development' && (
            <details className="mb-4">
              <summary className="text-sm text-muted-foreground cursor-pointer">
                Error Details (Development)
              </summary>
              <pre className="mt-2 text-xs text-muted-foreground bg-muted p-2 rounded overflow-auto">
                {error.stack}
              </pre>
            </details>
          )}
          <Button onClick={resetError} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        </div>
      </div>
    </Card>
  );
}

// Hook for functional component error handling
export function useErrorHandler() {
  return React.useCallback((error: Error) => {
    console.error('useErrorHandler caught an error:', error);
    // In a real app, you might want to send this to an error reporting service
    throw error;
  }, []);
} 