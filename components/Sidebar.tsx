import React, { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronDown, ChevronRight, Code, FunctionSquare } from 'lucide-react';

interface SidebarProps {
  projectName: string;
  projectId: string;
}

const Sidebar: React.FC<SidebarProps> = ({ projectName, projectId }) => {
  const [featuresExpanded, setFeaturesExpanded] = useState(true);
  const [entityTypesExpanded, setEntityTypesExpanded] = useState(true);
  
  return (
    <div className="w-64 bg-gray-900 h-screen border-r border-gray-800 flex flex-col">
      <div className="px-4 py-3 border-b border-gray-800">
        <Link 
          href="/projects" 
          className="flex items-center text-sm text-gray-400 hover:text-white transition-colors duration-200"
        >
          <ChevronLeft size={16} className="mr-1" />
          Back to Projects
        </Link>
      </div>
      
      <div className="px-4 py-4 border-b border-gray-800">
        <h2 className="text-lg font-medium">{projectName}</h2>
        <div className="flex items-center mt-1">
          <span className="bg-green-500 rounded-full w-2 h-2 mr-2"></span>
          <span className="text-sm text-gray-400">Active</span>
        </div>
        <div className="mt-2 text-sm text-gray-500">
          Last Updated: 3/31/2025
        </div>
        <div className="mt-2 text-sm text-gray-400">
          {projectName === 'Financial Dashboard' && 'Real-time financial analytics dashboard'}
          {projectName === 'Recipe Application' && 'A recipe management application with AI features'}
          {projectName === 'Knowledge Graph' && 'A knowledge graph for code understanding'}
        </div>
      </div>
      
      <div className="px-4 py-3 border-b border-gray-800">
        <button 
          onClick={() => setFeaturesExpanded(!featuresExpanded)}
          className="flex items-center justify-between w-full"
        >
          <span className="font-medium">Features</span>
          {featuresExpanded ? 
            <ChevronDown size={16} /> : 
            <ChevronRight size={16} />
          }
        </button>
        
        <ul className={`mt-2 space-y-1 transition-all duration-300 ${featuresExpanded ? 'max-h-20 opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
          <li>
            <Link 
              href={`/projects/${projectId}/entities`} 
              className="block text-sm py-1 px-2 rounded hover:bg-gray-800"
            >
              All Entities
            </Link>
          </li>
        </ul>
      </div>
      
      <div className="px-4 py-3 border-b border-gray-800">
        <button 
          onClick={() => setEntityTypesExpanded(!entityTypesExpanded)}
          className="flex items-center justify-between w-full"
        >
          <span className="font-medium">Entity Types</span>
          {entityTypesExpanded ?
            <ChevronDown size={16} /> :
            <ChevronRight size={16} />
          }
        </button>
        
        <ul className={`mt-2 space-y-1 transition-all duration-300 ${entityTypesExpanded ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
          <li>
            <div className="flex items-center justify-between text-sm py-1 px-2 rounded hover:bg-gray-800 cursor-pointer">
              <div className="flex items-center">
                <Code size={14} className="mr-2" />
                class
              </div>
              <span className="text-xs text-gray-500">(1)</span>
            </div>
          </li>
          <li>
            <div className="flex items-center justify-between text-sm py-1 px-2 rounded hover:bg-gray-800 cursor-pointer">
              <div className="flex items-center">
                <FunctionSquare size={14} className="mr-2" />
                function
              </div>
              <span className="text-xs text-gray-500">(1)</span>
            </div>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default Sidebar;