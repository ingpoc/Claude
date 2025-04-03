import React from 'react';
import Link from 'next/link';
import { Home, Layers, Moon } from 'lucide-react';

interface NavigationProps {
  currentPath: string;
}

const Navigation: React.FC<NavigationProps> = ({ currentPath }) => {
  return (
    <header className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between shadow-md">
      <div className="flex items-center">
        <Link href="/" className="text-xl font-semibold flex items-center text-white hover:text-blue-400 transition-colors duration-200">
          Knowledge Graph MCP
        </Link>
        
        <nav className="ml-8 flex items-center space-x-4">
          <Link 
            href="/" 
            className={`flex items-center px-3 py-2 rounded transition-all duration-200 relative group ${
              currentPath === '/' ? 'bg-blue-600 text-white' : 'hover:bg-gray-800'
            }`}
          >
            <Home size={18} className="mr-2" />
            Home
            {currentPath !== '/' && (
              <span className="absolute inset-x-0 bottom-0 h-0.5 bg-blue-600 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-200"></span>
            )}
          </Link>
          <Link 
            href="/projects" 
            className={`flex items-center px-3 py-2 rounded transition-all duration-200 relative group ${
              currentPath.startsWith('/projects') ? 'bg-blue-600 text-white' : 'hover:bg-gray-800'
            }`}
          >
            <Layers size={18} className="mr-2" />
            Projects
            {!currentPath.startsWith('/projects') && (
              <span className="absolute inset-x-0 bottom-0 h-0.5 bg-blue-600 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-200"></span>
            )}
          </Link>
        </nav>
      </div>
      
      <button className="p-2 rounded-full hover:bg-gray-800 transition-colors duration-200">
        <Moon size={20} />
      </button>
    </header>
  );
};

export default Navigation;