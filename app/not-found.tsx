import React from 'react';
import Link from 'next/link';
import { ArrowLeft, FileQuestion } from 'lucide-react';
import { Button } from '../components/ui/button';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
      <div className="bg-card border rounded-lg p-8 max-w-md w-full text-center shadow-sm">
        <div className="flex items-center justify-center mb-6 text-primary">
          <FileQuestion size={48} />
        </div>
        
        <h1 className="text-2xl font-semibold text-foreground mb-4">Page Not Found</h1>
        
        <p className="text-muted-foreground mb-6">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        
        <div className="flex justify-center">
          <Button asChild>
            <Link href="/"> 
              <ArrowLeft size={16} className="mr-2" />
              Return to Home
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}