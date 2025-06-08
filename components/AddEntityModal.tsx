import React, { useState, useEffect } from 'react';
import { EntityTypes } from '../lib/constants';
import { cn } from "../lib/utils";

// Import shadcn components
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

interface AddEntityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string, type: string, description: string) => void;
}

// Define options for the select dropdown based on EntityTypes
const entityTypeOptions = Object.values(EntityTypes).map(type => ({
  value: type,
  label: type.charAt(0).toUpperCase() + type.slice(1) // Capitalize first letter
}));

const AddEntityModal: React.FC<AddEntityModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<string>(EntityTypes.COMPONENT);
  const [description, setDescription] = useState('');

  // Reset form when modal is closed/opened
  useEffect(() => {
    if (isOpen) {
      setName('');
      setType(EntityTypes.COMPONENT);
      setDescription('');
    }
  }, [isOpen]);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !type || !description.trim()) { 
      // Basic validation
      // Consider adding more specific error feedback (e.g., toast)
      console.error('Form validation failed: Missing required fields.');
      return;
    } 
    onSubmit(name, type, description);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[480px]"> {/* Slightly wider */} 
        <DialogHeader>
          <DialogTitle>Add New Entity</DialogTitle>
          <DialogDescription>
            Define a new component, page, function, or other entity for your project.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {/* Name Field */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="col-span-3"
                placeholder="e.g. UserAuthenticationService"
                required
              />
            </div>
            
            {/* Type Field */}
            <div className="grid grid-cols-4 items-center gap-4">
               <Label htmlFor="type" className="text-right">
                 Type <span className="text-destructive">*</span>
               </Label>
               <Select 
                 value={type} 
                 onValueChange={setType} // Directly set the type state
                 required
                >
                 <SelectTrigger id="type" className="col-span-3">
                   <SelectValue placeholder="Select entity type" />
                 </SelectTrigger>
                 <SelectContent>
                   {entityTypeOptions.map(option => (
                     <SelectItem key={option.value} value={option.value}>
                       {option.label}
                     </SelectItem>
                   ))}
                 </SelectContent>
               </Select>
            </div>
            
            {/* Description Field */}
            <div className="grid grid-cols-4 items-start gap-4"> 
              <Label htmlFor="description" className="text-right pt-2">
                Description <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="col-span-3 min-h-24"
                placeholder="Explain the purpose and main function of this entity..."
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">
              Add Entity
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddEntityModal;