import React from 'react';
import Link from 'next/link';
import { ArrowRight, Calendar, ExternalLink, FileText, Layers, Trash2 } from 'lucide-react';

interface ProjectCardProps {
  id: string;
  name: string;
  description: string;
  lastUpdated: string;
  onDelete?: () => void;
}

const ProjectCard: React.FC<ProjectCardProps> = ({ id, name, description, lastUpdated, onDelete }) => {
  return (
    <div className="bg-gray-800/50 border border-gray-700/60 rounded-lg p-5 flex flex-col justify-between hover:shadow-lg transition-shadow duration-300 hover:border-gray-600">
      <div>
        <h2 className="text-lg font-semibold text-gray-100 mb-2">{name}</h2>
        <p className="text-sm text-gray-400 line-clamp-2 mb-4 flex items-start">
          <FileText size={14} className="text-gray-500 mr-2 mt-0.5 flex-shrink-0" />
          {description || "No description provided."}
        </p>
      </div>
      
      <div className="flex justify-between items-center mt-4">
        <div className="text-xs text-gray-500 flex items-center">
          <Calendar size={12} className="mr-1.5" />
          Last Updated: {lastUpdated}
        </div>
        
        <div className="flex items-center space-x-2">
          {onDelete && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onDelete();
              }}
              className="p-1.5 rounded text-gray-400 hover:bg-red-900/50 hover:text-red-400 transition-colors duration-200"
              title="Delete Project"
              aria-label="Delete Project"
            >
              <Trash2 size={16} />
            </button>
          )}

          <Link 
            href={`/projects/${id}/entities`}
            className="inline-flex items-center text-xs bg-blue-600/80 hover:bg-blue-600 text-white px-3 py-1.5 rounded transition duration-300"
          >
            View Project <ArrowRight size={14} className="ml-1" />
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ProjectCard;