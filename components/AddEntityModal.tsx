import React, { useState } from 'react';
import { X } from 'lucide-react';
import { EntityTypes } from '@/lib/constants';

interface AddEntityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string, type: string, description: string) => void;
}

const AddEntityModal: React.FC<AddEntityModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [name, setName] = useState('');
  const [type, setType] = useState(EntityTypes.COMPONENT);
  const [description, setDescription] = useState('');
  const [parentId, setParentId] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name || !type || !description) {
      alert('Please fill out all required fields');
      return;
    }
    
    onSubmit(name, type, description);
    
    // Reset form
    setName('');
    setType(EntityTypes.COMPONENT);
    setDescription('');
    setParentId('');
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-lg w-full max-w-lg p-6 shadow-xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">Add New Entity</h2>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-gray-800"
          >
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-1">
                Entity Name <span className="text-red-500">*</span>
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. SearchComponent"
                required
              />
            </div>
            
            <div>
              <label htmlFor="type" className="block text-sm font-medium mb-1">
                Entity Type <span className="text-red-500">*</span>
              </label>
              <select
                id="type"
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value={EntityTypes.COMPONENT}>Component</option>
                <option value={EntityTypes.PAGE}>Page</option>
                <option value={EntityTypes.FUNCTION}>Function</option>
                <option value={EntityTypes.CLASS}>Class</option>
                <option value={EntityTypes.API}>API</option>
                <option value={EntityTypes.UTILITY}>Utility</option>
                <option value={EntityTypes.CONFIG}>Config</option>
                <option value={EntityTypes.DOMAIN}>Domain</option>
              </select>
            </div>
            
            <div>
              <label htmlFor="description" className="block text-sm font-medium mb-1">
                Description <span className="text-red-500">*</span>
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px]"
                placeholder="Brief explanation of the entity's purpose..."
                required
              />
            </div>
          </div>
          
          <div className="flex justify-end space-x-2 mt-8">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-md"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md"
            >
              Add Entity
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddEntityModal;