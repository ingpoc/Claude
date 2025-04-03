import React from 'react';
import Link from 'next/link';
import { Calendar, ExternalLink, Layers } from 'lucide-react';

interface ProjectCardProps {
  id: string;
  name: string;
  description: string;
  lastUpdated: string;
}

const ProjectCard: React.FC<ProjectCardProps> = ({ id, name, description, lastUpdated }) => {
  return (
    <div className="bg-gray-900 rounded-lg overflow-hidden transform transition-all duration-300 hover:scale-[1.02] hover:shadow-xl">
      <div className="h-2 bg-blue-600"></div>
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold mb-2">{name}</h2>
            <p className="text-gray-400">{description}</p>
          </div>
          <div className="bg-gray-800 p-2 rounded-full">
            <Layers size={18} className="text-blue-400" />
          </div>
        </div>
        
        <div className="text-sm text-gray-500 flex items-center mb-6">
          <Calendar size={14} className="mr-1" />
          Last updated: {lastUpdated}
        </div>
        
        <div className="flex justify-between items-center pt-4 border-t border-gray-800">
          <span className="text-sm font-medium text-gray-400">2 Entities</span>
          <Link 
            href={`/projects/${id}/entities`}
            className="inline-flex items-center text-sm text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded transition-colors duration-200"
          >
            <ExternalLink size={14} className="mr-1" />
            View Project
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ProjectCard;