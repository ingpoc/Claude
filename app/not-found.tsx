import React from 'react';
import Link from 'next/link';
import { ArrowLeft, FileQuestion } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
      <div className="bg-gray-900 rounded-lg p-8 max-w-md w-full">
        <div className="flex items-center justify-center mb-6 text-blue-500">
          <FileQuestion size={48} />
        </div>
        
        <h1 className="text-2xl font-bold text-center mb-4">Page Not Found</h1>
        
        <p className="text-gray-400 text-center mb-6">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        
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