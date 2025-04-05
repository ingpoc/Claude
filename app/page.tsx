import React from 'react';
import Link from 'next/link';
import Navigation from '../components/Navigation';

export default function Home() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <Navigation currentPath="/" />
      
      <div className="container mx-auto px-4 py-16 max-w-6xl">
        <h1 className="text-4xl font-bold text-center mb-8">AI Memory - Knowledge Graph MCP</h1>
        
        <p className="text-center text-xl text-gray-400 max-w-3xl mx-auto mb-8">
          A memory context protocol that allows AI agents to remember, recall, and reason
          across chat sessions using an intelligent knowledge graph structure.
        </p>
        
        <div className="flex justify-center mt-16">
          <div className="bg-gray-900 p-8 rounded-lg max-w-md transform transition duration-300 hover:scale-105 hover:shadow-xl">
            <h2 className="text-xl font-semibold mb-4">Project Management</h2>
            <p className="text-gray-400 mb-4">Create and manage projects to organize your knowledge entities.</p>
            <Link 
              href="/projects"
              className="inline-block mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition duration-300 hover:-translate-y-1"
            >
              View Projects
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}