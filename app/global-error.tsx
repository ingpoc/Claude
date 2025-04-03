"use client";

import React from 'react';
import { AlertCircle } from 'lucide-react';

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
          <div className="bg-gray-900 rounded-lg p-8 max-w-lg w-full">
            <div className="flex items-center justify-center mb-6 text-red-500">
              <AlertCircle size={48} />
            </div>
            
            <h1 className="text-2xl font-bold text-center mb-4">Something Went Wrong</h1>
            
            <div className="bg-gray-800 rounded p-4 mb-6 overflow-auto max-h-64">
              <h2 className="font-medium mb-2">Error Details:</h2>
              <pre className="text-sm text-red-400 whitespace-pre-wrap">
                {error.message}
              </pre>
            </div>
            
            <p className="text-gray-400 text-center mb-6">
              Try refreshing the page or clicking the button below to try again.
            </p>
            
            <div className="flex justify-center">
              <button
                onClick={() => reset()}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}