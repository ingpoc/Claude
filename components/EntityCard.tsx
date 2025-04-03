import React from 'react';
import { Code, FunctionSquare } from 'lucide-react';

interface EntityCardProps {
  name: string;
  type: 'class' | 'function';
  onClick?: () => void;
}

const EntityCard: React.FC<EntityCardProps> = ({ name, type, onClick }) => {
  return (
    <div 
      className="bg-gray-900 rounded-lg p-5 cursor-pointer transition-all duration-300 hover:scale-[1.03] hover:shadow-lg"
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-lg">{name}</h3>
        <div className={`p-2 rounded-full ${type === 'class' ? 'bg-blue-900/30' : 'bg-green-900/30'}`}>
          {type === 'class' ? (
            <Code size={18} className="text-blue-400" />
          ) : (
            <FunctionSquare size={18} className="text-green-400" />
          )}
        </div>
      </div>
      <div className={`text-sm inline-block py-1 px-2 rounded-full ${type === 'class' ? 'text-blue-400 bg-blue-900/20' : 'text-green-400 bg-green-900/20'}`}>
        {type}
      </div>
    </div>
  );
};

export default EntityCard;