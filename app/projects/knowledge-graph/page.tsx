"use client";

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function KnowledgeGraphPage() {
  const router = useRouter();
  
  useEffect(() => {
    // Redirect to entities page
    router.push('/projects/knowledge-graph/entities');
  }, [router]);
  
  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-gray-400">Redirecting to entities page...</p>
      </div>
    </div>
  );
}