"use client";

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, AlertCircle } from 'lucide-react';

export default function ErrorPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
      <div className="bg-gray-900 rounded-lg p-8 max-w-md w-full">
        <div className="flex items-center justify-center mb-6 text-red-500">
          <AlertCircle size={48} />
        </div>
        
        <h1 className="text-2xl font-bold text-center mb-4">Something Went Wrong</h1>
        
        <p className="text-gray-400 text-center mb-6">
          An error occurred while rendering this page. This might be due to routing issues or component errors.
        </p>
        
        <div className="bg-gray-800 rounded p-4 mb-6">
          <h2 className="font-medium mb-2">Possible Solutions:</h2>
          <ul className="text-sm space-y-2">
            <li>• Check component exports and imports</li>
            <li>• Verify route paths are correctly defined</li>
            <li>• Ensure all required props are passed to components</li>
            <li>• Look for syntax errors in component files</li>
          </ul>
        </div>
        
        <div className="flex justify-center">
          <Link 
            href="/" 
            className="flex items-center bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
          >
            <ArrowLeft size={16} className="mr-2" />
            Return to Home
          </Link>
        </div>
      </div>
    </div>
  );
}